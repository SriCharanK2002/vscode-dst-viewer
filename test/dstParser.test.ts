import assert from "node:assert/strict";
import test from "node:test";

import { DstParseError, parseDst } from "../src/dstParser";

function header(): Uint8Array {
  const bytes = new Uint8Array(512);
  bytes.fill(0x20);
  return bytes;
}

function record(b0: number, b1: number, b2: number): number[] {
  return [b0, b1, b2];
}

test("rejects buffers shorter than a DST header", () => {
  assert.throws(() => parseDst(new Uint8Array(12)), DstParseError);
});

test("parses an end-only DST as one end event", () => {
  const bytes = new Uint8Array([...header(), ...record(0, 0, 0xf3)]);

  const artifact = parseDst(bytes, "end.dst");

  assert.equal(artifact.summary.event_count, 1);
  assert.equal(artifact.summary.end_count, 1);
  assert.deepEqual(artifact.events.cmd, [5]);
});

test("accumulates stitch movement records", () => {
  const bytes = new Uint8Array([
    ...header(),
    ...record(0x01, 0x00, 0x03),
    ...record(0, 0, 0xf3)
  ]);

  const artifact = parseDst(bytes, "one-stitch.dst");

  assert.equal(artifact.summary.stitch_count, 1);
  assert.equal(artifact.events.x[0], 1);
  assert.equal(artifact.events.y[0], 0);
});

test("indexes jump and trim commands", () => {
  const bytes = new Uint8Array([
    ...header(),
    ...record(0, 0, 0x83),
    ...record(0, 0, 0xc3),
    ...record(0, 0, 0xf3)
  ]);

  const artifact = parseDst(bytes, "commands.dst");

  assert.deepEqual(artifact.indices.jumps, [0]);
  assert.deepEqual(artifact.indices.trims, [1]);
});
