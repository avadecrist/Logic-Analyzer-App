// FOR TESTING PURPOSES ONLY: a fake firmware that responds to 'ping' command, so the app can be tested without real hardware

// uses protocol.js's encoder/decoder so it can test serial.js / IPC / UI pipeline end-to-end

// you'd need to insatll socat on your system (brew install socat)to create a virtual serial port pair, 
// then run this script on one end and the app on the other
// ex:
//   1. socat -d -d pty,raw,echo=0,link=/tmp/vcom-app pty,raw,echo=0,link=/tmp/vcom-fw
//   2. node app/tools/fake-firmware.js /tmp/vcom-fw
//   3. LOGIC_ANALYZER_SERIAL_PORT=/tmp/vcom-app npm start
//   4. click "TEST CONNECTION" in the app.

const { SerialPort } = require('serialport');
const { TYPE, PROTOCOL_VERSION, buildPacket, createFrameParser } = require('../main/protocol');

const [, , path, ...rest] = process.argv;

if (!path) {
  console.error('Usage: node fake-firmware.js <serial-path> [--version=1.0]');
  process.exit(1);
}

const versionArg = rest.find((arg) => arg.startsWith('--version='));
const [versionMajor, versionMinor] = (versionArg ? versionArg.split('=')[1] : '1.0')
  .split('.')
  .map((n) => Number.parseInt(n, 10));

const port = new SerialPort({ path, baudRate: 115200 });

port.on('open', () => {
  console.log(`[fake-firmware] listening on ${path}, reporting version ${versionMajor}.${versionMinor}`);
});

port.on('error', (err) => {
  console.error('[fake-firmware] serial error:', err.message);
  process.exit(1);
});

const feed = createFrameParser(
  (packet) => {
    console.log(`[fake-firmware] rx: type=0x${packet.type.toString(16)} id=${packet.id} payload=${packet.payload.toString('hex')}`);

    if (packet.type !== TYPE.PING) {
      console.log('[fake-firmware] ignoring unrecognized command type');
      return;
    }

    const response = buildPacket(TYPE.PONG, Buffer.from([versionMajor, versionMinor]), packet.id);
    port.write(response, (err) => {
      if (err) console.error('[fake-firmware] write error:', err.message);
      else console.log(`[fake-firmware] tx: PONG id=${packet.id} version=${versionMajor}.${versionMinor}`);
    });
  },
  (err) => console.warn('[fake-firmware] frame error:', err.message),
);

port.on('data', (chunk) => feed(chunk));

console.log(`[fake-firmware] protocol version 0x${PROTOCOL_VERSION.toString(16)}`);
