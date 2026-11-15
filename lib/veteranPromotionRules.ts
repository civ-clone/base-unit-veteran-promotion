import { PromotionChance, Promoted } from './Rules';
import {
  RuleRegistry,
  instance as ruleRegistryInstance,
} from '@civ-clone/core-rule/RuleRegistry';
import {
  UnitImprovementRegistry,
  instance as unitImprovementRegistryInstance,
} from '@civ-clone/core-unit-improvement/UnitImprovementRegistry';
import Action from '@civ-clone/core-unit/Action';
import Criterion from '@civ-clone/core-rule/Criterion';
import Defeated from '@civ-clone/core-unit/Rules/Defeated';
import Effect from '@civ-clone/core-rule/Effect';
import High from '@civ-clone/core-rule/Priorities/High';
import SingleUse from '@civ-clone/base-unit-trait-single-use/SingleUse';
import Unit from '@civ-clone/core-unit/Unit';
import UnitImprovement from '@civ-clone/core-unit-improvement/UnitImprovement';
import Veteran from '@civ-clone/base-unit-improvement-veteran/UnitImprovements/Veteran';
import { instance as randomNumberGeneratorInstance } from '@civ-clone/core-random';
import strength from '@civ-clone/core-unit/strength';

export interface VeteranPromotionDependencies {
  ruleRegistry?: RuleRegistry;
  unitImprovementRegistry?: UnitImprovementRegistry;
  randomNumberGenerator?: () => number;
}

/** The strengths a battle was fought at, as `[attack, defence]`. */
export type BattleStrengths = (
  attacker: Unit,
  defender: Unit,
  action: Action
) => [attack: number, defence: number];

export interface VeteranPromotionOptions {
  /** The `Defeated` rule's id. */
  id?: string;
  /** The improvement a promoted unit gains, and that a unit already promoted has. `Veteran` by default. */
  Improvement?: typeof UnitImprovement;
  /** Whether a unit can ever be promoted: by default, any but a single-use unit (`SingleUse`). */
  canPromote?: (unit: Unit) => boolean;
  /**
   * The strengths the battle was fought at: by default `strength`'s, with the attack scaled by the share of a full
   *  attack the attacker had the moves for, as base-unit-action-attack fights it.
   */
  strengths?: BattleStrengths;
  /**
   * How many whole steps a strength of 1 counts as when the chance is worked out (see `strengthChance`), as
   *  base-combat-rounds' `strengthScale` rolls them.
   */
  strengthScale: number;
}

/**
 * The strengths of a battle as `Attack` fought it: `strength`'s attack and defence, the attack times
 *  `min(1, moves)`. Asked while `Defeated` is processed, before the attacker spends its moves.
 */
export const attackStrengths =
  (ruleRegistry: RuleRegistry): BattleStrengths =>
  (attacker: Unit, defender: Unit): [number, number] => {
    const [attack, defence] = strength(attacker, defender, ruleRegistry);

    return [
      attack.value() * Math.min(1, attacker.moves().value()),
      defence.value(),
    ];
  };

/**
 * The chance of promotion for the winner (OpenCiv2, `unit_resolve_attack_veterans`): with the strengths as whole
 *  numbers at `strengthScale` steps to 1 (truncated), a roll below `A + D` that is at most the loser's strength, so
 *  `(loser + 1) / (A + D)`: the weaker the loser, the less a win teaches. Always when `A + D` is 1 or less, where the
 *  original rolls 0.
 */
export const strengthChance = (
  attack: number,
  defence: number,
  attackerWon: boolean,
  strengthScale: number
): number => {
  const attackSteps = Math.max(0, Math.trunc(attack * strengthScale)),
    defenceSteps = Math.max(0, Math.trunc(defence * strengthScale)),
    total = attackSteps + defenceSteps;

  if (!(total > 1)) {
    return 1;
  }

  return Math.min(1, ((attackerWon ? defenceSteps : attackSteps) + 1) / total);
};

/** The defeat came from a battle: `action` is one side's attack on the other. */
export const isBattle = (loser: Unit, winner: Unit, action?: Action) =>
  action !== undefined && (action.unit() === winner || action.unit() === loser);

/**
 * A `Defeated` rule that may promote the winner of a battle, with the chance `PromotionChance` gives or, with no
 *  answer, `strengthChance`. A promoted unit gains `Improvement` and `Promoted` is processed. A destroyed winner, one
 *  already promoted, and one `canPromote` refuses are left as they are, and draw no number; nor does a chance of 0 or
 *  1.
 *
 * It has `High` priority, so that it reads both units' strengths before a game's own `Defeated` rules destroy the
 *  loser (and take its improvements). A game whose destroying rule is `High` too registers this one first.
 */
export const veteranPromotionRules = (
  {
    ruleRegistry = ruleRegistryInstance,
    unitImprovementRegistry = unitImprovementRegistryInstance,
    randomNumberGenerator = randomNumberGeneratorInstance,
  }: VeteranPromotionDependencies = {},
  {
    id,
    Improvement = Veteran,
    canPromote = (unit: Unit): boolean => !unit.hasTrait(SingleUse),
    strengths = attackStrengths(ruleRegistry),
    strengthScale,
  }: VeteranPromotionOptions
): Defeated[] => {
  const promoted = (unit: Unit): boolean =>
    unitImprovementRegistry
      .getByUnit(unit)
      .some(
        (unitImprovement: UnitImprovement): boolean =>
          unitImprovement instanceof Improvement
      );

  return [
    new Defeated(
      ...((id === undefined ? [] : [id]) as string[]),
      new High(),
      new Criterion(isBattle),
      new Criterion(
        (loser: Unit, winner: Unit): boolean => !winner.destroyed()
      ),
      new Criterion((loser: Unit, winner: Unit): boolean => canPromote(winner)),
      new Criterion((loser: Unit, winner: Unit): boolean => !promoted(winner)),
      new Effect((loser: Unit, winner: Unit, action: Action): void => {
        const answer = ruleRegistry
          .process(PromotionChance, winner, loser, action)
          .find((chance: number | undefined): boolean => chance !== undefined);

        let chance = answer;

        if (chance === undefined) {
          const attackerWon = action.unit() === winner,
            [attack, defence] = attackerWon
              ? strengths(winner, loser, action)
              : strengths(loser, winner, action);

          chance = strengthChance(attack, defence, attackerWon, strengthScale);
        }

        if (!(chance > 0)) {
          return;
        }

        if (chance < 1 && randomNumberGenerator() >= chance) {
          return;
        }

        unitImprovementRegistry.register(new Improvement(winner));

        ruleRegistry.process(Promoted, winner, loser, action);
      })
    ),
  ];
};

export default veteranPromotionRules;
