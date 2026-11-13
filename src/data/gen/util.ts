import { seededRng, shuffle, type Rng } from '../../engine/rng';
import { LEVELS, type Category, type Level, type Mode, type QKind, type Question, type Tier } from '../types';

/** Legacy names keep ids and per-tier counts stable for levels 1-4. */
const LEVEL_NAME: Record<Level, Mode> = { 1: 'facil', 2: 'normal', 3: 'dificil', 4: 'experto', 5: 'experto', 6: 'experto', 7: 'experto' };

export interface Ctx {
  level: Level;
  tier: Tier;
  /** Global difficulty 1-12: level (1-7) - 1 + tier (1-6). */
  D: number;
  rng: Rng;
}

export interface Draft {
  cat: Category;
  prompt: string;
  correct: string;
  wrong: string[];
  expl: string;
  visual?: string[];
  /** Interactive answer mechanics (default choice: correct + 3 wrong). */
  kind?: QKind;
  items?: string[];
  cell?: number;
  size?: number;
  seq?: number[];
  ordered?: boolean;
  target?: string;
}

export interface Family {
  id: string;
  /** How many questions to create per tier for a mode. */
  counts: (mode: Mode) => Partial<Record<Tier, number>>;
  /** Never repeat the same prompt anywhere in the bank (even with other options). */
  uniquePrompt?: boolean;
  make: (c: Ctx) => Draft | null;
}

export const pick = <T>(rng: Rng, a: readonly T[]): T => a[Math.floor(rng() * a.length)];
export const sample = <T>(rng: Rng, a: readonly T[], k: number): T[] => shuffle(a, rng).slice(0, k);
export const randInt = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Spanish list: "A, B y C" (uses "e" before an /i/ sound). */
export function list(items: string[]): string {
  if (items.length < 2) return items.join('');
  const last = items[items.length - 1];
  const conj = /^(i|hi)(?!e)/i.test(last.normalize('NFD').replace(/\p{M}/gu, '')) ? 'e' : 'y';
  return `${items.slice(0, -1).join(', ')} ${conj} ${last}`;
}

/** Spanish "o" → "u" before an /o/ sound. */
export function or(a: string, b: string): string {
  return `${a} ${/^(o|ho)/i.test(b.normalize('NFD').replace(/\p{M}/gu, '')) ? 'u' : 'o'} ${b}`;
}

export function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const out: T[][] = [];
  items.forEach((x, i) => {
    for (const p of permutations([...items.slice(0, i), ...items.slice(i + 1)])) out.push([x, ...p]);
  });
  return out;
}

export const NAMES = [
  'Ana', 'Bruno', 'Carla', 'Dani', 'Elena', 'Fran', 'Gael', 'Hugo', 'Inés', 'Julia', 'Leo',
  'Marta', 'Nico', 'Olga', 'Pablo', 'Raúl', 'Sara', 'Teo', 'Vera', 'Lucas', 'Noa', 'Iván', 'Clara', 'Mario',
];

export function strip(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function valid(d: Draft): boolean {
  switch (d.kind ?? 'choice') {
    case 'choice': {
      const opts = [d.correct, ...d.wrong];
      return opts.length === 4 && new Set(opts).size === 4;
    }
    case 'order':
      return !!d.items && d.items.length >= 3 && new Set(d.items).size === d.items.length;
    case 'tap':
      return d.cell !== undefined && !!d.visual;
    case 'memory':
      return !!d.size && !!d.seq && d.seq.length > 0;
    case 'paint':
      return !!d.target && /^[01]{9}$/.test(d.target) && d.target.includes('1');
  }
}

/** Deterministically builds every family for every level. */
export function buildGenerated(families: Family[]): Question[] {
  const out: Question[] = [];
  const seen = new Set<string>();
  const prompts = new Set<string>();
  for (const level of LEVELS) {
    const name = LEVEL_NAME[level];
    // Levels 1-4 keep their historical seeds and ids ("gf-…", "gn-"…).
    const seedKey = level <= 4 ? name : `L${level}`;
    const prefix = level <= 4 ? `g${name[0]}` : `g${level}`;
    for (const fam of families) {
      const rng = seededRng(hash(`${seedKey}:${fam.id}`));
      let n = 0;
      const counts = fam.counts(name);
      for (const [tierStr, k] of Object.entries(counts)) {
        const tier = Number(tierStr) as Tier;
        let made = 0;
        let tries = 0;
        while (made < (k ?? 0) && tries < (k ?? 0) * 80) {
          tries++;
          const d = fam.make({ level, tier, D: level - 1 + tier, rng });
          if (!d || !valid(d)) continue;
          const kind = d.kind ?? 'choice';
          const opts = kind === 'choice' ? [d.correct, ...d.wrong] : [];
          const payload = JSON.stringify([d.items, d.cell, d.seq, d.target]);
          const key = `${level}|${d.prompt}|${(d.visual ?? []).join('/')}|${[...opts].sort().join('/')}|${payload}`;
          if (seen.has(key)) continue;
          if (fam.uniquePrompt && prompts.has(d.prompt)) continue;
          seen.add(key);
          prompts.add(d.prompt);
          n++;
          made++;
          out.push({
            id: `${prefix}-${fam.id}${n}`,
            level,
            tier,
            category: d.cat,
            prompt: d.prompt,
            options: opts,
            answer: 0,
            explanation: d.expl,
            style: fam.id,
            ...(d.visual ? { visual: d.visual } : {}),
            ...(kind !== 'choice' ? { kind } : {}),
            ...(d.items ? { items: d.items } : {}),
            ...(d.cell !== undefined ? { cell: d.cell } : {}),
            ...(d.size ? { size: d.size } : {}),
            ...(d.seq ? { seq: d.seq } : {}),
            ...(d.ordered !== undefined ? { ordered: d.ordered } : {}),
            ...(d.target ? { target: d.target } : {}),
          });
        }
      }
    }
  }
  return out;
}

/** Standard per-tier counts, scaled. */
export function spread(...perTier: number[]): Partial<Record<Tier, number>> {
  const r: Partial<Record<Tier, number>> = {};
  perTier.forEach((k, i) => {
    if (k > 0) r[(i + 1) as Tier] = k;
  });
  return r;
}
