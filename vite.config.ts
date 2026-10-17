import { execSync } from "node:child_process";
import { defineConfig } from "vite";

/** The commit a build came from (+ "-dirty" with uncommitted changes), so a
 * logged playtest run can be replayed with exactly the code that played it. */
function buildId(): string {
  try {
    const sha = execSync("git rev-parse --short HEAD").toString().trim();
    const dirty = execSync("git status --porcelain --untracked-files=no").toString().trim() !== "";
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return "unknown";
  }
}

export default defineConfig(({ isSsrBuild }) => ({
  base: "./",
  define: {
    __BUILD_ID__: JSON.stringify(buildId()),
  },
  server: {
    host: true,
    port: 5173,
    // Online play in dev: the page talks to `npm run server` through Vite,
    // so it uses the same address in dev and when the server hosts the game.
    proxy: {
      "/ws": { target: "ws://localhost:8787", ws: true },
    },
  },
  build: {
    target: "es2020",
    sourcemap: true,
    // The server bundle (`npm run build:server`) doesn't need the game's art.
    copyPublicDir: !isSsrBuild,
  },
}));
