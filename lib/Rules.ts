import Action from '@civ-clone/core-unit/Action';
import Rule from '@civ-clone/core-rule/Rule';
import Unit from '@civ-clone/core-unit/Unit';

/**
 * The chance, from 0 to 1, that `winner` is promoted for defeating `loser` in `action`. The first answer that isn't
 *  `undefined` is used; with none, the chance is the loser's strength over both sides' (see `strengthChance`).
 *
 * A rule declines through its `Criterion`, not by returning `undefined`, as with core-unit's other answering rules.
 */
export class PromotionChance extends Rule<
  [winner: Unit, loser: Unit, action: Action],
  number
> {}

/** `unit` was promoted for defeating `loser` in `action`: for a notice to its player. */
export class Promoted extends Rule<
  [unit: Unit, loser: Unit, action: Action],
  void
> {}
