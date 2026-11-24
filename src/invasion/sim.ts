import { addDefender, refreshSynergies } from './cards';
import { BASE_KINDS, DEF_INFO, makeDefender, SYNERGIES } from './defenders';
import type { DefKind, Defender, Game, Globals, Shot, Stats, Virus, VirusType, Zone } from './types';

export const CORE_R = 22;
export const RING_R = 64;
export const WALL_R = 102;
export const ORBIT_R = 132;
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
    wall: 0, wallMax: 0, thorns: 0, orbit: 0, orbitA: 0, faro: 0, faroA: 0, coreMines: 0, coreMinesT: 2, arc: 0, arcT: 1, corePulse: 0, corePulseT: 3,
    nova: 0, novaT: 0, rerolls: 1, choices: 3, execute: 0, bossMul: 1, firstHit: 0, chainReaction: 0, hitSlow: 0, hitBurn: 0,
    backup: 0, turret: 0, turretCd: 0, enemyHp: 1, enemySpeed: 1, horde: 1, extraBoss: 0, bossNext: 0, bossBounty: 0, eliteChance: 0, waveSpeed: 1,
  };
}

/** What the Laboratorio gives at the start of every game. */
export interface StartOpts {
  defenders?: number;
  cards?: number;
  hp?: number;
  dmg?: number;
  rate?: number;
  rerolls?: number;
  choices?: number;
  shield?: number;
  wall?: number;
  xp?: number;
  unlocked?: DefKind[];
}

export function newGame(seed = (Date.now() ^ (Math.random() * 1e9)) | 0, arena = 300, arenaY = arena, o: StartOpts = {}): Game {
  const g: Game = {
    t: 0, arena, arenaY, wave: 0, waveT: 0, waveLen: 0, phase: 'break', breakT: 1.6, spawns: [], hp: 100, maxHp: 100, g: defaultGlobals(), defenders: [], viruses: [], shots: [], fx: [],
    xp: 0, level: 1, pending: 0, kills: 0, bosses: 0, taken: [], ring: 0, zones: [], syn: [], unlocked: [...new Set([...BASE_KINDS, ...(o.unlocked ?? [])])],
    shake: 0, hurt: 0, over: false, nextId: 1, seed, events: [],
  };
  g.maxHp = g.hp = 100 + (o.hp ?? 0);
  g.g.dmgMul *= 1 + (o.dmg ?? 0);
  g.g.rateMul *= 1 + (o.rate ?? 0);
  g.g.rerolls += o.rerolls ?? 0;
  if (o.choices) g.g.choices = 4;
  g.g.shieldMax = g.g.shield = o.shield ?? 0;
  g.g.xpMul *= 1 + (o.xp ?? 0);
  if (o.wall) g.g.wallMax = g.g.wall = 80;
  g.pending = o.cards ?? 0;
  addDefender(g, 'canon');
  const pool = g.unlocked.filter((k) => k !== 'canon' && k !== 'mortero');
  for (let k = 0; k < 1 + (o.defenders ?? 0); k++) {
    const left = pool.filter((x) => !g.defenders.some((d) => d.kind === x));
    if (left.length) addDefender(g, left[Math.floor(rand(g) * left.length)]);
  }
  refreshSynergies(g);
  g.events.length = 0;
  return g;
}

/** Life of a basic virus at a wave, before the threat multiplier. */
export const hpAt = (wave: number) => 8 * Math.pow(1.12, wave - 1) * Math.pow(1.035, Math.max(0, wave - 25));
/** Core structures (wall spikes, orbit blades, beacon…) grow with the waves. */
export const coreScale = (wave: number) => Math.pow(1.09, Math.max(0, wave - 1));
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
  g.g.wall = g.g.wallMax;
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
function bolt(g: Game, x0: number, y0: number, x1: number, y1: number, c: string, life = 0.16) {
  const pts = [x0, y0];
  for (let j = 1; j <= 3; j++) pts.push(x0 + ((x1 - x0) * j) / 4 + (rand(g) - 0.5) * 12, y0 + ((y1 - y0) * j) / 4 + (rand(g) - 0.5) * 12);
  pts.push(x1, y1);
  g.fx.push({ k: 'bolt', pts, life, max: life, c });
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
  kind?: DefKind;
  raw?: boolean;
  pa?: boolean;
  bossx3?: boolean;
}
const has = (g: Game, id: string) => g.syn.includes(id);

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
  if (v.boss || v.elite) d *= g.g.bossMul * (o.bossx3 ? 3 : 1);
  const frozen = v.slowT > 0;
  if (o.brittle && frozen) d *= 1.5;
  if (frozen && o.kind === 'rayo' && has(g, 'superconductor')) d *= 2;
  if (frozen && v.burnT > 0 && has(g, 'choque')) d *= 1.6;
  if (frozen && g.defenders.some((x) => x.flags.weaken || x.fuse?.flags.weaken)) d *= 1.4;
  if (!o.pa) d *= 1 - v.armor;
  if (v.shield > 0) {
    const a = Math.min(v.shield, d);
    v.shield -= a;
    d -= a;
  }
  v.hp -= d;
  v.flash = 0.09;
  const slow = Math.min(0.92, (o.slow ?? 0) + g.g.hitSlow);
  if (slow > 0) {
    v.slowF = Math.max(v.slowF, v.boss ? slow * 0.5 : slow);
    v.slowT = Math.max(v.slowT, 1.3);
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
  // Death explosions are queued (a chain reaction in a big swarm would otherwise recurse forever).
  if (v.burnT > 0 && g.defenders.some((d) => d.flags.explodeBurn || d.fuse?.flags.explodeBurn)) booms.push({ x: v.x, y: v.y, r: 34, dmg: v.max * 0.25, burn: 4, c: '#ff6a1f' });
  if (g.g.chainReaction > 0) booms.push({ x: v.x, y: v.y, r: 26, dmg: v.max * g.g.chainReaction, burn: 0, c });
}

const booms: { x: number; y: number; r: number; dmg: number; burn: number; c: string }[] = [];
function flushBooms(g: Game) {
  for (let i = 0; i < booms.length && i < 400; i++) {
    const b = booms[i];
    ring(g, b.x, b.y, 4, b.r, b.c, 0.28, 2.5);
    for (const o of g.viruses) if (!o.dead && dist2(o, b) < (b.r + o.r) ** 2) hit(g, o, b.dmg, { raw: true, quiet: true, burn: b.burn });
  }
  booms.length = 0;
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
/** The toughest viruses in range (snipers pick these). */
function toughestN(g: Game, x: number, y: number, range: number, n: number): Virus[] {
  const list: Virus[] = [];
  for (const v of g.viruses) if (!v.dead && !v.hidden && dist2(v, { x, y }) < (range + v.r) ** 2) list.push(v);
  list.sort((a, b) => b.hp + (b.boss ? 1e9 : 0) - (a.hp + (a.boss ? 1e9 : 0)));
  return list.slice(0, n);
}

function splash(g: Game, x: number, y: number, r: number, dmg: number, s: Partial<Stats>, src: Defender | null, except?: Virus, color?: string) {
  ring(g, x, y, 4, r, color ?? (src ? DEF_INFO[src.kind].color : '#fff'), 0.3, 3);
  for (const v of g.viruses) if (!v.dead && v !== except && dist2(v, { x, y }) < (r + v.r) ** 2) hit(g, v, dmg, { crit: s.crit, critMult: s.critMult, slow: s.slow, burn: s.burn, quiet: true, src });
}

// ── Defenders ─────────────────────────────────────────────────────────────
/** A behaviour slot: the defender itself, or the second half of a fusion. */
interface Unit {
  kind: DefKind;
  stats: Stats;
  flags: Record<string, number>;
  cd: number;
  spin: number;
  pending: number;
  lockId: number;
  lockT: number;
  aim: number;
  drones?: Defender['drones'];
}

/** Stats with synergies and neighbour buffs applied. */
function effective(g: Game, d: Defender, u: Unit, idx: number): Stats {
  const s = { ...u.stats };
  const kinds = [d.kind, d.fuse?.kind].filter(Boolean) as DefKind[];
  for (const id of g.syn) {
    const sy = SYNERGIES.find((x) => x.id === id);
    if (!sy?.mods || !(kinds.includes(sy.a) || kinds.includes(sy.b))) continue;
    for (const [k, m] of Object.entries(sy.mods)) {
      const key = k as keyof Stats;
      if (key === 'count' || key === 'pierce' || key === 'chain') s[key] += m;
      else if (key === 'slow') s.slow = Math.min(0.9, s.slow * m);
      else s[key] *= m;
    }
  }
  // Cronos «Eco»: neighbours on the ring fire faster.
  const n = g.defenders.length;
  if (n > 1) {
    for (const j of [(idx + 1) % n, (idx - 1 + n) % n]) {
      const nb = g.defenders[j];
      if (nb !== d && (nb.flags.haste || nb.fuse?.flags.haste)) s.rate *= 1.3;
    }
  }
  return s;
}

function fireShots(g: Game, d: Defender, u: Unit, s: Stats, t: Virus, from = { x: d.x, y: d.y }) {
  const base = Math.atan2(t.y - from.y, t.x - from.x);
  u.aim = base;
  const n = Math.max(1, Math.round(s.count));
  const R = s.range * g.g.rangeMul;
  for (let i = 0; i < n; i++) {
    const a = base + (n > 1 ? -s.spread / 2 + (s.spread * i) / (n - 1) : 0) + (rand(g) - 0.5) * 0.06;
    if (u.kind === 'mortero' || u.kind === 'acido') {
      const tx = t.x + (n > 1 ? (rand(g) - 0.5) * s.spread * 90 : 0);
      const ty = t.y + (n > 1 ? (rand(g) - 0.5) * s.spread * 90 : 0);
      const T = 0.7 + Math.sqrt(dist2({ x: tx, y: ty }, from)) / 420;
      g.shots.push(shot(d, u, s, { x: from.x, y: from.y, px: from.x, py: from.y, vx: 0, vy: 0, tx, ty, T, t: 0, r: 5, life: T + 0.1, acid: u.kind === 'acido' }));
      continue;
    }
    const sp = s.speed;
    const life = u.kind === 'misil' ? 3 : u.kind === 'bumeran' ? (R * 2.2) / sp + 1 : (R * 1.4) / sp + 0.15;
    g.shots.push(shot(d, u, s, { x: from.x, y: from.y, px: from.x, py: from.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: u.kind === 'misil' ? 4.5 : u.kind === 'bumeran' ? 6 : u.kind === 'hielo' ? 3.6 : 3, life, target: t.id, ret: u.kind === 'bumeran' ? 0 : undefined }));
  }
}
function shot(d: Defender, u: Unit, s: Stats, o: Partial<Shot>): Shot {
  return {
    x: 0, y: 0, vx: 0, vy: 0, dmg: s.dmg, r: 3, life: 1, pierce: s.pierce, bounce: s.bounce, splash: s.splash, slow: s.slow, burn: s.burn, homing: s.homing, split: s.split,
    crit: s.crit, critMult: s.critMult, execute: s.execute, target: -1, src: d.id, kind: u.kind, hit: [], px: d.x, py: d.y, brittle: !!u.flags.brittle, pa: !!u.flags.pierceArmor, ...o,
  };
}

function updateDefender(g: Game, d: Defender, idx: number, dt: number) {
  runUnit(g, d, d as Unit, idx, dt);
  if (d.fuse) runUnit(g, d, d.fuse as Unit, idx, dt);
}

function runUnit(g: Game, d: Defender, u: Unit, idx: number, dt: number) {
  const s = effective(g, d, u, idx);
  const rate = s.rate * g.g.rateMul;
  const R = s.range * g.g.rangeMul;
  const color = DEF_INFO[u.kind].color;
  const common = { crit: s.crit, critMult: s.critMult, slow: s.slow, burn: s.burn, execute: s.execute, src: d, kind: u.kind, pa: !!u.flags.pierceArmor };
  switch (u.kind) {
    case 'canon':
    case 'hielo':
    case 'misil':
    case 'mortero':
    case 'acido':
    case 'bumeran': {
      u.cd -= dt;
      if (u.cd > 0) return;
      const t = nearest(g, d.x, d.y, R);
      if (!t) return;
      u.cd = 1 / rate;
      fireShots(g, d, u, s, t);
      return;
    }
    case 'laser': {
      const targets = nearestN(g, d.x, d.y, R, Math.round(s.count));
      if (!targets.length) {
        u.lockT = 0;
        return;
      }
      if (targets[0].id === u.lockId) u.lockT += dt;
      else {
        u.lockId = targets[0].id;
        u.lockT = 0;
      }
      const ramp = u.flags.ramp ? Math.min(4, 1 + u.lockT * 0.7) : 1;
      for (const t of targets) {
        u.aim = Math.atan2(t.y - d.y, t.x - d.x);
        g.fx.push({ k: 'beam', x1: d.x, y1: d.y, x2: t.x, y2: t.y, c: color, w: 2 + Math.min(4, s.dmg / 25) * (ramp > 2 ? 1.5 : 1), life: 0.05, max: 0.05 });
        hit(g, t, s.dmg * rate * dt * ramp, { ...common, quiet: true });
        let from = t;
        const seen = new Set([t.id]);
        for (let k = 0; k < s.chain; k++) {
          const nx = nearest(g, from.x, from.y, 75, seen);
          if (!nx) break;
          seen.add(nx.id);
          g.fx.push({ k: 'beam', x1: from.x, y1: from.y, x2: nx.x, y2: nx.y, c: color, w: 1.5, life: 0.05, max: 0.05 });
          hit(g, nx, s.dmg * rate * dt * 0.6, { ...common, quiet: true });
          from = nx;
        }
      }
      return;
    }
    case 'rayo': {
      u.cd -= dt;
      if (u.cd > 0) return;
      const starts = nearestN(g, d.x, d.y, R, Math.round(s.count));
      if (!starts.length) return;
      u.cd = 1 / rate;
      for (const st of starts) {
        const pts = [d.x, d.y];
        const seen = new Set<number>();
        let cur: Virus | null = st;
        let k = 0;
        while (cur && k <= s.chain) {
          seen.add(cur.id);
          const px = pts[pts.length - 2];
          const py = pts[pts.length - 1];
          for (let j = 1; j <= 3; j++) pts.push(px + ((cur.x - px) * j) / 4 + (rand(g) - 0.5) * 12, py + ((cur.y - py) * j) / 4 + (rand(g) - 0.5) * 12);
          pts.push(cur.x, cur.y);
          const fall = u.flags.nofall ? 1 : Math.pow(0.85, k);
          const target: Virus = cur;
          const tx = target.x;
          const ty = target.y;
          hit(g, target, s.dmg * fall, common);
          if (s.splash) splash(g, tx, ty, s.splash, s.dmg * fall * 0.5, s, d, target);
          cur = nearest(g, tx, ty, 90, seen);
          k++;
        }
        g.fx.push({ k: 'bolt', pts, life: 0.16, max: 0.16, c: color });
        u.aim = Math.atan2(st.y - d.y, st.x - d.x);
      }
      return;
    }
    case 'pulso': {
      if (u.flags.field) {
        u.spin += dt;
        for (const v of g.viruses) if (!v.dead && dist2(v, d) < (R + v.r) ** 2) hit(g, v, s.dmg * rate * 0.6 * dt, { ...common, quiet: true });
        if (u.spin > 0.5) {
          u.spin = 0;
          ring(g, d.x, d.y, R * 0.3, R, color, 0.5, 1.5);
        }
        return;
      }
      u.cd -= dt;
      if (u.pending > 0) {
        u.lockT -= dt;
        if (u.lockT <= 0) {
          u.pending -= 1;
          u.lockT = 0.22;
          pulse(g, d, s, R, color, common);
        }
      }
      if (u.cd > 0) return;
      if (!nearest(g, d.x, d.y, R)) return;
      u.cd = 1 / rate;
      pulse(g, d, s, R, color, common);
      u.pending = Math.round(s.count) - 1;
      u.lockT = 0.22;
      return;
    }
    case 'cuchillas': {
      u.spin += rate * dt;
      const n = Math.round(s.count);
      for (let b = 0; b < n; b++) {
        const a = u.spin + (b * Math.PI * 2) / n;
        const bx = d.x + Math.cos(a) * R;
        const by = d.y + Math.sin(a) * R;
        for (const v of g.viruses) {
          if (v.dead || v.hidden) continue;
          if (dist2(v, { x: bx, y: by }) > (v.r + 7) ** 2) continue;
          const key = d.id * 64 + b + (u === (d as Unit) ? 0 : 32);
          if ((v.hits[key] ?? -1) > g.t) continue;
          v.hits[key] = g.t + 0.28;
          hit(g, v, s.dmg, common);
          if (s.knock) v.kb += s.knock * (v.boss ? 0.3 : 1);
          if (u.flags.leech) g.hp = Math.min(g.maxHp, g.hp + 0.12);
          burst(g, bx, by, color, 2, 80, 1.6);
        }
      }
      return;
    }
    case 'francotirador': {
      u.cd -= dt;
      if (u.cd > 0) return;
      const targets = toughestN(g, d.x, d.y, R, Math.round(s.count));
      if (!targets.length) return;
      u.cd = 1 / rate;
      for (const t of targets) {
        const a = Math.atan2(t.y - d.y, t.x - d.x);
        u.aim = a;
        const ex = d.x + Math.cos(a) * (u.flags.line ? R + 60 : Math.sqrt(dist2(t, d)));
        const ey = d.y + Math.sin(a) * (u.flags.line ? R + 60 : Math.sqrt(dist2(t, d)));
        g.fx.push({ k: 'beam', x1: d.x, y1: d.y, x2: ex, y2: ey, c: color, w: 1.6, life: 0.14, max: 0.14 });
        burst(g, t.x, t.y, color, 5, 140, 1.8);
        if (u.flags.line) {
          for (const v of g.viruses) if (!v.dead && !v.hidden && segDist2(v, d, { x: ex, y: ey }) < (v.r + 5) ** 2) hit(g, v, s.dmg, { ...common, bossx3: !!u.flags.bossx3 });
        } else hit(g, t, s.dmg, { ...common, bossx3: !!u.flags.bossx3 });
      }
      g.shake = Math.max(g.shake, 1.5);
      return;
    }
    case 'llamas': {
      const t = nearest(g, d.x, d.y, R);
      if (!t) return;
      const aim = Math.atan2(t.y - d.y, t.x - d.x);
      u.aim = aim;
      const half = u.flags.ring ? Math.PI : s.spread / 2;
      for (const v of g.viruses) {
        if (v.dead || v.hidden || dist2(v, d) > (R + v.r) ** 2) continue;
        let diff = Math.atan2(v.y - d.y, v.x - d.x) - aim;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) <= half) hit(g, v, s.dmg * rate * dt, { ...common, quiet: true });
      }
      // Flames
      for (let k = 0; k < (u.flags.ring ? 4 : 2) && g.fx.length < MAX_FX; k++) {
        const a = aim + (rand(g) - 0.5) * 2 * half;
        const sp = R * (2.2 + rand(g));
        const life = 0.35;
        g.fx.push({ k: 'p', x: d.x, y: d.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, c: rand(g) < 0.5 ? '#ff6a1f' : '#ffd60a', s: 3.2 });
      }
      return;
    }
    case 'gravedad': {
      u.cd -= dt;
      if (u.cd > 0) return;
      const t = nearest(g, d.x, d.y, R);
      if (!t) return;
      u.cd = 1 / rate;
      const n = Math.round(s.count);
      for (let i = 0; i < n; i++) {
        const ox = i ? (rand(g) - 0.5) * 80 : 0;
        const oy = i ? (rand(g) - 0.5) * 80 : 0;
        const dur = 3 * (u.flags.dur || 1);
        g.zones.push(zone('well', t.x + ox, t.y + oy, s.splash, dur, s, d, u.flags, { dps: s.dmg, pull: s.knock }));
      }
      return;
    }
    case 'drones': {
      const n = Math.round(s.count);
      u.drones ??= [];
      while (u.drones.length < n) u.drones.push({ x: d.x, y: d.y, cd: rand(g), a: rand(g) * 6 });
      u.drones.length = n;
      for (const dr of u.drones) {
        dr.a += dt * 2.5;
        const t = nearest(g, dr.x, dr.y, 160) ?? nearest(g, 0, 0, R + RING_R);
        let tx: number;
        let ty: number;
        if (t) {
          tx = t.x + Math.cos(dr.a) * 34;
          ty = t.y + Math.sin(dr.a) * 34;
        } else {
          tx = d.x + Math.cos(dr.a) * 22;
          ty = d.y + Math.sin(dr.a) * 22;
        }
        const dx = tx - dr.x;
        const dy = ty - dr.y;
        const dl = Math.hypot(dx, dy) || 1;
        const sp = Math.min(dl / dt, 190);
        dr.x += (dx / dl) * sp * dt;
        dr.y += (dy / dl) * sp * dt;
        dr.cd -= dt;
        if (t && dr.cd <= 0 && dist2(t, dr) < 70 ** 2) {
          dr.cd = 1 / rate;
          const a = Math.atan2(t.y - dr.y, t.x - dr.x);
          g.shots.push(shot(d, u, s, { x: dr.x, y: dr.y, px: dr.x, py: dr.y, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, r: 2.4, life: 0.5, target: t.id, homing: 0 }));
        }
      }
      return;
    }
    case 'minas': {
      u.cd -= dt;
      if (u.cd > 0) return;
      const t = nearest(g, 0, 0, R + RING_R);
      if (!t) return;
      u.cd = 1 / rate;
      const mine = g.zones.filter((z) => z.k === 'mine' && z.src === d.id).length;
      if (mine > Math.round(s.count) * 6) return;
      const ang = Math.atan2(t.y, t.x);
      const dist = Math.sqrt(dist2(t, { x: 0, y: 0 }));
      for (let i = 0; i < Math.round(s.count); i++) {
        const a = ang + (rand(g) - 0.5) * 0.5;
        const r = Math.max(WALL_R * 0.9, Math.min(dist - 10, 85 + rand(g) * 110));
        g.zones.push(zone('mine', Math.cos(a) * r, Math.sin(a) * r, s.splash, 30, s, d, u.flags, { dmg: s.dmg, pull: s.knock }));
      }
      return;
    }
    case 'cronos': {
      // Permanent slow field
      for (const v of g.viruses) {
        if (v.dead || dist2(v, d) > (R + v.r) ** 2) continue;
        v.slowF = Math.max(v.slowF, v.boss ? s.slow * 0.5 : s.slow);
        v.slowT = Math.max(v.slowT, 0.2);
      }
      u.cd -= dt;
      if (u.cd > 0) return;
      if (!nearest(g, d.x, d.y, R)) return;
      u.cd = 1 / rate;
      ring(g, d.x, d.y, 6, R, color, 0.6, 3);
      for (const v of g.viruses) {
        if (v.dead || dist2(v, d) > (R + v.r) ** 2) continue;
        hit(g, v, s.dmg, common);
        if (u.flags.freeze) {
          v.slowF = v.boss ? 0.5 : 0.95;
          v.slowT = 0.9;
        }
        if (s.knock) v.kb += s.knock * (v.boss ? 0.3 : 1);
      }
      return;
    }
  }
}

const segDist2 = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L));
  return dist2(p, { x: a.x + dx * t, y: a.y + dy * t });
};

function zone(k: Zone['k'], x: number, y: number, r: number, t: number, s: Stats, d: Defender, flags: Record<string, number>, o: Partial<Zone>): Zone {
  return { k, x, y, r, t, max: t, dps: 0, slow: s.slow, pull: 0, burn: s.burn, dmg: 0, split: s.split, src: d.id, flags, ...o };
}

function pulse(g: Game, d: Defender, s: Stats, R: number, color: string, common: HitOpts) {
  ring(g, d.x, d.y, 8, R, color, 0.42, 3);
  for (const v of g.viruses) {
    if (v.dead || dist2(v, d) > (R + v.r) ** 2) continue;
    hit(g, v, s.dmg, common);
    if (s.knock) v.kb += s.knock * (v.boss ? 0.3 : 1);
  }
}

function updateShots(g: Game, dt: number) {
  const keep: Shot[] = [];
  for (const s of g.shots) {
    s.px = s.x;
    s.py = s.y;
    const src = g.defenders.find((d) => d.id === s.src) ?? null;
    if (s.T !== undefined) {
      // Lobbed shell: mortar or acid.
      s.t! += dt;
      const k = Math.min(1, s.t! / s.T);
      const sx = src ? src.x : 0;
      const sy = src ? src.y : 0;
      s.x = sx + (s.tx! - sx) * k;
      s.y = sy + (s.ty! - sy) * k;
      if (k >= 1) {
        if (s.acid && src) {
          const f = src.kind === 'acido' ? src.flags : src.fuse?.flags ?? {};
          const dur = 3.2 * (f.dur || 1);
          const burn = s.burn + (has(g, 'gas') ? 10 : 0);
          g.zones.push({ k: 'acid', x: s.tx!, y: s.ty!, r: s.splash, t: dur, max: dur, dps: s.dmg, slow: s.slow, pull: 0, burn, dmg: 0, split: 0, src: src.id, flags: f });
          burst(g, s.tx!, s.ty!, '#b6ff3d', 6, 90, 2);
        } else {
          splash(g, s.tx!, s.ty!, s.splash, s.dmg, s, src);
          burst(g, s.tx!, s.ty!, '#ff8a5a', 8, 140, 2.4);
          g.shake = Math.max(g.shake, 2);
        }
        continue;
      }
      keep.push(s);
      continue;
    }
    if (s.ret !== undefined && src) {
      // Boomerang: out, then back to the thrower, cutting both ways.
      const R = (src.kind === 'bumeran' ? src.stats.range : src.fuse?.stats.range ?? 170) * g.g.rangeMul;
      if (s.ret === 0 && dist2(s, src) > R * R) {
        s.ret = 1;
        s.hit = [];
      }
      if (s.ret === 1) {
        const a = Math.atan2(src.y - s.y, src.x - s.x);
        const sp = Math.hypot(s.vx, s.vy);
        s.vx = Math.cos(a) * sp;
        s.vy = Math.sin(a) * sp;
        if (dist2(s, src) < 14 ** 2) continue;
      }
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
      hit(g, v, s.dmg, { crit: s.crit, critMult: s.critMult, slow: s.slow, burn: s.burn, execute: s.execute, brittle: s.brittle, pa: s.pa, src, kind: s.kind === 'core' || s.kind === 'frag' ? undefined : s.kind, quiet: s.kind === 'frag' || s.kind === 'bumeran' });
      if (s.splash) splash(g, s.x, s.y, s.splash, s.dmg * 0.6, s, src, v);
      if (s.split) {
        for (let k = 0; k < s.split; k++) {
          const a = Math.atan2(s.vy, s.vx) + (k - (s.split - 1) / 2) * 0.7;
          g.shots.push({ ...s, kind: 'frag', vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, dmg: s.dmg * 0.4, life: 0.35, split: 0, splash: s.kind === 'misil' ? s.splash * 0.5 : 0, pierce: 0, bounce: 0, homing: 0, r: 2.4, hit: [v.id], ret: undefined });
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

function updateZones(g: Game, dt: number) {
  const keep: Zone[] = [];
  for (const z of g.zones) {
    z.t -= dt;
    const src = g.defenders.find((d) => d.id === z.src) ?? null;
    if (z.k === 'mine') {
      // Magnetic mines pull nearby viruses in.
      let boom = false;
      for (const v of g.viruses) {
        if (v.dead || v.hidden) continue;
        const d2 = dist2(v, z);
        if (z.pull && d2 < 70 ** 2) {
          const d = Math.sqrt(d2) || 1;
          const k = (z.pull * (v.boss ? 0.3 : 1) * dt) / d;
          v.x += (z.x - v.x) * k;
          v.y += (z.y - v.y) * k;
        }
        if (d2 < (v.r + 9) ** 2) boom = true;
      }
      if (boom) {
        const slow = Math.min(0.9, z.slow * (has(g, 'trampa') ? 1.6 : 1));
        splash(g, z.x, z.y, z.r, z.dmg, { slow, burn: z.burn, crit: 0.1, critMult: 2 }, src, undefined, '#ff4f6d');
        burst(g, z.x, z.y, '#ff8a5a', 10, 150, 2.4);
        g.shake = Math.max(g.shake, 2.5);
        for (let k = 0; k < z.split; k++) {
          const a = (k / Math.max(1, z.split)) * Math.PI * 2;
          g.shots.push({ x: z.x, y: z.y, px: z.x, py: z.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, dmg: z.dmg * 0.4, r: 2.4, life: 0.35, pierce: 0, bounce: 0, splash: 18, slow: 0, burn: 0, homing: 0, split: 0, crit: 0.05, critMult: 2, execute: 0, target: -1, src: z.src, kind: 'frag', hit: [] });
        }
        continue;
      }
      if (z.t > 0) keep.push(z);
      continue;
    }
    for (const v of g.viruses) {
      if (v.dead) continue;
      const d2 = dist2(v, z);
      const reach = z.k === 'well' ? z.r * 1.35 : z.r;
      if (d2 > (reach + v.r) ** 2) continue;
      if (z.k === 'well') {
        const d = Math.sqrt(d2) || 1;
        const k = Math.min(1, (z.pull * (v.boss ? 0.3 : 1) * dt) / d);
        v.x += (z.x - v.x) * k;
        v.y += (z.y - v.y) * k;
      }
      if (z.flags.corrode) v.armor = 0;
      hit(g, v, z.dps * dt * (z.k === 'acid' && has(g, 'sopa') ? 1 : 1), { slow: z.slow, burn: z.burn, quiet: true, src, kind: z.k === 'acid' ? 'acido' : 'gravedad', crit: 0 });
      if (v.dead && z.k === 'acid' && z.flags.contagio && g.zones.length < 80) keep.push({ ...z, x: v.x, y: v.y, t: 2, max: 2, r: z.r * 0.75, flags: { ...z.flags, contagio: 0 } });
    }
    if (z.t <= 0) {
      if (z.k === 'well' && z.flags.implode) splash(g, z.x, z.y, z.r * 1.2, z.dps * 4, { crit: 0.1, critMult: 2 }, src, undefined, '#9d7bff');
      continue;
    }
    keep.push(z);
  }
  g.zones = keep;
}

// ── Core structures ───────────────────────────────────────────────────────
function updateStructures(g: Game, dt: number) {
  const G = g.g;
  const cs = coreScale(g.wave);
  if (G.orbit > 0) {
    G.orbitA += dt * 2.1;
    for (let b = 0; b < G.orbit; b++) {
      const a = G.orbitA + (b * Math.PI * 2) / G.orbit;
      const bx = Math.cos(a) * ORBIT_R;
      const by = Math.sin(a) * ORBIT_R;
      for (const v of g.viruses) {
        if (v.dead || v.hidden || dist2(v, { x: bx, y: by }) > (v.r + 9) ** 2) continue;
        const key = 900000 + b;
        if ((v.hits[key] ?? -1) > g.t) continue;
        v.hits[key] = g.t + 0.3;
        hit(g, v, 10 * cs, { raw: true, quiet: true });
        burst(g, bx, by, '#e8f6ff', 2, 90, 1.6);
      }
    }
  }
  if (G.faro > 0) {
    G.faroA += dt * 1.9;
    const L = 300;
    for (let b = 0; b < G.faro; b++) {
      const a = G.faroA + (b * Math.PI * 2) / G.faro;
      const end = { x: Math.cos(a) * L, y: Math.sin(a) * L };
      for (const v of g.viruses) if (!v.dead && !v.hidden && segDist2(v, { x: 0, y: 0 }, end) < (v.r + 6) ** 2) hit(g, v, 24 * cs * dt, { raw: true, quiet: true, burn: 2 });
    }
  }
  if (G.coreMines > 0) {
    G.coreMinesT -= dt;
    if (G.coreMinesT <= 0 && g.phase === 'wave') {
      G.coreMinesT = 4;
      for (let k = 0; k < G.coreMines; k++) {
        const a = rand(g) * Math.PI * 2;
        const r = 115 + rand(g) * 110;
        g.zones.push({ k: 'mine', x: Math.cos(a) * r, y: Math.sin(a) * r, r: 38, t: 25, max: 25, dps: 0, slow: 0, pull: 0, burn: 0, dmg: 30 * cs, split: 0, src: -1, flags: {} });
      }
    }
  }
  if (G.arc > 0) {
    G.arcT -= dt;
    if (G.arcT <= 0) {
      const targets = nearestN(g, 0, 0, 175, 1 + G.arc);
      if (targets.length) {
        G.arcT = 1.3;
        for (const t of targets) {
          bolt(g, 0, 0, t.x, t.y, '#bfe9ff');
          hit(g, t, 16 * cs, { raw: true, slow: 0.3 });
        }
      }
    }
  }
  if (G.corePulse > 0) {
    G.corePulseT -= dt;
    if (G.corePulseT <= 0 && nearest(g, 0, 0, 120)) {
      G.corePulseT = Math.max(2.2, 6.5 - G.corePulse);
      ring(g, 0, 0, CORE_R, 120, '#ffffff', 0.5, 4);
      for (const v of g.viruses) {
        if (v.dead || dist2(v, { x: 0, y: 0 }) > 120 ** 2) continue;
        hit(g, v, 12 * cs, { raw: true, quiet: true });
        v.kb += v.boss ? 15 : 55;
      }
    }
  }
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
      hit(g, o, 14 * coreScale(g.wave), { raw: true, quiet: true });
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

// ── Main step ─────────────────────────────────────────────────────────────
export function update(g: Game, dt: number) {
  if (g.over) {
    updateFx(g, dt);
    return;
  }
  dt = Math.min(dt, 0.05);
  g.t += dt;
  g.ring += dt * 0.22;
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
  });
  g.defenders.forEach((d, i) => updateDefender(g, d, i, dt));
  // The core's satellite gun, orbiting the core
  if (g.g.turret > 0) {
    g.g.turretCd -= dt;
    if (g.g.turretCd <= 0) {
      const sa = g.t * 1.4;
      const from = { x: Math.cos(sa) * 36, y: Math.sin(sa) * 36 };
      const t = nearest(g, from.x, from.y, 190);
      if (t) {
        g.g.turretCd = 0.7;
        const fake = makeDefender(-1, 'canon');
        const st: Stats = { ...fake.stats, dmg: (6 * coreScale(g.wave)) / passive(g.wave), count: g.g.turret, spread: 0.12 * g.g.turret };
        fireShots(g, fake, fake as Unit, st, t, from);
        for (const s of g.shots) if (s.src === -1) s.kind = 'core';
      }
    }
  }
  updateShots(g, dt);
  updateZones(g, dt);
  updateStructures(g, dt);

  // Viruses
  const G = g.g;
  const cs = coreScale(g.wave);
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
    if (G.brake && dist < 125) sp *= 1 - G.brake;
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
    // Wall: blocks the viruses until it breaks; its spikes hurt.
    const nd = Math.hypot(v.x, v.y) || 1;
    const atWall = nd < WALL_R + v.r + 4 && nd > WALL_R - 8;
    if (G.wall > 0 && nd < WALL_R + v.r && dist >= WALL_R + v.r - 2) {
      const k = (WALL_R + v.r) / nd;
      v.x *= k;
      v.y *= k;
      G.wall -= v.dmg * 0.9 * dt;
      if (G.wall <= 0) {
        G.wall = 0;
        g.events.push('wallbreak');
        ring(g, 0, 0, WALL_R - 10, WALL_R + 30, '#c8ff2e', 0.5, 4);
        g.shake = Math.max(g.shake, 6);
      }
    }
    if (G.thorns > 0 && atWall) hit(g, v, 14 * G.thorns * cs * dt, { raw: true, quiet: true, crit: 0 });
    if (v.dead) continue;
    if (G.aura > 0 && nd < 82) hit(g, v, G.aura * cs * dt, { raw: true, quiet: true, crit: 0 });
    if (!v.dead && nd < CORE_R + v.r) coreHit(g, v);
  }
  flushBooms(g);
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
  return Math.min(2500, Math.round((Math.max(0, g.wave - 1) * 9 + g.kills / 6 + g.bosses * 40) * g.g.energyMul));
}
/** «Datos» for the Laboratorio. */
export function datosFor(g: Game, bonus = 0): number {
  return Math.min(600, Math.round((Math.max(0, g.wave - 1) * 3 + g.bosses * 12 + g.kills / 40) * (1 + bonus)));
}

export interface InvasionSnapshot {
  wave: number;
  hp: number;
  maxHp: number;
  g: Globals;
  defenders: Pick<Defender, 'id' | 'kind' | 'name' | 'lvl' | 'evo' | 'stats' | 'flags' | 'kills' | 'fuse'>[];
  xp: number;
  level: number;
  pending: number;
  kills: number;
  bosses: number;
  taken: string[];
  seed: number;
  t: number;
  nextId: number;
  unlocked?: DefKind[];
}

/** Saved at the start of each wave so a closed app resumes from there. */
export function snapshot(g: Game): InvasionSnapshot {
  return structuredClone({
    wave: g.wave - 1, hp: g.hp, maxHp: g.maxHp, g: g.g, xp: g.xp, level: g.level, pending: g.pending, kills: g.kills, bosses: g.bosses, taken: g.taken, seed: g.seed, t: g.t, nextId: g.nextId,
    unlocked: g.unlocked,
    defenders: g.defenders.map(({ id, kind, name, lvl, evo, stats, flags, kills, fuse }) => ({ id, kind, name, lvl, evo, stats, flags, kills, fuse })),
  });
}

export function restore(s: InvasionSnapshot, arena: number, arenaY = arena): Game {
  const g = newGame(s.seed, arena, arenaY, { unlocked: s.unlocked });
  Object.assign(g, {
    wave: s.wave, hp: s.hp, maxHp: s.maxHp, g: { ...defaultGlobals(), ...s.g }, xp: s.xp, level: s.level, pending: s.pending, kills: s.kills, bosses: s.bosses,
    taken: [...s.taken], t: s.t, nextId: s.nextId, phase: 'break', breakT: 1.6,
  });
  g.defenders = s.defenders.map((d) => ({ ...makeDefender(d.id, d.kind as DefKind), ...structuredClone(d) }));
  refreshSynergies(g);
  g.events.length = 0;
  return g;
}
