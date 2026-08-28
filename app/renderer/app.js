const WINDOW_MS = 2000; // width of the scrolling window
const PIN_LEAD_MS = 200; // gap after cursor once the view starts following it
const FOLLOW_THRESHOLD_MS = WINDOW_MS - PIN_LEAD_MS; // elapsed time at which the view starts scrolling
const TICK_STEP_MS = 400; // spacing between ruler/grid ticks
const WAVE_HIGH_Y = 20; // logic-high y position
const WAVE_LOW_Y = 80; // logic-low y position

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

// low line before sample is received
function flatLinePoints() {
  return `0,${WAVE_LOW_Y} ${WINDOW_MS},${WAVE_LOW_Y}`;
}

// DOM building
const analyzerEl = document.getElementById('analyzer');
const channelsEl = document.getElementById('channels');
const rulerTrackEl = document.getElementById('rulerTrack');
const gridOverlayEl = document.getElementById('gridOverlay');
const cursorLineEl = document.getElementById('cursorLine');

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

  // renaming won't toggle the row's selection state
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

// waveform points are drawn once at their absolute capture time and never moved
// panning/scrolling the visible window just shifts each SVG's viewBox origin
function updateWaveViewBox(offsetMs) {
  rowRefs.forEach(({ polyline }) => {
    polyline.ownerSVGElement.setAttribute('viewBox', `${offsetMs} 0 ${WINDOW_MS} 100`);
  });
}

function appendWavePoint(polyline, x, y) {
  const pt = polyline.ownerSVGElement.createSVGPoint();
  pt.x = x;
  pt.y = y;
  polyline.points.appendItem(pt);
}

// per-channel record of every level change during the run
//  independent from the SVG so the "jump to edge" feature can binary-search it without touching the DOM
function createEdgeBuffer(initialCapacity = 64) {
  return {
    edgeTimes: new Float64Array(initialCapacity), // ms of each transition, ascending
    edgeValues: new Uint8Array(initialCapacity), // 0/1 level starting at that time
    edgeCount: 0, // filled length; the arrays themselves may be over-allocated
  };
}

function pushEdge(buffer, tMs, value) {
  if (buffer.edgeCount === buffer.edgeTimes.length) {
    const grownTimes = new Float64Array(buffer.edgeTimes.length * 2);
    grownTimes.set(buffer.edgeTimes);
    buffer.edgeTimes = grownTimes;

    const grownValues = new Uint8Array(buffer.edgeValues.length * 2);
    grownValues.set(buffer.edgeValues);
    buffer.edgeValues = grownValues;
  }

  buffer.edgeTimes[buffer.edgeCount] = tMs;
  buffer.edgeValues[buffer.edgeCount] = value;
  buffer.edgeCount += 1;
}

// draws one incoming sample tick as a square-wave on each channel's polyline
function handleSamplePacket({ elapsedMs: sampleMs, channelBits }) {
  rowRefs.forEach(({ channel, polyline }) => {
    const level = (channelBits >> channel.id) & 1;
    const y = level ? WAVE_HIGH_Y : WAVE_LOW_Y;
    const points = polyline.points;

    // if it's the first sample for this channel --> drop the flat resting line and start a new trace
    if (channel.lastLevel === null) {
      points.clear();
      appendWavePoint(polyline, sampleMs, y);
      appendWavePoint(polyline, sampleMs, y);
      pushEdge(channel.edges, sampleMs, level);
    } else if (level !== channel.lastLevel) { // else end the old horizontal line, draw vertical transition, and start new horizontal line
      points.getItem(points.numberOfItems - 1).x = sampleMs;
      appendWavePoint(polyline, sampleMs, y);
      appendWavePoint(polyline, sampleMs, y);
      pushEdge(channel.edges, sampleMs, level);
    } else {
      points.getItem(points.numberOfItems - 1).x = sampleMs; // push the run's end anchor forward to continue horizontal line
    }

    channel.lastLevel = level;
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

// absolute time (ms) the cursor marker points at
let cursorMs = 0;

function updateCursorMarker() {
  const pct = (cursorMs - currentOffsetMs) / WINDOW_MS;
  const readout = document.getElementById('cursorReadout');
  const inView = pct >= 0 && pct <= 1;
  cursorLineEl.style.display = inView ? '' : 'none';
  if (readout) readout.style.display = inView ? '' : 'none';
  if (inView) setCursorPct(pct, cursorMs);
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
let totalCapturedMs = 0; // how much data has been captured so far
let unsubscribeSamples = null;

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

  // cursor pins to right edge of window once the elapsed time exceeds the follow threshold
  const offsetMs = Math.max(0, currentElapsed - FOLLOW_THRESHOLD_MS);
  const bucket = Math.floor(offsetMs / TICK_STEP_MS);
  if (bucket !== lastTickBucket) {
    buildRuler(offsetMs);
    buildGridOverlay(offsetMs);
    lastTickBucket = bucket;
  }

  currentOffsetMs = offsetMs;
  totalCapturedMs = currentElapsed;
  cursorMs = currentElapsed;
  updateWaveViewBox(offsetMs);
  const pct = Math.min(FOLLOW_THRESHOLD_MS / WINDOW_MS, (currentElapsed - offsetMs) / WINDOW_MS);
  cursorLineEl.style.display = '';
  setCursorPct(pct, currentElapsed);
  const readout = document.getElementById('cursorReadout');
  if (readout) readout.style.display = '';
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
  cursorMs = ms;
  cursorLineEl.style.display = '';
  setCursorPct(pct, ms);
  const readout = document.getElementById('cursorReadout');
  if (readout) readout.style.display = '';
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

// panning through captured data (only after clicking "stop")
function maxOffsetMs() {
  return Math.max(0, totalCapturedMs - FOLLOW_THRESHOLD_MS); // tracks when two-fingers swipe on mousepad
}

function panTimelineBy(deltaMs) {
  const clamped = Math.min(maxOffsetMs(), Math.max(0, currentOffsetMs + deltaMs));
  if (clamped === currentOffsetMs) return;
  currentOffsetMs = clamped;
  buildRuler(currentOffsetMs);
  buildGridOverlay(currentOffsetMs);
  updateWaveViewBox(currentOffsetMs);
  lastTickBucket = Math.floor(currentOffsetMs / TICK_STEP_MS);
  updateCursorMarker();
}

analyzerEl.addEventListener('wheel', (e) => {
  if (isGettingData) return; // view auto-follows the cursor while running
  if (maxOffsetMs() <= 0) return; // nothing beyond the current window to reveal
  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // let vertical scrolling behave normally
  e.preventDefault();
  const rect = rulerTrackEl.getBoundingClientRect();
  const msPerPixel = WINDOW_MS / rect.width;
  panTimelineBy(e.deltaX * msPerPixel);
}, { passive: false });

// jump to edge uses a binary search over a channel's edge buffer
function findEdgeIndexAfter(edges, tMs) {
  let lo = 0;
  let hi = edges.edgeCount;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (edges.edgeTimes[mid] > tMs) hi = mid;
    else lo = mid + 1;
  }
  return lo < edges.edgeCount ? lo : -1;
}

function findEdgeIndexBefore(edges, tMs) {
  let lo = 0;
  let hi = edges.edgeCount;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (edges.edgeTimes[mid] < tMs) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 ? lo - 1 : -1;
}

function jumpToEdge(direction) {
  if (isGettingData) {
    showToast('Stop the capture to browse edges', 'error');
    return;
  }
  if (selectedChannelId === null) {
    showToast('Select a channel first', 'error');
    return;
  }

  const channel = CHANNELS.find((c) => c.id === selectedChannelId);
  const edges = channel.edges;
  if (!edges || edges.edgeCount === 0) {
    showToast('No captured data for this channel', 'error');
    return;
  }

  const idx = direction > 0 ? findEdgeIndexAfter(edges, cursorMs) : findEdgeIndexBefore(edges, cursorMs);
  if (idx === -1) {
    showToast(direction > 0 ? 'No later edge' : 'No earlier edge', 'error');
    return;
  }

  cursorMs = edges.edgeTimes[idx];
  const desiredOffset = Math.min(maxOffsetMs(), Math.max(0, cursorMs - WINDOW_MS / 2));
  panTimelineBy(desiredOffset - currentOffsetMs); // no-op (and no redraw) if the edge is already in view
  updateCursorMarker();
}

document.getElementById('prevEdgeBtn').addEventListener('click', () => jumpToEdge(-1));
document.getElementById('nextEdgeBtn').addEventListener('click', () => jumpToEdge(1));

// START begins from a clean slate
function resetCapture() {
  elapsedMs = 0;
  totalCapturedMs = 0;
  cursorMs = 0;
  currentOffsetMs = 0;
  lastTickBucket = -1;

  rowRefs.forEach(({ channel, polyline }) => {
    polyline.setAttribute('points', flatLinePoints());
    channel.lastLevel = null; // so the next sample starts a fresh trace instead of continuing the old one
    channel.edges = createEdgeBuffer();
  });

  buildRuler(0);
  buildGridOverlay(0);
  updateWaveViewBox(0);
  timerEl.textContent = formatTimer(0);
  tReadoutEl.textContent = 'T = 0.00 MS';
  setCursorPct(0, 0);
}

startStopButton.addEventListener('click', async () => {
  if (!isGettingData) {
    // reset and start acquisition
    resetCapture();
    const result = await window.api.sendCommand('start');
    if (!result.ok) {
      showToast(`Failed to start: ${result.error}`, 'error');
      return;
    }

    unsubscribeSamples = window.api.onSamples(handleSamplePacket);
    isGettingData = true;
    startStopLabel.textContent = 'STOP';
    startStopIcon.textContent = '■';
    startStopButton.classList.add('running');
    statusDot.classList.add('live');
    statusText.textContent = 'RUNNING';
    startTimestamp = performance.now();
    rafId = requestAnimationFrame(tick);
  } else {
    // stop acquisition and freeze whatever was captured
    const result = await window.api.sendCommand('stop');
    if (!result.ok) showToast(`Board didn't confirm stop: ${result.error}`, 'error');

    if (unsubscribeSamples) {
      unsubscribeSamples();
      unsubscribeSamples = null;
    }

    isGettingData = false;
    startStopLabel.textContent = 'START';
    startStopIcon.textContent = '▶';
    startStopButton.classList.remove('running');
    statusDot.classList.remove('live');
    statusText.textContent = 'HALTED';
    elapsedMs += performance.now() - startTimestamp;
    totalCapturedMs = elapsedMs;
    cursorMs = elapsedMs;
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
