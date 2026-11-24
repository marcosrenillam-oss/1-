import { describe, expect, it } from 'vitest';
import { CATALOGUE_SIZE, choose, GLOBAL_CARDS, MAX_DEFENDERS, offer, PACT_CARDS, STAT_CARDS, addDefender } from './cards';
import { DEF_KINDS, EVOS, evoOptions } from './defenders';
import { finishInvasion } from './record';
import { energyFor, newGame, rand, restore, snapshot, tap, update } from './sim';
import type { Game } from './types';
import { emptySave, normalize } from '../storage/persistence';

function play(g: Game, seconds: number, pick = (o: ReturnType<typeof offer>) => o[0]) {
  for (let t = 0; t < seconds && !g.over; t += 1 / 30) {
    while (g.pending > 0) choose(g, pick(offer(g, () => rand(g))));
    update(g, 1 / 30);
  }
}

describe('Invasión', () => {
  it('has more than 100 different upgrades', () => {
    expect(CATALOGUE_SIZE).toBeGreaterThanOrEqual(100);
    const ids = [...STAT_CARDS.map((c) => c.id), ...GLOBAL_CARDS.map((c) => c.id), ...PACT_CARDS.map((c) => c.id), ...EVOS.map((e) => e.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every defender evolves twice, choosing between two paths each time', () => {
    for (const k of DEF_KINDS) {
      const t1 = EVOS.filter((e) => e.kind === k && e.tier === 1);
      expect(t1).toHaveLength(2);
      for (const p of t1) expect(EVOS.filter((e) => e.parent === p.id)).toHaveLength(2);
    }
    const g = newGame(1);
    const d = g.defenders[0];
    expect(evoOptions(d)).toHaveLength(0);
    d.lvl = 3;
    const o = offer(g, () => rand(g));
    expect(o).toHaveLength(2);
    expect(o.every((c) => c.kind === 'evo')).toBe(true);
    choose(g, o[1]);
    expect(d.evo).toHaveLength(1);
    expect(offer(g, () => rand(g)).some((c) => c.kind === 'evo')).toBe(false);
    d.lvl = 7;
    const o2 = offer(g, () => rand(g));
    expect(o2.every((c) => c.kind === 'evo' && EVOS.find((e) => e.id === c.id)!.parent === d.evo[0])).toBe(true);
  });

  it('every upgrade applies cleanly to every defender type', () => {
    const g = newGame(2);
    for (const k of DEF_KINDS) addDefender(g, k);
    for (const c of [...GLOBAL_CARDS, ...PACT_CARDS]) if (!c.ok || c.ok(g)) c.apply(g);
    for (const d of g.defenders) {
      for (const s of STAT_CARDS) if (!s.kinds || s.kinds.includes(d.kind)) s.apply(d.stats);
      for (const e of EVOS.filter((x) => x.kind === d.kind)) e.apply(d.stats, d.flags);
      for (const v of Object.values(d.stats)) expect(Number.isFinite(v)).toBe(true);
    }
    play(g, 40);
    expect(g.t).toBeGreaterThan(5);
  });

  it('waves keep coming; upgrades make the viruses tougher; it never breaks', () => {
    const g = newGame(3, 200, 400);
    let r = 3;
    play(g, 240, (o) => o[(r = (r * 16807) % 2147483647) % o.length]);
    expect(g.wave).toBeGreaterThanOrEqual(5);
    expect(g.kills).toBeGreaterThan(50);
    expect(g.taken.length).toBeGreaterThan(3);
    expect(g.g.enemyHp).toBeGreaterThan(1);
    expect(g.defenders.length).toBeLessThanOrEqual(MAX_DEFENDERS);
    for (const v of g.viruses) expect(Number.isFinite(v.hp) && Number.isFinite(v.x)).toBe(true);
  });

  it('a core left alone eventually falls', () => {
    const g = newGame(4);
    g.defenders = [];
    for (let t = 0; t < 600 && !g.over; t += 1 / 30) update(g, 1 / 30);
    expect(g.over).toBe(true);
    expect(g.hp).toBe(0);
  });

  it('tapping damages viruses near the finger and then recharges', () => {
    const g = newGame(5);
    g.wave = 1;
    g.viruses.push({ ...JSON.parse(JSON.stringify({ id: 999, type: 'basico', x: 100, y: 0, r: 9, hp: 5, max: 5, shield: 0, speed: 0, armor: 0, dmg: 5, xp: 1, boss: false, elite: false, gen: 0, slowF: 0, slowT: 0, burn: 0, burnT: 0, flash: 0, spin: 0, kb: 0, t: 0, timer: 99, hidden: false, dead: false, hits: {} })) });
    expect(tap(g, 100, 0)).toBe(true);
    expect(g.kills).toBe(1);
    expect(tap(g, 100, 0)).toBe(false);
  });

  it('a saved wave restores the same build', () => {
    const g = newGame(6);
    play(g, 60);
    const snap = JSON.parse(JSON.stringify(snapshot(g)));
    const back = restore(snap, 300);
    expect(back.wave).toBe(g.wave - 1);
    expect(back.defenders.map((d) => [d.kind, d.lvl, d.evo])).toEqual(g.defenders.map((d) => [d.kind, d.lvl, d.evo]));
    expect(back.g.dmgMul).toBe(g.g.dmgMul);
    play(back, 10);
    expect(back.wave).toBeGreaterThanOrEqual(snap.wave + 1);
  });

  it('finishing stores records, gives energy to the chip and clears the saved game', () => {
    const g = newGame(7);
    play(g, 90);
    let save = emptySave();
    save.invasion.run = snapshot(g);
    const { save: after, result } = finishInvasion(save, g);
    expect(result.energy).toBe(energyFor(g));
    expect(after.core.energy).toBe(result.energy);
    expect(after.invasion.bestWave).toBe(g.wave);
    expect(after.invasion.run).toBeNull();
    save = normalize(JSON.parse(JSON.stringify({ ...after, invasion: { ...after.invasion, run: snapshot(g) } })));
    expect(save.invasion.run?.wave).toBe(g.wave - 1);
    expect(normalize({ version: 2 }).invasion.bestWave).toBe(0);
  });
});
