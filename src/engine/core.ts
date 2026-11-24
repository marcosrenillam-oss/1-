/**
 * «Tu Núcleo»: a purely cosmetic chip the player builds with the energy (⚡)
 * earned by answering correctly. It never changes the game itself.
 */

export type ModuleId = 'nucleo' | 'memoria' | 'antena' | 'cristal' | 'ventilador' | 'reactor' | 'prisma';
export interface Slot {
  m: ModuleId;
  lvl: 1 | 2 | 3;
}

export interface CoreState {
  energy: number;
  /** Lifetime energy earned. */
  earned: number;
  /** Board side: 3, 4 or 5. */
  board: number;
  slots: (Slot | null)[];
  owned: string[];
  color: string;
  material: string;
  anim: string;
  pins: string;
}

export const MODULES: { id: ModuleId; name: string; mult: number }[] = [
  { id: 'nucleo', name: 'Núcleo', mult: 1 },
  { id: 'memoria', name: 'Memoria', mult: 1 },
  { id: 'antena', name: 'Antena', mult: 1.2 },
  { id: 'cristal', name: 'Cristal', mult: 1.4 },
  { id: 'ventilador', name: 'Ventilador', mult: 1.6 },
  { id: 'reactor', name: 'Reactor', mult: 2 },
  { id: 'prisma', name: 'Prisma', mult: 2.5 },
];

interface Item { id: string; name: string; cost: number }
export const COLORS: (Item & { hex: string })[] = [
  { id: 'lima', name: 'Lima', cost: 0, hex: '#c8ff2e' },
  { id: 'azul', name: 'Azul eléctrico', cost: 150, hex: '#3d9bff' },
  { id: 'amarillo', name: 'Amarillo', cost: 300, hex: '#ffd60a' },
  { id: 'rosa', name: 'Rosa', cost: 500, hex: '#ff4fa3' },
  { id: 'rojo', name: 'Rojo', cost: 700, hex: '#ff3b3b' },
  { id: 'cian', name: 'Cian', cost: 1000, hex: '#2ee6d6' },
  { id: 'violeta', name: 'Violeta', cost: 1500, hex: '#a66bff' },
  { id: 'oro', name: 'Oro', cost: 2500, hex: '#f5c451' },
  { id: 'hielo', name: 'Hielo', cost: 4000, hex: '#e8f6ff' },
  { id: 'arcoiris', name: 'Arcoíris', cost: 8000, hex: '#c8ff2e' },
];
export const MATERIALS: (Item & { body: string; edge: string })[] = [
  { id: 'carbono', name: 'Carbono', cost: 0, body: '#15171b', edge: '#2a2e35' },
  { id: 'grafito', name: 'Grafito', cost: 250, body: '#23262c', edge: '#3a3f48' },
  { id: 'titanio', name: 'Titanio', cost: 800, body: '#2c3138', edge: '#6b7380' },
  { id: 'obsidiana', name: 'Obsidiana', cost: 2000, body: '#0a0614', edge: '#3b2a5c' },
  { id: 'esmeralda', name: 'Esmeralda', cost: 3500, body: '#06201a', edge: '#1f6b55' },
  { id: 'dorado', name: 'Dorado', cost: 6000, body: '#2a2008', edge: '#b8902e' },
];
export const ANIMS: Item[] = [
  { id: 'quieto', name: 'Quieto', cost: 0 },
  { id: 'pulso', name: 'Pulso', cost: 300 },
  { id: 'flujo', name: 'Flujo de datos', cost: 900 },
  { id: 'latido', name: 'Latido', cost: 1800 },
  { id: 'orbita', name: 'Órbita', cost: 3500 },
];
export const PINS: Item[] = [
  { id: 'basicos', name: 'Básicos', cost: 0 },
  { id: 'dobles', name: 'Dobles', cost: 400 },
  { id: 'dorados', name: 'Dorados', cost: 1500 },
  { id: 'luz', name: 'De luz', cost: 4000 },
];

export const BOARD_COST: Record<number, number> = { 4: 2500, 5: 9000 };

export function emptyCore(): CoreState {
  return { energy: 0, earned: 0, board: 3, slots: Array(9).fill(null), owned: ['lima', 'carbono', 'quieto', 'basicos'], color: 'lima', material: 'carbono', anim: 'quieto', pins: 'basicos' };
}

export function normalizeCore(v: unknown): CoreState {
  const base = emptyCore();
  if (!v || typeof v !== 'object') return base;
  const r = v as Partial<CoreState>;
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
  base.energy = num(r.energy);
  base.earned = Math.max(num(r.earned), base.energy);
  base.board = r.board === 4 || r.board === 5 ? r.board : 3;
  const n = base.board * base.board;
  const slots = Array.isArray(r.slots) ? r.slots : [];
  base.slots = Array.from({ length: n }, (_, i) => {
    const s = slots[i];
    return s && MODULES.some((m) => m.id === s.m) && [1, 2, 3].includes(s.lvl) ? { m: s.m, lvl: s.lvl } : null;
  });
  if (Array.isArray(r.owned)) base.owned = [...new Set([...base.owned, ...r.owned.filter((x): x is string => typeof x === 'string')])];
  const ok = (id: unknown, list: Item[]) => typeof id === 'string' && list.some((x) => x.id === id) && base.owned.includes(id);
  if (ok(r.color, COLORS)) base.color = r.color!;
  if (ok(r.material, MATERIALS)) base.material = r.material!;
  if (ok(r.anim, ANIMS)) base.anim = r.anim!;
  if (ok(r.pins, PINS)) base.pins = r.pins!;
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
const round10 = (n: number) => Math.round(n / 10) * 10;
const filled = (c: CoreState) => c.slots.filter(Boolean).length;
export function placeCost(c: CoreState, m: ModuleId): number {
  const mult = MODULES.find((x) => x.id === m)!.mult;
  return round10(40 * Math.pow(1.28, filled(c)) * mult);
}
export function upgradeCost(c: CoreState, i: number): number | null {
  const s = c.slots[i];
  if (!s || s.lvl >= 3) return null;
  const mult = MODULES.find((x) => x.id === s.m)!.mult;
  return round10(60 * Math.pow(1.22, filled(c)) * mult * (s.lvl === 1 ? 1.5 : 3));
}
export function nextBoard(c: CoreState): number | null {
  return c.board < 5 ? c.board + 1 : null;
}

/** All mutations return a new state, or null if not affordable/possible. */
function pay(c: CoreState, cost: number): CoreState | null {
  if (c.energy < cost) return null;
  return { ...structuredClone(c), energy: c.energy - cost };
}
export function place(c: CoreState, i: number, m: ModuleId): CoreState | null {
  if (c.slots[i]) return null;
  const n = pay(c, placeCost(c, m));
  if (n) n.slots[i] = { m, lvl: 1 };
  return n;
}
export function upgrade(c: CoreState, i: number): CoreState | null {
  const cost = upgradeCost(c, i);
  if (cost === null) return null;
  const n = pay(c, cost);
  if (n) n.slots[i] = { ...n.slots[i]!, lvl: (n.slots[i]!.lvl + 1) as 1 | 2 | 3 };
  return n;
}
export function expand(c: CoreState): CoreState | null {
  const size = nextBoard(c);
  if (!size || filled(c) < c.board * c.board) return null;
  const n = pay(c, BOARD_COST[size]);
  if (!n) return null;
  // Keep existing modules in the same rows/cols of the bigger board.
  const old = n.slots;
  n.slots = Array.from({ length: size * size }, (_, k) => {
    const r = Math.floor(k / size);
    const col = k % size;
    return r < c.board && col < c.board ? old[r * c.board + col] : null;
  });
  n.board = size;
  return n;
}
export type Kind = 'color' | 'material' | 'anim' | 'pins';
const LISTS: Record<Kind, Item[]> = { color: COLORS, material: MATERIALS, anim: ANIMS, pins: PINS };
export function buyOrEquip(c: CoreState, kind: Kind, id: string): CoreState | null {
  const item = LISTS[kind].find((x) => x.id === id);
  if (!item) return null;
  if (c.owned.includes(id)) return { ...c, [kind]: id };
  const n = pay(c, item.cost);
  if (!n) return null;
  n.owned = [...n.owned, id];
  n[kind] = id;
  return n;
}

/** Overall build level: grows with everything spent on the chip. */
export function coreLevel(c: CoreState): number {
  return Math.floor(Math.sqrt((c.earned - c.energy) / 40)) + 1;
}
