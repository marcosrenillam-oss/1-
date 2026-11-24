import { DEF_INFO } from './defenders';
import { CORE_R, RING_R, VIRUS } from './sim';
import type { Defender, Game, Virus } from './types';

export interface View {
  w: number;
  h: number;
  /** CSS px per world unit. */
  scale: number;
  color: string;
}

const TAU = Math.PI * 2;

/** The static circuit-board background, drawn once per size. */
export function drawBackground(c: HTMLCanvasElement, v: View, dpr: number) {
  c.width = Math.round(v.w * dpr);
  c.height = Math.round(v.h * dpr);
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0b0c0e';
  ctx.fillRect(0, 0, v.w, v.h);
  const cx = v.w / 2;
  const cy = v.h / 2;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(v.w, v.h) * 0.6);
  glow.addColorStop(0, hexA(v.color, 0.09));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, v.w, v.h);
  // Dot grid
  const step = 22;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let x = (cx % step) - step; x < v.w + step; x += step) for (let y = (cy % step) - step; y < v.h + step; y += step) ctx.fillRect(x, y, 1.2, 1.2);
  // Radial traces from the core
  ctx.strokeStyle = hexA(v.color, 0.07);
  ctx.lineWidth = 1.5;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * TAU + rnd() * 0.2;
    let x = cx + Math.cos(a) * RING_R * 1.6 * v.scale;
    let y = cy + Math.sin(a) * RING_R * 1.6 * v.scale;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      const len = (40 + rnd() * 70) * v.scale;
      const turn = s % 2 ? (rnd() < 0.5 ? -1 : 1) * 0.6 : 0;
      x += Math.cos(a + turn) * len;
      y += Math.sin(a + turn) * len;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = hexA(v.color, 0.12);
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, TAU);
    ctx.fill();
  }
}

export function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function draw(ctx: CanvasRenderingContext2D, g: Game, v: View, bg: HTMLCanvasElement, dpr: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(bg, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sx = g.shake ? (Math.random() - 0.5) * g.shake : 0;
  const sy = g.shake ? (Math.random() - 0.5) * g.shake : 0;
  ctx.save();
  ctx.translate(v.w / 2 + sx, v.h / 2 + sy);
  ctx.scale(v.scale, v.scale);
  const t = g.t;
  const col = v.color;

  // Brake / aura fields
  if (g.g.brake > 0) {
    ctx.fillStyle = hexA('#8af3ff', 0.035 + g.g.brake * 0.05);
    ctx.beginPath();
    ctx.arc(0, 0, 125, 0, TAU);
    ctx.fill();
  }
  if (g.g.aura > 0) {
    ctx.strokeStyle = hexA(col, 0.25);
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 7]);
    ctx.lineDashOffset = -t * 30;
    ctx.beginPath();
    ctx.arc(0, 0, 82, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Defender ring
  ctx.strokeStyle = hexA(col, 0.18);
  ctx.lineWidth = 1.5;
  ctx.setLineDash([2, 8]);
  ctx.lineDashOffset = -g.ring * 60;
  ctx.beginPath();
  ctx.arc(0, 0, RING_R, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  // Links core → defenders
  ctx.lineWidth = 1.2;
  for (const d of g.defenders) {
    ctx.strokeStyle = hexA(DEF_INFO[d.kind].color, 0.22);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
  }

  drawCore(ctx, g, col);

  // Mortar targets
  for (const s of g.shots) {
    if (s.T === undefined) continue;
    const k = s.t! / s.T;
    ctx.strokeStyle = hexA('#ff5a5a', 0.25 + k * 0.5);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(s.tx!, s.ty!, s.splash * (1 - k * 0.5), 0, TAU);
    ctx.stroke();
  }

  // Viruses
  for (const vv of g.viruses) drawVirus(ctx, vv, t);

  // Shots (additive glow)
  ctx.globalCompositeOperation = 'lighter';
  for (const s of g.shots) {
    const c = s.kind === 'core' ? col : s.kind === 'frag' ? '#ffd9a0' : DEF_INFO[s.kind].color;
    if (s.T !== undefined) {
      const k = s.t! / s.T;
      const lift = Math.sin(k * Math.PI) * 26;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(s.x, s.y - lift, 4.5 + Math.sin(k * Math.PI) * 2, 0, TAU);
      ctx.fill();
      continue;
    }
    ctx.strokeStyle = hexA(c, 0.45);
    ctx.lineWidth = s.r * 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const tx = s.x - s.vx * 0.035;
    const ty = s.y - s.vy * 0.035;
    ctx.moveTo(tx, ty);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fill();
  }

  // Beams, bolts, rings, particles
  for (const f of g.fx) {
    const a = Math.max(0, f.life / f.max);
    switch (f.k) {
      case 'beam':
        ctx.strokeStyle = hexA(f.c, 0.35);
        ctx.lineWidth = f.w * 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(f.x1, f.y1);
        ctx.lineTo(f.x2, f.y2);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = f.w * 0.6;
        ctx.stroke();
        break;
      case 'bolt': {
        ctx.strokeStyle = hexA(f.c, a);
        ctx.lineWidth = 3.5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(f.pts[0], f.pts[1]);
        for (let i = 2; i < f.pts.length; i += 2) ctx.lineTo(f.pts[i], f.pts[i + 1]);
        ctx.stroke();
        ctx.strokeStyle = hexA('#ffffff', a);
        ctx.lineWidth = 1.2;
        ctx.stroke();
        break;
      }
      case 'ring': {
        const k = 1 - a;
        ctx.strokeStyle = hexA(f.c, a * 0.85);
        ctx.lineWidth = f.w * a + 0.5;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r0 + (f.r1 - f.r0) * easeOut(k), 0, TAU);
        ctx.stroke();
        break;
      }
      case 'p':
        ctx.fillStyle = hexA(f.c, a);
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.s * (0.4 + a * 0.6), 0, TAU);
        ctx.fill();
        break;
      case 'xp': {
        const k = easeIn(1 - a);
        const x = f.x * (1 - k);
        const y = f.y * (1 - k);
        ctx.fillStyle = hexA(col, 0.9);
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, TAU);
        ctx.fill();
        break;
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over';

  // Defenders on top
  for (const d of g.defenders) drawDefender(ctx, d, g);

  // Floating crit numbers
  ctx.textAlign = 'center';
  ctx.font = '700 11px "Space Grotesk", Inter, sans-serif';
  for (const f of g.fx) {
    if (f.k !== 'txt') continue;
    ctx.fillStyle = hexA(f.c, Math.min(1, (f.life / f.max) * 1.6));
    ctx.fillText(f.s, f.x, f.y);
  }
  ctx.restore();

  // Damage vignette
  if (g.hurt > 0) {
    const r = ctx.createRadialGradient(v.w / 2, v.h / 2, Math.min(v.w, v.h) * 0.3, v.w / 2, v.h / 2, Math.max(v.w, v.h) * 0.75);
    r.addColorStop(0, 'rgba(255,40,60,0)');
    r.addColorStop(1, `rgba(255,40,60,${g.hurt * 0.55})`);
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, v.w, v.h);
  }
}

const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
const easeIn = (k: number) => k * k;

function drawCore(ctx: CanvasRenderingContext2D, g: Game, col: string) {
  const t = g.t;
  const frac = Math.max(0, g.hp / g.maxHp);
  const pulse = 1 + Math.sin(t * 3) * 0.04;
  // Glow
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, CORE_R * 3);
  glow.addColorStop(0, hexA(col, 0.35));
  glow.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, CORE_R * 3, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // Integrity ring
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, CORE_R + 10, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = frac > 0.35 ? col : '#ff3b3b';
  ctx.beginPath();
  ctx.arc(0, 0, CORE_R + 10, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
  ctx.stroke();
  // Shield bubbles
  for (let k = 0; k < g.g.shieldMax; k++) {
    const a = -Math.PI / 2 + (k + 0.5) * (TAU / g.g.shieldMax) + t * 0.5;
    ctx.fillStyle = k < g.g.shield ? '#8af3ff' : 'rgba(138,243,255,0.18)';
    ctx.beginPath();
    ctx.arc(Math.cos(a) * (CORE_R + 18), Math.sin(a) * (CORE_R + 18), 3, 0, TAU);
    ctx.fill();
  }
  // Chip body
  ctx.save();
  ctx.rotate(Math.sin(t * 0.6) * 0.08);
  ctx.scale(pulse, pulse);
  const s = CORE_R * 0.95;
  // Pins
  ctx.strokeStyle = 'rgba(160,168,180,0.75)';
  ctx.lineWidth = 2;
  for (let k = -2; k <= 2; k++) {
    const p = (k * s) / 2.7;
    for (const [x1, y1, x2, y2] of [[p, -s, p, -s - 6], [p, s, p, s + 6], [-s, p, -s - 6, p], [s, p, s + 6, p]]) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
  roundRect(ctx, -s, -s, s * 2, s * 2, 6);
  ctx.fillStyle = '#15171b';
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.stroke();
  roundRect(ctx, -s * 0.55, -s * 0.55, s * 1.1, s * 1.1, 3);
  ctx.fillStyle = hexA(col, 0.25 + Math.sin(t * 4) * 0.1 + (g.hurt > 0 ? 0.4 : 0));
  ctx.fill();
  ctx.fillStyle = col;
  ctx.font = '700 11px "Space Grotesk", Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('1%', 0, 0.5);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawVirus(ctx: CanvasRenderingContext2D, v: Virus, t: number) {
  const c = VIRUS[v.type].color;
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.globalAlpha = v.hidden ? 0.16 : 1;
  ctx.rotate(v.spin);
  const spikes = v.boss ? 14 : v.type === 'mini' ? 6 : v.type === 'tanque' || v.type === 'invocador' ? 10 : 8;
  const r = v.r * (1 + Math.sin(t * 6 + v.id) * 0.04);
  // Spikes with knobs
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  ctx.lineWidth = v.boss ? 3 : 1.8;
  for (let k = 0; k < spikes; k++) {
    const a = (k / spikes) * TAU;
    const x1 = Math.cos(a) * r * 0.8;
    const y1 = Math.sin(a) * r * 0.8;
    const x2 = Math.cos(a) * r * 1.38;
    const y2 = Math.sin(a) * r * 1.38;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x2, y2, v.boss ? 3.4 : 1.9, 0, TAU);
    ctx.fill();
  }
  // Body
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = hexA(c, 0.28);
  ctx.fill();
  ctx.lineWidth = v.boss ? 3.2 : 2;
  ctx.strokeStyle = c;
  ctx.stroke();
  // Nucleus
  ctx.beginPath();
  ctx.arc(r * 0.18, -r * 0.12, r * 0.38, 0, TAU);
  ctx.fillStyle = hexA(c, 0.75);
  ctx.fill();
  if (v.boss) {
    ctx.beginPath();
    ctx.arc(-r * 0.3, r * 0.3, r * 0.18, 0, TAU);
    ctx.fill();
  }
  if (v.flash > 0) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = `rgba(255,255,255,${v.flash * 7})`;
    ctx.fill();
  }
  ctx.rotate(-v.spin);
  if (v.shield > 0) {
    ctx.strokeStyle = 'rgba(120,170,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.55, 0, TAU);
    ctx.stroke();
  }
  if (v.elite) {
    ctx.strokeStyle = '#ffd60a';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.7, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (v.slowT > 0) {
    ctx.strokeStyle = 'rgba(138,243,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.15, 0, TAU);
    ctx.stroke();
  }
  if (v.burnT > 0) {
    ctx.fillStyle = 'rgba(255,138,31,0.9)';
    for (let k = 0; k < 3; k++) {
      const a = t * 5 + k * 2.1;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9 - 2, 1.6, 0, TAU);
      ctx.fill();
    }
  }
  // Life bar for big ones
  if ((v.boss || v.elite || v.type === 'tanque' || v.type === 'invocador') && v.hp < v.max) {
    const w = r * 2.2;
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-w / 2, -r * 1.75 - 5, w, 4);
    ctx.fillStyle = v.boss ? '#ff3b5c' : '#ffd60a';
    ctx.fillRect(-w / 2, -r * 1.75 - 5, w * Math.max(0, v.hp / v.max), 4);
  }
  ctx.restore();
}

function drawDefender(ctx: CanvasRenderingContext2D, d: Defender, g: Game) {
  const c = DEF_INFO[d.kind].color;
  const tier = d.evo.length;
  const R = 9 + tier * 2;
  const t = g.t;
  const s = d.stats;
  // Orbiting blades (drawn around the defender)
  if (d.kind === 'cuchillas') {
    const n = Math.round(s.count);
    const rr = s.range * g.g.rangeMul;
    ctx.strokeStyle = hexA(c, 0.15);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(d.x, d.y, rr, 0, TAU);
    ctx.stroke();
    for (let b = 0; b < n; b++) {
      const a = d.spin + (b * TAU) / n;
      ctx.save();
      ctx.translate(d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr);
      ctx.rotate(a + t * 10);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(2.5, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-2.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  if (d.kind === 'pulso' && d.flags.field) {
    ctx.fillStyle = hexA(c, 0.07 + Math.sin(t * 6) * 0.03);
    ctx.beginPath();
    ctx.arc(d.x, d.y, s.range * g.g.rangeMul, 0, TAU);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(d.x, d.y);
  // Evolution aura
  if (tier >= 1) {
    ctx.globalCompositeOperation = 'lighter';
    const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 2.4);
    gl.addColorStop(0, hexA(c, tier === 2 ? 0.45 : 0.25));
    gl.addColorStop(1, hexA(c, 0));
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(0, 0, R * 2.4, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  if (tier === 2) {
    ctx.save();
    ctx.rotate(t * 1.5);
    ctx.strokeStyle = c;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, R + 6, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  // Barrels
  ctx.save();
  ctx.rotate(d.aim);
  const barrels = d.kind === 'canon' || d.kind === 'hielo' || d.kind === 'misil' || d.kind === 'mortero' ? Math.min(5, Math.max(1, Math.round(s.count))) : 0;
  ctx.fillStyle = c;
  for (let b = 0; b < barrels; b++) {
    const off = (b - (barrels - 1) / 2) * 3.4;
    const len = d.kind === 'mortero' ? R + 3 : R + 7 + tier * 2;
    const wid = d.kind === 'mortero' ? 7 : d.kind === 'misil' ? 4 : 2.8;
    ctx.fillRect(0, off - wid / 2, len, wid);
  }
  if (d.kind === 'laser') {
    ctx.beginPath();
    ctx.moveTo(R + 8, 0);
    ctx.lineTo(R - 2, -4);
    ctx.lineTo(R - 2, 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Body
  ctx.beginPath();
  if (tier >= 1) {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + Math.PI / 6;
      ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
    }
    ctx.closePath();
  } else ctx.arc(0, 0, R, 0, TAU);
  ctx.fillStyle = '#121418';
  ctx.fill();
  ctx.strokeStyle = c;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  // Kind glyph
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  ctx.lineWidth = 1.8;
  const k = R * 0.45;
  ctx.beginPath();
  switch (d.kind) {
    case 'canon':
      ctx.arc(0, 0, k * 0.7, 0, TAU);
      ctx.fill();
      break;
    case 'laser':
      ctx.moveTo(0, -k);
      ctx.lineTo(k, 0);
      ctx.lineTo(0, k);
      ctx.lineTo(-k, 0);
      ctx.closePath();
      ctx.fill();
      break;
    case 'rayo':
      ctx.moveTo(k * 0.3, -k);
      ctx.lineTo(-k * 0.5, k * 0.1);
      ctx.lineTo(k * 0.3, k * 0.1);
      ctx.lineTo(-k * 0.3, k);
      ctx.stroke();
      break;
    case 'pulso':
      ctx.arc(0, 0, k * 0.4, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, k * (0.8 + ((t * 1.5) % 1) * 0.4), 0, TAU);
      ctx.stroke();
      break;
    case 'misil':
      ctx.moveTo(k, 0);
      ctx.lineTo(-k * 0.6, -k * 0.7);
      ctx.lineTo(-k * 0.6, k * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    case 'hielo':
      for (let j = 0; j < 3; j++) {
        const a = (j / 3) * Math.PI;
        ctx.moveTo(Math.cos(a) * k, Math.sin(a) * k);
        ctx.lineTo(-Math.cos(a) * k, -Math.sin(a) * k);
      }
      ctx.stroke();
      break;
    case 'cuchillas':
      ctx.arc(0, 0, k * 0.5, 0, TAU);
      ctx.fill();
      break;
    case 'mortero':
      ctx.arc(0, 0, k * 0.8, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, k * 0.3, 0, TAU);
      ctx.fill();
      break;
  }
  // Upgrade pips
  const pips = Math.min(10, d.lvl);
  for (let p = 0; p < pips; p++) {
    const a = Math.PI / 2 + (p - (pips - 1) / 2) * 0.32;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * (R + 4), Math.sin(a) * (R + 4), 1.3, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
