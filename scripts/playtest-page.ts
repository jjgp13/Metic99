/**
 * Build the playtest Artifact page: `npm run playtest:build` builds the game
 * with `--mode playtest` (.env.playtest) and then runs this, which writes
 * `dist/playtest.html` plus `dist/assets/models/<name>.json`. Publish the page
 * with the files in `dist/` (not the .glb or .map files) and the `db`
 * capability (the game saves each run there; see src/services/playtestLog.ts).
 *
 * The Artifact host serves JSON but not .glb, so each model ships as
 * `{ "glb": "<base64>" }` and BootScene unpacks it.
 *
 * The Artifact host wraps the page in its own document whose root is already
 * padded by the phone's safe areas (notch, home bar), so the page drops its
 * own vertical safe-area padding and sizes to the padded box instead of the
 * whole screen; otherwise the keypad's bottom row slides under the home bar.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

declare const Buffer: { from(data: Uint8Array): { toString(encoding: "base64"): string } };

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

const models = readdirSync("dist/assets/models").filter((f) => f.endsWith(".glb"));
for (const file of models) {
  const glb = Buffer.from(readFileSync(`dist/assets/models/${file}`)).toString("base64");
  writeFileSync(`dist/assets/models/${file.replace(/\.glb$/, ".json")}`, JSON.stringify({ glb }));
}
console.log(`wrote dist/playtest.html and ${models.length} models as JSON`);
