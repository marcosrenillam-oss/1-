/**
 * «Tu Núcleo»: a purely cosmetic chip the player builds with the energy (⚡)
 * earned by answering correctly. It never changes the game itself.
 *
 * It works like a town hall: the chip has a level (1-7). Each chip level
 * opens a number of slots, lets modules be upgraded up to a cap and unlocks
 * new modules and cosmetics. To evolve the chip, every slot must be filled
 * and every module upgraded to the current cap. Modules go up to level 10,
 * one level at a time, and never more than SPREAD levels above the others.
 */

export type ModuleId =
  | 'nucleo' | 'memoria' | 'antena' | 'cristal' | 'bateria' | 'ventilador' | 'reactor'
  | 'bobina' | 'prisma' | 'condensador' | 'laser' | 'torre' | 'cuantico' | 'holo';

export type ModLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export interface Slot {
  m: ModuleId;
  lvl: ModLevel;
}

export interface CoreState {
  v: 2;
  energy: number;
  /** Lifetime energy earned. */
  earned: number;
  /** Chip («town hall») level, 1-7. */
  chip: number;
  /** One entry per slot open at this chip level. */
  slots: (Slot | null)[];
  owned: string[];
  color: string;
  material: string;
  anim: string;
  pins: string;
}

export const MAX_MODULE_LEVEL = 10;
/** A module can't be upgraded to level N unless every other module is at least N - SPREAD. */
export const SPREAD = 3;

export interface ChipTier {
  name: string;
  board: number;
  slots: number;
  /** Max module level at this chip level. */
  cap: ModLevel;
  /** Energy to evolve INTO this level (0 for level 1). */
  cost: number;
}
export const CHIP_TIERS: ChipTier[] = [
  { name: 'Prototipo', board: 3, slots: 5, cap: 4, cost: 0 },
  { name: 'Circuito', board: 3, slots: 9, cap: 6, cost: 600 },
  { name: 'Procesador', board: 4, slots: 12, cap: 8, cost: 2500 },
  { name: 'Núcleo doble', board: 4, slots: 16, cap: 10, cost: 6000 },
  { name: 'Matriz', board: 5, slots: 21, cap: 10, cost: 12000 },
  { name: 'Superchip', board: 5, slots: 25, cap: 10, cost: 20000 },
  { name: 'Singularidad', board: 5, slots: 25, cap: 10, cost: 35000 },
];
export const CHIP_MAX = CHIP_TIERS.length;
export const tierOf = (chip: number) => CHIP_TIERS[Math.min(CHIP_MAX, Math.max(1, chip)) - 1];

export const MODULES: { id: ModuleId; name: string; mult: number; req: number }[] = [
  { id: 'nucleo', name: 'Núcleo', mult: 1, req: 1 },
  { id: 'memoria', name: 'Memoria', mult: 1, req: 1 },
  { id: 'antena', name: 'Antena', mult: 1.1, req: 1 },
  { id: 'cristal', name: 'Cristal', mult: 1.2, req: 2 },
  { id: 'bateria', name: 'Batería', mult: 1.3, req: 2 },
  { id: 'ventilador', name: 'Ventilador', mult: 1.4, req: 3 },
  { id: 'reactor', name: 'Reactor', mult: 1.6, req: 3 },
  { id: 'bobina', name: 'Bobina', mult: 1.8, req: 4 },
  { id: 'prisma', name: 'Prisma', mult: 2, req: 4 },
  { id: 'condensador', name: 'Condensador', mult: 2.2, req: 5 },
  { id: 'laser', name: 'Láser', mult: 2.4, req: 5 },
  { id: 'torre', name: 'Torre de datos', mult: 2.6, req: 6 },
  { id: 'cuantico', name: 'Qubit', mult: 2.8, req: 6 },
  { id: 'holo', name: 'Holograma', mult: 3, req: 6 },
];
export const moduleInfo = (m: ModuleId) => MODULES.find((x) => x.id === m)!;

export interface Item { id: string; name: string; cost: number; req: number }
export const COLORS: (Item & { hex: string })[] = [
  { id: 'lima', name: 'Lima', cost: 0, req: 1, hex: '#c8ff2e' },
  { id: 'azul', name: 'Azul eléctrico', cost: 150, req: 1, hex: '#3d9bff' },
  { id: 'amarillo', name: 'Amarillo', cost: 300, req: 1, hex: '#ffd60a' },
  { id: 'rosa', name: 'Rosa', cost: 500, req: 1, hex: '#ff4fa3' },
  { id: 'rojo', name: 'Rojo', cost: 700, req: 2, hex: '#ff3b3b' },
  { id: 'cian', name: 'Cian', cost: 900, req: 2, hex: '#2ee6d6' },
  { id: 'naranja', name: 'Naranja', cost: 1100, req: 2, hex: '#ff8a1f' },
  { id: 'violeta', name: 'Violeta', cost: 1500, req: 3, hex: '#a66bff' },
  { id: 'menta', name: 'Menta', cost: 1800, req: 3, hex: '#5dffa8' },
  { id: 'coral', name: 'Coral', cost: 2200, req: 3, hex: '#ff7a6b' },
  { id: 'oro', name: 'Oro', cost: 3000, req: 4, hex: '#f5c451' },
  { id: 'hielo', name: 'Hielo', cost: 3500, req: 4, hex: '#e8f6ff' },
  { id: 'magma', name: 'Magma', cost: 4500, req: 5, hex: '#ff5a1f' },
  { id: 'aurora', name: 'Aurora', cost: 6000, req: 5, hex: '#7dffd8' },
  { id: 'plata', name: 'Plata', cost: 7000, req: 6, hex: '#d6dde6' },
  { id: 'noche', name: 'Añil nocturno', cost: 8000, req: 6, hex: '#6b7cff' },
  { id: 'arcoiris', name: 'Arcoíris', cost: 12000, req: 7, hex: '#c8ff2e' },
];
export const MATERIALS: (Item & { body: string; edge: string })[] = [
  { id: 'carbono', name: 'Carbono', cost: 0, req: 1, body: '#15171b', edge: '#2a2e35' },
  { id: 'grafito', name: 'Grafito', cost: 250, req: 1, body: '#23262c', edge: '#3a3f48' },
  { id: 'titanio', name: 'Titanio', cost: 800, req: 2, body: '#2c3138', edge: '#6b7380' },
  { id: 'cobre', name: 'Cobre', cost: 1200, req: 2, body: '#26170f', edge: '#b8733e' },
  { id: 'obsidiana', name: 'Obsidiana', cost: 2000, req: 3, body: '#0a0614', edge: '#3b2a5c' },
  { id: 'esmeralda', name: 'Esmeralda', cost: 3000, req: 3, body: '#06201a', edge: '#1f6b55' },
  { id: 'zafiro', name: 'Zafiro', cost: 4000, req: 4, body: '#081428', edge: '#2f5fbf' },
  { id: 'rubi', name: 'Rubí', cost: 6000, req: 5, body: '#1f0609', edge: '#a8323e' },
  { id: 'dorado', name: 'Dorado', cost: 9000, req: 6, body: '#2a2008', edge: '#b8902e' },
  { id: 'platino', name: 'Platino', cost: 14000, req: 7, body: '#1e2126', edge: '#e6ebf2' },
];
export const ANIMS: Item[] = [
  { id: 'quieto', name: 'Quieto', cost: 0, req: 1 },
  { id: 'pulso', name: 'Pulso', cost: 300, req: 1 },
  { id: 'flujo', name: 'Flujo de datos', cost: 900, req: 2 },
  { id: 'latido', name: 'Latido', cost: 1800, req: 3 },
  { id: 'escaneo', name: 'Escáner', cost: 3000, req: 4 },
  { id: 'orbita', name: 'Órbita', cost: 4500, req: 5 },
  { id: 'chispas', name: 'Chispas', cost: 7000, req: 6 },
  { id: 'tormenta', name: 'Tormenta', cost: 12000, req: 7 },
];
export const PINS: Item[] = [
  { id: 'basicos', name: 'Básicos', cost: 0, req: 1 },
  { id: 'dobles', name: 'Dobles', cost: 400, req: 1 },
  { id: 'cobre', name: 'De cobre', cost: 1000, req: 2 },
  { id: 'dorados', name: 'Dorados', cost: 1500, req: 3 },
  { id: 'luz', name: 'De luz', cost: 4000, req: 4 },
  { id: 'cristal', name: 'De cristal', cost: 5500, req: 5 },
  { id: 'arcoiris', name: 'Arcoíris', cost: 8000, req: 6 },
  { id: 'plasma', name: 'Plasma', cost: 12000, req: 7 },
];
export type Kind = 'color' | 'material' | 'anim' | 'pins';
export const LISTS: Record<Kind, Item[]> = { color: COLORS, material: MATERIALS, anim: ANIMS, pins: PINS };

const FREE = ['color:lima', 'material:carbono', 'anim:quieto', 'pins:basicos'];
/** Owned cosmetics are stored as "kind:id" (ids repeat across kinds, e.g. «arcoiris»). */
export const ownKey = (kind: Kind, id: string) => `${kind}:${id}`;

export function emptyCore(): CoreState {
  return { v: 2, energy: 0, earned: 0, chip: 1, slots: Array(CHIP_TIERS[0].slots).fill(null), owned: [...FREE], color: 'lima', material: 'carbono', anim: 'quieto', pins: 'basicos' };
}

export function normalizeCore(v: unknown): CoreState {
  const base = emptyCore();
  if (!v || typeof v !== 'object') return base;
  const r = v as Record<string, unknown>;
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
  base.earned = num(r.earned);
  if (r.v !== 2) {
    // First version of the chip (3 levels, no town hall): rebuild from scratch
    // with every bit of energy ever earned refunded, keeping the cosmetics.
    base.earned = Math.max(base.earned, num(r.energy));
    base.energy = base.earned;
    const kinds: Kind[] = ['color', 'material', 'anim', 'pins'];
    const old = Array.isArray(r.owned) ? r.owned.filter((x): x is string => typeof x === 'string') : [];
    for (const k of kinds) for (const it of LISTS[k]) if (old.includes(it.id) && it.id !== 'arcoiris') base.owned.push(ownKey(k, it.id));
    if (old.includes('arcoiris')) base.owned.push(ownKey('color', 'arcoiris'));
    base.owned = [...new Set(base.owned)];
  } else {
    base.energy = num(r.energy);
    base.earned = Math.max(base.earned, base.energy);
    base.chip = Math.min(CHIP_MAX, Math.max(1, num(r.chip) || 1));
    const n = tierOf(base.chip).slots;
    const slots = Array.isArray(r.slots) ? r.slots : [];
    const cap = tierOf(base.chip).cap;
    base.slots = Array.from({ length: n }, (_, i) => {
      const s = slots[i] as Slot | null;
      return s && MODULES.some((m) => m.id === s.m) && Number.isInteger(s.lvl) && s.lvl >= 1 ? { m: s.m, lvl: Math.min(cap, s.lvl) as ModLevel } : null;
    });
    if (Array.isArray(r.owned)) base.owned = [...new Set([...base.owned, ...r.owned.filter((x): x is string => typeof x === 'string')])];
  }
  const ok = (kind: Kind, id: unknown) => typeof id === 'string' && LISTS[kind].some((x) => x.id === id) && base.owned.includes(ownKey(kind, id));
  if (ok('color', r.color)) base.color = r.color as string;
  if (ok('material', r.material)) base.material = r.material as string;
  if (ok('anim', r.anim)) base.anim = r.anim as string;
  if (ok('pins', r.pins)) base.pins = r.pins as string;
  return base;
}

// ── Earning ───────────────────────────────────────────────────────────────
/** Energy for a correct answer of a given difficulty level (1-7), with streak bonus. */
export function energyForAnswer(level: number, streak: number): number {
  const base = 2 + level * 2;
  const bonus = streak >= 10 ? 2 : streak >= 5 ? 1.5 : 1;
  return Math.round(base * bonus);
}
export const PHASE_BONUS = (stage: number) => 50 * stage;
export const FULL_RUN_BONUS = 1000;
export const BOSS_BONUS = 300;

export function addEnergy(core: CoreState, n: number): void {
  core.energy += n;
  core.earned += n;
}

// ── Building ──────────────────────────────────────────────────────────────
const round10 = (n: number) => Math.max(10, Math.round(n / 10) * 10);
/** Energy to bring a module to level `lvl` (1 = building it). */
export function levelCost(m: ModuleId, lvl: number): number {
  return round10(30 * moduleInfo(m).mult * Math.pow(1.34, lvl - 1));
}
export const placeCost = (m: ModuleId) => levelCost(m, 1);

export const filledCount = (c: CoreState) => c.slots.filter(Boolean).length;

export type UpgradeBlock =
  | { kind: 'max' }
  /** The chip must evolve first. */
  | { kind: 'chip'; chip: number }
  /** Other modules must be raised first. */
  | { kind: 'others'; level: number };

/** Lowest level among the other built modules (or Infinity). */
function othersMin(c: CoreState, i: number): number {
  let min = Infinity;
  c.slots.forEach((s, j) => {
    if (s && j !== i) min = Math.min(min, s.lvl);
  });
  return min;
}

export function chipForLevel(lvl: number): number {
  return CHIP_TIERS.findIndex((t) => t.cap >= lvl) + 1;
}

export function upgradeInfo(c: CoreState, i: number): { cost: number; block: UpgradeBlock | null } | null {
  const s = c.slots[i];
  if (!s) return null;
  const to = s.lvl + 1;
  const cost = to <= MAX_MODULE_LEVEL ? levelCost(s.m, to) : 0;
  if (s.lvl >= MAX_MODULE_LEVEL) return { cost, block: { kind: 'max' } };
  if (to > tierOf(c.chip).cap) return { cost, block: { kind: 'chip', chip: chipForLevel(to) } };
  if (othersMin(c, i) < to - SPREAD) return { cost, block: { kind: 'others', level: to - SPREAD } };
  return { cost, block: null };
}

/** All mutations return a new state, or null if not affordable/possible. */
function pay(c: CoreState, cost: number): CoreState | null {
  if (c.energy < cost) return null;
  return { ...structuredClone(c), energy: c.energy - cost };
}
export function place(c: CoreState, i: number, m: ModuleId): CoreState | null {
  if (i < 0 || i >= c.slots.length || c.slots[i] || moduleInfo(m).req > c.chip) return null;
  const n = pay(c, placeCost(m));
  if (n) n.slots[i] = { m, lvl: 1 };
  return n;
}
export function upgrade(c: CoreState, i: number): CoreState | null {
  const info = upgradeInfo(c, i);
  if (!info || info.block) return null;
  const n = pay(c, info.cost);
  if (n) n.slots[i] = { ...n.slots[i]!, lvl: (n.slots[i]!.lvl + 1) as ModLevel };
  return n;
}

export interface EvolveInfo {
  next: number;
  cost: number;
  filled: number;
  slots: number;
  atCap: number;
  cap: number;
  ready: boolean;
}
/** What evolving the chip to the next level needs (null at the top). */
export function evolveInfo(c: CoreState): EvolveInfo | null {
  if (c.chip >= CHIP_MAX) return null;
  const t = tierOf(c.chip);
  const filled = filledCount(c);
  const atCap = c.slots.filter((s) => s && s.lvl >= t.cap).length;
  return { next: c.chip + 1, cost: tierOf(c.chip + 1).cost, filled, slots: c.slots.length, atCap, cap: t.cap, ready: filled === c.slots.length && atCap === c.slots.length };
}
export function evolve(c: CoreState): CoreState | null {
  const info = evolveInfo(c);
  if (!info || !info.ready) return null;
  const n = pay(c, info.cost);
  if (!n) return null;
  n.chip = info.next;
  n.slots = [...n.slots, ...Array(tierOf(n.chip).slots - n.slots.length).fill(null)];
  return n;
}

/** What a chip level unlocks, for the evolve preview and celebration. */
export function unlocksAt(chip: number): { slots: number; cap: number; board: number; modules: string[]; cosmetics: string[] } {
  const t = tierOf(chip);
  const prev = tierOf(chip - 1);
  return {
    slots: chip > 1 ? t.slots - prev.slots : t.slots,
    cap: t.cap,
    board: t.board,
    modules: MODULES.filter((m) => m.req === chip).map((m) => m.name),
    cosmetics: (Object.keys(LISTS) as Kind[]).flatMap((k) => LISTS[k].filter((x) => x.req === chip && x.cost > 0).map((x) => x.name)),
  };
}

export function buyOrEquip(c: CoreState, kind: Kind, id: string): CoreState | null {
  const item = LISTS[kind].find((x) => x.id === id);
  if (!item) return null;
  const key = ownKey(kind, id);
  if (c.owned.includes(key)) return { ...c, [kind]: id };
  if (item.req > c.chip) return null;
  const n = pay(c, item.cost);
  if (!n) return null;
  n.owned = [...n.owned, key];
  n[kind] = id;
  return n;
}

/** Overall progress 0-100 towards a fully built Singularidad chip. */
export function coreProgress(c: CoreState): number {
  let total = 0;
  let done = 0;
  for (let k = 2; k <= CHIP_MAX; k++) {
    total += 20;
    if (c.chip >= k) done += 20;
  }
  const maxSlots = CHIP_TIERS[CHIP_MAX - 1].slots;
  total += maxSlots * MAX_MODULE_LEVEL;
  done += c.slots.reduce((a, s) => a + (s ? s.lvl : 0), 0);
  return Math.floor((done / total) * 100);
}
