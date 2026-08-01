export interface TimelineMarkerInput {
  eventCount: number;
  jumps: number[];
  trims: number[];
}

export interface TimelineMarker {
  kind: "jump" | "trim";
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

  return markers.sort((left, right) => left.index - right.index || left.kind.localeCompare(right.kind));
}
