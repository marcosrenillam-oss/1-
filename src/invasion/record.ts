import { addEnergy } from '../engine/core';
import type { SaveData } from '../storage/persistence';
import { energyFor } from './sim';
import type { Game } from './types';

export interface InvasionResult {
  wave: number;
  kills: number;
  bosses: number;
  time: number;
  energy: number;
  newRecord: boolean;
}

/** Ends an invasion: records, energy for the chip, and no game left to resume. */
export function finishInvasion(prev: SaveData, g: Game): { save: SaveData; result: InvasionResult } {
  const save = structuredClone(prev);
  const inv = save.invasion;
  const energy = energyFor(g);
  const newRecord = g.wave > inv.bestWave;
  inv.played += 1;
  inv.bestWave = Math.max(inv.bestWave, g.wave);
  inv.bestKills = Math.max(inv.bestKills, g.kills);
  inv.totalKills += g.kills;
  inv.bosses += g.bosses;
  inv.run = null;
  addEnergy(save.core, energy);
  return { save, result: { wave: g.wave, kills: g.kills, bosses: g.bosses, time: g.t, energy, newRecord } };
}
