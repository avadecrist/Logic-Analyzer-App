# Trying out the app (no hardware required)

This walks through running the Logic Analyzer app against the **fake firmware**
simulator instead of a real board, so you can see live waveform capture and try
the jump-to-edge feature end to end.

You'll need three terminal tabs/windows, all opened to the `app/` folder of the
repo.

## 0. One-time setup

```bash
brew install socat   # only if you don't already have it
cd app
npm install
```

## 1. Terminal 1 — create a virtual serial port pair

`socat` fakes a serial cable between two virtual ports so the app and the fake
firmware can talk to each other like they would over a real USB connection.

```bash
socat -d -d pty,raw,echo=0,link=/tmp/vcom-app pty,raw,echo=0,link=/tmp/vcom-fw
```

Leave this running. You should see two lines confirming the two PTYs it created.

## 2. Terminal 2 — start the fake firmware

```bash
cd app
node tools/fake-firmware.js /tmp/vcom-fw
```

This simulates an FPGA board: it answers `PING`, and once it receives `START`
it streams 8 channels of simulated square-wave data (matching the frequencies
shown in the app) until it receives `STOP`. Leave this running too — you'll
see log lines here every time the app sends it a command.

## 3. Terminal 3 — launch the app pointed at the virtual port

```bash
cd app
LOGIC_ANALYZER_SERIAL_PORT=/tmp/vcom-app npm start
```

The app window should open. `LOGIC_ANALYZER_SERIAL_PORT` tells it to connect to
our fake serial port instead of auto-detecting a real device.

## 4. What to try in the app

1. **TEST CONNECTION** (top right) — should pop a green toast:
   `FPGA connected — Firmware v1.0`. Confirms the app and fake firmware can
   talk to each other before you do anything else.

2. **START** — the button flips to STOP, the timer starts counting, and all 8
   channel rows should start drawing real moving square waves (not flat
   lines) at their labeled frequencies. The view auto-scrolls to keep up as
   time passes.

3. **STOP** — waveforms freeze in place exactly where they were. Nothing
   should keep moving.

4. **Scroll left/right** over the channel area (two-finger swipe on a
   trackpad, or shift+scroll) — this only works once stopped. It pans back
   through the whole capture, revealing earlier data.

5. **Click a channel row** (e.g. `CH 3`, the slowest one — easiest to read by
   eye) to select it; the row highlights. Click it again to deselect.

6. **Jump to edge** — with a channel selected and the capture stopped, use the
   `◀ EDGE` / `EDGE ▶` buttons in the top bar. Each click moves the white
   cursor line to the previous/next level change (rising or falling edge) on
   the *selected* channel, panning the view if needed to keep it visible.
   Try clicking `EDGE ▶` repeatedly until you hit the end of the capture (you
   should get a "No later edge" toast), then `◀ EDGE` back through all of
   them to the start.

7. **START again** — confirms a fresh run: timer resets to 0, all waveforms
   clear and redraw from scratch rather than continuing the old capture.

## Troubleshooting

- **"No serial devices found" / app can't connect**: make sure Terminal 1
  (`socat`) is still running and Terminal 3 was launched with the
  `LOGIC_ANALYZER_SERIAL_PORT=/tmp/vcom-app` prefix.
- **Fake firmware shows nothing happening**: it only logs when it *receives* a
  command — check Terminal 3 for errors first.
- **Starting over**: `Ctrl+C` in all three terminals, then redo steps 1–3 in
  order (socat first, so the `/tmp/vcom-*` links exist before anything else
  tries to open them).
- **Leftover port files**: if a previous run didn't shut down cleanly, `rm -f
  /tmp/vcom-app /tmp/vcom-fw` before restarting `socat`.
