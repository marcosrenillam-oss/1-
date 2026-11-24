import { describe, expect, it } from 'vitest';
import {
  addEnergy, buyOrEquip, CHIP_MAX, CHIP_TIERS, COLORS, emptyCore, energyForAnswer, evolve, evolveInfo, MAX_MODULE_LEVEL, MODULES, normalizeCore, ownKey,
  place, placeCost, SPREAD, tierOf, upgrade, upgradeInfo, type CoreState,
} from './core';
import { abandonRun, startRun, submitAnswer } from './game';
import { getQuestion } from '../data/questions';
import { seededRng } from './rng';
import { emptySave, normalize } from '../storage/persistence';

const rich = (n = 1e7) => {
  const c = emptyCore();
  addEnergy(c, n);
  return c;
};
/** Fills every slot and raises every module to the current cap, evenly. */
function maxOut(c: CoreState): CoreState {
  c.slots.forEach((s, i) => {
    if (!s) c = place(c, i, 'nucleo')!;
  });
  const cap = tierOf(c.chip).cap;
  for (let lvl = 2; lvl <= cap; lvl++) c.slots.forEach((s, i) => {
    if (s!.lvl < lvl) c = upgrade(c, i)!;
  });
  return c;
}

describe('El Núcleo (cosmetic chip)', () => {
  it('energy grows with difficulty and streak', () => {
    expect(energyForAnswer(7, 1)).toBeGreaterThan(energyForAnswer(1, 1));
    expect(energyForAnswer(3, 10)).toBeGreaterThan(energyForAnswer(3, 5));
    expect(energyForAnswer(3, 5)).toBeGreaterThan(energyForAnswer(3, 1));
  });

  it('place and upgrade one level at a time; refuse when broke, occupied or locked', () => {
    let c = rich();
    const cost = placeCost('nucleo');
    c = place(c, 0, 'nucleo')!;
    expect(c.slots[0]).toEqual({ m: 'nucleo', lvl: 1 });
    expect(c.energy).toBe(1e7 - cost);
    expect(place(c, 0, 'antena')).toBeNull();
    expect(place(c, 1, 'holo')).toBeNull(); // needs chip 6
    expect(place(emptyCore(), 0, 'nucleo')).toBeNull();
    c = upgrade(c, 0)!;
    expect(c.slots[0]!.lvl).toBe(2);
    const a = upgradeInfo(c, 0)!.cost;
    c = upgrade(c, 0)!;
    expect(upgradeInfo(c, 0)!.cost).toBeGreaterThan(a);
  });

  it('the chip level caps module levels (chip 1 → level 4)', () => {
    let c = rich();
    c = place(c, 0, 'nucleo')!;
    for (let k = 0; k < 3; k++) c = upgrade(c, 0)!;
    expect(c.slots[0]!.lvl).toBe(4);
    expect(upgradeInfo(c, 0)!.block).toEqual({ kind: 'chip', chip: 2 });
    expect(upgrade(c, 0)).toBeNull();
  });

  it(`a module can't get more than ${SPREAD} levels ahead of the others`, () => {
    let c = rich();
    c.chip = 4;
    c.slots = Array(tierOf(4).slots).fill(null);
    c = place(c, 0, 'nucleo')!;
    c = place(c, 1, 'memoria')!;
    for (let k = 0; k < SPREAD; k++) c = upgrade(c, 0)!;
    expect(c.slots[0]!.lvl).toBe(1 + SPREAD);
    expect(upgradeInfo(c, 0)!.block).toEqual({ kind: 'others', level: 2 });
    c = upgrade(c, 1)!;
    expect(upgrade(c, 0)!.slots[0]!.lvl).toBe(2 + SPREAD);
  });

  it('the chip evolves only with every slot full and every module at the cap', () => {
    let c = rich();
    expect(evolveInfo(c)!.ready).toBe(false);
    expect(evolve(c)).toBeNull();
    c = place(c, 0, 'nucleo')!;
    expect(evolve(c)).toBeNull();
    c = maxOut(c);
    const info = evolveInfo(c)!;
    expect(info.ready).toBe(true);
    const before = c.energy;
    c = evolve(c)!;
    expect(c.chip).toBe(2);
    expect(c.slots).toHaveLength(CHIP_TIERS[1].slots);
    expect(c.slots.filter(Boolean)).toHaveLength(CHIP_TIERS[0].slots);
    expect(c.energy).toBe(before - info.cost);
    expect(place(c, 6, 'cristal')).not.toBeNull(); // unlocked at chip 2
  });

  it('reaching level 10 needs the chip at 4; the chip tops out at 7', () => {
    let c = rich(1e9);
    while (c.chip < 4) c = evolve(maxOut(c))!;
    expect(tierOf(4).cap).toBe(MAX_MODULE_LEVEL);
    c = maxOut(c);
    expect(c.slots.every((s) => s!.lvl === MAX_MODULE_LEVEL)).toBe(true);
    expect(upgradeInfo(c, 0)!.block).toEqual({ kind: 'max' });
    while (c.chip < CHIP_MAX) c = evolve(maxOut(c))!;
    expect(c.slots).toHaveLength(25);
    expect(evolveInfo(c)).toBeNull();
    expect(MODULES.every((m) => place({ ...c, slots: [null] }, 0, m.id))).toBe(true);
  });

  it('cosmetics: locked by chip level, bought once, then equipped for free', () => {
    let c = rich(1e6);
    const azul = COLORS.find((x) => x.id === 'azul')!;
    c = buyOrEquip(c, 'color', 'azul')!;
    expect(c.color).toBe('azul');
    expect(c.energy).toBe(1e6 - azul.cost);
    c = buyOrEquip(c, 'color', 'lima')!;
    c = buyOrEquip(c, 'color', 'azul')!;
    expect(c.energy).toBe(1e6 - azul.cost);
    expect(buyOrEquip(c, 'color', 'arcoiris')).toBeNull(); // chip 7
    expect(buyOrEquip(c, 'pins', 'arcoiris')).toBeNull(); // chip 6
    expect(buyOrEquip(emptyCore(), 'color', 'azul')).toBeNull();
  });

  it('normalize repairs corrupt data, migrates the first chip and old saves get an empty chip', () => {
    const c = normalizeCore({ v: 2, energy: -5, chip: 99, slots: [{ m: 'x', lvl: 1 }, { m: 'antena', lvl: 12 }], color: 'arcoiris', owned: [] });
    expect(c.energy).toBe(0);
    expect(c.chip).toBe(CHIP_MAX);
    expect(c.slots[0]).toBeNull();
    expect(c.slots[1]).toEqual({ m: 'antena', lvl: 10 });
    expect(c.color).toBe('lima');
    const old = normalizeCore({ energy: 100, earned: 900, board: 4, slots: [{ m: 'nucleo', lvl: 3 }], owned: ['lima', 'azul', 'dorados'], color: 'azul', pins: 'dorados' });
    expect(old.energy).toBe(900);
    expect(old.chip).toBe(1);
    expect(old.slots.every((s) => s === null)).toBe(true);
    expect(old.color).toBe('azul');
    expect(old.owned).toContain(ownKey('pins', 'dorados'));
    expect(old.pins).toBe('dorados');
    expect(normalize({ version: 2 }).core).toEqual(emptyCore());
  });

  it('correct answers award energy, wrong ones keep it; the chip never changes the game', () => {
    let save = startRun(emptySave(), 'normal', seededRng(3));
    const ids = save.run!.ids;
    const run = save.run!;
    const q = getQuestion(run.ids[0])!;
    expect(q.kind ?? 'choice').toBeDefined();
    let total = 0;
    for (let i = 0; i < 3; i++) {
      const r = save.run!;
      const qq = getQuestion(r.ids[r.index])!;
      const resp = (qq.kind ?? 'choice') === 'choice' ? r.orders[r.index].indexOf(qq.answer)
        : qq.kind === 'order' ? qq.items!.join('|') : qq.kind === 'tap' ? String(qq.cell) : qq.kind === 'memory' ? qq.seq!.join(',') : qq.target!;
      const out = submitAnswer(save, resp);
      expect(out.kind).toBe('correct');
      if (out.kind === 'wrong') return;
      expect(out.earned).toBeGreaterThan(0);
      total += out.earned;
      save = out.save;
    }
    expect(save.core.energy).toBe(total);
    expect(save.run!.ids).toEqual(ids);
    const done = abandonRun(save)!;
    expect(done.save.core.energy).toBe(total);
  });
});
