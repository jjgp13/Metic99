import { WAVES, type WaveKind, type WaveSegment } from "../config/constants";

/** Where a path is in its wave: the stretch, and how hard it pushes (0..1). */
export interface WavePoint {
  kind: WaveKind;
  /** 0 = rest, 1 = a full burst. */
  intensity: number;
}

/**
 * The wave at path progress `p` (0..1). The profile's shares are scaled to
 * the whole path, so one profile fits a level of any length.
 */
export function waveAt(profile: readonly WaveSegment[], p: number): WavePoint {
  const total = profile.reduce((sum, seg) => sum + seg.SHARE, 0);
  let start = 0;
  for (const seg of profile) {
    const end = start + seg.SHARE / total;
    if (p < end) return { kind: seg.KIND, intensity: intensityOf(seg.KIND, (p - start) / (end - start)) };
    start = end;
  }
  const last = profile[profile.length - 1];
  return { kind: last.KIND, intensity: intensityOf(last.KIND, 1) };
}

/** How hard a stretch pushes `t` (0..1) of the way through it. */
function intensityOf(kind: WaveKind, t: number): number {
  switch (kind) {
    case "rest":
      return 0;
    case "spike":
      return WAVES.SPIKE;
    case "ramp":
      return WAVES.RAMP_TOP * t;
    case "burst":
      return 1;
  }
}
