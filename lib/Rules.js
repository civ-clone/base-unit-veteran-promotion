"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Promoted = exports.PromotionChance = void 0;
const Rule_1 = require("@civ-clone/core-rule/Rule");
/**
 * The chance, from 0 to 1, that `winner` is promoted for defeating `loser` in `action`. The first answer that isn't
 *  `undefined` is used; with none, the chance is the loser's strength over both sides' (see `strengthChance`).
 *
 * A rule declines through its `Criterion`, not by returning `undefined`, as with core-unit's other answering rules.
 */
class PromotionChance extends Rule_1.default {
}
exports.PromotionChance = PromotionChance;
/** `unit` was promoted for defeating `loser` in `action`: for a notice to its player. */
class Promoted extends Rule_1.default {
}
exports.Promoted = Promoted;
//# sourceMappingURL=Rules.js.map