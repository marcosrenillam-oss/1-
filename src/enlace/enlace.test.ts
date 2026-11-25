import { describe, expect, it } from 'vitest';
import { aiStep, buildLevel, levelInfo, starsFor, think, TOTAL_LEVELS } from './levels';
import { finishLevel, nextLevel } from './record';
import { canLink, cut, link, nodeR, slots, update } from './sim';
import { emptySave, normalize } from '../storage/persistence';

describe('Enlace', () => {
  it('has 300 levels that always build the same and are well formed', () => {
    expect(TOTAL_LEVELS).toBe(300);
    expect(JSON.stringify(buildLevel(37))).toBe(JSON.stringify(buildLevel(37)));
    for (let n = 1; n <= TOTAL_LEVELS; n++) {
      const g = buildLevel(n);
      const info = levelInfo(n);
      expect(g.nodes.filter((x) => x.owner === 1).length, `level ${n}`).toBeGreaterThanOrEqual(1);
      for (let o = 2; o < 2 + info.enemies; o++) expect(g.nodes.some((x) => x.owner === o), `level ${n} faction ${o}`).toBe(true);
      for (let i = 0; i < g.nodes.length; i++) {
        const a = g.nodes[i];
        expect(a.value).toBeGreaterThan(0);
        for (let j = i + 1; j < g.nodes.length; j++) expect(Math.hypot(a.x - g.nodes[j].x, a.y - g.nodes[j].y)).toBeGreaterThan(nodeR(a));
      }
    }
  });

  it('a trace costs energy, flows and captures; cutting fires the far part at the target', () => {
    const g = buildLevel(1);
    const me = g.nodes.find((n) => n.owner === 1)!;
    const target = g.nodes.filter((n) => n.owner === 0).sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
    const before = me.value;
    expect(canLink(g, me, target, 1)).toBe(true);
    const l = link(g, me, target, 1)!;
    for (let k = 0; k < 20; k++) update(g, 0.05);
    expect(me.value).toBeLessThan(before + 1);
    for (let k = 0; k < 400 && target.owner !== 1; k++) update(g, 0.05);
    expect(target.owner).toBe(1);
    // Cut a trace to an enemy: part of the invested energy hits it.
    const enemy = g.nodes.find((n) => n.owner === 2)!;
    me.value = 100;
    const l2 = link(g, me, enemy, 1)!;
    for (let k = 0; k < 200 && l2.state !== 'on'; k++) update(g, 0.05);
    const hp = enemy.value;
    cut(g, l2, 0.1);
    expect(enemy.value).toBeLessThan(hp);
    expect(g.links).not.toContain(l2);
    expect(l).toBeTruthy();
  });

  it('more energy means more trace slots', () => {
    const g = buildLevel(1);
    const me = g.nodes.find((n) => n.owner === 1)!;
    me.value = 10;
    expect(slots(me)).toBe(1);
    me.value = 60;
    expect(slots(me)).toBe(3);
  });

  it('the viruses play: a passive player eventually loses', () => {
    const g = buildLevel(30);
    for (let k = 0; k < 20 * 600 && !g.over; k++) {
      update(g, 0.05);
      aiStep(g, 0.05);
    }
    expect(g.over).toBe(2);
  });

  it('an active player can win the first levels', () => {
    for (const n of [1, 2, 3]) {
      const g = buildLevel(n);
      let t = 0;
      for (let k = 0; k < 20 * 600 && !g.over; k++) {
        update(g, 0.05);
        aiStep(g, 0.05);
        t -= 0.05;
        if (t <= 0) {
          t = 0.8;
          think(g, 1);
        }
      }
      expect(g.over, `level ${n}`).toBe(1);
    }
  });

  it('stars, energy and progress are saved', () => {
    let save = emptySave();
    expect(nextLevel(save)).toBe(1);
    const fast = finishLevel(save, 1, true, 10);
    expect(fast.result.stars).toBe(3);
    expect(fast.result.energy).toBeGreaterThan(0);
    save = fast.save;
    expect(nextLevel(save)).toBe(2);
    expect(save.core.energy).toBe(fast.result.energy);
    const again = finishLevel(save, 1, true, 5);
    expect(again.result.newStars).toBe(0);
    expect(again.result.energy).toBe(0);
    expect(starsFor(1, 1e4)).toBe(1);
    const back = normalize(JSON.parse(JSON.stringify(save)));
    expect(back.enlace.stars[1]).toBe(3);
    expect(normalize({ version: 2 }).enlace.stars).toEqual({});
  });
});
