import { Attack as AttackYield, Defence } from '@civ-clone/core-unit/Yields';
import { PromotionChance, Promoted } from '../lib/Rules';
import veteranPromotionRules, {
  strengthChance,
} from '../lib/veteranPromotionRules';
import Action from '@civ-clone/core-unit/Action';
import Attack from '@civ-clone/base-unit-action-attack/Attack';
import Criterion from '@civ-clone/core-rule/Criterion';
import Defeated from '@civ-clone/core-unit/Rules/Defeated';
import Effect from '@civ-clone/core-rule/Effect';
import Generator from '@civ-clone/core-world-generator/Generator';
import Player from '@civ-clone/core-player/Player';
import RuleRegistry from '@civ-clone/core-rule/RuleRegistry';
import SingleUse from '@civ-clone/base-unit-trait-single-use/SingleUse';
import Terrain from '@civ-clone/core-terrain/Terrain';
import Tile from '@civ-clone/core-world/Tile';
import Unit from '@civ-clone/core-unit/Unit';
import UnitImprovementRegistry from '@civ-clone/core-unit-improvement/UnitImprovementRegistry';
import UnitRegistry from '@civ-clone/core-unit/UnitRegistry';
import Veteran from '@civ-clone/base-unit-improvement-veteran/UnitImprovements/Veteran';
import World from '@civ-clone/core-world/World';
import { Yield as YieldRule } from '@civ-clone/core-unit/Rules/Yield';
import YieldValue from '@civ-clone/core-yield/Yield';
import { expect } from 'chai';
import { unitTraits } from '@civ-clone/core-unit/Rules/UnitTraits';

// The chance follows OpenCiv2 (github.com/richardpenman/civ2, read at 49f26ec), `unit_resolve_attack_veterans`: the
//  winner becomes a veteran with a chance of the loser's strength over both sides' (`rand % (A + D) <= loser`), always
//  with a wonder the game names; never for a unit destroyed after attacking (`unit_promote_veteran`), nor one already veteran.

class Expendable extends Unit {}

const scripted = (...values: number[]) => {
  const draws: number[] = [];

  return {
    draws,
    rng: (): number => {
      if (draws.length >= values.length) {
        throw new Error('Drew more numbers than were scripted.');
      }

      draws.push(values[draws.length]);

      return values[draws.length - 1];
    },
  };
};

const setUp = (...values: number[]) => {
  const ruleRegistry = new RuleRegistry(),
    unitRegistry = new UnitRegistry(),
    unitImprovementRegistry = new UnitImprovementRegistry(),
    world = new World(new Generator(2, 1)),
    from = new Tile(0, 0, new Terrain(), world),
    to = new Tile(1, 0, new Terrain(), world),
    stats = new Map<Unit, [number, number]>(),
    events: [string, ...any[]][] = [],
    { draws, rng } = scripted(...values),
    unit = (
      tile: Tile,
      attack: number,
      defence: number,
      moves: number = 1,
      Type: typeof Unit = Unit
    ): Unit => {
      const created = new Type(null, new Player(), tile, ruleRegistry);

      stats.set(created, [attack, defence]);
      created.moves().set(moves);
      unitRegistry.register(created);

      return created;
    };

  ruleRegistry.register(
    new YieldRule(
      new Criterion((unit: Unit): boolean => stats.has(unit)),
      new Effect((unit: Unit, unitYield: YieldValue): void => {
        const [attack, defence] = stats.get(unit)!,
          // A veteran fights at 1.5 times.
          modifier = unitImprovementRegistry
            .getByUnit(unit)
            .some((improvement) => improvement instanceof Veteran)
            ? 1.5
            : 1;

        if (unitYield instanceof AttackYield) {
          unitYield.set(attack * modifier);
        }

        if (unitYield instanceof Defence) {
          unitYield.set(defence * modifier);
        }
      })
    ),
    ...unitTraits('test:unit/trait', Expendable, SingleUse),
    // As a game's own rule does, at normal priority: the loser is destroyed and loses its improvements.
    new Defeated(
      new Effect((loser: Unit): void => {
        events.push(['destroyed', loser]);
        loser.setDestroyed();
        unitImprovementRegistry.unregister(
          ...unitImprovementRegistry.getByUnit(loser)
        );
      })
    ),
    new Promoted(
      new Effect((promoted: Unit, loser: Unit, action: Action): void => {
        events.push(['promoted', promoted, loser, action]);
      })
    ),
    ...veteranPromotionRules(
      { ruleRegistry, unitImprovementRegistry, randomNumberGenerator: rng },
      { id: 'test:unit/defeated/promotion' }
    )
  );

  const veteran = (unit: Unit): boolean =>
      unitImprovementRegistry
        .getByUnit(unit)
        .some((improvement) => improvement instanceof Veteran),
    // An attack (base-unit-action-attack's single roll) that the attacker wins or loses; it has its own generator.
    attack = (attacker: Unit, attackerWins: boolean) =>
      new Attack(
        from,
        to,
        attacker,
        ruleRegistry,
        unitRegistry,
        scripted(...(attackerWins ? [1, 0] : [0, 1])).rng
      );

  return {
    attack,
    draws,
    events,
    from,
    ruleRegistry,
    to,
    unit,
    unitImprovementRegistry,
    veteran,
  };
};

describe('veteranPromotionRules', (): void => {
  describe('strengthChance', (): void => {
    it("should be the loser's strength over both sides' (`unit_resolve_attack_veterans`)", (): void => {
      expect(strengthChance(3, 1, true)).to.equal(1 / 4);
      expect(strengthChance(3, 1, false)).to.equal(3 / 4);
      expect(strengthChance(0, 0, true)).to.equal(0);
    });
  });

  it('should promote an attacker that beats a weaker defender a quarter of the time (3 v 1)', (): void => {
    const lucky = setUp(0.2),
      winner = lucky.unit(lucky.from, 3, 1),
      loser = lucky.unit(lucky.to, 1, 1),
      action = lucky.attack(winner, true);

    action.perform();

    expect(lucky.veteran(winner)).to.equal(true);
    expect(lucky.draws).to.deep.equal([0.2]);
    expect(lucky.events).to.deep.equal([
      ['promoted', winner, loser, action],
      ['destroyed', loser],
    ]);

    const unlucky = setUp(0.25),
      other = unlucky.unit(unlucky.from, 3, 1);

    unlucky.unit(unlucky.to, 1, 1);
    unlucky.attack(other, true).perform();

    expect(unlucky.veteran(other)).to.equal(false);
  });

  it("should promote a defender that wins with the attacker's share (3 v 1: three quarters)", (): void => {
    const { attack, draws, from, to, unit, veteran } = setUp(0.7),
      attacker = unit(from, 3, 1),
      defender = unit(to, 1, 1);

    attack(attacker, false).perform();

    expect(draws).to.deep.equal([0.7]);
    expect(veteran(defender)).to.equal(true);
  });

  it("should read the loser's strength before a game's own rules destroy it", (): void => {
    // A veteran defender (1 × 1.5) loses to 1.5: a chance of 0.5, where after the loser lost its improvements it would be 0.4.
    const { attack, from, to, unit, unitImprovementRegistry, veteran } =
        setUp(0.45),
      attacker = unit(from, 1.5, 1),
      defender = unit(to, 1, 1);

    unitImprovementRegistry.register(new Veteran(defender));

    attack(attacker, true).perform();

    expect(veteran(attacker)).to.equal(true);
  });

  it('should scale the attack by the share of a move the attacker had', (): void => {
    // 2 attack with half a move fights at 1, against 1: the defender wins with a chance of 1 / 2, not 2 / 3.
    const { attack, from, to, unit, veteran } = setUp(0.55),
      attacker = unit(from, 2, 1, 0.5),
      defender = unit(to, 1, 1);

    attack(attacker, false).perform();

    expect(veteran(defender)).to.equal(false);
  });

  it('should take the first `PromotionChance` answer, and draw nothing at 1', (): void => {
    const { attack, draws, from, ruleRegistry, to, unit, veteran } = setUp(),
      attacker = unit(from, 9, 1),
      defender = unit(to, 1, 1);

    ruleRegistry.register(
      new PromotionChance(
        new Criterion((): boolean => false),
        new Effect(() => 0)
      ),
      new PromotionChance(new Effect((): number => 1))
    );

    attack(attacker, true).perform();

    expect(draws).to.deep.equal([]);
    expect(veteran(attacker)).to.equal(true);
    expect(defender.destroyed()).to.equal(true);
  });

  it('should leave a unit already promoted, a single-use unit and a destroyed winner alone, with no draws', (): void => {
    const already = setUp(),
      veteranUnit = already.unit(already.from, 3, 1);

    already.unit(already.to, 1, 1);
    already.unitImprovementRegistry.register(new Veteran(veteranUnit));
    already.attack(veteranUnit, true).perform();

    expect(already.draws).to.deep.equal([]);
    expect(
      already.unitImprovementRegistry.getByUnit(veteranUnit).length
    ).to.equal(1);

    const singleUse = setUp(),
      expendable = singleUse.unit(singleUse.from, 3, 1, 1, Expendable);

    singleUse.unit(singleUse.to, 1, 1);
    singleUse.attack(expendable, true).perform();

    expect(singleUse.draws).to.deep.equal([]);
    expect(singleUse.veteran(expendable)).to.equal(false);

    const destroyed = setUp(),
      winner = destroyed.unit(destroyed.from, 3, 1);

    destroyed.unit(destroyed.to, 1, 1);
    winner.setDestroyed();
    destroyed.attack(winner, true).perform();

    expect(destroyed.draws).to.deep.equal([]);
  });

  it('should ignore a defeat that was not a battle', (): void => {
    const { draws, ruleRegistry, from, to, unit, veteran } = setUp(),
      winner = unit(from, 3, 1),
      loser = unit(to, 1, 1);

    ruleRegistry.process(Defeated, loser, winner);

    expect(draws).to.deep.equal([]);
    expect(veteran(winner)).to.equal(false);
  });
});
