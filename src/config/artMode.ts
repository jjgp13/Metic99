/**
 * Which art the playfield is drawn in: the Three.js models ("3d", the
 * default) or pencil doodles on notebook paper ("doodle", a prototype).
 * Picked by the URL: `?art=doodle`. Read once; a run never switches.
 */
export type ArtMode = "3d" | "doodle";

let mode: ArtMode | null = null;

export function artMode(): ArtMode {
  if (mode === null) {
    // No window in the headless sims and tests: they draw nothing anyway.
    const art = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("art");
    mode = art === "doodle" ? "doodle" : "3d";
  }
  return mode;
}
