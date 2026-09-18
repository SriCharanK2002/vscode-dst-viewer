export interface TimelineMarkerInput {
  eventCount: number;
  jumps: number[];
  trims: number[];
  stops?: number[];
  colorChanges?: number[];
}

export interface TimelineMarker {
  kind: "jump" | "trim" | "stop" | "color_change";
  index: number;
  position: number;
}

export function clampPlaybackIndex(index: number, eventCount: number): number {
  if (eventCount <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(Math.trunc(index), eventCount - 1));
}

export function buildTimelineMarkers(input: TimelineMarkerInput): TimelineMarker[] {
  const denominator = Math.max(1, input.eventCount - 1);
  const markers: TimelineMarker[] = [];

  for (const index of input.jumps) {
    markers.push({ kind: "jump", index, position: Math.round((index / denominator) * 100) });
  }
  for (const index of input.trims) {
    markers.push({ kind: "trim", index, position: Math.round((index / denominator) * 100) });
  }
  for (const index of input.stops || []) {
    markers.push({ kind: "stop", index, position: Math.round((index / denominator) * 100) });
  }
  for (const index of input.colorChanges || []) {
    markers.push({ kind: "color_change", index, position: Math.round((index / denominator) * 100) });
  }

  return markers.sort((left, right) => left.index - right.index || left.kind.localeCompare(right.kind));
}

export interface ViewerEvent {
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  kind: string;
  block: number;
  threadBreakBefore: boolean;
}

export interface RenderSegment {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  eventIndex: number;
  block: number;
}

export function buildSewnSegments(events: ViewerEvent[]): RenderSegment[] {
  const segments: RenderSegment[] = [];
  events.forEach((event, eventIndex) => {
    if (event.kind !== "stitch") return;
    if (event.fromX === event.x && event.fromY === event.y) return;
    segments.push({
      fromX: event.fromX,
      fromY: event.fromY,
      toX: event.x,
      toY: event.y,
      eventIndex,
      block: event.block
    });
  });
  return segments;
}

export function adjacentCommandIndex(
  currentIndex: number,
  commandIndices: number[],
  direction: -1 | 1,
  eventCount: number
): number {
  const ordered = direction > 0 ? commandIndices : [...commandIndices].reverse();
  const match = ordered.find((index) => direction > 0 ? index > currentIndex : index < currentIndex);
  if (match !== undefined) return clampPlaybackIndex(match, eventCount);
  return direction > 0 ? clampPlaybackIndex(eventCount - 1, eventCount) : 0;
}
