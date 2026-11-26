import { behOf, chipPos, CHIPS, DEF_EL, DEF_INFO, ELEMENTS, SYNERGIES, TWIN, type Element } from './defenders';
import { CORE_R, ORBIT_R, RING_R, structs, VIRUS, WALL_R } from './sim';
import type { DefKind, Defender, Game, Virus } from './types';

/** ctx.arc that never throws on a shrinking (negative) radius. */
const arc = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean) => ctx.arc(x, y, Math.max(0, r), a0, a1, ccw);

export interface View {
  w: number;
  h: number;
  /** CSS px per world unit. */
  scale: number;
  color: string;
  /** Your chip from «Tu Núcleo», drawn as the core. */
  coreImg?: HTMLImageElement | null;
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
  traces.length = 0;
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * TAU + rnd() * 0.2;
    let x = cx + Math.cos(a) * RING_R * 1.6 * v.scale;
    let y = cy + Math.sin(a) * RING_R * 1.6 * v.scale;
    const pts = [x, y];
    ctx.beginPath();
    ctx.moveTo(x, y);
    // Long enough to reach the screen edges in any orientation.
    const steps = Math.ceil((Math.max(v.w, v.h) * 0.6) / (75 * v.scale));
    for (let s = 0; s < steps; s++) {
      const len = (40 + rnd() * 70) * v.scale;
      const turn = s % 2 ? (rnd() < 0.5 ? -1 : 1) * 0.6 : 0;
      x += Math.cos(a + turn) * len;
      y += Math.sin(a + turn) * len;
      ctx.lineTo(x, y);
      pts.push(x, y);
    }
    traces.push(pts);
    ctx.stroke();
    ctx.fillStyle = hexA(v.color, 0.12);
    ctx.beginPath();
    arc(ctx, x, y, 2.5, 0, TAU);
    ctx.fill();
  }
}

/** Background circuit traces (screen px), animated by the living map. */
const traces: number[][] = [];
const motes = Array.from({ length: 36 }, (_, i) => ({ x: (i * 0.618) % 1, y: (i * 0.377) % 1, s: 0.6 + ((i * 7) % 5) / 4, v: 0.004 + ((i * 3) % 7) / 1200 }));

export function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function draw(ctx: CanvasRenderingContext2D, g: Game, v: View, bg: HTMLCanvasElement, dpr: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(bg, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  livingMap(ctx, g, v);
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
    arc(ctx, 0, 0, 125, 0, TAU);
    ctx.fill();
  }
  if (g.g.aura > 0) {
    ctx.strokeStyle = hexA(col, 0.25);
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 7]);
    ctx.lineDashOffset = -t * 30;
    ctx.beginPath();
    arc(ctx, 0, 0, 70 + 10 * g.g.aura, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawZones(ctx, g, t);
  drawWall(ctx, g, col, t);

  // Defender ring
  ctx.strokeStyle = hexA(col, 0.18);
  ctx.lineWidth = 1.5;
  ctx.setLineDash([2, 8]);
  ctx.lineDashOffset = -g.ring * 60;
  ctx.beginPath();
  arc(ctx, 0, 0, RING_R, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  drawChipLinks(ctx, g, t);
  // Links chip → its defenders
  ctx.lineWidth = 1.2;
  for (const d of g.defenders) {
    const P = chipPos(d.chip ?? 0);
    ctx.strokeStyle = hexA(DEF_INFO[d.kind].color, 0.22);
    ctx.beginPath();
    ctx.moveTo(P.x, P.y);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
  }

  drawSynergyLinks(ctx, g, t);
  drawCore(ctx, g, col, v.coreImg ?? null);
  drawChips(ctx, g, t);

  // Mortar targets
  for (const s of g.shots) {
    if (s.T === undefined) continue;
    const k = s.t! / s.T;
    ctx.strokeStyle = hexA('#ff5a5a', 0.25 + k * 0.5);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    arc(ctx, s.tx!, s.ty!, s.splash * (1 - k * 0.5), 0, TAU);
    ctx.stroke();
  }

  // Viruses
  for (const vv of g.viruses) drawVirus(ctx, vv, t);

  // Shots (additive glow)
  ctx.globalCompositeOperation = 'lighter';
  for (const s of g.shots) {
    const c = s.el ? ELEMENTS[s.el as Element].color : s.kind === 'core' ? col : s.kind === 'frag' ? '#ffd9a0' : DEF_INFO[s.kind].color;
    if (s.saw) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(t * 20);
      ctx.fillStyle = c;
      ctx.beginPath();
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * TAU;
        const rr = k % 2 ? s.r * 0.7 : s.r;
        if (k) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0b0c0e';
      ctx.beginPath();
      arc(ctx, 0, 0, s.r * 0.3, 0, TAU);
      ctx.fill();
      ctx.restore();
      continue;
    }
    if (s.prism) {
      const gr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 2.2);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.4, hexA(c, 0.8));
      gr.addColorStop(1, hexA(c, 0));
      ctx.fillStyle = gr;
      ctx.beginPath();
      arc(ctx, s.x, s.y, s.r * 2.2, 0, TAU);
      ctx.fill();
      continue;
    }
    if (s.T !== undefined) {
      const k = s.t! / s.T;
      const lift = Math.sin(k * Math.PI) * 26;
      ctx.fillStyle = c;
      ctx.beginPath();
      arc(ctx, s.x, s.y - lift, 4.5 + Math.sin(k * Math.PI) * 2, 0, TAU);
      ctx.fill();
      continue;
    }
    if (s.kind === 'bumeran') {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(t * 18);
      ctx.fillStyle = c;
      for (let k = 0; k < 2; k++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.ellipse(0, 0, s.r * 1.6, s.r * 0.45, 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
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
    arc(ctx, s.x, s.y, s.r, 0, TAU);
    ctx.fill();
  }

  // Beams, bolts, rings, particles
  for (const f of g.fx) {
    const a = Math.max(0, f.life / f.max);
    switch (f.k) {
      case 'beam': {
        const pulse = 1 + Math.sin(t * 50 + f.x1) * 0.25;
        const fade = f.max > 0.1 ? a : 1;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(f.x1, f.y1);
        ctx.lineTo(f.x2, f.y2);
        ctx.strokeStyle = hexA(f.c, 0.16 * fade);
        ctx.lineWidth = f.w * 6 * pulse;
        ctx.stroke();
        ctx.strokeStyle = hexA(f.c, 0.5 * fade);
        ctx.lineWidth = f.w * 2.4 * pulse;
        ctx.stroke();
        ctx.strokeStyle = hexA('#ffffff', 0.95 * fade);
        ctx.lineWidth = Math.max(1, f.w * 0.7);
        ctx.stroke();
        break;
      }
      case 'bolt': {
        // Lightning flickers: inner points jump every frame, with forks.
        const w = f.w ?? 3;
        const p = f.pts.slice();
        for (let i = 2; i < p.length - 2; i++) p[i] += (Math.random() - 0.5) * 7;
        const path = () => {
          ctx.beginPath();
          ctx.moveTo(p[0], p[1]);
          for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
        };
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        path();
        ctx.strokeStyle = hexA(f.c, 0.18 * a);
        ctx.lineWidth = w * 4.5;
        ctx.stroke();
        ctx.strokeStyle = hexA(f.c, 0.85 * a);
        ctx.lineWidth = w * 1.4;
        ctx.stroke();
        ctx.strokeStyle = hexA('#ffffff', a);
        ctx.lineWidth = Math.max(1, w * 0.45);
        ctx.stroke();
        ctx.strokeStyle = hexA(f.c, 0.7 * a);
        ctx.lineWidth = Math.max(1, w * 0.5);
        for (let i = 4; i < p.length - 2; i += 6) {
          const ang = Math.random() * TAU;
          const len = 8 + Math.random() * 14;
          ctx.beginPath();
          ctx.moveTo(p[i], p[i + 1]);
          ctx.lineTo(p[i] + Math.cos(ang) * len * 0.5 + (Math.random() - 0.5) * 6, p[i + 1] + Math.sin(ang) * len * 0.5 + (Math.random() - 0.5) * 6);
          ctx.lineTo(p[i] + Math.cos(ang) * len, p[i + 1] + Math.sin(ang) * len);
          ctx.stroke();
        }
        break;
      }
      case 'flash': {
        const r = f.r * (1.2 - a * 0.4);
        const gr = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
        gr.addColorStop(0, `rgba(255,255,255,${0.9 * a})`);
        gr.addColorStop(0.35, hexA(f.c, 0.6 * a));
        gr.addColorStop(1, hexA(f.c, 0));
        ctx.fillStyle = gr;
        ctx.beginPath();
        arc(ctx, f.x, f.y, r, 0, TAU);
        ctx.fill();
        break;
      }
      case 'ring': {
        const k = 1 - a;
        ctx.strokeStyle = hexA(f.c, a * 0.85);
        ctx.lineWidth = f.w * a + 0.5;
        ctx.beginPath();
        arc(ctx, f.x, f.y, f.r0 + (f.r1 - f.r0) * easeOut(k), 0, TAU);
        ctx.stroke();
        break;
      }
      case 'p':
        ctx.fillStyle = hexA(f.c, a);
        ctx.beginPath();
        arc(ctx, f.x, f.y, f.s * (0.4 + a * 0.6), 0, TAU);
        ctx.fill();
        break;
      case 'xp': {
        const k = easeIn(1 - a);
        const x = f.x * (1 - k);
        const y = f.y * (1 - k);
        ctx.fillStyle = hexA(col, 0.9);
        ctx.beginPath();
        arc(ctx, x, y, 2.4, 0, TAU);
        ctx.fill();
        break;
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over';

  drawStructures(ctx, g, col, t);
  // Defenders on top
  for (const d of g.defenders) drawDrones(ctx, d, t);
  for (const d of g.defenders) drawDefender(ctx, d, g);
  for (const d of g.defenders) {
    if (!d.stun || d.stun <= 0) continue;
    ctx.fillStyle = 'rgba(40,40,48,0.6)';
    ctx.beginPath();
    arc(ctx, d.x, d.y, 15, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#ffd60a';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) ctx.lineTo(d.x - 10 + k * 4, d.y - 18 + (k % 2 ? -4 : 0) + Math.sin(t * 30) * 1);
    ctx.stroke();
  }

  // Floating crit numbers
  ctx.textAlign = 'center';
  for (const f of g.fx) {
    if (f.k !== 'txt') continue;
    const big = f.max > 1;
    const z = f.z ? f.z * (1 + Math.max(0, f.life / f.max - 0.75) * 1.5) : big ? 14 : 11;
    ctx.font = `700 ${Math.round(z)}px "Space Grotesk", Inter, sans-serif`;
    const al = Math.min(1, (f.life / f.max) * 1.6);
    if (big) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = `rgba(11,12,14,${0.8 * al})`;
      ctx.strokeText(f.s, f.x, f.y - (1 - f.life / f.max) * 10);
    }
    ctx.fillStyle = hexA(f.c, al);
    ctx.fillText(f.s, f.x, f.y - (big ? (1 - f.life / f.max) * 10 : 0));
  }
  ctx.restore();

  // «Apagón»: darkness except around the core.
  if (g.mod === 'apagon' && g.phase === 'wave') {
    const cx = v.w / 2;
    const cy = v.h / 2;
    const r = 170 * v.scale;
    const dk = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.3);
    dk.addColorStop(0, 'rgba(0,0,0,0)');
    dk.addColorStop(1, 'rgba(0,0,0,0.93)');
    ctx.fillStyle = dk;
    ctx.fillRect(0, 0, v.w, v.h);
  }
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

function drawCore(ctx: CanvasRenderingContext2D, g: Game, col: string, img: HTMLImageElement | null) {
  const t = g.t;
  const frac = Math.max(0, g.hp / g.maxHp);
  const pulse = 1 + Math.sin(t * 3) * 0.04;
  // The core grows with every defender on its ring and with each evolution.
  const n = g.defenders.filter((d) => !d.chip).length;
  const evo = g.g.coreEvo;
  const grow = 1 + Math.max(0, n - 1) * 0.045 + evo * 0.22;
  const R0 = CORE_R * grow;
  // Glow
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, R0 * (3 + evo));
  glow.addColorStop(0, hexA(evo ? '#ffd60a' : col, 0.3 + n * 0.015));
  glow.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  arc(ctx, 0, 0, R0 * (3 + evo), 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // Evolution halos
  if (evo >= 1) {
    ctx.save();
    ctx.rotate(t * 0.6);
    ctx.strokeStyle = hexA('#ffd60a', 0.6);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    arc(ctx, 0, 0, R0 + 30, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      ctx.fillStyle = k % 2 ? '#ffd60a' : col;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (R0 + 30), Math.sin(a) * (R0 + 30) - 4);
      ctx.lineTo(Math.cos(a) * (R0 + 30) + 3, Math.sin(a) * (R0 + 30));
      ctx.lineTo(Math.cos(a) * (R0 + 30), Math.sin(a) * (R0 + 30) + 4);
      ctx.lineTo(Math.cos(a) * (R0 + 30) - 3, Math.sin(a) * (R0 + 30));
      ctx.fill();
    }
    ctx.restore();
  }
  if (evo >= 2) {
    ctx.save();
    ctx.rotate(-t * 0.9);
    ctx.strokeStyle = hexA('#ff5f8f', 0.55);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, R0 + 40, R0 + 16, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  // Integrity ring
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  arc(ctx, 0, 0, R0 + 10, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = frac > 0.35 ? col : '#ff3b3b';
  ctx.beginPath();
  arc(ctx, 0, 0, R0 + 10, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
  ctx.stroke();
  // One lit segment per defender on the ring (1 to 10)
  for (let k = 0; k < 10; k++) {
    const a0 = -Math.PI / 2 + (k / 10) * TAU + 0.06;
    const a1 = -Math.PI / 2 + ((k + 1) / 10) * TAU - 0.06;
    const d = g.defenders.filter((x) => !x.chip)[k];
    ctx.strokeStyle = d ? DEF_INFO[d.kind].color : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = d ? 3 : 1.5;
    ctx.beginPath();
    arc(ctx, 0, 0, R0 + 17, a0, a1);
    ctx.stroke();
  }
  // Shield bubbles
  for (let k = 0; k < g.g.shieldMax; k++) {
    const a = -Math.PI / 2 + (k + 0.5) * (TAU / g.g.shieldMax) + t * 0.5;
    ctx.fillStyle = k < g.g.shield ? '#8af3ff' : 'rgba(138,243,255,0.18)';
    ctx.beginPath();
    arc(ctx, Math.cos(a) * (R0 + 24), Math.sin(a) * (R0 + 24), 3, 0, TAU);
    ctx.fill();
  }
  // Chip body: your own chip when it's available
  ctx.save();
  ctx.rotate(Math.sin(t * 0.6) * 0.08);
  ctx.scale(pulse, pulse);
  const s = R0 * 0.95;
  if (img) {
    const S = s * 1.6;
    ctx.drawImage(img, -S, -S, S * 2, S * 2);
    if (g.hurt > 0) {
      ctx.fillStyle = `rgba(255,59,59,${g.hurt * 0.5})`;
      roundRect(ctx, -s, -s, s * 2, s * 2, 6);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  ctx.strokeStyle = 'rgba(160,168,180,0.75)';
  ctx.lineWidth = 2;
  const pins = 2 + Math.ceil(n / 3);
  for (let k = -pins; k <= pins; k++) {
    const p = (k * s) / (pins + 0.7);
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
  ctx.strokeStyle = evo ? '#ffd60a' : col;
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
    arc(ctx, x2, y2, v.boss ? 3.4 : 1.9, 0, TAU);
    ctx.fill();
  }
  // Body
  ctx.beginPath();
  arc(ctx, 0, 0, r, 0, TAU);
  ctx.fillStyle = hexA(c, 0.28);
  ctx.fill();
  ctx.lineWidth = v.boss ? 3.2 : 2;
  ctx.strokeStyle = c;
  ctx.stroke();
  // Nucleus
  ctx.beginPath();
  arc(ctx, r * 0.18, -r * 0.12, r * 0.38, 0, TAU);
  ctx.fillStyle = hexA(c, 0.75);
  ctx.fill();
  if (v.boss) {
    ctx.beginPath();
    arc(ctx, -r * 0.3, r * 0.3, r * 0.18, 0, TAU);
    ctx.fill();
  }
  if (v.el && !v.hidden) {
    const ec = ELEMENTS[v.el as Element].color;
    ctx.fillStyle = ec;
    ctx.strokeStyle = '#0b0c0e';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    arc(ctx, r * 0.95, -r * 0.95, Math.max(2.4, r * 0.28), 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  if (v.vuln) {
    ctx.strokeStyle = `rgba(255,122,217,${0.55 + Math.sin(t * 10) * 0.25})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + t;
      ctx.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5);
    }
    ctx.closePath();
    ctx.stroke();
  }
  if (v.bubble) {
    const gr = ctx.createRadialGradient(-r * 0.4, -r * 0.4, 0, 0, 0, r * 2);
    gr.addColorStop(0, 'rgba(255,255,255,0.45)');
    gr.addColorStop(0.6, 'rgba(159,240,255,0.15)');
    gr.addColorStop(1, 'rgba(159,240,255,0.5)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    arc(ctx, 0, 0, r * 2, 0, TAU);
    ctx.fill();
  }
  if (v.hacked) {
    ctx.strokeStyle = '#3dff6e';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    arc(ctx, (Math.random() - 0.5) * 2, 0, r * 1.3, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (v.mark) {
    ctx.strokeStyle = `rgba(230,253,255,${0.6 + Math.sin(t * 20) * 0.3})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    arc(ctx, 0, 0, r * 1.6, 0, TAU);
    ctx.moveTo(-r * 2, 0);
    ctx.lineTo(r * 2, 0);
    ctx.moveTo(0, -r * 2);
    ctx.lineTo(0, r * 2);
    ctx.stroke();
  }
  if (v.infect) {
    ctx.fillStyle = 'rgba(93,255,168,0.85)';
    for (let k = 0; k < 4; k++) {
      const a = t * 3 + k * 1.6;
      ctx.beginPath();
      arc(ctx, Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, 1.6, 0, TAU);
      ctx.fill();
    }
  }
  if (v.root) {
    ctx.strokeStyle = 'rgba(61,255,154,0.8)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + 0.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 1.8, Math.sin(a) * r * 1.8);
      ctx.quadraticCurveTo(Math.cos(a + 0.6) * r, Math.sin(a + 0.6) * r, 0, 0);
      ctx.stroke();
    }
  }
  if (v.rewind) {
    ctx.strokeStyle = 'rgba(196,139,255,0.8)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    arc(ctx, 0, 0, r * 1.4, t * 6, t * 6 + 4);
    ctx.stroke();
  }
  if (v.t > 25 && !v.hidden) {
    // Enraged: red pulsing halo
    ctx.strokeStyle = `rgba(255,40,60,${0.45 + Math.sin(t * 12 + v.id) * 0.25})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    arc(ctx, 0, 0, r * 1.25, 0, TAU);
    ctx.stroke();
  }
  if (v.flash > 0) {
    ctx.beginPath();
    arc(ctx, 0, 0, r, 0, TAU);
    ctx.fillStyle = `rgba(255,255,255,${v.flash * 7})`;
    ctx.fill();
  }
  ctx.rotate(-v.spin);
  if (v.shield > 0) {
    ctx.strokeStyle = 'rgba(120,170,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    arc(ctx, 0, 0, r * 1.55, 0, TAU);
    ctx.stroke();
  }
  if (v.elite) {
    ctx.strokeStyle = '#ffd60a';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    arc(ctx, 0, 0, r * 1.7, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (v.slowT > 0) {
    ctx.strokeStyle = 'rgba(138,243,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    arc(ctx, 0, 0, r * 1.15, 0, TAU);
    ctx.stroke();
  }
  if (v.burnT > 0) {
    ctx.fillStyle = 'rgba(255,138,31,0.9)';
    for (let k = 0; k < 3; k++) {
      const a = t * 5 + k * 2.1;
      ctx.beginPath();
      arc(ctx, Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9 - 2, 1.6, 0, TAU);
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
  const c2 = d.fuse ? DEF_INFO[d.fuse.kind].color : c;
  const tier = d.fuse ? 3 : d.evo.length;
  const R = 9 + tier * 2 + Math.min(4, d.lvl * 0.35);
  const kick = (d.recoil ?? 0) * 3;
  const t = g.t;
  const s = d.stats;
  // Orbiting blades (drawn around the defender)
  const beh = behOf(d.kind);
  if (d.kind === 'espejo') {
    const n = Math.round(s.count);
    const rr = s.range * g.g.rangeMul;
    for (let b = 0; b < n; b++) {
      const a = d.spin + (b * TAU) / n;
      ctx.save();
      ctx.translate(d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr);
      ctx.rotate(a);
      const gr = ctx.createLinearGradient(0, -12, 0, 12);
      gr.addColorStop(0, 'rgba(230,253,255,0.9)');
      gr.addColorStop(0.5, 'rgba(125,249,255,0.5)');
      gr.addColorStop(1, 'rgba(230,253,255,0.9)');
      ctx.fillStyle = gr;
      ctx.fillRect(-2.5, -12, 5, 24);
      ctx.restore();
    }
  }
  if (beh === 'cuchillas') {
    const n = Math.round(s.count);
    const rr = s.range * g.g.rangeMul;
    ctx.strokeStyle = hexA(c, 0.15);
    ctx.lineWidth = 1;
    ctx.beginPath();
    arc(ctx, d.x, d.y, rr, 0, TAU);
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
  if (beh === 'pulso' && d.flags.field) {
    ctx.fillStyle = hexA(c, 0.07 + Math.sin(t * 6) * 0.03);
    ctx.beginPath();
    arc(ctx, d.x, d.y, s.range * g.g.rangeMul, 0, TAU);
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
    arc(ctx, 0, 0, R * 2.4, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  if (tier === 3) {
    // Legendary fusion: two counter-rotating rings in both colours and a crown.
    ctx.save();
    ctx.rotate(-t * 2);
    ctx.strokeStyle = c2;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    arc(ctx, 0, 0, R + 10, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    ctx.fillStyle = '#ffd60a';
    ctx.beginPath();
    ctx.moveTo(-6, -R - 4);
    ctx.lineTo(-3, -R - 10);
    ctx.lineTo(0, -R - 5);
    ctx.lineTo(3, -R - 10);
    ctx.lineTo(6, -R - 4);
    ctx.closePath();
    ctx.fill();
  }
  if (tier >= 2) {
    ctx.save();
    ctx.rotate(t * 1.5);
    ctx.strokeStyle = c;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    arc(ctx, 0, 0, R + 6, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  // Barrels
  ctx.save();
  ctx.rotate(d.aim);
  const barrels = ['canon', 'hielo', 'misil', 'mortero', 'acido'].includes(beh) ? Math.min(5, Math.max(1, Math.round(s.count))) : 0;
  ctx.fillStyle = c;
  for (let b = 0; b < barrels; b++) {
    const off = (b - (barrels - 1) / 2) * 3.4;
    const len = (beh === 'mortero' ? R + 3 : R + 7 + tier * 2) - kick;
    const wid = beh === 'mortero' ? 7 : beh === 'misil' ? 4 : 2.8;
    ctx.fillRect(0, off - wid / 2, len, wid);
  }
  if (beh === 'laser') {
    ctx.beginPath();
    ctx.moveTo(R + 8, 0);
    ctx.lineTo(R - 2, -4);
    ctx.lineTo(R - 2, 4);
    ctx.closePath();
    ctx.fill();
  }
  if (beh === 'francotirador') {
    ctx.fillRect(0, -1.3, R + 16, 2.6);
    ctx.fillRect(R + 2, -3, 4, 6);
  }
  if (beh === 'llamas') {
    ctx.beginPath();
    ctx.moveTo(R - 2, -3);
    ctx.lineTo(R + 7, -6);
    ctx.lineTo(R + 7, 6);
    ctx.lineTo(R - 2, 3);
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
  } else arc(ctx, 0, 0, R, 0, TAU);
  ctx.fillStyle = '#121418';
  ctx.fill();
  if (d.fuse) {
    const gr = ctx.createLinearGradient(-R, -R, R, R);
    gr.addColorStop(0, c);
    gr.addColorStop(1, c2);
    ctx.strokeStyle = gr;
    ctx.lineWidth = 3;
  } else {
    ctx.strokeStyle = c;
    ctx.lineWidth = 2.2;
  }
  ctx.stroke();
  // Kind glyph (a fusion shows both halves)
  if (d.fuse) {
    ctx.save();
    ctx.translate(-R * 0.25, 0);
    glyph(ctx, d.kind, c, R * 0.75, t);
    ctx.translate(R * 0.5, 0);
    glyph(ctx, d.fuse.kind, c2, R * 0.75, t);
    ctx.restore();
  } else glyph(ctx, beh, c, R, t);
  ctx.fillStyle = c;
  pips(ctx, d, R);
  // Ultimate charge and element
  const ch = d.ult ?? 0;
  ctx.strokeStyle = ch >= 1 ? '#ffffff' : hexA(c, 0.85);
  ctx.lineWidth = ch >= 1 ? 2.4 : 1.6;
  ctx.beginPath();
  arc(ctx, 0, 0, R + 7, -Math.PI / 2, -Math.PI / 2 + TAU * ch);
  ctx.stroke();
  ctx.fillStyle = ELEMENTS[DEF_EL[d.kind]].color;
  ctx.beginPath();
  arc(ctx, R * 0.75, -R * 0.75, 2.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function glyph(ctx: CanvasRenderingContext2D, kind: DefKind, c: string, R: number, t: number) {
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  ctx.lineWidth = 1.8;
  const k = R * 0.45;
  ctx.beginPath();
  switch (kind) {
    case 'canon':
      arc(ctx, 0, 0, k * 0.7, 0, TAU);
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
      arc(ctx, 0, 0, k * 0.4, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      arc(ctx, 0, 0, k * (0.8 + ((t * 1.5) % 1) * 0.4), 0, TAU);
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
      arc(ctx, 0, 0, k * 0.5, 0, TAU);
      ctx.fill();
      break;
    case 'mortero':
      arc(ctx, 0, 0, k * 0.8, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      arc(ctx, 0, 0, k * 0.3, 0, TAU);
      ctx.fill();
      break;
    case 'francotirador':
      arc(ctx, 0, 0, k * 0.75, 0, TAU);
      ctx.moveTo(-k, 0);
      ctx.lineTo(k, 0);
      ctx.moveTo(0, -k);
      ctx.lineTo(0, k);
      ctx.stroke();
      break;
    case 'llamas':
      ctx.moveTo(0, -k);
      ctx.quadraticCurveTo(k * 0.9, 0, 0, k);
      ctx.quadraticCurveTo(-k * 0.9, 0, 0, -k);
      ctx.fill();
      break;
    case 'gravedad':
      arc(ctx, 0, 0, k * 0.45, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 0, k, k * 0.45, t * 2, 0, TAU);
      ctx.stroke();
      break;
    case 'drones':
      for (let j = 0; j < 3; j++) {
        const a = (j / 3) * TAU - Math.PI / 2;
        ctx.moveTo(Math.cos(a) * k, Math.sin(a) * k);
        arc(ctx, Math.cos(a) * k * 0.7, Math.sin(a) * k * 0.7, k * 0.28, 0, TAU);
      }
      ctx.fill();
      break;
    case 'acido':
      ctx.moveTo(0, -k);
      ctx.quadraticCurveTo(k, k * 0.3, 0, k);
      ctx.quadraticCurveTo(-k, k * 0.3, 0, -k);
      ctx.fill();
      break;
    case 'bumeran':
      ctx.moveTo(-k, -k * 0.6);
      ctx.lineTo(0, k * 0.4);
      ctx.lineTo(k, -k * 0.6);
      ctx.lineWidth = 2.4;
      ctx.stroke();
      break;
    case 'minas':
      arc(ctx, 0, 0, k * 0.55, 0, TAU);
      ctx.fill();
      for (let j = 0; j < 4; j++) {
        const a = (j / 4) * TAU + Math.PI / 4;
        ctx.moveTo(Math.cos(a) * k * 0.55, Math.sin(a) * k * 0.55);
        ctx.lineTo(Math.cos(a) * k, Math.sin(a) * k);
      }
      ctx.stroke();
      break;
    case 'cronos':
      arc(ctx, 0, 0, k * 0.85, 0, TAU);
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(t * 3) * k * 0.7, Math.sin(t * 3) * k * 0.7);
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -k * 0.5);
      ctx.stroke();
      break;
    default: {
      // Exclusive defenders: a star whose points depend on the type.
      const pts = 3 + (kind.length % 5);
      for (let j = 0; j < pts * 2; j++) {
        const a = (j / (pts * 2)) * TAU + t * 0.8;
        const rr = j % 2 ? k * 0.45 : k;
        if (j) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
}

function pips(ctx: CanvasRenderingContext2D, d: Defender, R: number) {
  const pips = Math.min(10, d.lvl);
  for (let p = 0; p < pips; p++) {
    const a = Math.PI / 2 + (p - (pips - 1) / 2) * 0.32;
    ctx.beginPath();
    arc(ctx, Math.cos(a) * (R + 4), Math.sin(a) * (R + 4), 1.3, 0, TAU);
    ctx.fill();
  }
}

// ── Structures, zones, drones and synergy links ───────────────────────────
function drawWall(ctx: CanvasRenderingContext2D, g: Game, col: string, t: number) {
  const G = g.g;
  const S = structs(g);
  if (S.auraR > 0) {
    const gr = ctx.createRadialGradient(0, 0, CORE_R, 0, 0, S.auraR);
    gr.addColorStop(0, hexA(col, 0));
    gr.addColorStop(0.85, hexA(col, 0.05 + G.aura * 0.015 + Math.sin(t * 4) * 0.02));
    gr.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = gr;
    ctx.beginPath();
    arc(ctx, 0, 0, S.auraR, 0, TAU);
    ctx.fill();
  }
  if (G.wallMax <= 0 && G.thorns <= 0) return;
  const wl = g.taken.filter((x) => x === 'muro').length;
  const tierCol = wl >= 7 ? '#ffd60a' : wl >= 4 ? '#9fb8d6' : col;
  const segs = 36;
  const frac = G.wallMax > 0 ? G.wall / G.wallMax : 0;
  if (G.wallMax > 0) {
    const rings = wl >= 6 ? [WALL_R, WALL_R - S.wallW - 3] : [WALL_R];
    for (const R of rings) {
      for (let k = 0; k < segs; k++) {
        const a0 = (k / segs) * TAU + 0.025;
        const a1 = ((k + 1) / segs) * TAU - 0.025;
        const alive = k / segs < frac || frac >= 1;
        ctx.strokeStyle = G.wall > 0 ? (alive ? hexA(tierCol, 0.9) : hexA(tierCol, 0.22)) : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = G.wall > 0 ? (R === WALL_R ? S.wallW : S.wallW * 0.6) : 2;
        ctx.beginPath();
        arc(ctx, 0, 0, R, a0, a1);
        ctx.stroke();
      }
    }
    // Rivets on steel and gold walls
    if (G.wall > 0 && wl >= 4) {
      ctx.fillStyle = hexA('#ffffff', 0.55);
      for (let k = 0; k < segs; k += 2) {
        const a = ((k + 0.5) / segs) * TAU;
        ctx.beginPath();
        arc(ctx, Math.cos(a) * WALL_R, Math.sin(a) * WALL_R, 1.2, 0, TAU);
        ctx.fill();
      }
    }
    if (G.asc.includes('asc-muro') && G.wall > 0) {
      ctx.strokeStyle = hexA('#ffd60a', 0.25 + Math.sin(t * 3) * 0.1);
      ctx.lineWidth = 2;
      ctx.beginPath();
      arc(ctx, 0, 0, WALL_R + S.wallW, 0, TAU);
      ctx.stroke();
    }
  }
  if (S.thornN > 0) {
    const T = G.thorns;
    const c = T >= 7 ? '#ff2d55' : T >= 5 ? '#b6ff3d' : T >= 4 ? '#d6dde6' : '#ff8a9c';
    ctx.fillStyle = hexA(c, 0.92);
    for (let row = 0; row < S.thornRows; row++) {
      const n = S.thornN - row * 8;
      const len = S.thornLen * (row ? 0.65 : 1);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + t * 0.15 * (row ? -1 : 1) + row * 0.1;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const b = WALL_R + S.wallW / 2 + row * 4;
        const wob = 1 + Math.sin(t * 5 + k) * 0.08;
        ctx.beginPath();
        ctx.moveTo(ca * b - sa * 2.6, sa * b + ca * 2.6);
        ctx.lineTo(ca * (b + len * wob), sa * (b + len * wob));
        ctx.lineTo(ca * b + sa * 2.6, sa * b - ca * 2.6);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
}

function drawStructures(ctx: CanvasRenderingContext2D, g: Game, col: string, t: number) {
  const G = g.g;
  const S = structs(g);
  if (S.faroBeams > 0) {
    ctx.globalCompositeOperation = 'lighter';
    for (let b = 0; b < S.faroBeams; b++) {
      const a = G.faroA + (b * TAU) / S.faroBeams;
      const x = Math.cos(a) * 320;
      const y = Math.sin(a) * 320;
      const gr = ctx.createLinearGradient(0, 0, x, y);
      const c = G.faro >= 6 || G.asc.includes('asc-faro') ? '#fff3c4' : col;
      gr.addColorStop(0, hexA(c, 0.75));
      gr.addColorStop(1, hexA(c, 0));
      ctx.strokeStyle = gr;
      ctx.lineCap = 'round';
      ctx.lineWidth = S.faroW * 2.4;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = S.faroW;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = Math.max(1.2, S.faroW * 0.25);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  if (G.orbit > 0) {
    const rings: [number, number, number][] = [[S.orbitIn, ORBIT_R, 1]];
    if (S.orbitOut) rings.push([S.orbitOut, ORBIT_R + 42, -1]);
    const hot = G.orbit >= 6;
    for (const [n, R, dir] of rings) {
      ctx.strokeStyle = hexA(hot ? '#ff8a1f' : '#e8f6ff', 0.1);
      ctx.lineWidth = 1;
      ctx.beginPath();
      arc(ctx, 0, 0, R, 0, TAU);
      ctx.stroke();
      for (let b = 0; b < n; b++) {
        const a = G.orbitA * dir + (b * TAU) / n;
        const bx = Math.cos(a) * R;
        const by = Math.sin(a) * R;
        // motion trail
        ctx.strokeStyle = hexA(hot ? '#ff8a1f' : '#e8f6ff', 0.25);
        ctx.lineWidth = S.orbitSize * 0.6;
        ctx.beginPath();
        arc(ctx, 0, 0, R, a - 0.18 * dir, a, dir < 0);
        ctx.stroke();
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(a + t * 12 * dir);
        ctx.fillStyle = hot ? '#ffb347' : '#e8f6ff';
        const z = S.orbitSize;
        ctx.beginPath();
        ctx.moveTo(0, -z);
        ctx.lineTo(z * 0.35, 0);
        ctx.lineTo(0, z);
        ctx.lineTo(-z * 0.35, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }
  if (S.sats > 0) {
    for (let k = 0; k < S.sats; k++) {
      const sa = g.t * 1.4 * (k % 2 ? -1 : 1) + (k * TAU) / S.sats;
      const R = 36 + (k % 3) * 10;
      const x = Math.cos(sa) * R;
      const y = Math.sin(sa) * R;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(sa);
      ctx.fillStyle = col;
      ctx.fillRect(-2.5, -2.5, 5, 5);
      ctx.fillStyle = hexA(col, 0.6);
      ctx.fillRect(-8, -1.5, 4, 3);
      ctx.fillRect(4, -1.5, 4, 3);
      ctx.restore();
    }
  }
}

/** The living map: energy flowing along the circuit to the core, drifting dust, a heartbeat and a danger tint. */
function livingMap(ctx: CanvasRenderingContext2D, g: Game, v: View) {
  const t = g.t;
  const danger = Math.min(1, Math.max(0, (g.wave - 1) / 35));
  const boss = g.viruses.some((x) => x.boss);
  const pc = danger > 0.6 || boss ? '#ff5a7a' : v.color;
  ctx.globalCompositeOperation = 'lighter';
  traces.forEach((pts, i) => {
    let total = 0;
    const seg: number[] = [];
    for (let k = 2; k < pts.length; k += 2) {
      const l = Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]);
      seg.push(l);
      total += l;
    }
    for (let pkt = 0; pkt < 2; pkt++) {
      // Packets travel inwards, towards the core.
      let d = (1 - ((t * (0.12 + (i % 5) * 0.02) + i * 0.37 + pkt * 0.5) % 1)) * total;
      let k = 0;
      while (k < seg.length && d > seg[k]) d -= seg[k++];
      if (k >= seg.length) continue;
      const f = d / seg[k];
      const x = pts[k * 2] + (pts[k * 2 + 2] - pts[k * 2]) * f;
      const y = pts[k * 2 + 1] + (pts[k * 2 + 3] - pts[k * 2 + 1]) * f;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, 7);
      gr.addColorStop(0, hexA(pc, 0.55));
      gr.addColorStop(1, hexA(pc, 0));
      ctx.fillStyle = gr;
      ctx.beginPath();
      arc(ctx, x, y, 7, 0, TAU);
      ctx.fill();
    }
  });
  // Dust
  ctx.fillStyle = hexA(v.color, 0.18);
  for (const m of motes) {
    const x = ((m.x + t * m.v) % 1) * v.w;
    const y = ((m.y + Math.sin(t * 0.3 + m.x * 9) * 0.02 + 1) % 1) * v.h;
    ctx.beginPath();
    arc(ctx, x, y, m.s, 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  // Heartbeat ripple from the core
  const beat = (t % 1.6) / 1.6;
  ctx.strokeStyle = hexA(v.color, 0.08 * (1 - beat));
  ctx.lineWidth = 2;
  ctx.beginPath();
  arc(ctx, v.w / 2, v.h / 2, (CORE_R + beat * 260) * v.scale, 0, TAU);
  ctx.stroke();
  // Danger tint at the edges (stronger late, pulsing red with a boss)
  const edge = (danger * 0.14 + (boss ? 0.1 + Math.sin(t * 4) * 0.06 : 0));
  if (edge > 0.01) {
    const r = ctx.createRadialGradient(v.w / 2, v.h / 2, Math.min(v.w, v.h) * 0.35, v.w / 2, v.h / 2, Math.max(v.w, v.h) * 0.75);
    r.addColorStop(0, 'rgba(255,40,80,0)');
    r.addColorStop(1, `rgba(255,40,80,${edge})`);
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, v.w, v.h);
  }
}

function drawZones(ctx: CanvasRenderingContext2D, g: Game, t: number) {
  for (const z of g.zones) {
    const a = Math.min(1, z.t / 0.4, (z.max - z.t) / 0.2 + 0.2);
    if (z.k === 'acid') {
      ctx.fillStyle = `rgba(182,255,61,${0.16 * a})`;
      ctx.beginPath();
      for (let k = 0; k <= 12; k++) {
        const an = (k / 12) * TAU;
        const r = z.r * (0.85 + Math.sin(an * 3 + t * 2 + z.x) * 0.12);
        if (k) ctx.lineTo(z.x + Math.cos(an) * r, z.y + Math.sin(an) * r);
        else ctx.moveTo(z.x + Math.cos(an) * r, z.y + Math.sin(an) * r);
      }
      ctx.fill();
      ctx.strokeStyle = `rgba(182,255,61,${0.5 * a})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = `rgba(220,255,140,${0.7 * a})`;
      for (let k = 0; k < 3; k++) {
        const bt = (t * 1.5 + k * 0.33) % 1;
        ctx.beginPath();
        arc(ctx, z.x + Math.cos(k * 2.1 + z.y) * z.r * 0.5, z.y + Math.sin(k * 2.1 + z.x) * z.r * 0.5 - bt * 6, 1.5 + bt * 1.5, 0, TAU);
        ctx.fill();
      }
    } else if (z.k === 'well') {
      const gr = ctx.createRadialGradient(z.x, z.y, 0, z.x, z.y, z.r * 1.35);
      gr.addColorStop(0, `rgba(0,0,0,${0.95 * a})`);
      gr.addColorStop(0.35, `rgba(60,30,120,${0.6 * a})`);
      gr.addColorStop(1, 'rgba(60,30,120,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      arc(ctx, z.x, z.y, z.r * 1.35, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(157,123,255,${0.7 * a})`;
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.ellipse(z.x, z.y, z.r * (0.4 + k * 0.25), z.r * (0.2 + k * 0.12), -t * (2 + k) + k, 0, TAU);
        ctx.stroke();
      }
    } else if (z.k === 'decoy') {
      // A flickering hologram of the core.
      ctx.globalAlpha = 0.55 + Math.sin(t * 25 + z.x) * 0.2;
      ctx.strokeStyle = '#9fd3ff';
      ctx.lineWidth = 2;
      roundRect(ctx, z.x - 11, z.y - 11, 22, 22, 5);
      ctx.stroke();
      ctx.fillStyle = 'rgba(159,211,255,0.2)';
      ctx.fill();
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = 'rgba(159,211,255,0.35)';
        ctx.fillRect(z.x - 11, z.y - 9 + ((t * 30 + k * 7) % 18), 22, 1.2);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(z.x - 12, z.y + 15, 24, 3);
      ctx.fillStyle = '#9fd3ff';
      ctx.fillRect(z.x - 12, z.y + 15, 24 * Math.max(0, z.dps / z.max), 3);
    } else if (z.k === 'eclipse') {
      const gr = ctx.createRadialGradient(z.x, z.y, z.r * 0.3, z.x, z.y, z.r * 1.2);
      gr.addColorStop(0, 'rgba(0,0,0,0.85)');
      gr.addColorStop(0.8, 'rgba(40,20,110,0.5)');
      gr.addColorStop(1, 'rgba(107,77,255,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      arc(ctx, z.x, z.y, z.r * 1.2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(200,180,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      arc(ctx, z.x, z.y, z.r * 0.8, t * 2, t * 2 + 4.5);
      ctx.stroke();
    } else if (z.k === 'plant') {
      // A living turret: a bulb with leaves.
      const grow = Math.min(1, (z.max - z.t) / 0.4) * Math.min(1, z.t / 0.6 + 0.2);
      ctx.save();
      ctx.translate(z.x, z.y);
      ctx.fillStyle = 'rgba(182,255,61,0.75)';
      for (let k = 0; k < 5; k++) {
        ctx.rotate((Math.PI * 2) / 5);
        ctx.beginPath();
        ctx.ellipse(0, -9 * grow, 3.5 * grow, 8 * grow, 0, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#3dff9a';
      ctx.beginPath();
      arc(ctx, 0, 0, 5 * grow + Math.sin(t * 6) * 0.8, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else {
      const blink = Math.sin(t * 8 + z.x) > 0;
      ctx.save();
      ctx.translate(z.x, z.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = z.src === -1 ? '#c8ff2e' : '#ff4f6d';
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
      if (blink) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        arc(ctx, z.x, z.y, 1.6, 0, TAU);
        ctx.fill();
      }
      if (z.pull) {
        ctx.strokeStyle = 'rgba(255,79,109,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        arc(ctx, z.x, z.y, 18 + ((t * 30) % 40), 0, TAU);
        ctx.stroke();
      }
    }
  }
}

function drawDrones(ctx: CanvasRenderingContext2D, d: Defender, t: number) {
  for (const [list, kind] of [[d.drones, d.kind], [(d.fuse as { drones?: Defender['drones'] } | undefined)?.drones, d.fuse?.kind]] as const) {
    if (!list || !kind) continue;
    const c = DEF_INFO[kind].color;
    for (const dr of list) {
      ctx.save();
      ctx.translate(dr.x, dr.y);
      ctx.rotate(dr.a + Math.PI / 2);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(4, 4);
      ctx.lineTo(0, 2);
      ctx.lineTo(-4, 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = hexA(c, 0.35 + Math.sin(t * 20) * 0.2);
      ctx.beginPath();
      arc(ctx, 0, 5, 2, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
}

/** Glowing arcs between defenders whose synergy is active. */
function drawSynergyLinks(ctx: CanvasRenderingContext2D, g: Game, t: number) {
  if (!g.syn.length) return;
  const find = (k: DefKind) => g.defenders.find((d) => d.kind === k || d.fuse?.kind === k);
  ctx.globalCompositeOperation = 'lighter';
  for (const id of g.syn) {
    const sy = SYNERGIES.find((s) => s.id === id);
    if (!sy) continue;
    const A = find(sy.a);
    const B = find(sy.b);
    if (!A || !B || A === B) continue;
    const gr = ctx.createLinearGradient(A.x, A.y, B.x, B.y);
    gr.addColorStop(0, hexA(DEF_INFO[sy.a].color, 0.6));
    gr.addColorStop(1, hexA(DEF_INFO[sy.b].color, 0.6));
    const adj = g.synAdj.includes(id);
    ctx.strokeStyle = gr;
    ctx.lineWidth = adj ? 3.5 : 2;
    ctx.setLineDash(adj ? [10, 4] : [4, 6]);
    ctx.lineDashOffset = -t * (adj ? 70 : 40);
    ctx.beginPath();
    const mx = (A.x + B.x) * 0.25;
    const my = (A.y + B.y) * 0.25;
    ctx.moveTo(A.x, A.y);
    ctx.quadraticCurveTo(mx, my, B.x, B.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** Energy links from the main chip to the outposts. */
function drawChipLinks(ctx: CanvasRenderingContext2D, g: Game, t: number) {
  for (let k = 1; k < g.chips; k++) {
    const P = chipPos(k);
    const c = CHIPS[k - 1].color;
    if (k === TWIN) {
      // The burning beam between the two main cores.
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const [w, a] of [[16, 0.15], [7, 0.5], [2.5, 1]] as const) {
        ctx.strokeStyle = a === 1 ? '#ffffff' : hexA(c, a * (0.8 + Math.random() * 0.4));
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(P.x, P.y);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      continue;
    }
    ctx.strokeStyle = hexA(c, 0.25);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(P.x, P.y);
    ctx.stroke();
    ctx.strokeStyle = hexA(c, 0.8);
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 10]);
    ctx.lineDashOffset = -t * 60;
    ctx.stroke();
    ctx.setLineDash([]);
    // Packets travelling both ways
    ctx.fillStyle = '#ffffff';
    for (let j = 0; j < 2; j++) {
      const f = (t * 0.6 + j * 0.5) % 1;
      const ff = j ? 1 - f : f;
      ctx.beginPath();
      arc(ctx, P.x * ff, P.y * ff, 2.4, 0, TAU);
      ctx.fill();
    }
  }
}

/** The extra chips: smaller bodies in their own colour, with their ring. */
function drawChips(ctx: CanvasRenderingContext2D, g: Game, t: number) {
  for (let k = 1; k < g.chips; k++) {
    const P = chipPos(k);
    const ch = CHIPS[k - 1];
    const c = ch.color;
    const L = g.taken.filter((x) => x === `chipup-${ch.id}`).length;
    const twin = k === TWIN;
    const ringR = twin ? 52 : 40;
    ctx.save();
    ctx.translate(P.x, P.y);
    ctx.strokeStyle = hexA(c, 0.2 + L * 0.03);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 7]);
    ctx.lineDashOffset = t * 40;
    ctx.beginPath();
    arc(ctx, 0, 0, ringR, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    // Each level adds rings and orbiting sparks; at 10, a crown.
    for (let r = 0; r < Math.floor(L / 3); r++) {
      ctx.strokeStyle = hexA(c, 0.35);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      arc(ctx, 0, 0, ringR + 10 + r * 7, t * (r % 2 ? -1 : 1), t * (r % 2 ? -1 : 1) + TAU * 0.7);
      ctx.stroke();
    }
    for (let m = 0; m < L; m++) {
      const a = t * 1.5 + (m / Math.max(1, L)) * TAU;
      ctx.fillStyle = c;
      ctx.beginPath();
      arc(ctx, Math.cos(a) * (ringR + 6), Math.sin(a) * (ringR + 6), 1.8, 0, TAU);
      ctx.fill();
    }
    if (ch.id === 'vacio') {
      for (let r = 0; r < 3; r++) {
        ctx.strokeStyle = hexA(c, 0.25 - r * 0.06);
        ctx.beginPath();
        ctx.ellipse(0, 0, 60 + r * 14, 30 + r * 8, -t * (1 + r * 0.4), 0, TAU);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    const glowR = (twin ? 70 : 44) * (1 + L * 0.04);
    const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
    gl.addColorStop(0, hexA(c, 0.3 + L * 0.03));
    gl.addColorStop(1, hexA(c, 0));
    ctx.fillStyle = gl;
    ctx.beginPath();
    arc(ctx, 0, 0, glowR, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    if (L >= 10) {
      ctx.fillStyle = '#ffd60a';
      ctx.beginPath();
      const cy = -(twin ? 30 : 22) * (1 + L * 0.03);
      ctx.moveTo(-8, cy + 5);
      ctx.lineTo(-5, cy - 4);
      ctx.lineTo(0, cy + 1);
      ctx.lineTo(5, cy - 4);
      ctx.lineTo(8, cy + 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.rotate(Math.sin(t * 0.8 + k) * 0.15 + (twin ? 0 : Math.PI / 4));
    const z = (twin ? 20 : 13) * (1 + Math.sin(t * 3 + k) * 0.04) * (1 + L * 0.04);
    ctx.fillStyle = '#121418';
    ctx.strokeStyle = c;
    ctx.lineWidth = twin ? 3 : 2;
    ctx.beginPath();
    ctx.rect(-z, -z, z * 2, z * 2);
    ctx.fill();
    ctx.stroke();
    if (L >= 5 || twin) {
      ctx.strokeStyle = hexA(c, 0.6);
      ctx.lineWidth = 1;
      ctx.strokeRect(-z * 0.75, -z * 0.75, z * 1.5, z * 1.5);
    }
    ctx.fillStyle = hexA(c, 0.5 + Math.sin(t * 4 + k) * 0.2);
    ctx.fillRect(-z * 0.45, -z * 0.45, z * 0.9, z * 0.9);
    if (twin) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 11px "Space Grotesk", Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('2%', 0, 0.5);
    }
    ctx.restore();
    ctx.fillStyle = hexA(c, 0.85);
    ctx.font = '700 9px "Space Grotesk", Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${ch.name.toUpperCase()}${L ? ` · ${L}` : ''}`, P.x, P.y + (twin ? 74 : 58));
  }
}
