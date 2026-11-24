/** «Invasión»: endless defence of the chip's core against viruses. */

export type DefKind =
  | 'canon' | 'laser' | 'rayo' | 'pulso' | 'misil' | 'hielo' | 'cuchillas' | 'mortero'
  | 'francotirador' | 'llamas' | 'gravedad' | 'drones' | 'acido' | 'bumeran' | 'minas' | 'cronos';

export interface Stats {
  dmg: number;
  /** Shots per second (blades: spin speed; beams/fields: damage ticks). */
  rate: number;
  range: number;
  /** Projectiles per shot, beams, bolts, waves or blades. */
  count: number;
  /** Total spread angle of a volley, in radians. */
  spread: number;
  speed: number;
  pierce: number;
  bounce: number;
  splash: number;
  /** Slow factor 0-0.9 applied on hit. */
  slow: number;
  /** Damage per second while burning. */
  burn: number;
  /** Extra chain jumps. */
  chain: number;
  crit: number;
  critMult: number;
  /** Instantly kills viruses below this fraction of their life. */
  execute: number;
  homing: number;
  /** Sub-projectiles released on impact. */
  split: number;
  knock: number;
}

export interface Defender {
  id: number;
  kind: DefKind;
  name: string;
  /** Upgrades applied (drives evolutions at 3 and 7). */
  lvl: number;
  /** Evolution ids taken, in order. */
  evo: string[];
  stats: Stats;
  flags: Record<string, number>;
  kills: number;
  // runtime
  cd: number;
  aim: number;
  x: number;
  y: number;
  lockId: number;
  lockT: number;
  spin: number;
  pending: number;
  /** Legendary fusion: a second defender living in the same body. */
  fuse?: { kind: DefKind; stats: Stats; flags: Record<string, number>; evo: string[]; cd: number; spin: number; pending: number; lockId: number; lockT: number; aim: number };
  /** Drones of a drone bay. */
  drones?: { x: number; y: number; cd: number; a: number }[];
}

export type VirusType =
  | 'basico' | 'rapido' | 'tanque' | 'divisor' | 'mini' | 'zigzag' | 'escudo' | 'curandero' | 'fantasma' | 'invocador' | 'kamikaze'
  | 'coloso' | 'reina' | 'espectro' | 'acorazado' | 'hidra';

export interface Virus {
  id: number;
  type: VirusType;
  x: number;
  y: number;
  r: number;
  hp: number;
  max: number;
  shield: number;
  speed: number;
  armor: number;
  dmg: number;
  xp: number;
  boss: boolean;
  elite: boolean;
  gen: number;
  slowF: number;
  slowT: number;
  burn: number;
  burnT: number;
  flash: number;
  spin: number;
  kb: number;
  t: number;
  timer: number;
  hidden: boolean;
  dead: boolean;
  hits: Record<number, number>;
}

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  r: number;
  life: number;
  pierce: number;
  bounce: number;
  splash: number;
  slow: number;
  burn: number;
  homing: number;
  split: number;
  crit: number;
  critMult: number;
  execute: number;
  target: number;
  src: number;
  kind: DefKind | 'core' | 'frag';
  /** Boomerang: comes back to its thrower. */
  ret?: number;
  /** Frozen viruses take +50 %. */
  brittle?: boolean;
  /** Ignores armour. */
  pa?: boolean;
  /** Acid shell: leaves a puddle. */
  acid?: boolean;
  hit: number[];
  /** Mortar shells: landing point and flight time. */
  tx?: number;
  ty?: number;
  T?: number;
  t?: number;
  px: number;
  py: number;
}

export type Fx =
  | { k: 'p'; x: number; y: number; vx: number; vy: number; life: number; max: number; c: string; s: number }
  | { k: 'ring'; x: number; y: number; r0: number; r1: number; life: number; max: number; c: string; w: number }
  | { k: 'bolt'; pts: number[]; life: number; max: number; c: string }
  | { k: 'beam'; x1: number; y1: number; x2: number; y2: number; c: string; w: number; life: number; max: number }
  | { k: 'txt'; x: number; y: number; s: string; life: number; max: number; c: string }
  | { k: 'xp'; x: number; y: number; life: number; max: number; c: string };

/** Ground effects: acid puddles, gravity wells, mines. */
export interface Zone {
  k: 'acid' | 'well' | 'mine';
  x: number;
  y: number;
  r: number;
  t: number;
  max: number;
  dps: number;
  slow: number;
  pull: number;
  burn: number;
  dmg: number;
  split: number;
  src: number;
  flags: Record<string, number>;
}

export interface Globals {
  dmgMul: number;
  rateMul: number;
  rangeMul: number;
  critAdd: number;
  xpMul: number;
  energyMul: number;
  regen: number;
  shieldMax: number;
  shield: number;
  shieldCd: number;
  shieldT: number;
  aura: number;
  brake: number;
  /** Core structures (visible upgrades around the defence). */
  wall: number;
  wallMax: number;
  thorns: number;
  orbit: number;
  orbitA: number;
  faro: number;
  faroA: number;
  coreMines: number;
  coreMinesT: number;
  arc: number;
  arcT: number;
  corePulse: number;
  corePulseT: number;
  nova: number;
  novaT: number;
  rerolls: number;
  choices: number;
  execute: number;
  bossMul: number;
  firstHit: number;
  chainReaction: number;
  hitSlow: number;
  hitBurn: number;
  backup: number;
  turret: number;
  turretCd: number;
  enemyHp: number;
  enemySpeed: number;
  horde: number;
  extraBoss: number;
  bossNext: number;
  bossBounty: number;
  eliteChance: number;
  waveSpeed: number;
}

export interface Game {
  t: number;
  /** Spawn distance from the core, in world units (set from the screen size). */
  arena: number;
  /** Half the visible height, in world units. */
  arenaY: number;
  wave: number;
  waveT: number;
  waveLen: number;
  phase: 'wave' | 'break';
  breakT: number;
  spawns: { at: number; type: VirusType; elite?: boolean; angle?: number }[];
  hp: number;
  maxHp: number;
  g: Globals;
  defenders: Defender[];
  viruses: Virus[];
  shots: Shot[];
  fx: Fx[];
  xp: number;
  level: number;
  pending: number;
  kills: number;
  bosses: number;
  taken: string[];
  ring: number;
  zones: Zone[];
  /** Active synergies between defenders. */
  syn: string[];
  /** Defender types that can appear (Laboratorio unlocks). */
  unlocked: DefKind[];
  shake: number;
  hurt: number;
  over: boolean;
  nextId: number;
  seed: number;
  /** HUD events since the last read: 'wave', 'boss', 'level', 'hit', 'evo', 'backup'. */
  events: string[];
}
