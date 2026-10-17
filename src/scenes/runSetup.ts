import { MATCH } from "../config/constants";
import { selectedPower } from "../config/powers";
import { ABILITY_KINDS, type AbilityKind } from "../objects/abilities";
import { Bot } from "../sim/Bot";
import { Field } from "../sim/Field";
import { LocalBattle, type BattleSource } from "../sim/BattleSource";
import { Match } from "../sim/Match";
import { randomSeed } from "../sim/rng";

/** Everything a run starts from (GameScene builds its screen around it). */
export interface RunSetup {
  seed: number;
  /** The player's field (in a battle: `battle.field`). */
  field: Field;
  /** Battle mode: the battle (offline match or online); null in solo play. */
  battle: BattleSource | null;
  /** Dev (`?ability=…`): every allowed spawn gets one of these. */
  forcedAbilities: AbilityKind[] | null;
  /** Dev (`?bot=ace`): a bot plays the player's field through the same inputs. */
  autopilot: Bot | null;
}

/**
 * Start a run: pick its seed and build the field (or the battle match).
 * The same seed and inputs roll the same aliens.
 *
 * Dev builds read URL parameters for play-testing:
 * - `?seed=123` replays a seed (every run logs its seed);
 * - `?ability=blinker,shielded` makes every allowed spawn one of these;
 * - `?bot=ace` puts a bot on autopilot (also online: handy for testing).
 */
export function setUpRun(battle: boolean, online?: BattleSource): RunSetup {
  const params = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null;
  if (online) {
    // Online: the server picked the seed and built the field's twin.
    const level = params?.get("bot") ?? "";
    const autopilot = Bot.isLevel(level) ? Bot.forSeat(level, online.field.seed, online.you) : null;
    return { seed: online.field.seed, field: online.field, battle: online, forcedAbilities: null, autopilot };
  }
  const seed = seedFrom(params);
  if (params) console.info(`[metic] run seed ${seed} (replay with ?seed=${seed})`);

  const level = params?.get("bot") ?? "";
  const autopilot = Bot.isLevel(level) ? Bot.forSeat(level, seed) : null;

  if (battle) {
    // You (seat 0) and the bots share the seed, one life each.
    const match = new Match({ seed, seats: ["human", ...MATCH.OPPONENTS], humanPower: selectedPower() });
    const battle = new LocalBattle(match);
    return { seed, field: battle.field, battle, forcedAbilities: null, autopilot };
  }
  const forcedAbilities = abilitiesFrom(params);
  const field = new Field({ seed, forcedAbilities, power: selectedPower() });
  return { seed, field, battle: null, forcedAbilities, autopilot };
}

function seedFrom(params: URLSearchParams | null): number {
  const asked = params?.get("seed");
  return asked && /^\d+$/.test(asked) ? Number(asked) >>> 0 : randomSeed();
}

function abilitiesFrom(params: URLSearchParams | null): AbilityKind[] | null {
  const kinds = params
    ?.get("ability")
    ?.split(",")
    .filter((k): k is AbilityKind => (ABILITY_KINDS as string[]).includes(k));
  return kinds?.length ? kinds : null;
}
