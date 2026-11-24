import { DEF_INFO, DEF_KINDS, defenderName, EVOS, evoOptions, fusionName, makeDefender, SYNERGIES } from './defenders';
import type { DefKind, Defender, Game, Stats } from './types';

export const MAX_DEFENDERS = 10;

export type CardKind = 'new' | 'stat' | 'global' | 'pact' | 'evo' | 'fusion';
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
  apply: (g: Game) => void;
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
const countWord: Record<DefKind, string> = {
  canon: 'bala', laser: 'haz', rayo: 'rayo', pulso: 'onda', misil: 'misil', hielo: 'esquirla', cuchillas: 'cuchilla', mortero: 'proyectil',
  francotirador: 'objetivo', llamas: 'llama', gravedad: 'agujero', drones: 'dron', acido: 'lanzamiento', bumeran: 'bumerán', minas: 'mina', cronos: 'pulso',
};
const NO_COUNT: DefKind[] = ['llamas', 'cronos'];
export const STAT_CARDS: StatDef[] = [
  { id: 'dmg', title: () => 'Daño +25 %', desc: 'Golpea más fuerte.', apply: (s) => { s.dmg *= 1.25; }, w: 1.4 },
  { id: 'rate', title: (d) => (d.kind === 'cuchillas' ? 'Giro +20 %' : 'Cadencia +20 %'), desc: 'Actúa más a menudo.', apply: (s) => { s.rate *= 1.2; }, w: 1.3 },
  { id: 'range', title: (d) => (d.kind === 'cuchillas' ? 'Radio +15 %' : 'Alcance +15 %'), desc: 'Llega más lejos.', ok: (s) => s.range < 900, apply: (s) => { s.range *= 1.15; } },
  { id: 'count', title: (d) => `+1 ${countWord[d.kind]}`, desc: 'Más a la vez.', kinds: DEF_KINDS.filter((k) => !NO_COUNT.includes(k)), ok: (s) => s.count < 12, apply: (s) => { s.count += 1; if (s.spread < 0.3) s.spread += 0.12; }, w: 1.2 },
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
}
export const GLOBAL_CARDS: GlobalDef[] = [
  // Visible core structures
  { id: 'muro', title: 'Muro', desc: 'Levanta un muro alrededor de la defensa que frena a los virus. Se reconstruye cada oleada.', rarity: 'epica', apply: (g) => { g.g.wallMax += 80; g.g.wall = g.g.wallMax; } },
  { id: 'espinas', title: 'Espinas', desc: 'El anillo exterior se llena de pinchos que dañan a todo virus que lo toca.', rarity: 'epica', ok: (g) => g.g.thorns < 6, apply: (g) => { g.g.thorns += 1; } },
  { id: 'orbitales', title: 'Cuchillas orbitales', desc: '+3 cuchillas gigantes que giran alrededor de toda tu defensa.', rarity: 'epica', ok: (g) => g.g.orbit < 15, apply: (g) => { g.g.orbit += 3; } },
  { id: 'faro', title: 'Faro láser', desc: 'Un rayo gira sin parar desde el núcleo barriendo toda la pantalla.', rarity: 'epica', ok: (g) => g.g.faro < 4, apply: (g) => { g.g.faro += 1; } },
  { id: 'minas-nucleo', title: 'Sembrador', desc: 'El núcleo siembra minas alrededor durante cada oleada.', rarity: 'epica', ok: (g) => g.g.coreMines < 5, apply: (g) => { g.g.coreMines += 1; } },
  { id: 'arco-nucleo', title: 'Arco eléctrico', desc: 'El núcleo lanza rayos a los virus más cercanos.', rarity: 'epica', ok: (g) => g.g.arc < 6, apply: (g) => { g.g.arc += 1; } },
  { id: 'pulso-nucleo', title: 'Latido del núcleo', desc: 'Una onda automática que daña y aparta a los virus cercanos.', rarity: 'epica', ok: (g) => g.g.corePulse < 4, apply: (g) => { g.g.corePulse += 1; } },
  { id: 'refuerzo', title: 'Muro reforzado', desc: 'El muro aguanta +120 y sus pinchos crecen.', rarity: 'rara', ok: (g) => g.g.wallMax > 0, apply: (g) => { g.g.wallMax += 120; g.g.wall = g.g.wallMax; g.g.thorns += 0.5; } },
  { id: 'blindaje', title: 'Blindaje', desc: 'Integridad máxima +20 y repara 20.', apply: (g) => { g.maxHp += 20; g.hp = Math.min(g.maxHp, g.hp + 20); } },
  { id: 'reparacion', title: 'Autorreparación', desc: 'El núcleo se repara 0,6 por segundo.', apply: (g) => { g.g.regen += 0.6; } },
  { id: 'escudo', title: 'Escudo del núcleo', desc: 'Bloquea un impacto. Se recarga cada 12 s.', ok: (g) => g.g.shieldMax < 5, apply: (g) => { g.g.shieldMax += 1; g.g.shield += 1; } },
  { id: 'sobreescudo', title: 'Recarga de escudo', desc: 'El escudo se recarga un 30 % más rápido.', ok: (g) => g.g.shieldMax > 0 && g.g.shieldCd > 4, apply: (g) => { g.g.shieldCd *= 0.7; } },
  { id: 'aura', title: 'Aura de daño', desc: 'Los virus cerca del núcleo reciben daño continuo.', apply: (g) => { g.g.aura += 8; } },
  { id: 'frenado', title: 'Campo de frenado', desc: 'Los virus cerca del núcleo van un 25 % más lentos.', ok: (g) => g.g.brake < 0.6, apply: (g) => { g.g.brake += 0.25; } },
  { id: 'potencia', title: 'Potencia global', desc: 'Todos los defensores +12 % de daño.', apply: (g) => { g.g.dmgMul *= 1.12; }, w: 1.3 },
  { id: 'overclock', title: 'Overclock', desc: 'Todos los defensores +10 % de cadencia.', apply: (g) => { g.g.rateMul *= 1.1; }, w: 1.3 },
  { id: 'optica', title: 'Óptica', desc: 'Todos los defensores +10 % de alcance.', ok: (g) => g.g.rangeMul < 1.8, apply: (g) => { g.g.rangeMul *= 1.1; } },
  { id: 'suerte', title: 'Suerte', desc: 'Todos los defensores +5 % de crítico.', apply: (g) => { g.g.critAdd += 0.05; } },
  { id: 'aprendizaje', title: 'Aprendizaje', desc: '+20 % de experiencia.', apply: (g) => { g.g.xpMul *= 1.2; } },
  { id: 'botin', title: 'Botín', desc: '+25 % de energía para tu chip al acabar.', apply: (g) => { g.g.energyMul += 0.25; }, w: 0.7 },
  { id: 'nova-emergencia', title: 'Nova de emergencia', desc: 'Si te golpean, el núcleo lanza una onda (cada 8 s).', ok: (g) => g.g.nova < 3, apply: (g) => { g.g.nova += 1; } },
  { id: 'recalcular', title: 'Recalcular', desc: '+2 cambios de cartas.', apply: (g) => { g.g.rerolls += 2; }, w: 0.6 },
  { id: 'eleccion', title: 'Más opciones', desc: 'A partir de ahora eliges entre 4 cartas.', once: true, apply: (g) => { g.g.choices = 4; }, w: 0.5 },
  { id: 'purga', title: 'Protocolo de purga', desc: 'Todos rematan virus por debajo del 8 %.', ok: (g) => g.g.execute < 0.2, apply: (g) => { g.g.execute += 0.08; } },
  { id: 'cazajefes', title: 'Antivirus de élite', desc: '+40 % de daño a jefes y élites.', apply: (g) => { g.g.bossMul *= 1.4; } },
  { id: 'primer-golpe', title: 'Primer impacto', desc: '+60 % de daño a virus intactos.', apply: (g) => { g.g.firstHit += 0.6; } },
  { id: 'reaccion', title: 'Reacción en cadena', desc: 'Los virus explotan al morir y dañan alrededor.', apply: (g) => { g.g.chainReaction += 0.3; } },
  { id: 'criogenia', title: 'Criogenia', desc: 'Todos los golpes frenan un 8 %.', ok: (g) => g.g.hitSlow < 0.5, apply: (g) => { g.g.hitSlow += 0.08; } },
  { id: 'incendio', title: 'Incendio', desc: 'Todos los golpes queman 2/s.', apply: (g) => { g.g.hitBurn += 2; } },
  { id: 'copia', title: 'Copia de seguridad', desc: 'Una vez por partida, al caer recuperas el 50 %.', once: true, apply: (g) => { g.g.backup = 1; }, w: 0.6 },
  { id: 'satelite', title: 'Satélite', desc: 'Un satélite orbita el núcleo y dispara (+1 cañón).', rarity: 'epica', ok: (g) => g.g.turret < 6, apply: (g) => { g.g.turret += 1; } },
];

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
export const CATALOGUE_SIZE = DEF_KINDS.length + STAT_CARDS.length + GLOBAL_CARDS.length + PACT_CARDS.length + EVOS.length + FUSION_PAIRS;

export const kindsOf = (d: Defender): DefKind[] => (d.fuse ? [d.kind, d.fuse.kind] : [d.kind]);
const owned = (g: Game) => new Set(g.defenders.flatMap(kindsOf));

export function addDefender(g: Game, kind: DefKind): Defender {
  const d = makeDefender(g.nextId++, kind);
  g.defenders.push(d);
  refreshSynergies(g);
  return d;
}

/** Recomputes which synergies are active; new ones raise an event for the banner. */
export function refreshSynergies(g: Game) {
  const have = owned(g);
  const now = SYNERGIES.filter((s) => have.has(s.a) && have.has(s.b)).map((s) => s.id);
  for (const id of now) if (!g.syn.includes(id)) g.events.push(`syn:${id}`);
  g.syn = now;
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
    tag: `Nuevo defensor · ${g.defenders.length + 1}/${MAX_DEFENDERS}`, color: info.color,
    apply: (gg) => { addDefender(gg, kind); gg.g.horde *= 1.06; threaten(gg); },
  };
}
const availableKinds = (g: Game) => g.unlocked.filter((k) => !owned(g).has(k));

function fusionCard(a: Defender, b: Defender): Card {
  const name = fusionName(a.kind, b.kind);
  return {
    key: `fus-${a.id}-${b.id}`, id: `fusion-${[a.kind, b.kind].sort().join('+')}`, kind: 'fusion', rarity: 'legendaria', title: name,
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

function cardFor(g: Game, rnd: () => number): Card | null {
  const n = g.defenders.length;
  const r = rnd();
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
    const pool = GLOBAL_CARDS.filter((c) => (!c.ok || c.ok(g)) && !(c.once && g.taken.includes(c.id)));
    const total = pool.reduce((a, c) => a + (c.w ?? 1), 0);
    let x = rnd() * total;
    const c = pool.find((cc) => (x -= cc.w ?? 1) <= 0) ?? pool[0];
    if (!c) return null;
    const rarity = c.rarity ?? 'rara';
    return { key: c.id, id: c.id, kind: 'global', rarity, title: c.title, desc: c.desc, tag: rarity === 'epica' ? 'Estructura del núcleo' : 'Núcleo', color: rarity === 'epica' ? '#c8ff2e' : '#e8f6ff', apply: (gg) => { c.apply(gg); threaten(gg); } };
  }
  // Stat upgrade on one defender (a fusion upgrades both halves).
  if (!n) return null;
  const d = g.defenders[Math.floor(rnd() * n)];
  const pool = STAT_CARDS.filter((s) => (!s.kinds || s.kinds.includes(d.kind)) && (!s.ok || s.ok(d.stats)));
  const total = pool.reduce((a, c) => a + (c.w ?? 1), 0);
  let x = rnd() * total;
  const s = pool.find((c) => (x -= c.w ?? 1) <= 0) ?? pool[0];
  return {
    key: `${s.id}-${d.id}`, id: `stat-${s.id}`, kind: 'stat', rarity: 'comun', title: s.title(d), desc: s.desc, tag: `${defenderName(d)} · nv ${d.lvl + 1}`, color: DEF_INFO[d.kind].color,
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
        key: e.id, id: e.id, kind: 'evo', rarity: 'epica', title: e.name, desc: e.desc, tag: `Evoluciona ${defenderName(d)}`, color: DEF_INFO[d.kind].color,
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
  if (g.defenders.length < 3 && kinds.length && !out.some((c) => c.kind === 'new')) out[out.length - 1] = newDefenderCard(g, kinds[Math.floor(rnd() * kinds.length)]);
  return out;
}

export function choose(g: Game, c: Card) {
  c.apply(g);
  g.taken.push(c.id);
  g.pending = Math.max(0, g.pending - 1);
}
