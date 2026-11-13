import type { Level, Tier } from '../data/types';

/** A phase is 20 questions; reaching 20 is a victory, a full run is 100. */
export const STAGE_LEN = 20;
export const STAGES = 5;
export const MAX_RUN = STAGE_LEN * STAGES;

export type GameMode = 'normal' | 'dificil';
export const MODES: GameMode[] = ['normal', 'dificil'];

export interface ModeInfo {
  id: GameMode;
  label: string;
  level: 1 | 2 | 3 | 4;
  tagline: string;
}

export const MODE_INFO: Record<GameMode, ModeInfo> = {
  normal: { id: 'normal', label: 'Normal', level: 2, tagline: 'Empieza suave y se complica fase a fase.' },
  dificil: { id: 'dificil', label: 'Difícil', level: 4, tagline: 'Arranca duro y termina en lo imposible.' },
};

/** Question level used by each phase (every 20 questions the level jumps). */
export const STAGE_LEVELS: Record<GameMode, Level[]> = {
  normal: [1, 2, 3, 4, 5],
  dificil: [3, 4, 5, 6, 7],
};

/**
 * Tier inside each phase of 20:
 *  1-4 intro · 5-8 intermedio · 9-12 avanzado · 13-16 elevado · 17-19 muy difícil · 20 final
 */
export const SLOT_TIERS: Tier[] = [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 6];

export const TIER_LABEL: Record<Tier, string> = {
  1: 'Introducción',
  2: 'Intermedio',
  3: 'Avanzado',
  4: 'Elevado',
  5: 'Muy difícil',
  6: 'Desafío final',
};

export interface Slot {
  stage: number;
  tier: Tier;
  level: Level;
}

/** Difficulty of the question at position `i` (0-based) of a run. */
export function runSlot(mode: GameMode, i: number): Slot {
  const stage = Math.min(STAGES - 1, Math.floor(i / STAGE_LEN));
  return { stage, tier: SLOT_TIERS[i % STAGE_LEN], level: STAGE_LEVELS[mode][stage] };
}

/** Accent colour of each phase (only used on the question screens). */
export const STAGE_THEME = [
  { name: 'Verde', accent: '#c8ff2e', ink: '#0b0c0e' },
  { name: 'Azul', accent: '#3d9bff', ink: '#0b0c0e' },
  { name: 'Amarillo', accent: '#ffd60a', ink: '#0b0c0e' },
  { name: 'Rosa', accent: '#ff4fa3', ink: '#0b0c0e' },
  { name: 'Rojo', accent: '#ff3b3b', ink: '#0b0c0e' },
];

// ─────────────────────────────────────────────────────────────────────────
// Adventure: 5 worlds × 100 levels (100 % → 1 %) + a boss per world.
// ─────────────────────────────────────────────────────────────────────────
export const WORLD_LEVELS = 100;

export const WORLDS = [
  { name: 'Despertar', tagline: 'Donde todo empieza a encajar.' },
  { name: 'Laberinto', tagline: 'Cada pista abre un camino… o lo cierra.' },
  { name: 'Espejos', tagline: 'Nada es lo que parece a primera vista.' },
  { name: 'Abismo', tagline: 'Aquí la lógica se pone seria.' },
  { name: 'El 1 %', tagline: 'Solo unos pocos llegan hasta aquí.' },
];

/** Difficulty of adventure level `n` (1-100) of world `w` (0-4). */
export function adventureSlot(w: number, n: number): Slot {
  const k = Math.min(11, Math.floor(((n - 1) / WORLD_LEVELS) * 12));
  const level = Math.min(7, w + 1 + Math.floor(k / 6)) as Level;
  return { stage: w, tier: ((k % 6) + 1) as Tier, level };
}

/** The boss of each world asks a top-tier question of this level. */
export const BOSS_LEVEL: Level[] = [4, 5, 6, 7, 7];
