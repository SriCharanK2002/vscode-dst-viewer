import assert from "node:assert/strict";
import test from "node:test";

import {
  adjacentCommandIndex,
  buildSewnSegments,
  buildTimelineMarkers,
  clampPlaybackIndex
} from "../src/playerModel";

test("clamps playback index within event bounds", () => {
  assert.equal(clampPlaybackIndex(-1, 10), 0);
  assert.equal(clampPlaybackIndex(12, 10), 9);
  assert.equal(clampPlaybackIndex(4, 10), 4);
});

test("builds normalized jump and trim timeline markers", () => {
  const markers = buildTimelineMarkers({
    eventCount: 11,
    jumps: [2],
    trims: [5, 10],
    colorChanges: [7]
  });

  assert.deepEqual(markers, [
    { kind: "jump", index: 2, position: 20 },
    { kind: "trim", index: 5, position: 50 },
    { kind: "color_change", index: 7, position: 70 },
    { kind: "trim", index: 10, position: 100 }
  ]);
});

test("does not sew a connector into the first penetration after a thread break", () => {
  const segments = buildSewnSegments([
    { x: 100, y: 0, fromX: 0, fromY: 0, kind: "stitch", block: 0, threadBreakBefore: true },
    { x: 110, y: 0, fromX: 100, fromY: 0, kind: "stitch", block: 0, threadBreakBefore: false },
    { x: 200, y: 0, fromX: 110, fromY: 0, kind: "jump", block: 0, threadBreakBefore: false }
  ]);

  assert.deepEqual(segments, [
    { fromX: 100, fromY: 0, toX: 110, toY: 0, eventIndex: 1, block: 0 }
  ]);
});

test("steps to adjacent command indices", () => {
  assert.equal(adjacentCommandIndex(5, [2, 8, 12], 1, 15), 8);
  assert.equal(adjacentCommandIndex(8, [2, 8, 12], -1, 15), 2);
  assert.equal(adjacentCommandIndex(12, [2, 8, 12], 1, 15), 14);
});
