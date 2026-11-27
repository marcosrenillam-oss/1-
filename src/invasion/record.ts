import { addEnergy } from '../engine/core';
import type { SaveData } from '../storage/persistence';
import { datosFor, energyFor, threatMul } from './sim';
import { labCost, lootBonus } from './lab';
import type { Game } from './types';

export interface InvasionResult {
  wave: number;
  kills: number;
  bosses: number;
  time: number;
  energy: number;
  datos: number;
  /** Threat reached and how much it multiplied the rewards. */
  threat: number;
  threatMul: number;
  newRecord: boolean;
}

/** Ends an invasion: records, energy for the chip, and no game left to resume. */
export function finishInvasion(prev: SaveData, g: Game): { save: SaveData; result: InvasionResult } {
  const save = structuredClone(prev);
  const inv = save.invasion;
  const bonus = lootBonus(inv.lab);
  const energy = Math.round(energyFor(g) * (1 + bonus));
  const datos = datosFor(g, bonus);
  inv.datos += datos;
  const newRecord = g.wave > inv.bestWave;
  inv.played += 1;
  inv.bestWave = Math.max(inv.bestWave, g.wave);
  inv.bestKills = Math.max(inv.bestKills, g.kills);
  inv.totalKills += g.kills;
  inv.bosses += g.bosses;
  inv.run = null;
  addEnergy(save.core, energy);
  return { save, result: { wave: g.wave, kills: g.kills, bosses: g.bosses, time: g.t, energy, datos, threat: g.g.enemyHp, threatMul: threatMul(g), newRecord } };
}

/** Buys the next level of a Laboratorio upgrade, or returns null if not possible. */
export function buyLab(prev: SaveData, id: string): SaveData | null {
  const cost = labCost(prev.invasion.lab, id);
  if (cost === null || prev.invasion.datos < cost) return null;
  const save = structuredClone(prev);
  save.invasion.datos -= cost;
  save.invasion.lab[id] = (save.invasion.lab[id] ?? 0) + 1;
  return save;
}
