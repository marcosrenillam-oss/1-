import { canLink, cut, H, link, linkCost, nodeR, outgoing, rand, W, type EGame, type ENode, type NodeKind, type Owner, type Wall } from './sim';

// ── AI ────────────────────────────────────────────────────────────────────
/** One decision for every chip of `owner`: attack, reinforce, finish off or retreat. */
export function think(g: EGame, owner: Owner) {
  const mine = g.nodes.filter((n) => n.owner === owner);
  const agg = g.ai.aggression;
  // Retreat from lost tugs of war; cut to finish a capture.
  for (const l of g.links.filter((x) => x.owner === owner && x.state === 'on')) {
    const b = g.nodes.find((n) => n.id === l.to)!;
    if (l.clash < 0.25 && rand(g) < 0.6) l.state = 'back';
    else if (b.owner !== owner && l.clash >= 1 && b.value < l.invested * 0.55 && rand(g) < 0.7) cut(g, l, 0.02);
  }
  for (const a of mine) {
    if (a.value < 10 + (1 - agg) * 12 || outgoing(g, a).length >= Math.min(3, Math.ceil((a.value / 30) * agg + 0.5))) continue;
    let best: ENode | null = null;
    let score = 0;
    for (const b of g.nodes) {
      if (b === a || !canLink(g, a, b, owner)) continue;
      const cost = linkCost(g, a, b);
      if (cost > a.value * 0.7) continue;
      let s = 0;
      if (b.owner === owner) {
        // Reinforce a threatened ally.
        const threat = g.links.filter((l) => l.to === b.id && l.owner !== owner && l.state === 'on').length;
        s = threat && b.value < a.value * 0.8 ? (1.6 * threat) / (cost + 6) : 0;
      } else {
        const weak = 1 / (b.value * (b.kind === 'firewall' ? 2 : 1) + 6);
        s = (weak * (b.owner === 1 ? 1 + agg * 0.35 : b.owner === 0 ? 1.2 : 0.9) * (b.kind === 'amp' || b.kind === 'nest' ? 1.4 : 1) * 40) / (cost + 10);
        // Already being drained by us: keep going rather than spreading.
        if (g.links.some((l) => l.to === b.id && l.owner === owner)) s *= 0.5;
      }
      s *= 0.85 + rand(g) * 0.3;
      if (s > score) {
        score = s;
        best = b;
      }
    }
    if (best && score > 0.02) link(g, a, best, owner);
  }
}

export function aiStep(g: EGame, dt: number) {
  for (let o = 2; o <= 4; o++) {
    if (!g.nodes.some((n) => n.owner === o)) continue;
    g.aiT[o] = (g.aiT[o] ?? 2.5 + rand(g) * g.ai.interval) - dt;
    if (g.aiT[o] <= 0) {
      g.aiT[o] = g.ai.interval * (0.75 + rand(g) * 0.5);
      think(g, o as Owner);
    }
  }
}

// ── Levels ────────────────────────────────────────────────────────────────
export const SECTORS = [
  'Placa base', 'Bus de datos', 'Caché', 'Cortafuegos', 'Kernel', 'Red neuronal',
  'Cuántico', 'La nube', 'Cifrado', 'Núcleo oscuro', 'Singularidad', 'El 1 %',
];
export const PER_SECTOR = 25;
export const TOTAL_LEVELS = SECTORS.length * PER_SECTOR;

export interface LevelInfo {
  n: number;
  sector: number;
  index: number;
  name: string;
  par: number;
  enemies: number;
  hint?: string;
}

const HINTS: Record<number, string> = {
  1: 'Arrastra desde tu chip (verde) hasta otro para tender una traza. La energía fluye y lo conquista al llegar a 0.',
  2: 'Las trazas cuestan energía según su largo. Empieza por los chips cercanos y más débiles.',
  3: 'Con más energía, un chip puede tender más trazas: hasta 3.',
  4: 'Desliza el dedo cruzando una de tus trazas para cortarla: la parte de delante golpea al objetivo.',
  5: 'Si dos trazas enemigas chocan, empuja la que lleva más energía. Refuerza tus chips atacados.',
  26: 'Amplificador: se recarga el doble de rápido. Conquístalo pronto.',
  51: 'Firewall: recibe la mitad de daño.',
  76: 'Aparece un segundo virus. Que se peleen entre ellos.',
  101: 'Muros: las trazas no pueden atravesarlos.',
  126: 'Relé: sus trazas cuestan la mitad y admite una más.',
  151: 'Nidos de virus: se recargan muy rápido. Ataca primero ahí.',
  176: 'Tres facciones a la vez.',
};

export function levelInfo(n: number): LevelInfo {
  const sector = Math.floor((n - 1) / PER_SECTOR);
  const index = ((n - 1) % PER_SECTOR) + 1;
  const enemies = n < 76 ? 1 : n < 176 ? 2 : 3;
  const nodes = nodeCount(n);
  return { n, sector, index, name: `${sector + 1}-${index}`, par: Math.round(35 + nodes * 7 + enemies * 18), enemies, hint: HINTS[n] };
}
const nodeCount = (n: number) => Math.min(22, 5 + Math.floor(n / 14));

/** Builds level n (1-300): the same layout every time. */
export function buildLevel(n: number): EGame {
  const info = levelInfo(n);
  const g: EGame = {
    t: 0, nodes: [], links: [], walls: [], fx: [], over: 0, aiT: [], nextId: 1, sfx: [], seed: n * 9301 + 49297,
    ai: { interval: Math.max(0.85, 2.6 - n * 0.006), aggression: Math.min(1, 0.3 + n * 0.0026) },
  };
  const count = nodeCount(n);
  const M = 34;
  const pts: { x: number; y: number }[] = [];
  // Start positions: you at the bottom; viruses at the top (and the sides).
  const starts: { x: number; y: number; o: Owner }[] = [{ x: W / 2 + (rand(g) - 0.5) * 120, y: H - 70, o: 1 }];
  const enemySpots = info.enemies === 1 ? [{ x: W / 2 + (rand(g) - 0.5) * 120, y: 80 }] : info.enemies === 2 ? [{ x: 70, y: 90 }, { x: W - 70, y: 90 }] : [{ x: 55, y: 110 }, { x: W - 55, y: 110 }, { x: W / 2, y: 60 }];
  enemySpots.forEach((p, i) => starts.push({ ...p, o: (2 + i) as Owner }));
  for (const s of starts) pts.push(s);
  let tries = 0;
  while (pts.length < count && tries++ < 4000) {
    const p = { x: M + rand(g) * (W - 2 * M), y: M + 30 + rand(g) * (H - 2 * M - 60) };
    if (pts.every((q) => Math.hypot(p.x - q.x, p.y - q.y) > 64)) pts.push(p);
  }
  const kinds: NodeKind[] = ['std'];
  if (n > 25) kinds.push('amp');
  if (n > 50) kinds.push('firewall');
  if (n > 125) kinds.push('relay');
  pts.forEach((p, i) => {
    const s = starts[i];
    const owner: Owner = s ? s.o : 0;
    let kind: NodeKind = 'std';
    if (!s && rand(g) < 0.22) kind = kinds[Math.floor(rand(g) * kinds.length)];
    if (owner >= 2 && n > 150 && rand(g) < 0.5) kind = 'nest';
    const max = owner ? 100 : [40, 60, 80, 100][Math.floor(rand(g) * 4)];
    const tutorialBoost = n <= 5 ? 20 : n <= 25 ? 8 : 0;
    const value =
      owner === 1 ? Math.max(40, Math.min(70, 22 + n * 0.14) * 0.95) + tutorialBoost :
      owner >= 2 ? Math.min(70, 22 + n * 0.14 + (n <= 5 ? -12 : 0)) :
      Math.min(max * 0.9, 6 + rand(g) * (10 + n * 0.11));
    g.nodes.push({ id: g.nextId++, x: p.x, y: p.y, owner, value, max, kind, flash: 0 });
  });
  // From sector 5: walls between some chips.
  if (n > 100) {
    const nw = 1 + Math.floor(rand(g) * Math.min(4, 1 + (n - 100) / 50));
    for (let k = 0; k < nw * 8 && g.walls.length < nw; k++) {
      const cx = 50 + rand(g) * (W - 100);
      const cy = 140 + rand(g) * (H - 280);
      const a = rand(g) * Math.PI;
      const L = 60 + rand(g) * 70;
      const w: Wall = { x1: cx - Math.cos(a) * L, y1: cy - Math.sin(a) * L, x2: cx + Math.cos(a) * L, y2: cy + Math.sin(a) * L };
      const clear = g.nodes.every((nd) => segPointDist(w, nd) > nodeR(nd) + 14);
      if (clear) g.walls.push(w);
    }
  }
  // Later levels: everyone starts with an extra chip or two.
  if (n > 40) {
    for (let o = 1; o < 2 + info.enemies; o++) {
      const home = g.nodes.find((x) => x.owner === o)!;
      const extra = n > 200 ? 2 : 1;
      const near = g.nodes.filter((x) => x.owner === 0).sort((p, q) => Math.hypot(p.x - home.x, p.y - home.y) - Math.hypot(q.x - home.x, q.y - home.y)).slice(0, extra);
      near.forEach((x) => {
        x.owner = o as Owner;
        x.value = Math.max(x.value, 15);
      });
    }
  }
  return g;
}

function segPointDist(w: Wall, p: { x: number; y: number }) {
  const dx = w.x2 - w.x1;
  const dy = w.y2 - w.y1;
  const t = Math.max(0, Math.min(1, ((p.x - w.x1) * dx + (p.y - w.y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (w.x1 + dx * t), p.y - (w.y1 + dy * t));
}

/** Stars for a win: 3 within par time, 2 within 1.7×, otherwise 1. */
export const starsFor = (n: number, t: number) => {
  const par = levelInfo(n).par;
  return t <= par ? 3 : t <= par * 1.7 ? 2 : 1;
};
/** Energy for the chip the first time each star is earned. */
export const energyForStars = (n: number, newStars: number) => newStars * (10 + Math.floor(n / 10) * 2);
