/**
 * Which art the playfield is drawn in: pencil doodles on notebook paper
 * ("doodle", the default) or the older Three.js models ("3d"). The URL
 * `?art=3d` brings the 3D look back for comparison. Read once; a run never
 * switches.
 */
export type ArtMode = "3d" | "doodle";

let mode: ArtMode | null = null;

export function artMode(): ArtMode {
  if (mode === null) {
    // No window in the headless sims and tests: they draw nothing anyway.
    const art = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("art");
    mode = art === "3d" ? "3d" : "doodle";
  }
  return mode;
}
