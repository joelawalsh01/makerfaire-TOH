const state = {
  source: "",
  trace: [],
  initialPegs: [[], [], []],
  pegLabels: ["A", "B", "C"],
  step: 0,
  playing: false,
  playTimer: null,
  variant: "recursive",
  n: 4,
  speed: 12,
  granularity: "line",
};

const el = {
  code: document.getElementById("code"),
  variantSelect: document.getElementById("variant-select"),
  variantTag: document.getElementById("variant-tag"),
  diskSlider: document.getElementById("disk-slider"),
  diskReadout: document.getElementById("disk-readout"),
  speedSlider: document.getElementById("speed-slider"),
  speedReadout: document.getElementById("speed-readout"),
  explanation: document.getElementById("explanation"),
  stepLabel: document.getElementById("step-label"),
  stepCurrent: document.getElementById("step-current"),
  stepTotal: document.getElementById("step-total"),
  stepSubReadout: document.getElementById("step-sub-readout"),
  granularityInputs: document.querySelectorAll('input[name="granularity"]'),
  svg: document.getElementById("pegs-svg"),
  pegList: [
    document.getElementById("peg-list-0"),
    document.getElementById("peg-list-1"),
    document.getElementById("peg-list-2"),
  ],
  btnPlay: document.getElementById("btn-play"),
  btnBack: document.getElementById("btn-back"),
  btnNext: document.getElementById("btn-next"),
  btnReset: document.getElementById("btn-reset"),
};

async function loadSolution() {
  pause();
  const staticUrl = `./traces/solve_${state.variant}_n${state.n}.json`;
  let res = await fetch(staticUrl);
  if (!res.ok) {
    res = await fetch(`/api/solve?variant=${state.variant}&n=${state.n}`);
  }
  if (!res.ok) {
    el.explanation.textContent = `Error loading solution: ${res.status} ${res.statusText}`;
    return;
  }
  const data = await res.json();
  state.source = data.source;
  state.trace = data.trace;
  state.initialPegs = data.initial_pegs;
  state.pegLabels = data.peg_labels;
  state.step = 0;
  el.variantTag.textContent = data.variant;
  renderCode(state.source);
  renderStep();
}

function renderCode(source) {
  el.code.innerHTML = "";
  const lines = source.replace(/\n$/, "").split("\n");
  lines.forEach((text, idx) => {
    const row = document.createElement("div");
    row.className = "code-line";
    row.dataset.line = String(idx + 1);
    const num = document.createElement("span");
    num.className = "lineno";
    num.textContent = String(idx + 1);
    const code = document.createElement("span");
    code.className = "code-text";
    code.textContent = text || " ";
    row.appendChild(num);
    row.appendChild(code);
    el.code.appendChild(row);
  });
}

function highlightLine(line) {
  el.code.querySelectorAll(".code-line.active").forEach((r) => r.classList.remove("active"));
  if (!line) return;
  const row = el.code.querySelector(`.code-line[data-line="${line}"]`);
  if (row) {
    row.classList.add("active");
    row.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function renderPegs(pegs) {
  const svg = el.svg;
  const W = 900, H = 260;
  const baseY = H - 20;
  const pegCenters = [W * 0.2, W * 0.5, W * 0.8];
  const pegHeight = 180;
  const pegWidth = 6;
  const n = state.n;
  const maxDiskWidth = W * 0.26;
  const minDiskWidth = 40;
  const diskHeight = Math.min(22, (pegHeight - 8) / Math.max(n, 1));

  let svgContent = "";
  svgContent += `<rect x="20" y="${baseY}" width="${W - 40}" height="6" fill="#2a2a2a" rx="2"/>`;

  pegCenters.forEach((cx, i) => {
    svgContent += `<rect x="${cx - pegWidth / 2}" y="${baseY - pegHeight}" width="${pegWidth}" height="${pegHeight}" fill="#2a2a2a" rx="2"/>`;
    svgContent += `<text x="${cx}" y="${baseY + 24}" text-anchor="middle" font-family="var(--mono)" font-size="14" fill="#6b6b70" font-weight="600">${state.pegLabels[i]}</text>`;
  });

  pegs.forEach((peg, pegIdx) => {
    const cx = pegCenters[pegIdx];
    peg.forEach((disk, diskIdx) => {
      const widthRange = maxDiskWidth - minDiskWidth;
      const w = minDiskWidth + (widthRange * (disk - 1)) / Math.max(n - 1, 1);
      const y = baseY - (diskIdx + 1) * diskHeight;
      const color = `var(--disk-palette-${(disk - 1) % 8})`;
      svgContent += `<rect x="${cx - w / 2}" y="${y}" width="${w}" height="${diskHeight - 2}" fill="${color}" rx="4" stroke="rgba(0,0,0,0.2)" stroke-width="1"/>`;
      svgContent += `<text x="${cx}" y="${y + diskHeight / 2 + 3}" text-anchor="middle" font-family="var(--mono)" font-size="11" fill="#fff" font-weight="600">${disk}</text>`;
    });
  });

  svg.innerHTML = svgContent;

  pegs.forEach((peg, i) => {
    el.pegList[i].textContent = "[" + peg.join(", ") + "]";
  });
}

// Step indices the playback/buttons should stop at, for the current granularity.
function milestones() {
  if (state.granularity === "line") {
    return Array.from({ length: state.trace.length + 1 }, (_, i) => i);
  }
  const out = [0];
  state.trace.forEach((s, i) => { if (s.move) out.push(i + 1); });
  return out;
}

function nextMilestone(dir) {
  const ms = milestones();
  if (dir > 0) {
    return ms.find((v) => v > state.step) ?? state.step;
  }
  let best = ms[0];
  for (const v of ms) {
    if (v < state.step) best = v;
    else break;
  }
  return best;
}

function movesCompletedBy(step) {
  let count = 0;
  for (let i = 0; i < step; i++) if (state.trace[i] && state.trace[i].move) count++;
  return count;
}

function totalMoves() {
  return state.trace.reduce((c, s) => c + (s.move ? 1 : 0), 0);
}

function updateCounter() {
  const movesDone = movesCompletedBy(state.step);
  const total = totalMoves();
  if (state.granularity === "move") {
    el.stepLabel.textContent = "Disk move";
    el.stepCurrent.textContent = String(movesDone);
    el.stepTotal.textContent = String(total);
    el.stepSubReadout.textContent = `Python line ${state.step} of ${state.trace.length}`;
  } else {
    el.stepLabel.textContent = "Python line executed";
    el.stepCurrent.textContent = String(state.step);
    el.stepTotal.textContent = String(state.trace.length);
    const word = movesDone === 1 ? "move" : "moves";
    el.stepSubReadout.textContent = `${movesDone} ${word} completed of ${total}`;
  }
}

function renderStep() {
  let pegs, note, line;
  if (state.step === 0) {
    pegs = state.initialPegs;
    note = "Initial configuration — all disks on peg A.";
    line = null;
  } else {
    const entry = state.trace[state.step - 1];
    pegs = entry.pegs;
    note = entry.note || "";
    line = entry.line;
  }

  updateCounter();
  renderPegs(pegs);
  highlightLine(line);

  const entry = state.step > 0 ? state.trace[state.step - 1] : null;
  if (entry && entry.move) {
    el.explanation.innerHTML = `<div class="move-line">${escapeHtml(note)}</div>`;
  } else {
    el.explanation.textContent = note;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function atLastMilestone() {
  const ms = milestones();
  return state.step >= ms[ms.length - 1];
}

function play() {
  if (state.playing) return;
  if (atLastMilestone()) state.step = 0;
  state.playing = true;
  el.btnPlay.textContent = "⏸ Pause";
  tick();
}

function pause() {
  state.playing = false;
  el.btnPlay.textContent = "▶ Play";
  if (state.playTimer) {
    clearTimeout(state.playTimer);
    state.playTimer = null;
  }
}

function tick() {
  if (!state.playing) return;
  if (atLastMilestone()) { pause(); return; }
  state.step = nextMilestone(1);
  renderStep();
  const delay = Math.max(25, Math.round(2000 / state.speed));
  state.playTimer = setTimeout(tick, delay);
}

function stepForward() {
  pause();
  state.step = nextMilestone(1);
  renderStep();
}

function stepBack() {
  pause();
  state.step = nextMilestone(-1);
  renderStep();
}

function reset() {
  pause();
  state.step = 0;
  renderStep();
}

function setGranularity(g) {
  if (g === state.granularity) return;
  state.granularity = g;
  // Snap state.step to the nearest milestone ≤ current step in the new mode.
  const ms = milestones();
  let snapped = 0;
  for (const v of ms) { if (v <= state.step) snapped = v; else break; }
  state.step = snapped;
  renderStep();
}

el.variantSelect.addEventListener("change", (e) => {
  state.variant = e.target.value;
  loadSolution();
});
el.diskSlider.addEventListener("input", (e) => {
  state.n = parseInt(e.target.value, 10);
  el.diskReadout.textContent = String(state.n);
});
el.diskSlider.addEventListener("change", () => { loadSolution(); });
el.speedSlider.addEventListener("input", (e) => {
  state.speed = parseInt(e.target.value, 10);
  const delay = Math.max(25, Math.round(2000 / state.speed));
  el.speedReadout.textContent = `${delay} ms`;
});
el.granularityInputs.forEach((input) => {
  input.addEventListener("change", (e) => {
    if (e.target.checked) setGranularity(e.target.value);
  });
});
el.btnPlay.addEventListener("click", () => (state.playing ? pause() : play()));
el.btnBack.addEventListener("click", stepBack);
el.btnNext.addEventListener("click", stepForward);
el.btnReset.addEventListener("click", reset);

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  if (e.key === " ") { e.preventDefault(); state.playing ? pause() : play(); }
  else if (e.key === "ArrowRight") stepForward();
  else if (e.key === "ArrowLeft") stepBack();
  else if (e.key === "r" || e.key === "R") reset();
});

loadSolution();
