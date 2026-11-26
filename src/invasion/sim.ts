import { addDefender, refreshSynergies } from './cards';
import { BASE_KINDS, behOf, chipPos, CHIPS, DEF_EL, DEF_INFO, effectiveness, ELEMENT_LIST, ELEMENTS, makeDefender, SYNERGIES, ULT_TIME, ULTS, type Element } from './defenders';
import type { DefKind, Defender, Game, Globals, Shot, Stats, Virus, VirusType, Zone } from './types';

export const CORE_R = 22;
export const RING_R = 64;
export const WALL_R = 102;
export const ORBIT_R = 132;
const MAX_FX = 700;
const MAX_ALIVE = 300;
/** Viruses that linger get enraged: faster, and in the end immune to slows and pushes. */
const RAGE_T = 25;

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
    wall: 0, wallMax: 0, thorns: 0, orbit: 0, orbitA: 0, faro: 0, faroA: 0, coreMines: 0, coreMinesT: 2, arc: 0, arcT: 1, corePulse: 0, corePulseT: 3, asc: [], ascT: 0, wallT: 0,
    nova: 0, novaT: 0, rerolls: 1, choices: 3, execute: 0, bossMul: 1, firstHit: 0, chainReaction: 0, hitSlow: 0, hitBurn: 0,
    coreEvo: 0, elBonus: {}, chipFast: 0,
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
  /** First defender (instead of the cannon). */
  start?: DefKind;
  /** +damage per element. */
  elBonus?: Record<string, number>;
  chipFast?: number;
}

export function newGame(seed = (Date.now() ^ (Math.random() * 1e9)) | 0, arena = 300, arenaY = arena, o: StartOpts = {}): Game {
  const g: Game = {
    t: 0, arena, arenaY, wave: 0, waveT: 0, waveLen: 0, phase: 'break', breakT: 1.6, spawns: [], hp: 100, maxHp: 100, g: defaultGlobals(), defenders: [], viruses: [], shots: [], fx: [],
    xp: 0, level: 1, pending: 0, kills: 0, bosses: 0, taken: [], ring: 0, zones: [], syn: [], synAdj: [], unlocked: [...new Set([...BASE_KINDS, ...(o.unlocked ?? [])])],
    shake: 0, hurt: 0, over: false, nextId: 1, seed, events: [], chips: 1, sfx: [], slowmo: 0,
  };
  g.maxHp = g.hp = 100 + (o.hp ?? 0);
  g.g.dmgMul *= 1 + (o.dmg ?? 0);
  g.g.rateMul *= 1 + (o.rate ?? 0);
  g.g.rerolls += o.rerolls ?? 0;
  if (o.choices) g.g.choices = 4;
  g.g.shieldMax = g.g.shield = o.shield ?? 0;
  g.g.xpMul *= 1 + (o.xp ?? 0);
  if (o.wall) {
    g.g.wallMax = g.g.wall = 120;
    g.taken.push('muro');
  }
  g.pending = o.cards ?? 0;
  g.g.elBonus = { ...(o.elBonus ?? {}) };
  g.g.chipFast = o.chipFast ?? 0;
  const first = o.start && g.unlocked.includes(o.start) ? o.start : 'canon';
  addDefender(g, first);
  const pool = g.unlocked.filter((k) => k !== first && k !== 'mortero');
  for (let k = 0; k < 1 + (o.defenders ?? 0); k++) {
    const left = pool.filter((x) => !g.defenders.some((d) => d.kind === x));
    if (left.length) addDefender(g, left[Math.floor(rand(g) * left.length)]);
  }
  refreshSynergies(g);
  g.events.length = 0;
  return g;
}

/** Life of a basic virus at a wave, before the threat multiplier. */
export const hpAt = (wave: number) => 8 * Math.pow(1.12, wave - 1) * Math.pow(1.055, Math.max(0, wave - 18));
/** Core structures (wall spikes, orbit blades, beacon…) grow with the waves. */
export const coreScale = (wave: number) => Math.pow(1.09, Math.max(0, wave - 1));
/** Defenders get a little stronger every wave on their own. */
const passive = (wave: number) => Math.pow(1.04, Math.max(0, wave - 1));
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
  titan: { hp: 140, sp: 0.3, r: 46, dmg: 60, xp: 120, boss: true, armor: 0.2, color: '#ff1f4f' },
};
export const BOSS_NAMES: Partial<Record<VirusType, string>> = { coloso: 'Coloso', reina: 'Reina del enjambre', espectro: 'Espectro', acorazado: 'Acorazado', hidra: 'Hidra', titan: 'Titán' };
export const TITANS = ['Leviatán', 'Omega', 'Behemot', 'Quimera', 'Singularidad negra', 'El Último'];
export const titanName = (wave: number) => TITANS[Math.min(TITANS.length - 1, Math.floor(wave / 25) - 1)] ?? 'Titán';
/** Random wave modifiers (no warning: they show when the wave starts). */
export const MODS: Record<string, { name: string; desc: string }> = {
  apagon: { name: 'Apagón', desc: 'Solo ves los virus cerca del núcleo' },
  tormenta: { name: 'Tormenta', desc: 'Caen rayos y lo eléctrico pega más' },
  elites: { name: 'Lluvia de élites', desc: 'La mitad son élites' },
  dorada: { name: 'Oleada dorada', desc: 'Doble de experiencia' },
  enjambre: { name: 'Enjambre', desc: 'Muchos más virus, más débiles' },
  blindados: { name: 'Blindados', desc: 'Todos llevan blindaje' },
  rapidos: { name: 'Estampida', desc: 'Los virus corren más' },
};
const BOSSES: VirusType[] = ['coloso', 'reina', 'espectro', 'acorazado', 'hidra'];
const UNLOCK: [VirusType, number, number][] = [
  ['basico', 1, 3], ['rapido', 2, 2], ['tanque', 3, 1], ['zigzag', 4, 1.5], ['divisor', 6, 1], ['escudo', 7, 1], ['kamikaze', 7, 1],
  ['curandero', 8, 0.6], ['fantasma', 9, 0.8], ['invocador', 11, 0.5],
];

export const isBossWave = (wave: number) => wave % 5 === 0;
const BOSS_EL: Partial<Record<VirusType, Element>> = { coloso: 'metal', reina: 'bio', espectro: 'vacio', acorazado: 'electrico', hidra: 'fuego' };

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
  // A random modifier now and then.
  g.mod = w >= 6 && rand(g) < 0.3 ? Object.keys(MODS)[Math.floor(rand(g) * Object.keys(MODS).length)] : undefined;
  if (g.mod === 'enjambre') for (let k = Math.round(spawns.length * 0.7); k > 0; k--) spawns.push({ at: rand(g) * len, type: 'mini' });
  if (g.mod === 'elites') for (const sp of spawns) if (rand(g) < 0.5) sp.elite = true;
  if (g.mod) g.events.push(`mod:${g.mod}`);
  // Every 25 waves: a titan.
  if (w % 25 === 0) spawns.push({ at: len * 0.15, type: 'titan' });
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
  const max = hpAt(w) * d.hp * g.g.enemyHp * eliteMul * (opts.maxMul ?? 1) * (g.mod === 'enjambre' && !d.boss ? 0.6 : 1);
  const v: Virus = {
    id: g.nextId++, type, x: opts.x ?? ca * A, y: opts.y ?? sa * A, r: d.r * (opts.elite ? 1.35 : 1) * (opts.maxMul && opts.maxMul < 1 ? 0.78 : 1),
    hp: max, max, shield: d.shield ? max * d.shield : 0, speed: 32 * Math.min(1.7, 1 + 0.015 * (w - 1)) * d.sp * g.g.enemySpeed * (g.mod === 'rapidos' ? 1.35 : 1), armor: Math.min(0.7, (d.armor ?? 0) + (g.mod === 'blindados' ? 0.3 : 0)), dmg: d.dmg * (opts.elite ? 1.5 : 1),
    xp: d.xp * (opts.elite ? 3 : 1), boss: !!d.boss, elite: !!opts.elite, gen: opts.gen ?? 0, slowF: 0, slowT: 0, burn: 0, burnT: 0, flash: 0, spin: rand(g) * 6, kb: 0, t: 0,
    timer: 1 + rand(g) * 2, hidden: false, dead: false, hits: {},
    el: d.boss ? BOSS_EL[type] ?? ELEMENT_LIST[Math.floor(rand(g) * ELEMENT_LIST.length)] : w >= 3 ? ELEMENT_LIST[Math.floor(rand(g) * ELEMENT_LIST.length)] : undefined,
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
function bolt(g: Game, x0: number, y0: number, x1: number, y1: number, c: string, life = 0.24, w = 3) {
  const pts = [x0, y0];
  const segs = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 14));
  for (let j = 1; j < segs; j++) pts.push(x0 + ((x1 - x0) * j) / segs + (rand(g) - 0.5) * 14, y0 + ((y1 - y0) * j) / segs + (rand(g) - 0.5) * 14);
  pts.push(x1, y1);
  g.fx.push({ k: 'bolt', pts, life, max: life, c, w });
}
/** A bright hit: flash and sparks. */
function impact(g: Game, x: number, y: number, c: string, r = 10) {
  if (g.fx.length < MAX_FX) g.fx.push({ k: 'flash', x, y, r, life: 0.14, max: 0.14, c });
  burst(g, x, y, c, 4, 150, 1.6);
}
function muzzle(g: Game, x: number, y: number, a: number, c: string) {
  if (g.fx.length < MAX_FX) g.fx.push({ k: 'flash', x: x + Math.cos(a) * 12, y: y + Math.sin(a) * 12, r: 7, life: 0.08, max: 0.08, c });
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
  /** Element override (prism shards). */
  el?: string;
}
const has = (g: Game, id: string) => g.syn.includes(id);

export function hit(g: Game, v: Virus, dmg: number, o: HitOpts = {}) {
  if (v.dead) return;
  let d = dmg;
  if (!o.raw) d *= g.g.dmgMul * passive(g.wave);
  // Elements: super effective ×1.6, not very effective ×0.6.
  const att = (o.el as Element | undefined) ?? (o.kind ? DEF_EL[o.kind] : undefined);
  const eff = effectiveness(att, v.el as Element | undefined);
  d *= eff * (1 + (att ? g.g.elBonus[att] ?? 0 : 0));
  if (g.mod === 'tormenta' && att === 'electrico') d *= 1.5;
  if (v.vuln && v.vuln > 0) d *= v.vulnDeep ? 2 : 1.5;
  if (eff > 1.3 && !o.quiet && rand(g) < 0.15 && g.fx.length < MAX_FX) g.fx.push({ k: 'txt', x: v.x, y: v.y - v.r - 10, s: '¡Eficaz!', life: 0.7, max: 0.7, c: ELEMENTS[att!].color });
  let crit = false;
  if (rand(g) < (o.crit ?? 0.05) + g.g.critAdd) {
    d *= o.critMult ?? 2;
    crit = true;
  }
  if (g.g.firstHit && v.hp >= v.max) d *= 1 + g.g.firstHit;
  if (v.boss || v.elite) d *= g.g.bossMul * (o.bossx3 ? 3 : 1);
  const frozen = v.slowT > 0;
  if (o.brittle && frozen) d *= 1.5;
  if (frozen && o.kind === 'rayo' && has(g, 'superconductor')) d *= g.synAdj.includes('superconductor') ? 2.8 : 2;
  if (frozen && v.burnT > 0 && has(g, 'choque')) d *= g.synAdj.includes('choque') ? 2.1 : 1.6;
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
  if (crit && !o.quiet && g.fx.length < MAX_FX) {
    // Big crits get big numbers.
    const z = Math.min(26, 12 + Math.log10(1 + d / Math.max(1, hpAt(g.wave) * 0.3)) * 9);
    g.fx.push({ k: 'txt', x: v.x + (rand(g) - 0.5) * 8, y: v.y - v.r, s: fmtDmg(d), life: 0.8, max: 0.8, c: z > 18 ? '#ff8a1f' : '#ffd60a', z });
  }
  if (v.boss && v.hp > 0) {
    const ph = v.hp < v.max * 0.33 ? 2 : v.hp < v.max * 0.66 ? 1 : 0;
    if (ph > (v.phase ?? 0)) bossPhase(g, v, ph);
  }
  if (v.hp <= 0) kill(g, v, o.src ?? null);
}
const fmtDmg = (d: number) => (d >= 1e6 ? `${(d / 1e6).toFixed(1)}M` : d >= 1e3 ? `${(d / 1e3).toFixed(1)}k` : String(Math.round(d)));

function kill(g: Game, v: Virus, src: Defender | null) {
  if (v.dead) return;
  v.dead = true;
  g.kills += 1;
  g.sfx.push(v.boss ? 'bossdie' : 'kill');
  if (src) src.kills += 1;
  g.xp += v.xp * g.g.xpMul * (g.mod === 'dorada' ? 2 : 1);
  if (v.vuln && v.vulnSpread) {
    const o = nearest(g, v.x, v.y, 90, new Set([v.id]));
    if (o) {
      o.vuln = 4;
      o.vulnDeep = v.vulnDeep;
      o.vulnSpread = true;
    }
  }
  if (v.type === 'titan') {
    g.pending += 3;
    g.bosses += 2;
    g.events.push('titankill');
    g.slowmo = 1.2;
  } else if (v.boss) g.slowmo = Math.max(g.slowmo, 0.5);
  const c = VIRUS[v.type].color;
  burst(g, v.x, v.y, c, v.boss ? 40 : 10, v.boss ? 220 : 140, v.boss ? 3.4 : 2.3);
  if (g.fx.length < MAX_FX) g.fx.push({ k: 'flash', x: v.x, y: v.y, r: v.r * 1.8, life: 0.16, max: 0.16, c });
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
  if (v.infect) {
    // Nanobots jump to the closest viruses.
    let n = 0;
    for (const o of g.viruses) {
      if (n >= 2 || o.dead || o === v || o.infect || dist2(o, v) > 80 ** 2) continue;
      o.infect = v.infect * 0.9;
      n++;
      g.fx.push({ k: 'beam', x1: v.x, y1: v.y, x2: o.x, y2: o.y, c: '#5dffa8', w: 1.5, life: 0.25, max: 0.25 });
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
    if (v.dead || v.hidden || v.hacked || skip?.has(v.id)) continue;
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
    if (v.dead || v.hidden || v.hacked) continue;
    const d = dist2(v, { x, y });
    if (d < (range + v.r) ** 2) list.push([d, v]);
  }
  list.sort((a, b) => a[0] - b[0]);
  return list.slice(0, n).map((x) => x[1]);
}
/** The toughest viruses in range (snipers pick these). */
function toughestN(g: Game, x: number, y: number, range: number, n: number): Virus[] {
  const list: Virus[] = [];
  for (const v of g.viruses) if (!v.dead && !v.hidden && !v.hacked && dist2(v, { x, y }) < (range + v.r) ** 2) list.push(v);
  list.sort((a, b) => b.hp + (b.boss ? 1e9 : 0) - (a.hp + (a.boss ? 1e9 : 0)));
  return list.slice(0, n);
}

function splash(g: Game, x: number, y: number, r: number, dmg: number, s: Partial<Stats>, src: Defender | null, except?: Virus, color?: string) {
  const c = color ?? (src ? DEF_INFO[src.kind].color : '#fff');
  ring(g, x, y, 4, r, c, 0.32, 3);
  g.sfx.push('boom');
  if (g.fx.length < MAX_FX) g.fx.push({ k: 'flash', x, y, r: r * 0.7, life: 0.16, max: 0.16, c });
  burst(g, x, y, c, 5, 120 + r * 2, 2);
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
    const adj = g.synAdj.includes(id);
    for (const [k, m0] of Object.entries(sy.mods)) {
      const key = k as keyof Stats;
      if (key === 'count' || key === 'pierce' || key === 'chain') s[key] += m0 + (adj ? 1 : 0);
      else {
        const m = adj ? 1 + (m0 - 1) * 1.8 : m0;
        if (key === 'slow') s.slow = Math.min(0.9, s.slow * m);
        else s[key] *= m;
      }
    }
  }
  if (d.over && d.over > 0) {
    s.rate *= 2.5;
    if (behOf(u.kind) === 'cuchillas') s.range *= 1.6;
    if (behOf(u.kind) === 'drones') s.count *= 2;
  }
  // Cronos «Eco»: neighbours on the ring fire faster.
  const ring = g.defenders.filter((x) => (x.chip ?? 0) === (d.chip ?? 0));
  const n = ring.length;
  if (n > 1) {
    for (const j of [(idx + 1) % n, (idx - 1 + n) % n]) {
      const nb = ring[j];
      if (nb !== d && (nb.flags.haste || nb.fuse?.flags.haste)) s.rate *= 1.3;
    }
  }
  return s;
}

function fireShots(g: Game, d: Defender, u: Unit, s: Stats, t: Virus, from = { x: d.x, y: d.y }) {
  const base = Math.atan2(t.y - from.y, t.x - from.x);
  u.aim = base;
  if (d.id >= 0) {
    d.recoil = 1;
    muzzle(g, from.x, from.y, base, DEF_INFO[u.kind].color);
    g.sfx.push(`shot:${behOf(u.kind)}`);
  }
  const n = Math.max(1, Math.round(s.count));
  const R = s.range * g.g.rangeMul;
  for (let i = 0; i < n; i++) {
    const a = base + (n > 1 ? -s.spread / 2 + (s.spread * i) / (n - 1) : 0) + (rand(g) - 0.5) * 0.06;
    const beh = behOf(u.kind);
    if (beh === 'mortero' || beh === 'acido') {
      const tx = t.x + (n > 1 ? (rand(g) - 0.5) * s.spread * 90 : 0);
      const ty = t.y + (n > 1 ? (rand(g) - 0.5) * s.spread * 90 : 0);
      const T = 0.7 + Math.sqrt(dist2({ x: tx, y: ty }, from)) / 420;
      g.shots.push(shot(d, u, s, { x: from.x, y: from.y, px: from.x, py: from.y, vx: 0, vy: 0, tx, ty, T, t: 0, r: 5, life: T + 0.1, acid: beh === 'acido' }));
      continue;
    }
    const sp = s.speed;
    const life = beh === 'misil' ? 3 : beh === 'bumeran' ? (R * 2.2) / sp + 1 : (R * 1.4) / sp + 0.15;
    g.shots.push(shot(d, u, s, { x: from.x, y: from.y, px: from.x, py: from.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: beh === 'misil' ? 4.5 : beh === 'bumeran' ? 6 : beh === 'hielo' ? 3.6 : 3, life, target: t.id, ret: beh === 'bumeran' ? 0 : undefined }));
  }
}
function shot(d: Defender, u: Unit, s: Stats, o: Partial<Shot>): Shot {
  return {
    x: 0, y: 0, vx: 0, vy: 0, dmg: s.dmg, r: 3, life: 1, pierce: s.pierce, bounce: s.bounce, splash: s.splash, slow: s.slow, burn: s.burn, homing: s.homing, split: s.split,
    crit: s.crit, critMult: s.critMult, execute: s.execute, target: -1, src: d.id, kind: u.kind, hit: [], px: d.x, py: d.y, brittle: !!u.flags.brittle, pa: !!u.flags.pierceArmor, ...o,
  };
}

function updateDefender(g: Game, d: Defender, idx: number, dt: number) {
  if (d.over) d.over = Math.max(0, d.over - dt);
  if (d.stun && d.stun > 0) {
    d.stun -= dt;
    return;
  }
  runUnit(g, d, d as Unit, idx, dt);
  if (d.fuse) runUnit(g, d, d.fuse as Unit, idx, dt);
  // Ultimate: charges over time, fires when there is something to hit.
  d.ult = Math.min(1, (d.ult ?? 0) + (dt / ULT_TIME) * (1 + d.lvl * 0.03));
  if (d.ult >= 1 && (nearest(g, d.x, d.y, Math.max(280, d.stats.range * g.g.rangeMul)) || nearest(g, 0, 0, 220)) && fireUlt(g, d)) {
    d.ult = 0;
    const name = ULTS[d.kind].name;
    g.fx.push({ k: 'txt', x: d.x, y: d.y - 22, s: name, life: 1.4, max: 1.4, c: DEF_INFO[d.kind].color });
    g.fx.push({ k: 'flash', x: d.x, y: d.y, r: 60, life: 0.35, max: 0.35, c: DEF_INFO[d.kind].color });
    ring(g, d.x, d.y, 10, 70, DEF_INFO[d.kind].color, 0.5, 5);
    g.sfx.push('ult');
    g.events.push(`ult:${d.kind}`);
  }
}

function runUnit(g: Game, d: Defender, u: Unit, idx: number, dt: number) {
  const s = effective(g, d, u, idx);
  const rate = s.rate * g.g.rateMul;
  const R = s.range * g.g.rangeMul;
  const color = DEF_INFO[u.kind].color;
  const common = { crit: s.crit, critMult: s.critMult, slow: s.slow, burn: s.burn, execute: s.execute, src: d, kind: u.kind, pa: !!u.flags.pierceArmor };
  const C = chipPos(d.chip ?? 0);
  switch (behOf(u.kind)) {
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
        if (g.fx.length < MAX_FX) g.fx.push({ k: 'flash', x: t.x, y: t.y, r: 6 + Math.min(10, ramp * 3), life: 0.05, max: 0.05, c: color });
        if (rand(g) < 0.25) burst(g, t.x, t.y, color, 1, 120, 1.5);
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
          for (let j = 1; j <= 5; j++) pts.push(px + ((cur.x - px) * j) / 6 + (rand(g) - 0.5) * 16, py + ((cur.y - py) * j) / 6 + (rand(g) - 0.5) * 16);
          pts.push(cur.x, cur.y);
          const fall = u.flags.nofall ? 1 : Math.pow(0.85, k);
          const target: Virus = cur;
          const tx = target.x;
          const ty = target.y;
          hit(g, target, s.dmg * fall, common);
          impact(g, tx, ty, color, 13);
          if (s.splash) splash(g, tx, ty, s.splash, s.dmg * fall * 0.5, s, d, target);
          cur = nearest(g, tx, ty, 90, seen);
          k++;
        }
        g.fx.push({ k: 'bolt', pts, life: 0.28, max: 0.28, c: color, w: 4 + Math.min(4, s.dmg / 40) });
        u.aim = Math.atan2(st.y - d.y, st.x - d.x);
        muzzle(g, d.x, d.y, u.aim, color);
        g.sfx.push('zap');
        d.recoil = 1;
        g.shake = Math.max(g.shake, 1.2);
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
        g.fx.push({ k: 'beam', x1: d.x, y1: d.y, x2: ex, y2: ey, c: color, w: 2.4, life: 0.3, max: 0.3 });
        g.sfx.push('snipe');
        muzzle(g, d.x, d.y, a, color);
        d.recoil = 1;
        impact(g, t.x, t.y, color, 16);
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
        const t = nearest(g, dr.x, dr.y, 160) ?? nearest(g, C.x, C.y, R + RING_R);
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
      const t = nearest(g, C.x, C.y, R + RING_R);
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
    default:
      runExclusive(g, d, u, s, dt, common);
  }
}

// ── Exclusive defenders of the extra chips: attacks the main chip never has ──
function runExclusive(g: Game, d: Defender, u: Unit, s: Stats, dt: number, common: HitOpts) {
  const rate = s.rate * g.g.rateMul * (d.over && d.over > 0 ? 2 : 1);
  const R = s.range * g.g.rangeMul;
  const color = DEF_INFO[u.kind].color;
  if (u.kind === 'espejo') {
    // Rotating mirror panels: hit back with the virus's own strength and repel.
    u.spin += dt * 1.6;
    const n = Math.round(s.count);
    for (let b = 0; b < n; b++) {
      const a = u.spin + (b * Math.PI * 2) / n;
      const px = d.x + Math.cos(a) * R;
      const py = d.y + Math.sin(a) * R;
      for (const v of g.viruses) {
        if (v.dead || v.hidden || dist2(v, { x: px, y: py }) > (v.r + 14) ** 2) continue;
        const key = 800000 + d.id * 8 + b;
        if ((v.hits[key] ?? -1) > g.t) continue;
        v.hits[key] = g.t + 0.4 / Math.max(0.3, rate);
        hit(g, v, s.dmg * (1 + v.dmg / 8), common);
        v.kb += (s.knock || 40) * (v.boss ? 0.3 : 1);
        impact(g, px, py, color, 10);
      }
    }
    return;
  }
  u.cd -= dt;
  if (u.cd > 0) return;
  switch (u.kind) {
    case 'rastreador': {
      const list = g.viruses.filter((v) => !v.dead && !v.hidden && !v.vuln && dist2(v, d) < (R + v.r) ** 2).sort((a, b) => b.hp - a.hp).slice(0, Math.round(s.count));
      if (!list.length) return;
      u.cd = 1 / rate;
      for (const v of list) {
        v.vuln = u.flags.long ? 8 : 4;
        v.vulnDeep = !!u.flags.deep;
        v.vulnSpread = !!u.flags.spread;
        if (s.slow) {
          v.slowF = Math.max(v.slowF, s.slow);
          v.slowT = Math.max(v.slowT, v.vuln);
        }
        hit(g, v, s.dmg, { ...common, quiet: true });
        g.fx.push({ k: 'beam', x1: d.x, y1: d.y, x2: v.x, y2: v.y, c: color, w: 1.2, life: 0.18, max: 0.18 });
      }
      return;
    }
    case 'senuelo': {
      const t = nearest(g, 0, 0, R + 120);
      if (!t) return;
      u.cd = 1 / rate;
      const a = Math.atan2(t.y, t.x);
      for (let k = 0; k < Math.round(s.count); k++) {
        const aa = a + (k - (s.count - 1) / 2) * 0.5;
        decoy(g, d, Math.cos(aa) * (WALL_R + 26), Math.sin(aa) * (WALL_R + 26), s, u.flags);
      }
      return;
    }
    case 'iman': {
      const a = toughestN(g, d.x, d.y, R, 3).find((v) => !v.boss && !v.held);
      if (!a) return;
      const b = nearest(g, a.x, a.y, 160, new Set([a.id]));
      if (!b) return;
      u.cd = 1 / rate;
      a.held = { to: b.id, dmg: s.dmg * g.g.dmgMul * passive(g.wave) };
      g.fx.push({ k: 'beam', x1: d.x, y1: d.y, x2: a.x, y2: a.y, c: color, w: 2, life: 0.3, max: 0.3 });
      return;
    }
    case 'clonador': {
      // Copies a random other defender's normal attack at 70 %.
      const others = g.defenders.filter((x) => x !== d && x.kind !== 'clonador' && x.kind !== 'crisol');
      if (!others.length) return;
      let m = mimic.get(d.id);
      if (!m || m.t <= 0 || !others.some((x) => x.kind === m!.u.kind)) {
        const pick = others[Math.floor(rand(g) * others.length)];
        m = { t: 4, u: { kind: pick.kind, stats: { ...pick.stats, dmg: pick.stats.dmg * 0.7 * (1 + d.lvl * 0.1) }, flags: { ...pick.flags }, cd: 0, spin: 0, pending: 0, lockId: -1, lockT: 0, aim: 0 } };
        mimic.set(d.id, m);
        g.fx.push({ k: 'txt', x: d.x, y: d.y - 16, s: `Copia: ${DEF_INFO[pick.kind].name}`, life: 1, max: 1.05, c: DEF_INFO[pick.kind].color });
      }
      m.t -= dt;
      u.cd = 0;
      if (m.u.kind !== 'clonador') runUnit(g, d, m.u, 0, dt);
      return;
    }
    case 'burbuja': {
      const list = g.viruses.filter((v) => !v.dead && !v.hidden && !v.bubble && !v.boss && dist2(v, d) < (R + v.r) ** 2).sort((a, b) => dist2(a, { x: 0, y: 0 }) - dist2(b, { x: 0, y: 0 })).slice(0, Math.round(s.count));
      if (!list.length) return;
      u.cd = 1 / rate;
      for (const v of list) {
        v.bubble = 2.4;
        v.bubbleDmg = s.dmg * 2 * g.g.dmgMul * passive(g.wave);
        g.sfx.push('beam');
      }
      return;
    }
    case 'hacker': {
      const list = g.viruses.filter((v) => !v.dead && !v.hidden && !v.hacked && !v.boss && dist2(v, d) < (R + v.r) ** 2).sort((a, b) => b.hp - a.hp).slice(0, Math.round(s.count));
      if (!list.length) return;
      u.cd = 1 / rate;
      for (const v of list) hack(g, d, v, color);
      return;
    }
    case 'fractal': {
      const t = nearest(g, d.x, d.y, R);
      if (!t) return;
      u.cd = 1 / rate;
      const a = Math.atan2(t.y - d.y, t.x - d.x);
      g.shots.push(shot(d, u, s, { x: d.x, y: d.y, px: d.x, py: d.y, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, r: 4, life: 1.6, homing: 0, pierce: 0, frac: 0, fracT: 0.22 }));
      muzzle(g, d.x, d.y, a, color);
      return;
    }
    case 'eclipse': {
      const t = nearest(g, 0, 0, 400);
      if (!t) return;
      u.cd = 1 / rate;
      eclipse(g, d, t, s);
      return;
    }
    case 'refractor': {
      const t = nearest(g, d.x, d.y, R);
      if (!t) return;
      u.cd = 1 / rate;
      const a = Math.atan2(t.y - d.y, t.x - d.x);
      g.shots.push(shot(d, u, s, { x: d.x, y: d.y, px: d.x, py: d.y, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, r: 6, life: 2.5, target: t.id, homing: 1, prism: true, pierce: 0 }));
      muzzle(g, d.x, d.y, a, color);
      g.sfx.push('beam');
      return;
    }
    case 'foton': {
      const marks = g.viruses.filter((v) => !v.dead && !v.hidden && !v.mark && dist2(v, d) < (R + v.r) ** 2).sort((a, b) => b.hp - a.hp).slice(0, Math.round(s.count));
      if (!marks.length) return;
      u.cd = 1 / rate;
      const already = g.viruses.filter((v) => v.mark).length;
      for (const v of marks) {
        v.mark = 1.4;
        v.markDmg = s.dmg * (1 + 0.15 * (already + marks.length)) * g.g.dmgMul * passive(g.wave);
        g.fx.push({ k: 'beam', x1: d.x, y1: d.y, x2: v.x, y2: v.y, c: color, w: 1.2, life: 0.2, max: 0.2 });
      }
      return;
    }
    case 'martillo': {
      const t = nearest(g, d.x, d.y, R);
      if (!t) return;
      u.cd = 1 / rate;
      fissure(g, d, Math.atan2(t.y - d.y, t.x - d.x), R, s.dmg, s.splash || 22, color);
      return;
    }
    case 'crisol': {
      u.cd = 1 / rate;
      const p = 1 + d.lvl * 0.15;
      g.hp = Math.min(g.maxHp, g.hp + 4 * p);
      if (g.g.shield < g.g.shieldMax + 1) g.g.shield += 1;
      if (g.g.wallMax > 0) g.g.wall = Math.min(g.g.wallMax, g.g.wall + g.g.wallMax * 0.15 * p);
      ring(g, 0, 0, CORE_R, CORE_R + 30, color, 0.6, 4);
      g.fx.push({ k: 'beam', x1: d.x, y1: d.y, x2: 0, y2: 0, c: color, w: 2, life: 0.4, max: 0.4 });
      g.fx.push({ k: 'txt', x: 0, y: -CORE_R - 14, s: 'Blindaje', life: 1, max: 1.1, c: color });
      return;
    }
    case 'forjador': {
      const t = nearest(g, d.x, d.y, R);
      if (!t) return;
      u.cd = 1 / rate;
      for (let k = 0; k < Math.round(s.count); k++) saw(g, d, u, s, Math.atan2(t.y - d.y, t.x - d.x) + (k - (s.count - 1) / 2) * 0.4);
      return;
    }
    case 'nanobots': {
      const targets = g.viruses.filter((v) => !v.dead && !v.hidden && !v.infect && dist2(v, d) < (R + v.r) ** 2).sort((a, b) => dist2(a, d) - dist2(b, d)).slice(0, Math.round(s.count));
      if (!targets.length) return;
      u.cd = 1 / rate;
      for (const v of targets) infect(g, d, v, s.dmg, color);
      return;
    }
    case 'espora': {
      const t = nearest(g, d.x, d.y, R);
      if (!t) return;
      u.cd = 1 / rate;
      for (let k = 0; k < Math.round(s.count); k++) {
        const f = 0.55 + rand(g) * 0.2;
        plant(g, d, d.x + (t.x - d.x) * f + (rand(g) - 0.5) * 30, d.y + (t.y - d.y) * f + (rand(g) - 0.5) * 30, s.dmg);
      }
      return;
    }
    case 'raiz': {
      const t = nearest(g, d.x, d.y, R);
      if (!t) return;
      u.cd = 1 / rate;
      roots(g, d, t.x, t.y, s.splash || 55, s.dmg, 2, color, common);
      return;
    }
    case 'singular': {
      const list = g.viruses.filter((v) => !v.dead && !v.hidden && dist2(v, d) < (R + v.r) ** 2).sort((a, b) => b.hp + (b.boss ? -1e9 : 0) - (a.hp + (a.boss ? -1e9 : 0)));
      if (!list.length) return;
      u.cd = 1 / rate;
      for (const v of list.slice(0, Math.round(s.count))) banish(g, v, s.dmg, color, common);
      return;
    }
    case 'eco': {
      const t = nearest(g, d.x, d.y, R);
      if (!t) return;
      u.cd = 1 / rate;
      rewind(g, t.x, t.y, s.splash || 70, 2.5, s.dmg, color, common);
      return;
    }
    case 'segador': {
      if (!nearest(g, d.x, d.y, R)) return;
      u.cd = 1 / rate;
      reap(g, d, R, s.dmg * (1 + (d.stacks ?? 0) * 0.02), s.execute, color, common);
      return;
    }
  }
}

const mimic = new Map<number, { t: number; u: Unit }>();
function decoy(g: Game, d: Defender, x: number, y: number, s: Stats, f: Record<string, number>) {
  const hp = 60 * coreScale(g.wave) * (f.tough ? 3 : 1);
  g.zones.push({ k: 'decoy', x, y, r: 60, t: 7, max: hp, dps: hp, slow: s.slow, pull: 0, burn: s.burn, dmg: s.dmg * g.g.dmgMul * passive(g.wave), split: 0, src: d.id, flags: {} });
  burst(g, x, y, '#9fd3ff', 8, 90, 2);
}
function hack(g: Game, d: Defender, v: Virus, color: string) {
  v.hacked = 5 + d.lvl * 0.2;
  g.fx.push({ k: 'beam', x1: d.x, y1: d.y, x2: v.x, y2: v.y, c: color, w: 1.5, life: 0.3, max: 0.3 });
  burst(g, v.x, v.y, color, 8, 90, 1.8);
  g.sfx.push('zap');
}
function eclipse(g: Game, d: Defender, t: Virus, s: Stats) {
  // A shadow that sweeps across the board through the target.
  const a = Math.atan2(t.y, t.x) + Math.PI / 2;
  const x = t.x - Math.cos(a) * 220;
  const y = t.y - Math.sin(a) * 220;
  g.zones.push({ k: 'eclipse', x, y, r: s.splash || 70, t: 5, max: 5, dps: s.dmg * g.g.dmgMul * passive(g.wave), slow: 0.35, pull: 0, burn: 0, dmg: 0, split: 0, src: d.id, flags: { vx: Math.cos(a) * 90, vy: Math.sin(a) * 90 } });
}
/** States that move a virus by themselves: magnet, bubble, hack. Returns true if it handled the movement. */
function special(g: Game, v: Virus, dt: number): boolean {
  if (v.held) {
    const b = g.viruses.find((o) => o.id === v.held!.to && !o.dead);
    if (!b) {
      v.held = undefined;
      return false;
    }
    const dx = b.x - v.x;
    const dy = b.y - v.y;
    const L = Math.hypot(dx, dy) || 1;
    if (L < v.r + b.r) {
      const dmg = v.held.dmg + v.max * 0.15;
      v.held = undefined;
      impact(g, b.x, b.y, '#ff5f8f', 22);
      g.shake = Math.max(g.shake, 3);
      hit(g, b, dmg, { raw: true, kind: 'iman' });
      hit(g, v, dmg, { raw: true, kind: 'iman', quiet: true });
      g.sfx.push('boom');
      return true;
    }
    v.x += (dx / L) * 420 * dt;
    v.y += (dy / L) * 420 * dt;
    return true;
  }
  if (v.bubble) {
    v.bubble -= dt;
    const L = Math.hypot(v.x, v.y) || 1;
    v.x += (v.x / L) * 40 * dt;
    v.y += (v.y / L) * 40 * dt;
    if (v.bubble <= 0) {
      v.bubble = undefined;
      ring(g, v.x, v.y, v.r, v.r + 30, '#9ff0ff', 0.35, 3);
      burst(g, v.x, v.y, '#9ff0ff', 12, 140, 1.8);
      for (const o of g.viruses) if (!o.dead && dist2(o, v) < (40 + o.r) ** 2) hit(g, o, o === v ? v.bubbleDmg ?? 0 : (v.bubbleDmg ?? 0) * 0.4, { raw: true, quiet: o !== v, kind: 'burbuja' });
    }
    return true;
  }
  if (v.hacked) {
    v.hacked -= dt;
    if (v.hacked <= 0) {
      v.hacked = undefined;
      kill(g, v, null);
      return true;
    }
    // Fights for you: chases the closest virus and bites it.
    let best: Virus | null = null;
    let bd = Infinity;
    for (const o of g.viruses) {
      if (o === v || o.dead || o.hacked) continue;
      const dd = dist2(o, v);
      if (dd < bd) {
        bd = dd;
        best = o;
      }
    }
    if (best) {
      const L = Math.sqrt(bd) || 1;
      if (L > v.r + best.r) {
        v.x += ((best.x - v.x) / L) * v.speed * 1.8 * dt;
        v.y += ((best.y - v.y) / L) * v.speed * 1.8 * dt;
      } else hit(g, best, Math.max(v.dmg * 6, v.max * 0.35) * dt, { raw: true, quiet: true, kind: 'hacker' });
    }
    return true;
  }
  if (v.type === 'titan') {
    v.timer -= 0;
    const key = 'titanEmp';
    const tm = v.hits as unknown as Record<string, number>;
    tm[key] = (tm[key] ?? 6) - dt;
    if (tm[key] <= 0) {
      tm[key] = 6;
      // EMP: stuns the defenders near it.
      ring(g, v.x, v.y, v.r, 260, '#ff1f4f', 0.7, 6);
      for (const d of g.defenders) if (dist2(d, v) < 260 ** 2) d.stun = 1.6;
      g.events.push('emp');
      g.shake = Math.max(g.shake, 8);
      for (let k = 0; k < 3; k++) spawnVirus(g, 'tanque', { x: v.x + (rand(g) - 0.5) * 60, y: v.y + (rand(g) - 0.5) * 60, elite: true, gen: 1 });
    }
  }
  return false;
}
function bossPhase(g: Game, v: Virus, ph: number) {
  v.phase = ph;
  g.events.push(`phase:${ph + 1}`);
  g.slowmo = 0.7;
  g.shake = Math.max(g.shake, 10);
  ring(g, v.x, v.y, v.r, v.r * 5, '#ff3b5c', 0.8, 6);
  if (ph === 1) {
    // Phase 2: armour up and speed up.
    v.shield = Math.max(v.shield, v.max * 0.25);
    v.speed *= 1.25;
  } else {
    // Phase 3: calls in reinforcements and goes berserk.
    for (let k = 0; k < 6; k++) spawnVirus(g, k % 2 ? 'rapido' : 'kamikaze', { x: v.x + (rand(g) - 0.5) * 80, y: v.y + (rand(g) - 0.5) * 80, gen: 1, elite: k < 2 });
    v.speed *= 1.35;
    v.armor = Math.min(0.6, v.armor + 0.15);
  }
}

function fissure(g: Game, d: Defender, a: number, len: number, dmg: number, w: number, color: string) {
  const steps = Math.round(len / 22);
  for (let k = 1; k <= steps; k++) {
    const x = d.x + Math.cos(a) * k * 22 + (rand(g) - 0.5) * 6;
    const y = d.y + Math.sin(a) * k * 22 + (rand(g) - 0.5) * 6;
    for (const v of g.viruses) if (!v.dead && dist2(v, { x, y }) < (w + v.r) ** 2) {
      const key = 700000 + d.id;
      if ((v.hits[key] ?? -1) > g.t) continue;
      v.hits[key] = g.t + 0.3;
      hit(g, v, dmg, { src: d, kind: d.kind, quiet: true });
      v.kb += v.boss ? 8 : 25;
    }
    if (k % 2 === 0) burst(g, x, y, '#a0643a', 2, 70, 2);
  }
  g.fx.push({ k: 'bolt', pts: Array.from({ length: steps + 1 }, (_, k) => [d.x + Math.cos(a) * k * 22 + (rand(g) - 0.5) * 8, d.y + Math.sin(a) * k * 22 + (rand(g) - 0.5) * 8]).flat(), life: 0.7, max: 0.7, c: color, w: 5 });
  g.shake = Math.max(g.shake, 3);
  g.sfx.push('boom');
}
function saw(g: Game, d: Defender, u: Unit, s: Stats, a: number) {
  g.shots.push(shot(d, u, s, { x: d.x, y: d.y, px: d.x, py: d.y, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, r: 9, life: 6, pierce: 99, saw: true, homing: 0 }));
  g.sfx.push('shot:bumeran');
}
function infect(g: Game, d: Defender, v: Virus, dps: number, color: string) {
  v.infect = Math.max(v.infect ?? 0, dps * g.g.dmgMul * passive(g.wave));
  g.fx.push({ k: 'beam', x1: d.x, y1: d.y, x2: v.x, y2: v.y, c: color, w: 1.5, life: 0.25, max: 0.25 });
  burst(g, v.x, v.y, color, 4, 60, 1.6);
}
function plant(g: Game, d: Defender, x: number, y: number, dmg: number) {
  g.zones.push({ k: 'plant', x, y, r: 12, t: 8, max: 8, dps: 0, slow: 0, pull: 0, burn: 0, dmg, split: 0, src: d.id, flags: { cd: 0.3 } });
  burst(g, x, y, '#b6ff3d', 8, 80, 2);
}
function roots(g: Game, d: Defender, x: number, y: number, r: number, dmg: number, t: number, color: string, common: HitOpts) {
  let n = 0;
  for (const v of g.viruses) {
    if (v.dead || dist2(v, { x, y }) > (r + v.r) ** 2) continue;
    v.root = Math.max(v.root ?? 0, v.boss ? t * 0.35 : t);
    hit(g, v, dmg, { ...common, quiet: true });
    n++;
  }
  g.hp = Math.min(g.maxHp, g.hp + n * 0.8);
  ring(g, x, y, 4, r, color, 0.6, 4);
  burst(g, x, y, color, 10, 120, 2.2);
  void d;
}
function banish(g: Game, v: Virus, dmg: number, color: string, common: HitOpts) {
  hit(g, v, dmg, common);
  if (v.dead) return;
  burst(g, v.x, v.y, color, 10, 120, 2);
  if (v.boss) {
    v.slowF = 0.6;
    v.slowT = 2;
    return;
  }
  const a = Math.atan2(v.y, v.x);
  const A = Math.min(g.arena / Math.max(1e-3, Math.abs(Math.cos(a))), g.arenaY / Math.max(1e-3, Math.abs(Math.sin(a)))) - 10;
  v.x = Math.cos(a) * A;
  v.y = Math.sin(a) * A;
  ring(g, v.x, v.y, 30, 4, color, 0.5, 3);
  g.sfx.push('beam');
}
function rewind(g: Game, x: number, y: number, r: number, t: number, dmg: number, color: string, common: HitOpts) {
  for (const v of g.viruses) {
    if (v.dead || dist2(v, { x, y }) > (r + v.r) ** 2) continue;
    v.rewind = Math.max(v.rewind ?? 0, v.boss ? t * 0.4 : t);
    hit(g, v, dmg, { ...common, quiet: true });
  }
  ring(g, x, y, r, 6, color, 0.6, 3);
  ring(g, x, y, r * 0.6, 4, color, 0.5, 2);
}
function reap(g: Game, d: Defender, R: number, dmg: number, ex: number, color: string, common: HitOpts) {
  const before = g.kills;
  for (const v of g.viruses) {
    if (v.dead || dist2(v, d) > (R + v.r) ** 2) continue;
    hit(g, v, dmg, { ...common, execute: Math.max(ex, common.execute ?? 0), quiet: true });
  }
  d.stacks = Math.min(150, (d.stacks ?? 0) + (g.kills - before));
  ring(g, d.x, d.y, R * 0.3, R, color, 0.4, 5);
  g.sfx.push('snipe');
}

// ── Ultimate moves ────────────────────────────────────────────────────────
function fireUlt(g: Game, d: Defender) {
  const kind = d.kind;
  const ult = ULTS[kind];
  const s = d.stats;
  const color = DEF_INFO[kind].color;
  const common: HitOpts = { src: d, kind, crit: s.crit, critMult: s.critMult };
  const big = s.dmg * 3;
  const near = (r: number) => g.viruses.filter((v) => !v.dead && !v.hidden && dist2(v, d) < r * r);
  const any = (n: number) => g.viruses.filter((v) => !v.dead && !v.hidden).sort(() => rand(g) - 0.5).slice(0, n);
  const u = d as Unit;
  switch (ult.fx) {
    case 'expose':
      for (const v of g.viruses) {
        v.vuln = 6;
        v.vulnDeep = !!d.flags.deep;
      }
      ring(g, d.x, d.y, 10, 400, color, 0.8, 4);
      break;
    case 'decoys':
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        decoy(g, d, Math.cos(a) * (WALL_R + 30), Math.sin(a) * (WALL_R + 30), { ...s, dmg: s.dmg * 1.5 }, d.flags);
      }
      break;
    case 'collide': {
      let list = near(260).filter((v) => !v.boss);
      if (!list.length) list = nearestN(g, 0, 0, 400, 6).filter((v) => !v.boss);
      if (!list.length) return false;
      const cx = list.reduce((a, v) => a + v.x, 0) / list.length;
      const cy = list.reduce((a, v) => a + v.y, 0) / list.length;
      for (const v of list) {
        v.x = cx + (v.x - cx) * 0.15;
        v.y = cy + (v.y - cy) * 0.15;
        hit(g, v, big + v.max * 0.2, common);
      }
      g.fx.push({ k: 'flash', x: cx, y: cy, r: 80, life: 0.35, max: 0.35, c: color });
      g.shake = Math.max(g.shake, 9);
      break;
    }
    case 'mimic': {
      const others = g.defenders.filter((x) => x.kind !== 'clonador');
      const o = others.length ? others[Math.floor(rand(g) * others.length)] : { ...d, kind: 'canon' as DefKind };
      const fake = { ...o, x: d.x, y: d.y, id: d.id } as Defender;
      fireUlt(g, fake);
      break;
    }
    case 'bubbles':
      for (const v of near(320).filter((x) => !x.boss).slice(0, 6)) {
        v.bubble = 2.6;
        v.bubbleDmg = s.dmg * 3 * g.g.dmgMul * passive(g.wave);
      }
      break;
    case 'army':
      for (const v of near(320).filter((x) => !x.boss).sort((a, b) => b.hp - a.hp).slice(0, 5)) hack(g, d, v, color);
      break;
    case 'fractalstorm':
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        g.shots.push(shot(d, u, s, { x: d.x, y: d.y, px: d.x, py: d.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, r: 4, life: 1.4, homing: 0, pierce: 0, frac: 0, fracT: 0.2 }));
      }
      break;
    case 'blackout':
      for (const v of g.viruses) {
        hit(g, v, big, { ...common, quiet: true });
        v.slowF = Math.max(v.slowF, v.boss ? 0.3 : 0.6);
        v.slowT = 3;
      }
      g.fx.push({ k: 'flash', x: 0, y: 0, r: 500, life: 0.6, max: 0.6, c: '#1a0f40' });
      break;
    case 'barrage':
    case 'boomerangs':
    case 'rainbow': {
      const n = ult.fx === 'barrage' ? 24 : ult.fx === 'boomerangs' ? 10 : 12;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const sp = ult.fx === 'boomerangs' ? 300 : 480;
        g.shots.push(shot(d, u, { ...s, pierce: 3, splash: 0, split: 0 }, { x: d.x, y: d.y, px: d.x, py: d.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 4, life: 1.2, dmg: s.dmg * 2, ret: ult.fx === 'boomerangs' ? 0 : undefined, el: ult.fx === 'rainbow' ? ELEMENT_LIST[k % ELEMENT_LIST.length] : undefined, kind: ult.fx === 'boomerangs' ? 'bumeran' : kind }));
      }
      break;
    }
    case 'beam': {
      const t = nearest(g, d.x, d.y, 400) ?? g.viruses[0];
      if (!t) return false;
      const a = Math.atan2(t.y - d.y, t.x - d.x);
      const end = { x: d.x + Math.cos(a) * 420, y: d.y + Math.sin(a) * 420 };
      g.fx.push({ k: 'beam', x1: d.x, y1: d.y, x2: end.x, y2: end.y, c: color, w: 9, life: 0.6, max: 0.6 });
      for (const v of g.viruses) if (!v.dead && segDist2(v, d, end) < (v.r + 14) ** 2) hit(g, v, s.dmg * 8, common);
      break;
    }
    case 'storm':
      for (const v of any(10)) {
        bolt(g, v.x + (rand(g) - 0.5) * 40, v.y - 160, v.x, v.y, color, 0.35, 5);
        hit(g, v, big, common);
        impact(g, v.x, v.y, color, 16);
      }
      g.sfx.push('zap');
      break;
    case 'quake':
    case 'inferno':
    case 'mirrors':
      for (const v of near(ult.fx === 'inferno' ? 170 : 210)) {
        hit(g, v, ult.fx === 'mirrors' ? s.dmg * (2 + v.dmg / 6) : big, { ...common, burn: ult.fx === 'inferno' ? s.dmg * 2 : 0 });
        v.kb += (ult.fx === 'inferno' ? 20 : 90) * (v.boss ? 0.3 : 1);
      }
      ring(g, d.x, d.y, 10, ult.fx === 'inferno' ? 170 : 210, color, 0.7, 7);
      g.shake = Math.max(g.shake, 8);
      break;
    case 'meteors':
    case 'artillery': {
      const n = ult.fx === 'meteors' ? 8 : 12;
      for (const v of any(n)) {
        const tx = v.x + (rand(g) - 0.5) * 30;
        const ty = v.y + (rand(g) - 0.5) * 30;
        g.shots.push(shot(d, { ...u, kind: 'mortero' }, { ...s, dmg: big, splash: 50 }, { x: d.x, y: d.y, px: d.x, py: d.y, vx: 0, vy: 0, tx, ty, T: 0.6 + rand(g) * 0.4, t: 0, r: 6, life: 1.2 }));
      }
      break;
    }
    case 'freeze':
    case 'stop':
      for (const v of ult.fx === 'stop' ? g.viruses : near(220)) {
        v.slowF = v.boss ? 0.6 : 0.97;
        v.slowT = ult.fx === 'stop' ? 2 : 3;
      }
      ring(g, d.x, d.y, 10, ult.fx === 'stop' ? 500 : 220, color, 0.8, 6);
      break;
    case 'whirl':
    case 'swarm':
      d.over = ult.fx === 'whirl' ? 6 : 8;
      break;
    case 'execute':
    case 'harvest': {
      const list = ult.fx === 'execute' ? toughestN(g, d.x, d.y, 500, 3) : near(300);
      for (const v of list) {
        if (ult.fx === 'execute') {
          g.fx.push({ k: 'beam', x1: d.x, y1: d.y, x2: v.x, y2: v.y, c: color, w: 4, life: 0.4, max: 0.4 });
          hit(g, v, s.dmg * 10, { ...common, bossx3: true });
        } else if (!v.boss && v.hp / v.max < 0.25) {
          hit(g, v, v.hp + 1, { raw: true, src: d, quiet: true });
          d.stacks = Math.min(150, (d.stacks ?? 0) + 1);
        }
      }
      if (ult.fx === 'harvest') ring(g, d.x, d.y, 20, 300, color, 0.6, 6);
      break;
    }
    case 'hole': {
      const t = nearest(g, 0, 0, 400);
      if (!t) return false;
      g.zones.push({ k: 'well', x: t.x, y: t.y, r: 90, t: 5, max: 5, dps: s.dmg * 2, slow: 0.5, pull: 90, burn: 0, dmg: 0, split: 0, src: d.id, flags: { implode: 1 } });
      break;
    }
    case 'flood':
      for (const v of any(5)) g.zones.push({ k: 'acid', x: v.x, y: v.y, r: 55, t: 5, max: 5, dps: s.dmg * 1.5, slow: 0.4, pull: 0, burn: 0, dmg: 0, split: 0, src: d.id, flags: {} });
      break;
    case 'minefield':
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const r = 120 + rand(g) * 80;
        g.zones.push({ k: 'mine', x: Math.cos(a) * r, y: Math.sin(a) * r, r: 45, t: 30, max: 30, dps: 0, slow: 0, pull: 0, burn: 0, dmg: s.dmg * 2, split: 0, src: d.id, flags: {} });
      }
      break;
    case 'marks':
      for (const v of near(320)) {
        v.mark = 1 + rand(g) * 0.6;
        v.markDmg = s.dmg * 3 * g.g.dmgMul * passive(g.wave);
      }
      break;
    case 'fissures':
      for (let k = 0; k < 6; k++) fissure(g, d, (k / 6) * Math.PI * 2 + rand(g) * 0.3, 260, s.dmg * 2, 26, color);
      break;
    case 'armor':
      g.hp = Math.min(g.maxHp, g.hp + g.maxHp * 0.25);
      g.g.shield += 2;
      ring(g, 0, 0, CORE_R, 90, color, 0.8, 6);
      break;
    case 'saws':
      for (let k = 0; k < 5; k++) saw(g, d, u, { ...s, dmg: s.dmg * 1.5 }, (k / 5) * Math.PI * 2);
      break;
    case 'pandemic':
      for (const v of g.viruses.filter((x) => !x.dead && !x.hidden).sort((a, b) => dist2(a, d) - dist2(b, d)).slice(0, 10)) infect(g, d, v, s.dmg * 1.5, color);
      break;
    case 'garden':
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        plant(g, d, d.x + Math.cos(a) * 70, d.y + Math.sin(a) * 70, s.dmg * 1.5);
      }
      break;
    case 'jungle':
      roots(g, d, d.x, d.y, 220, s.dmg, 3, color, common);
      break;
    case 'banish':
      for (const v of g.viruses.filter((x) => !x.dead && !x.boss).sort((a, b) => b.hp - a.hp).slice(0, 5)) banish(g, v, s.dmg * 2, color, common);
      break;
    case 'rewind':
      rewind(g, d.x, d.y, 240, 3, s.dmg, color, common);
      break;
  }
  return true;
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
      const sx = src ? src.x : s.src === -3 ? s.tx! : 0;
      const sy = src ? src.y : s.src === -3 ? s.ty! - 220 : 0;
      s.x = sx + (s.tx! - sx) * k;
      s.y = sy + (s.ty! - sy) * k;
      if (k >= 1) {
        if (s.acid && src) {
          const f = behOf(src.kind) === 'acido' ? src.flags : src.fuse?.flags ?? {};
          const dur = 3.2 * (f.dur || 1);
          const burn = s.burn + (has(g, 'gas') ? (g.synAdj.includes('gas') ? 18 : 10) : 0);
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
    if (s.saw) {
      // Saw discs bounce off the screen edges and cut again after a moment.
      if (Math.abs(s.x) > g.arena - 6) s.vx = -Math.abs(s.vx) * Math.sign(s.x);
      if (Math.abs(s.y) > g.arenaY - 6) s.vy = -Math.abs(s.vy) * Math.sign(s.y);
      if (rand(g) < dt * 3) s.hit = [];
    }
    if (s.frac !== undefined && s.frac < 3) {
      s.fracT = (s.fracT ?? 0.22) - dt;
      if (s.fracT <= 0) {
        // Splits in two, again and again.
        const a = Math.atan2(s.vy, s.vx);
        const sp = Math.hypot(s.vx, s.vy);
        for (const da of [-0.4, 0.4]) g.shots.push({ ...s, vx: Math.cos(a + da) * sp, vy: Math.sin(a + da) * sp, dmg: s.dmg * 0.75, frac: s.frac + 1, fracT: 0.22, hit: [...s.hit] });
        continue;
      }
    }
    if (s.prism && (s.life < 0.1 || g.viruses.some((v) => !v.dead && !v.hidden && dist2(v, s) < (v.r + s.r) ** 2))) {
      // The orb bursts into one shard of every element.
      const n = 6;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + rand(g);
        const el = ELEMENT_LIST[k % ELEMENT_LIST.length];
        g.shots.push({ ...s, prism: false, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340, life: 0.45, r: 3, homing: 0, el, hit: [], kind: 'refractor' });
      }
      g.fx.push({ k: 'flash', x: s.x, y: s.y, r: 30, life: 0.2, max: 0.2, c: '#ffffff' });
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
    if (s.kind === 'misil' && g.fx.length < MAX_FX && rand(g) < 0.7) {
      const life = 0.45;
      g.fx.push({ k: 'p', x: s.x - s.vx * 0.02, y: s.y - s.vy * 0.02, vx: (rand(g) - 0.5) * 20, vy: (rand(g) - 0.5) * 20, life, max: life, c: rand(g) < 0.3 ? '#ffb347' : '#7a7f88', s: 2.4 });
    }
    if (s.life <= 0 || (!s.saw && (Math.abs(s.x) > g.arena + 60 || Math.abs(s.y) > g.arenaY + 60))) continue;
    let alive = true;
    for (const v of g.viruses) {
      if (v.dead || v.hidden || s.hit.includes(v.id)) continue;
      if (dist2(v, s) > (v.r + s.r) ** 2) continue;
      s.hit.push(v.id);
      hit(g, v, s.dmg, { el: s.el, crit: s.crit, critMult: s.critMult, slow: s.slow, burn: s.burn, execute: s.execute, brittle: s.brittle, pa: s.pa, src, kind: s.kind === 'core' || s.kind === 'frag' ? undefined : s.kind, quiet: s.kind === 'frag' || s.kind === 'bumeran' });
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
    if (z.k === 'decoy') {
      // Hologram of the core: lures viruses, then blows up.
      for (const v of g.viruses) {
        if (v.dead || v.boss || v.hacked || dist2(v, z) > 75 ** 2) continue;
        const L = Math.sqrt(dist2(v, z)) || 1;
        if (L > v.r + 10) {
          v.x += ((z.x - v.x) / L) * v.speed * dt * 1.2;
          v.y += ((z.y - v.y) / L) * v.speed * dt * 1.2;
        } else z.dps -= v.dmg * 2 * dt;
      }
      if (z.dps <= 0 || z.t <= 0) {
        splash(g, z.x, z.y, z.r, z.dmg, { slow: z.slow, burn: z.burn, crit: 0.1, critMult: 2 }, src, undefined, '#9fd3ff');
        g.fx.push({ k: 'flash', x: z.x, y: z.y, r: 60, life: 0.3, max: 0.3, c: '#9fd3ff' });
        continue;
      }
      keep.push(z);
      continue;
    }
    if (z.k === 'eclipse') {
      z.x += (z.flags.vx ?? 0) * dt;
      z.y += (z.flags.vy ?? 0) * dt;
      for (const v of g.viruses) if (!v.dead && !v.hacked && dist2(v, z) < (z.r + v.r) ** 2) hit(g, v, z.dps * dt, { slow: z.slow, quiet: true, src, kind: 'eclipse', crit: 0 });
      if (z.t > 0) keep.push(z);
      continue;
    }
    if (z.k === 'plant') {
      // A living turret: shoots thorns at the nearest virus.
      z.flags.cd = (z.flags.cd ?? 0) - dt;
      if (z.flags.cd <= 0) {
        const t = nearest(g, z.x, z.y, 120);
        if (t) {
          z.flags.cd = 0.45;
          const a = Math.atan2(t.y - z.y, t.x - z.x);
          g.shots.push({ x: z.x, y: z.y, px: z.x, py: z.y, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, dmg: z.dmg, r: 2.6, life: 0.5, pierce: 0, bounce: 0, splash: 0, slow: 0.15, burn: 0, homing: 0, split: 0, crit: 0.05, critMult: 2, execute: 0, target: t.id, src: z.src, kind: 'espora', hit: [] });
        }
      }
      if (z.t > 0) keep.push(z);
      continue;
    }
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
/** Sizes and counts of every structure at its current level (shared with the renderer). */
export function structs(g: Game) {
  const G = g.g;
  const A = (id: string) => G.asc.includes(id);
  const o = G.orbit;
  const oin = o > 0 ? 2 + Math.ceil(o * 0.75) : 0;
  const oout = o >= 4 ? o - 2 : 0;
  const ascO = A('asc-orbitales') ? 2 : 1;
  return {
    orbitIn: oin * ascO,
    orbitOut: oout * ascO,
    orbitSize: 8 + o + (ascO > 1 ? 4 : 0),
    orbitSpeed: 2.1 + 0.15 * o,
    faroBeams: A('asc-faro') ? 6 : G.faro > 0 ? [1, 1, 2, 2, 3, 4][Math.min(5, G.faro - 1)] : 0,
    faroW: 4 + G.faro * 1.5 + (A('asc-faro') ? 4 : 0),
    wallW: 3 + Math.min(8, Math.ceil(G.wallMax / 70)),
    thornN: G.thorns > 0 ? 20 + 6 * G.thorns : 0,
    thornLen: 5 + 2 * G.thorns + (G.thorns >= 8 ? 4 : 0),
    thornRows: G.thorns >= 6 ? 2 : 1,
    auraR: G.aura > 0 ? 70 + 10 * G.aura : 0,
    pulseR: A('asc-pulso') ? 220 : 100 + 15 * G.corePulse,
    sats: G.turret > 0 ? Math.ceil(G.turret / 2) * (A('asc-satelite') ? 2 : 1) : 0,
  };
}

/** Abilities of the extra chips; stronger with each defender on them. */
function updateChips(g: Game, dt: number) {
  if (g.chips < 2) return;
  const cs = coreScale(g.wave);
  for (let k = 1; k < g.chips; k++) {
    const ch = CHIPS[k - 1];
    const P = chipPos(k);
    const crew = g.defenders.filter((d) => d.chip === k);
    const pow = (1 + crew.length * 0.5 + crew.reduce((a, d) => a + d.lvl, 0) * 0.12) * cs;
    const key = `chipT${k}`;
    const timers = g.g as unknown as Record<string, number>;
    timers[key] = (timers[key] ?? 1) - dt;
    if (ch.id === 'anomalia') {
      // The two main cores are joined by a beam that fries anything crossing it.
      for (const v of g.viruses) if (!v.dead && !v.hacked && segDist2(v, { x: 0, y: 0 }, P) < (v.r + 10) ** 2) hit(g, v, 40 * pow * dt, { raw: true, quiet: true, crit: 0 });
      g.hp = Math.min(g.maxHp, g.hp + 0.5 * dt);
      continue;
    }
    if (ch.id === 'vacio') {
      // Permanent vortex: pulls and grinds what passes near.
      for (const v of g.viruses) {
        if (v.dead || dist2(v, P) > 95 ** 2) continue;
        const d = Math.sqrt(dist2(v, P)) || 1;
        const kk = Math.min(1, ((v.boss ? 12 : 40) * dt) / d);
        v.x += (P.x - v.x) * kk;
        v.y += (P.y - v.y) * kk;
        hit(g, v, 14 * pow * dt, { raw: true, quiet: true, crit: 0 });
      }
    }
    if (timers[key] > 0) continue;
    if (ch.id === 'prisma') {
      const targets = nearestN(g, P.x, P.y, 260, 6);
      if (!targets.length) continue;
      timers[key] = 2.2;
      for (const t of targets) {
        g.fx.push({ k: 'beam', x1: P.x, y1: P.y, x2: t.x, y2: t.y, c: ch.color, w: 3, life: 0.25, max: 0.25 });
        hit(g, t, 22 * pow, { raw: true });
        impact(g, t.x, t.y, ch.color, 12);
      }
      g.sfx.push('beam');
    } else if (ch.id === 'forja') {
      const t = nearest(g, P.x, P.y, 300);
      if (!t) continue;
      timers[key] = 2.8;
      // A meteor: falls from above onto the target.
      g.shots.push({ x: t.x, y: t.y - 220, px: t.x, py: t.y - 220, vx: 0, vy: 0, tx: t.x, ty: t.y, T: 0.6, t: 0, dmg: 45 * pow, r: 7, life: 0.7, pierce: 0, bounce: 0, splash: 64, slow: 0, burn: 12 * cs, homing: 0, split: 0, crit: 0.1, critMult: 2, execute: 0, target: -1, src: -3, kind: 'core', hit: [] });
    } else if (ch.id === 'bio') {
      timers[key] = 3.5;
      g.hp = Math.min(g.maxHp, g.hp + 2 + crew.length);
      ring(g, P.x, P.y, 6, 50, ch.color, 0.5, 2);
      const t = nearest(g, P.x, P.y, 260);
      if (t) g.zones.push({ k: 'acid', x: t.x, y: t.y, r: 46, t: 3, max: 3, dps: 16 * pow, slow: 0.3, pull: 0, burn: 0, dmg: 0, split: 0, src: -4, flags: {} });
    }
  }
}

function updateStructures(g: Game, dt: number) {
  updateChips(g, dt);
  // «Tormenta» modifier: lightning strikes at random.
  if (g.mod === 'tormenta' && g.phase === 'wave' && rand(g) < dt * 1.6) {
    const list = g.viruses.filter((v) => !v.dead && !v.hacked);
    const v = list[Math.floor(rand(g) * list.length)];
    if (v) {
      bolt(g, v.x + (rand(g) - 0.5) * 40, v.y - 200, v.x, v.y, '#bfe9ff', 0.3, 5);
      hit(g, v, 20 * coreScale(g.wave), { raw: true, el: 'electrico' });
      impact(g, v.x, v.y, '#bfe9ff', 16);
      g.sfx.push('zap');
    }
  }
  const G = g.g;
  const cs = coreScale(g.wave);
  const A = (id: string) => G.asc.includes(id);
  const S = structs(g);
  // Orbiting blades: an inner ring and, from level 4, a counter-rotating outer ring.
  if (G.orbit > 0) {
    G.orbitA += dt * S.orbitSpeed;
    const dmg = 10 * (1 + 0.15 * G.orbit) * cs * (A('asc-orbitales') ? 1.6 : 1);
    const rings: [number, number, number][] = [[S.orbitIn, ORBIT_R, 1]];
    if (S.orbitOut) rings.push([S.orbitOut, ORBIT_R + 42, -1]);
    rings.forEach(([n, R, dir], ri) => {
      for (let b = 0; b < n; b++) {
        const a = G.orbitA * dir + (b * Math.PI * 2) / n;
        const bx = Math.cos(a) * R;
        const by = Math.sin(a) * R;
        for (const v of g.viruses) {
          if (v.dead || v.hidden || dist2(v, { x: bx, y: by }) > (v.r + S.orbitSize) ** 2) continue;
          const key = 900000 + ri * 1000 + b;
          if ((v.hits[key] ?? -1) > g.t) continue;
          v.hits[key] = g.t + 0.3;
          hit(g, v, dmg, { raw: true, quiet: true, burn: G.orbit >= 6 ? 4 * cs : 0 });
          burst(g, bx, by, '#e8f6ff', 3, 110, 1.8);
        }
      }
    });
  }
  // Rotating beacon laser.
  if (S.faroBeams > 0) {
    G.faroA += dt * (1.6 + 0.15 * G.faro);
    const L = 320;
    const dps = 24 * (1 + 0.3 * G.faro) * cs * (A('asc-faro') ? 1.3 : 1);
    for (let b = 0; b < S.faroBeams; b++) {
      const a = G.faroA + (b * Math.PI * 2) / S.faroBeams;
      const end = { x: Math.cos(a) * L, y: Math.sin(a) * L };
      for (const v of g.viruses) {
        if (v.dead || v.hidden || segDist2(v, { x: 0, y: 0 }, end) > (v.r + S.faroW * 0.8) ** 2) continue;
        hit(g, v, dps * dt, { raw: true, quiet: true, burn: G.faro >= 4 ? 3 : 0, slow: A('asc-faro') ? 0.4 : 0 });
        if (rand(g) < 0.15) burst(g, v.x, v.y, '#ffffff', 1, 80, 1.5);
      }
    }
  }
  // Mine sower.
  if (G.coreMines > 0) {
    G.coreMinesT -= dt;
    if (G.coreMinesT <= 0 && g.phase === 'wave') {
      const asc = A('asc-minas');
      G.coreMinesT = asc ? 2 : G.coreMines >= 4 ? 3 : 4;
      const per = [1, 2, 2, 2, 3, 3][Math.min(5, G.coreMines - 1)] * (asc ? 2 : 1);
      for (let k = 0; k < per; k++) {
        const a = rand(g) * Math.PI * 2;
        const r = 115 + rand(g) * 120;
        const mx = Math.cos(a) * r;
        const my = Math.sin(a) * r;
        g.zones.push({ k: 'mine', x: mx, y: my, r: 34 + 3 * G.coreMines, t: 25, max: 25, dps: 0, slow: 0, pull: 0, burn: 0, dmg: 30 * (1 + 0.2 * G.coreMines) * cs, split: G.coreMines >= 6 || asc ? 3 : 0, src: -1, flags: {} });
        ring(g, mx, my, 2, 14, '#c8ff2e', 0.3, 2);
      }
    }
  }
  // Electric arcs from the core.
  if (G.arc > 0) {
    G.arcT -= dt;
    if (G.arcT <= 0) {
      const asc = A('asc-arco');
      const targets = asc ? nearestN(g, 0, 0, 210, 40) : nearestN(g, 0, 0, 180, 1 + G.arc);
      if (targets.length) {
        G.arcT = asc ? 1 : Math.max(0.6, 1.3 - 0.1 * G.arc);
        const dmg = 16 * (1 + 0.2 * G.arc) * cs;
        const jumps = G.arc >= 6 ? 2 : G.arc >= 3 ? 1 : 0;
        for (const t of targets) {
          bolt(g, 0, 0, t.x, t.y, '#bfe9ff', 0.24, 3.5);
          hit(g, t, dmg, { raw: true, slow: 0.3 });
          impact(g, t.x, t.y, '#bfe9ff', 12);
          let from: Virus = t;
          const seen = new Set([t.id]);
          for (let k = 0; k < jumps; k++) {
            const nx = nearest(g, from.x, from.y, 80, seen);
            if (!nx) break;
            seen.add(nx.id);
            bolt(g, from.x, from.y, nx.x, nx.y, '#bfe9ff', 0.2, 2.5);
            hit(g, nx, dmg * 0.7, { raw: true, slow: 0.3, quiet: true });
            from = nx;
          }
        }
        g.shake = Math.max(g.shake, 1.2);
      }
    }
  }
  // Heartbeat pulse.
  if (G.corePulse > 0) {
    G.corePulseT -= dt;
    const R = S.pulseR;
    if (G.corePulseT <= 0 && nearest(g, 0, 0, R)) {
      const asc = A('asc-pulso');
      G.corePulseT = G.corePulse >= 6 ? 1.6 : Math.max(2, 6.5 - 0.75 * G.corePulse);
      ring(g, 0, 0, CORE_R, R, '#ffffff', 0.55, 5);
      ring(g, 0, 0, CORE_R, R * 0.8, '#c8ff2e', 0.45, 3);
      g.fx.push({ k: 'flash', x: 0, y: 0, r: 60, life: 0.25, max: 0.25, c: '#ffffff' });
      for (const v of g.viruses) {
        if (v.dead || dist2(v, { x: 0, y: 0 }) > R ** 2) continue;
        hit(g, v, 12 * (1 + 0.25 * G.corePulse) * cs, { raw: true, quiet: true, slow: G.corePulse >= 4 ? 0.4 : 0 });
        if (asc) {
          v.slowF = v.boss ? 0.5 : 0.92;
          v.slowT = 1;
        }
        v.kb += v.boss ? 15 : 55;
      }
    }
  }
  // Spikes: the «Erizo» ascension fires a crown of spikes outwards.
  if (G.thorns > 0 && A('asc-espinas')) {
    G.ascT -= dt;
    if (G.ascT <= 0 && g.phase === 'wave') {
      G.ascT = 1.6;
      const n = 16;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + g.t;
        const x = Math.cos(a) * (WALL_R + 8);
        const y = Math.sin(a) * (WALL_R + 8);
        g.shots.push({ x, y, px: x, py: y, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, dmg: 18 * cs, r: 3, life: 0.7, pierce: 2, bounce: 0, splash: 0, slow: 0.25, burn: 0, homing: 0, split: 0, crit: 0.1, critMult: 2, execute: 0, target: -1, src: -2, kind: 'core', hit: [] });
      }
    }
  }
  // Wall self-repair and the «Ciudadela» rebuild.
  const wl = levelOfTaken(g, 'muro');
  if (G.wallMax > 0 && g.phase === 'wave') {
    if (G.wall > 0 && wl >= 3) G.wall = Math.min(G.wallMax, G.wall + G.wallMax * 0.015 * dt);
    if (G.wall <= 0 && A('asc-muro')) {
      G.wallT += dt;
      if (G.wallT >= 4) {
        G.wallT = 0;
        G.wall = G.wallMax * 0.5;
        ring(g, 0, 0, WALL_R - 10, WALL_R + 20, '#ffd60a', 0.6, 5);
      }
    }
  }
}
const levelOfTaken = (g: Game, id: string) => g.taken.reduce((n, t) => n + (t === id ? 1 : 0), 0);

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
  g.sfx.push('hurt');
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
    // Never more than MAX_ALIVE at once: the rest wait (keeps the game smooth).
    const aliveNow = g.viruses.length;
    if (aliveNow >= MAX_ALIVE) for (const sp of g.spawns) sp.at += dt;
    while (g.spawns.length && g.spawns[0].at <= g.waveT && g.viruses.length < MAX_ALIVE) {
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
  for (let c = 0; c < g.chips; c++) {
    const ring = g.defenders.filter((d) => (d.chip ?? 0) === c);
    const P = chipPos(c);
    const R = c ? 40 : RING_R;
    const rot = c ? -g.ring * 1.6 : g.ring;
    ring.forEach((d, i) => {
      const a = rot + (i * Math.PI * 2) / Math.max(1, ring.length);
      d.x = P.x + Math.cos(a) * R;
      d.y = P.y + Math.sin(a) * R;
    });
    ring.forEach((d, i) => {
      if (d.recoil) d.recoil = Math.max(0, d.recoil - dt * 7);
      updateDefender(g, d, i, dt);
    });
  }
  // Satellites orbiting the core
  if (g.g.turret > 0) {
    g.g.turretCd -= dt;
    if (g.g.turretCd <= 0) {
      const S = structs(g);
      const asc = g.g.asc.includes('asc-satelite');
      g.g.turretCd = Math.max(0.35, 0.75 - 0.06 * g.g.turret);
      for (let k = 0; k < S.sats; k++) {
        const sa = g.t * 1.4 * (k % 2 ? -1 : 1) + (k * Math.PI * 2) / S.sats;
        const R = 36 + (k % 3) * 10;
        const from = { x: Math.cos(sa) * R, y: Math.sin(sa) * R };
        const t = nearest(g, from.x, from.y, 200);
        if (!t) continue;
        const fake = makeDefender(-1, 'canon');
        const guns = Math.max(1, Math.round(g.g.turret / S.sats));
        const st: Stats = { ...fake.stats, dmg: (6 * coreScale(g.wave) * (g.g.turret >= 6 ? 1.5 : 1)) / passive(g.wave), count: guns, spread: 0.12 * guns, homing: asc ? 1 : 0 };
        fireShots(g, fake, fake as Unit, st, t, from);
      }
      for (const s of g.shots) if (s.src === -1) s.kind = 'core';
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
    if (v.infect) {
      v.hp -= v.infect * dt;
      if (v.hp <= 0) {
        kill(g, v, null);
        continue;
      }
    }
    if (v.mark !== undefined) {
      v.mark -= dt;
      if (v.mark <= 0) {
        // Photon mark detonates.
        const dmg = v.markDmg ?? 0;
        v.mark = undefined;
        g.fx.push({ k: 'flash', x: v.x, y: v.y, r: 34, life: 0.25, max: 0.25, c: '#e6fdff' });
        ring(g, v.x, v.y, 4, 34, '#e6fdff', 0.3, 3);
        for (const o of g.viruses) if (!o.dead && dist2(o, v) < (34 + o.r) ** 2) hit(g, o, o === v ? dmg : dmg * 0.4, { raw: true, quiet: o !== v, el: 'luz' });
        if (v.dead) continue;
      }
    }
    if (v.root) v.root = Math.max(0, v.root - dt);
    if (v.vuln) v.vuln = Math.max(0, v.vuln - dt);
    if (special(g, v, dt)) continue;
    if (v.rewind) v.rewind = Math.max(0, v.rewind - dt);
    const dist = Math.hypot(v.x, v.y) || 1;
    behave(g, v, dist);
    if (v.dead) continue;
    const rage = v.t > RAGE_T ? Math.min(2.4, 1.5 + (v.t - RAGE_T) / 25) : 1;
    const slowMul = v.t > RAGE_T + 15 ? 1 : (1 - v.slowF) * (G.brake && dist < 125 ? 1 - G.brake : 1);
    let sp = v.root ? 0 : v.speed * rage * Math.max(0.15, slowMul) * (v.rewind ? -0.8 : 1);
    if (v.t > RAGE_T) v.kb = 0;
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
      const wl = levelOfTaken(g, 'muro');
      G.wall -= v.dmg * 0.9 * dt;
      if (wl >= 5 && !v.boss) v.kb = Math.max(v.kb, 6);
      if (wl >= 7) hit(g, v, v.dmg * 2 * cs * dt, { raw: true, quiet: true, crit: 0 });
      if (G.wall <= 0) {
        G.wall = 0;
        g.events.push('wallbreak');
        ring(g, 0, 0, WALL_R - 10, WALL_R + 30, '#c8ff2e', 0.5, 4);
        g.shake = Math.max(g.shake, 6);
      }
    }
    if (G.thorns > 0 && atWall) {
      const T = G.thorns;
      const dps = 12 * T * cs * (T >= 4 ? 1.25 : 1) * (T >= 7 ? 1.3 : 1);
      hit(g, v, dps * dt, { raw: true, quiet: true, crit: 0, slow: T >= 3 ? 0.25 : 0, burn: T >= 5 ? 3 * T : 0 });
    }
    if (v.dead) continue;
    const auraR = 70 + 10 * G.aura;
    if (G.aura > 0 && nd < auraR) hit(g, v, 8 * G.aura * cs * dt, { raw: true, quiet: true, crit: 0 });
    if (!v.dead && !v.hacked && !v.bubble && nd < CORE_R + v.r) coreHit(g, v);
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
  defenders: Pick<Defender, 'id' | 'kind' | 'name' | 'lvl' | 'evo' | 'stats' | 'flags' | 'kills' | 'fuse' | 'chip'>[];
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
  chips?: number;
}

/** Saved at the start of each wave so a closed app resumes from there. */
export function snapshot(g: Game): InvasionSnapshot {
  return structuredClone({
    wave: g.wave - 1, hp: g.hp, maxHp: g.maxHp, g: g.g, xp: g.xp, level: g.level, pending: g.pending, kills: g.kills, bosses: g.bosses, taken: g.taken, seed: g.seed, t: g.t, nextId: g.nextId,
    unlocked: g.unlocked,
    chips: g.chips,
    defenders: g.defenders.map(({ id, kind, name, lvl, evo, stats, flags, kills, fuse, chip }) => ({ id, kind, name, lvl, evo, stats, flags, kills, fuse, chip })),
  });
}

export function restore(s: InvasionSnapshot, arena: number, arenaY = arena): Game {
  const g = newGame(s.seed, arena, arenaY, { unlocked: s.unlocked });
  Object.assign(g, {
    wave: s.wave, hp: s.hp, maxHp: s.maxHp, g: { ...defaultGlobals(), ...s.g }, xp: s.xp, level: s.level, pending: s.pending, kills: s.kills, bosses: s.bosses,
    taken: [...s.taken], t: s.t, nextId: s.nextId, phase: 'break', breakT: 1.6, chips: s.chips ?? 1,
  });
  g.defenders = s.defenders.map((d) => ({ ...makeDefender(d.id, d.kind as DefKind), ...structuredClone(d) }));
  refreshSynergies(g);
  g.events.length = 0;
  return g;
}
