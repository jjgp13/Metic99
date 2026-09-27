import { execSync } from "node:child_process";
import { defineConfig } from "vite";

/** The commit a build came from (+ "-dirty" with uncommitted changes), so a
 * logged playtest run can be replayed with exactly the code that played it. */
function buildId(): string {
  try {
    const sha = execSync("git rev-parse --short HEAD").toString().trim();
    const dirty = execSync("git status --porcelain").toString().trim() !== "";
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return "unknown";
  }
}

export default defineConfig({
  base: "./",
  define: {
    __BUILD_ID__: JSON.stringify(buildId()),
  },
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: "es2020",
    sourcemap: true,
  },
});
