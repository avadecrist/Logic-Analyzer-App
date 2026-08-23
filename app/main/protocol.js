// using CRC16
// when we implement START, STOP, etc. we'd only have to add a new TYPE and a payload shape

const SYNC0 = 0xa5;
const SYNC1 = 0x5a;
const PROTOCOL_VERSION = 0x01;
const HEADER_LENGTH = 8; // SYNC(2) + VERSION(1) + TYPE(1) + ID(2) + LENGTH(2)

// Packet TYPE values so far (explained in commands.md)
const TYPE = {
  PING: 0x01,
  PONG: 0x02,
};


// CRC-16/CCITT-FALSE
    // bit-exact with crc16_update() in the firmware
function crc16(bytes) {
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= (byte << 8) & 0xffff;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

// builds a full packet for any TYPE
// 'id' is caller-supplied so so that serial.js can own request/response correlation.
function buildPacket(type, payload = Buffer.alloc(0), id) {
  const header = Buffer.alloc(HEADER_LENGTH - 2); // VERSION..LENGTH (sync bytes excluded from CRC)
  header.writeUInt8(PROTOCOL_VERSION, 0);
  header.writeUInt8(type, 1);
  header.writeUInt16LE(id, 2);
  header.writeUInt16LE(payload.length, 4);

  const crc = crc16(Buffer.concat([header, payload]));
  const crcBytes = Buffer.alloc(2);
  crcBytes.writeUInt16LE(crc, 0);

  return Buffer.concat([Buffer.from([SYNC0, SYNC1]), header, payload, crcBytes]);
}

function parsePongVersion(payload) {
  if (payload.length < 2) return null;
  return `${payload[0]}.${payload[1]}`;
}

// maps the command names the renderer/IPC layer
const COMMANDS = {
  // builds the request packet and defines how to interpret the response packet
  ping: {
    build: (id) => buildPacket(TYPE.PING, Buffer.alloc(0), id),
    parseResponse: (responseType, payload) => {
      if (responseType !== TYPE.PONG) {
        return { ok: false, error: `Unexpected response type 0x${responseType.toString(16)}` };
      }
      return { ok: true, version: parsePongVersion(payload) };
    },
  },
};

function buildCommand(name, id) {
  const command = COMMANDS[name];
  if (!command) throw new Error(`Unknown command "${name}"`);
  return command.build(id);
}

function parseCommandResponse(name, type, payload) {
  const command = COMMANDS[name];
  if (!command) throw new Error(`Unknown command "${name}"`);
  return command.parseResponse(type, payload);
}

function findSync(buffer) {
  for (let i = 0; i < buffer.length - 1; i++) {
    if (buffer[i] === SYNC0 && buffer[i + 1] === SYNC1) return i;
  }
  return -1;
}

// feeds raw serial bytes in as they arrive
// new commands won't need a new parser, just a new case where onPacket is used
function createFrameParser(onPacket, onError) { // onError logs version mismatches/CRC failures (parser resyncs on its own)
  let buffer = Buffer.alloc(0);

  return function feed(chunk) {
    buffer = Buffer.concat([buffer, chunk]);

    while (true) {
      const syncIndex = findSync(buffer);
      if (syncIndex === -1) {
        // Keep a trailing lone 0xA5 in case the next chunk brings 0x5A.
        buffer = buffer.length > 0 ? buffer.subarray(buffer.length - 1) : buffer;
        return;
      }
      if (syncIndex > 0) buffer = buffer.subarray(syncIndex);

      if (buffer.length < HEADER_LENGTH) return; // wait for the full header

      const version = buffer[2];
      if (version !== PROTOCOL_VERSION) {
        onError?.(new Error(`Unsupported protocol version 0x${version.toString(16)}`));
        buffer = buffer.subarray(2); // drop this sync pair and resync
        continue;
      }

      const type = buffer[3];
      const id = buffer.readUInt16LE(4);
      const length = buffer.readUInt16LE(6);
      const frameLength = HEADER_LENGTH + length + 2; // header + payload + crc16

      if (buffer.length < frameLength) return; // wait for the rest of the packet

      const payload = buffer.subarray(HEADER_LENGTH, HEADER_LENGTH + length);
      const receivedCrc = buffer.readUInt16LE(HEADER_LENGTH + length);
      const expectedCrc = crc16(buffer.subarray(2, HEADER_LENGTH + length));

      if (receivedCrc === expectedCrc) {
        onPacket({ type, id, payload: Buffer.from(payload) });
      } else {
        onError?.(new Error('CRC mismatch'));
      }

      buffer = buffer.subarray(frameLength);
    }
  };
}

module.exports = {
  SYNC0,
  SYNC1,
  PROTOCOL_VERSION,
  HEADER_LENGTH,
  TYPE,
  crc16,
  buildPacket,
  createFrameParser,
  parsePongVersion,
  buildCommand,
  parseCommandResponse,
};
