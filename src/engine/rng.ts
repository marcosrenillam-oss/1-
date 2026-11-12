export type Rng = () => number;

/** Mulberry32: small, fast, seedable PRNG (used for reproducible tests). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Non-deterministic RNG for real games. */
export function defaultRng(): Rng {
  const buf = new Uint32Array(1);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return () => {
      crypto.getRandomValues(buf);
      return buf[0] / 4294967296;
    };
  }
  return Math.random;
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function weightedPick<T>(items: readonly T[], weights: readonly number[], rng: Rng): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}
