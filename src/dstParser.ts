import { COMMAND_CODES, DstCommandKind, DstViewerArtifact } from "./artifact";

const HEADER_LENGTH = 512;
const RECORD_LENGTH = 3;

const FALLBACK_PALETTE = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#ca8a04",
  "#9333ea",
  "#0891b2",
  "#ea580c",
  "#4f46e5"
];

interface RawRecord {
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  kind: DstCommandKind;
  sourceRecordIndex: number;
}

interface SemanticEvent extends RawRecord {
  sourceRecordCount: number;
  decodedFrom: string | null;
}

export class DstParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DstParseError";
  }
}

function bit(value: number, mask: number): boolean {
  return (value & mask) !== 0;
}

function decodeDelta(b0: number, b1: number, b2: number): { dx: number; dy: number } {
  let dx = 0;
  let dy = 0;

  if (bit(b0, 0x01)) dx += 1;
  if (bit(b0, 0x02)) dx -= 1;
  if (bit(b0, 0x04)) dx += 9;
  if (bit(b0, 0x08)) dx -= 9;
  if (bit(b1, 0x01)) dx += 3;
  if (bit(b1, 0x02)) dx -= 3;
  if (bit(b1, 0x04)) dx += 27;
  if (bit(b1, 0x08)) dx -= 27;
  if (bit(b2, 0x04)) dx += 81;
  if (bit(b2, 0x08)) dx -= 81;

  // Match PyEmbroidery/the Workbench coordinate convention: positive design
  // Y uses Tajima's 0x40/0x10 bits and negative Y uses 0x80/0x20.
  if (bit(b0, 0x80)) dy -= 1;
  if (bit(b0, 0x40)) dy += 1;
  if (bit(b0, 0x20)) dy -= 9;
  if (bit(b0, 0x10)) dy += 9;
  if (bit(b1, 0x80)) dy -= 3;
  if (bit(b1, 0x40)) dy += 3;
  if (bit(b1, 0x20)) dy -= 27;
  if (bit(b1, 0x10)) dy += 27;
  if (bit(b2, 0x20)) dy -= 81;
  if (bit(b2, 0x10)) dy += 81;

  return { dx, dy };
}

function classifyRecord(b0: number, b1: number, b2: number): DstCommandKind {
  if (b0 === 0 && b1 === 0 && b2 === 0xf3) return "end";

  const commandBits = b2 & 0xc3;
  // DST has no trim opcode. 0xC3 is color change; trim is encoded as
  // a small, zero-net sequence of three jump records.
  if (commandBits === 0xc3) return "color_change";
  if (commandBits === 0x83) return "jump";
  if (commandBits === 0x43) return "other"; // sequin-mode related
  if (commandBits === 0x03) return "stitch";
  return "other";
}

function rawRecords(buffer: Uint8Array): RawRecord[] {
  const records: RawRecord[] = [];
  let x = 0;
  let y = 0;

  for (let offset = HEADER_LENGTH; offset + 2 < buffer.byteLength; offset += RECORD_LENGTH) {
    const b0 = buffer[offset] ?? 0;
    const b1 = buffer[offset + 1] ?? 0;
    const b2 = buffer[offset + 2] ?? 0;
    const { dx, dy } = decodeDelta(b0, b1, b2);
    const fromX = x;
    const fromY = y;
    x += dx;
    y += dy;
    const kind = classifyRecord(b0, b1, b2);

    records.push({ x, y, fromX, fromY, kind, sourceRecordIndex: records.length });
    if (kind === "end") break;
  }
  return records;
}

function isTajimaTrimSequence(run: RawRecord[], index: number): boolean {
  if (index + 2 >= run.length) return false;
  const records = run.slice(index, index + 3);
  const first = records[0];
  const third = records[2];
  const returnsToOrigin = third.x === first.fromX && third.y === first.fromY;
  const hasMotion = records.some((event) => event.x !== event.fromX || event.y !== event.fromY);
  const smallMotion = records.every(
    (event) => Math.abs(event.x - event.fromX) <= 4 && Math.abs(event.y - event.fromY) <= 4
  );
  return returnsToOrigin && hasMotion && smallMotion;
}

function logicalJump(records: RawRecord[]): SemanticEvent {
  const first = records[0];
  const last = records[records.length - 1];
  return {
    ...last,
    fromX: first.fromX,
    fromY: first.fromY,
    kind: "jump",
    sourceRecordIndex: first.sourceRecordIndex,
    sourceRecordCount: records.length,
    decodedFrom: null
  };
}

function decodeJumpRun(run: RawRecord[]): SemanticEvent[] {
  const decoded: SemanticEvent[] = [];
  let movementStart = 0;
  let index = 0;

  while (index < run.length) {
    if (!isTajimaTrimSequence(run, index)) {
      index += 1;
      continue;
    }
    if (movementStart < index) decoded.push(logicalJump(run.slice(movementStart, index)));
    const first = run[index];
    const last = run[index + 2];
    decoded.push({
      ...last,
      fromX: first.fromX,
      fromY: first.fromY,
      kind: "trim",
      sourceRecordIndex: first.sourceRecordIndex,
      sourceRecordCount: 3,
      decodedFrom: "tajima_three_jump_trim_sequence"
    });
    index += 3;
    movementStart = index;
  }
  if (movementStart < run.length) decoded.push(logicalJump(run.slice(movementStart)));
  return decoded;
}

function semanticEvents(records: RawRecord[]): SemanticEvent[] {
  const events: SemanticEvent[] = [];
  let index = 0;
  while (index < records.length) {
    if (records[index].kind !== "jump") {
      events.push({ ...records[index], sourceRecordCount: 1, decodedFrom: null });
      index += 1;
      continue;
    }
    let runEnd = index;
    while (runEnd < records.length && records[runEnd].kind === "jump") runEnd += 1;
    events.push(...decodeJumpRun(records.slice(index, runEnd)));
    index = runEnd;
  }
  return events;
}

function eventIndices(kinds: DstCommandKind[]): DstViewerArtifact["indices"] {
  const indices: DstViewerArtifact["indices"] = {
    commands: [], jumps: [], trims: [], stops: [], color_changes: [], thread_breaks: []
  };
  let needleConnected = false;
  kinds.forEach((kind, index) => {
    if (kind !== "stitch") indices.commands.push(index);
    if (kind === "jump") indices.jumps.push(index);
    if (kind === "trim") indices.trims.push(index);
    if (kind === "stop") indices.stops.push(index);
    if (kind === "color_change") indices.color_changes.push(index);

    if (kind === "stitch") {
      if (!needleConnected) indices.thread_breaks.push(index);
      needleConnected = true;
    } else {
      needleConnected = false;
    }
  });
  return indices;
}

function threadBlocks(kinds: DstCommandKind[]): DstViewerArtifact["thread_blocks"] {
  const blocks: DstViewerArtifact["thread_blocks"] = [];
  let start = 0;
  let blockIndex = 0;
  const close = (end: number): void => {
    blocks.push({
      block_index: blockIndex,
      start_event_index: start,
      end_event_index: end,
      display_color: FALLBACK_PALETTE[blockIndex % FALLBACK_PALETTE.length]
    });
    blockIndex += 1;
    start = end + 1;
  };
  kinds.forEach((kind, index) => {
    if (kind === "color_change") close(index);
  });
  if (start < kinds.length) close(kinds.length - 1);
  return blocks;
}

export function parseDst(buffer: Uint8Array, _sourceName = "design.dst"): DstViewerArtifact {
  if (buffer.byteLength < HEADER_LENGTH + RECORD_LENGTH) {
    throw new DstParseError("DST file is too short to contain a header and stitch records.");
  }

  const raw = rawRecords(buffer);
  if (raw.length === 0) throw new DstParseError("DST file does not contain stitch records.");
  const events = semanticEvents(raw);
  const kinds = events.map((event) => event.kind);
  const stitched = events.filter((event) => event.kind === "stitch");
  const bounded = stitched.length > 0 ? stitched : events;
  const blocks = threadBlocks(kinds);
  const count = (kind: DstCommandKind): number => kinds.filter((item) => item === kind).length;

  return {
    version: 2,
    format: "dst_viewer_artifact",
    units: "dst_0.1mm",
    bounds: {
      min_x: Math.min(...bounded.map((event) => event.x)),
      min_y: Math.min(...bounded.map((event) => event.y)),
      max_x: Math.max(...bounded.map((event) => event.x)),
      max_y: Math.max(...bounded.map((event) => event.y))
    },
    summary: {
      event_count: events.length,
      stitch_count: count("stitch"),
      jump_count: count("jump"),
      trim_count: count("trim"),
      stop_count: count("stop"),
      color_change_count: count("color_change"),
      end_count: count("end"),
      thread_block_count: blocks.length,
      raw_record_count: raw.length,
      raw_jump_record_count: raw.filter((event) => event.kind === "jump").length,
      decoded_trim_record_count: events
        .filter((event) => event.kind === "trim" && event.decodedFrom)
        .reduce((total, event) => total + event.sourceRecordCount, 0)
    },
    thread_blocks: blocks,
    segment_runs: [],
    command_codes: COMMAND_CODES,
    events: {
      x: events.map((event) => event.x),
      y: events.map((event) => event.y),
      from_x: events.map((event) => event.fromX),
      from_y: events.map((event) => event.fromY),
      cmd: events.map((event) => COMMAND_CODES[event.kind]),
      source_record_index: events.map((event) => event.sourceRecordIndex),
      source_record_count: events.map((event) => event.sourceRecordCount),
      decoded_from: events.map((event) => event.decodedFrom)
    },
    indices: eventIndices(kinds)
  };
}
