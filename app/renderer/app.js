const WINDOW_MS = 2000; // visible time-axis span (width of the scrolling window)
const TICK_STEP_MS = 400; // spacing between ruler/grid ticks
const FLAT_Y = 80; // resting (low) line position within the 0-100 viewBox

const CHANNELS = [
  { id: 0, sub: 'Label_0', color: 'var(--ch0)', freq: 8 },
  { id: 1, sub: 'Label_1', color: 'var(--ch1)', freq: 5 },
  { id: 2, sub: 'Label_2', color: 'var(--ch2)', freq: 5 },
  { id: 3, sub: 'Label_3', color: 'var(--ch3)', freq: 1 },
  { id: 4, sub: 'Label_4', color: 'var(--ch4)', freq: 14 },
  { id: 5, sub: 'Label_5', color: 'var(--ch5)', freq: 7 },
  { id: 6, sub: 'Label_6', color: 'var(--ch6)', freq: 2 },
  { id: 7, sub: 'Label_7', color: 'var(--ch7)', freq: 18 },
];

// waveform generation 
function flatLinePoints() {
  return `0,${FLAT_Y} ${WINDOW_MS},${FLAT_Y}`;
}

// DOM building
const channelsEl = document.getElementById('channels');
const rulerTrackEl = document.getElementById('rulerTrack');
const gridOverlayEl = document.getElementById('gridOverlay');
const cursorLineEl = document.getElementById('cursorLine');

// note: still trying to figure out how to implement the horizontal scroll effect so the cursor line never goes off screen
function tickValuesForOffset(offsetMs) {
  const startTick = Math.floor(offsetMs / TICK_STEP_MS) * TICK_STEP_MS;
  const ticks = [];
  for (let ms = startTick; ms <= offsetMs + WINDOW_MS; ms += TICK_STEP_MS) {
    ticks.push(ms);
  }
  return ticks;
}

function buildRuler(offsetMs = 0) {
  rulerTrackEl.innerHTML = '';
  tickValuesForOffset(offsetMs).forEach((ms) => {
    const tick = document.createElement('div');
    tick.className = 'tick';
    tick.style.left = `${((ms - offsetMs) / WINDOW_MS) * 100}%`;
    tick.textContent = `${ms}ms`;
    rulerTrackEl.appendChild(tick);
  });
}

function buildGridOverlay(offsetMs = 0) {
  gridOverlayEl.innerHTML = '';
  tickValuesForOffset(offsetMs).forEach((ms) => {
    const leftPct = ((ms - offsetMs) / WINDOW_MS) * 100;
    if (leftPct <= 0) return;
    const line = document.createElement('div');
    line.className = 'grid-line';
    line.style.left = `${leftPct}%`;
    gridOverlayEl.appendChild(line);
  });
}

function buildEditableSubLabel(channel) {
  const span = document.createElement('span');
  span.className = 'ch-sub';
  span.contentEditable = 'true';
  span.spellcheck = false;
  span.title = 'Click to rename';
  span.textContent = channel.sub;

  const commit = () => {
    const value = span.textContent.replace(/\s+/g, ' ').trim();
    channel.sub = value || `Label_${channel.id}`;
    span.textContent = channel.sub;
  };

  span.addEventListener('focus', () => {
    const range = document.createRange();
    range.selectNodeContents(span);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });

  span.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      span.blur();
    } else if (e.key === 'Escape') {
      span.textContent = channel.sub;
      span.blur();
    }
  });

  span.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  });

  span.addEventListener('blur', commit);

  // renaming shouldn't toggle the row's selection state
  span.addEventListener('click', (e) => e.stopPropagation());

  return span;
}

function buildChannelRow(channel) {
  const row = document.createElement('div');
  row.className = 'channel-row';
  row.style.setProperty('--ch-color', channel.color);
  row.tabIndex = 0;
  row.setAttribute('role', 'button');
  row.setAttribute('aria-pressed', 'false');
  row.addEventListener('click', () => selectChannel(channel.id));
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectChannel(channel.id);
    }
  });

  const label = document.createElement('div');
  label.className = 'channel-label';

  const inner = document.createElement('div');
  inner.className = 'channel-label-inner';

  const dot = document.createElement('span');
  dot.className = 'ch-dot';

  const text = document.createElement('div');
  text.className = 'ch-text';

  const name = document.createElement('span');
  name.className = 'ch-name';
  name.textContent = `CH ${channel.id}`;

  text.appendChild(name);
  text.appendChild(buildEditableSubLabel(channel));

  inner.appendChild(dot);
  inner.appendChild(text);

  const freq = document.createElement('span');
  freq.className = 'ch-freq';
  freq.textContent = `${channel.freq}Hz`;

  label.appendChild(inner);
  label.appendChild(freq);

  const waveWrap = document.createElement('div');
  waveWrap.className = 'wave-container';

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${WINDOW_MS} 100`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.classList.add('wave-svg');

  const polyline = document.createElementNS(svgNS, 'polyline');
  polyline.classList.add('wave-line');
  polyline.setAttribute('points', flatLinePoints());

  svg.appendChild(polyline);
  waveWrap.appendChild(svg);

  row.appendChild(label);
  row.appendChild(waveWrap);
  return { row, polyline };
}

const rowRefs = [];
let selectedChannelId = null;

function selectChannel(channelId) {
  selectedChannelId = selectedChannelId === channelId ? null : channelId;
  rowRefs.forEach(({ channel, row }) => {
    const isSelected = channel.id === selectedChannelId;
    row.classList.toggle('selected', isSelected);
    row.setAttribute('aria-pressed', String(isSelected));
  });
}

function buildChannels() {
  channelsEl.innerHTML = '';
  rowRefs.length = 0;
  CHANNELS.forEach((channel) => {
    const { row, polyline } = buildChannelRow(channel);
    channelsEl.appendChild(row);
    rowRefs.push({ channel, polyline, row });
  });
}

function setCursorPct(pct, ms) {
  cursorLineEl.style.left = `calc(var(--label-w) + (100% - var(--label-w)) * ${pct})`;
  let rulerCursor = document.getElementById('cursorReadout');
  if (!rulerCursor) {
    rulerCursor = document.createElement('div');
    rulerCursor.id = 'cursorReadout';
    rulerCursor.className = 'cursor-readout';
    rulerTrackEl.appendChild(rulerCursor);
  }
  rulerCursor.style.left = `${pct * 100}%`;
  rulerCursor.textContent = `${ms.toFixed(1)}ms`;
}

buildRuler();
buildGridOverlay();
buildChannels();
setCursorPct(0, 0);

// start/stop + timer
const startStopButton = document.getElementById('startStop');
const startStopLabel = document.getElementById('startStopLabel');
const startStopIcon = document.getElementById('startStopIcon');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const timerEl = document.getElementById('timer');
const tReadoutEl = document.getElementById('tReadout');

let isGettingData = false;
let startTimestamp = 0;
let elapsedMs = 0;
let rafId = null;
let lastTickBucket = 0; // which 400ms scroll bucket the ruler/grid are built for
let currentOffsetMs = 0; // ms value at the left edge of the visible window

function formatTimer(ms) {
  const totalMs = Math.max(0, ms);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = Math.floor(totalMs % 1000);
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const msStr = String(millis).padStart(3, '0');
  return `${mm}:${ss}.${msStr}`;
}

function tick(now) {
  if (!isGettingData) return;
  const currentElapsed = elapsedMs + (now - startTimestamp);
  timerEl.textContent = formatTimer(currentElapsed);

  // Once the capture runs past the visible window, keep the cursor pinned
  // at the right edge and scroll the ruler/grid leftward instead of
  // wrapping back to 0.
  const offsetMs = Math.max(0, currentElapsed - WINDOW_MS);
  const bucket = Math.floor(offsetMs / TICK_STEP_MS);
  if (bucket !== lastTickBucket) {
    buildRuler(offsetMs);
    buildGridOverlay(offsetMs);
    lastTickBucket = bucket;
  }

  currentOffsetMs = offsetMs;
  const pct = Math.min(1, (currentElapsed - offsetMs) / WINDOW_MS);
  setCursorPct(pct, currentElapsed);
  tReadoutEl.textContent = `T = ${currentElapsed.toFixed(2)} MS`;

  rafId = requestAnimationFrame(tick);
}

// moving the cursor to a specific spot
function pctFromClientX(clientX) {
  const rect = rulerTrackEl.getBoundingClientRect();
  const pct = (clientX - rect.left) / rect.width;
  return Math.min(1, Math.max(0, pct));
}

function scrubToClientX(clientX) {
  const pct = pctFromClientX(clientX);
  const ms = currentOffsetMs + pct * WINDOW_MS;
  setCursorPct(pct, ms);
  tReadoutEl.textContent = `T = ${ms.toFixed(2)} MS`;
}

function attachScrubbing(el) {
  el.addEventListener('mousedown', (e) => {
    if (isGettingData) return;
    e.preventDefault();
    scrubToClientX(e.clientX);
    const onMove = (moveEvent) => scrubToClientX(moveEvent.clientX);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}

attachScrubbing(rulerTrackEl);
attachScrubbing(channelsEl);

startStopButton.addEventListener('click', () => {
  if (!isGettingData) {
    isGettingData = true;
    startStopLabel.textContent = 'STOP';
    startStopIcon.textContent = '■';
    startStopButton.classList.add('running');
    statusDot.classList.add('live');
    statusText.textContent = 'RUNNING';
    startTimestamp = performance.now();
    rafId = requestAnimationFrame(tick);
  } else {
    isGettingData = false;
    startStopLabel.textContent = 'START';
    startStopIcon.textContent = '▶';
    startStopButton.classList.remove('running');
    statusDot.classList.remove('live');
    statusText.textContent = 'HALTED';
    elapsedMs += performance.now() - startTimestamp;
    if (rafId) cancelAnimationFrame(rafId);
  }
});

// test connection (ping)
const testConnectionButton = document.getElementById('testConnectionBtn');
const toastEl = document.getElementById('toast');

let toastTimer = null;

function showToast(message, variant) {
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.className = `toast show ${variant}`;
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3500);
}

testConnectionButton.addEventListener('click', async () => {
  testConnectionButton.disabled = true;
  const original = testConnectionButton.innerHTML;
  testConnectionButton.textContent = 'PINGING...';

  try {
    const result = await window.api.sendCommand('ping');
    if (result.ok) {
      showToast(`FPGA connected — Firmware v${result.version}`, 'success');
    } else {
      showToast(`Connection failed: ${result.error}`, 'error');
    }
  } catch (err) {
    showToast(`Connection failed: ${err.message}`, 'error');
  } finally {
    testConnectionButton.innerHTML = original;
    testConnectionButton.disabled = false;
  }
});
