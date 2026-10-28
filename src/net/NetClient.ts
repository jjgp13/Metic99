import { NET, type PowerKind } from "../config/constants";
import { decodeServer, encode, type ClientMessage, type ServerMessage } from "./protocol";
import { Lag } from "./Lag";

/** What the lobby shows: who waits, when the match starts. */
export interface LobbyInfo {
  players: string[];
  startsInMs: number | null;
  running: boolean;
  /** When this info arrived (ms, performance.now), to count down locally. */
  at: number;
}

/**
 * The connection to the game server (docs/NETCODE.md, S2/S4): one WebSocket
 * that lives across scenes (lobby → match → lobby). Phaser-free, so headless
 * bot clients (`npm run net:bots`) use it too; it needs only the standard
 * `WebSocket` (browsers, and Node 22+).
 *
 * It says hello (protocol version + rules id, so we never play with
 * different rules than the server), keeps the lobby info and the round-trip time, and hands
 * every other server message to whoever listens (the match in play).
 */
export class NetClient {
  state: "connecting" | "open" | "closed" = "connecting";
  /** Why the server refused us or the connection ended, if it did. */
  problem: string | null = null;
  id: number | null = null;
  lobby: LobbyInfo | null = null;
  /** Round-trip time to the server (ms), once measured. */
  rttMs: number | null = null;

  private readonly socket: WebSocket;
  private readonly listeners = new Set<(m: ServerMessage) => void>();
  private readonly lagOut: Lag;
  private readonly lagIn: Lag;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pings = new Map<number, number>();
  private nextPing = 0;

  constructor(
    url: string,
    hello: { name: string; power: PowerKind; rules: string },
    lag: { ms: number; jitterMs: number } = { ms: 0, jitterMs: 0 },
  ) {
    this.lagOut = new Lag(lag.ms, lag.jitterMs);
    this.lagIn = new Lag(lag.ms, lag.jitterMs);
    this.socket = new WebSocket(url);
    this.socket.onopen = () => {
      this.state = "open";
      this.send({ t: "hello", protocol: NET.PROTOCOL_VERSION, rules: hello.rules, name: hello.name, power: hello.power });
      this.pingTimer = setInterval(() => this.ping(), NET.PING_EVERY_MS);
    };
    this.socket.onmessage = (e) => this.lagIn.later(() => this.receive(String(e.data)));
    this.socket.onclose = () => {
      this.state = "closed";
      this.problem ??= "connection closed";
      if (this.pingTimer) clearInterval(this.pingTimer);
    };
    this.socket.onerror = () => (this.problem ??= "can't reach the server");
  }

  /** The server's WebSocket address: VITE_NET_URL if set, else this page's host. */
  static defaultUrl(location: { protocol: string; host: string }, configured?: string): string {
    if (configured) return configured;
    const scheme = location.protocol === "https:" ? "wss:" : "ws:";
    return `${scheme}//${location.host}${NET.WS_PATH}`;
  }

  send(message: ClientMessage): void {
    const text = encode(message);
    this.lagOut.later(() => {
      if (this.socket.readyState === WebSocket.OPEN) this.socket.send(text);
    });
  }

  /** Listen to server messages; returns a function that stops listening. */
  on(listener: (m: ServerMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {
    this.socket.close();
  }

  /** ms until the match starts, counting down since the last lobby message. */
  startsInMs(now: number): number | null {
    const l = this.lobby;
    return l?.startsInMs == null ? null : Math.max(0, l.startsInMs - (now - l.at));
  }

  private receive(raw: string): void {
    const m = decodeServer(raw);
    if (!m) return;
    switch (m.t) {
      case "welcome":
        this.id = m.id;
        break;
      case "reject":
        this.problem = m.reason;
        break;
      case "lobby":
        this.lobby = { players: m.players, startsInMs: m.startsInMs, running: m.running, at: performance.now() };
        break;
      case "pong": {
        const sent = this.pings.get(m.id);
        if (sent !== undefined) this.rttMs = performance.now() - sent;
        this.pings.delete(m.id);
        break;
      }
    }
    for (const listener of this.listeners) listener(m);
  }

  private ping(): void {
    const id = this.nextPing++;
    this.pings.set(id, performance.now());
    this.send({ t: "ping", id });
  }
}
