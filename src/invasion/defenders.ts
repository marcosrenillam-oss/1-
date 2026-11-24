import type { DefKind, Defender, Stats } from './types';

export const stats = (o: Partial<Stats>): Stats => ({
  dmg: 5, rate: 1, range: 150, count: 1, spread: 0.18, speed: 420, pierce: 0, bounce: 0, splash: 0, slow: 0, burn: 0, chain: 0,
  crit: 0.05, critMult: 2, execute: 0, homing: 0, split: 0, knock: 0, ...o,
});

export const DEF_INFO: Record<DefKind, { name: string; desc: string; color: string; base: () => Stats }> = {
  canon: { name: 'Cañón', desc: 'Dispara balas al virus más cercano.', color: '#c8ff2e', base: () => stats({ dmg: 6, rate: 2.2, range: 150, speed: 470 }) },
  laser: { name: 'Láser', desc: 'Un haz continuo que quema sin parar.', color: '#ff4fa3', base: () => stats({ dmg: 9, rate: 1, range: 130 }) },
  rayo: { name: 'Rayo', desc: 'Descargas que saltan de virus en virus.', color: '#7db7ff', base: () => stats({ dmg: 11, rate: 0.9, range: 145, chain: 2 }) },
  pulso: { name: 'Pulso', desc: 'Ondas que golpean y empujan a todo lo cercano.', color: '#a66bff', base: () => stats({ dmg: 8, rate: 0.75, range: 88, knock: 26 }) },
  misil: { name: 'Misil', desc: 'Misiles teledirigidos que explotan.', color: '#ff8a1f', base: () => stats({ dmg: 13, rate: 0.6, range: 200, speed: 230, splash: 32, homing: 1 }) },
  hielo: { name: 'Criogénico', desc: 'Esquirlas que frenan a los virus.', color: '#8af3ff', base: () => stats({ dmg: 4, rate: 1.7, range: 145, speed: 390, slow: 0.35 }) },
  cuchillas: { name: 'Cuchillas', desc: 'Hojas que giran alrededor y cortan al contacto.', color: '#ffd60a', base: () => stats({ dmg: 7, rate: 3.2, range: 44, count: 2 }) },
  mortero: { name: 'Mortero', desc: 'Proyectiles que caen desde arriba con gran explosión.', color: '#ff5a5a', base: () => stats({ dmg: 18, rate: 0.45, range: 235, splash: 46 }) },
};
export const DEF_KINDS = Object.keys(DEF_INFO) as DefKind[];

export interface Evo {
  id: string;
  kind: DefKind;
  tier: 1 | 2;
  parent?: string;
  name: string;
  desc: string;
  apply: (s: Stats, f: Record<string, number>) => void;
}

const E = (kind: DefKind, tier: 1 | 2, parent: string | undefined, id: string, name: string, desc: string, apply: Evo['apply']): Evo => ({ id, kind, tier, parent, name, desc, apply });

/** Each defender evolves twice, choosing one of two paths each time: 6 forms per type. */
export const EVOS: Evo[] = [
  // Cañón
  E('canon', 1, undefined, 'ametralladora', 'Ametralladora', 'Cadencia ×2,2 · daño ×0,6', (s) => { s.rate *= 2.2; s.dmg *= 0.6; s.spread += 0.1; }),
  E('canon', 1, undefined, 'escopeta', 'Escopeta', '+3 balas en abanico · alcance ×0,85', (s) => { s.count += 3; s.spread = 0.7; s.range *= 0.85; }),
  E('canon', 2, 'ametralladora', 'minigun', 'Minigun', 'Cadencia ×1,8 · crítico +10 %', (s) => { s.rate *= 1.8; s.crit += 0.1; }),
  E('canon', 2, 'ametralladora', 'tormenta', 'Tormenta de balas', '+2 balas · rebotan 1 vez', (s) => { s.count += 2; s.bounce += 1; }),
  E('canon', 2, 'escopeta', 'metralla', 'Metralla', 'Cada bala se parte en 2 al impactar', (s) => { s.split += 2; }),
  E('canon', 2, 'escopeta', 'riel', 'Cañón de riel', 'Un disparo ×4 de daño que lo atraviesa todo', (s) => { s.count = 1; s.dmg *= 4; s.pierce = 99; s.speed *= 2.2; s.rate *= 0.55; s.spread = 0; }),
  // Láser
  E('laser', 1, undefined, 'prisma', 'Prisma', '+1 haz simultáneo', (s) => { s.count += 1; }),
  E('laser', 1, undefined, 'concentrado', 'Haz concentrado', 'Daño ×2 · alcance ×1,2', (s) => { s.dmg *= 2; s.range *= 1.2; }),
  E('laser', 2, 'prisma', 'abanico', 'Abanico de luz', '+2 haces', (s) => { s.count += 2; }),
  E('laser', 2, 'prisma', 'refractor', 'Refractor', 'Cada haz salta a otro virus', (s) => { s.chain += 1; }),
  E('laser', 2, 'concentrado', 'aniquilador', 'Aniquilador', 'El daño crece cuanto más tiempo apunta (hasta ×4)', (_s, f) => { f.ramp = 1; }),
  E('laser', 2, 'concentrado', 'fundidor', 'Fundidor', 'Prende fuego: +8 de quemadura/s', (s) => { s.burn += 8; }),
  // Rayo
  E('rayo', 1, undefined, 'cadena', 'Cadena larga', '+3 saltos', (s) => { s.chain += 3; }),
  E('rayo', 1, undefined, 'trueno', 'Trueno', 'Daño ×2,2 · aturde un instante', (s) => { s.dmg *= 2.2; s.rate *= 0.85; s.slow = Math.max(s.slow, 0.6); }),
  E('rayo', 2, 'cadena', 'tormenta-e', 'Tormenta eléctrica', 'Lanza 2 rayos a la vez', (s) => { s.count += 1; }),
  E('rayo', 2, 'cadena', 'arco', 'Arco voltaico', 'Los saltos no pierden daño · +2 saltos', (s, f) => { s.chain += 2; f.nofall = 1; }),
  E('rayo', 2, 'trueno', 'juicio', 'Juicio', 'Elimina al instante virus por debajo del 15 %', (s) => { s.execute = Math.max(s.execute, 0.15); }),
  E('rayo', 2, 'trueno', 'sobrecarga', 'Sobrecarga', 'Cada impacto explota', (s) => { s.splash += 30; }),
  // Pulso
  E('pulso', 1, undefined, 'onda', 'Onda expansiva', 'Alcance ×1,5 · empuje ×2', (s) => { s.range *= 1.5; s.knock *= 2; }),
  E('pulso', 1, undefined, 'nova', 'Nova', 'Daño ×2 · cadencia ×1,3', (s) => { s.dmg *= 2; s.rate *= 1.3; }),
  E('pulso', 2, 'onda', 'terremoto', 'Terremoto', 'Las ondas frenan un 40 %', (s) => { s.slow = Math.max(s.slow, 0.4); }),
  E('pulso', 2, 'onda', 'resonancia', 'Resonancia', 'Lanza 2 ondas seguidas', (s) => { s.count += 1; }),
  E('pulso', 2, 'nova', 'supernova', 'Supernova', 'Daño ×2 · alcance ×1,25', (s) => { s.dmg *= 2; s.range *= 1.25; }),
  E('pulso', 2, 'nova', 'campo', 'Campo estático', 'Se convierte en un aura que daña sin parar', (s, f) => { f.field = 1; s.dmg *= 1.6; }),
  // Misil
  E('misil', 1, undefined, 'enjambre', 'Enjambre', '+2 misiles · daño ×0,75', (s) => { s.count += 2; s.dmg *= 0.75; s.spread = 0.8; }),
  E('misil', 1, undefined, 'pesado', 'Misil pesado', 'Daño ×2,5 · explosión ×1,5', (s) => { s.dmg *= 2.5; s.splash *= 1.5; }),
  E('misil', 2, 'enjambre', 'racimo', 'Racimo', 'Al explotar suelta 3 minibombas', (s) => { s.split += 3; }),
  E('misil', 2, 'enjambre', 'cazador', 'Cazador', 'Misiles ×1,6 más rápidos · cadencia ×1,4', (s) => { s.speed *= 1.6; s.rate *= 1.4; }),
  E('misil', 2, 'pesado', 'nuclear', 'Cabeza nuclear', 'Explosión ×1,8 · deja fuego', (s) => { s.splash *= 1.8; s.burn += 10; }),
  E('misil', 2, 'pesado', 'perforante', 'Perforante', 'Atraviesa 3 virus antes de explotar', (s) => { s.pierce += 3; }),
  // Criogénico
  E('hielo', 1, undefined, 'ventisca', 'Ventisca', '+2 esquirlas · frena un 50 %', (s) => { s.count += 2; s.spread = 0.5; s.slow = Math.max(s.slow, 0.5); }),
  E('hielo', 1, undefined, 'cero', 'Cero absoluto', 'Daño ×2,5 · los virus helados reciben +50 %', (s, f) => { s.dmg *= 2.5; f.brittle = 1; }),
  E('hielo', 2, 'ventisca', 'glaciar', 'Glaciar', 'Congela casi del todo', (s) => { s.slow = 0.88; }),
  E('hielo', 2, 'ventisca', 'granizo', 'Granizo', 'Las esquirlas rebotan 2 veces', (s) => { s.bounce += 2; }),
  E('hielo', 2, 'cero', 'fragmentar', 'Fragmentar', 'Cada impacto estalla en esquirlas', (s) => { s.splash += 26; }),
  E('hielo', 2, 'cero', 'escarcha', 'Escarcha', 'Crítico +25 %', (s) => { s.crit += 0.25; }),
  // Cuchillas
  E('cuchillas', 1, undefined, 'molino', 'Molino', '+2 cuchillas · giran más rápido', (s) => { s.count += 2; s.rate *= 1.3; }),
  E('cuchillas', 1, undefined, 'filo', 'Filo', 'Daño ×2,2', (s) => { s.dmg *= 2.2; }),
  E('cuchillas', 2, 'molino', 'sierra', 'Sierra', '+2 cuchillas · daño ×1,4', (s) => { s.count += 2; s.dmg *= 1.4; }),
  E('cuchillas', 2, 'molino', 'vendaval', 'Vendaval', 'Radio ×1,5 · empujan', (s) => { s.range *= 1.5; s.knock += 20; }),
  E('cuchillas', 2, 'filo', 'vampirica', 'Vampírica', 'Cada corte repara el núcleo', (_s, f) => { f.leech = 1; }),
  E('cuchillas', 2, 'filo', 'desgarro', 'Desgarro', 'Quemadura +6/s · crítico +10 %', (s) => { s.burn += 6; s.crit += 0.1; }),
  // Mortero
  E('mortero', 1, undefined, 'artilleria', 'Artillería', '+2 proyectiles', (s) => { s.count += 2; s.spread = 0.6; }),
  E('mortero', 1, undefined, 'obus', 'Obús', 'Daño ×2,5 · explosión ×1,4', (s) => { s.dmg *= 2.5; s.splash *= 1.4; }),
  E('mortero', 2, 'artilleria', 'bombardeo', 'Bombardeo', '+3 proyectiles', (s) => { s.count += 3; }),
  E('mortero', 2, 'artilleria', 'napalm', 'Napalm', 'Deja fuego: +10 de quemadura/s', (s) => { s.burn += 10; }),
  E('mortero', 2, 'obus', 'sismico', 'Sísmico', 'Frena un 50 % en la zona de impacto', (s) => { s.slow = Math.max(s.slow, 0.5); }),
  E('mortero', 2, 'obus', 'orbital', 'Golpe orbital', 'Alcance infinito · daño ×1,6', (s) => { s.range = 999; s.dmg *= 1.6; }),
];

/** Upgrades needed on a defender before each evolution. */
export const EVO_AT = [3, 7];

export function evoOptions(d: Defender): Evo[] {
  const tier = d.evo.length;
  if (tier >= 2 || d.lvl < EVO_AT[tier]) return [];
  return EVOS.filter((e) => e.kind === d.kind && e.tier === tier + 1 && (tier === 0 || e.parent === d.evo[0]));
}

export function defenderName(d: Defender): string {
  const last = d.evo[d.evo.length - 1];
  return last ? EVOS.find((e) => e.id === last)!.name : DEF_INFO[d.kind].name;
}

export function makeDefender(id: number, kind: DefKind): Defender {
  return { id, kind, name: DEF_INFO[kind].name, lvl: 0, evo: [], stats: DEF_INFO[kind].base(), flags: {}, kills: 0, cd: 0.3, aim: 0, x: 0, y: 0, lockId: -1, lockT: 0, spin: 0, pending: 0 };
}
