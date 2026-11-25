import { H, nodeR, OWNER_COLOR, slots, W, type EGame, type ENode } from './sim';

export interface EView {
  w: number;
  h: number;
  /** Screen px per world unit. */
  s: number;
  ox: number;
  oy: number;
  /** Landscape: the board is laid on its side. */
  rot: boolean;
}

const TAU = Math.PI * 2;
export function fitView(w: number, h: number, top: number, bottom: number): EView {
  const rot = w > h;
  const bw = rot ? H : W;
  const bh = rot ? W : H;
  const ah = h - top - bottom;
  const s = Math.min(w / bw, ah / bh) * 0.96;
  return { w, h, s, rot, ox: (w - bw * s) / 2, oy: top + (ah - bh * s) / 2 };
}
/** World → screen. */
export const toScreen = (v: EView, x: number, y: number) => (v.rot ? { x: v.ox + y * v.s, y: v.oy + (W - x) * v.s } : { x: v.ox + x * v.s, y: v.oy + y * v.s });
export const toWorld = (v: EView, sx: number, sy: number) => (v.rot ? { x: W - (sy - v.oy) / v.s, y: (sx - v.ox) / v.s } : { x: (sx - v.ox) / v.s, y: (sy - v.oy) / v.s });

const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export interface Drag {
  from: ENode;
  x: number;
  y: number;
  target: ENode | null;
  ok: boolean;
}

export function drawEnlace(ctx: CanvasRenderingContext2D, g: EGame, v: EView, dpr: number, drag: Drag | null, trail: { x: number; y: number }[]) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0b0c0e';
  ctx.fillRect(0, 0, v.w, v.h);
  const t = g.t;
  // Board grid
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  const step = 24 * v.s;
  for (let x = v.ox % step; x < v.w; x += step) for (let y = v.oy % step; y < v.h; y += step) ctx.fillRect(x, y, 1.2, 1.2);
  const P = (x: number, y: number) => toScreen(v, x, y);
  const S = v.s;

  // Walls
  for (const w of g.walls) {
    const a = P(w.x1, w.y1);
    const b = P(w.x2, w.y2);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,59,92,0.18)';
    ctx.lineWidth = 12 * S;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = '#4a2030';
    ctx.lineWidth = 5 * S;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,90,120,0.6)';
    ctx.lineWidth = 1.2 * S;
    ctx.setLineDash([4 * S, 4 * S]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  // Traces: circuit lines with energy packets flowing towards the target
  for (const l of g.links) {
    const a = byId.get(l.from)!;
    const b = byId.get(l.to)!;
    const c = OWNER_COLOR[l.owner];
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / d;
    const uy = (b.y - a.y) / d;
    const ra = nodeR(a);
    const reach = l.state === 'on' ? l.len * l.clash : l.built;
    const s0 = P(a.x + ux * ra, a.y + uy * ra);
    const s1 = P(a.x + ux * (ra + reach), a.y + uy * (ra + reach));
    ctx.lineCap = 'round';
    ctx.strokeStyle = hexA(c, 0.22);
    ctx.lineWidth = 9 * S;
    ctx.beginPath();
    ctx.moveTo(s0.x, s0.y);
    ctx.lineTo(s1.x, s1.y);
    ctx.stroke();
    ctx.strokeStyle = hexA(c, 0.9);
    ctx.lineWidth = 2.6 * S;
    ctx.stroke();
    if (l.state === 'on') {
      ctx.fillStyle = '#ffffff';
      const n = Math.max(1, Math.floor(reach / 26));
      for (let k = 0; k < n; k++) {
        const f = ((t * 1.4 + k / n) % 1) * reach;
        const p = P(a.x + ux * (ra + f), a.y + uy * (ra + f));
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.8 * S, 0, TAU);
        ctx.fill();
      }
      if (l.clash < 1) {
        // Meeting point of two opposing traces
        ctx.fillStyle = hexA('#ffffff', 0.6 + Math.sin(t * 20) * 0.3);
        ctx.beginPath();
        ctx.arc(s1.x, s1.y, 4.5 * S, 0, TAU);
        ctx.fill();
      }
    } else {
      // Growing tip
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(s1.x, s1.y, 3 * S, 0, TAU);
      ctx.fill();
    }
  }

  // Drag preview
  if (drag) {
    const a = P(drag.from.x, drag.from.y);
    const b = drag.target ? P(drag.target.x, drag.target.y) : P(drag.x, drag.y);
    ctx.strokeStyle = drag.ok ? hexA('#c8ff2e', 0.8) : 'rgba(255,59,92,0.8)';
    ctx.lineWidth = 2.5 * S;
    ctx.setLineDash([6 * S, 6 * S]);
    ctx.lineDashOffset = -t * 40;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Chips
  for (const n of g.nodes) {
    const p = P(n.x, n.y);
    const r = nodeR(n) * S;
    const c = OWNER_COLOR[n.owner];
    const frac = Math.max(0, Math.min(1, n.value / n.max));
    // Glow
    if (n.owner) {
      const gl = ctx.createRadialGradient(p.x, p.y, r * 0.5, p.x, p.y, r * 2.2);
      gl.addColorStop(0, hexA(c, 0.25 + n.flash));
      gl.addColorStop(1, hexA(c, 0));
      ctx.fillStyle = gl;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 2.2, 0, TAU);
      ctx.fill();
    }
    // Pins
    ctx.strokeStyle = hexA(c, 0.5);
    ctx.lineWidth = 1.6 * S;
    for (let k = 0; k < 4; k++) {
      for (let j = -1; j <= 1; j++) {
        const a = (k * Math.PI) / 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const off = j * r * 0.45;
        ctx.beginPath();
        ctx.moveTo(p.x + ca * r * 0.95 - sa * off, p.y + sa * r * 0.95 + ca * off);
        ctx.lineTo(p.x + ca * r * 1.25 - sa * off, p.y + sa * r * 1.25 + ca * off);
        ctx.stroke();
      }
    }
    // Body (shape by kind)
    ctx.beginPath();
    if (n.kind === 'firewall') {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + Math.PI / 6;
        ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
      }
      ctx.closePath();
    } else if (n.kind === 'relay') {
      ctx.moveTo(p.x, p.y - r);
      ctx.lineTo(p.x + r, p.y);
      ctx.lineTo(p.x, p.y + r);
      ctx.lineTo(p.x - r, p.y);
      ctx.closePath();
    } else {
      const k = r * 0.82;
      ctx.roundRect(p.x - k, p.y - k, k * 2, k * 2, r * 0.25);
    }
    ctx.fillStyle = '#121418';
    ctx.fill();
    ctx.strokeStyle = n.flash > 0 ? '#ffffff' : c;
    ctx.lineWidth = 2 * S;
    ctx.stroke();
    // Energy ring (the %)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 3 * S;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 1.45, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = c;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 1.45, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
    ctx.stroke();
    // Slot pips
    if (n.owner) {
      const sl = slots(n);
      const used = g.links.filter((l) => l.from === n.id && l.state !== 'back').length;
      for (let k = 0; k < sl; k++) {
        const a = Math.PI / 2 + (k - (sl - 1) / 2) * 0.35;
        ctx.fillStyle = k < used ? c : 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(a) * r * 1.8, p.y + Math.sin(a) * r * 1.8, 1.7 * S, 0, TAU);
        ctx.fill();
      }
    }
    if (n.kind === 'amp' || n.kind === 'nest') {
      ctx.strokeStyle = hexA(n.kind === 'nest' ? '#ff3b5c' : '#ffd60a', 0.6);
      ctx.lineWidth = 1.2 * S;
      ctx.setLineDash([2 * S, 3 * S]);
      ctx.lineDashOffset = t * 20;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 1.75, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = n.owner ? '#ffffff' : '#b9bec6';
    ctx.font = `700 ${Math.round(Math.max(10, r * 0.62))}px "Space Grotesk", Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(Math.floor(n.value)), p.x, p.y + 0.5);
  }

  // Effects
  for (const e of g.fx) {
    const p = P(e.x, e.y);
    const a = e.life / e.max;
    if (e.k === 'ring') {
      ctx.strokeStyle = hexA(e.c, a);
      ctx.lineWidth = 3 * S * a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (e.r ?? 30) * S * (1 - a * 0.7), 0, TAU);
      ctx.stroke();
    } else if (e.k === 'burst') {
      for (let k = 0; k < 8; k++) {
        const an = (k / 8) * TAU;
        const d = (1 - a) * 22 * S;
        ctx.fillStyle = hexA(e.c, a);
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(an) * d, p.y + Math.sin(an) * d, 2 * S, 0, TAU);
        ctx.fill();
      }
    }
  }
  // Cut trail
  if (trail.length > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);
    for (const q of trail) ctx.lineTo(q.x, q.y);
    ctx.stroke();
  }
}
