/**
 * Build the playtest Artifact page from `dist/index.html` (run `npm run build`
 * first): `npm run playtest:page` writes `dist/playtest.html`, which is then
 * published with the files in `dist/` and the `db` capability (the game saves
 * each run there; see src/services/playtestLog.ts).
 *
 * The Artifact host wraps the page in its own document whose root is already
 * padded by the phone's safe areas (notch, home bar), so the page drops its
 * own vertical safe-area padding and sizes to the padded box instead of the
 * whole screen; otherwise the keypad's bottom row slides under the home bar.
 */
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync("dist/index.html", "utf8");
const style = src.match(/<style>[\s\S]*?<\/style>/)?.[0];
const script = src.match(/<script type="module"[^>]*><\/script>/)?.[0];
if (!style || !script) throw new Error("dist/index.html: no <style> or module <script>; run npm run build");

const page = `<title>Metic99 Playtest</title>
${style}
<style>
  /* The host already pads the root by the top/bottom safe areas. */
  html { box-sizing: border-box; }
  #game {
    padding: 0 env(safe-area-inset-right) 0 env(safe-area-inset-left);
  }
</style>
${script}
<div id="game"></div>
`;
writeFileSync("dist/playtest.html", page);
console.log("wrote dist/playtest.html");
