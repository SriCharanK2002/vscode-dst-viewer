const vscode = acquireVsCodeApi();

const state = {
  artifact: null,
  events: [],
  renderPlan: { sewn: [], jumps: [], markers: [] },
  currentIndex: 0,
  isPlaying: false,
  timer: null,
  speed: 30,
  zoom: 1,
  panX: 0,
  panY: 0,
  drag: null
};

const els = {
  fileName: document.getElementById("fileName"),
  summaryText: document.getElementById("summaryText"),
  stats: document.getElementById("stats"),
  canvas: document.getElementById("canvas"),
  stage: document.querySelector(".stage"),
  emptyState: document.getElementById("emptyState"),
  playButton: document.getElementById("playButton"),
  previousCommandButton: document.getElementById("previousCommandButton"),
  previousStitchButton: document.getElementById("previousStitchButton"),
  nextStitchButton: document.getElementById("nextStitchButton"),
  nextCommandButton: document.getElementById("nextCommandButton"),
  speedDownButton: document.getElementById("speedDownButton"),
  speedUpButton: document.getElementById("speedUpButton"),
  speedValue: document.getElementById("speedValue"),
  resetViewButton: document.getElementById("resetViewButton"),
  showJumps: document.getElementById("showJumps"),
  showTrims: document.getElementById("showTrims"),
  timeline: document.getElementById("timeline"),
  timelineMarkers: document.getElementById("timelineMarkers"),
  positionValue: document.getElementById("positionValue")
};

const ctx = els.canvas.getContext("2d");

function commandName(code) {
  const commandCodes = state.artifact?.command_codes || {};
  if (code === commandCodes.jump) return "jump";
  if (code === commandCodes.trim) return "trim";
  if (code === commandCodes.stop) return "stop";
  if (code === commandCodes.color_change) return "color_change";
  if (code === commandCodes.end) return "end";
  if (code === commandCodes.stitch) return "stitch";
  return "other";
}

function normalizeEvents(artifact) {
  const xs = artifact?.events?.x || [];
  const ys = artifact?.events?.y || [];
  const cmds = artifact?.events?.cmd || [];
  const blocks = artifact?.thread_blocks || [];
  const fromXs = artifact?.events?.from_x || [];
  const fromYs = artifact?.events?.from_y || [];
  const trimMarkers = new Set(artifact?.indices?.trims || []);
  const count = Math.min(xs.length, ys.length, cmds.length);

  return Array.from({ length: count }, (_, index) => {
    const block = blocks.find((item) => index >= item.start_event_index && index <= item.end_event_index);
    return {
      x: xs[index],
      y: ys[index],
      fromX: fromXs[index] ?? (index > 0 ? xs[index - 1] : 0),
      fromY: fromYs[index] ?? (index > 0 ? ys[index - 1] : 0),
      cmd: cmds[index],
      kind: commandName(cmds[index]),
      block: block?.block_index || 0,
      threadBreakBefore: false,
      trimMarker: trimMarkers.has(index),
      trimX: fromXs[index - 2] ?? (index >= 3 ? xs[index - 3] : 0),
      trimY: fromYs[index - 2] ?? (index >= 3 ? ys[index - 3] : 0)
    };
  });
}

function buildRenderPlan(events) {
  const plan = { sewn: [], jumps: [], markers: [] };
  events.forEach((event, eventIndex) => {
    if (event.kind === "stitch") {
      if (event.fromX === event.x && event.fromY === event.y) return;
      plan.sewn.push({
        from: { x: event.fromX, y: event.fromY },
        to: event,
        eventIndex,
        block: event.block
      });
      return;
    }
    if (event.kind === "jump") {
      plan.jumps.push({
        from: { x: event.fromX, y: event.fromY },
        to: event,
        eventIndex
      });
    }
    if (event.trimMarker && event.kind === "jump") {
      plan.markers.push({
        event: { ...event, kind: "trim", x: event.trimX, y: event.trimY },
        eventIndex
      });
    }
    if (["trim", "stop", "color_change"].includes(event.kind)) {
      plan.markers.push({ event, eventIndex });
    }
  });
  return plan;
}

function setControlsEnabled(enabled) {
  for (const element of [
    els.playButton,
    els.previousCommandButton,
    els.previousStitchButton,
    els.nextStitchButton,
    els.nextCommandButton,
    els.speedDownButton,
    els.speedUpButton,
    els.resetViewButton,
    els.showJumps,
    els.showTrims,
    els.timeline
  ]) {
    element.disabled = !enabled;
  }
}

function setError(fileName, message) {
  stopPlayback();
  state.artifact = null;
  state.events = [];
  state.renderPlan = { sewn: [], jumps: [], markers: [] };
  els.fileName.textContent = fileName || "DST Player";
  els.summaryText.textContent = message;
  els.stats.textContent = "";
  els.emptyState.textContent = message;
  els.emptyState.style.display = "flex";
  setControlsEnabled(false);
  draw();
}

function renderStats(summary) {
  const items = [
    ["Events", summary.event_count],
    ["Stitches", summary.stitch_count],
    ["Jumps", summary.jump_count],
    ["Trims", summary.trim_count],
    ["Stops", summary.stop_count],
    ["Colors", summary.color_change_count]
  ];
  els.stats.replaceChildren(
    ...items.map(([label, value]) => {
      const node = document.createElement("span");
      node.className = "stat";
      node.textContent = `${label}: ${value}`;
      return node;
    })
  );
}

function buildTimelineMarkers(eventCount, jumps, trims, colorChanges) {
  const denominator = Math.max(1, eventCount - 1);
  const markers = [
    ...jumps.map((index) => ({ kind: "jump", index, position: (index / denominator) * 100 })),
    ...trims.map((index) => ({ kind: "trim", index, position: (index / denominator) * 100 })),
    ...colorChanges.map((index) => ({ kind: "color_change", index, position: (index / denominator) * 100 }))
  ];
  return markers.sort((left, right) => left.index - right.index || left.kind.localeCompare(right.kind));
}

function markerIconSvg(kind) {
  if (kind === "trim") {
    return `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <circle cx="5" cy="15" r="2.3" fill="none" stroke="currentColor" stroke-width="2"></circle>
        <circle cx="15" cy="15" r="2.3" fill="none" stroke="currentColor" stroke-width="2"></circle>
        <path d="M6.6 13.2 17 3.8M13.4 13.2 3 3.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
        <path d="M9.9 10.2 10.1 10.2" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"></path>
      </svg>`;
  }

  if (kind === "color_change") {
    return `
      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <circle cx="6" cy="10" r="4" fill="currentColor"></circle>
        <path d="M11 6h6v8h-6" fill="none" stroke="currentColor" stroke-width="2"></path>
      </svg>`;
  }

  return `
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M3 13c3.2-7.5 11.2-7.5 14 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
      <path d="M6 13h8.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="1 3"></path>
      <circle cx="3" cy="13" r="1.7" fill="currentColor"></circle>
      <circle cx="17" cy="13" r="1.7" fill="currentColor"></circle>
    </svg>`;
}

function createMarkerIcon(kind) {
  const icon = document.createElement("span");
  icon.className = `timeline-marker-icon ${kind}`;
  icon.innerHTML = markerIconSvg(kind);
  return icon;
}

function renderTimelineMarkers() {
  const artifact = state.artifact;
  if (!artifact) {
    els.timelineMarkers.replaceChildren();
    return;
  }

  const markers = buildTimelineMarkers(
    state.events.length,
    artifact.indices?.jumps || [],
    artifact.indices?.trims || [],
    artifact.indices?.color_changes || []
  );

  els.timelineMarkers.replaceChildren(
    ...markers.map((marker) => {
      const node = document.createElement("span");
      node.className = `timeline-marker ${marker.kind}`;
      node.style.left = `${marker.position}%`;
      const labelPrefix = marker.kind === "trim"
        ? "Trim at event"
        : marker.kind === "color_change"
          ? "Color change at event"
          : "Jump at event";
      const label = `${labelPrefix} ${marker.index + 1}`;
      node.title = label;
      node.setAttribute("aria-label", label);
      node.setAttribute("role", "img");

      const line = document.createElement("span");
      line.className = "timeline-marker-line";
      line.setAttribute("aria-hidden", "true");
      node.append(line, createMarkerIcon(marker.kind));
      return node;
    })
  );
}

function loadArtifact(fileName, artifact) {
  stopPlayback();
  state.artifact = artifact;
  state.events = normalizeEvents(artifact);
  state.renderPlan = buildRenderPlan(state.events);
  state.currentIndex = 0;
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;

  els.fileName.textContent = fileName || "design.dst";
  els.summaryText.textContent = `${artifact.units} | ${artifact.summary.thread_block_count} thread blocks`;
  renderStats(artifact.summary);
  els.timeline.max = String(Math.max(0, state.events.length - 1));
  els.timeline.value = "0";
  els.emptyState.style.display = "none";
  els.playButton.textContent = "Play";
  els.speedValue.textContent = `${state.speed}x`;
  setControlsEnabled(state.events.length > 0);
  renderTimelineMarkers();
  updatePosition();
  draw();
}

function paletteColor(blockIndex) {
  const block = (state.artifact?.thread_blocks || []).find((item) => item.block_index === blockIndex);
  return block?.display_color || "var(--played-color)";
}

function getCssColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function canvasTransform(bounds) {
  const rect = els.canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const designWidth = Math.max(1, bounds.max_x - bounds.min_x);
  const designHeight = Math.max(1, bounds.max_y - bounds.min_y);
  const scale = Math.min((width - 32) / designWidth, (height - 32) / designHeight) * state.zoom;
  return {
    scale,
    offsetX: (width - designWidth * scale) / 2 + state.panX,
    offsetY: (height - designHeight * scale) / 2 + state.panY
  };
}

function toCanvasPoint(event, bounds, transform) {
  return {
    x: transform.offsetX + (event.x - bounds.min_x) * transform.scale,
    y: transform.offsetY + (event.y - bounds.min_y) * transform.scale
  };
}

function drawSegment(prev, curr, bounds, transform, color, alpha, dashed = false) {
  if (!prev || !curr) return;
  const p1 = toCanvasPoint(prev, bounds, transform);
  const p2 = toCanvasPoint(curr, bounds, transform);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, Math.min(2.5, transform.scale * 0.2));
  ctx.setLineDash(dashed ? [5, 5] : []);
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
  ctx.restore();
}

function drawMarker(event, bounds, transform, color, shape) {
  const point = toCanvasPoint(event, bounds, transform);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  if (shape === "x") {
    ctx.beginPath();
    ctx.moveTo(point.x - 5, point.y - 5);
    ctx.lineTo(point.x + 5, point.y + 5);
    ctx.moveTo(point.x + 5, point.y - 5);
    ctx.lineTo(point.x - 5, point.y + 5);
    ctx.stroke();
  } else {
    ctx.fillRect(point.x - 4, point.y - 4, 8, 8);
  }
  ctx.restore();
}

function resizeCanvas() {
  const rect = els.canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  els.canvas.width = Math.max(1, Math.round(rect.width * dpr));
  els.canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function draw() {
  resizeCanvas();
  const rect = els.canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  if (!state.artifact || state.events.length === 0) {
    return;
  }

  const bounds = state.artifact.bounds;
  const transform = canvasTransform(bounds);
  const maxIndex = Math.max(0, state.events.length - 1);
  const currentIndex = Math.max(0, Math.min(state.currentIndex, maxIndex));

  for (const segment of state.renderPlan.sewn) {
    drawSegment(
      segment.from,
      segment.to,
      bounds,
      transform,
      getCssColor("--inactive-color"),
      0.45
    );
  }

  for (const segment of state.renderPlan.sewn) {
    if (segment.eventIndex > currentIndex) continue;
    drawSegment(segment.from, segment.to, bounds, transform, paletteColor(segment.block), 1);
  }

  if (els.showJumps.checked) {
    for (const segment of state.renderPlan.jumps) {
      if (segment.eventIndex > currentIndex) continue;
      drawSegment(segment.from, segment.to, bounds, transform, getCssColor("--jump-color"), 1, true);
    }
  }

  for (const marker of state.renderPlan.markers) {
    if (marker.eventIndex > currentIndex) continue;
    if (marker.event.kind === "trim" && els.showTrims.checked) {
      drawMarker(marker.event, bounds, transform, getCssColor("--trim-color"), "x");
    } else if (marker.event.kind === "stop") {
      drawMarker(marker.event, bounds, transform, getCssColor("--stop-color"), "square");
    } else if (marker.event.kind === "color_change") {
      drawMarker(marker.event, bounds, transform, getCssColor("--color-change-color"), "square");
    }
  }

  const current = state.events[currentIndex];
  const point = toCanvasPoint(current, bounds, transform);
  ctx.save();
  ctx.fillStyle = getCssColor("--vscode-editor-foreground") || "#ffffff";
  ctx.strokeStyle = getCssColor("--vscode-editor-background") || "#000000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function updatePosition() {
  const total = state.events.length;
  els.positionValue.textContent = total ? `${state.currentIndex + 1} / ${total}` : "0 / 0";
  els.timeline.value = String(state.currentIndex);
}

function setCurrentIndex(index) {
  const maxIndex = Math.max(0, state.events.length - 1);
  state.currentIndex = Math.max(0, Math.min(Math.trunc(index), maxIndex));
  updatePosition();
  draw();
}

function stepCommand(direction) {
  const commands = state.artifact?.indices?.commands || [];
  const ordered = direction > 0 ? commands : [...commands].reverse();
  const next = ordered.find((index) => direction > 0
    ? index > state.currentIndex
    : index < state.currentIndex);
  setCurrentIndex(next ?? (direction > 0 ? state.events.length - 1 : 0));
}

function stopPlayback() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  state.isPlaying = false;
  els.playButton.textContent = "Play";
}

function togglePlayback() {
  if (!state.events.length) return;
  if (state.isPlaying) {
    stopPlayback();
    return;
  }

  state.isPlaying = true;
  els.playButton.textContent = "Pause";
  state.timer = setInterval(() => {
    if (state.currentIndex >= state.events.length - 1) {
      stopPlayback();
      return;
    }
    setCurrentIndex(state.currentIndex + 1);
  }, Math.max(8, 1000 / state.speed));
}

function setSpeed(value) {
  const wasPlaying = state.isPlaying;
  if (wasPlaying) stopPlayback();
  state.speed = Math.max(1, Math.min(120, value));
  els.speedValue.textContent = `${state.speed}x`;
  if (wasPlaying) togglePlayback();
}

window.addEventListener("message", (event) => {
  const message = event.data;
  if (message?.type === "load") {
    loadArtifact(message.fileName, message.artifact);
  } else if (message?.type === "error") {
    setError(message.fileName, message.message);
  }
});

els.playButton.addEventListener("click", togglePlayback);
els.previousCommandButton.addEventListener("click", () => {
  stopPlayback();
  stepCommand(-1);
});
els.previousStitchButton.addEventListener("click", () => {
  stopPlayback();
  setCurrentIndex(state.currentIndex - 1);
});
els.nextStitchButton.addEventListener("click", () => {
  stopPlayback();
  setCurrentIndex(state.currentIndex + 1);
});
els.nextCommandButton.addEventListener("click", () => {
  stopPlayback();
  stepCommand(1);
});
els.speedDownButton.addEventListener("click", () => setSpeed(state.speed - 5));
els.speedUpButton.addEventListener("click", () => setSpeed(state.speed + 5));
els.resetViewButton.addEventListener("click", () => {
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  draw();
});
els.showJumps.addEventListener("change", draw);
els.showTrims.addEventListener("change", draw);
els.timeline.addEventListener("input", () => {
  stopPlayback();
  setCurrentIndex(Number(els.timeline.value));
});

els.stage.addEventListener("wheel", (event) => {
  if (!state.artifact) return;
  event.preventDefault();
  const bounds = state.artifact.bounds;
  const before = canvasTransform(bounds);
  const rect = els.canvas.getBoundingClientRect();
  const pointerX = event.clientX - rect.left;
  const pointerY = event.clientY - rect.top;
  const designX = bounds.min_x + (pointerX - before.offsetX) / before.scale;
  const designY = bounds.min_y + (pointerY - before.offsetY) / before.scale;
  const factor = event.deltaY < 0 ? 1.1 : 0.9;
  state.zoom = Math.max(0.2, Math.min(12, state.zoom * factor));
  const after = canvasTransform(bounds);
  state.panX += pointerX - (after.offsetX + (designX - bounds.min_x) * after.scale);
  state.panY += pointerY - (after.offsetY + (designY - bounds.min_y) * after.scale);
  draw();
});

window.addEventListener("keydown", (event) => {
  if (!state.events.length || event.target.closest?.("input, button, select, textarea")) return;
  if (event.key === " ") {
    event.preventDefault();
    togglePlayback();
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    stopPlayback();
    setCurrentIndex(state.currentIndex - 1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    stopPlayback();
    setCurrentIndex(state.currentIndex + 1);
  } else if (event.key === "PageUp") {
    event.preventDefault();
    stopPlayback();
    stepCommand(-1);
  } else if (event.key === "PageDown") {
    event.preventDefault();
    stopPlayback();
    stepCommand(1);
  } else if (event.key.toLowerCase() === "r") {
    event.preventDefault();
    stopPlayback();
    setCurrentIndex(0);
  }
});

els.stage.addEventListener("mousedown", (event) => {
  state.drag = { x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY };
  els.stage.classList.add("dragging");
});

window.addEventListener("mousemove", (event) => {
  if (!state.drag) return;
  state.panX = state.drag.panX + event.clientX - state.drag.x;
  state.panY = state.drag.panY + event.clientY - state.drag.y;
  draw();
});

window.addEventListener("mouseup", () => {
  state.drag = null;
  els.stage.classList.remove("dragging");
});

window.addEventListener("resize", draw);

vscode.postMessage({ type: "ready" });
