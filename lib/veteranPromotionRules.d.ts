import { RuleRegistry } from '@civ-clone/core-rule/RuleRegistry';
import { UnitImprovementRegistry } from '@civ-clone/core-unit-improvement/UnitImprovementRegistry';
import Action from '@civ-clone/core-unit/Action';
import Defeated from '@civ-clone/core-unit/Rules/Defeated';
import Unit from '@civ-clone/core-unit/Unit';
import UnitImprovement from '@civ-clone/core-unit-improvement/UnitImprovement';
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
   *  attack the attacker had the moves for, as base-unit-action-attack fights it. A game that fights with
   *  base-combat-rounds passes its `roundsStrengths`, which also applies `CombatModifiers`.
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
export declare const attackStrengths: (
  ruleRegistry: RuleRegistry
) => BattleStrengths;
/**
 * The chance of promotion for the winner (OpenCiv2, `unit_resolve_attack_veterans`): with the strengths as whole
 *  numbers at `strengthScale` steps to 1 (truncated), a roll below `A + D` that is at most the loser's strength, so
 *  `(loser + 1) / (A + D)`: the weaker the loser, the less a win teaches. Always when `A + D` is 1 or less, where the
 *  original rolls 0.
 */
export declare const strengthChance: (
  attack: number,
  defence: number,
  attackerWon: boolean,
  strengthScale: number
) => number;
/** The defeat came from a battle: `action` is one side's attack on the other. */
export declare const isBattle: (
  loser: Unit,
  winner: Unit,
  action?: Action
) => boolean;
/**
 * A `Defeated` rule that may promote the winner of a battle, with the chance `PromotionChance` gives or, with no
 *  answer, `strengthChance`. A promoted unit gains `Improvement` and `Promoted` is processed. A destroyed winner, one
 *  already promoted, and one `canPromote` refuses are left as they are, and draw no number; nor does a chance of 0 or
 *  1.
 *
 * It has `High` priority, so that it reads both units' strengths before a game's own `Defeated` rules destroy the
 *  loser (and take its improvements). A game whose destroying rule is `High` too registers this one first.
 */
export declare const veteranPromotionRules: (
  {
    ruleRegistry,
    unitImprovementRegistry,
    randomNumberGenerator,
  }: VeteranPromotionDependencies | undefined,
  {
    id,
    Improvement,
    canPromote,
    strengths,
    strengthScale,
  }: VeteranPromotionOptions
) => Defeated[];
export default veteranPromotionRules;
