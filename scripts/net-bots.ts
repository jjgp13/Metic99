/**
 * Headless bot clients (docs/NETCODE.md, S5): N fake players connect to a
 * running game server over real WebSockets and play online matches with a
 * bot each, through the same NetClient / NetBattle code the browser uses.
 * Use it to test the server without friends, and as a load test.
 *
 *   npm run server                      (another terminal)
 *   npm run net:bots -- --clients 7     (7 bots join; with you in a browser = 8)
 *   npm run net:bots -- --clients 8 --go --lag 120 --jitter 60
 *
 * --url ws://host:port/ws   server (default ws://localhost:8787/ws)
 * --go                      press START once all clients joined (else wait for the lobby)
 * --level ace|pilot|rookie  bot skill (default pilot)
 * --lag / --jitter ms       fake network delay each way (the break-it experiment)
 * --matches N               play N matches, then exit (default 1)
 * --slowmo 0.5              cheat: run the field at half speed (more
 *                           thinking time); the server should replace them
 * --rules ID                the rules id to say hello with (default: this
 *                           checkout's __RULES_ID__)
 */
import { NET, POWER_KINDS, SIM, type BotLevel } from "../src/config/constants";
import { NetBattle } from "../src/net/NetBattle";
import { NetClient } from "../src/net/NetClient";
import { Bot } from "../src/sim/Bot";

declare const process: { argv: string[]; exit(code: number): void };

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const CLIENTS = Number(arg("clients", "7"));
const URL = arg("url", `ws://localhost:${NET.SERVER_PORT}${NET.WS_PATH}`);
const LEVEL = arg("level", "pilot") as BotLevel;
const LAG = { ms: Number(arg("lag", "0")), jitterMs: Number(arg("jitter", "0")) };
const MATCHES = Number(arg("matches", "1"));
const GO = process.argv.includes("--go");
const SLOWMO = Number(arg("slowmo", "1"));
const RULES = arg("rules", __RULES_ID__);

interface Result {
  name: string;
  seat: number;
  placement: number;
  desyncs: number;
  kicked: string | null;
  rttMs: number | null;
  seconds: number;
}
const results: Result[] = [];
let finished = 0;

function runClient(i: number): void {
  const name = `BOT${i + 1}`;
  const client = new NetClient(URL, { name, power: POWER_KINDS[i % POWER_KINDS.length], rules: RULES }, LAG);
  let played = 0;
  client.on((m) => {
    // Press START once every bot is in the lobby (one press is enough).
    if (m.t === "lobby" && GO && i === 0 && !m.running && m.players.length >= CLIENTS) client.send({ t: "go" });
    if (m.t === "reject") {
      console.error(`${name}: rejected: ${m.reason}`);
      process.exit(1);
    }
    if (m.t !== "start") return;
    const battle = new NetBattle(client, m);
    const bot = Bot.forSeat(LEVEL, m.seed, m.you);
    const timer = setInterval(() => {
      // Run every step real time owes (like the game's catch-up online).
      // --slowmo 0.5 plays at half speed: the cheat the server must catch.
      while (battle.field.steps < battle.stepsDue() * SLOWMO && !battle.field.knockedOut && !battle.kicked) {
        bot.update(battle.field, SIM.STEP_MS);
        battle.step(SIM.STEP_MS);
      }
      battle.poll();
      const events = battle.takeEvents();
      for (const e of events) if (e.type === "over" && i === 0) console.log(`winner: seat ${e.winner}`);
      const over = events.some((e) => e.type === "over");
      if (over || battle.kicked) {
        clearInterval(timer);
        battle.dispose();
        results.push({
          name,
          seat: battle.you,
          placement: battle.placementOf(battle.you),
          desyncs: battle.desyncs,
          kicked: battle.kicked,
          rttMs: client.rttMs,
          seconds: Math.round(battle.field.elapsedMs / 1000),
        });
        if (++played >= MATCHES) {
          client.close();
          if (++finished === CLIENTS) report();
        }
      }
    }, 8);
  });
}

function report(): void {
  console.table(results.sort((a, b) => a.placement - b.placement));
  const desyncs = results.reduce((n, r) => n + r.desyncs, 0);
  console.log(`${results.length} results, ${desyncs} desyncs, ${results.filter((r) => r.kicked).length} kicked`);
  process.exit(desyncs ? 1 : 0);
}

console.log(`${CLIENTS} bot clients (${LEVEL}) → ${URL}${LAG.ms || LAG.jitterMs ? `, lag ${LAG.ms}±${LAG.jitterMs} ms` : ""}`);
for (let i = 0; i < CLIENTS; i++) setTimeout(() => runClient(i), i * 100);
