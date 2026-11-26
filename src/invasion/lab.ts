import { BASE_KINDS, DEF_INFO, DEF_KINDS, ELEMENT_LIST, ELEMENTS } from './defenders';
import type { StartOpts } from './sim';
import type { DefKind } from './types';

/** «Laboratorio»: permanent upgrades for Invasión, bought with Datos (◆). */
export interface LabItem {
  id: string;
  name: string;
  desc: string;
  max: number;
  cost: (lvl: number) => number;
  group: 'unlock' | 'boost' | 'element';
  color?: string;
}

const geo = (base: number, k: number) => (lvl: number) => Math.round((base * Math.pow(k, lvl)) / 5) * 5;
export const NEW_KINDS: DefKind[] = DEF_KINDS.filter((k) => !BASE_KINDS.includes(k));
const UNLOCK_COST = [40, 70, 100, 140, 180, 230, 290, 360, 450, 550];

export const LAB: LabItem[] = [
  ...NEW_KINDS.map((k, i): LabItem => ({
    id: `u-${k}`, name: DEF_INFO[k].name, desc: DEF_INFO[k].desc, max: 1, cost: () => UNLOCK_COST[i] ?? 400, group: 'unlock', color: DEF_INFO[k].color,
  })),
  { id: 'inicio', name: 'Defensores iniciales', desc: 'Empiezas con un defensor más.', max: 2, cost: (l) => [250, 900][l] ?? 0, group: 'boost' },
  { id: 'cartas', name: 'Ventaja inicial', desc: 'Empiezas con una mejora más para elegir.', max: 5, cost: geo(60, 1.7), group: 'boost' },
  { id: 'vida', name: 'Núcleo reforzado', desc: '+15 de integridad máxima.', max: 6, cost: geo(40, 1.5), group: 'boost' },
  { id: 'dano', name: 'Calibración', desc: '+6 % de daño para todos.', max: 10, cost: geo(50, 1.35), group: 'boost' },
  { id: 'cadencia', name: 'Overclock permanente', desc: '+5 % de cadencia para todos.', max: 8, cost: geo(50, 1.4), group: 'boost' },
  { id: 'xp', name: 'Memoria', desc: '+8 % de experiencia.', max: 8, cost: geo(45, 1.4), group: 'boost' },
  { id: 'cambios', name: 'Recalcular', desc: '+1 cambio de cartas por partida.', max: 3, cost: geo(80, 2), group: 'boost' },
  { id: 'opciones', name: 'Cuarta opción', desc: 'Eliges entre 4 cartas desde el principio.', max: 1, cost: () => 700, group: 'boost' },
  { id: 'escudo', name: 'Escudo inicial', desc: 'Empiezas con un escudo que bloquea un golpe.', max: 2, cost: (l) => [300, 900][l] ?? 0, group: 'boost' },
  { id: 'muro', name: 'Muro inicial', desc: 'Empiezas con el muro levantado.', max: 1, cost: () => 400, group: 'boost' },
  { id: 'botin', name: 'Botín', desc: '+15 % de datos y de energía al terminar.', max: 5, cost: geo(70, 1.6), group: 'boost' },
  { id: 'elegir', name: 'Defensor inicial', desc: 'Elige con qué defensor empiezas en lugar del cañón.', max: 1, cost: () => 300, group: 'boost' },
  { id: 'atajo', name: 'Atajo de chips', desc: 'Los chips extra y el segundo núcleo llegan antes.', max: 3, cost: (l) => [500, 1100, 2200][l] ?? 0, group: 'boost' },
  ...ELEMENT_LIST.map((el): LabItem => ({
    id: `af-${el}`, name: `Afinidad: ${ELEMENTS[el].name}`, desc: `+6 % de daño con ataques de ${ELEMENTS[el].name.toLowerCase()}.`, max: 5, cost: geo(60, 1.5), group: 'element', color: ELEMENTS[el].color,
  })),
];

export type Lab = Record<string, number>;
export const labLevel = (lab: Lab, id: string) => lab[id] ?? 0;

export function labCost(lab: Lab, id: string): number | null {
  const it = LAB.find((x) => x.id === id);
  if (!it) return null;
  const lvl = labLevel(lab, id);
  return lvl >= it.max ? null : it.cost(lvl);
}

export function startOpts(lab: Lab): StartOpts {
  const l = (id: string) => labLevel(lab, id);
  return {
    defenders: l('inicio'),
    cards: l('cartas'),
    hp: 15 * l('vida'),
    dmg: 0.06 * l('dano'),
    rate: 0.05 * l('cadencia'),
    xp: 0.08 * l('xp'),
    rerolls: l('cambios'),
    choices: l('opciones') ? 4 : 0,
    shield: l('escudo'),
    wall: l('muro'),
    unlocked: NEW_KINDS.filter((k) => l(`u-${k}`) > 0),
    start: l('elegir') && lab.start ? DEF_KINDS[lab.start - 1] : undefined,
    elBonus: Object.fromEntries(ELEMENT_LIST.map((el) => [el, 0.06 * l(`af-${el}`)])),
    chipFast: l('atajo'),
  };
}
export const lootBonus = (lab: Lab) => 0.15 * labLevel(lab, 'botin');
