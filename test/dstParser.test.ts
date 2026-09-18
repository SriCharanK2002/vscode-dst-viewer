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

test("uses the same Y-axis convention as the Workbench decoder", () => {
  const bytes = new Uint8Array([
    ...header(),
    ...record(0x80, 0, 0x03),
    ...record(0, 0, 0xf3)
  ]);

  const artifact = parseDst(bytes, "y-axis.dst");

  assert.equal(artifact.events.y[0], -1);
});

test("classifies 0xC3 as color change and 0x43 as sequin-related", () => {
  const bytes = new Uint8Array([
    ...header(),
    ...record(0, 0, 0xc3),
    ...record(0, 0, 0x43),
    ...record(0, 0, 0xf3)
  ]);

  const artifact = parseDst(bytes, "commands.dst");

  assert.deepEqual(artifact.indices.color_changes, [0]);
  assert.deepEqual(artifact.indices.trims, []);
  assert.equal(artifact.events.cmd[1], artifact.command_codes.other);
});

test("preserves a zero-net three-jump sequence as three jump records", () => {
  const plusTwoJump = record(0x02, 0x01, 0x83);
  const minusFourJump = record(0x02, 0x02, 0x83);
  const bytes = new Uint8Array([
    ...header(),
    ...plusTwoJump,
    ...minusFourJump,
    ...plusTwoJump,
    ...record(0, 0, 0xf3)
  ]);

  const artifact = parseDst(bytes, "trim.dst");

  assert.equal(artifact.version, 2);
  assert.deepEqual(artifact.indices.trims, []);
  assert.deepEqual(artifact.indices.jumps, [0, 1, 2]);
  assert.equal(artifact.summary.raw_jump_record_count, 3);
  assert.equal(artifact.summary.decoded_trim_record_count, 0);
  assert.equal(artifact.events.source_record_count[0], 1);
  assert.equal(artifact.events.decoded_from[0], null);
});

test("preserves split jump records and the next stitch", () => {
  const bytes = new Uint8Array([
    ...header(),
    ...record(0, 0, 0x87),
    ...record(0, 0, 0x87),
    ...record(0x01, 0, 0x03),
    ...record(0, 0, 0xf3)
  ]);

  const artifact = parseDst(bytes, "split-jump.dst");

  assert.equal(artifact.summary.jump_count, 2);
  assert.equal(artifact.summary.raw_jump_record_count, 2);
  assert.equal(artifact.events.source_record_count[0], 1);
  assert.deepEqual(artifact.indices.thread_breaks, []);
});

test("includes all encoded movement origins and destinations in bounds", () => {
  const bytes = new Uint8Array([
    ...header(),
    ...record(0, 0, 0x87),
    ...record(0x01, 0, 0x03),
    ...record(0, 0, 0xf3)
  ]);

  const artifact = parseDst(bytes, "bounds.dst");

  assert.deepEqual(artifact.bounds, { min_x: 0, min_y: 0, max_x: 82, max_y: 0 });
});


test("handles large DST bounds without exceeding the function argument limit", () => {
  const recordCount = 100_000;
  const bytes = new Uint8Array(512 + (recordCount + 1) * 3);
  bytes.set(header());
  for (let i = 0; i < recordCount; i += 1) {
    bytes.set(record(0x01, 0, 0x03), 512 + i * 3);
  }
  bytes.set(record(0, 0, 0xf3), 512 + recordCount * 3);
  const artifact = parseDst(bytes);
  assert.equal(artifact.summary.stitch_count, recordCount);
  assert.equal(artifact.summary.event_count, recordCount + 1);
  assert.deepEqual(artifact.bounds, { min_x: 0, min_y: 0, max_x: recordCount, max_y: 0 });
});
