import { MATCH } from "../config/constants";
import { selectedPower } from "../config/powers";
import { ABILITY_KINDS, type AbilityKind } from "../objects/abilities";
import { Bot } from "../sim/Bot";
import { Field } from "../sim/Field";
import { Match } from "../sim/Match";
import { randomSeed } from "../sim/rng";

/** Everything a run starts from (GameScene builds its screen around it). */
export interface RunSetup {
  seed: number;
  /** The player's field (in a battle: `match.fields[0]`). */
  field: Field;
  /** Battle mode: the match; null in solo play. */
  match: Match | null;
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
 * - `?bot=ace` puts a bot on autopilot.
 */
export function setUpRun(battle: boolean): RunSetup {
  const params = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null;
  const seed = seedFrom(params);
  if (params) console.info(`[metic] run seed ${seed} (replay with ?seed=${seed})`);

  const level = params?.get("bot") ?? "";
  const autopilot = Bot.isLevel(level) ? Bot.forSeat(level, seed) : null;

  if (battle) {
    // You (seat 0) and the bots share the seed, one life each.
    const match = new Match({ seed, seats: ["human", ...MATCH.OPPONENTS], humanPower: selectedPower() });
    return { seed, field: match.fields[0], match, forcedAbilities: null, autopilot };
  }
  const forcedAbilities = abilitiesFrom(params);
  const field = new Field({ seed, forcedAbilities, power: selectedPower() });
  return { seed, field, match: null, forcedAbilities, autopilot };
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
