"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.veteranPromotionRules = exports.isBattle = exports.strengthChance = exports.attackStrengths = void 0;
const Rules_1 = require("./Rules");
const RuleRegistry_1 = require("@civ-clone/core-rule/RuleRegistry");
const UnitImprovementRegistry_1 = require("@civ-clone/core-unit-improvement/UnitImprovementRegistry");
const Criterion_1 = require("@civ-clone/core-rule/Criterion");
const Defeated_1 = require("@civ-clone/core-unit/Rules/Defeated");
const Effect_1 = require("@civ-clone/core-rule/Effect");
const High_1 = require("@civ-clone/core-rule/Priorities/High");
const SingleUse_1 = require("@civ-clone/base-unit-trait-single-use/SingleUse");
const Veteran_1 = require("@civ-clone/base-unit-improvement-veteran/UnitImprovements/Veteran");
const core_random_1 = require("@civ-clone/core-random");
const strength_1 = require("@civ-clone/core-unit/strength");
/**
 * The strengths of a battle as `Attack` fought it: `strength`'s attack and defence, the attack times
 *  `min(1, moves)`. Asked while `Defeated` is processed, before the attacker spends its moves.
 */
const attackStrengths = (ruleRegistry) => (attacker, defender) => {
    const [attack, defence] = (0, strength_1.default)(attacker, defender, ruleRegistry);
    return [
        attack.value() * Math.min(1, attacker.moves().value()),
        defence.value(),
    ];
};
exports.attackStrengths = attackStrengths;
/**
 * The chance of promotion for the winner (OpenCiv2, `unit_resolve_attack_veterans`): with the strengths as whole
 *  numbers at `strengthScale` steps to 1 (truncated), a roll below `A + D` that is at most the loser's strength, so
 *  `(loser + 1) / (A + D)`: the weaker the loser, the less a win teaches. Always when `A + D` is 1 or less, where the
 *  original rolls 0.
 */
const strengthChance = (attack, defence, attackerWon, strengthScale) => {
    const attackSteps = Math.max(0, Math.trunc(attack * strengthScale)), defenceSteps = Math.max(0, Math.trunc(defence * strengthScale)), total = attackSteps + defenceSteps;
    if (!(total > 1)) {
        return 1;
    }
    return Math.min(1, ((attackerWon ? defenceSteps : attackSteps) + 1) / total);
};
exports.strengthChance = strengthChance;
/** The defeat came from a battle: `action` is one side's attack on the other. */
const isBattle = (loser, winner, action) => action !== undefined && (action.unit() === winner || action.unit() === loser);
exports.isBattle = isBattle;
/**
 * A `Defeated` rule that may promote the winner of a battle, with the chance `PromotionChance` gives or, with no
 *  answer, `strengthChance`. A promoted unit gains `Improvement` and `Promoted` is processed. A destroyed winner, one
 *  already promoted, and one `canPromote` refuses are left as they are, and draw no number; nor does a chance of 0 or
 *  1.
 *
 * It has `High` priority, so that it reads both units' strengths before a game's own `Defeated` rules destroy the
 *  loser (and take its improvements). A game whose destroying rule is `High` too registers this one first.
 */
const veteranPromotionRules = ({ ruleRegistry = RuleRegistry_1.instance, unitImprovementRegistry = UnitImprovementRegistry_1.instance, randomNumberGenerator = core_random_1.instance, } = {}, { id, Improvement = Veteran_1.default, canPromote = (unit) => !unit.hasTrait(SingleUse_1.default), strengths = (0, exports.attackStrengths)(ruleRegistry), strengthScale, }) => {
    const promoted = (unit) => unitImprovementRegistry
        .getByUnit(unit)
        .some((unitImprovement) => unitImprovement instanceof Improvement);
    return [
        new Defeated_1.default(...(id === undefined ? [] : [id]), new High_1.default(), new Criterion_1.default(exports.isBattle), new Criterion_1.default((loser, winner) => !winner.destroyed()), new Criterion_1.default((loser, winner) => canPromote(winner)), new Criterion_1.default((loser, winner) => !promoted(winner)), new Effect_1.default((loser, winner, action) => {
            const answer = ruleRegistry
                .process(Rules_1.PromotionChance, winner, loser, action)
                .find((chance) => chance !== undefined);
            let chance = answer;
            if (chance === undefined) {
                const attackerWon = action.unit() === winner, [attack, defence] = attackerWon
                    ? strengths(winner, loser, action)
                    : strengths(loser, winner, action);
                chance = (0, exports.strengthChance)(attack, defence, attackerWon, strengthScale);
            }
            if (!(chance > 0)) {
                return;
            }
            if (chance < 1 && randomNumberGenerator() >= chance) {
                return;
            }
            unitImprovementRegistry.register(new Improvement(winner));
            ruleRegistry.process(Rules_1.Promoted, winner, loser, action);
        })),
    ];
};
exports.veteranPromotionRules = veteranPromotionRules;
exports.default = exports.veteranPromotionRules;
//# sourceMappingURL=veteranPromotionRules.js.map