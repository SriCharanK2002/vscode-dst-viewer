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
