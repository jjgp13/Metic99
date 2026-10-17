import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import { NET } from "../src/config/constants";
import { parseClient, type ClientMessage } from "../src/net/protocol";
import { Lag } from "../src/net/Lag";
import { Player } from "./Player";
import { Room } from "./Room";

/**
 * The Metic99 game server (docs/NETCODE.md, S2): one Node process that
 *
 * 1. serves the built game (`dist/`) over HTTP, so friends open one address
 *    and the page and the WebSocket share an origin (no CORS, one TLS
 *    certificate when deployed), and
 * 2. accepts WebSocket connections on NET.WS_PATH and runs one Room.
 *
 * Plain `ws`, no framework (Colyseus etc. would hide rooms, state sync and
 * the protocol, which is what this project is here to learn).
 *
 * Run: `npm run server` (dev, with `npm run dev` for the page; Vite proxies
 * /ws here) or `npm run build && npm run build:server && npm start`.
 * Env: PORT (default NET.SERVER_PORT), NET_LAG_MS / NET_JITTER_MS (fake lag,
 * S5's break-it experiment), STATIC_DIR (default dist).
 */

const PORT = Number(process.env.PORT ?? NET.SERVER_PORT);
const STATIC_DIR = resolve(process.cwd(), process.env.STATIC_DIR ?? "dist");
/** ws-level ping every this often; a socket that missed one is closed. */
const HEARTBEAT_MS = 10_000;

const room = new Room();
let nextId = 1;
/** Every open socket and its player (for the heartbeat). */
const connections = new Map<WebSocket, Player>();

// --- HTTP: the built game -----------------------------------------------------

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".glb": "model/gltf-binary",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

const http = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
  if (path === "/health") {
    res.writeHead(200, { "content-type": "text/plain" }).end("ok");
    return;
  }
  // Resolve inside STATIC_DIR only (no "../" escapes).
  const file = normalize(join(STATIC_DIR, path === "/" ? "index.html" : path));
  if (!file.startsWith(STATIC_DIR) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
});

// --- WebSocket: players -------------------------------------------------------

const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

http.on("upgrade", (req, socket, head) => {
  if ((req.url ?? "").split("?")[0] !== NET.WS_PATH) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => connect(ws));
});

function connect(ws: WebSocket): void {
  const lagIn = Lag.fromEnv(process.env);
  const player = new Player(nextId++, ws, Lag.fromEnv(process.env));
  connections.set(ws, player);
  ws.on("pong", () => (player.alive = true));
  ws.on("message", (data) => {
    lagIn.later(() => {
      const message = parseClient(String(data));
      if (!message) {
        console.warn(`[player ${player.id}] bad message, closing`);
        player.close();
        return;
      }
      if (message.t === "hello") return hello(player, message);
      if (player.ready) room.onMessage(player, message);
    });
  });
  ws.on("close", () => {
    connections.delete(ws);
    if (player.ready) room.leave(player);
    console.log(`[player ${player.id}] ${player.name || "?"} disconnected`);
  });
}

function hello(player: Player, message: Extract<ClientMessage, { t: "hello" }>): void {
  if (player.ready) return;
  // Client and server must run the same rules (S1): fingerprints and
  // replays only agree if both sides have exactly the same code.
  if (message.protocol !== NET.PROTOCOL_VERSION) return reject(player, "different protocol version: reload the page");
  if (message.build !== __BUILD_ID__) return reject(player, `game version ${message.build} ≠ server ${__BUILD_ID__}: reload the page`);
  player.name = message.name || `P${player.id}`;
  player.power = message.power;
  player.ready = true;
  player.send({ t: "welcome", id: player.id });
  room.join(player);
  console.log(`[player ${player.id}] ${player.name} joined (${message.power})`);
}

function reject(player: Player, reason: string): void {
  player.send({ t: "reject", reason });
  setTimeout(() => player.close(), 500);
}

// A dead connection (phone went to sleep, Wi-Fi dropped) never says goodbye:
// ping every socket and close the ones that didn't answer the last ping.
setInterval(() => {
  for (const [ws, player] of connections) {
    if (!player.alive) {
      ws.terminate();
      continue;
    }
    player.alive = false;
    ws.ping();
  }
}, HEARTBEAT_MS);

// The room's clock: tick often, it runs as many 60 Hz steps as real time paid for.
setInterval(() => room.tick(), 4);
setInterval(() => room.announce(), 1_000);

http.listen(PORT, () => {
  const lag = Lag.fromEnv(process.env);
  console.log(`Metic99 server on http://localhost:${PORT} (ws ${NET.WS_PATH}), build ${__BUILD_ID__}`);
  if (lag.on) console.log(`fake lag: ${lag.ms} ms + up to ${lag.jitterMs} ms jitter each way`);
  if (!existsSync(STATIC_DIR)) console.log(`(no ${STATIC_DIR}: run \`npm run build\` to serve the game here)`);
});
