import { shuffle } from '../../engine/rng';
import { orderingCore } from './logic';
import { cap, pick, randInt, sample, spread, strip, type Family } from './util';
import { cells, flipV, invert, mirror, randomShape, rotCCW, rotCW, tok, type Mask } from './visual';

const bitsOf = (m: Mask) => Array.from({ length: 9 }, (_, i) => ((m >> i) & 1 ? '1' : '0')).join('');

// ─────────────────────────────────────────────────────────────────────────
// Tap in order
// ─────────────────────────────────────────────────────────────────────────
const tapNumbers: Family = {
  id: 'tnu',
  counts: (m) => (m === 'experto' ? spread(1, 1, 0, 0, 0, 0) : spread(2, 1, 1, 1, 0, 0)),
  make: ({ D, rng }) => {
    const n = D <= 2 ? 4 : D <= 5 ? 5 : 6;
    const max = D <= 2 ? 50 : D <= 5 ? 200 : 999;
    const nums = new Set<number>();
    while (nums.size < n) nums.add(randInt(rng, 1, max));
    const desc = D >= 3 && rng() < 0.5;
    const items = [...nums].sort((a, b) => (desc ? b - a : a - b)).map(String);
    return { kind: 'order', cat: 'tactil', prompt: `Toca los números de ${desc ? 'mayor a menor' : 'menor a mayor'}.`, correct: '', wrong: [], items, expl: `El orden es: ${items.join(' → ')}.` };
  },
};

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const tapCalendar: Family = {
  id: 'tca',
  counts: () => spread(1, 1, 1, 1, 0, 0),
  make: ({ D, rng }) => {
    const months = D >= 3 || rng() < 0.5;
    const arr = months ? MONTHS : DAYS;
    const n = D <= 2 ? 4 : D <= 6 ? 5 : 6;
    const back = D >= 6 && rng() < 0.5;
    const idx = sample(rng, arr.map((_, i) => i), n).sort((a, b) => (back ? b - a : a - b));
    const items = idx.map((i) => arr[i]);
    return {
      kind: 'order',
      cat: 'tactil',
      prompt: months
        ? `Toca los meses en orden del calendario, ${back ? 'del más tardío al más temprano del año' : 'del más temprano al más tardío del año'}.`
        : 'Toca los días en orden, de lunes a domingo.',
      correct: '',
      wrong: [],
      items,
      expl: `El orden es: ${items.join(' → ')}.`,
    };
  },
};

const ALPHA = [
  ['casa', 'mesa', 'perro', 'árbol', 'libro', 'zapato', 'gato', 'nube', 'tigre', 'uva', 'oso', 'dedo', 'fuego', 'helado', 'isla', 'lobo', 'vaso', 'yate'],
  ['carta', 'cartón', 'carro', 'carpa', 'carne', 'cara', 'caro', 'carbón', 'cargo', 'carril'],
  ['pelota', 'pelo', 'pelea', 'pelaje', 'película', 'peligro', 'pelícano', 'peldaño'],
  ['mano', 'manta', 'manzana', 'mango', 'manada', 'manguera', 'maniquí', 'mancha'],
  ['sol', 'sola', 'soldado', 'soleado', 'solapa', 'solución', 'solo', 'soltar'],
];
const tapAlpha: Family = {
  id: 'tal',
  counts: () => spread(1, 1, 1, 1, 1, 0),
  make: ({ D, rng }) => {
    const set = D <= 3 ? ALPHA[0] : pick(rng, D <= 6 ? ALPHA.slice(0, 3) : ALPHA.slice(1));
    const n = D <= 3 ? 4 : D <= 7 ? 5 : 6;
    const items = sample(rng, set, n).sort((a, b) => strip(a).localeCompare(strip(b), 'es')).map(cap);
    return { kind: 'order', cat: 'tactil', prompt: 'Toca las palabras en orden alfabético, como irían en un diccionario.', correct: '', wrong: [], items, expl: `En orden alfabético: ${items.join(' → ')}.` };
  },
};

const tapRace: Family = {
  id: 'tor',
  counts: (m) => (m === 'facil' ? spread(0, 1, 1, 1, 1, 1) : spread(1, 1, 1, 1, 1, 1)),
  make: ({ D, rng }) => {
    const core = orderingCore(Math.max(D, 3), rng);
    if (!core) return null;
    const { C, names, sol, clues } = core;
    if (D >= 3 && clues.filter((c) => c.atFor).length > 1) return null;
    return {
      kind: 'order',
      cat: 'deductiva',
      prompt: `${C.intro(shuffle(names, rng))}\n${shuffle(clues, rng).map((c) => `• ${c.text}`).join('\n')}\n${C.tap}`,
      correct: '',
      wrong: [],
      items: sol,
      expl: C.expl(sol),
    };
  },
};

const VALUES: [string, number][] = [
  ['La mitad', 50], ['Un cuarto', 25], ['Tres cuartos', 75], ['Un 10 %', 10], ['Un tercio', 33.3], ['Dos tercios', 66.7],
  ['Un 60 %', 60], ['Un 40 %', 40], ['Un quinto', 20], ['Un 90 %', 90], ['Casi nada (1 %)', 1], ['Todo', 100],
];
const tapValues: Family = {
  id: 'tva',
  counts: (m) => (m === 'facil' ? spread(0, 0, 1, 1, 1, 0) : spread(1, 1, 1, 1, 1, 0)),
  make: ({ D, rng }) => {
    const n = D <= 4 ? 4 : 5;
    const pickd = sample(rng, VALUES, n);
    if (new Set(pickd.map((v) => v[1])).size < n) return null;
    const items = pickd.sort((a, b) => a[1] - b[1]).map((v) => v[0]);
    return { kind: 'order', cat: 'tactil', prompt: 'Toca de la cantidad más pequeña a la más grande (todas son partes de lo mismo).', correct: '', wrong: [], items, expl: `De menor a mayor: ${items.join(' → ')}.` };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Tap a cell
// ─────────────────────────────────────────────────────────────────────────
const ODD: [number, string, string][] = [
  [1, 'ci', 'cio'], [1, 'sq', 'ci'], [1, 'tr', 'trd'], [1, 'st', 'sto'], [2, 'di', 'sq'],
  [3, 'ar-u', 'ar-ur'], [3, 'hc-t', 'hc-r'], [3, 'ar-r', 'ar-l'], [4, 'hc-l', 'hc-r'], [5, 'ar-ur', 'ar-ul'],
  [5, 'hc-b', 'hc-l'], [6, 'ar-dl', 'ar-dr'], [6, 'sto', 'dio'], [7, 'trdo', 'tro'],
];
const tapOdd: Family = {
  id: 'tod',
  counts: () => spread(1, 1, 1, 1, 1, 1),
  make: ({ D, rng }) => {
    const grid = D >= 8;
    const R = D <= 2 ? 3 : 4;
    const C = grid ? 4 : D <= 2 ? 4 : 5;
    let base: string;
    let odd: string;
    if (grid) {
      const m = randomShape(rng, 4);
      base = tok(m);
      odd = tok(m ^ (1 << randInt(rng, 0, 8)));
    } else {
      const [, a, b] = pick(rng, ODD.filter(([lv]) => lv <= D && lv >= D - 4));
      [base, odd] = rng() < 0.5 ? [`{${a}}`, `{${b}}`] : [`{${b}}`, `{${a}}`];
    }
    const cell = randInt(rng, 0, R * C - 1);
    const visual = Array.from({ length: R }, (_, i) => Array.from({ length: C }, (_, j) => (i * C + j === cell ? odd : base)).join(' '));
    return { kind: 'tap', cat: 'tactil', prompt: 'Toca la figura distinta.', correct: '', wrong: [], cell, visual, expl: `Estaba en la fila ${Math.floor(cell / C) + 1}, columna ${(cell % C) + 1}.` };
  },
};

const tapUnique: Family = {
  id: 'tun',
  counts: () => spread(1, 1, 1, 1, 1, 0),
  make: ({ D, rng }) => {
    const set = sample(rng, D >= 5 ? ['ci', 'cio', 'sq', 'sqo', 'tr', 'tro', 'di', 'dio', 'st', 'sto'] : ['ci', 'sq', 'tr', 'di', 'st', 'trd'], D <= 3 ? 4 : D <= 6 ? 5 : 6);
    const [uniq, ...rest] = set;
    const R = D <= 3 ? 3 : 4;
    const C = 4;
    const items = [uniq];
    rest.forEach((s) => items.push(s, s));
    while (items.length < R * C) items.push(pick(rng, rest));
    const grid = shuffle(items, rng);
    const cell = grid.indexOf(uniq);
    const visual = Array.from({ length: R }, (_, i) => grid.slice(i * C, i * C + C).map((s) => `{${s}}`).join(' '));
    return { kind: 'tap', cat: 'observacion', prompt: 'Toca la figura que aparece una sola vez.', correct: '', wrong: [], cell, visual, expl: 'Todas las demás figuras se repiten al menos dos veces.' };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Memory
// ─────────────────────────────────────────────────────────────────────────
const memorySeq: Family = {
  id: 'msq',
  counts: () => spread(1, 1, 1, 1, 1, 1),
  make: ({ D, rng }) => {
    const size = D <= 6 ? 3 : 4;
    const len = Math.min(size === 3 ? 7 : 9, 2 + Math.ceil(D / 2));
    const seq: number[] = [];
    while (seq.length < len) {
      const c = randInt(rng, 0, size * size - 1);
      if (c !== seq[seq.length - 1]) seq.push(c);
    }
    return { kind: 'memory', cat: 'memoria', prompt: `Fíjate en el orden en que se iluminan ${len} casillas y repítelo tocándolas.`, correct: '', wrong: [], size, seq, ordered: true, expl: `La secuencia tenía ${len} pasos.` };
  },
};

const memorySet: Family = {
  id: 'mst',
  counts: () => spread(1, 1, 1, 1, 1, 0),
  make: ({ D, rng }) => {
    const size = D <= 5 ? 3 : 4;
    const k = Math.min(size === 3 ? 5 : 8, 2 + Math.ceil(D / 2));
    const seq = sample(rng, Array.from({ length: size * size }, (_, i) => i), k).sort((a, b) => a - b);
    return { kind: 'memory', cat: 'memoria', prompt: `Se iluminarán ${k} casillas a la vez durante un momento. Recuérdalas y tócalas (en cualquier orden).`, correct: '', wrong: [], size, seq, ordered: false, expl: `Eran ${k} casillas.` };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Paint the answer on a 3×3 grid
// ─────────────────────────────────────────────────────────────────────────
const paintMirror: Family = {
  id: 'pmi',
  counts: () => spread(1, 1, 1, 1, 1, 0),
  make: ({ D, rng }) => {
    const s = randomShape(rng, D <= 3 ? 3 : 4);
    const water = D >= 5 && rng() < 0.5;
    return {
      kind: 'paint',
      cat: 'tactil',
      prompt: water ? 'Pinta cómo se vería esta figura reflejada en un lago (con el agua debajo).' : 'Pinta cómo se vería esta figura en un espejo colocado a su derecha.',
      correct: '',
      wrong: [],
      visual: [tok(s)],
      target: bitsOf(water ? flipV(s) : mirror(s)),
      expl: water ? 'El reflejo en el agua invierte arriba y abajo.' : 'Un espejo vertical invierte izquierda y derecha.',
    };
  },
};

const paintRotate: Family = {
  id: 'pro',
  counts: () => spread(0, 1, 1, 1, 1, 1),
  make: ({ D, rng }) => {
    const s = randomShape(rng, D <= 5 ? 3 : 4);
    const k = D <= 4 ? 1 : pick(rng, [1, 2, 3]);
    let r = s;
    for (let i = 0; i < k; i++) r = rotCW(r);
    const txt = k === 2 ? 'media vuelta' : `un cuarto de vuelta en sentido ${k === 1 ? 'horario' : 'antihorario'}`;
    return { kind: 'paint', cat: 'tactil', prompt: `Pinta esta figura girada ${txt}.`, correct: '', wrong: [], visual: [tok(s)], target: bitsOf(r), expl: `La figura girada ${txt}.` };
  },
};

const paintSymmetry: Family = {
  id: 'psy',
  counts: () => spread(1, 1, 1, 1, 0, 0),
  make: ({ rng }) => {
    // Left column + centre column given; paint the full symmetric figure.
    let left = 0;
    for (const i of sample(rng, [0, 1, 3, 4, 6, 7], randInt(rng, 2, 4))) left |= 1 << i;
    const full = left | mirror(left);
    if (left === full || full === 0x1ff) return null;
    return { kind: 'paint', cat: 'tactil', prompt: 'Pinta la figura completa para que sea simétrica respecto a la línea vertical central (la mitad izquierda ya está dibujada).', correct: '', wrong: [], visual: [tok(left)], target: bitsOf(full), expl: 'Hay que copiar la columna izquierda en la derecha, como en un espejo.' };
  },
};

const RING = [0, 1, 2, 5, 8, 7, 6, 3];
const paintNext: Family = {
  id: 'pne',
  counts: () => spread(1, 1, 1, 1, 1, 1),
  make: ({ D, rng }) => {
    const rot = D >= 4 && rng() < 0.6;
    let frames: Mask[];
    let ans: Mask;
    let expl: string;
    if (rot) {
      const s = randomShape(rng, D <= 7 ? 3 : 4);
      const f = rng() < 0.5 ? rotCW : rotCCW;
      frames = [s, f(s), f(f(s))];
      ans = f(frames[2]);
      expl = `La figura gira un cuarto de vuelta en sentido ${f === rotCW ? 'horario' : 'antihorario'} en cada paso.`;
    } else {
      const step = D <= 3 ? 1 : pick(rng, [1, 2]);
      const a0 = randInt(rng, 0, 7);
      const two = D >= 6;
      const b0 = randInt(rng, 0, 7);
      const fr = (i: number) => cells(RING[(a0 + i * step) % 8], ...(two ? [RING[(b0 - i + 80) % 8]] : []));
      frames = [fr(0), fr(1), fr(2)];
      ans = fr(3);
      expl = two ? 'Un punto avanza por el borde en sentido horario y el otro en sentido antihorario.' : `El punto avanza ${step === 2 ? 'dos casillas' : 'una casilla'} por el borde en sentido horario.`;
    }
    if (frames.some((m) => m === 0) || ans === 0) return null;
    return { kind: 'paint', cat: 'tactil', prompt: 'Pinta la cuadrícula que viene a continuación.', correct: '', wrong: [], visual: [frames.map(tok).join(' ') + ' ?'], target: bitsOf(ans), expl };
  },
};

const paintCombine: Family = {
  id: 'pco',
  counts: (m) => (m === 'facil' ? spread(0, 1, 1, 1, 0, 0) : spread(1, 1, 1, 1, 1, 1)),
  make: ({ D, rng }) => {
    const a = cells(...sample(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8], randInt(rng, 3, 5)));
    const b = cells(...sample(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8], randInt(rng, 3, 5)));
    const ops = [
      { t: 'Pinta solo las casillas que están rellenas en LAS DOS figuras.', f: a & b, e: 'Solo cuentan las casillas comunes.' },
      { t: 'Pinta todas las casillas que están rellenas en ALGUNA de las dos figuras.', f: a | b, e: 'Se juntan las dos figuras.' },
      ...(D >= 5 ? [{ t: 'Pinta las casillas que están rellenas en UNA SOLA de las dos figuras.', f: a ^ b, e: 'Se eliminan las coincidencias.' }] : []),
      ...(D >= 3 ? [{ t: 'Pinta el negativo de la primera figura (lo vacío se rellena y lo relleno se vacía).', f: invert(a), e: 'Se intercambian casillas rellenas y vacías.' }] : []),
    ];
    const op = pick(rng, ops);
    if (op.f === 0 || op.f === 0x1ff) return null;
    const visual = op.t.includes('primera') ? [tok(a)] : [`${tok(a)} ${tok(b)}`];
    return { kind: 'paint', cat: 'tactil', prompt: op.t.replace('de la primera figura', 'de esta figura'), correct: '', wrong: [], visual, target: bitsOf(op.f), expl: op.e };
  },
};

export const TOUCH_FAMILIES = [tapNumbers, tapCalendar, tapAlpha, tapRace, tapValues, tapOdd, tapUnique, memorySeq, memorySet, paintMirror, paintRotate, paintSymmetry, paintNext, paintCombine];
