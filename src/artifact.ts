export const COMMAND_CODES = {
  stitch: 0,
  jump: 1,
  trim: 2,
  stop: 3,
  color_change: 4,
  end: 5,
  other: 6
} as const;

export type DstCommandKind = keyof typeof COMMAND_CODES;
export type DstCommandCode = (typeof COMMAND_CODES)[DstCommandKind];

export interface DstViewerArtifact {
  version: 2;
  format: "dst_viewer_artifact";
  units: "dst_0.1mm";
  bounds: {
    min_x: number;
    min_y: number;
    max_x: number;
    max_y: number;
  };
  summary: {
    event_count: number;
    stitch_count: number;
    jump_count: number;
    trim_count: number;
    stop_count: number;
    color_change_count: number;
    end_count: number;
    thread_block_count: number;
    raw_record_count: number;
    raw_jump_record_count: number;
    decoded_trim_record_count: number;
  };
  thread_blocks: Array<{
    block_index: number;
    start_event_index: number;
    end_event_index: number;
    display_color: string;
  }>;
  segment_runs: [];
  command_codes: typeof COMMAND_CODES;
  events: {
    x: number[];
    y: number[];
    from_x: number[];
    from_y: number[];
    cmd: DstCommandCode[];
    source_record_index: number[];
    source_record_count: number[];
    decoded_from: Array<string | null>;
  };
  indices: {
    commands: number[];
    jumps: number[];
    trims: number[];
    stops: number[];
    color_changes: number[];
    thread_breaks: number[];
  };
}
