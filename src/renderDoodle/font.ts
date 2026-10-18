import fontUrl from "@fontsource/patrick-hand/files/patrick-hand-latin-400-normal.woff2?url";
import { DOODLE } from "../config/constants";

/**
 * Load the handwriting font (bundled with the build, ~20 kB, fetched only in
 * the doodle art). Phaser draws each text once, so the font must be ready
 * before the first scene writes anything; a failure just keeps the fallback.
 */
export async function loadDoodleFont(): Promise<void> {
  try {
    const face = await new FontFace(DOODLE.FONT, `url(${fontUrl})`).load();
    document.fonts.add(face);
  } catch (e) {
    console.warn("[doodle] handwriting font failed to load", e);
  }
}
