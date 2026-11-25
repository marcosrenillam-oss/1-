/**
 * «Enlace»: a network of chips. Lay circuit traces from your chips to others;
 * energy flows along them, draining enemies until they are captured or
 * reinforcing your own. Original rules for the node-conquest genre.
 */

/** 0 neutral, 1 the player, 2-4 virus factions. */
export type Owner = 0 | 1 | 2 | 3 | 4;
export type NodeKind = 'std' | 'amp' | 'firewall' | 'relay' | 'nest';

export interface ENode {
  id: number;
  x: number;
  y: number;
  owner: Owner;
  value: number;
  max: number;
  kind: NodeKind;
  /** Visual: flash when hit or captured. */
  flash: number;
}
export interface ELink {
  id: number;
  from: number;
  to: number;
  owner: Owner;
  len: number;
  built: number;
  state: 'grow' | 'on' | 'back';
  /** Energy spent building it (returned or fired when cut). */
  invested: number;
  /** Where two opposing traces meet (0 at this link's source, 1 at its target). */
  clash: number;
}
export interface Wall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface EFx {
  k: 'ring' | 'burst' | 'txt';
  x: number;
  y: number;
  life: number;
  max: number;
  c: string;
  s?: string;
  r?: number;
}
export interface EGame {
  t: number;
  nodes: ENode[];
  links: ELink[];
  walls: Wall[];
  fx: EFx[];
  /** 0 playing, 1 won, 2 lost. */
  over: 0 | 1 | 2;
  aiT: number[];
  ai: { interval: number; aggression: number };
  nextId: number;
  sfx: string[];
  seed: number;
}

export const W = 360;
export const H = 640;
export const COST = 0.075; // energy per unit of trace length
export const GROW = 170; // trace growth, units per second
export const OWNER_COLOR = ['#8a9099', '#c8ff2e', '#ff3b5c', '#a66bff', '#ff8a1f'];
export const OWNER_NAME = ['Neutral', 'Tú', 'Virus', 'Gusano', 'Troyano'];
export const KIND_INFO: Record<NodeKind, { name: string; desc: string }> = {
  std: { name: 'Chip', desc: '' },
  amp: { name: 'Amplificador', desc: 'Se recarga el doble de rápido.' },
  firewall: { name: 'Firewall', desc: 'Recibe la mitad de daño.' },
  relay: { name: 'Relé', desc: 'Sus trazas cuestan la mitad y admite una más.' },
  nest: { name: 'Nido', desc: 'Un nido de virus: se recarga muy rápido.' },
};

export const nodeR = (n: ENode) => 13 + n.max * 0.09;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Trace slots: more energy, more traces. */
export function slots(n: ENode): number {
  const base = n.value < 15 ? 1 : n.value < 45 ? 2 : 3;
  return base + (n.kind === 'relay' ? 1 : 0);
}
export const linkCost = (_g: EGame, a: ENode, b: ENode) => (dist(a, b) - nodeR(a) - nodeR(b)) * COST * (a.kind === 'relay' ? 0.5 : 1);
const regen = (n: ENode) => (n.owner === 0 ? 0 : n.kind === 'amp' ? 1.7 : n.kind === 'nest' ? 1.4 : 0.75);
const flowOf = (n: ENode) => (n.value <= 0.5 ? 0 : 1.5 + n.value * 0.028);

function segCross(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }) {
  const o = (p: typeof a, q: typeof a, r: typeof a) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}
export const blocked = (g: EGame, a: ENode, b: ENode) => g.walls.some((w) => segCross(a, b, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }));

export function outgoing(g: EGame, n: ENode) {
  return g.links.filter((l) => l.from === n.id && l.state !== 'back');
}

/** Can `owner` lay a trace from a to b right now? */
export function canLink(g: EGame, a: ENode, b: ENode, owner: Owner): boolean {
  if (a === b || a.owner !== owner || g.over) return false;
  if (outgoing(g, a).length >= slots(a)) return false;
  if (g.links.some((l) => l.from === a.id && l.to === b.id && l.state !== 'back')) return false;
  // A trace between two of your chips only goes one way.
  if (b.owner === owner && g.links.some((l) => l.from === b.id && l.to === a.id && l.state !== 'back')) return false;
  if (blocked(g, a, b)) return false;
  return a.value > Math.min(4, linkCost(g, a, b));
}

export function link(g: EGame, a: ENode, b: ENode, owner: Owner): ELink | null {
  if (!canLink(g, a, b, owner)) return null;
  const l: ELink = { id: g.nextId++, from: a.id, to: b.id, owner, len: dist(a, b) - nodeR(a) - nodeR(b), built: 0, state: 'grow', invested: 0, clash: 1 };
  g.links.push(l);
  g.sfx.push(owner === 1 ? 'link' : 'elink');
  return l;
}

const node = (g: EGame, id: number) => g.nodes.find((n) => n.id === id)!;
const opposite = (g: EGame, l: ELink) => g.links.find((o) => o.from === l.to && o.to === l.from && o.owner !== l.owner && o.state !== 'back');

/** Cuts a trace at fraction f (0 at its source): the far part hits the target, the rest returns. */
export function cut(g: EGame, l: ELink, f = 0.5) {
  const a = node(g, l.from);
  const b = node(g, l.to);
  g.links = g.links.filter((x) => x !== l);
  const reach = l.len > 0 ? l.built / l.len : 0;
  const k = Math.min(f, reach) / Math.max(reach, 1e-6);
  const back = l.invested * k;
  const fire = l.state === 'on' && !opposite(g, l) ? l.invested * (1 - k) : l.invested * (1 - k) * 0.5;
  a.value = Math.min(a.max, a.value + back);
  if (fire > 0) {
    const fx = a.x + (b.x - a.x) * f;
    const fy = a.y + (b.y - a.y) * f;
    g.fx.push({ k: 'burst', x: fx, y: fy, life: 0.4, max: 0.4, c: OWNER_COLOR[l.owner] });
    if (l.state === 'on' && !opposite(g, l)) deliver(g, l.owner, b, fire);
  }
  g.sfx.push('cut');
}

/** Energy reaching a node: feeds allies, drains anyone else. */
function deliver(g: EGame, owner: Owner, b: ENode, amount: number) {
  if (b.owner === owner) {
    b.value = Math.min(b.max, b.value + amount);
    return;
  }
  b.value -= amount * (b.kind === 'firewall' ? 0.5 : 1);
  b.flash = Math.max(b.flash, 0.15);
  if (b.value < 0) capture(g, b, owner, -b.value);
}

function capture(g: EGame, b: ENode, owner: Owner, over: number) {
  const prev = b.owner;
  b.owner = owner;
  b.value = Math.min(b.max, 2 + over);
  b.flash = 0.6;
  // Its own traces collapse.
  g.links = g.links.filter((l) => !(l.from === b.id && l.owner === prev));
  g.fx.push({ k: 'ring', x: b.x, y: b.y, life: 0.6, max: 0.6, c: OWNER_COLOR[owner], r: nodeR(b) * 3 });
  g.sfx.push(owner === 1 ? 'capture' : prev === 1 ? 'lost' : 'ecapture');
}

export function update(g: EGame, dt: number) {
  if (g.over) return;
  dt = Math.min(dt, 0.05);
  g.t += dt;
  for (const n of g.nodes) {
    n.value = Math.min(n.max, n.value + regen(n) * dt);
    n.flash = Math.max(0, n.flash - dt);
  }
  for (const l of [...g.links]) {
    if (!g.links.includes(l)) continue;
    const a = node(g, l.from);
    const b = node(g, l.to);
    if (a.owner !== l.owner) {
      g.links = g.links.filter((x) => x !== l);
      continue;
    }
    if (l.state === 'grow') {
      const step = Math.min(GROW * dt, l.len - l.built);
      const cost = step * COST * (a.kind === 'relay' ? 0.5 : 1);
      if (a.value < cost) {
        l.state = 'back';
        continue;
      }
      a.value -= cost;
      l.invested += cost;
      l.built += step;
      // Two opposing traces growing at each other meet in the middle.
      const o = opposite(g, l);
      if (o && l.built + o.built >= l.len) {
        l.state = 'on';
        o.state = 'on';
        l.clash = l.built / l.len;
        o.clash = 1 - l.clash;
      } else if (l.built >= l.len) {
        l.state = 'on';
        l.clash = 1;
      }
      continue;
    }
    if (l.state === 'back') {
      const step = Math.min(GROW * 1.5 * dt, l.built);
      const ret = l.len > 0 ? (l.invested * step) / Math.max(l.built, 1e-6) : 0;
      l.built -= step;
      l.invested -= ret;
      a.value = Math.min(a.max, a.value + ret);
      if (l.built <= 0.5) g.links = g.links.filter((x) => x !== l);
      continue;
    }
    // Active
    const f = Math.min(flowOf(a), a.value) * dt;
    const o = opposite(g, l);
    if (o && o.state === 'on') {
      // Tug of war: the stronger flow pushes the meeting point.
      if (l.id > o.id) continue; // resolve each pair once
      const fo = Math.min(flowOf(b), b.value) * dt;
      a.value -= f;
      b.value -= fo;
      l.clash = Math.max(0, Math.min(1, l.clash + (f - fo) / Math.max(30, l.len * COST)));
      o.clash = 1 - l.clash;
      if (l.clash >= 0.999) {
        g.links = g.links.filter((x) => x !== o);
        l.clash = 1;
        g.sfx.push('clashwin');
      } else if (l.clash <= 0.001) {
        g.links = g.links.filter((x) => x !== l);
        o.clash = 1;
        g.sfx.push('clashwin');
      }
      continue;
    }
    if (l.clash < 1) {
      // The rival trace is gone: keep growing to the target.
      l.clash = Math.min(1, l.clash + (GROW / Math.max(l.len, 1)) * dt);
      continue;
    }
    a.value -= f;
    deliver(g, l.owner, b, f);
  }
  // Effects
  for (const e of g.fx) e.life -= dt;
  g.fx = g.fx.filter((e) => e.life > 0);
  // Win / lose
  const owners = new Set(g.nodes.map((n) => n.owner));
  const playerAlive = owners.has(1);
  const enemies = [...owners].some((o) => o >= 2) || g.links.some((l) => l.owner >= 2);
  if (!playerAlive) g.over = 2;
  else if (!enemies) g.over = 1;
  if (g.over) g.sfx.push(g.over === 1 ? 'win' : 'lose');
}

export function rand(g: EGame): number {
  let t = (g.seed = (g.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
