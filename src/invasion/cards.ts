import { behOf, CHIP_SLOTS, CHIPS, chipOfKind, DEF_INFO, DEF_KINDS, defenderName, EVOS, evoOptions, fusionName, makeDefender, MAX_CHIPS, SYNERGIES } from './defenders';
import type { DefKind, Defender, Game, Stats } from './types';

export const MAX_DEFENDERS = 10;

export type CardKind = 'new' | 'stat' | 'global' | 'pact' | 'evo' | 'fusion' | 'asc' | 'chip';
export type Rarity = 'comun' | 'rara' | 'epica' | 'legendaria';
export const RARITY_LABEL: Record<Rarity, string> = { comun: 'Común', rara: 'Rara', epica: 'Épica', legendaria: 'Legendaria' };
export interface Card {
  /** Unique within an offer. */
  key: string;
  /** Definition id (for counting the catalogue). */
  id: string;
  kind: CardKind;
  rarity: Rarity;
  title: string;
  desc: string;
  /** Small line above the title: target defender, «Pacto», «Evolución»… */
  tag: string;
  color: string;
  /** Second colour (fusions). */
  color2?: string;
  /** Defender the card acts on (for the visual feedback). */
  target?: number;
  /** New defenders: where on the ring (insert index); chosen by the player. */
  apply: (g: Game, at?: number) => void;
}

// ── Per-defender stat upgrades ─────────────────────────────────────────────
interface StatDef {
  id: string;
  title: (d: Defender) => string;
  desc: string;
  kinds?: DefKind[];
  ok?: (s: Stats) => boolean;
  apply: (s: Stats) => void;
  w?: number;
}
const PROJ: DefKind[] = ['canon', 'hielo', 'misil', 'drones'];
const countWord: Partial<Record<DefKind, string>> = {
  canon: 'bala', laser: 'haz', rayo: 'rayo', pulso: 'onda', misil: 'misil', hielo: 'esquirla', cuchillas: 'cuchilla', mortero: 'proyectil',
  francotirador: 'objetivo', llamas: 'llama', gravedad: 'agujero', drones: 'dron', acido: 'lanzamiento', bumeran: 'bumerán', minas: 'mina', cronos: 'pulso',
};
const NO_COUNT: DefKind[] = ['llamas', 'cronos'];
export const STAT_CARDS: StatDef[] = [
  { id: 'dmg', title: () => 'Daño +25 %', desc: 'Golpea más fuerte.', apply: (s) => { s.dmg *= 1.25; }, w: 1.4 },
  { id: 'rate', title: (d) => (d.kind === 'cuchillas' ? 'Giro +20 %' : 'Cadencia +20 %'), desc: 'Actúa más a menudo.', apply: (s) => { s.rate *= 1.2; }, w: 1.3 },
  { id: 'range', title: (d) => (d.kind === 'cuchillas' ? 'Radio +15 %' : 'Alcance +15 %'), desc: 'Llega más lejos.', ok: (s) => s.range < 900, apply: (s) => { s.range *= 1.15; } },
  { id: 'count', title: (d) => `+1 ${countWord[behOf(d.kind)] ?? 'disparo'}`, desc: 'Más a la vez.', kinds: DEF_KINDS.filter((k) => !NO_COUNT.includes(k)), ok: (s) => s.count < 12, apply: (s) => { s.count += 1; if (s.spread < 0.3) s.spread += 0.12; }, w: 1.2 },
  { id: 'pierce', title: () => 'Perforación +1', desc: 'Atraviesa un virus más.', kinds: PROJ, ok: (s) => s.pierce < 20, apply: (s) => { s.pierce += 1; } },
  { id: 'bounce', title: () => 'Rebote +1', desc: 'Rebota hacia otro virus.', kinds: ['canon', 'hielo'], ok: (s) => s.bounce < 6, apply: (s) => { s.bounce += 1; } },
  { id: 'chain', title: () => 'Salto +1', desc: 'Salta a un virus más.', kinds: ['rayo', 'laser'], apply: (s) => { s.chain += 1; } },
  { id: 'crit', title: () => 'Crítico +8 %', desc: 'Más golpes críticos.', ok: (s) => s.crit < 0.9, apply: (s) => { s.crit += 0.08; } },
  { id: 'critMult', title: () => 'Daño crítico +50 %', desc: 'Los críticos duelen más.', apply: (s) => { s.critMult += 0.5; } },
  { id: 'speed', title: () => 'Velocidad +30 %', desc: 'Proyectiles más rápidos.', kinds: [...PROJ, 'bumeran'], ok: (s) => s.speed < 2000, apply: (s) => { s.speed *= 1.3; }, w: 0.6 },
  { id: 'slow', title: () => 'Frenado +12 %', desc: 'Frena a los virus que toca.', ok: (s) => s.slow < 0.8, apply: (s) => { s.slow = Math.min(0.85, s.slow + 0.12); } },
  { id: 'burn', title: () => 'Quemadura +3/s', desc: 'Deja a los virus ardiendo.', apply: (s) => { s.burn += 3; } },
  { id: 'splash', title: (d) => (d.kind === 'gravedad' || d.kind === 'acido' ? 'Radio +12' : 'Explosión +12'), desc: 'Afecta a más virus alrededor.', kinds: ['canon', 'hielo', 'misil', 'mortero', 'rayo', 'acido', 'gravedad', 'minas', 'drones'], apply: (s) => { s.splash += 12; } },
  { id: 'execute', title: () => 'Ejecutar +5 %', desc: 'Remata virus casi muertos.', ok: (s) => s.execute < 0.3, apply: (s) => { s.execute += 0.05; }, w: 0.6 },
];

// ── Global (core) upgrades ─────────────────────────────────────────────────
interface GlobalDef {
  id: string;
  title: string;
  desc: string;
  ok?: (g: Game) => boolean;
  apply: (g: Game) => void;
  w?: number;
  rarity?: Rarity;
  /** Can only be taken once. */
  once?: boolean;
  /** Top level: after it, the card stops appearing. */
  max?: number;
  /** What the next level brings (1-based). */
  next?: (lvl: number) => string;
  /** A visible structure around the core. */
  struct?: boolean;
  /** Transformation offered once the structure is at its top level. */
  asc?: { id: string; title: string; desc: string };
}
/** How many times a card id has been taken (its level). */
export const levelOf = (g: Game, id: string) => g.taken.reduce((n, t) => n + (t === id ? 1 : 0), 0);

/**
 * Core upgrades. Every one has levels: each pick changes something you can
 * see or measure, and at the top level the card stops appearing. Structures
 * then offer an «Ascensión» that transforms them.
 */
export const GLOBAL_CARDS: GlobalDef[] = [
  // ── Visible core structures ──
  { id: 'muro', title: 'Muro', struct: true, max: 8, rarity: 'epica',
    desc: 'Un muro alrededor de la defensa que frena a los virus y se reconstruye cada oleada.',
    next: (l) => ['Se levanta el muro', 'Muro más grueso: +60 de aguante', 'Se repara solo durante la oleada', '+60 de aguante · placas de acero', 'Empuja a los virus que lo golpean', '+80 de aguante · doble muralla', 'Placas doradas: devuelve daño', 'Muralla máxima: +120 de aguante'][l - 1],
    apply: (g) => { g.g.wallMax = wallHp(levelOf(g, 'muro') + 1); g.g.wall = g.g.wallMax; },
    asc: { id: 'asc-muro', title: 'Ciudadela', desc: 'El muro ya no cae del todo: se reconstruye a la mitad en unos segundos y sus placas brillan.' } },
  { id: 'espinas', title: 'Espinas', struct: true, max: 8, rarity: 'epica',
    desc: 'Pinchos en el anillo exterior que dañan a todo virus que los toca.',
    next: (l) => ['Aparecen los pinchos', 'Más pinchos y más largos', 'Los pinchos frenan un 25 %', 'Pinchos de acero: +daño', 'Pinchos venenosos: queman', 'Doble fila de pinchos', 'Pinchos carmesí: +daño', 'Pinchos gigantes'][l - 1],
    apply: (g) => { g.g.thorns = levelOf(g, 'espinas') + 1; },
    asc: { id: 'asc-espinas', title: 'Erizo', desc: 'Cada poco tiempo el anillo dispara una corona de pinchos hacia fuera.' } },
  { id: 'orbitales', title: 'Cuchillas orbitales', struct: true, max: 8, rarity: 'epica',
    desc: 'Cuchillas gigantes girando alrededor de toda la defensa.',
    next: (l) => ['3 cuchillas en órbita', '+1 cuchilla y más grandes', '+1 cuchilla · más rápidas', 'Segundo anillo en sentido contrario', '+1 cuchilla en cada anillo', 'Cuchillas al rojo: queman', '+1 cuchilla · más daño', 'Tormenta de acero'][l - 1],
    apply: (g) => { g.g.orbit = levelOf(g, 'orbitales') + 1; },
    asc: { id: 'asc-orbitales', title: 'Anillo de Saturno', desc: 'El doble de cuchillas, enormes y brillantes.' } },
  { id: 'faro', title: 'Faro láser', struct: true, max: 6, rarity: 'epica',
    desc: 'Un rayo que gira desde el núcleo barriendo la pantalla.',
    next: (l) => ['Se enciende el faro', 'Haz más ancho y fuerte', 'Segundo haz', 'Gira más rápido y quema', 'Tercer haz', 'Cuatro haces al blanco'][l - 1],
    apply: (g) => { g.g.faro = levelOf(g, 'faro') + 1; },
    asc: { id: 'asc-faro', title: 'Sol', desc: 'Seis haces que giran y frenan todo lo que tocan.' } },
  { id: 'minas-nucleo', title: 'Sembrador', struct: true, max: 6, rarity: 'epica',
    desc: 'El núcleo siembra minas alrededor durante cada oleada.',
    next: (l) => ['1 mina cada pocos segundos', '2 minas por siembra', 'Minas más potentes', 'Siembra más a menudo', '3 minas por siembra', 'Minas de racimo'][l - 1],
    apply: (g) => { g.g.coreMines = levelOf(g, 'minas-nucleo') + 1; },
    asc: { id: 'asc-minas', title: 'Campo minado', desc: 'El suelo se llena de minas: siembra el doble y explotan en cadena.' } },
  { id: 'arco-nucleo', title: 'Arco eléctrico', struct: true, max: 6, rarity: 'epica',
    desc: 'El núcleo lanza rayos a los virus más cercanos.',
    next: (l) => ['2 rayos a la vez', '3 rayos', 'Cada rayo salta a otro virus', '4 rayos · más rápidos', '5 rayos · más daño', '6 rayos que saltan dos veces'][l - 1],
    apply: (g) => { g.g.arc = levelOf(g, 'arco-nucleo') + 1; },
    asc: { id: 'asc-arco', title: 'Tormenta', desc: 'Rayos contra todos los virus cercanos a la vez.' } },
  { id: 'pulso-nucleo', title: 'Latido del núcleo', struct: true, max: 6, rarity: 'epica',
    desc: 'Una onda automática que daña y aparta a los virus.',
    next: (l) => ['Primer latido', 'Onda más grande', 'Late más a menudo', 'La onda frena un 40 %', 'Onda más fuerte y grande', 'Latido continuo'][l - 1],
    apply: (g) => { g.g.corePulse = levelOf(g, 'pulso-nucleo') + 1; },
    asc: { id: 'asc-pulso', title: 'Supernova', desc: 'Una onda enorme que congela a todos los virus que toca.' } },
  { id: 'satelite', title: 'Satélite', struct: true, max: 6, rarity: 'epica',
    desc: 'Satélites que orbitan el núcleo y disparan.',
    next: (l) => ['Un satélite', '+1 cañón', 'Segundo satélite', '+1 cañón · más rápido', 'Tercer satélite', 'Satélites pesados'][l - 1],
    apply: (g) => { g.g.turret = levelOf(g, 'satelite') + 1; },
    asc: { id: 'asc-satelite', title: 'Constelación', desc: 'El doble de satélites con disparos teledirigidos.' } },
  { id: 'aura', title: 'Aura de daño', struct: true, max: 6, rarity: 'rara',
    desc: 'Un aura alrededor del núcleo que daña sin parar.',
    next: (l) => ['Aparece el aura', 'Aura más grande', 'Más daño', 'Aura más grande', 'Más daño', 'Aura máxima'][l - 1],
    apply: (g) => { g.g.aura = levelOf(g, 'aura') + 1; } },
  // ── Core ──
  { id: 'blindaje', title: 'Blindaje', max: 8, next: () => '+20 de integridad máxima y repara 20', desc: '', apply: (g) => { g.maxHp += 20; g.hp = Math.min(g.maxHp, g.hp + 20); } },
  { id: 'reparacion', title: 'Autorreparación', max: 6, next: () => '+0,6 de reparación por segundo', desc: '', apply: (g) => { g.g.regen += 0.6; } },
  { id: 'escudo', title: 'Escudo del núcleo', max: 5, next: () => '+1 escudo que bloquea un golpe', desc: 'Se recarga cada 12 s.', apply: (g) => { g.g.shieldMax += 1; g.g.shield += 1; } },
  { id: 'sobreescudo', title: 'Recarga de escudo', max: 4, next: () => 'El escudo se recarga un 25 % antes', desc: '', ok: (g) => g.g.shieldMax > 0, apply: (g) => { g.g.shieldCd *= 0.75; } },
  { id: 'frenado', title: 'Campo de frenado', max: 3, next: () => 'Virus cerca del núcleo un 20 % más lentos', desc: '', apply: (g) => { g.g.brake += 0.2; } },
  { id: 'nova-emergencia', title: 'Nova de emergencia', max: 3, next: () => 'Si te golpean, el núcleo lanza una onda (más a menudo)', desc: '', apply: (g) => { g.g.nova += 1; } },
  { id: 'copia', title: 'Copia de seguridad', max: 1, next: () => 'Una vez por partida, al caer recuperas el 50 %', desc: '', apply: (g) => { g.g.backup = 1; }, w: 0.6 },
  // ── Whole defence ──
  { id: 'potencia', title: 'Potencia global', max: 10, next: () => 'Todos los defensores +12 % de daño', desc: '', apply: (g) => { g.g.dmgMul *= 1.12; }, w: 1.3 },
  { id: 'overclock', title: 'Overclock', max: 10, next: () => 'Todos los defensores +10 % de cadencia', desc: '', apply: (g) => { g.g.rateMul *= 1.1; }, w: 1.3 },
  { id: 'optica', title: 'Óptica', max: 5, next: () => 'Todos los defensores +10 % de alcance', desc: '', apply: (g) => { g.g.rangeMul *= 1.1; } },
  { id: 'suerte', title: 'Suerte', max: 8, next: () => 'Todos +5 % de crítico', desc: '', apply: (g) => { g.g.critAdd += 0.05; } },
  { id: 'purga', title: 'Protocolo de purga', max: 3, next: () => 'Todos rematan virus por debajo de un 6 % más', desc: '', apply: (g) => { g.g.execute += 0.06; } },
  { id: 'cazajefes', title: 'Antivirus de élite', max: 5, next: () => '+30 % de daño a jefes y élites', desc: '', apply: (g) => { g.g.bossMul *= 1.3; } },
  { id: 'primer-golpe', title: 'Primer impacto', max: 4, next: () => '+40 % de daño a virus intactos', desc: '', apply: (g) => { g.g.firstHit += 0.4; } },
  { id: 'reaccion', title: 'Reacción en cadena', max: 5, next: () => 'Los virus explotan al morir (más fuerte)', desc: '', apply: (g) => { g.g.chainReaction += 0.2; } },
  { id: 'criogenia', title: 'Criogenia', max: 5, next: () => 'Todos los golpes frenan un 8 % más', desc: '', apply: (g) => { g.g.hitSlow += 0.08; } },
  { id: 'incendio', title: 'Incendio', max: 6, next: () => 'Todos los golpes queman 2/s más', desc: '', apply: (g) => { g.g.hitBurn += 2; } },
  // ── Rewards and choices ──
  { id: 'aprendizaje', title: 'Aprendizaje', max: 6, next: () => '+20 % de experiencia', desc: '', apply: (g) => { g.g.xpMul *= 1.2; } },
  { id: 'botin', title: 'Botín', max: 5, next: () => '+25 % de energía para tu chip al acabar', desc: '', apply: (g) => { g.g.energyMul += 0.25; }, w: 0.7 },
  { id: 'recalcular', title: 'Recalcular', max: 5, next: () => '+2 cambios de cartas', desc: '', apply: (g) => { g.g.rerolls += 2; }, w: 0.6 },
  { id: 'eleccion', title: 'Más opciones', max: 1, next: () => 'A partir de ahora eliges entre 4 cartas', desc: '', ok: (g) => g.g.choices < 4, apply: (g) => { g.g.choices = 4; }, w: 0.5 },
];
export const wallHp = (lvl: number) => (lvl <= 0 ? 0 : 60 + 60 * lvl + (lvl >= 6 ? 20 : 0) + (lvl >= 8 ? 60 : 0));

// ── Pacts: power with a price ──────────────────────────────────────────────
export const PACT_CARDS: GlobalDef[] = [
  { id: 'pacto-poder', title: 'Pacto de poder', desc: '+35 % de daño · los virus +30 % de vida.', apply: (g) => { g.g.dmgMul *= 1.35; g.g.enemyHp *= 1.3; } },
  { id: 'pacto-veloz', title: 'Pacto veloz', desc: '+30 % de cadencia · los virus +20 % de velocidad.', ok: (g) => g.g.enemySpeed < 1.8, apply: (g) => { g.g.rateMul *= 1.3; g.g.enemySpeed *= 1.2; } },
  { id: 'pacto-codicia', title: 'Codicia', desc: '+60 % de experiencia · +1 jefe por oleada de jefe.', apply: (g) => { g.g.xpMul *= 1.6; g.g.extraBoss += 1; } },
  { id: 'pacto-cristal', title: 'Núcleo de cristal', desc: '+50 % de daño · integridad máxima −30.', ok: (g) => g.maxHp > 50, apply: (g) => { g.g.dmgMul *= 1.5; g.maxHp -= 30; g.hp = Math.min(g.hp, g.maxHp); } },
  { id: 'pacto-horda', title: 'Horda', desc: '+30 % de experiencia y +50 % de energía · 40 % más virus.', apply: (g) => { g.g.xpMul *= 1.3; g.g.energyMul += 0.5; g.g.horde *= 1.4; } },
  { id: 'pacto-riesgo', title: 'Todo o nada', desc: 'Crítico +20 % y daño crítico ×2 · integridad −25.', ok: (g) => g.maxHp > 45, apply: (g) => { g.g.critAdd += 0.2; g.defenders.forEach((d) => { d.stats.critMult *= 2; if (d.fuse) d.fuse.stats.critMult *= 2; }); g.maxHp -= 25; g.hp = Math.min(g.hp, g.maxHp); } },
  { id: 'pacto-jefe', title: 'Llamar al jefe', desc: 'La próxima oleada trae un jefe · al vencerlo, 2 mejoras extra.', ok: (g) => !g.g.bossNext, apply: (g) => { g.g.bossNext = 1; g.g.bossBounty += 2; } },
  { id: 'pacto-sacrificio', title: 'Sacrificio', desc: 'Pierdes tu defensor más débil · los demás +40 % de daño.', ok: (g) => g.defenders.length >= 3, apply: (g) => {
    const weakest = [...g.defenders].sort((a, b) => a.lvl + a.evo.length * 3 - (b.lvl + b.evo.length * 3))[0];
    g.defenders = g.defenders.filter((d) => d !== weakest);
    g.defenders.forEach((d) => { d.stats.dmg *= 1.4; if (d.fuse) d.fuse.stats.dmg *= 1.4; });
    refreshSynergies(g);
  } },
  { id: 'pacto-prisa', title: 'Hora punta', desc: '+40 % de experiencia · las oleadas llegan más rápido.', ok: (g) => g.g.waveSpeed < 2, apply: (g) => { g.g.xpMul *= 1.4; g.g.waveSpeed *= 1.3; } },
  { id: 'pacto-elite', title: 'Élites', desc: 'Aparecen virus élite (vida ×3) que dan el triple de experiencia.', ok: (g) => g.g.eliteChance < 0.4, apply: (g) => { g.g.eliteChance += 0.12; } },
];

/** Distinct upgrades in the game (fusions counted once per pair of types). */
export const FUSION_PAIRS = (DEF_KINDS.length * (DEF_KINDS.length - 1)) / 2;
export const CATALOGUE_SIZE = CHIPS.length * (1 + CHIP_SLOTS) + DEF_KINDS.length + STAT_CARDS.length + GLOBAL_CARDS.length + GLOBAL_CARDS.filter((c) => c.asc).length + PACT_CARDS.length + EVOS.length + FUSION_PAIRS;

export const kindsOf = (d: Defender): DefKind[] => (d.fuse ? [d.kind, d.fuse.kind] : [d.kind]);
const owned = (g: Game) => new Set(g.defenders.flatMap(kindsOf));

/** Main-ring defenders always come first in the list, extra-chip ones after. */
export const mainRing = (g: Game) => g.defenders.filter((d) => !d.chip);

export function addDefender(g: Game, kind: DefKind, at?: number): Defender {
  const d = makeDefender(g.nextId++, kind);
  const mains = mainRing(g).length;
  if (d.chip) g.defenders.push(d);
  else g.defenders.splice(at === undefined || at < 0 || at > mains ? mains : at, 0, d);
  refreshSynergies(g);
  return d;
}

/** Where a new defender can go on the ring: between two neighbours. Sorted by what it would power up. */
export interface Placement {
  at: number;
  left: Defender;
  right: Defender;
  syn: string[];
}
export function placements(g: Game, kind: DefKind): Placement[] {
  if (chipOfKind(kind)) return [];
  const ring = mainRing(g);
  const n = ring.length;
  if (n < 3) return [];
  const out: Placement[] = [];
  for (let i = 0; i < n; i++) {
    const left = ring[i];
    const right = ring[(i + 1) % n];
    const syn = SYNERGIES.filter((sy) => [left, right].some((d) => kindsOf(d).some((k) => (sy.a === kind && sy.b === k) || (sy.b === kind && sy.a === k)))).map((sy) => sy.name);
    out.push({ at: i + 1, left, right, syn: [...new Set(syn)] });
  }
  out.sort((a, b) => b.syn.length - a.syn.length);
  return out.slice(0, 4);
}

/** Recomputes which synergies are active; new ones raise an event for the banner. */
export function refreshSynergies(g: Game) {
  const have = owned(g);
  const now = SYNERGIES.filter((s) => have.has(s.a) && have.has(s.b)).map((s) => s.id);
  for (const id of now) if (!g.syn.includes(id)) g.events.push(`syn:${id}`);
  g.syn = now;
  // Neighbours on the ring (or both halves of one fusion) make a synergy stronger.
  const ring = mainRing(g);
  const n = ring.length;
  const adj = (a: DefKind, b: DefKind) =>
    ring.some((d, i) => {
      const ks = kindsOf(d);
      if (ks.includes(a) && ks.includes(b)) return true;
      if (!ks.includes(a) || n < 2) return false;
      return [ring[(i + 1) % n], ring[(i - 1 + n) % n]].some((o) => o !== d && kindsOf(o).includes(b));
    });
  g.synAdj = SYNERGIES.filter((s) => now.includes(s.id) && adj(s.a, s.b)).map((s) => s.id);
}

/** Each upgrade makes the invasion a bit tougher: «más mejoras, más vida». */
function threaten(g: Game) {
  g.g.enemyHp *= 1.02;
}

function newDefenderCard(g: Game, kind: DefKind): Card {
  const info = DEF_INFO[kind];
  const syn = SYNERGIES.filter((s) => (s.a === kind && owned(g).has(s.b)) || (s.b === kind && owned(g).has(s.a)));
  return {
    key: `new-${kind}`, id: `new-${kind}`, kind: 'new', rarity: 'rara', title: info.name,
    desc: info.desc + (syn.length ? ` Sinergia: ${syn.map((x) => x.name).join(', ')}.` : ''),
    tag: info.chip ? `Chip ${CHIPS[chipOfKind(kind) - 1].name} · defensor ${g.defenders.filter((x) => x.chip === chipOfKind(kind)).length + 1}/${CHIP_SLOTS}` : `Nuevo defensor · ${mainRing(g).length + 1}/${MAX_DEFENDERS}`, color: info.color,
    apply: (gg, at) => { addDefender(gg, kind, at); gg.g.horde *= 1.06; threaten(gg); },
  };
}
const availableKinds = (g: Game) => g.unlocked.filter((k) => !owned(g).has(k));

function fusionCard(a: Defender, b: Defender): Card {
  const name = fusionName(a.kind, b.kind);
  return {
    key: `fus-${a.id}-${b.id}`, id: `fusion-${[a.kind, b.kind].sort().join('+')}`, kind: 'fusion', rarity: 'legendaria', target: a.id, title: name,
    desc: `Fusiona ${defenderName(a)} y ${defenderName(b)}: un solo defensor que hace lo de los dos, ×1,5 más fuerte. Libera un hueco.`,
    tag: 'Fusión legendaria', color: DEF_INFO[a.kind].color, color2: DEF_INFO[b.kind].color,
    apply: (gg) => {
      const A = gg.defenders.find((x) => x.id === a.id);
      const B = gg.defenders.find((x) => x.id === b.id);
      if (!A || !B) return;
      A.stats.dmg *= 1.5;
      const bs = { ...B.stats, dmg: B.stats.dmg * 1.5 };
      A.fuse = { kind: B.kind, stats: bs, flags: { ...B.flags }, evo: [...B.evo], cd: 0.2, spin: 0, pending: 0, lockId: -1, lockT: 0, aim: 0 };
      A.kills += B.kills;
      A.lvl = Math.max(A.lvl, B.lvl);
      gg.defenders = gg.defenders.filter((x) => x !== B);
      refreshSynergies(gg);
      gg.events.push('fusion');
      threaten(gg);
    },
  };
}

/** Is the next chip ready to be unlocked? */
export function chipReady(g: Game): boolean {
  if (g.chips >= MAX_CHIPS) return false;
  if (g.chips === 1) {
    const ring = mainRing(g);
    const kinds = new Set(ring.flatMap(kindsOf)).size;
    const evolutions = ring.reduce((a, d) => a + (d.fuse ? 4 : d.evo.length), 0);
    return kinds >= Math.min(7, g.unlocked.length) && evolutions >= 6 && g.level >= 30;
  }
  const crew = g.defenders.filter((d) => d.chip === g.chips - 1);
  return crew.length >= 2 && g.level >= 30 + 14 * (g.chips - 1);
}
function chipCard(g: Game): Card {
  const ch = CHIPS[g.chips - 1];
  const nth = ['Segundo', 'Tercer', 'Cuarto', 'Quinto'][g.chips - 1];
  return {
    key: `chip-${ch.id}`, id: `chip-${ch.id}`, kind: 'chip', rarity: 'legendaria', title: `${nth} chip: ${ch.name}`,
    desc: `${ch.ability} Trae sus propios defensores, distintos a todos los demás.`, tag: `Nuevo chip · ${g.chips + 1}/${MAX_CHIPS}`, color: ch.color,
    apply: (gg) => {
      gg.chips += 1;
      addDefender(gg, ch.kinds[0]);
      gg.events.push('chip');
      threaten(gg);
    },
  };
}
/** Exclusive defenders still missing on the extra chips. */
function chipKindsAvailable(g: Game): DefKind[] {
  const out: DefKind[] = [];
  for (let k = 1; k < g.chips; k++) {
    const crew = g.defenders.filter((d) => d.chip === k);
    if (crew.length >= CHIP_SLOTS) continue;
    out.push(...CHIPS[k - 1].kinds.filter((x) => !crew.some((d) => d.kind === x)));
  }
  return out;
}

function cardFor(g: Game, rnd: () => number): Card | null {
  const n = mainRing(g).length;
  const r = rnd();
  const extra = chipKindsAvailable(g);
  if (extra.length && rnd() < 0.3) return newDefenderCard(g, extra[Math.floor(rnd() * extra.length)]);
  const kinds = availableKinds(g);
  // New defenders: guaranteed early, rarer later. Never the same type twice.
  const newW = n >= MAX_DEFENDERS || !kinds.length ? 0 : n < 3 ? 0.35 : n < 6 ? 0.18 : 0.1;
  if (r < newW) return newDefenderCard(g, kinds[Math.floor(rnd() * kinds.length)]);
  if (r < newW + 0.1) {
    const pool = PACT_CARDS.filter((p) => (!p.ok || p.ok(g)) && !(p.once && g.taken.includes(p.id)));
    const p = pool[Math.floor(rnd() * pool.length)];
    if (!p) return null;
    return { key: p.id, id: p.id, kind: 'pact', rarity: 'epica', title: p.title, desc: p.desc, tag: 'Pacto', color: '#ff3b3b', apply: (gg) => { p.apply(gg); threaten(gg); } };
  }
  if (r < newW + 0.1 + 0.32) {
    // Ascensions: a structure at its top level can transform once.
    const asc = GLOBAL_CARDS.filter((c) => c.asc && c.max && levelOf(g, c.id) >= c.max && !g.g.asc.includes(c.asc.id));
    if (asc.length && rnd() < 0.5) {
      const c = asc[Math.floor(rnd() * asc.length)];
      const a = c.asc!;
      return { key: a.id, id: a.id, kind: 'asc', rarity: 'legendaria', title: a.title, desc: a.desc, tag: `Ascensión · ${c.title}`, color: '#ffd60a', apply: (gg) => { gg.g.asc.push(a.id); threaten(gg); } };
    }
    const pool = GLOBAL_CARDS.filter((c) => (!c.ok || c.ok(g)) && levelOf(g, c.id) < (c.max ?? 99) && !(c.once && g.taken.includes(c.id)));
    const total = pool.reduce((a, c) => a + (c.w ?? 1), 0);
    let x = rnd() * total;
    const c = pool.find((cc) => (x -= cc.w ?? 1) <= 0) ?? pool[0];
    if (!c) return null;
    const rarity = c.rarity ?? 'rara';
    const lvl = levelOf(g, c.id) + 1;
    const step = c.next ? c.next(lvl) : '';
    const desc = lvl === 1 && c.desc ? `${c.desc} ${step}.` : `${step}.`;
    return {
      key: c.id, id: c.id, kind: 'global', rarity, title: c.title, desc,
      tag: `${c.struct ? 'Estructura' : 'Núcleo'} · nivel ${lvl}/${c.max ?? '∞'}`, color: c.struct ? '#c8ff2e' : '#e8f6ff',
      apply: (gg) => { c.apply(gg); threaten(gg); },
    };
  }
  // Stat upgrade on one defender (a fusion upgrades both halves).
  if (!n) return null;
  const d = g.defenders[Math.floor(rnd() * n)];
  const pool = STAT_CARDS.filter((s) => (!s.kinds || s.kinds.includes(behOf(d.kind))) && (!s.ok || s.ok(d.stats)));
  const total = pool.reduce((a, c) => a + (c.w ?? 1), 0);
  let x = rnd() * total;
  const s = pool.find((c) => (x -= c.w ?? 1) <= 0) ?? pool[0];
  return {
    key: `${s.id}-${d.id}`, id: `stat-${s.id}`, kind: 'stat', target: d.id, rarity: 'comun', title: s.title(d), desc: s.desc, tag: `${defenderName(d)} · nv ${d.lvl + 1}`, color: DEF_INFO[d.kind].color,
    color2: d.fuse ? DEF_INFO[d.fuse.kind].color : undefined,
    apply: (gg) => {
      const dd = gg.defenders.find((x2) => x2.id === d.id);
      if (!dd) return;
      s.apply(dd.stats);
      if (dd.fuse) s.apply(dd.fuse.stats);
      dd.lvl += 1;
      threaten(gg);
    },
  };
}

/** Pairs of fully evolved defenders that can be fused. */
export function fusablePairs(g: Game): [Defender, Defender][] {
  const ready = g.defenders.filter((d) => !d.fuse && d.evo.length === 2);
  const out: [Defender, Defender][] = [];
  for (let i = 0; i < ready.length; i++) for (let j = i + 1; j < ready.length; j++) out.push([ready[i], ready[j]]);
  return out;
}

/** The cards offered at a level-up. An evolution, when ready, is a choice between its two paths. */
export function offer(g: Game, rnd: () => number): Card[] {
  for (const d of g.defenders) {
    const opts = evoOptions(d);
    if (opts.length) {
      return opts.map((e) => ({
        key: e.id, id: e.id, kind: 'evo', rarity: 'epica', target: d.id, title: e.name, desc: e.desc, tag: `Evoluciona ${defenderName(d)}`, color: DEF_INFO[d.kind].color,
        apply: (gg) => {
          const dd = gg.defenders.find((x) => x.id === d.id);
          if (!dd) return;
          e.apply(dd.stats, dd.flags);
          dd.evo.push(e.id);
          dd.name = e.name;
          gg.events.push('evo');
          threaten(gg);
        },
      }));
    }
  }
  const out: Card[] = [];
  const want = g.g.choices;
  if (chipReady(g) && rnd() < 0.6) out.push(chipCard(g));
  const pairs = fusablePairs(g);
  if (pairs.length && rnd() < 0.55) {
    const [a, b] = pairs[Math.floor(rnd() * pairs.length)];
    out.push(fusionCard(a, b));
  }
  for (let tries = 0; out.length < want && tries < 60; tries++) {
    const c = cardFor(g, rnd);
    if (c && !out.some((o) => o.key === c.key)) out.push(c);
  }
  // Early on, always offer a new defender.
  const kinds = availableKinds(g);
  if (mainRing(g).length < 3 && kinds.length && !out.some((c) => c.kind === 'new')) out[out.length - 1] = newDefenderCard(g, kinds[Math.floor(rnd() * kinds.length)]);
  return out;
}

export function choose(g: Game, c: Card, at?: number) {
  if (c.kind === 'new' && at === undefined) at = placements(g, c.id.slice(4) as DefKind)[0]?.at;
  c.apply(g, at);
  g.taken.push(c.id);
  g.pending = Math.max(0, g.pending - 1);
  // Every pick shows up where it happened: a flash and its name.
  const d = c.kind === 'new' ? g.defenders.find((x) => x.id === g.nextId - 1) : g.defenders.find((x) => x.id === c.target);
  const gl = GLOBAL_CARDS.find((x) => x.id === c.id);
  const [x, y] = d ? [d.x, d.y] : gl?.struct ? [0, -(c.id === 'aura' ? 70 : 104)] : [0, 0];
  const big = c.kind === 'evo' || c.kind === 'fusion' || c.kind === 'asc' || c.kind === 'chip';
  g.fx.push({ k: 'ring', x, y, r0: 6, r1: big ? 90 : 44, life: big ? 0.8 : 0.5, max: big ? 0.8 : 0.5, c: c.color, w: big ? 5 : 3 });
  g.fx.push({ k: 'flash', x, y, r: big ? 50 : 24, life: 0.3, max: 0.3, c: c.color });
  g.fx.push({ k: 'txt', x, y: y - 18, s: c.title, life: 1.4, max: 1.4, c: c.color });
  for (let k = 0; k < (big ? 24 : 10); k++) {
    const a = (k / (big ? 24 : 10)) * Math.PI * 2;
    const sp = big ? 160 : 100;
    g.fx.push({ k: 'p', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6, max: 0.6, c: c.color, s: 2.4 });
  }
}
