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
    // No page (location) in the headless sims, tests and the game server:
    // they draw nothing anyway. Read through globalThis so this file also
    // compiles for the server, which has no browser types.
    const search = (globalThis as { location?: { search: string } }).location?.search;
    const art = search === undefined ? null : new URLSearchParams(search).get("art");
    mode = art === "3d" ? "3d" : "doodle";
  }
  return mode;
}
