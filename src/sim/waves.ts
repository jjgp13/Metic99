import type { WaveKind, WaveSegment } from "../config/constants";

/** Where a path is in its wave: the stretch, and how hard it pushes (0..1). */
export interface WavePoint {
  kind: WaveKind;
  /** The stretch's top: 0 for a rest, its HEIGHT for a push, 1 for a burst. */
  height: number;
  /** How hard it pushes right now: 0 = rest, 1 = a full burst. */
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
    if (p < end) return pointIn(seg, (p - start) / (end - start));
    start = end;
  }
  return pointIn(profile[profile.length - 1], 1);
}

/** The wave `t` (0..1) of the way through one stretch. */
function pointIn(seg: WaveSegment, t: number): WavePoint {
  switch (seg.KIND) {
    case "rest":
      return { kind: seg.KIND, height: 0, intensity: 0 };
    case "spike":
      return { kind: seg.KIND, height: seg.HEIGHT, intensity: seg.HEIGHT };
    case "ramp":
      return { kind: seg.KIND, height: seg.HEIGHT, intensity: seg.HEIGHT * t };
    case "burst":
      return { kind: seg.KIND, height: 1, intensity: 1 };
  }
}
