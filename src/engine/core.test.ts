import { describe, expect, it } from 'vitest';
import {
  addEnergy, BOARD_COST, buyOrEquip, COLORS, coreLevel, emptyCore, energyForAnswer, expand, normalizeCore, place, placeCost, upgrade, upgradeCost,
} from './core';
import { abandonRun, startRun, submitAnswer } from './game';
import { getQuestion } from '../data/questions';
import { seededRng } from './rng';
import { emptySave, normalize } from '../storage/persistence';

const rich = (n = 1e6) => {
  const c = emptyCore();
  addEnergy(c, n);
  return c;
};

describe('El Núcleo (cosmetic chip)', () => {
  it('energy grows with difficulty and streak', () => {
    expect(energyForAnswer(7, 1)).toBeGreaterThan(energyForAnswer(1, 1));
    expect(energyForAnswer(3, 10)).toBeGreaterThan(energyForAnswer(3, 5));
    expect(energyForAnswer(3, 5)).toBeGreaterThan(energyForAnswer(3, 1));
  });

  it('place, upgrade to 3 and refuse when broke or occupied', () => {
    let c = rich();
    const cost = placeCost(c, 'nucleo');
    c = place(c, 0, 'nucleo')!;
    expect(c.slots[0]).toEqual({ m: 'nucleo', lvl: 1 });
    expect(c.energy).toBe(1e6 - cost);
    expect(place(c, 0, 'antena')).toBeNull();
    c = upgrade(c, 0)!;
    c = upgrade(c, 0)!;
    expect(c.slots[0]!.lvl).toBe(3);
    expect(upgradeCost(c, 0)).toBeNull();
    expect(place(emptyCore(), 0, 'nucleo')).toBeNull();
  });

  it('costs rise as the chip fills, and the board only grows when full', () => {
    let c = rich();
    const first = placeCost(c, 'nucleo');
    for (let i = 0; i < 8; i++) c = place(c, i, 'memoria')!;
    expect(placeCost(c, 'nucleo')).toBeGreaterThan(first);
    expect(expand(c)).toBeNull();
    c = place(c, 8, 'reactor')!;
    const before = c.energy;
    c = expand(c)!;
    expect(c.board).toBe(4);
    expect(c.slots).toHaveLength(16);
    expect(c.energy).toBe(before - BOARD_COST[4]);
    expect(c.slots[0]!.m).toBe('memoria');
    expect(c.slots[4 * 2 + 2]!.m).toBe('reactor');
    expect(c.slots.filter(Boolean)).toHaveLength(9);
  });

  it('buys once, then equips for free', () => {
    let c = rich(10_000);
    const azul = COLORS.find((x) => x.id === 'azul')!;
    c = buyOrEquip(c, 'color', 'azul')!;
    expect(c.color).toBe('azul');
    expect(c.energy).toBe(10_000 - azul.cost);
    c = buyOrEquip(c, 'color', 'lima')!;
    c = buyOrEquip(c, 'color', 'azul')!;
    expect(c.energy).toBe(10_000 - azul.cost);
    expect(buyOrEquip(emptyCore(), 'color', 'arcoiris')).toBeNull();
  });

  it('level grows with energy spent', () => {
    const c = rich(5000);
    expect(coreLevel(c)).toBe(1);
    expect(coreLevel(buyOrEquip(c, 'color', 'azul')!)).toBeGreaterThan(1);
  });

  it('normalize repairs corrupt data and old saves get an empty chip', () => {
    const c = normalizeCore({ energy: -5, board: 9, slots: [{ m: 'x', lvl: 1 }, { m: 'antena', lvl: 2 }], color: 'arcoiris', owned: ['azul'] });
    expect(c.energy).toBe(0);
    expect(c.board).toBe(3);
    expect(c.slots[0]).toBeNull();
    expect(c.slots[1]).toEqual({ m: 'antena', lvl: 2 });
    expect(c.color).toBe('lima');
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
