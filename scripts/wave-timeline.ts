/**
 * Wave timelines: every story level's path, stretch by stretch (start and
 * end in seconds, kind, peak height), for timing music to the waves. Run
 * with `npm run waves`. Seconds are path time: SLOW and the freeze after a
 * hit stretch it by up to 1 / STORY.PATH_MIN_PACE of real time.
 */
import { LEVELS } from "../src/config/constants";

const sec = (ms: number) => (ms / 1000).toFixed(1);
for (const [i, level] of LEVELS.entries()) {
  const { PROFILE, BASE, PEAK } = level.WAVES;
  const total = PROFILE.reduce((sum, seg) => sum + seg.SHARE, 0);
  console.log(`\n${i + 1} ${level.NAME}: path ${sec(level.PATH_MS)} s, ${BASE} sum(s) at rest → ${PEAK} at the top`);
  let start = 0;
  for (const seg of PROFILE) {
    const end = start + (seg.SHARE / total) * level.PATH_MS;
    const height = "HEIGHT" in seg ? String(seg.HEIGHT) : seg.KIND === "burst" ? "1" : "0";
    const shape = seg.KIND === "ramp" ? `0 → ${height}` : height;
    console.log(`  ${sec(start).padStart(5)} – ${sec(end).padStart(5)} s  ${seg.KIND.padEnd(5)}  ${shape}`);
    start = end;
  }
}
