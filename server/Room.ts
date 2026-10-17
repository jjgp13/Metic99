import { MATCH, NET, SIM, type BotLevel } from "../src/config/constants";
import type { ClientMessage } from "../src/net/protocol";
import { Match, type Seat } from "../src/sim/Match";
import { randomSeed } from "../src/sim/rng";
import type { Player } from "./Player";
import { RemoteSeat } from "./RemoteSeat";
import { TickStats } from "./TickStats";

/** Steps the server may run in one tick to catch up after a stall. */
const MAX_CATCH_UP_STEPS = 30;
/** After a match ends, players see the results this long before the lobby. */
const RESULTS_MS = 6_000;

/**
 * One room: a lobby, then a match, then the lobby again (docs/NETCODE.md,
 * S2–S3). The server runs one room; more rooms (and more servers) are phase
 * 3 (matchmaking).
 *
 * The lobby waits NET.LOBBY_WAIT_MS after the first player arrives (or until
 * someone presses START), then fills the empty seats with bots and starts a
 * `Match` on a fresh seed. People's seats are "remote": the match doesn't
 * step their fields, their RemoteSeat advances the server's copy from their
 * inputs. Bots' fields run here, in the match.
 *
 * The tick loop is the same fixed timestep as the game: real time is turned
 * into whole 60 Hz steps. Each step: the match steps (bots, KOs, targets,
 * attacks), messages for people go out, events are broadcast, and every
 * TILES_EVERY_STEPS everyone gets everyone's tiles.
 */
export class Room {
  private readonly players = new Map<number, Player>();
  private state: "lobby" | "running" | "results" = "lobby";
  private startsAt: number | null = null;
  private match: Match | null = null;
  private seats = new Map<number, RemoteSeat>(); // player id → their seat
  private matchStartedAt = 0;
  private resultsUntil = 0;
  readonly ticks = new TickStats();

  constructor(private readonly now: () => number = () => performance.now()) {}

  // --- Connections ---------------------------------------------------------

  join(player: Player): void {
    this.players.set(player.id, player);
    if (this.state === "lobby" && this.startsAt === null) this.startsAt = this.now() + NET.LOBBY_WAIT_MS;
    this.broadcastLobby();
  }

  leave(player: Player): void {
    this.players.delete(player.id);
    const seat = this.seats.get(player.id);
    if (seat) this.handOver(seat, "left");
    if (this.state === "lobby" && this.lobbyPlayers().length === 0) this.startsAt = null;
    this.broadcastLobby();
  }

  /** A checked message from a player who said hello. */
  onMessage(player: Player, message: ClientMessage): void {
    switch (message.t) {
      case "go":
        if (this.state === "lobby") this.startsAt = this.now();
        return;
      case "inputs": {
        const seat = this.seats.get(player.id);
        if (!seat || !this.match) return;
        const maxStep = Math.floor((this.now() - this.matchStartedAt) / SIM.STEP_MS) + NET.MAX_AHEAD_STEPS;
        const refused = seat.receive(message.upTo, message.entries, maxStep, this.now());
        if (refused) this.handOver(seat, refused);
        return;
      }
      case "check":
        this.seats.get(player.id)?.check(message.step, message.hash);
        return;
      case "ping":
        player.send({ t: "pong", id: message.id });
        return;
      case "hello":
        return; // handled in main.ts
    }
  }

  // --- The loop --------------------------------------------------------------

  /** Call often (every few ms); runs every step real time has paid for. */
  tick(): void {
    const now = this.now();
    if (this.state === "lobby" && this.startsAt !== null && now >= this.startsAt) this.startMatch(now);
    if (this.state === "results" && now >= this.resultsUntil) this.backToLobby();
    const match = this.match;
    if (this.state !== "running" || !match) return;

    const started = performance.now();
    const due = Math.floor((now - this.matchStartedAt) / SIM.STEP_MS);
    let ran = 0;
    while (match.steps < due && ran < MAX_CATCH_UP_STEPS && !match.over) {
      this.step(match, now);
      ran++;
    }
    if (ran) this.ticks.record(performance.now() - started, ran);
  }

  private step(match: Match, now: number): void {
    match.step(SIM.STEP_MS);
    for (const { seat, message } of match.takeOutbox()) this.seatAt(seat)?.send(message);
    for (const event of match.takeEvents()) {
      this.broadcast({ t: "event", event });
      if (event.type === "over") this.endMatch(now);
    }
    if (match.steps % NET.TILES_EVERY_STEPS === 0) this.broadcast({ t: "tiles", step: match.steps, tiles: match.tiles() });
    for (const seat of this.seats.values()) {
      if (!seat.replaced && match.placements[seat.seat] === 0 && now - seat.lastHeardAt > NET.SILENT_TAKEOVER_MS) {
        this.handOver(seat, "stopped sending");
      }
    }
  }

  // --- Lobby and match lifecycle --------------------------------------------

  private startMatch(now: number): void {
    const people = this.lobbyPlayers().slice(0, NET.SEATS);
    if (!people.length) {
      this.startsAt = null;
      return;
    }
    const bots = NET.FILL_BOTS.slice(0, NET.SEATS - people.length) as readonly BotLevel[];
    const seats: Seat[] = [...people.map((): Seat => "remote"), ...bots];
    const seed = randomSeed();
    const match = new Match({
      seed,
      seats,
      lives: MATCH.LIVES,
      powers: people.map((p) => p.power),
      names: people.map((p) => p.name),
    });
    this.match = match;
    this.matchStartedAt = now;
    this.state = "running";
    this.startsAt = null;
    this.seats = new Map(people.map((p, seat) => [p.id, new RemoteSeat(seat, p, match.fields[seat], now)]));
    const seatList = match.seats.map((who, seat) => ({ who, name: match.names[seat] }));
    people.forEach((p, seat) =>
      p.send({ t: "start", seed, you: seat, lives: MATCH.LIVES, power: p.power, seats: seatList }),
    );
    // The match's first messages (standing) were queued while it was built.
    for (const { seat, message } of match.takeOutbox()) this.seatAt(seat)?.send(message);
    console.log(`[room] match started: seed ${seed}, ${people.length} people + ${bots.length} bots`);
    this.broadcastLobby();
  }

  private endMatch(now: number): void {
    this.state = "results";
    this.resultsUntil = now + RESULTS_MS;
    const desyncs = [...this.seats.values()].reduce((n, s) => n + s.desyncs, 0);
    console.log(
      `[room] match over after ${Math.round((now - this.matchStartedAt) / 1000)} s; ` +
        `desyncs ${desyncs}; ${this.ticks.summary()}`,
    );
  }

  private backToLobby(): void {
    this.state = "lobby";
    this.match = null;
    this.seats = new Map();
    this.startsAt = this.players.size ? this.now() + NET.LOBBY_WAIT_MS : null;
    this.broadcastLobby();
  }

  /** A person stopped playing: a bot takes over their field. */
  private handOver(seat: RemoteSeat, reason: string): void {
    if (seat.replaced || !this.match) return;
    seat.handOver(reason);
    this.match.replaceWithBot(seat.seat, NET.TAKEOVER_BOT);
    seat.player.send({ t: "kicked", reason });
    console.log(`[room] seat ${seat.seat} (${seat.player.name}) → bot: ${reason}`);
  }

  private seatAt(seat: number): RemoteSeat | undefined {
    for (const s of this.seats.values()) if (s.seat === seat && !s.replaced) return s;
    return undefined;
  }

  /** Players who said hello and aren't in the running match. */
  private lobbyPlayers(): Player[] {
    return [...this.players.values()].filter((p) => p.ready && !this.seats.has(p.id));
  }

  private broadcastLobby(): void {
    const waiting = this.lobbyPlayers();
    const startsInMs = this.state === "lobby" && this.startsAt !== null ? Math.max(0, this.startsAt - this.now()) : null;
    for (const p of waiting) {
      p.send({ t: "lobby", players: waiting.map((w) => w.name), startsInMs, running: this.state !== "lobby" });
    }
  }

  private broadcast(message: Parameters<Player["send"]>[0]): void {
    for (const seat of this.seats.values()) if (this.players.has(seat.player.id)) seat.player.send(message);
  }

  /** Lobby countdown, re-sent every second so clients can show it. */
  announce(): void {
    if (this.state === "lobby") this.broadcastLobby();
  }
}
