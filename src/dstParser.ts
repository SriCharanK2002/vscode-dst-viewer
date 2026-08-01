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

const THREAD_BREAK_KINDS = new Set<DstCommandKind>([
  "jump",
  "trim",
  "stop",
  "color_change",
  "end",
  "other"
]);

export class DstParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DstParseError";
  }
}

interface DecodedRecord {
  dx: number;
  dy: number;
  kind: DstCommandKind;
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

  if (bit(b0, 0x80)) dy += 1;
  if (bit(b0, 0x40)) dy -= 1;
  if (bit(b0, 0x20)) dy += 9;
  if (bit(b0, 0x10)) dy -= 9;
  if (bit(b1, 0x80)) dy += 3;
  if (bit(b1, 0x40)) dy -= 3;
  if (bit(b1, 0x20)) dy += 27;
  if (bit(b1, 0x10)) dy -= 27;
  if (bit(b2, 0x20)) dy += 81;
  if (bit(b2, 0x10)) dy -= 81;

  return { dx, dy };
}

function classifyRecord(b0: number, b1: number, b2: number): DstCommandKind {
  if (b0 === 0x00 && b1 === 0x00 && b2 === 0xf3) {
    return "end";
  }

  const commandBits = b2 & 0xc3;
  if (commandBits === 0xc3) {
    return "trim";
  }
  if (commandBits === 0x83) {
    return "jump";
  }
  if (commandBits === 0x43) {
    return "color_change";
  }
  if (commandBits === 0x03) {
    return "stitch";
  }
  if ((b2 & 0x03) === 0x03) {
    return "other";
  }
  return "other";
}

function decodeRecord(buffer: Uint8Array, offset: number): DecodedRecord {
  const b0 = buffer[offset] ?? 0;
  const b1 = buffer[offset + 1] ?? 0;
  const b2 = buffer[offset + 2] ?? 0;
  const { dx, dy } = decodeDelta(b0, b1, b2);
  return { dx, dy, kind: classifyRecord(b0, b1, b2) };
}

function pushThreadBlock(
  threadBlocks: DstViewerArtifact["thread_blocks"],
  blockIndex: number,
  startEventIndex: number,
  endEventIndex: number
): void {
  if (endEventIndex < startEventIndex) {
    return;
  }

  threadBlocks.push({
    block_index: blockIndex,
    start_event_index: startEventIndex,
    end_event_index: endEventIndex,
    display_color: FALLBACK_PALETTE[blockIndex % FALLBACK_PALETTE.length]
  });
}

export function parseDst(buffer: Uint8Array, _sourceName = "design.dst"): DstViewerArtifact {
  if (buffer.byteLength < HEADER_LENGTH + RECORD_LENGTH) {
    throw new DstParseError("DST file is too short to contain a header and stitch records.");
  }

  const xs: number[] = [];
  const ys: number[] = [];
  const cmds: DstViewerArtifact["events"]["cmd"] = [];
  const indices: DstViewerArtifact["indices"] = {
    commands: [],
    jumps: [],
    trims: [],
    stops: [],
    color_changes: [],
    thread_breaks: []
  };
  const summaryCounts: Record<DstCommandKind, number> = {
    stitch: 0,
    jump: 0,
    trim: 0,
    stop: 0,
    color_change: 0,
    end: 0,
    other: 0
  };
  const threadBlocks: DstViewerArtifact["thread_blocks"] = [];

  let x = 0;
  let y = 0;
  let previousKind: DstCommandKind | undefined;
  let blockIndex = 0;
  let blockStart = 0;

  for (let offset = HEADER_LENGTH; offset + 2 < buffer.byteLength; offset += RECORD_LENGTH) {
    const eventIndex = xs.length;
    const record = decodeRecord(buffer, offset);
    x += record.dx;
    y += record.dy;

    xs.push(x);
    ys.push(y);
    cmds.push(COMMAND_CODES[record.kind]);

    if (eventIndex === 0) {
      indices.thread_breaks.push(eventIndex);
    } else if (record.kind === "stitch" && previousKind && THREAD_BREAK_KINDS.has(previousKind)) {
      indices.thread_breaks.push(eventIndex);
    }

    if (record.kind !== "stitch") {
      indices.commands.push(eventIndex);
    }
    if (record.kind === "jump") {
      indices.jumps.push(eventIndex);
    } else if (record.kind === "trim") {
      indices.trims.push(eventIndex);
    } else if (record.kind === "stop") {
      indices.stops.push(eventIndex);
    } else if (record.kind === "color_change") {
      indices.color_changes.push(eventIndex);
      pushThreadBlock(threadBlocks, blockIndex, blockStart, eventIndex);
      blockIndex += 1;
      blockStart = eventIndex + 1;
    }

    summaryCounts[record.kind] += 1;
    previousKind = record.kind;

    if (record.kind === "end") {
      break;
    }
  }

  if (xs.length === 0) {
    throw new DstParseError("DST file does not contain stitch records.");
  }

  if (blockStart < xs.length) {
    pushThreadBlock(threadBlocks, blockIndex, blockStart, xs.length - 1);
  }

  return {
    version: 1,
    format: "dst_viewer_artifact",
    units: "dst_0.1mm",
    bounds: {
      min_x: Math.min(...xs),
      min_y: Math.min(...ys),
      max_x: Math.max(...xs),
      max_y: Math.max(...ys)
    },
    summary: {
      event_count: xs.length,
      stitch_count: summaryCounts.stitch,
      jump_count: summaryCounts.jump,
      trim_count: summaryCounts.trim,
      stop_count: summaryCounts.stop,
      color_change_count: summaryCounts.color_change,
      end_count: summaryCounts.end,
      thread_block_count: threadBlocks.length
    },
    thread_blocks: threadBlocks,
    segment_runs: [],
    command_codes: COMMAND_CODES,
    events: { x: xs, y: ys, cmd: cmds },
    indices
  };
}
