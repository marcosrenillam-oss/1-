import { seededRng, shuffle, type Rng } from '../../engine/rng';
import type { Category, Mode, Question, Tier } from '../types';

export const MODE_ORDER: Mode[] = ['facil', 'normal', 'dificil', 'experto'];

export interface Ctx {
  mode: Mode;
  tier: Tier;
  /** Global difficulty 1-9: mode (0-3) + tier (1-6). */
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
}

export interface Family {
  id: string;
  /** How many questions to create per tier for a mode. */
  counts: (mode: Mode) => Partial<Record<Tier, number>>;
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

/** Deterministically builds every family for every mode. */
export function buildGenerated(families: Family[]): Question[] {
  const out: Question[] = [];
  const seen = new Set<string>();
  for (const mode of MODE_ORDER) {
    const modeIdx = MODE_ORDER.indexOf(mode);
    for (const fam of families) {
      const rng = seededRng(hash(`${mode}:${fam.id}`));
      let n = 0;
      const counts = fam.counts(mode);
      for (const [tierStr, k] of Object.entries(counts)) {
        const tier = Number(tierStr) as Tier;
        let made = 0;
        let tries = 0;
        while (made < (k ?? 0) && tries < (k ?? 0) * 80) {
          tries++;
          const d = fam.make({ mode, tier, D: modeIdx + tier, rng });
          if (!d) continue;
          const opts = [d.correct, ...d.wrong];
          if (opts.length !== 4 || new Set(opts).size !== 4) continue;
          const key = `${mode}|${d.prompt}|${(d.visual ?? []).join('/')}|${[...opts].sort().join('/')}`;
          if (seen.has(key)) continue;
          seen.add(key);
          n++;
          made++;
          out.push({
            id: `g${mode[0]}-${fam.id}${n}`,
            mode,
            tier,
            category: d.cat,
            prompt: d.prompt,
            options: opts,
            answer: 0,
            explanation: d.expl,
            ...(d.visual ? { visual: d.visual } : {}),
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
