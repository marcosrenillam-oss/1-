import type { DefKind, Defender, Stats } from './types';

export const stats = (o: Partial<Stats>): Stats => ({
  dmg: 5, rate: 1, range: 150, count: 1, spread: 0.18, speed: 420, pierce: 0, bounce: 0, splash: 0, slow: 0, burn: 0, chain: 0,
  crit: 0.05, critMult: 2, execute: 0, homing: 0, split: 0, knock: 0, ...o,
});

export interface DefInfo {
  name: string;
  desc: string;
  color: string;
  base: () => Stats;
  /** Behaviour it runs (defaults to its own kind). */
  beh?: DefKind;
  flags?: Record<string, number>;
  /** Extra chip it belongs to (exclusive defenders). */
  chip?: ChipId;
}
export const DEF_INFO: Record<DefKind, DefInfo> = {
  canon: { name: 'Cañón', desc: 'Dispara balas al virus más cercano.', color: '#c8ff2e', base: () => stats({ dmg: 6, rate: 2.2, range: 150, speed: 470 }) },
  laser: { name: 'Láser', desc: 'Un haz continuo que quema sin parar.', color: '#ff4fa3', base: () => stats({ dmg: 9, rate: 1, range: 130 }) },
  rayo: { name: 'Rayo', desc: 'Descargas que saltan de virus en virus.', color: '#7db7ff', base: () => stats({ dmg: 11, rate: 0.9, range: 145, chain: 2 }) },
  pulso: { name: 'Pulso', desc: 'Ondas que golpean y empujan a todo lo cercano.', color: '#a66bff', base: () => stats({ dmg: 8, rate: 0.75, range: 88, knock: 26 }) },
  misil: { name: 'Misil', desc: 'Misiles teledirigidos que explotan.', color: '#ff8a1f', base: () => stats({ dmg: 13, rate: 0.6, range: 200, speed: 230, splash: 32, homing: 1 }) },
  hielo: { name: 'Criogénico', desc: 'Esquirlas que frenan a los virus.', color: '#8af3ff', base: () => stats({ dmg: 4, rate: 1.7, range: 145, speed: 390, slow: 0.35 }) },
  cuchillas: { name: 'Cuchillas', desc: 'Hojas que giran alrededor y cortan al contacto.', color: '#ffd60a', base: () => stats({ dmg: 7, rate: 3.2, range: 44, count: 2 }) },
  mortero: { name: 'Mortero', desc: 'Proyectiles que caen desde arriba con gran explosión.', color: '#ff5a5a', base: () => stats({ dmg: 18, rate: 0.45, range: 235, splash: 46 }) },
  francotirador: { name: 'Francotirador', desc: 'Disparos lejanos y letales al virus con más vida.', color: '#e8f6ff', base: () => stats({ dmg: 42, rate: 0.38, range: 330, crit: 0.15, critMult: 2.5 }) },
  llamas: { name: 'Lanzallamas', desc: 'Un cono de fuego que quema todo lo que tiene delante.', color: '#ff6a1f', base: () => stats({ dmg: 7, rate: 1, range: 92, spread: 0.75, burn: 4 }) },
  gravedad: { name: 'Agujero negro', desc: 'Crea pozos de gravedad que atraen y trituran virus.', color: '#9d7bff', base: () => stats({ dmg: 9, rate: 0.26, range: 190, splash: 52, knock: 38 }) },
  drones: { name: 'Drones', desc: 'Drones autónomos que salen a cazar virus.', color: '#5dffa8', base: () => stats({ dmg: 5, rate: 1.6, range: 210, count: 2, speed: 520 }) },
  acido: { name: 'Ácido', desc: 'Lanza ácido que deja charcos corrosivos.', color: '#b6ff3d', base: () => stats({ dmg: 7, rate: 0.55, range: 190, splash: 34, slow: 0.15 }) },
  bumeran: { name: 'Bumerán', desc: 'Hojas que van y vuelven atravesándolo todo.', color: '#ffb347', base: () => stats({ dmg: 9, rate: 0.8, range: 170, speed: 300, pierce: 99 }) },
  minas: { name: 'Minador', desc: 'Siembra minas en el camino de los virus.', color: '#ff4f6d', base: () => stats({ dmg: 26, rate: 0.5, range: 200, splash: 40 }) },
  cronos: { name: 'Cronos', desc: 'Ralentiza el tiempo a su alrededor y congela con cada pulso.', color: '#7dffd8', base: () => stats({ dmg: 6, rate: 0.35, range: 115, slow: 0.35 }) },
  // ── Chip Prisma ──
  refractor: { chip: 'prisma', beh: 'laser', name: 'Refractor', desc: 'Tres haces que saltan entre virus.', color: '#7df9ff', base: () => stats({ dmg: 30, rate: 1, range: 160, count: 3, chain: 2 }) },
  espejo: { chip: 'prisma', beh: 'canon', name: 'Espejo', desc: 'Balas de luz que rebotan de virus en virus.', color: '#bff7ff', base: () => stats({ dmg: 26, rate: 2.4, range: 170, speed: 640, bounce: 4, count: 2, spread: 0.2 }) },
  foton: { chip: 'prisma', beh: 'francotirador', flags: { line: 1 }, name: 'Fotón', desc: 'Un rayo de luz que atraviesa todo en línea.', color: '#e6fdff', base: () => stats({ dmg: 160, rate: 0.5, range: 360, crit: 0.2, critMult: 2.5 }) },
  // ── Chip Forja ──
  martillo: { chip: 'forja', beh: 'pulso', name: 'Martillo', desc: 'Golpes sísmicos que aplastan y empujan.', color: '#ff9a3d', base: () => stats({ dmg: 70, rate: 0.7, range: 110, knock: 50 }) },
  crisol: { chip: 'forja', beh: 'mortero', name: 'Crisol', desc: 'Lluvia de metal fundido que deja todo ardiendo.', color: '#ffb347', base: () => stats({ dmg: 80, rate: 0.6, range: 260, splash: 60, burn: 25, count: 2, spread: 0.6 }) },
  forjador: { chip: 'forja', beh: 'llamas', flags: { pierceArmor: 1 }, name: 'Soplete de forja', desc: 'Fuego que funde el blindaje.', color: '#ff6a1f', base: () => stats({ dmg: 45, rate: 1, range: 120, spread: 1, burn: 20 }) },
  // ── Chip Bio ──
  nanobots: { chip: 'bio', beh: 'drones', name: 'Nanobots', desc: 'Un enjambre de diminutos cazadores.', color: '#5dffa8', base: () => stats({ dmg: 18, rate: 2.2, range: 240, count: 6, speed: 560 }) },
  espora: { chip: 'bio', beh: 'acido', flags: { contagio: 1 }, name: 'Espora', desc: 'Nubes tóxicas que se contagian de virus en virus.', color: '#b6ff3d', base: () => stats({ dmg: 40, rate: 0.7, range: 220, splash: 50, slow: 0.3, count: 2, spread: 0.6 }) },
  raiz: { chip: 'bio', beh: 'cronos', flags: { freeze: 1 }, name: 'Raíz', desc: 'Raíces que atrapan y estrangulan a los virus cercanos.', color: '#3dff9a', base: () => stats({ dmg: 50, rate: 0.5, range: 140, slow: 0.5 }) },
  // ── Chip Vacío ──
  singular: { chip: 'vacio', beh: 'gravedad', flags: { implode: 1 }, name: 'Singularidad', desc: 'Agujeros que lo tragan todo y estallan.', color: '#9d7bff', base: () => stats({ dmg: 45, rate: 0.35, range: 230, splash: 70, knock: 60, count: 2 }) },
  eco: { chip: 'vacio', beh: 'rayo', flags: { nofall: 1 }, name: 'Eco', desc: 'Descargas del vacío que no pierden fuerza al saltar.', color: '#c48bff', base: () => stats({ dmg: 60, rate: 1, range: 190, chain: 6, count: 2 }) },
  segador: { chip: 'vacio', beh: 'cuchillas', name: 'Segador', desc: 'Guadañas enormes girando alrededor del chip.', color: '#e0c3ff', base: () => stats({ dmg: 55, rate: 2.6, range: 62, count: 4, burn: 10 }) },
};
/** The behaviour a defender runs. */
export const behOf = (k: DefKind): DefKind => DEF_INFO[k].beh ?? k;

// ── Extra chips: outposts around the main one ──────────────────────────────
export type ChipId = 'prisma' | 'forja' | 'bio' | 'vacio';
export const CHIPS: { id: ChipId; name: string; color: string; ability: string; kinds: DefKind[] }[] = [
  { id: 'prisma', name: 'Prisma', color: '#7df9ff', ability: 'Dispara haces de luz que se reparten entre los virus más cercanos.', kinds: ['refractor', 'espejo', 'foton'] },
  { id: 'forja', name: 'Forja', color: '#ff9a3d', ability: 'Hace caer meteoritos ardientes sobre los virus.', kinds: ['martillo', 'crisol', 'forjador'] },
  { id: 'bio', name: 'Bio', color: '#5dffa8', ability: 'Repara el núcleo y siembra nubes tóxicas.', kinds: ['nanobots', 'espora', 'raiz'] },
  { id: 'vacio', name: 'Vacío', color: '#9d7bff', ability: 'Un vórtice permanente atrae y tritura a los virus que pasan.', kinds: ['singular', 'eco', 'segador'] },
];
export const MAX_CHIPS = 1 + CHIPS.length;
/** Defenders per extra chip. */
export const CHIP_SLOTS = 3;
export const CHIP_D = 235;
/** Where chip k (1-4) sits: above, below, left, right of the main one. */
export function chipPos(k: number): { x: number; y: number } {
  return [{ x: 0, y: 0 }, { x: 0, y: -CHIP_D }, { x: 0, y: CHIP_D }, { x: -CHIP_D, y: 0 }, { x: CHIP_D, y: 0 }][k] ?? { x: 0, y: 0 };
}
export const chipOfKind = (k: DefKind): number => {
  const c = DEF_INFO[k].chip;
  return c ? CHIPS.findIndex((x) => x.id === c) + 1 : 0;
};
/** Available from the start; the others are unlocked in the Laboratorio. */
export const BASE_KINDS: DefKind[] = ['canon', 'laser', 'rayo', 'pulso', 'misil', 'hielo', 'cuchillas', 'mortero'];
/** Main-chip defender types (the extra chips have their own). */
export const DEF_KINDS = (Object.keys(DEF_INFO) as DefKind[]).filter((k) => !DEF_INFO[k].chip);
export const ALL_KINDS = Object.keys(DEF_INFO) as DefKind[];

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
  // Francotirador
  E('francotirador', 1, undefined, 'perforador', 'Perforador', 'El disparo atraviesa a todos los virus en línea', (_s, f) => { f.line = 1; }),
  E('francotirador', 1, undefined, 'asesino', 'Asesino', 'Crítico +25 % · daño crítico ×1,5', (s) => { s.crit += 0.25; s.critMult *= 1.5; }),
  E('francotirador', 2, 'perforador', 'canon-ionico', 'Cañón iónico', 'Daño ×2 · frena un 60 %', (s) => { s.dmg *= 2; s.slow = Math.max(s.slow, 0.6); }),
  E('francotirador', 2, 'perforador', 'doble-tiro', 'Doble tiro', 'Dispara a 2 objetivos', (s) => { s.count += 1; }),
  E('francotirador', 2, 'asesino', 'cazador-jefes', 'Cazajefes', 'Triple de daño a jefes y élites', (_s, f) => { f.bossx3 = 1; }),
  E('francotirador', 2, 'asesino', 'ejecutor', 'Ejecutor', 'Remata virus por debajo del 25 %', (s) => { s.execute = Math.max(s.execute, 0.25); }),
  // Lanzallamas
  E('llamas', 1, undefined, 'soplete', 'Soplete', 'Alcance ×1,4 · daño ×1,5 · cono estrecho', (s) => { s.range *= 1.4; s.dmg *= 1.5; s.spread *= 0.6; }),
  E('llamas', 1, undefined, 'infierno', 'Infierno', 'Cono enorme · quemadura +6/s', (s) => { s.spread *= 1.8; s.burn += 6; }),
  E('llamas', 2, 'soplete', 'plasma', 'Llama de plasma', 'Daño ×2 · ignora el blindaje', (s, f) => { s.dmg *= 2; f.pierceArmor = 1; }),
  E('llamas', 2, 'soplete', 'azul', 'Fuego azul', 'Quemadura ×2,5', (s) => { s.burn *= 2.5; }),
  E('llamas', 2, 'infierno', 'rueda', 'Rueda de fuego', 'Las llamas salen en todas direcciones', (_s, f) => { f.ring = 1; }),
  E('llamas', 2, 'infierno', 'fenix', 'Fénix', 'Los virus que mueren ardiendo explotan', (_s, f) => { f.explodeBurn = 1; }),
  // Agujero negro
  E('gravedad', 1, undefined, 'horizonte', 'Horizonte de sucesos', 'Radio ×1,4 · atracción ×1,5', (s) => { s.splash *= 1.4; s.knock *= 1.5; }),
  E('gravedad', 1, undefined, 'colapso', 'Colapso', 'Daño ×2,5', (s) => { s.dmg *= 2.5; }),
  E('gravedad', 2, 'horizonte', 'gemelos', 'Gemelos', 'Crea 2 agujeros a la vez', (s) => { s.count += 1; }),
  E('gravedad', 2, 'horizonte', 'eterno', 'Eterno', 'Los agujeros duran el doble', (_s, f) => { f.dur = 2; }),
  E('gravedad', 2, 'colapso', 'implosion', 'Implosión', 'Al cerrarse, el agujero estalla', (_s, f) => { f.implode = 1; }),
  E('gravedad', 2, 'colapso', 'espagueti', 'Espaguetización', 'Frena un 70 % dentro del agujero', (s) => { s.slow = Math.max(s.slow, 0.7); }),
  // Drones
  E('drones', 1, undefined, 'enjambre-d', 'Enjambre', '+2 drones', (s) => { s.count += 2; }),
  E('drones', 1, undefined, 'artilleros', 'Artilleros', 'Daño de los drones ×2', (s) => { s.dmg *= 2; }),
  E('drones', 2, 'enjambre-d', 'colmena', 'Colmena', '+3 drones', (s) => { s.count += 3; }),
  E('drones', 2, 'enjambre-d', 'kamikazes', 'Kamikazes', 'Los disparos de los drones explotan', (s) => { s.splash += 26; }),
  E('drones', 2, 'artilleros', 'laseres', 'Drones láser', 'Daño ×1,8 · atraviesan 2 virus', (s) => { s.dmg *= 1.8; s.pierce += 2; }),
  E('drones', 2, 'artilleros', 'escoltas', 'Escoltas', 'Los drones frenan y queman', (s) => { s.slow = Math.max(s.slow, 0.4); s.burn += 5; }),
  // Ácido
  E('acido', 1, undefined, 'charco', 'Charco grande', 'Charcos ×1,5 de grandes y duran más', (s, f) => { s.splash *= 1.5; f.dur = 1.5; }),
  E('acido', 1, undefined, 'corrosivo', 'Corrosivo', 'Daño ×1,6 · deshace el blindaje', (s, f) => { s.dmg *= 1.6; f.corrode = 1; }),
  E('acido', 2, 'charco', 'pantano', 'Pantano', 'Los charcos frenan un 50 %', (s) => { s.slow = Math.max(s.slow, 0.5); }),
  E('acido', 2, 'charco', 'lluvia', 'Lluvia ácida', '+2 lanzamientos', (s) => { s.count += 2; s.spread = 0.6; }),
  E('acido', 2, 'corrosivo', 'disolver', 'Disolver', 'Daño ×2', (s) => { s.dmg *= 2; }),
  E('acido', 2, 'corrosivo', 'contagio', 'Contagio', 'Los virus que mueren en el ácido dejan otro charco', (_s, f) => { f.contagio = 1; }),
  // Bumerán
  E('bumeran', 1, undefined, 'doble-b', 'Doble hoja', '+1 bumerán', (s) => { s.count += 1; s.spread = Math.max(s.spread, 0.5); }),
  E('bumeran', 1, undefined, 'pesado-b', 'Hoja pesada', 'Daño ×2,2', (s) => { s.dmg *= 2.2; }),
  E('bumeran', 2, 'doble-b', 'abanico-b', 'Abanico', '+2 bumeranes', (s) => { s.count += 2; s.spread = 1; }),
  E('bumeran', 2, 'doble-b', 'rapido-b', 'Veloz', 'Velocidad ×1,5 · cadencia ×1,4', (s) => { s.speed *= 1.5; s.rate *= 1.4; }),
  E('bumeran', 2, 'pesado-b', 'guillotina', 'Guillotina', 'Remata virus por debajo del 15 %', (s) => { s.execute = Math.max(s.execute, 0.15); }),
  E('bumeran', 2, 'pesado-b', 'sangrante', 'Sangrante', 'Quemadura +8/s', (s) => { s.burn += 8; }),
  // Minador
  E('minas', 1, undefined, 'campo-minas', 'Campo minado', '+2 minas por siembra', (s) => { s.count += 2; }),
  E('minas', 1, undefined, 'claymore', 'Claymore', 'Daño ×2 · explosión ×1,4', (s) => { s.dmg *= 2; s.splash *= 1.4; }),
  E('minas', 2, 'campo-minas', 'racimo-m', 'Minas racimo', 'Cada mina suelta 3 minibombas', (s) => { s.split += 3; }),
  E('minas', 2, 'campo-minas', 'magneticas', 'Magnéticas', 'Atraen y frenan a los virus cercanos', (s) => { s.knock += 30; s.slow = Math.max(s.slow, 0.3); }),
  E('minas', 2, 'claymore', 'nuclear-m', 'Mina nuclear', 'Explosión ×1,8 · deja fuego', (s) => { s.splash *= 1.8; s.burn += 10; }),
  E('minas', 2, 'claymore', 'criominas', 'Criominas', 'Congelan un 80 %', (s) => { s.slow = 0.8; }),
  // Cronos
  E('cronos', 1, undefined, 'dilatacion', 'Dilatación', 'Radio ×1,4 · frenado +15 %', (s) => { s.range *= 1.4; s.slow = Math.min(0.85, s.slow + 0.15); }),
  E('cronos', 1, undefined, 'paradoja', 'Paradoja', 'Cada pulso congela del todo un momento', (_s, f) => { f.freeze = 1; }),
  E('cronos', 2, 'dilatacion', 'bucle', 'Bucle temporal', 'Los virus frenados reciben +40 % de daño de todos', (_s, f) => { f.weaken = 1; }),
  E('cronos', 2, 'dilatacion', 'eco', 'Eco', 'Los defensores vecinos +30 % de cadencia', (_s, f) => { f.haste = 1; }),
  E('cronos', 2, 'paradoja', 'rebobinar', 'Rebobinar', 'Cada pulso hace retroceder a los virus', (s) => { s.knock += 60; }),
  E('cronos', 2, 'paradoja', 'reloj', 'Reloj roto', 'Daño del pulso ×4', (s) => { s.dmg *= 4; }),
];

// ── Synergies: pairs that power each other up when both are on the ring ──
export interface Synergy {
  id: string;
  a: DefKind;
  b: DefKind;
  name: string;
  desc: string;
  /** Stat multipliers for the two defenders. */
  mods?: Partial<Record<'dmg' | 'rate' | 'range' | 'splash' | 'count' | 'speed' | 'pierce' | 'chain' | 'burn' | 'slow', number>>;
}
export const SYNERGIES: Synergy[] = [
  { id: 'superconductor', a: 'hielo', b: 'rayo', name: 'Superconductor', desc: 'Los rayos hacen el doble a virus helados.' },
  { id: 'choque', a: 'llamas', b: 'hielo', name: 'Choque térmico', desc: 'Virus helados y ardiendo a la vez reciben +60 %.' },
  { id: 'artilleria', a: 'misil', b: 'mortero', name: 'Artillería pesada', desc: 'Explosiones un 35 % más grandes.', mods: { splash: 1.35 } },
  { id: 'mira', a: 'laser', b: 'francotirador', name: 'Mira láser', desc: 'Ambos +40 % de daño y +15 % de alcance.', mods: { dmg: 1.4, range: 1.15 } },
  { id: 'singularidad', a: 'pulso', b: 'gravedad', name: 'Singularidad', desc: 'Ambos +45 % de daño.', mods: { dmg: 1.45 } },
  { id: 'danza', a: 'cuchillas', b: 'bumeran', name: 'Danza de hojas', desc: 'Ambos +35 % de daño y +20 % de cadencia.', mods: { dmg: 1.35, rate: 1.2 } },
  { id: 'cobertura', a: 'drones', b: 'canon', name: 'Fuego de cobertura', desc: 'Ambos +25 % de cadencia y +1 disparo.', mods: { rate: 1.25, count: 1 } },
  { id: 'gas', a: 'acido', b: 'llamas', name: 'Gas inflamable', desc: 'El ácido arde: +10 de quemadura.', mods: { burn: 1.5 } },
  { id: 'trampa', a: 'minas', b: 'cronos', name: 'Trampa temporal', desc: 'Minas y pulsos frenan mucho más.', mods: { slow: 1.6, range: 1.2 } },
  { id: 'red', a: 'rayo', b: 'drones', name: 'Red eléctrica', desc: '+2 saltos y +30 % de daño.', mods: { chain: 2, dmg: 1.3 } },
  { id: 'balistica', a: 'canon', b: 'francotirador', name: 'Balística', desc: 'Proyectiles +40 % de velocidad y +1 perforación.', mods: { speed: 1.4, pierce: 1, dmg: 1.15 } },
  { id: 'enlace', a: 'misil', b: 'drones', name: 'Enlace de objetivo', desc: 'Ambos +40 % de daño.', mods: { dmg: 1.4 } },
  { id: 'cero', a: 'hielo', b: 'cronos', name: 'Cero temporal', desc: 'Frenado +40 % y +20 % de cadencia.', mods: { slow: 1.4, rate: 1.2 } },
  { id: 'embudo', a: 'gravedad', b: 'mortero', name: 'Embudo', desc: 'Ambos +45 % de daño: lo que se junta, revienta.', mods: { dmg: 1.45 } },
  { id: 'torbellino', a: 'pulso', b: 'cuchillas', name: 'Torbellino', desc: 'Alcance +30 % y +25 % de daño.', mods: { range: 1.3, dmg: 1.25 } },
  { id: 'fundicion', a: 'laser', b: 'llamas', name: 'Fundición', desc: 'Ambos queman el doble y +20 % de daño.', mods: { burn: 2, dmg: 1.2 } },
  { id: 'sopa', a: 'acido', b: 'gravedad', name: 'Sopa primordial', desc: 'Ambos +60 % de daño.', mods: { dmg: 1.6 } },
  { id: 'escarcha', a: 'bumeran', b: 'hielo', name: 'Escarcha cortante', desc: 'Todo lo que cortan se congela un 30 %.', mods: { slow: 1.3, rate: 1.15 } },
  { id: 'demolicion', a: 'minas', b: 'mortero', name: 'Demolición', desc: 'Ambos +40 % de daño y explosión.', mods: { dmg: 1.4, splash: 1.2 } },
  { id: 'plasma-s', a: 'rayo', b: 'laser', name: 'Plasma', desc: 'Ambos +35 % de daño.', mods: { dmg: 1.35 } },
];

// ── Fusions: two fully evolved defenders become one legendary ──────────────
const NOUN: Partial<Record<DefKind, string>> = {
  canon: 'Cañón', laser: 'Láser', rayo: 'Rayo', pulso: 'Pulso', misil: 'Misil', hielo: 'Glaciar', cuchillas: 'Torbellino', mortero: 'Obús',
  francotirador: 'Rifle', llamas: 'Infierno', gravedad: 'Vórtice', drones: 'Enjambre', acido: 'Pantano', bumeran: 'Bumerán', minas: 'Campo minado', cronos: 'Reloj',
};
const ADJ: Partial<Record<DefKind, string>> = {
  canon: 'balístico', laser: 'fotónico', rayo: 'eléctrico', pulso: 'sísmico', misil: 'explosivo', hielo: 'helado', cuchillas: 'afilado', mortero: 'orbital',
  francotirador: 'certero', llamas: 'ígneo', gravedad: 'gravitatorio', drones: 'autónomo', acido: 'corrosivo', bumeran: 'giratorio', minas: 'traicionero', cronos: 'temporal',
};
const SPECIAL: Record<string, string> = {
  'canon+rayo': 'Railgun', 'laser+rayo': 'Cañón de plasma', 'hielo+llamas': 'Tormenta de vapor', 'misil+mortero': 'Lluvia de meteoritos',
  'cuchillas+pulso': 'Tornado', 'gravedad+pulso': 'Estrella de neutrones', 'cronos+gravedad': 'Agujero de gusano', 'drones+misil': 'Portaaviones',
  'francotirador+laser': 'Rayo de la muerte', 'acido+llamas': 'Napalm viviente', 'bumeran+cuchillas': 'Picadora', 'cronos+hielo': 'Era glacial',
  'minas+mortero': 'Bombardeo total', 'canon+francotirador': 'Cañón de riel pesado', 'drones+rayo': 'Enjambre tesla', 'acido+gravedad': 'Disolvente cósmico',
};
export function fusionName(a: DefKind, b: DefKind): string {
  const key = [a, b].sort().join('+');
  return SPECIAL[key] ?? `${NOUN[a]} ${ADJ[b]}`;
}

/** Upgrades needed on a defender before each evolution. */
export const EVO_AT = [3, 7];

export function evoOptions(d: Defender): Evo[] {
  if (d.fuse) return [];
  const tier = d.evo.length;
  if (tier >= 2 || d.lvl < EVO_AT[tier]) return [];
  return EVOS.filter((e) => e.kind === d.kind && e.tier === tier + 1 && (tier === 0 || e.parent === d.evo[0]));
}

export function defenderName(d: Defender): string {
  if (d.fuse) return fusionName(d.kind, d.fuse.kind);
  const last = d.evo[d.evo.length - 1];
  return (last && EVOS.find((e) => e.id === last)?.name) || DEF_INFO[d.kind].name;
}

export function makeDefender(id: number, kind: DefKind): Defender {
  return { id, kind, chip: chipOfKind(kind), name: DEF_INFO[kind].name, lvl: 0, evo: [], stats: DEF_INFO[kind].base(), flags: { ...(DEF_INFO[kind].flags ?? {}) }, kills: 0, cd: 0.3, aim: 0, x: 0, y: 0, lockId: -1, lockT: 0, spin: 0, pending: 0 };
}
