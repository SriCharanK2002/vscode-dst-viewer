import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

test("actual webview preserves star stitches and individual transport records", () => {
  const source = readFileSync(join(__dirname, "../../media/player.js"), "utf8");
  const functions = source.slice(source.indexOf("function commandName("), source.indexOf("function setControlsEnabled("));
  const artifact = {
    command_codes: { stitch: 0, jump: 1, end: 5 },
    events: {
      x: [21, 15, 8, 12, 12, 15],
      y: [-110, -108, -108, -102, -102, -108],
      cmd: [1, 0, 0, 1, 0, 0],
      from_x: [0, 21, 15, 8, 12, 12],
      from_y: [0, -110, -108, -108, -102, -102],
    },
    indices: { thread_breaks: [1, 4] },
  };
  const context = { state: { artifact }, artifact };
  const plan = runInNewContext(functions + "\nbuildRenderPlan(normalizeEvents(artifact));", context);
  assert.equal(plan.sewn.length, 3);
  assert.equal(plan.jumps.length, 2);
  assert.equal(plan.sewn[0].from.x, 21);
  assert.equal(plan.sewn[0].from.y, -110);
  assert.equal(plan.sewn[0].to.x, 15);
  assert.equal(plan.sewn[0].to.y, -108);
  assert.equal(plan.sewn[2].from.x, 12);
  assert.equal(plan.sewn[2].to.x, 15);
});


test("actual webview restores trim canvas and timeline markers without changing sewn paths", () => {
  const source = readFileSync(join(__dirname, "../../media/player.js"), "utf8");
  const renderFunctions = source.slice(source.indexOf("function commandName("), source.indexOf("function setControlsEnabled("));
  const timelineFunction = source.slice(source.indexOf("function buildTimelineMarkers("), source.indexOf("function createMarkerIcon("));
  const artifact = {
    command_codes: { stitch: 0, jump: 1, end: 5 },
    events: {
      x: [10, 12, 8, 10, 20, 25], y: [0, 0, 0, 0, 0, 0],
      cmd: [0, 1, 1, 1, 1, 0],
      from_x: [0, 10, 12, 8, 10, 20], from_y: [0, 0, 0, 0, 0, 0],
    },
    indices: { trims: [3] },
  };
  const context = { state: { artifact }, artifact };
  const result = runInNewContext(renderFunctions + timelineFunction +
    "\n({plan: buildRenderPlan(normalizeEvents(artifact)), timeline: buildTimelineMarkers(6, [], artifact.indices.trims, [])});", context);
  assert.equal(result.plan.sewn.length, 2);
  assert.equal(result.plan.sewn[1].from.x, 20);
  assert.equal(result.plan.sewn[1].to.x, 25);
  assert.equal(result.plan.jumps.length, 4);
  assert.equal(result.plan.markers.length, 1);
  assert.equal(result.plan.markers[0].event.kind, "trim");
  assert.equal(result.plan.markers[0].event.x, 10);
  assert.equal(result.plan.markers[0].eventIndex, 3);
  assert.equal(result.timeline[0].kind, "trim");
  assert.equal(result.timeline[0].index, 3);
});
