// FOR TESTING PURPOSES ONLY: a fake firmware that responds to 'ping'/'start'/'stop', so the app
// can be tested without real hardware. On START it streams simulated square-wave samples for 8
// channels (mirroring renderer/app.js's CHANNELS frequencies) until STOP is received.

// uses protocol.js's encoder/decoder so it can test serial.js / IPC / UI pipeline end-to-end

// how to set up socat (brew install socat):
// ex:
//   1. socat -d -d pty,raw,echo=0,link=/tmp/vcom-app pty,raw,echo=0,link=/tmp/vcom-fw
//   2. node app/tools/fake-firmware.js /tmp/vcom-fw
//   3. LOGIC_ANALYZER_SERIAL_PORT=/tmp/vcom-app npm start
//   4. test commands in the app ("Test Connection"/"Start"/"Stop").

// pass --no-samples to ack START/STOP and exercise serial.js's framing/timeout/pending-map logic
// without actually streaming SAMPLES packets.

const { SerialPort } = require('serialport');
const { TYPE, PROTOCOL_VERSION, buildPacket, buildSamplesPayload, createFrameParser } = require('../main/protocol');

const [, , path, ...rest] = process.argv;

if (!path) {
  console.error('Usage: node fake-firmware.js <serial-path> [--version=1.0] [--no-samples]');
  process.exit(1);
}

const versionArg = rest.find((arg) => arg.startsWith('--version='));
const [versionMajor, versionMinor] = (versionArg ? versionArg.split('=')[1] : '1.0')
  .split('.')
  .map((n) => Number.parseInt(n, 10));

const samplesEnabled = !rest.includes('--no-samples');

// mirrors renderer/app.js's CHANNELS frequencies, index = channel id, so the simulated
// waveform matches what's shown on screen
const CHANNEL_FREQS_HZ = [8, 5, 5, 1, 14, 7, 2, 18];
const SAMPLE_INTERVAL_MS = 20; // fake ~50Hz sample push rate

const port = new SerialPort({ path, baudRate: 115200 });

port.on('open', () => {
  console.log(`[fake-firmware] listening on ${path}, reporting version ${versionMajor}.${versionMinor}`);
});

port.on('error', (err) => {
  console.error('[fake-firmware] serial error:', err.message);
  process.exit(1);
});

let sampleTimer = null;
let acquisitionStartedAt = 0;

function channelBitmaskAt(elapsedMs) {
  const elapsedSec = elapsedMs / 1000;
  let bits = 0;
  CHANNEL_FREQS_HZ.forEach((freq, i) => {
    const level = Math.floor(elapsedSec * freq * 2) % 2; // 50% duty-cycle square wave
    if (level) bits |= (1 << i);
  });
  return bits;
}

function startAcquisition() {
  stopAcquisition(); // guards against a second START landing while already running
  acquisitionStartedAt = Date.now();
  sampleTimer = setInterval(() => {
    const elapsedMs = Date.now() - acquisitionStartedAt;
    const payload = buildSamplesPayload(elapsedMs, channelBitmaskAt(elapsedMs));
    const packet = buildPacket(TYPE.SAMPLES, payload, 0); // 0 = unsolicited push, not a reply
    port.write(packet, (err) => {
      if (err) console.error('[fake-firmware] write error:', err.message);
    });
  }, SAMPLE_INTERVAL_MS);
}

function stopAcquisition() {
  if (sampleTimer) {
    clearInterval(sampleTimer);
    sampleTimer = null;
  }
}

function sendResponse(type, name, id) {
  const response = buildPacket(type, Buffer.alloc(0), id);
  port.write(response, (err) => {
    if (err) console.error('[fake-firmware] write error:', err.message);
    else console.log(`[fake-firmware] tx: ${name} id=${id}`);
  });
}

const feed = createFrameParser(
  (packet) => {
    console.log(`[fake-firmware] rx: type=0x${packet.type.toString(16)} id=${packet.id} payload=${packet.payload.toString('hex')}`);

    switch (packet.type) {
      case TYPE.PING: {
        const response = buildPacket(TYPE.PONG, Buffer.from([versionMajor, versionMinor]), packet.id);
        port.write(response, (err) => {
          if (err) console.error('[fake-firmware] write error:', err.message);
          else console.log(`[fake-firmware] tx: PONG id=${packet.id} version=${versionMajor}.${versionMinor}`);
        });
        break;
      }
      case TYPE.START:
        if (samplesEnabled) startAcquisition();
        sendResponse(TYPE.START_ACK, 'START_ACK', packet.id);
        break;
      case TYPE.STOP:
        stopAcquisition();
        sendResponse(TYPE.STOP_ACK, 'STOP_ACK', packet.id);
        break;
      default:
        console.log('[fake-firmware] ignoring unrecognized command type');
    }
  },
  (err) => console.warn('[fake-firmware] frame error:', err.message),
);

port.on('data', (chunk) => feed(chunk));

console.log(`[fake-firmware] protocol version 0x${PROTOCOL_VERSION.toString(16)}`);
