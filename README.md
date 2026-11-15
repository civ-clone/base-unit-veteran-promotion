# base-unit-veteran-promotion

Promotion after a win: the winner of a battle may gain the `Veteran` improvement. A library: nothing registers on
import.

## API

Deep-import the modules; there is no index.

- `lib/veteranPromotionRules`:
  - `veteranPromotionRules({ ruleRegistry, unitImprovementRegistry, randomNumberGenerator }, { id?, Improvement?,
    canPromote?, strengths? }): Defeated[]`, one `Defeated` rule. When a unit wins a battle (`action` is one side's
    attack on the other), it gains `Improvement` (`Veteran` by default) with the chance below, and `Promoted` is
    processed.
  - Left alone, with no number drawn: a destroyed winner, one that already has `Improvement`, and one `canPromote`
    refuses (by default, a unit with the `SingleUse` trait). A chance of 0 or 1 draws nothing either.
  - The chance is the first `PromotionChance` answer that isn't `undefined`; with none, `strengthChance`: the loser's
    strength over both sides', `loser / (attack + defence)`. The strengths are `strengths(attacker, defender, action)`,
    by default `attackStrengths`: core-unit's `strength`, the attack times `min(1, moves)`, as base-unit-action-attack
    fights.
  - The rule has `High` priority, so it reads the strengths before a game's own `Defeated` rules destroy the loser and
    take its improvements. A game whose destroying rule is `High` too registers this one first.
- `lib/Rules`:
  - `PromotionChance(winner, loser, action) → number`, for a game to set the chance (1 always promotes).
  - `Promoted(unit, loser, action)`, for a notice to the unit's player.

## The chance

OpenCiv2 (github.com/richardpenman/civ2, read at 49f26ec, `unit_resolve_attack_veterans`) promotes when
`rand % (A + D) <= loser`, over whole-number strengths at 8 steps to 1: that is `(loser + 1) / (A + D)` at that scale,
a little above `loser / (A + D)` (9/16 rather than 1/2 for 1 against 1). This package uses `loser / (A + D)`, as the M2
survey states it; a game that wants the original's off-by-one can answer `PromotionChance`.
