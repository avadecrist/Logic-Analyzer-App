// isolates all hardware communication; this file moves bytes and correlates them by packet ID

const { EventEmitter } = require('node:events');
const { SerialPort } = require('serialport');
const { TYPE, createFrameParser, buildCommand, parseCommandResponse, parseSamplesPayload } = require('./protocol');

const BAUD_RATE = 115200; // firmware runs UART at 100MHz / 868 clks-per-bit (~115207)
const RESPONSE_TIMEOUT_MS = 1000;

// overrides auto-detection with a specific path (for testing)
const FORCED_PORT_PATH = process.env.LOGIC_ANALYZER_SERIAL_PORT || null;

let port = null;
let feed = null;
let nextId = 1;
const pending = new Map(); // id -> { commandName, resolve, timer }

// for packets that aren't a reply to anything (e.g. SAMPLES streamed during acquisition,
// see commands.md's ID-0 convention) -- consumed by main.js to forward over IPC
const events = new EventEmitter();

function allocateId() {
  const id = nextId;
  nextId = (nextId % 0xffff) + 1; // wrap around, skip 0
  return id;
}

// dispatches a validated incoming packet to whichever command is waiting on its ID,
// then hands off to protocol.js to interpret it.
function handlePacket({ type, id, payload }) {
  if (id === 0) {
    handleUnsolicitedPacket(type, payload);
    return;
  }

  const request = pending.get(id);
  if (!request) return; // already-timed-out packet

  clearTimeout(request.timer);
  pending.delete(id);

  try {
    request.resolve(parseCommandResponse(request.commandName, type, payload));
  } catch (err) {
    request.resolve({ ok: false, error: err.message });
  }
}

function handleUnsolicitedPacket(type, payload) {
  if (type !== TYPE.SAMPLES) return; // unrecognized push, ignore

  const samples = parseSamplesPayload(payload);
  if (samples) events.emit('samples', samples);
}

// used for disconnects and for unusable frames (CRC/version mismatch)
function failAllPending(message) {
  for (const request of pending.values()) {
    clearTimeout(request.timer);
    request.resolve({ ok: false, error: message });
  }
  pending.clear();
}

const FRAME_ERROR_MESSAGES = {
  CRC_MISMATCH: 'Corrupted packet received (CRC mismatch)',
  VERSION_MISMATCH: 'Received packet with an unsupported protocol version',
};

async function ensureConnected() {
  if (port && port.isOpen) return port;

  let path = FORCED_PORT_PATH;
  if (!path) {
    const ports = await SerialPort.list();
    if (ports.length === 0) throw new Error('No serial devices found');

    // FUTURE IMPLEMENTATION?: have dropdown to let the user choose a port when more than one is available
    path = ports[0].path;
  }

  port = new SerialPort({ path, baudRate: BAUD_RATE });
  feed = createFrameParser(handlePacket, (err) => {
    console.warn('[serial] frame error:', err.message);
    const message = FRAME_ERROR_MESSAGES[err.code];
    if (message) failAllPending(message);
  });

  port.on('data', (chunk) => feed(chunk));
  port.on('close', () => {
    port = null;
    feed = null;
  });

  await new Promise((resolve, reject) => {
    port.once('open', resolve);
    port.once('error', reject);
  });

  return port;
}

// sends a command and resolves once the matching response arrives (or times out after 1 sec)
async function sendCommand(name, { timeoutMs = RESPONSE_TIMEOUT_MS } = {}) {
  let activePort;
  try {
    activePort = await ensureConnected();
  } catch (err) {
    return { ok: false, error: err.message };
  }

  const id = allocateId();
  let packet;
  try {
    packet = buildCommand(name, id);
  } catch (err) {
    return { ok: false, error: err.message };
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve({ ok: false, error: 'Board did not respond' });
    }, timeoutMs);

    pending.set(id, { commandName: name, resolve, timer });

    activePort.write(packet, (err) => {
      if (err) {
        clearTimeout(timer);
        pending.delete(id);
        resolve({ ok: false, error: err.message });
      }
    });
  });
}

function disconnect() {
  failAllPending('Disconnected');

  if (port && port.isOpen) port.close();
  port = null;
  feed = null;
}

module.exports = { sendCommand, disconnect, events };
