import { addDefender } from './cards';
import { DEF_INFO, DEF_KINDS, makeDefender } from './defenders';
import type { DefKind, Defender, Game, Globals, Shot, Stats, Virus, VirusType } from './types';

export const CORE_R = 22;
export const RING_R = 64;
const MAX_FX = 700;

/** Deterministic random numbers kept inside the game (so a saved game continues the same way). */
export function rand(g: Game): number {
  let t = (g.seed = (g.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function defaultGlobals(): Globals {
  return {
    dmgMul: 1, rateMul: 1, rangeMul: 1, critAdd: 0, xpMul: 1, energyMul: 1, regen: 0, shieldMax: 0, shield: 0, shieldCd: 12, shieldT: 0, aura: 0, brake: 0,
    tapMul: 1, tapRadius: 1, tapRate: 1, nova: 0, novaT: 0, rerolls: 1, choices: 3, execute: 0, bossMul: 1, firstHit: 0, chainReaction: 0, hitSlow: 0, hitBurn: 0,
    backup: 0, turret: 0, turretCd: 0, enemyHp: 1, enemySpeed: 1, horde: 1, extraBoss: 0, bossNext: 0, bossBounty: 0, eliteChance: 0, waveSpeed: 1,
  };
}

export function newGame(seed = (Date.now() ^ (Math.random() * 1e9)) | 0, arena = 300, arenaY = arena): Game {
  const g: Game = {
    t: 0, arena, arenaY, wave: 0, waveT: 0, waveLen: 0, phase: 'break', breakT: 1.6, spawns: [], hp: 100, maxHp: 100, g: defaultGlobals(), defenders: [], viruses: [], shots: [], fx: [],
    xp: 0, level: 1, pending: 0, kills: 0, bosses: 0, taken: [], ring: 0, tapCd: 0, shake: 0, hurt: 0, over: false, nextId: 1, seed, events: [],
  };
  addDefender(g, 'canon');
  const others = DEF_KINDS.filter((k) => k !== 'canon' && k !== 'mortero');
  addDefender(g, others[Math.floor(rand(g) * others.length)]);
  return g;
}

/** Life of a basic virus at a wave, before the threat multiplier. */
export const hpAt = (wave: number) => 8 * Math.pow(1.12, wave - 1);
/** Core abilities (tap, aura, satellite, nova) grow with the waves. */
const coreScale = (wave: number) => Math.pow(1.12, Math.max(0, wave - 1));
/** Defenders get a little stronger every wave on their own. */
const passive = (wave: number) => Math.pow(1.05, Math.max(0, wave - 1));
export const xpNeed = (level: number) => Math.round(5 + level * 2.6 + Math.pow(1.09, level));

interface VDef { hp: number; sp: number; r: number; dmg: number; xp: number; armor?: number; shield?: number; boss?: boolean; color: string }
export const VIRUS: Record<VirusType, VDef> = {
  basico: { hp: 1, sp: 1, r: 9, dmg: 5, xp: 1, color: '#ff3b5c' },
  rapido: { hp: 0.55, sp: 1.8, r: 7, dmg: 4, xp: 1, color: '#ff8a1f' },
  tanque: { hp: 3.5, sp: 0.6, r: 14, dmg: 12, xp: 3, armor: 0.25, color: '#b0203a' },
  divisor: { hp: 1.6, sp: 0.9, r: 11, dmg: 6, xp: 2, color: '#ff5fd2' },
  mini: { hp: 0.3, sp: 1.4, r: 5, dmg: 2, xp: 0.4, color: '#ff7ad9' },
  zigzag: { hp: 0.9, sp: 1.25, r: 8, dmg: 5, xp: 1.5, color: '#ffd60a' },
  escudo: { hp: 1.2, sp: 0.85, r: 11, dmg: 7, xp: 2.5, shield: 1, color: '#5b8cff' },
  curandero: { hp: 1.4, sp: 0.8, r: 10, dmg: 5, xp: 3, color: '#3dff9a' },
  fantasma: { hp: 0.9, sp: 1.1, r: 9, dmg: 6, xp: 2.5, color: '#c9c3ff' },
  invocador: { hp: 2.4, sp: 0.55, r: 13, dmg: 8, xp: 4, color: '#c04dff' },
  kamikaze: { hp: 0.7, sp: 1, r: 8, dmg: 10, xp: 1.5, color: '#ff2a2a' },
  coloso: { hp: 28, sp: 0.42, r: 30, dmg: 25, xp: 25, boss: true, armor: 0.1, color: '#ff2d55' },
  reina: { hp: 22, sp: 0.5, r: 27, dmg: 25, xp: 25, boss: true, color: '#ff8a1f' },
  espectro: { hp: 21, sp: 0.55, r: 26, dmg: 25, xp: 25, boss: true, color: '#b9b3ff' },
  acorazado: { hp: 25, sp: 0.4, r: 30, dmg: 25, xp: 25, boss: true, armor: 0.45, color: '#6b7cff' },
  hidra: { hp: 18, sp: 0.5, r: 28, dmg: 25, xp: 15, boss: true, color: '#ff4fd8' },
};
export const BOSS_NAMES: Partial<Record<VirusType, string>> = { coloso: 'Coloso', reina: 'Reina del enjambre', espectro: 'Espectro', acorazado: 'Acorazado', hidra: 'Hidra' };
const BOSSES: VirusType[] = ['coloso', 'reina', 'espectro', 'acorazado', 'hidra'];
const UNLOCK: [VirusType, number, number][] = [
  ['basico', 1, 3], ['rapido', 2, 2], ['tanque', 3, 1], ['zigzag', 4, 1.5], ['divisor', 6, 1], ['escudo', 7, 1], ['kamikaze', 7, 1],
  ['curandero', 8, 0.6], ['fantasma', 9, 0.8], ['invocador', 11, 0.5],
];

export const isBossWave = (wave: number) => wave % 5 === 0;

function startWave(g: Game) {
  g.wave += 1;
  g.phase = 'wave';
  g.waveT = 0;
  const w = g.wave;
  const len = (14 + Math.min(12, w * 0.5)) / g.g.waveSpeed;
  g.waveLen = len;
  const n = Math.min(220, Math.round((6 + w * 2.3) * g.g.horde));
  const pool = UNLOCK.filter(([, from]) => w >= from);
  const total = pool.reduce((a, [, , wt]) => a + wt, 0);
  const pick = (): VirusType => {
    let x = rand(g) * total;
    for (const [t, , wt] of pool) if ((x -= wt) <= 0) return t;
    return 'basico';
  };
  const spawns: Game['spawns'] = [];
  while (spawns.length < n) {
    const at = rand(g) * len;
    if (rand(g) < 0.18 && w > 2) {
      // A swarm: several of one kind at once.
      const t = pick();
      const angle = rand(g) * Math.PI * 2;
      for (let k = 0; k < 4 && spawns.length < n; k++) spawns.push({ at: at + k * 0.12, type: t, angle: angle + (rand(g) - 0.5) * 0.18 });
    } else spawns.push({ at, type: pick(), elite: rand(g) < g.g.eliteChance });
  }
  const boss = isBossWave(w) || g.g.bossNext;
  if (boss) {
    const count = 1 + Math.floor(Math.max(0, g.defenders.length - 3) / 3) + g.g.extraBoss;
    const kind = BOSSES[(Math.floor(w / 5) - 1 + BOSSES.length) % BOSSES.length];
    for (let k = 0; k < count; k++) spawns.push({ at: len * 0.3 + k * 3, type: k === 0 ? kind : BOSSES[Math.floor(rand(g) * BOSSES.length)] });
    g.g.bossNext = 0;
  }
  spawns.sort((a, b) => a.at - b.at);
  g.spawns = spawns;
  g.events.push(boss ? 'boss' : 'wave');
}

function spawnVirus(g: Game, type: VirusType, opts: { x?: number; y?: number; elite?: boolean; gen?: number; maxMul?: number; angle?: number } = {}): Virus {
  const d = VIRUS[type];
  const a = opts.angle ?? rand(g) * Math.PI * 2;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const A = Math.min(g.arena / Math.max(1e-3, Math.abs(ca)), g.arenaY / Math.max(1e-3, Math.abs(sa))) + 26;
  const w = Math.max(1, g.wave);
  const eliteMul = opts.elite ? 3 : 1;
  const max = hpAt(w) * d.hp * g.g.enemyHp * eliteMul * (opts.maxMul ?? 1);
  const v: Virus = {
    id: g.nextId++, type, x: opts.x ?? ca * A, y: opts.y ?? sa * A, r: d.r * (opts.elite ? 1.35 : 1) * (opts.maxMul && opts.maxMul < 1 ? 0.78 : 1),
    hp: max, max, shield: d.shield ? max * d.shield : 0, speed: 32 * Math.min(1.7, 1 + 0.015 * (w - 1)) * d.sp * g.g.enemySpeed, armor: d.armor ?? 0, dmg: d.dmg * (opts.elite ? 1.5 : 1),
    xp: d.xp * (opts.elite ? 3 : 1), boss: !!d.boss, elite: !!opts.elite, gen: opts.gen ?? 0, slowF: 0, slowT: 0, burn: 0, burnT: 0, flash: 0, spin: rand(g) * 6, kb: 0, t: 0,
    timer: 1 + rand(g) * 2, hidden: false, dead: false, hits: {},
  };
  g.viruses.push(v);
  return v;
}

// ── Effects ───────────────────────────────────────────────────────────────
function burst(g: Game, x: number, y: number, c: string, n: number, sp = 120, s = 2.2) {
  for (let k = 0; k < n && g.fx.length < MAX_FX; k++) {
    const a = rand(g) * Math.PI * 2;
    const v = sp * (0.3 + rand(g));
    const life = 0.35 + rand(g) * 0.45;
    g.fx.push({ k: 'p', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, c, s: s * (0.6 + rand(g) * 0.8) });
  }
}
function ring(g: Game, x: number, y: number, r0: number, r1: number, c: string, life = 0.35, w = 2.5) {
  if (g.fx.length < MAX_FX) g.fx.push({ k: 'ring', x, y, r0, r1, life, max: life, c, w });
}

// ── Damage ────────────────────────────────────────────────────────────────
interface HitOpts {
  crit?: number;
  critMult?: number;
  execute?: number;
  slow?: number;
  burn?: number;
  brittle?: boolean;
  quiet?: boolean;
  src?: Defender | null;
  raw?: boolean;
}
export function hit(g: Game, v: Virus, dmg: number, o: HitOpts = {}) {
  if (v.dead) return;
  let d = dmg;
  if (!o.raw) d *= g.g.dmgMul * passive(g.wave);
  let crit = false;
  if (rand(g) < (o.crit ?? 0.05) + g.g.critAdd) {
    d *= o.critMult ?? 2;
    crit = true;
  }
  if (g.g.firstHit && v.hp >= v.max) d *= 1 + g.g.firstHit;
  if (v.boss || v.elite) d *= g.g.bossMul;
  if (o.brittle && v.slowT > 0) d *= 1.5;
  d *= 1 - v.armor;
  if (v.shield > 0) {
    const a = Math.min(v.shield, d);
    v.shield -= a;
    d -= a;
  }
  v.hp -= d;
  v.flash = 0.09;
  const slow = Math.min(0.9, (o.slow ?? 0) + g.g.hitSlow);
  if (slow > 0) {
    v.slowF = Math.max(v.slowF, v.boss ? slow * 0.5 : slow);
    v.slowT = 1.3;
  }
  const burn = (o.burn ?? 0) + g.g.hitBurn;
  if (burn > 0) {
    v.burn = Math.max(v.burn, burn * passive(g.wave) * g.g.dmgMul);
    v.burnT = 3;
  }
  const ex = Math.max(o.execute ?? 0, g.g.execute) * (v.boss ? 0.4 : 1);
  if (ex > 0 && v.hp > 0 && v.hp / v.max < ex) v.hp = 0;
  if (crit && !o.quiet && g.fx.length < MAX_FX) g.fx.push({ k: 'txt', x: v.x, y: v.y - v.r, s: fmtDmg(d), life: 0.6, max: 0.6, c: '#ffd60a' });
  if (v.hp <= 0) kill(g, v, o.src ?? null);
}
const fmtDmg = (d: number) => (d >= 1e6 ? `${(d / 1e6).toFixed(1)}M` : d >= 1e3 ? `${(d / 1e3).toFixed(1)}k` : String(Math.round(d)));

function kill(g: Game, v: Virus, src: Defender | null) {
  if (v.dead) return;
  v.dead = true;
  g.kills += 1;
  if (src) src.kills += 1;
  g.xp += v.xp * g.g.xpMul;
  const c = VIRUS[v.type].color;
  burst(g, v.x, v.y, c, v.boss ? 40 : 9, v.boss ? 220 : 130, v.boss ? 3.4 : 2.2);
  if (g.fx.length < MAX_FX) g.fx.push({ k: 'xp', x: v.x, y: v.y, life: 0.7, max: 0.7, c: '#c8ff2e' });
  if (v.boss) {
    ring(g, v.x, v.y, v.r, v.r * 4, c, 0.6, 4);
    g.shake = Math.max(g.shake, 10);
    if (v.type !== 'hidra' || v.gen >= 2) {
      g.bosses += 1;
      g.events.push('bosskill');
      if (g.g.bossBounty) {
        g.pending += g.g.bossBounty;
        g.g.bossBounty = 0;
      }
    }
  }
  if (v.type === 'divisor') for (let k = 0; k < 2; k++) spawnVirus(g, 'mini', { x: v.x + (k ? 6 : -6), y: v.y, gen: 1 });
  if (v.type === 'hidra' && v.gen < 2) {
    const maxMul = (v.max * 0.42) / (hpAt(Math.max(1, g.wave)) * VIRUS.hidra.hp * g.g.enemyHp);
    for (let k = 0; k < 2; k++) spawnVirus(g, 'hidra', { x: v.x + (k ? 14 : -14), y: v.y, gen: v.gen + 1, maxMul });
  }
  if (g.g.chainReaction > 0) {
    ring(g, v.x, v.y, v.r, v.r + 26, c, 0.25, 2);
    for (const o of g.viruses) if (!o.dead && o !== v && dist2(o, v) < (26 + o.r) ** 2) hit(g, o, v.max * g.g.chainReaction, { raw: true, quiet: true });
  }
}

const dist2 = (a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

function nearest(g: Game, x: number, y: number, range: number, skip?: Set<number>): Virus | null {
  let best: Virus | null = null;
  let bd = range * range;
  for (const v of g.viruses) {
    if (v.dead || v.hidden || skip?.has(v.id)) continue;
    const d = dist2(v, { x, y }) - v.r * v.r;
    if (d < bd) {
      bd = d;
      best = v;
    }
  }
  return best;
}
function nearestN(g: Game, x: number, y: number, range: number, n: number): Virus[] {
  const list: [number, Virus][] = [];
  for (const v of g.viruses) {
    if (v.dead || v.hidden) continue;
    const d = dist2(v, { x, y });
    if (d < (range + v.r) ** 2) list.push([d, v]);
  }
  list.sort((a, b) => a[0] - b[0]);
  return list.slice(0, n).map((x) => x[1]);
}

function splash(g: Game, x: number, y: number, r: number, dmg: number, s: Partial<Stats>, src: Defender | null, except?: Virus) {
  ring(g, x, y, 4, r, src ? DEF_INFO[src.kind].color : '#fff', 0.3, 3);
  for (const v of g.viruses) if (!v.dead && v !== except && dist2(v, { x, y }) < (r + v.r) ** 2) hit(g, v, dmg, { crit: s.crit, critMult: s.critMult, slow: s.slow, burn: s.burn, quiet: true, src });
}

// ── Defenders ─────────────────────────────────────────────────────────────
function fireShots(g: Game, d: Defender, s: Stats, t: Virus) {
  const base = Math.atan2(t.y - d.y, t.x - d.x);
  d.aim = base;
  const n = Math.max(1, Math.round(s.count));
  const R = s.range * g.g.rangeMul;
  for (let i = 0; i < n; i++) {
    const a = base + (n > 1 ? -s.spread / 2 + (s.spread * i) / (n - 1) : 0) + (rand(g) - 0.5) * 0.06;
    if (d.kind === 'mortero') {
      const tx = t.x + (n > 1 ? (rand(g) - 0.5) * s.spread * 90 : 0);
      const ty = t.y + (n > 1 ? (rand(g) - 0.5) * s.spread * 90 : 0);
      const T = 0.7 + Math.sqrt(dist2({ x: tx, y: ty }, d)) / 420;
      g.shots.push(shot(d, s, { x: d.x, y: d.y, vx: 0, vy: 0, tx, ty, T, t: 0, r: 5, life: T + 0.1 }));
      continue;
    }
    const sp = s.speed;
    g.shots.push(shot(d, s, { x: d.x, y: d.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: d.kind === 'misil' ? 4.5 : d.kind === 'hielo' ? 3.6 : 3, life: d.kind === 'misil' ? 3 : (R * 1.4) / sp + 0.15, target: t.id }));
  }
}
function shot(d: Defender, s: Stats, o: Partial<Shot>): Shot {
  return {
    x: 0, y: 0, vx: 0, vy: 0, dmg: s.dmg, r: 3, life: 1, pierce: s.pierce, bounce: s.bounce, splash: s.splash, slow: s.slow, burn: s.burn, homing: s.homing, split: s.split,
    crit: s.crit, critMult: s.critMult, execute: s.execute, target: -1, src: d.id, kind: d.kind, hit: [], px: d.x, py: d.y, ...o,
  };
}

function updateDefender(g: Game, d: Defender, dt: number) {
  const s = d.stats;
  const rate = s.rate * g.g.rateMul;
  const R = s.range * g.g.rangeMul;
  const color = DEF_INFO[d.kind].color;
  switch (d.kind) {
    case 'canon':
    case 'hielo':
    case 'misil':
    case 'mortero': {
      d.cd -= dt;
      if (d.cd > 0) return;
      const t = nearest(g, d.x, d.y, R);
      if (!t) return;
      d.cd = 1 / rate;
      fireShots(g, d, s, t);
      return;
    }
    case 'laser': {
      const targets = nearestN(g, d.x, d.y, R, Math.round(s.count));
      if (!targets.length) {
        d.lockT = 0;
        return;
      }
      if (targets[0].id === d.lockId) d.lockT += dt;
      else {
        d.lockId = targets[0].id;
        d.lockT = 0;
      }
      const ramp = d.flags.ramp ? Math.min(4, 1 + d.lockT * 0.7) : 1;
      for (const t of targets) {
        d.aim = Math.atan2(t.y - d.y, t.x - d.x);
        g.fx.push({ k: 'beam', x1: d.x, y1: d.y, x2: t.x, y2: t.y, c: color, w: 2 + Math.min(4, s.dmg / 25) * (ramp > 2 ? 1.5 : 1), life: 0.05, max: 0.05 });
        hit(g, t, s.dmg * rate * dt * ramp, { crit: s.crit, critMult: s.critMult, slow: s.slow, burn: s.burn, execute: s.execute, quiet: true, src: d });
        let from = t;
        const seen = new Set([t.id]);
        for (let k = 0; k < s.chain; k++) {
          const nx = nearest(g, from.x, from.y, 75, seen);
          if (!nx) break;
          seen.add(nx.id);
          g.fx.push({ k: 'beam', x1: from.x, y1: from.y, x2: nx.x, y2: nx.y, c: color, w: 1.5, life: 0.05, max: 0.05 });
          hit(g, nx, s.dmg * rate * dt * 0.6, { slow: s.slow, burn: s.burn, quiet: true, src: d });
          from = nx;
        }
      }
      return;
    }
    case 'rayo': {
      d.cd -= dt;
      if (d.cd > 0) return;
      const starts = nearestN(g, d.x, d.y, R, Math.round(s.count));
      if (!starts.length) return;
      d.cd = 1 / rate;
      for (const st of starts) {
        const pts = [d.x, d.y];
        const seen = new Set<number>();
        let cur: Virus | null = st;
        let k = 0;
        while (cur && k <= s.chain) {
          seen.add(cur.id);
          // Jagged bolt to the next target.
          const px = pts[pts.length - 2];
          const py = pts[pts.length - 1];
          for (let j = 1; j <= 3; j++) pts.push(px + ((cur.x - px) * j) / 4 + (rand(g) - 0.5) * 12, py + ((cur.y - py) * j) / 4 + (rand(g) - 0.5) * 12);
          pts.push(cur.x, cur.y);
          const fall = d.flags.nofall ? 1 : Math.pow(0.85, k);
          const tx = cur.x;
          const ty = cur.y;
          const target: Virus = cur;
          hit(g, target, s.dmg * fall, { crit: s.crit, critMult: s.critMult, slow: s.slow, burn: s.burn, execute: s.execute, src: d });
          if (s.splash) splash(g, tx, ty, s.splash, s.dmg * fall * 0.5, s, d, target);
          cur = nearest(g, tx, ty, 90, seen);
          k++;
        }
        g.fx.push({ k: 'bolt', pts, life: 0.16, max: 0.16, c: color });
        d.aim = Math.atan2(st.y - d.y, st.x - d.x);
      }
      return;
    }
    case 'pulso': {
      if (d.flags.field) {
        d.spin += dt;
        for (const v of g.viruses) if (!v.dead && dist2(v, d) < (R + v.r) ** 2) hit(g, v, s.dmg * rate * 0.6 * dt, { slow: s.slow, burn: s.burn, quiet: true, src: d });
        if (d.spin > 0.5) {
          d.spin = 0;
          ring(g, d.x, d.y, R * 0.3, R, color, 0.5, 1.5);
        }
        return;
      }
      d.cd -= dt;
      if (d.pending > 0) {
        d.lockT -= dt;
        if (d.lockT <= 0) {
          d.pending -= 1;
          d.lockT = 0.22;
          pulse(g, d, s, R, color);
        }
      }
      if (d.cd > 0) return;
      if (!nearest(g, d.x, d.y, R)) return;
      d.cd = 1 / rate;
      pulse(g, d, s, R, color);
      d.pending = Math.round(s.count) - 1;
      d.lockT = 0.22;
      return;
    }
    case 'cuchillas': {
      d.spin += rate * dt;
      const n = Math.round(s.count);
      for (let b = 0; b < n; b++) {
        const a = d.spin + (b * Math.PI * 2) / n;
        const bx = d.x + Math.cos(a) * R;
        const by = d.y + Math.sin(a) * R;
        for (const v of g.viruses) {
          if (v.dead || v.hidden) continue;
          if (dist2(v, { x: bx, y: by }) > (v.r + 7) ** 2) continue;
          const key = d.id * 64 + b;
          if ((v.hits[key] ?? -1) > g.t) continue;
          v.hits[key] = g.t + 0.28;
          hit(g, v, s.dmg, { crit: s.crit, critMult: s.critMult, slow: s.slow, burn: s.burn, execute: s.execute, src: d });
          if (s.knock) v.kb += s.knock * (v.boss ? 0.3 : 1);
          if (d.flags.leech) g.hp = Math.min(g.maxHp, g.hp + 0.12);
          burst(g, bx, by, color, 2, 80, 1.6);
        }
      }
      return;
    }
  }
}

function pulse(g: Game, d: Defender, s: Stats, R: number, color: string) {
  ring(g, d.x, d.y, 8, R, color, 0.42, 3);
  for (const v of g.viruses) {
    if (v.dead || dist2(v, d) > (R + v.r) ** 2) continue;
    hit(g, v, s.dmg, { crit: s.crit, critMult: s.critMult, slow: s.slow, burn: s.burn, execute: s.execute, src: d });
    if (s.knock) v.kb += s.knock * (v.boss ? 0.3 : 1);
  }
}

function updateShots(g: Game, dt: number) {
  const keep: Shot[] = [];
  for (const s of g.shots) {
    s.px = s.x;
    s.py = s.y;
    const src = g.defenders.find((d) => d.id === s.src) ?? null;
    const brittle = !!src?.flags.brittle;
    if (s.T !== undefined) {
      // Mortar shell: lands on its point.
      s.t! += dt;
      const k = Math.min(1, s.t! / s.T);
      const sx = src ? src.x : 0;
      const sy = src ? src.y : 0;
      s.x = sx + (s.tx! - sx) * k;
      s.y = sy + (s.ty! - sy) * k;
      if (k >= 1) {
        splash(g, s.tx!, s.ty!, s.splash, s.dmg, s, src);
        burst(g, s.tx!, s.ty!, '#ff8a5a', 8, 140, 2.4);
        g.shake = Math.max(g.shake, 2);
        continue;
      }
      keep.push(s);
      continue;
    }
    if (s.homing) {
      let t = g.viruses.find((v) => v.id === s.target && !v.dead && !v.hidden);
      if (!t) {
        const n = nearest(g, s.x, s.y, 260);
        if (n) {
          s.target = n.id;
          t = n;
        }
      }
      if (t) {
        const want = Math.atan2(t.y - s.y, t.x - s.x);
        const cur = Math.atan2(s.vy, s.vx);
        let diff = want - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turn = Math.max(-6 * dt, Math.min(6 * dt, diff));
        const sp = Math.hypot(s.vx, s.vy);
        s.vx = Math.cos(cur + turn) * sp;
        s.vy = Math.sin(cur + turn) * sp;
      }
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
    if (s.life <= 0 || Math.abs(s.x) > g.arena + 60 || Math.abs(s.y) > g.arenaY + 60) continue;
    let alive = true;
    for (const v of g.viruses) {
      if (v.dead || v.hidden || s.hit.includes(v.id)) continue;
      if (dist2(v, s) > (v.r + s.r) ** 2) continue;
      s.hit.push(v.id);
      hit(g, v, s.dmg, { crit: s.crit, critMult: s.critMult, slow: s.slow, burn: s.burn, execute: s.execute, brittle, src, quiet: s.kind === 'frag' });
      if (s.splash) splash(g, s.x, s.y, s.splash, s.dmg * 0.6, s, src, v);
      if (s.split) {
        for (let k = 0; k < s.split; k++) {
          const a = Math.atan2(s.vy, s.vx) + (k - (s.split - 1) / 2) * 0.7 + Math.PI * (s.kind === 'misil' ? 1 : 0) * 0;
          g.shots.push({ ...s, kind: 'frag', vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, dmg: s.dmg * 0.4, life: 0.35, split: 0, splash: s.kind === 'misil' ? s.splash * 0.5 : 0, pierce: 0, bounce: 0, homing: 0, r: 2.4, hit: [v.id] });
        }
      }
      if (s.bounce > 0) {
        const n = nearest(g, s.x, s.y, 170, new Set(s.hit));
        if (n) {
          s.bounce -= 1;
          const sp = Math.hypot(s.vx, s.vy);
          const a = Math.atan2(n.y - s.y, n.x - s.x);
          s.vx = Math.cos(a) * sp;
          s.vy = Math.sin(a) * sp;
          s.life = Math.max(s.life, 0.6);
          break;
        }
      }
      if (s.pierce > 0) {
        s.pierce -= 1;
        continue;
      }
      alive = false;
      break;
    }
    if (alive) keep.push(s);
  }
  g.shots = keep;
}

// ── Core ──────────────────────────────────────────────────────────────────
function coreHit(g: Game, v: Virus) {
  v.dead = true;
  burst(g, v.x, v.y, VIRUS[v.type].color, 10, 160);
  if (g.g.shield > 0) {
    g.g.shield -= 1;
    ring(g, 0, 0, CORE_R, CORE_R + 30, '#8af3ff', 0.4, 3);
    return;
  }
  g.hp -= v.dmg;
  g.hurt = 0.45;
  g.shake = Math.max(g.shake, v.boss ? 14 : 6);
  g.events.push('hit');
  if (g.g.nova > 0 && g.g.novaT <= 0) {
    g.g.novaT = 8 / g.g.nova;
    ring(g, 0, 0, CORE_R, 140, '#ffffff', 0.5, 4);
    for (const o of g.viruses) {
      if (o.dead || dist2(o, { x: 0, y: 0 }) > 140 ** 2) continue;
      hit(g, o, 12 * coreScale(g.wave) * g.g.tapMul, { raw: true, quiet: true });
      o.kb += o.boss ? 20 : 70;
    }
  }
  if (g.hp <= 0) {
    if (g.g.backup) {
      g.g.backup = 0;
      g.hp = g.maxHp * 0.5;
      g.events.push('backup');
      ring(g, 0, 0, CORE_R, 200, '#c8ff2e', 0.7, 5);
      for (const o of g.viruses) if (!o.boss && dist2(o, { x: 0, y: 0 }) < 160 ** 2) kill(g, o, null);
    } else {
      g.hp = 0;
      g.over = true;
      burst(g, 0, 0, '#ffffff', 60, 260, 3);
    }
  }
}

/** A tap on the board: a short-range discharge from the core's power. */
export function tap(g: Game, x: number, y: number): boolean {
  if (g.tapCd > 0 || g.over) return false;
  g.tapCd = 0.8 / g.g.tapRate;
  const r = 32 * g.g.tapRadius;
  ring(g, x, y, 4, r, '#ffffff', 0.32, 3);
  burst(g, x, y, '#ffffff', 6, 100, 1.8);
  for (const v of g.viruses) if (!v.dead && !v.hidden && dist2(v, { x, y }) < (r + v.r) ** 2) hit(g, v, 9 * coreScale(g.wave) * g.g.tapMul, { raw: true });
  return true;
}

// ── Main step ─────────────────────────────────────────────────────────────
export function update(g: Game, dt: number) {
  if (g.over) {
    updateFx(g, dt);
    return;
  }
  dt = Math.min(dt, 0.05);
  g.t += dt;
  g.ring += dt * 0.22;
  g.tapCd = Math.max(0, g.tapCd - dt);
  g.shake = Math.max(0, g.shake - dt * 30);
  g.hurt = Math.max(0, g.hurt - dt);
  g.hp = Math.min(g.maxHp, g.hp + g.g.regen * dt);
  g.g.novaT -= dt;
  if (g.g.shield < g.g.shieldMax) {
    g.g.shieldT += dt;
    if (g.g.shieldT >= g.g.shieldCd) {
      g.g.shieldT = 0;
      g.g.shield += 1;
      ring(g, 0, 0, CORE_R, CORE_R + 16, '#8af3ff', 0.4, 2);
    }
  }

  // Waves
  if (g.phase === 'break') {
    g.breakT -= dt;
    if (g.breakT <= 0) startWave(g);
  } else {
    g.waveT += dt;
    while (g.spawns.length && g.spawns[0].at <= g.waveT) {
      const sp = g.spawns.shift()!;
      spawnVirus(g, sp.type, { elite: sp.elite, angle: sp.angle });
    }
    const alive = g.viruses.some((v) => !v.dead);
    if (!g.spawns.length && (!alive || g.waveT > g.waveLen + 18)) {
      g.phase = 'break';
      g.breakT = 2.2;
    }
  }

  // Defenders on their rotating ring
  const n = g.defenders.length;
  g.defenders.forEach((d, i) => {
    const a = g.ring + (i * Math.PI * 2) / n;
    d.x = Math.cos(a) * RING_R;
    d.y = Math.sin(a) * RING_R;
    updateDefender(g, d, dt);
  });
  // The core's own satellite gun
  if (g.g.turret > 0) {
    g.g.turretCd -= dt;
    if (g.g.turretCd <= 0) {
      const t = nearest(g, 0, 0, 190);
      if (t) {
        g.g.turretCd = 0.7;
        const fake = makeDefender(-1, 'canon');
        const st: Stats = { ...fake.stats, dmg: 6 * coreScale(g.wave) / passive(g.wave), count: g.g.turret, spread: 0.12 * g.g.turret };
        fake.x = 0;
        fake.y = 0;
        fireShots(g, fake, st, t);
        for (const s of g.shots) if (s.src === -1) s.kind = 'core';
      }
    }
  }
  updateShots(g, dt);

  // Viruses
  for (const v of g.viruses) {
    if (v.dead) continue;
    v.t += dt;
    v.timer -= dt;
    v.spin += dt * (v.boss ? 0.7 : 2.2);
    v.flash = Math.max(0, v.flash - dt);
    if (v.slowT > 0) {
      v.slowT -= dt;
      if (v.slowT <= 0) v.slowF = 0;
    }
    if (v.burnT > 0) {
      v.burnT -= dt;
      v.hp -= v.burn * dt;
      if (v.hp <= 0) {
        kill(g, v, null);
        continue;
      }
    }
    const dist = Math.hypot(v.x, v.y) || 1;
    behave(g, v, dist);
    if (v.dead) continue;
    let sp = v.speed * (1 - v.slowF);
    if (g.g.brake && dist < 125) sp *= 1 - g.g.brake;
    if (v.type === 'kamikaze' && dist < 140) sp *= 2.4;
    const ux = -v.x / dist;
    const uy = -v.y / dist;
    let vx = ux * sp;
    let vy = uy * sp;
    if (v.type === 'zigzag') {
      const w = Math.sin(v.t * 4) * sp * 0.9;
      vx += -uy * w;
      vy += ux * w;
    }
    if (v.kb > 0) {
      vx -= ux * v.kb * 4;
      vy -= uy * v.kb * 4;
      v.kb = Math.max(0, v.kb - dt * v.kb * 6 - dt * 4);
    }
    v.x += vx * dt;
    v.y += vy * dt;
    if (g.g.aura > 0 && dist < 82) hit(g, v, g.g.aura * coreScale(g.wave) * dt, { raw: true, quiet: true, crit: 0 });
    if (!v.dead && dist < CORE_R + v.r) coreHit(g, v);
  }
  g.viruses = g.viruses.filter((v) => !v.dead);

  // Level ups
  while (g.xp >= xpNeed(g.level)) {
    g.xp -= xpNeed(g.level);
    g.level += 1;
    g.pending += 1;
    g.events.push('level');
  }
  updateFx(g, dt);
}

function behave(g: Game, v: Virus, dist: number) {
  if (v.timer > 0) return;
  switch (v.type) {
    case 'curandero':
      v.timer = 1.2;
      ring(g, v.x, v.y, 4, 70, '#3dff9a', 0.4, 2);
      for (const o of g.viruses) if (!o.dead && o !== v && dist2(o, v) < 70 ** 2) o.hp = Math.min(o.max, o.hp + o.max * 0.08);
      return;
    case 'invocador':
      v.timer = 2.6;
      for (let k = 0; k < 2; k++) spawnVirus(g, 'mini', { x: v.x + (rand(g) - 0.5) * 20, y: v.y + (rand(g) - 0.5) * 20, gen: 1 });
      return;
    case 'fantasma':
      v.hidden = !v.hidden;
      v.timer = v.hidden ? 0.9 : 1.6;
      return;
    case 'coloso':
      v.timer = 3;
      for (let k = 0; k < 3; k++) spawnVirus(g, 'mini', { x: v.x + (rand(g) - 0.5) * 40, y: v.y + (rand(g) - 0.5) * 40, gen: 1 });
      return;
    case 'reina':
      v.timer = 2.2;
      for (let k = 0; k < 2; k++) spawnVirus(g, 'rapido', { x: v.x + (rand(g) - 0.5) * 40, y: v.y + (rand(g) - 0.5) * 40, gen: 1, maxMul: 0.7 });
      return;
    case 'espectro':
      if (v.hidden) {
        v.hidden = false;
        v.timer = 3.4;
        const k = Math.max(0, (dist - Math.min(60, dist * 0.25)) / dist);
        burst(g, v.x, v.y, '#b9b3ff', 10, 100);
        v.x *= k;
        v.y *= k;
      } else {
        v.hidden = true;
        v.timer = 0.8;
      }
      return;
    case 'acorazado':
      v.timer = 5;
      v.shield = Math.max(v.shield, v.max * 0.25);
      ring(g, v.x, v.y, v.r, v.r + 10, '#6b7cff', 0.4, 3);
      return;
    default:
      v.timer = 99;
  }
}

function updateFx(g: Game, dt: number) {
  for (const f of g.fx) {
    f.life -= dt;
    if (f.k === 'p') {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vx *= 1 - 3 * dt;
      f.vy *= 1 - 3 * dt;
    } else if (f.k === 'txt') f.y -= 30 * dt;
  }
  g.fx = g.fx.filter((f) => f.life > 0);
}

// ── Rewards & saving ──────────────────────────────────────────────────────
export function energyFor(g: Game): number {
  return Math.round((Math.max(0, g.wave - 1) * 9 + g.kills / 6 + g.bosses * 40) * g.g.energyMul);
}

export interface InvasionSnapshot {
  wave: number;
  hp: number;
  maxHp: number;
  g: Globals;
  defenders: Pick<Defender, 'id' | 'kind' | 'name' | 'lvl' | 'evo' | 'stats' | 'flags' | 'kills'>[];
  xp: number;
  level: number;
  pending: number;
  kills: number;
  bosses: number;
  taken: string[];
  seed: number;
  t: number;
  nextId: number;
}

/** Saved at the start of each wave so a closed app resumes from there. */
export function snapshot(g: Game): InvasionSnapshot {
  return structuredClone({
    wave: g.wave - 1, hp: g.hp, maxHp: g.maxHp, g: g.g, xp: g.xp, level: g.level, pending: g.pending, kills: g.kills, bosses: g.bosses, taken: g.taken, seed: g.seed, t: g.t, nextId: g.nextId,
    defenders: g.defenders.map(({ id, kind, name, lvl, evo, stats, flags, kills }) => ({ id, kind, name, lvl, evo, stats, flags, kills })),
  });
}

export function restore(s: InvasionSnapshot, arena: number, arenaY = arena): Game {
  const g = newGame(s.seed, arena, arenaY);
  Object.assign(g, {
    wave: s.wave, hp: s.hp, maxHp: s.maxHp, g: { ...defaultGlobals(), ...s.g }, xp: s.xp, level: s.level, pending: s.pending, kills: s.kills, bosses: s.bosses,
    taken: [...s.taken], t: s.t, nextId: s.nextId, phase: 'break', breakT: 1.6,
  });
  g.defenders = s.defenders.map((d) => ({ ...makeDefender(d.id, d.kind as DefKind), ...structuredClone(d) }));
  return g;
}
