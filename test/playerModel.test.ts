import assert from "node:assert/strict";
import test from "node:test";

import { buildTimelineMarkers, clampPlaybackIndex } from "../src/playerModel";

test("clamps playback index within event bounds", () => {
  assert.equal(clampPlaybackIndex(-1, 10), 0);
  assert.equal(clampPlaybackIndex(12, 10), 9);
  assert.equal(clampPlaybackIndex(4, 10), 4);
});

test("builds normalized jump and trim timeline markers", () => {
  const markers = buildTimelineMarkers({ eventCount: 11, jumps: [2], trims: [5, 10] });

  assert.deepEqual(markers, [
    { kind: "jump", index: 2, position: 20 },
    { kind: "trim", index: 5, position: 50 },
    { kind: "trim", index: 10, position: 100 }
  ]);
});
