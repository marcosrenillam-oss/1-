import { behOf, chipPos, CHIP_MAX_LVL, CHIP_SLOTS, chipSlots, CHIPS, chipOfKind, isMainChip, outpostsOf, DEF_EL, DEF_INFO, DEF_KINDS, defenderName, ELEMENTS, EVOS, evoOptions, fusionName, makeDefender, MAX_CHIPS, SYNERGIES, ULTS } from './defenders';
import type { DefKind, Defender, Game, Stats } from './types';

export const MAX_DEFENDERS = 10;

export type CardKind = 'new' | 'stat' | 'global' | 'pact' | 'evo' | 'fusion' | 'asc' | 'chip' | 'chipup' | 'coreevo' | 'chipevo';
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
  { id: 'reaccion', title: 'Reacción en cadena', max: 5, next: () => 'Los virus explotan al morir (más fuerte)', desc: '', apply: (g) => { g.g.chainReaction += 0.07; } },
  { id: 'criogenia', title: 'Criogenia', max: 5, next: () => 'Todos los golpes frenan un 8 % más', desc: '', apply: (g) => { g.g.hitSlow += 0.08; } },
  { id: 'incendio', title: 'Incendio', max: 6, next: () => 'Todos los golpes queman 2/s más', desc: '', apply: (g) => { g.g.hitBurn += 2; } },
  // ── Rewards and choices ──
  { id: 'aprendizaje', title: 'Aprendizaje', max: 6, next: () => '+20 % de experiencia', desc: '', apply: (g) => { g.g.xpMul += 0.2; } },
  { id: 'botin', title: 'Botín', max: 5, next: () => '+25 % de energía para tu chip al acabar', desc: '', apply: (g) => { g.g.energyMul += 0.25; }, w: 0.7 },
  { id: 'recalcular', title: 'Recalcular', max: 5, next: () => '+2 cambios de cartas', desc: '', apply: (g) => { g.g.rerolls += 2; }, w: 0.6 },
  { id: 'eleccion', title: 'Más opciones', max: 1, next: () => 'A partir de ahora eliges entre 4 cartas', desc: '', ok: (g) => g.g.choices < 4, apply: (g) => { g.g.choices = 4; }, w: 0.5 },
];
export const wallHp = (lvl: number) => (lvl <= 0 ? 0 : 60 + 60 * lvl + (lvl >= 6 ? 20 : 0) + (lvl >= 8 ? 60 : 0));

// ── Pacts: power with a price. One is offered at the end of every wave,
// apart from the level-up cards. They can repeat and they stack: two «Codicia»
// are +120 % de experiencia.
const hpCost = (g: Game, n: number) => {
  g.maxHp -= n;
  g.hp = Math.min(g.hp, g.maxHp);
};
export const PACT_CARDS: GlobalDef[] = [
  { id: 'pacto-poder', title: 'Pacto de poder', desc: '+25 % de daño · los virus +20 % de vida.', apply: (g) => { g.g.dmgMul += 0.25; g.g.enemyHp *= 1.2; } },
  { id: 'pacto-veloz', title: 'Pacto veloz', desc: '+20 % de cadencia · los virus +12 % de velocidad.', ok: (g) => g.g.enemySpeed < 1.8, apply: (g) => { g.g.rateMul += 0.2; g.g.enemySpeed *= 1.12; } },
  { id: 'pacto-codicia', title: 'Codicia', desc: '+60 % de experiencia · +1 jefe en cada oleada de jefe.', ok: (g) => g.g.extraBoss < 4, apply: (g) => { g.g.xpMul += 0.6; g.g.extraBoss += 1; } },
  { id: 'pacto-cristal', title: 'Núcleo de cristal', desc: '+40 % de daño · integridad máxima −20.', ok: (g) => g.maxHp > 60, apply: (g) => { g.g.dmgMul += 0.4; hpCost(g, 20); } },
  { id: 'pacto-horda', title: 'Horda', desc: '+40 % de experiencia y +50 % de energía · 25 % más virus.', ok: (g) => g.g.horde < 3, apply: (g) => { g.g.xpMul += 0.4; g.g.energyMul = Math.min(3, g.g.energyMul + 0.5); g.g.horde *= 1.25; } },
  { id: 'pacto-riesgo', title: 'Todo o nada', desc: 'Crítico +10 % y daño crítico ×1,5 · integridad −15.', ok: (g) => g.maxHp > 60, apply: (g) => { g.g.critAdd += 0.1; g.defenders.forEach((d) => { d.stats.critMult *= 1.5; if (d.fuse) d.fuse.stats.critMult *= 1.5; }); hpCost(g, 15); } },
  { id: 'pacto-jefe', title: 'Llamar al jefe', desc: 'La próxima oleada trae un jefe · al vencerlo, 2 mejoras extra.', ok: (g) => !g.g.bossNext, apply: (g) => { g.g.bossNext = 1; g.g.bossBounty += 2; } },
  { id: 'pacto-sacrificio', title: 'Sacrificio', desc: 'Pierdes tu defensor más débil del anillo · los demás +40 % de daño.', ok: (g) => mainRing(g).length >= 5, apply: (g) => {
    const weakest = [...mainRing(g)].sort((a, b) => a.lvl + a.evo.length * 3 - (b.lvl + b.evo.length * 3))[0];
    g.defenders = g.defenders.filter((d) => d !== weakest);
    g.defenders.forEach((d) => { d.stats.dmg *= 1.4; if (d.fuse) d.fuse.stats.dmg *= 1.4; });
    refreshSynergies(g);
  } },
  { id: 'pacto-prisa', title: 'Hora punta', desc: '+40 % de experiencia · las oleadas llegan más rápido.', ok: (g) => g.g.waveSpeed < 2, apply: (g) => { g.g.xpMul += 0.4; g.g.waveSpeed *= 1.15; } },
  { id: 'pacto-elite', title: 'Élites', desc: '+20 % de experiencia · más virus élite (vida ×3, experiencia ×3).', ok: (g) => g.g.eliteChance < 0.5, apply: (g) => { g.g.xpMul += 0.2; g.g.eliteChance += 0.1; } },
  { id: 'pacto-avaricia', title: 'Avaricia', desc: '+35 % de energía y datos al terminar · los virus +15 % de vida.', ok: (g) => (g.g.lootMul ?? 1) < 2.4, apply: (g) => { g.g.lootMul = (g.g.lootMul ?? 1) + 0.35; g.g.enemyHp *= 1.15; } },
  { id: 'pacto-ofrenda', title: 'Ofrenda', desc: '+2 mejoras ahora mismo · los virus +25 % de vida.', apply: (g) => { g.pending += 2; g.g.enemyHp *= 1.25; } },
  { id: 'pacto-estudio', title: 'Estudio', desc: '+30 % de experiencia · −8 % de daño.', apply: (g) => { g.g.xpMul += 0.3; g.g.dmgMul = Math.max(0.5, g.g.dmgMul - 0.08); } },
  { id: 'pacto-escudo', title: 'Escudo prestado', desc: '+1 escudo máximo · los virus +10 % de velocidad.', ok: (g) => g.g.enemySpeed < 1.8 && g.g.shieldMax < 6, apply: (g) => { g.g.shieldMax += 1; g.g.shield += 1; g.g.enemySpeed *= 1.1; } },
  { id: 'pacto-vista', title: 'Ojo de halcón', desc: '+15 % de alcance · los virus +15 % de vida.', ok: (g) => g.g.rangeMul < 2, apply: (g) => { g.g.rangeMul += 0.15; g.g.enemyHp *= 1.15; } },
  { id: 'pacto-sangre', title: 'Pacto de sangre', desc: 'El núcleo se repara +1/s · integridad máxima −10.', ok: (g) => g.maxHp > 60, apply: (g) => { g.g.regen += 1; hpCost(g, 10); } },
];
export const pactCount = (g: Game) => g.taken.filter((t) => t.startsWith('pacto-')).length;

/** Three different pacts to choose from at the end of a wave. */
export function offerPacts(g: Game, rnd: () => number): Card[] {
  const pool = PACT_CARDS.filter((p) => !p.ok || p.ok(g));
  const out: Card[] = [];
  while (out.length < 3 && pool.length) {
    const p = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    const n = levelOf(g, p.id);
    out.push({ key: p.id, id: p.id, kind: 'pact', rarity: 'epica', title: p.title, desc: p.desc, tag: n ? `Pacto · ya tienes ${n}` : 'Pacto', color: '#ff3b3b', apply: (gg) => p.apply(gg) });
  }
  return out;
}
export function choosePact(g: Game, c: Card) {
  c.apply(g);
  g.taken.push(c.id);
  g.pact = false;
  g.events.push('pact');
  g.fx.push({ k: 'ring', x: 0, y: 0, r0: 10, r1: 120, life: 0.7, max: 0.7, c: '#ff3b3b', w: 4 });
  g.fx.push({ k: 'txt', x: 0, y: -40, s: c.title, life: 1.4, max: 1.4, c: '#ff5a5a' });
}

/** Distinct upgrades in the game (fusions counted once per pair of types). */
export const FUSION_PAIRS = (DEF_KINDS.length * (DEF_KINDS.length - 1)) / 2;
export const CATALOGUE_SIZE = CHIPS.reduce((a, c) => a + 1 + c.kinds.length + (c.form ? 1 : 0), 0) + 3 + DEF_KINDS.length + STAT_CARDS.length + GLOBAL_CARDS.length + GLOBAL_CARDS.filter((c) => c.asc).length + PACT_CARDS.length + EVOS.length + FUSION_PAIRS;

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
  g.g.enemyHp *= 1.03;
}

function newDefenderCard(g: Game, kind: DefKind): Card {
  const info = DEF_INFO[kind];
  const syn = SYNERGIES.filter((s) => (s.a === kind && owned(g).has(s.b)) || (s.b === kind && owned(g).has(s.a)));
  return {
    key: `new-${kind}`, id: `new-${kind}`, kind: 'new', rarity: 'rara', title: info.name,
    desc: `${info.desc} Definitivo: ${ULTS[kind].name}.` + (syn.length ? ` Sinergia: ${syn.map((x) => x.name).join(', ')}.` : ''),
    tag: `${ELEMENTS[DEF_EL[kind]].name} · ` + (info.chip ? `Chip ${CHIPS[chipOfKind(kind) - 1].name} · defensor ${g.defenders.filter((x) => x.chip === chipOfKind(kind)).length + 1}/${chipSlots(chipOfKind(kind))}` : `Nuevo defensor · ${mainRing(g).length + 1}/${MAX_DEFENDERS}`), color: info.color,
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

/** An outpost that has been through its joint evolution. */
export const chipEvolved = (g: Game, k: number) => g.taken.includes(`chipevo-${CHIPS[k - 1].id}`);
const crewOf = (g: Game, k: number) => g.defenders.filter((d) => (d.chip ?? 0) === k);

/** Is the next chip ready to be unlocked? */
export function chipReady(g: Game): boolean {
  if (g.chips >= MAX_CHIPS) return false;
  const fast = g.g.chipFast * 4;
  if (g.chips === 1) {
    const ring = mainRing(g);
    const kinds = new Set(ring.flatMap(kindsOf)).size;
    const evolutions = ring.reduce((a, d) => a + (d.fuse ? 4 : d.evo.length), 0);
    return kinds >= Math.min(7, g.unlocked.length) && evolutions >= Math.max(3, 6 - g.g.chipFast) && g.level >= 30 - fast;
  }
  const next = CHIPS[g.chips - 1];
  // A new main core: only once the previous one has evolved.
  if (next.main) return g.g.coreEvo >= next.core && g.level >= (next.core === 1 ? 70 : 140) - fast;
  // An outpost: the chip before it needs a crew.
  const prev = g.chips - 1;
  return crewOf(g, prev).length >= (isMainChip(prev) ? 3 : 2) && g.level >= 30 + 11 * (g.chips - 1) - fast;
}
function chipCard(g: Game): Card {
  const ch = CHIPS[g.chips - 1];
  const core = ['', 'Segundo núcleo', 'Tercer núcleo'][ch.core];
  return {
    key: `chip-${ch.id}`, id: `chip-${ch.id}`, kind: 'chip', rarity: 'legendaria', title: ch.main ? `${core}: ${ch.name}` : `Nuevo chip: ${ch.name}`,
    desc: `${ch.ability} Trae sus propios defensores, distintos a todos los demás.`, tag: `Nuevo chip · ${g.chips + 1}/${MAX_CHIPS}`, color: ch.color,
    apply: (gg) => {
      gg.chips += 1;
      addDefender(gg, ch.kinds[0]);
      gg.events.push('chip');
      threaten(gg);
    },
  };
}
/** An outpost at level 10 with its three defenders: they evolve together. */
function chipEvoCard(g: Game): Card | null {
  for (let k = 1; k < g.chips; k++) {
    const ch = CHIPS[k - 1];
    if (ch.main || !ch.form || chipEvolved(g, k)) continue;
    if (levelOf(g, `chipup-${ch.id}`) < CHIP_MAX_LVL || crewOf(g, k).length < CHIP_SLOTS) continue;
    const form = ch.form;
    return {
      key: `chipevo-${ch.id}`, id: `chipevo-${ch.id}`, kind: 'chipevo', rarity: 'legendaria', title: form.name,
      desc: `Evolución conjunta del chip ${ch.name}: sus tres defensores se funden en uno solo más fuerte (daño ×2, cadencia ×1,3). ${form.desc}`,
      tag: `Chip ${ch.name} · evolución conjunta`, color: ch.color,
      apply: (gg) => {
        for (const d of crewOf(gg, k)) {
          d.stats.dmg *= 2;
          d.stats.rate *= 1.3;
          d.stats.range *= 1.15;
          d.lvl += 2;
        }
        gg.events.push('chipevo');
        gg.slowmo = 1;
      },
    };
  }
  return null;
}
const CORE_EVOS = [
  { title: 'Evolución del núcleo', desc: 'El núcleo central evoluciona: +50 de integridad, se repara solo y todos tus defensores hacen +25 % de daño. Abre la puerta a un segundo núcleo.', apply: (g: Game) => { g.maxHp += 50; g.hp += 50; g.g.regen += 1; g.g.dmgMul *= 1.25; } },
  { title: 'Núcleo binario', desc: 'Los dos núcleos se sincronizan: +100 de integridad, +40 % de daño y cadencia para todos y un escudo extra. Abre la puerta al tercer núcleo.', apply: (g: Game) => { g.maxHp += 100; g.hp += 100; g.g.dmgMul *= 1.4; g.g.rateMul *= 1.4; g.g.shieldMax += 1; g.g.shield += 1; } },
  { title: 'Núcleo trinario', desc: 'Los tres núcleos laten a la vez: +150 de integridad, +60 % de daño, +2 de regeneración y dos escudos más. La forma final.', apply: (g: Game) => { g.maxHp += 150; g.hp += 150; g.g.dmgMul *= 1.6; g.g.regen += 2; g.g.shieldMax += 2; g.g.shield += 2; } },
];
/** A main core evolves when its four outposts have all been through their joint evolution. */
function coreEvoCard(g: Game): Card | null {
  const n = g.g.coreEvo;
  if (n >= CORE_EVOS.length) return null;
  const outs = outpostsOf(n);
  if (outs.some((k) => k >= g.chips || !chipEvolved(g, k))) return null;
  const e = CORE_EVOS[n];
  return {
    key: `coreevo-${n + 1}`, id: `coreevo-${n + 1}`, kind: 'coreevo', rarity: 'legendaria', title: e.title, desc: e.desc,
    tag: `Núcleo · evolución ${n + 1}/${CORE_EVOS.length}`, color: '#ffd60a',
    apply: (gg) => { gg.g.coreEvo = n + 1; e.apply(gg); gg.events.push('coreevo'); gg.slowmo = 1.2; },
  };
}

/** Exclusive defenders still missing on the extra chips. */
function chipKindsAvailable(g: Game): DefKind[] {
  const out: DefKind[] = [];
  for (let k = 1; k < g.chips; k++) {
    const crew = g.defenders.filter((d) => d.chip === k);
    if (crew.length >= chipSlots(k)) continue;
    out.push(...CHIPS[k - 1].kinds.filter((x) => !crew.some((d) => d.kind === x)));
  }
  return out;
}

/** A full extra chip upgrades as one: its three defenders each get a random improvement. */
const CHIP_UPS: { name: string; apply: (s: Stats) => void }[] = [
  { name: 'Daño +30 %', apply: (s) => { s.dmg *= 1.3; } },
  { name: 'Cadencia +25 %', apply: (s) => { s.rate *= 1.25; } },
  { name: 'Alcance +20 %', apply: (s) => { s.range *= 1.2; s.splash *= 1.1; } },
  { name: '+1 efecto', apply: (s) => { s.count += 1; } },
  { name: 'Crítico +10 %', apply: (s) => { s.crit += 0.1; } },
  { name: 'Área +25 %', apply: (s) => { s.splash = s.splash * 1.25 + 6; s.knock *= 1.2; } },
];
function chipUpgradeCard(g: Game, k: number, rnd: () => number): Card {
  const ch = CHIPS[k - 1];
  const id = `chipup-${ch.id}`;
  const lvl = levelOf(g, id) + 1;
  return {
    key: id, id, kind: 'chipup', rarity: 'epica', title: `Mejorar chip ${ch.name}`,
    desc: 'Sus tres defensores mejoran a la vez, cada uno con una mejora al azar. Su habilidad también se hace más fuerte.',
    tag: `Chip ${ch.name} · nivel ${lvl}/${CHIP_MAX_LVL}`, color: ch.color,
    apply: (gg) => {
      for (const d of gg.defenders.filter((x) => x.chip === k)) {
        const up = CHIP_UPS[Math.floor(rnd() * CHIP_UPS.length)];
        up.apply(d.stats);
        d.lvl += 1;
        gg.fx.push({ k: 'txt', x: d.x, y: d.y - 16, s: up.name, life: 1.4, max: 1.4, c: ch.color });
        gg.fx.push({ k: 'ring', x: d.x, y: d.y, r0: 4, r1: 30, life: 0.5, max: 0.5, c: ch.color, w: 3 });
      }
      threaten(gg);
    },
  };
}

function cardFor(g: Game, rnd: () => number): Card | null {
  const n = mainRing(g).length;
  const r = rnd();
  for (let k = 1; k < g.chips; k++) {
    const full = g.defenders.filter((d) => d.chip === k).length >= chipSlots(k);
    if (full && levelOf(g, `chipup-${CHIPS[k - 1].id}`) < CHIP_MAX_LVL && rnd() < 0.18) return chipUpgradeCard(g, k, rnd);
  }
  const extra = chipKindsAvailable(g);
  if (extra.length && rnd() < 0.3) return newDefenderCard(g, extra[Math.floor(rnd() * extra.length)]);
  const kinds = availableKinds(g);
  // New defenders: guaranteed early, rarer later. Never the same type twice.
  const newW = n >= MAX_DEFENDERS || !kinds.length ? 0 : n < 3 ? 0.35 : n < 6 ? 0.18 : 0.1;
  if (r < newW) return newDefenderCard(g, kinds[Math.floor(rnd() * kinds.length)]);
  if (r < newW + 0.36) {
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
  const evo = coreEvoCard(g) ?? chipEvoCard(g);
  if (evo) out.push(evo);
  else if (chipReady(g) && rnd() < 0.6) out.push(chipCard(g));
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
  const ck = c.kind === 'chipevo' || c.kind === 'chip' ? CHIPS.findIndex((x) => c.id.endsWith(`-${x.id}`)) + 1 : 0;
  const cp = ck ? chipPos(c.kind === 'chip' ? g.chips - 1 : ck) : null;
  const [x, y] = cp ? [cp.x, cp.y] : d ? [d.x, d.y] : gl?.struct ? [0, -(c.id === 'aura' ? 70 : 104)] : [0, 0];
  const big = c.kind === 'evo' || c.kind === 'fusion' || c.kind === 'asc' || c.kind === 'chip' || c.kind === 'chipup' || c.kind === 'coreevo' || c.kind === 'chipevo';
  g.fx.push({ k: 'ring', x, y, r0: 6, r1: big ? 90 : 44, life: big ? 0.8 : 0.5, max: big ? 0.8 : 0.5, c: c.color, w: big ? 5 : 3 });
  g.fx.push({ k: 'flash', x, y, r: big ? 50 : 24, life: 0.3, max: 0.3, c: c.color });
  g.fx.push({ k: 'txt', x, y: y - 18, s: c.title, life: 1.4, max: 1.4, c: c.color });
  for (let k = 0; k < (big ? 24 : 10); k++) {
    const a = (k / (big ? 24 : 10)) * Math.PI * 2;
    const sp = big ? 160 : 100;
    g.fx.push({ k: 'p', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6, max: 0.6, c: c.color, s: 2.4 });
  }
}
