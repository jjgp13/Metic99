import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
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

/** Everything that decides what a field computes, plus the protocol. */
const RULE_SOURCES = ["src/sim", "src/objects", "src/config", "src/math", "src/net/protocol.ts"];

/**
 * The rules' fingerprint (docs/NETCODE.md, launch): a hash of the rule
 * source files. Client and server must run the same rules to agree on a
 * field, so the hello compares this. It comes from the files' content, not
 * from git, because the page (GitHub Pages) and the server (Render's
 * Docker build, no .git) are built in different places: same rules → same
 * id, wherever they were built. Line endings are normalized (Windows
 * checkouts have CRLF, Linux LF) and tests are left out.
 */
function rulesId(): string {
  const files: string[] = [];
  const walk = (path: string) => {
    if (statSync(path).isDirectory()) for (const name of readdirSync(path)) walk(join(path, name));
    else if (/\.(ts|json)$/.test(path) && !/\.test\.ts$/.test(path)) files.push(path.replace(/\\/g, "/"));
  };
  RULE_SOURCES.forEach(walk);
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    hash.update(file);
    hash.update(readFileSync(file, "utf8").replace(/\r\n/g, "\n"));
  }
  return `r${hash.digest("hex").slice(0, 12)}`;
}

export default defineConfig(({ isSsrBuild }) => ({
  base: "./",
  define: {
    __BUILD_ID__: JSON.stringify(buildId()),
    __RULES_ID__: JSON.stringify(rulesId()),
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
