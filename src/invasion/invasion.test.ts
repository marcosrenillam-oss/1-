import { describe, expect, it } from 'vitest';
import { CATALOGUE_SIZE, chipReady, choose, refreshSynergies, fusablePairs, GLOBAL_CARDS, levelOf, MAX_DEFENDERS, offer, PACT_CARDS, placements, STAT_CARDS, addDefender, kindsOf, type Card } from './cards';
import { buyLab } from './record';
import { LAB, NEW_KINDS, startOpts } from './lab';
import { ALL_KINDS, BASE_KINDS, chipPos, CHIPS, DEF_KINDS, effectiveness, EVOS, evoOptions, MAX_CHIPS, SYNERGIES, ULTS } from './defenders';
import { finishInvasion } from './record';
import { energyFor, hit, MODS, newGame, rand, restore, snapshot, structs, update, WALL_R } from './sim';
import type { Game } from './types';
import { emptySave, normalize } from '../storage/persistence';

function play(g: Game, seconds: number, pick = (o: ReturnType<typeof offer>) => o[0]) {
  for (let t = 0; t < seconds && !g.over; t += 1 / 30) {
    while (g.pending > 0) choose(g, pick(offer(g, () => rand(g))));
    update(g, 1 / 30);
  }
}

describe('Invasión', () => {
  it('has well over 100 different upgrades and 18 main defender types', () => {
    expect(DEF_KINDS).toHaveLength(18);
    expect(CATALOGUE_SIZE).toBeGreaterThanOrEqual(250);
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
    g.defenders = [];
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

  it('never offers a defender type you already have', () => {
    const g = newGame(11, 300, 300, { unlocked: NEW_KINDS });
    for (let k = 0; k < 200; k++) {
      for (const c of offer(g, () => rand(g))) {
        if (c.kind !== 'new') continue;
        expect(g.defenders.flatMap(kindsOf)).not.toContain(c.id.slice(4));
      }
      const o = offer(g, () => rand(g));
      const n = o.find((c) => c.kind === 'new');
      if (n) choose(g, n);
    }
    const kinds = g.defenders.flatMap(kindsOf);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(g.defenders.length).toBeLessThanOrEqual(MAX_DEFENDERS);
  });

  it('synergies switch on when both defenders are on the ring', () => {
    const g = newGame(12);
    g.defenders = [];
    addDefender(g, 'hielo');
    expect(g.syn).toEqual([]);
    addDefender(g, 'rayo');
    expect(g.syn).toContain('superconductor');
    expect(g.events).toContain('syn:superconductor');
    for (const sy of SYNERGIES) expect(DEF_KINDS).toEqual(expect.arrayContaining([sy.a, sy.b]));
  });

  it('two fully evolved defenders fuse into a legendary one that does both jobs', () => {
    const g = newGame(13);
    g.defenders = [];
    const a = addDefender(g, 'laser');
    const b = addDefender(g, 'rayo');
    expect(fusablePairs(g)).toHaveLength(0);
    a.evo = ['prisma', 'abanico'];
    b.evo = ['cadena', 'arco'];
    expect(fusablePairs(g)).toHaveLength(1);
    let fusion;
    for (let k = 0; k < 50 && !fusion; k++) fusion = offer(g, () => rand(g)).find((c) => c.kind === 'fusion');
    expect(fusion?.title).toBe('Cañón de plasma');
    choose(g, fusion!);
    expect(g.defenders).toHaveLength(1);
    expect(g.defenders[0].fuse?.kind).toBe('rayo');
    expect(g.events).toContain('fusion');
    play(g, 30);
    expect(g.kills).toBeGreaterThan(0);
  });

  it('the wall stops viruses until it breaks; structures fight on their own', () => {
    const g = newGame(14);
    g.defenders = [];
    g.g.wallMax = g.g.wall = 1e9;
    for (let t = 0; t < 40; t += 1 / 30) update(g, 1 / 30);
    expect(g.hp).toBe(100);
    for (const v of g.viruses) expect(Math.hypot(v.x, v.y)).toBeGreaterThan(WALL_R - 2);
    const h = newGame(15);
    h.defenders = [];
    Object.assign(h.g, { thorns: 2, orbit: 6, faro: 2, coreMines: 2, arc: 2, corePulse: 2 });
    play(h, 60);
    expect(h.kills).toBeGreaterThan(10);
  });

  it('the Laboratorio sells permanent upgrades that change the starting game', () => {
    let save = emptySave();
    save.invasion.datos = 5000;
    expect(newGame(16, 300, 300, startOpts(save.invasion.lab)).defenders).toHaveLength(2);
    for (const id of ['inicio', 'cartas', 'vida', 'muro', `u-${NEW_KINDS[0]}`]) save = buyLab(save, id)!;
    expect(save.invasion.datos).toBeLessThan(5000);
    const g = newGame(16, 300, 300, startOpts(save.invasion.lab));
    expect(g.defenders).toHaveLength(3);
    expect(g.pending).toBe(1);
    expect(g.maxHp).toBe(115);
    expect(g.g.wall).toBeGreaterThan(0);
    expect(g.unlocked).toContain(NEW_KINDS[0]);
    expect(g.unlocked).toEqual(expect.arrayContaining(BASE_KINDS));
    save.invasion.datos = 0;
    expect(buyLab(save, 'dano')).toBeNull();
    expect(LAB.length).toBeGreaterThanOrEqual(15);
    let rich = emptySave();
    rich.invasion.datos = 1e5;
    rich = buyLab(rich, 'elegir')!;
    rich = buyLab(rich, 'af-fuego')!;
    rich.invasion.lab.start = DEF_KINDS.indexOf('laser') + 1;
    const h = newGame(17, 300, 300, startOpts(rich.invasion.lab));
    expect(h.defenders[0].kind).toBe('laser');
    expect(h.g.elBonus.fuego).toBeCloseTo(0.06);
  });

  it('every pick of a structure changes it, up to its top level; then it can ascend', () => {
    const g = newGame(21);
    const spikes = GLOBAL_CARDS.find((c) => c.id === 'espinas')!;
    const asCard = (): Card => ({ key: 'espinas', id: 'espinas', kind: 'global', rarity: 'epica', title: 'Espinas', desc: '', tag: '', color: '#fff', apply: (gg) => spikes.apply(gg) });
    let prev = JSON.stringify(structs(g));
    for (let k = 0; k < spikes.max!; k++) {
      choose(g, asCard());
      const now = JSON.stringify(structs(g));
      expect(now, `level ${k + 1}`).not.toBe(prev);
      prev = now;
    }
    expect(levelOf(g, 'espinas')).toBe(spikes.max);
    let sawSpikes = false;
    let sawAsc = false;
    for (let k = 0; k < 300; k++) {
      for (const c of offer(g, () => rand(g))) {
        if (c.id === 'espinas') sawSpikes = true;
        if (c.id === 'asc-espinas') sawAsc = true;
      }
    }
    expect(sawSpikes).toBe(false);
    expect(sawAsc).toBe(true);
    for (const c of GLOBAL_CARDS) expect(c.max, c.id).toBeGreaterThan(0);
    for (const c of GLOBAL_CARDS.filter((x) => x.next)) for (let l = 1; l <= c.max!; l++) expect(c.next!(l), `${c.id} ${l}`).toBeTruthy();
  });

  it('a new defender goes where you choose; neighbours make a synergy stronger', () => {
    const g = newGame(22);
    g.defenders = [];
    for (const k of ['canon', 'laser', 'hielo', 'misil'] as const) addDefender(g, k);
    const opts = placements(g, 'rayo');
    expect(opts.length).toBeGreaterThan(1);
    expect(opts[0].syn).toContain('Superconductor');
    const card = offer(g, () => 0).find((c) => c.kind === 'new');
    const rayo: Card = card ? { ...card, id: 'new-rayo' } : { key: 'new-rayo', id: 'new-rayo', kind: 'new', rarity: 'rara', title: 'Rayo', desc: '', tag: '', color: '#fff', apply: (gg, at) => { addDefender(gg, 'rayo', at); } };
    choose(g, { ...rayo, apply: (gg, at) => { addDefender(gg, 'rayo', at); } }, opts[0].at);
    const i = g.defenders.findIndex((d) => d.kind === 'rayo');
    const n = g.defenders.length;
    expect([g.defenders[(i + 1) % n].kind, g.defenders[(i - 1 + n) % n].kind]).toContain('hielo');
    expect(g.synAdj).toContain('superconductor');
    // Far from each other: active but not reinforced.
    const h = newGame(23);
    h.defenders = [];
    for (const k of ['hielo', 'canon', 'rayo', 'laser'] as const) addDefender(h, k);
    expect(h.syn).toContain('superconductor');
    expect(h.synAdj).not.toContain('superconductor');
  });

  it('a strong defence unlocks extra chips, each with its own exclusive defenders', () => {
    const g = newGame(31, 300, 300, { unlocked: [...DEF_KINDS] });
    g.defenders = [];
    for (const k of ['canon', 'laser', 'rayo', 'hielo', 'misil', 'pulso', 'mortero'] as const) addDefender(g, k);
    expect(chipReady(g)).toBe(false);
    g.defenders.slice(0, 3).forEach((d) => { d.evo = ['a', 'b']; });
    g.level = 30;
    expect(chipReady(g)).toBe(true);
    let card;
    for (let k = 0; k < 40 && !card; k++) card = offer(g, () => rand(g)).find((c) => c.kind === 'chip');
    expect(card?.title).toContain('Prisma');
    choose(g, card!);
    expect(g.chips).toBe(2);
    const crew = g.defenders.filter((d) => d.chip === 1);
    expect(crew).toHaveLength(1);
    expect(CHIPS[0].kinds).toContain(crew[0].kind);
    expect(DEF_KINDS).not.toContain(crew[0].kind);
    update(g, 1 / 30);
    const P = chipPos(1);
    expect(Math.hypot(crew[0].x - P.x, crew[0].y - P.y)).toBeLessThan(45);
    let exclusive = false;
    for (let k = 0; k < 100 && !exclusive; k++) exclusive = offer(g, () => rand(g)).some((c) => c.kind === 'new' && CHIPS[0].kinds.includes(c.id.slice(4) as never));
    expect(exclusive).toBe(true);
    play(g, 20);
    expect(g.over || g.t > 20).toBe(true);
    const back = restore(JSON.parse(JSON.stringify(snapshot(g))), 300);
    expect(back.chips).toBe(2);
    expect(back.defenders.filter((d) => d.chip === 1)).toHaveLength(g.defenders.filter((d) => d.chip === 1).length);
    expect(MAX_CHIPS).toBe(6);
  });

  it('every exclusive chip defender has its own new attack and works', () => {
    for (const ch of CHIPS) {
      for (const kind of ch.kinds) {
        const g = newGame(41, 300, 400);
        g.defenders = [];
        g.chips = CHIPS.indexOf(ch) + 2;
        const d = addDefender(g, kind);
        expect(d.chip).toBe(CHIPS.indexOf(ch) + 1);
        const hp0 = g.hp;
        g.hp = 50;
        for (let t = 0; t < 60 && !g.over; t += 1 / 30) update(g, 1 / 30);
        const helped = g.kills > 0 || g.hp > 50 || g.g.shield > 0;
        expect(helped, kind).toBe(true);
        expect(hp0).toBeGreaterThan(0);
      }
    }
  });

  it('every defender has a unique ultimate that fires', () => {
    expect(new Set(Object.values(ULTS).map((u) => u.name)).size).toBe(ALL_KINDS.length);
    for (const kind of ALL_KINDS) {
      const g = newGame(42, 300, 400);
      g.defenders = [];
      g.chips = 6;
      const d = addDefender(g, kind);
      d.ult = 0.999;
      let fired = false;
      for (let t = 0; t < 20 && !fired; t += 1 / 30) {
        update(g, 1 / 30);
        fired = g.events.some((e) => e === `ult:${kind}`);
        g.events.length = 0;
      }
      expect(fired, kind).toBe(true);
    }
  });

  it('elements: super effective and not very effective', () => {
    expect(effectiveness('fuego', 'bio')).toBeGreaterThan(1);
    expect(effectiveness('fuego', 'fuego')).toBeLessThan(1);
    expect(effectiveness('luz', 'electrico')).toBe(1);
    expect(effectiveness(undefined, 'bio')).toBe(1);
  });

  it('a full extra chip can be upgraded: its three defenders improve at once', () => {
    const g = newGame(43);
    g.chips = 2;
    for (const k of CHIPS[0].kinds) addDefender(g, k);
    const before = g.defenders.filter((d) => d.chip === 1).map((d) => JSON.stringify(d.stats));
    let card;
    for (let k = 0; k < 200 && !card; k++) card = offer(g, () => rand(g)).find((c) => c.kind === 'chipup');
    expect(card?.title).toContain('Prisma');
    choose(g, card!);
    const after = g.defenders.filter((d) => d.chip === 1);
    after.forEach((d, i) => {
      expect(JSON.stringify(d.stats)).not.toBe(before[i]);
      expect(d.lvl).toBe(1);
    });
  });

  it('random wave modifiers show up; bosses change phase; titans come every 25 waves and stun', () => {
    const g = newGame(51, 300, 400);
    const seen = new Set<string>();
    for (let w = 0; w < 60; w++) {
      g.phase = 'break';
      g.breakT = 0;
      g.viruses = [];
      update(g, 1 / 30);
      if (g.mod) seen.add(g.mod);
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
    for (const m of seen) expect(MODS[m]).toBeTruthy();
    // Boss phases
    const h = newGame(52, 300, 400);
    h.wave = 4;
    h.phase = 'break';
    h.breakT = 0;
    update(h, 1 / 30);
    for (let t = 0; t < 20 && !h.viruses.some((v) => v.boss); t += 1 / 30) update(h, 1 / 30);
    const boss = h.viruses.find((v) => v.boss)!;
    expect(boss).toBeTruthy();
    hit(h, boss, boss.max * 0.5, { raw: true });
    expect(boss.phase).toBe(1);
    expect(h.events.some((e) => e === 'phase:2')).toBe(true);
    // Titan at wave 25
    const k = newGame(53, 300, 400);
    k.wave = 24;
    k.phase = 'break';
    k.breakT = 0;
    let titan;
    for (let t = 0; t < 40 && !titan; t += 1 / 30) {
      update(k, 1 / 30);
      titan = k.viruses.find((v) => v.type === 'titan');
    }
    expect(titan).toBeTruthy();
    titan!.x = 230;
    titan!.y = 0;
    let stunned = false;
    for (let t = 0; t < 8 && !stunned; t += 1 / 30) {
      update(k, 1 / 30);
      stunned = k.defenders.some((d) => (d.stun ?? 0) > 0);
    }
    expect(stunned).toBe(true);
  });

  it('with the four outposts maxed the core evolves, then a second main core appears', () => {
    const g = newGame(54, 300, 400, { unlocked: [...DEF_KINDS] });
    g.chips = 5;
    for (const ch of CHIPS.slice(0, 4)) for (let k = 0; k < 10; k++) g.taken.push(`chipup-${ch.id}`);
    g.level = 80;
    let evo;
    for (let k = 0; k < 30 && !evo; k++) evo = offer(g, () => rand(g)).find((c) => c.kind === 'coreevo');
    expect(evo?.title).toBe('Evolución del núcleo');
    choose(g, evo!);
    expect(g.g.coreEvo).toBe(1);
    let twin;
    for (let k = 0; k < 60 && !twin; k++) twin = offer(g, () => rand(g)).find((c) => c.kind === 'chip');
    expect(twin?.title).toContain('Anomalía');
    choose(g, twin!);
    expect(g.chips).toBe(6);
    expect(g.defenders.some((d) => d.chip === 5)).toBe(true);
  });

  it('formation: moving a defender changes who its neighbours are', () => {
    const g = newGame(55);
    g.defenders = [];
    for (const k of ['hielo', 'canon', 'laser', 'rayo', 'misil', 'pulso'] as const) addDefender(g, k);
    expect(g.syn).toContain('superconductor');
    expect(g.synAdj).not.toContain('superconductor');
    [g.defenders[2], g.defenders[3]] = [g.defenders[3], g.defenders[2]];
    [g.defenders[1], g.defenders[2]] = [g.defenders[2], g.defenders[1]];
    expect(g.defenders.map((d) => d.kind)).toEqual(['hielo', 'rayo', 'canon', 'laser', 'misil', 'pulso']);
    refreshSynergies(g);
    expect(g.synAdj).toContain('superconductor');
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
    expect(result.datos).toBeGreaterThan(0);
    expect(after.core.energy).toBe(result.energy);
    expect(after.invasion.datos).toBe(result.datos);
    expect(after.invasion.bestWave).toBe(g.wave);
    expect(after.invasion.run).toBeNull();
    save = normalize(JSON.parse(JSON.stringify({ ...after, invasion: { ...after.invasion, run: snapshot(g) } })));
    expect(save.invasion.run?.wave).toBe(g.wave - 1);
    expect(normalize({ version: 2 }).invasion.bestWave).toBe(0);
  });
});
