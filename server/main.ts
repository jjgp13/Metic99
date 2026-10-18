import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type IncomingMessage } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import { NET } from "../src/config/constants";
import { parseClient, type ClientMessage } from "../src/net/protocol";
import { Lag } from "../src/net/Lag";
import { Player } from "./Player";
import { RateLimit } from "./RateLimit";
import type { Room } from "./Room";
import { Rooms } from "./Rooms";

/**
 * The Metic99 game server (docs/NETCODE.md, S2): one Node process that
 *
 * 1. serves the built game (`dist/`) over HTTP, so friends open one address
 *    and the page and the WebSocket share an origin (no CORS, one TLS
 *    certificate when deployed), and
 * 2. accepts WebSocket connections on NET.WS_PATH and runs a few Rooms
 *    (MAX_ROOMS, default NET.MAX_ROOMS; past that it says "busy").
 *
 * Plain `ws`, no framework (Colyseus etc. would hide rooms, state sync and
 * the protocol, which is what this project is here to learn).
 *
 * Open to the internet, so the door has locks (launch hardening):
 * - at most MAX_PER_IP connections per address and MAX_CONNECTIONS in all;
 * - a token bucket per connection (a flood is cut off);
 * - browsers on other websites can't connect (Origin check); scripts can
 *   fake an Origin, which is why the other locks exist;
 * - a connection must say hello within HELLO_TIMEOUT_MS;
 * - a bad message closes only that connection; a crashing room closes only
 *   that room (Rooms.tick).
 *
 * Run: `npm run server` (dev, with `npm run dev` for the page; Vite proxies
 * /ws here) or `npm run build && npm run build:server && npm start`.
 * Env: PORT (default NET.SERVER_PORT), MAX_ROOMS, MAX_PER_IP,
 * ALLOWED_ORIGINS (comma-separated, e.g. https://jjgp13.github.io), TRUST_PROXY=1
 * (behind Render's proxy: the client's IP is in X-Forwarded-For),
 * NET_LAG_MS / NET_JITTER_MS (fake lag), STATIC_DIR (default dist).
 */

const PORT = Number(process.env.PORT ?? NET.SERVER_PORT);
const STATIC_DIR = resolve(process.cwd(), process.env.STATIC_DIR ?? "dist");
const MAX_ROOMS = Number(process.env.MAX_ROOMS ?? NET.MAX_ROOMS);
const MAX_PER_IP = Number(process.env.MAX_PER_IP ?? 4);
/** Everyone in rooms plus the same again waiting or being turned away. */
const MAX_CONNECTIONS = MAX_ROOMS * NET.SEATS * 2;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "").split(",").filter(Boolean);
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
/** ws-level ping every this often; a socket that missed one is closed. */
const HEARTBEAT_MS = 10_000;
const HELLO_TIMEOUT_MS = 10_000;
/** Messages per second per connection, and the burst it may save up. */
const RATE = { perSecond: 60, burst: 120 };

const rooms = new Rooms(MAX_ROOMS);
/** The room each player who said hello is in. */
const roomOf = new Map<Player, Room>();
let nextId = 1;
/** Every open socket and its player (for the heartbeat). */
const connections = new Map<WebSocket, Player>();
/** Open connections per client IP address. */
const perIp = new Map<string, number>();

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
    res.writeHead(200, { "content-type": "text/plain" }).end(`ok: ${rooms.summary()}, ${connections.size} sockets`);
    return;
  }
  // Resolve inside STATIC_DIR only (no "../" escapes).
  const file = normalize(join(STATIC_DIR, path === "/" ? "index.html" : path));
  if (!file.startsWith(STATIC_DIR) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "x-content-type-options": "nosniff",
  });
  createReadStream(file).pipe(res);
});

// --- WebSocket: players -------------------------------------------------------

/**
 * Compression (permessage-deflate, built into every browser): our JSON is
 * repetitive (8 tiles with the same keys, 10 times a second), so it shrinks
 * several times; that matters on a free plan's monthly bandwidth. It costs
 * CPU and ~300 KB of memory per socket (zlib keeps context between
 * messages, which is what makes the repeats cheap). Messages under the
 * threshold go uncompressed: not worth the CPU.
 */
const wss = new WebSocketServer({
  noServer: true,
  maxPayload: 16 * 1024,
  perMessageDeflate: { threshold: 256, zlibDeflateOptions: { level: 3 } },
});

/**
 * The client's address: behind a proxy (Render), the first X-Forwarded-For
 * entry. Trade-off: a client can put its own first entry there, so a
 * determined attacker can dodge the per-IP cap (the global cap and the rate
 * limit still hold). Taking a later entry would be harder to fake but, if
 * the host adds internal hops, would make every player look like one IP
 * and lock everyone out: for an experiment, failing open is the safer bet.
 */
function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return (TRUST_PROXY && first) || req.socket.remoteAddress || "?";
}

/** This machine itself (local tests and bot clients): no per-IP cap. */
function isLoopback(ip: string): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

/** A browser page from our own host, an allowed one, or localhost (dev). No
 * Origin (a script, the bot clients) passes: it can't be checked anyway. */
function originAllowed(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return (
      url.host === req.headers.host ||
      ALLOWED_ORIGINS.includes(origin) ||
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1"
    );
  } catch {
    return false;
  }
}

http.on("upgrade", (req, socket, head) => {
  const ip = clientIp(req);
  const refuse = (status: string) => {
    socket.write(`HTTP/1.1 ${status}\r\n\r\n`);
    socket.destroy();
  };
  if ((req.url ?? "").split("?")[0] !== NET.WS_PATH) return refuse("404 Not Found");
  if (!originAllowed(req)) return refuse("403 Forbidden");
  if (connections.size >= MAX_CONNECTIONS) return refuse("503 Service Unavailable");
  if (!isLoopback(ip) && (perIp.get(ip) ?? 0) >= MAX_PER_IP) return refuse("429 Too Many Requests");
  wss.handleUpgrade(req, socket, head, (ws) => connect(ws, ip));
});

function connect(ws: WebSocket, ip: string): void {
  const lagIn = Lag.fromEnv(process.env);
  const player = new Player(nextId++, ws, Lag.fromEnv(process.env));
  const limit = new RateLimit(RATE.perSecond, RATE.burst, Date.now());
  connections.set(ws, player);
  perIp.set(ip, (perIp.get(ip) ?? 0) + 1);
  const helloTimer = setTimeout(() => {
    if (!player.ready) player.close();
  }, HELLO_TIMEOUT_MS);

  ws.on("pong", () => (player.alive = true));
  ws.on("message", (data) => {
    if (!limit.take(Date.now())) {
      console.warn(`[player ${player.id}] too many messages, closing`);
      ws.terminate();
      return;
    }
    lagIn.later(() => {
      try {
        const message = parseClient(String(data));
        if (!message) {
          console.warn(`[player ${player.id}] bad message, closing`);
          player.close();
          return;
        }
        if (message.t === "hello") return hello(player, message);
        if (player.ready) roomOf.get(player)?.onMessage(player, message);
      } catch (error) {
        // A bug triggered by one player's message drops that player only.
        console.error(`[player ${player.id}] error handling a message, closing:`, error);
        player.close();
      }
    });
  });
  ws.on("close", () => {
    clearTimeout(helloTimer);
    connections.delete(ws);
    const left = (perIp.get(ip) ?? 1) - 1;
    if (left > 0) perIp.set(ip, left);
    else perIp.delete(ip);
    roomOf.get(player)?.leave(player);
    roomOf.delete(player);
    console.log(`[player ${player.id}] ${player.name || "?"} disconnected (${rooms.summary()})`);
  });
}

function hello(player: Player, message: Extract<ClientMessage, { t: "hello" }>): void {
  if (player.ready) return;
  // Client and server must run the same rules (S1): fingerprints and
  // replays only agree if both sides compute with exactly the same code.
  // __RULES_ID__ hashes the rule files, so a page built on GitHub Pages and
  // a server built on Render match whenever their rules do.
  if (message.protocol !== NET.PROTOCOL_VERSION) return reject(player, "different protocol version: reload the page");
  if (message.rules !== __RULES_ID__) return reject(player, "the game was updated: reload the page");
  player.name = message.name || `P${player.id}`;
  player.power = message.power;
  player.ready = true;
  player.send({ t: "welcome", id: player.id });
  const room = rooms.place(player);
  if (!room) return reject(player, "the server is busy (all matches full): try again in a few minutes");
  roomOf.set(player, room);
  console.log(`[player ${player.id}] ${player.name} joined room ${room.id} (${rooms.summary()})`);
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

// The rooms' clock: tick often, each runs as many 60 Hz steps as real time paid for.
setInterval(() => rooms.tick(), 4);
setInterval(() => rooms.announce(), 1_000);

http.listen(PORT, () => {
  const lag = Lag.fromEnv(process.env);
  console.log(`Metic99 server on http://localhost:${PORT} (ws ${NET.WS_PATH}), rules ${__RULES_ID__} (build ${__BUILD_ID__})`);
  console.log(`limits: ${MAX_ROOMS} rooms, ${MAX_CONNECTIONS} sockets, ${MAX_PER_IP} per IP${TRUST_PROXY ? " (behind a proxy)" : ""}`);
  if (lag.on) console.log(`fake lag: ${lag.ms} ms + up to ${lag.jitterMs} ms jitter each way`);
  if (!existsSync(STATIC_DIR)) console.log(`(no ${STATIC_DIR}: run \`npm run build\` to serve the game here)`);
});
