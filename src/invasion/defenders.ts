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
  rastreador: { name: 'Rastreador', desc: 'Marca a los virus como vulnerables: reciben +50 % de daño de todos.', color: '#ff7ad9', base: () => stats({ dmg: 8, rate: 1.1, range: 210, count: 2 }) },
  senuelo: { name: 'Señuelo', desc: 'Proyecta hologramas del núcleo: los virus se paran a atacarlos y explotan.', color: '#9fd3ff', base: () => stats({ dmg: 40, rate: 0.25, range: 200, count: 1 }) },
  // ── Second main chip «Anomalía»: mechanics found nowhere else ──
  iman: { chip: 'anomalia', name: 'Imán', desc: 'Atrapa un virus y lo estrella contra otro: los dos se rompen.', color: '#ff5f8f', base: () => stats({ dmg: 70, rate: 0.6, range: 260 }) },
  clonador: { chip: 'anomalia', name: 'Clonador', desc: 'Copia el ataque de otro defensor tuyo al azar, cada vez uno distinto.', color: '#f5f5f5', base: () => stats({ dmg: 1, rate: 1, range: 200 }) },
  burbuja: { chip: 'anomalia', name: 'Burbuja', desc: 'Encierra a un virus en una burbuja que flota lejos y luego revienta.', color: '#9ff0ff', base: () => stats({ dmg: 60, rate: 0.5, range: 240, count: 1 }) },
  hacker: { chip: 'anomalia', name: 'Hacker', desc: 'Hackea a un virus para que luche de tu lado unos segundos.', color: '#3dff6e', base: () => stats({ dmg: 30, rate: 0.3, range: 260, count: 1 }) },
  fractal: { chip: 'anomalia', name: 'Fractal', desc: 'Disparos que se dividen en dos una y otra vez mientras vuelan.', color: '#ffd84d', base: () => stats({ dmg: 30, rate: 0.9, range: 260, speed: 260 }) },
  eclipse: { chip: 'anomalia', name: 'Eclipse', desc: 'Una sombra que recorre el tablero drenando todo lo que cubre.', color: '#6b4dff', base: () => stats({ dmg: 60, rate: 0.12, range: 300, splash: 70 }) },
  // ── Chip Prisma (luz) ── attacks never seen on the main chip
  refractor: { chip: 'prisma', name: 'Refractor', desc: 'Lanza un orbe de luz que estalla en seis fragmentos, uno de cada elemento.', color: '#7df9ff', base: () => stats({ dmg: 34, rate: 0.7, range: 230, speed: 220, count: 6 }) },
  espejo: { chip: 'prisma', name: 'Espejo', desc: 'Paneles de espejo giratorios que devuelven a los virus su propio golpe y los repelen.', color: '#bff7ff', base: () => stats({ dmg: 30, rate: 1.4, range: 70, count: 3, knock: 40 }) },
  foton: { chip: 'prisma', name: 'Fotón', desc: 'Marca virus con luz; al rato las marcas detonan, más fuerte cuantas más haya.', color: '#e6fdff', base: () => stats({ dmg: 60, rate: 0.55, range: 300, count: 4 }) },
  // ── Chip Forja (metal / fuego) ──
  martillo: { chip: 'forja', name: 'Martillo', desc: 'Golpea el suelo y abre una grieta que avanza arrasando todo a su paso.', color: '#ff9a3d', base: () => stats({ dmg: 70, rate: 0.5, range: 260, splash: 22 }) },
  crisol: { chip: 'forja', name: 'Crisol', desc: 'Forja placas de blindaje: repara el núcleo, recarga escudos y refuerza el muro.', color: '#ffb347', base: () => stats({ dmg: 6, rate: 0.12, range: 0 }) },
  forjador: { chip: 'forja', name: 'Forjador', desc: 'Dispara discos de sierra que rebotan por los bordes de la pantalla.', color: '#ff6a1f', base: () => stats({ dmg: 26, rate: 0.45, range: 300, speed: 320, count: 1 }) },
  // ── Chip Bio ──
  nanobots: { chip: 'bio', name: 'Nanobots', desc: 'Infecta virus; al morir, la infección salta a los de al lado.', color: '#5dffa8', base: () => stats({ dmg: 22, rate: 0.9, range: 260, count: 2 }) },
  espora: { chip: 'bio', name: 'Espora', desc: 'Planta semillas que brotan como torretas vivas durante unos segundos.', color: '#b6ff3d', base: () => stats({ dmg: 14, rate: 0.3, range: 230, count: 1 }) },
  raiz: { chip: 'bio', name: 'Raíz', desc: 'Raíces que inmovilizan a un grupo de virus y les roban vida para el núcleo.', color: '#3dff9a', base: () => stats({ dmg: 30, rate: 0.35, range: 240, splash: 55 }) },
  // ── Chip Vacío ──
  singular: { chip: 'vacio', name: 'Singularidad', desc: 'Destierra al virus más duro de vuelta al borde de la pantalla.', color: '#9d7bff', base: () => stats({ dmg: 40, rate: 0.28, range: 300, count: 1 }) },
  eco: { chip: 'vacio', name: 'Eco', desc: 'Invierte el tiempo de un grupo: los virus caminan hacia atrás.', color: '#c48bff', base: () => stats({ dmg: 20, rate: 0.3, range: 230, splash: 70 }) },
  // ── Anomalía · chip Marea ──
  ola: { chip: 'marea', name: 'Ola', desc: 'Lanza una ola en abanico que golpea y arrastra a los virus hacia atrás.', color: '#4dc3ff', base: () => stats({ dmg: 30, rate: 0.5, range: 220, knock: 60, spread: 0.9 }) },
  remolino: { chip: 'marea', name: 'Remolino', desc: 'Abre un remolino que hace girar a los virus en círculos mientras los ahoga.', color: '#6ee6ff', base: () => stats({ dmg: 26, rate: 0.3, range: 230, splash: 60 }) },
  geiser: { chip: 'marea', name: 'Géiser', desc: 'Marca el suelo bajo un grupo: un instante después brota un géiser que los lanza por los aires.', color: '#bff3ff', base: () => stats({ dmg: 80, rate: 0.45, range: 250, splash: 42, count: 2 }) },
  // ── Anomalía · chip Tesla ──
  bobina: { chip: 'tesla', name: 'Bobina', desc: 'Acumula carga sin parar; cuando está llena, descarga en todos los virus cercanos a la vez.', color: '#ffe14d', base: () => stats({ dmg: 60, rate: 0.35, range: 230, count: 6 }) },
  malla: { chip: 'tesla', name: 'Malla', desc: 'Une a dos virus con un hilo eléctrico: todo lo que cruza el hilo se electrocuta.', color: '#fff27a', base: () => stats({ dmg: 70, rate: 0.5, range: 240 }) },
  pararrayos: { chip: 'tesla', name: 'Pararrayos', desc: 'Clava un pararrayos en el camino: le caen rayos que fríen todo a su alrededor.', color: '#d6f0ff', base: () => stats({ dmg: 34, rate: 0.22, range: 220, splash: 60 }) },
  // ── Anomalía · chip Cripta ──
  maldicion: { chip: 'cripta', name: 'Maldición', desc: 'Maldice a los virus: al morir estallan y dañan a los de alrededor con su propia vida.', color: '#b46bff', base: () => stats({ dmg: 20, rate: 0.8, range: 240, count: 3 }) },
  espiritu: { chip: 'cripta', name: 'Espíritu', desc: 'Un espíritu posee al virus más fuerte: le roba la vida y repara el núcleo.', color: '#d9c2ff', base: () => stats({ dmg: 30, rate: 0.25, range: 280 }) },
  lapida: { chip: 'cripta', name: 'Lápida', desc: 'Recoge las almas de los virus que mueren cerca y las dispara: cuantas más almas, más disparos.', color: '#8f7bb3', base: () => stats({ dmg: 22, rate: 0.7, range: 260, speed: 280, homing: 1 }) },
  // ── Anomalía · chip Colmena ──
  abeja: { chip: 'colmena', name: 'Abeja reina', desc: 'Suelta abejas que persiguen virus una y otra vez hasta que se cansan.', color: '#ffb020', base: () => stats({ dmg: 10, rate: 0.6, range: 260, count: 3, speed: 260, homing: 1, pierce: 3 }) },
  telarana: { chip: 'colmena', name: 'Telaraña', desc: 'Teje una telaraña: los virus se quedan pegados y cada segundo dentro les duele más.', color: '#f2e6c9', base: () => stats({ dmg: 14, rate: 0.28, range: 230, splash: 55 }) },
  mutageno: { chip: 'colmena', name: 'Mutágeno', desc: 'Muta a los virus: pierden blindaje y velocidad, reciben más daño y la mutación se contagia.', color: '#9cff3d', base: () => stats({ dmg: 18, rate: 0.6, range: 240, count: 2 }) },
  // ── Tercer núcleo «Quásar» ──
  pulsar: { chip: 'quasar', name: 'Púlsar', desc: 'Dos haces opuestos que giran sin parar alrededor, como un faro estelar.', color: '#ff6bf0', base: () => stats({ dmg: 40, rate: 1, range: 200, count: 2 }) },
  graviton: { chip: 'quasar', name: 'Gravitón', desc: 'Gravedad inversa: empuja todo lo que se acerca y lo aplasta contra el vacío.', color: '#c78bff', base: () => stats({ dmg: 30, rate: 1, range: 120, knock: 50 }) },
  supernova: { chip: 'quasar', name: 'Supernova', desc: 'Se carga durante unos segundos y estalla en una explosión enorme a su alrededor.', color: '#ffd27a', base: () => stats({ dmg: 260, rate: 0.18, range: 170 }) },
  blanco: { chip: 'quasar', name: 'Agujero blanco', desc: 'Escupe proyectiles en espiral sin parar en todas direcciones.', color: '#f4f0ff', base: () => stats({ dmg: 14, rate: 9, range: 230, speed: 220 }) },
  cometa: { chip: 'quasar', name: 'Cometa', desc: 'Lanza un cometa que cruza la pantalla y deja una estela de fuego por donde pasa.', color: '#7ad7ff', base: () => stats({ dmg: 110, rate: 0.3, range: 400, splash: 30, burn: 12 }) },
  nebulosa: { chip: 'quasar', name: 'Nebulosa', desc: 'Una nube cósmica que desorienta a los virus: caminan perdidos mientras se deshacen.', color: '#ff8ad8', base: () => stats({ dmg: 22, rate: 0.2, range: 260, splash: 75 }) },
  // ── Quásar · chip Reloj ──
  pendulo: { chip: 'reloj', name: 'Péndulo', desc: 'Una cuchilla de péndulo que barre de lado a lado delante del chip.', color: '#7dffd8', base: () => stats({ dmg: 60, rate: 1, range: 150 }) },
  arena: { chip: 'reloj', name: 'Arena del tiempo', desc: 'Arenas movedizas: cuanto más tiempo pasa un virus dentro, más daño recibe.', color: '#ffd9a0', base: () => stats({ dmg: 16, rate: 0.25, range: 240, splash: 65 }) },
  retardo: { chip: 'reloj', name: 'Retardo', desc: 'Marca a un virus: todo el daño que recibe se repite segundo y medio después.', color: '#a0fff0', base: () => stats({ dmg: 10, rate: 0.7, range: 260, count: 2 }) },
  // ── Quásar · chip Gema ──
  lanza: { chip: 'gema', name: 'Lanza de cuarzo', desc: 'Una lanza que lo atraviesa todo y crece con cada virus que perfora.', color: '#c6a3ff', base: () => stats({ dmg: 50, rate: 0.55, range: 300, speed: 380, pierce: 99 }) },
  geoda: { chip: 'gema', name: 'Geoda', desc: 'Levanta muros de cristal en el camino: frenan a los virus y estallan en esquirlas.', color: '#e0ccff', base: () => stats({ dmg: 60, rate: 0.2, range: 200, splash: 40 }) },
  cristalizar: { chip: 'gema', name: 'Cristalizar', desc: 'Convierte a un virus en cristal: queda quieto y al golpearlo revienta en pedazos.', color: '#b3f0ff', base: () => stats({ dmg: 40, rate: 0.5, range: 250, splash: 50 }) },
  // ── Quásar · chip Plasma ──
  latigo: { chip: 'plasma', name: 'Látigo de plasma', desc: 'Un latigazo en arco que corta y quema a todo lo que tiene delante.', color: '#ff4d4d', base: () => stats({ dmg: 44, rate: 0.9, range: 120, burn: 6 }) },
  sol: { chip: 'plasma', name: 'Sol', desc: 'Un pequeño sol orbita alrededor y quema lo que toca; de vez en cuando lanza una llamarada.', color: '#ffb347', base: () => stats({ dmg: 50, rate: 1, range: 60, burn: 10 }) },
  erupcion: { chip: 'plasma', name: 'Erupción', desc: 'Hace brotar lava bajo los grupos de virus: arde y deja el suelo al rojo.', color: '#ff6a3d', base: () => stats({ dmg: 30, rate: 0.3, range: 250, splash: 50, burn: 14 }) },
  // ── Quásar · chip Resonancia ──
  diapason: { chip: 'resonancia', name: 'Diapasón', desc: 'Una nota en línea recta: cuantos más virus atraviesa, más fuerte suena.', color: '#9effa1', base: () => stats({ dmg: 36, rate: 0.7, range: 300 }) },
  bajo: { chip: 'resonancia', name: 'Bajo', desc: 'Un golpe grave que aturde a todo lo que hay alrededor.', color: '#5dff8f', base: () => stats({ dmg: 30, rate: 0.35, range: 150 }) },
  silencio: { chip: 'resonancia', name: 'Silencio', desc: 'Silencia a los virus: pierden escudo y blindaje para siempre y no pueden usar sus trucos.', color: '#e8ffe0', base: () => stats({ dmg: 16, rate: 0.4, range: 250, splash: 70 }) },
  segador: { chip: 'vacio', name: 'Segador', desc: 'Una guadaña que siega a los virus debilitados y se hace más fuerte con cada uno.', color: '#e0c3ff', base: () => stats({ dmg: 45, rate: 0.6, range: 150, execute: 0.18 }) },
};
// ── Elements: every defender and every virus has one ─────────────────────
export type Element = 'fuego' | 'hielo' | 'electrico' | 'luz' | 'vacio' | 'bio' | 'metal' | 'tiempo';
export const ELEMENTS: Record<Element, { name: string; color: string; strong: Element[]; weak: Element[] }> = {
  fuego: { name: 'Fuego', color: '#ff6a1f', strong: ['bio', 'hielo', 'metal'], weak: ['fuego', 'tiempo'] },
  hielo: { name: 'Hielo', color: '#8af3ff', strong: ['electrico', 'bio'], weak: ['fuego', 'metal', 'hielo'] },
  electrico: { name: 'Eléctrico', color: '#7db7ff', strong: ['metal', 'tiempo'], weak: ['bio', 'electrico'] },
  luz: { name: 'Luz', color: '#fff3a6', strong: ['vacio', 'tiempo'], weak: ['luz', 'metal'] },
  vacio: { name: 'Vacío', color: '#9d7bff', strong: ['luz', 'metal'], weak: ['vacio', 'tiempo'] },
  bio: { name: 'Bio', color: '#5dffa8', strong: ['electrico', 'luz'], weak: ['fuego', 'hielo', 'bio'] },
  metal: { name: 'Metal', color: '#c9d1dc', strong: ['hielo', 'luz'], weak: ['electrico', 'fuego'] },
  tiempo: { name: 'Tiempo', color: '#7dffd8', strong: ['vacio', 'bio', 'fuego'], weak: ['electrico', 'luz'] },
};
export const ELEMENT_LIST = Object.keys(ELEMENTS) as Element[];
export const DEF_EL: Record<DefKind, Element> = {
  canon: 'metal', laser: 'luz', rayo: 'electrico', pulso: 'vacio', misil: 'fuego', hielo: 'hielo', cuchillas: 'metal', mortero: 'fuego',
  francotirador: 'luz', llamas: 'fuego', gravedad: 'vacio', drones: 'electrico', acido: 'bio', bumeran: 'metal', minas: 'electrico', cronos: 'tiempo',
  rastreador: 'luz', senuelo: 'electrico', iman: 'metal', clonador: 'tiempo', burbuja: 'hielo', hacker: 'electrico', fractal: 'luz', eclipse: 'vacio',
  refractor: 'luz', espejo: 'luz', foton: 'luz', martillo: 'metal', crisol: 'fuego', forjador: 'metal', nanobots: 'bio', espora: 'bio', raiz: 'bio', singular: 'vacio', eco: 'tiempo', segador: 'vacio',
  ola: 'hielo', remolino: 'hielo', geiser: 'fuego', bobina: 'electrico', malla: 'electrico', pararrayos: 'electrico', maldicion: 'vacio', espiritu: 'vacio', lapida: 'tiempo', abeja: 'bio', telarana: 'bio', mutageno: 'bio',
  pulsar: 'luz', graviton: 'vacio', supernova: 'fuego', blanco: 'luz', cometa: 'hielo', nebulosa: 'tiempo',
  pendulo: 'metal', arena: 'tiempo', retardo: 'tiempo', lanza: 'metal', geoda: 'metal', cristalizar: 'hielo', latigo: 'fuego', sol: 'fuego', erupcion: 'fuego', diapason: 'electrico', bajo: 'metal', silencio: 'luz',
};
/** ×1.6 super effective, ×0.6 not very effective. */
export function effectiveness(att: Element | undefined, def: Element | undefined): number {
  if (!att || !def) return 1;
  const e = ELEMENTS[att];
  return e.strong.includes(def) ? 1.6 : e.weak.includes(def) ? 0.6 : 1;
}

// ── Ultimate moves: one unique special per defender, charged over time ──
export type UltFx = 'expose' | 'decoys' | 'collide' | 'mimic' | 'bubbles' | 'army' | 'fractalstorm' | 'blackout' | 'barrage' | 'beam' | 'storm' | 'quake' | 'meteors' | 'freeze' | 'whirl' | 'execute' | 'inferno' | 'hole' | 'swarm' | 'flood' | 'boomerangs' | 'minefield' | 'stop' | 'rainbow' | 'mirrors' | 'marks' | 'fissures' | 'armor' | 'saws' | 'pandemic' | 'garden' | 'jungle' | 'banish' | 'rewind' | 'harvest' | 'artillery';
export const ULTS: Record<DefKind, { name: string; desc: string; fx: UltFx }> = {
  canon: { name: 'Andanada', desc: '24 balas en todas direcciones.', fx: 'barrage' },
  laser: { name: 'Rayo solar', desc: 'Un haz gigante que barre la pantalla.', fx: 'beam' },
  rayo: { name: 'Tormenta', desc: 'Diez rayos caen sobre los virus.', fx: 'storm' },
  pulso: { name: 'Terremoto', desc: 'Una onda enorme que lo aparta todo.', fx: 'quake' },
  misil: { name: 'Lluvia de misiles', desc: 'Ocho misiles sobre los grupos.', fx: 'meteors' },
  hielo: { name: 'Edad de hielo', desc: 'Congela todo lo cercano 3 s.', fx: 'freeze' },
  cuchillas: { name: 'Torbellino de acero', desc: 'Sus cuchillas crecen y giran el triple.', fx: 'whirl' },
  mortero: { name: 'Bombardeo', desc: 'Doce proyectiles por toda la zona.', fx: 'artillery' },
  francotirador: { name: 'Ejecución', desc: 'Remata a los tres virus más duros.', fx: 'execute' },
  llamas: { name: 'Infierno', desc: 'Un anillo de fuego que lo quema todo.', fx: 'inferno' },
  gravedad: { name: 'Horizonte de sucesos', desc: 'Un agujero negro gigante.', fx: 'hole' },
  drones: { name: 'Enjambre', desc: 'El doble de drones durante 8 s.', fx: 'swarm' },
  acido: { name: 'Diluvio ácido', desc: 'Charcos sobre cinco grupos de virus.', fx: 'flood' },
  bumeran: { name: 'Tormenta de cuchillas', desc: 'Diez bumeranes a la vez.', fx: 'boomerangs' },
  minas: { name: 'Campo minado', desc: 'Doce minas alrededor de la defensa.', fx: 'minefield' },
  cronos: { name: 'Parar el tiempo', desc: 'Todos los virus se paran 2 s.', fx: 'stop' },
  refractor: { name: 'Arcoíris', desc: 'Una lluvia de fragmentos de todos los elementos.', fx: 'rainbow' },
  espejo: { name: 'Muro de espejos', desc: 'Todo lo cercano sale rebotado.', fx: 'mirrors' },
  foton: { name: 'Supernova de luz', desc: 'Marca a todos los virus y los detona.', fx: 'marks' },
  martillo: { name: 'Golpe de forja', desc: 'Seis grietas en todas direcciones.', fx: 'fissures' },
  crisol: { name: 'Armadura total', desc: 'Repara mucho el núcleo y da 2 escudos.', fx: 'armor' },
  forjador: { name: 'Sierra infinita', desc: 'Cinco sierras rebotando a la vez.', fx: 'saws' },
  nanobots: { name: 'Pandemia', desc: 'Infecta a diez virus.', fx: 'pandemic' },
  espora: { name: 'Jardín', desc: 'Brotan seis torretas vivas.', fx: 'garden' },
  raiz: { name: 'Selva', desc: 'Atrapa a todo lo cercano 3 s.', fx: 'jungle' },
  singular: { name: 'Destierro', desc: 'Manda a los cinco más duros al borde.', fx: 'banish' },
  eco: { name: 'Rebobinado', desc: 'Todo lo cercano camina hacia atrás 3 s.', fx: 'rewind' },
  segador: { name: 'Cosecha', desc: 'Siega a todos los virus por debajo del 25 %.', fx: 'harvest' },
  rastreador: { name: 'Exposición', desc: 'Todos los virus en pantalla quedan vulnerables.', fx: 'expose' },
  senuelo: { name: 'Espejismo', desc: 'Cinco hologramas a la vez.', fx: 'decoys' },
  iman: { name: 'Colisión', desc: 'Junta a todos los virus cercanos de golpe.', fx: 'collide' },
  clonador: { name: 'Mímesis', desc: 'Lanza el definitivo de otro defensor.', fx: 'mimic' },
  burbuja: { name: 'Espuma', desc: 'Encierra a seis virus a la vez.', fx: 'bubbles' },
  hacker: { name: 'Ejército', desc: 'Hackea a cinco virus.', fx: 'army' },
  fractal: { name: 'Fractal infinito', desc: 'Una lluvia de disparos que no para de dividirse.', fx: 'fractalstorm' },
  eclipse: { name: 'Eclipse total', desc: 'Oscurece todo el tablero y lo drena.', fx: 'blackout' },
  ola: { name: 'Tsunami', desc: 'Una ola gigante que lo aparta todo.', fx: 'quake' },
  remolino: { name: 'Maelstrom', desc: 'Un remolino enorme en mitad del tablero.', fx: 'hole' },
  geiser: { name: 'Campo de géiseres', desc: 'Doce géiseres por toda la zona.', fx: 'artillery' },
  bobina: { name: 'Sobretensión', desc: 'Diez rayos caen sobre los virus.', fx: 'storm' },
  malla: { name: 'Parálisis', desc: 'Todos los virus se quedan quietos 2 s.', fx: 'stop' },
  pararrayos: { name: 'Tormenta perfecta', desc: 'Rayos sobre todo el tablero.', fx: 'storm' },
  maldicion: { name: 'Condena', desc: 'Todos los virus quedan vulnerables.', fx: 'expose' },
  espiritu: { name: 'Legión', desc: 'Posee a cinco virus que luchan por ti.', fx: 'army' },
  lapida: { name: 'Ánimas', desc: 'Una andanada de almas en todas direcciones.', fx: 'barrage' },
  abeja: { name: 'Enjambre furioso', desc: 'La colmena trabaja al doble durante 8 s.', fx: 'swarm' },
  telarana: { name: 'Gran telaraña', desc: 'Atrapa a todo lo cercano 3 s.', fx: 'jungle' },
  mutageno: { name: 'Mutación masiva', desc: 'Infecta a diez virus.', fx: 'pandemic' },
  pulsar: { name: 'Faro estelar', desc: 'Un haz gigante que barre la pantalla.', fx: 'beam' },
  graviton: { name: 'Onda gravitatoria', desc: 'Una onda enorme que lo aparta todo.', fx: 'quake' },
  supernova: { name: 'Hipernova', desc: 'Un anillo de fuego que lo quema todo.', fx: 'inferno' },
  blanco: { name: 'Big Bang', desc: 'Una lluvia de fragmentos de todos los elementos.', fx: 'rainbow' },
  cometa: { name: 'Lluvia de cometas', desc: 'Ocho cometas sobre los grupos.', fx: 'meteors' },
  nebulosa: { name: 'Nube cósmica', desc: 'Oscurece todo el tablero y lo drena.', fx: 'blackout' },
  pendulo: { name: 'Péndulo eterno', desc: 'Barre al triple de velocidad durante 6 s.', fx: 'whirl' },
  arena: { name: 'Desierto', desc: 'Arenas sobre cinco grupos de virus.', fx: 'flood' },
  retardo: { name: 'Eco del tiempo', desc: 'Todos los virus se paran 2 s.', fx: 'stop' },
  lanza: { name: 'Lanzas de cuarzo', desc: 'Lanzas en todas direcciones.', fx: 'barrage' },
  geoda: { name: 'Fortaleza', desc: 'Repara mucho el núcleo y da 2 escudos.', fx: 'armor' },
  cristalizar: { name: 'Edad de cristal', desc: 'Congela todo lo cercano 3 s.', fx: 'freeze' },
  latigo: { name: 'Latigazo solar', desc: 'Todo lo cercano sale despedido.', fx: 'mirrors' },
  sol: { name: 'Corona solar', desc: 'Un anillo de fuego que lo quema todo.', fx: 'inferno' },
  erupcion: { name: 'Volcán', desc: 'Lava sobre cinco grupos de virus.', fx: 'flood' },
  diapason: { name: 'Nota final', desc: 'Un haz de sonido que barre la pantalla.', fx: 'beam' },
  bajo: { name: 'Terremoto sónico', desc: 'Una onda enorme que lo aparta todo.', fx: 'quake' },
  silencio: { name: 'Silencio absoluto', desc: 'Todos los virus quedan vulnerables.', fx: 'expose' },
};
export const ULT_TIME = 16;

/** The behaviour a defender runs. */
export const behOf = (k: DefKind): DefKind => DEF_INFO[k].beh ?? k;

// ── Extra chips: outposts around the main one ──────────────────────────────
export type ChipId = 'prisma' | 'forja' | 'bio' | 'vacio' | 'anomalia' | 'marea' | 'tesla' | 'cripta' | 'colmena' | 'quasar' | 'reloj' | 'gema' | 'plasma' | 'resonancia';
export interface ChipDef {
  id: ChipId;
  name: string;
  color: string;
  ability: string;
  kinds: DefKind[];
  /** Which main core it belongs to (0 = the central one). */
  core: number;
  /** A main core (six defenders) instead of an outpost (three). */
  main?: boolean;
  /** Joint evolution of an outpost at level 10. */
  form?: { name: string; desc: string };
}
/**
 * Unlock order: the four outposts of the central core, then the second main
 * core and its four outposts, then the third main core and its four. Never more.
 */
export const CHIPS: ChipDef[] = [
  { id: 'prisma', core: 0, name: 'Prisma', color: '#7df9ff', ability: 'Dispara haces de luz que se reparten entre los virus más cercanos.', kinds: ['refractor', 'espejo', 'foton'], form: { name: 'Catedral de luz', desc: 'Sus haces se duplican y todo lo que tocan queda deslumbrado.' } },
  { id: 'forja', core: 0, name: 'Forja', color: '#ff9a3d', ability: 'Hace caer meteoritos ardientes sobre los virus.', kinds: ['martillo', 'crisol', 'forjador'], form: { name: 'Gran Fundición', desc: 'Lluvia doble de meteoritos al rojo vivo.' } },
  { id: 'bio', core: 0, name: 'Bio', color: '#5dffa8', ability: 'Repara el núcleo y siembra nubes tóxicas.', kinds: ['nanobots', 'espora', 'raiz'], form: { name: 'Árbol de la vida', desc: 'Repara el doble y sus nubes son el doble de tóxicas.' } },
  { id: 'vacio', core: 0, name: 'Vacío', color: '#9d7bff', ability: 'Un vórtice permanente atrae y tritura a los virus que pasan.', kinds: ['singular', 'eco', 'segador'], form: { name: 'Abismo', desc: 'El vórtice crece y tritura el doble.' } },
  { id: 'anomalia', core: 1, main: true, name: 'Anomalía', color: '#ff5f8f', ability: 'Un segundo núcleo principal: un rayo une los dos núcleos y fulmina lo que lo cruza.', kinds: ['iman', 'clonador', 'burbuja', 'hacker', 'fractal', 'eclipse'] },
  { id: 'marea', core: 1, name: 'Marea', color: '#4dc3ff', ability: 'Cada poco suelta una onda de agua helada que frena a todo lo cercano.', kinds: ['ola', 'remolino', 'geiser'], form: { name: 'Océano', desc: 'Sus ondas son enormes y congelan casi del todo.' } },
  { id: 'tesla', core: 1, name: 'Tesla', color: '#ffe14d', ability: 'Lanza un rayo encadenado que salta entre cinco virus.', kinds: ['bobina', 'malla', 'pararrayos'], form: { name: 'Torre Tesla', desc: 'Sus rayos saltan entre diez virus y hacen el doble.' } },
  { id: 'cripta', core: 1, name: 'Cripta', color: '#b46bff', ability: 'Drena la vida de los virus cercanos para reparar el núcleo.', kinds: ['maldicion', 'espiritu', 'lapida'], form: { name: 'Necrópolis', desc: 'Drena a seis virus a la vez y repara el triple.' } },
  { id: 'colmena', core: 1, name: 'Colmena', color: '#ffb020', ability: 'Suelta un enjambre de avispas que persiguen a los virus.', kinds: ['abeja', 'telarana', 'mutageno'], form: { name: 'Reina madre', desc: 'Enjambres el doble de grandes y venenosos.' } },
  { id: 'quasar', core: 2, main: true, name: 'Quásar', color: '#ff6bf0', ability: 'El tercer núcleo: los tres núcleos se unen en un triángulo de energía que lo fulmina todo.', kinds: ['pulsar', 'graviton', 'supernova', 'blanco', 'cometa', 'nebulosa'] },
  { id: 'reloj', core: 2, name: 'Reloj', color: '#7dffd8', ability: 'Detiene el tiempo alrededor del chip cada pocos segundos.', kinds: ['pendulo', 'arena', 'retardo'], form: { name: 'Cronosfera', desc: 'Detiene el tiempo más lejos y durante más rato.' } },
  { id: 'gema', core: 2, name: 'Gema', color: '#c6a3ff', ability: 'Dispara esquirlas de cristal en todas direcciones.', kinds: ['lanza', 'geoda', 'cristalizar'], form: { name: 'Diamante', desc: 'El doble de esquirlas y lo atraviesan todo.' } },
  { id: 'plasma', core: 2, name: 'Plasma', color: '#ff4d4d', ability: 'Una llamarada quema a todos los virus cercanos.', kinds: ['latigo', 'sol', 'erupcion'], form: { name: 'Estrella', desc: 'Llamaradas el doble de grandes y que queman más.' } },
  { id: 'resonancia', core: 2, name: 'Resonancia', color: '#9effa1', ability: 'Un pulso sónico golpea y aparta a lo que se acerca.', kinds: ['diapason', 'bajo', 'silencio'], form: { name: 'Sinfonía', desc: 'Pulsos que aturden y hacen el doble.' } },
];
/** Index of the second and third main chips. */
export const TWIN = 5;
export const TRIAD = 10;
export const MAIN_CHIPS = [0, TWIN, TRIAD];
export const MAX_CHIPS = 1 + CHIPS.length;
/** Chip upgrade levels (all its defenders at once). */
export const CHIP_MAX_LVL = 10;
/** Defenders per extra chip. */
export const CHIP_SLOTS = 3;
export const isMainChip = (k: number) => k === 0 || !!CHIPS[k - 1]?.main;
export const chipSlots = (k: number) => (isMainChip(k) ? 6 : CHIP_SLOTS);
/** Main core a chip belongs to (0, 1, 2). */
export const coreOf = (k: number) => (k === 0 ? 0 : CHIPS[k - 1].core);
/** The four outposts of a main core. */
export const outpostsOf = (core: number) => CHIPS.map((c, i) => ({ c, k: i + 1 })).filter((x) => x.c.core === core && !x.c.main).map((x) => x.k);
/** Radius of the ring of defenders around chip k. */
export const chipRingR = (k: number) => (k === 0 ? 64 : isMainChip(k) ? 48 : 36);
export const CHIP_D = 235;
const D2 = 85;
const POS: { x: number; y: number }[] = [
  { x: 0, y: 0 },
  { x: 0, y: -CHIP_D }, { x: 0, y: CHIP_D }, { x: -CHIP_D, y: 0 }, { x: CHIP_D, y: 0 },
  // Second core (top right) and its outposts on the diagonals around it
  { x: CHIP_D, y: -CHIP_D }, { x: CHIP_D - D2, y: -CHIP_D - D2 }, { x: CHIP_D + D2, y: -CHIP_D - D2 }, { x: CHIP_D + D2, y: -CHIP_D + D2 }, { x: CHIP_D - D2, y: -CHIP_D + D2 },
  // Third core (bottom left)
  { x: -CHIP_D, y: CHIP_D }, { x: -CHIP_D + D2, y: CHIP_D + D2 }, { x: -CHIP_D - D2, y: CHIP_D + D2 }, { x: -CHIP_D - D2, y: CHIP_D - D2 }, { x: -CHIP_D + D2, y: CHIP_D - D2 },
];
/** Where chip k sits. */
export function chipPos(k: number): { x: number; y: number } {
  return POS[k] ?? POS[0];
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
  // Rastreador
  E('rastreador', 1, undefined, 'radar', 'Radar', 'Marca a 2 virus más a la vez', (s) => { s.count += 2; }),
  E('rastreador', 1, undefined, 'debilitar', 'Debilitar', 'La marca dura el doble', (_s, f) => { f.long = 1; }),
  E('rastreador', 2, 'radar', 'red-rastreo', 'Red de rastreo', '+3 marcas y más alcance', (s) => { s.count += 3; s.range *= 1.3; }),
  E('rastreador', 2, 'radar', 'contagio-marca', 'Marca contagiosa', 'Al morir, la marca salta a otro virus', (_s, f) => { f.spread = 1; }),
  E('rastreador', 2, 'debilitar', 'quebrar', 'Quebrar', 'Los marcados reciben +100 % en vez de +50 %', (_s, f) => { f.deep = 1; }),
  E('rastreador', 2, 'debilitar', 'congelar-marca', 'Marca helada', 'Los marcados también van un 40 % más lentos', (s) => { s.slow = Math.max(s.slow, 0.4); }),
  // Señuelo
  E('senuelo', 1, undefined, 'proyector', 'Proyector', '+1 holograma', (s) => { s.count += 1; }),
  E('senuelo', 1, undefined, 'trampa', 'Holograma trampa', 'La explosión hace el doble', (s) => { s.dmg *= 2; }),
  E('senuelo', 2, 'proyector', 'multitud', 'Multitud', '+2 hologramas', (s) => { s.count += 2; }),
  E('senuelo', 2, 'proyector', 'resistente', 'Resistentes', 'Los hologramas aguantan el triple', (_s, f) => { f.tough = 1; }),
  E('senuelo', 2, 'trampa', 'nuclear-h', 'Holograma nuclear', 'Explosión enorme y quemadura', (s) => { s.dmg *= 1.5; s.burn += 12; }),
  E('senuelo', 2, 'trampa', 'hielo-h', 'Holograma helado', 'Al explotar congela', (s) => { s.slow = 0.85; }),
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
  francotirador: 'Rifle', llamas: 'Infierno', gravedad: 'Vórtice', drones: 'Enjambre', acido: 'Pantano', bumeran: 'Bumerán', minas: 'Campo minado', cronos: 'Reloj', rastreador: 'Ojo', senuelo: 'Espejismo',
};
const ADJ: Partial<Record<DefKind, string>> = {
  canon: 'balístico', laser: 'fotónico', rayo: 'eléctrico', pulso: 'sísmico', misil: 'explosivo', hielo: 'helado', cuchillas: 'afilado', mortero: 'orbital',
  francotirador: 'certero', llamas: 'ígneo', gravedad: 'gravitatorio', drones: 'autónomo', acido: 'corrosivo', bumeran: 'giratorio', minas: 'traicionero', cronos: 'temporal', rastreador: 'vigilante', senuelo: 'ilusorio',
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
