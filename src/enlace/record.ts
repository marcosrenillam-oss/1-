import { addEnergy } from '../engine/core';
import type { SaveData } from '../storage/persistence';
import { energyForStars, starsFor, TOTAL_LEVELS } from './levels';

export interface EnlaceResult {
  n: number;
  won: boolean;
  time: number;
  stars: number;
  newStars: number;
  energy: number;
  best: boolean;
}

/** The next level to play: the first one never won. */
export const nextLevel = (save: SaveData) => {
  for (let n = 1; n <= TOTAL_LEVELS; n++) if (!save.enlace.stars[n]) return n;
  return TOTAL_LEVELS;
};
export const unlocked = (save: SaveData, n: number) => n <= nextLevel(save) || !!save.enlace.stars[n];
export const totalStars = (save: SaveData) => Object.values(save.enlace.stars).reduce((a, b) => a + b, 0);

export function finishLevel(prev: SaveData, n: number, won: boolean, time: number): { save: SaveData; result: EnlaceResult } {
  const save = structuredClone(prev);
  if (!won) return { save, result: { n, won, time, stars: 0, newStars: 0, energy: 0, best: false } };
  const stars = starsFor(n, time);
  const had = save.enlace.stars[n] ?? 0;
  const newStars = Math.max(0, stars - had);
  const energy = energyForStars(n, newStars);
  save.enlace.stars[n] = Math.max(had, stars);
  const best = !save.enlace.best[n] || time < save.enlace.best[n];
  if (best) save.enlace.best[n] = Math.round(time * 10) / 10;
  addEnergy(save.core, energy);
  return { save, result: { n, won, time, stars, newStars, energy, best } };
}
