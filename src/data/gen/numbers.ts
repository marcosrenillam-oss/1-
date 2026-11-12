import { shuffle } from '../../engine/rng';
import { cap, pick, randInt, sample, spread, NAMES, type Family } from './util';

/** 3 distinct wrong numeric options near the answer. */
function nearNums(ans: number, rng: () => number, cands: number[], fmt: (n: number) => string = String): string[] | null {
  const pool = [...new Set(cands.filter((c) => c !== ans && c >= 0 && Number.isFinite(c)))];
  for (const d of shuffle([1, -1, 2, -2, 3, 5, -5, 10], rng)) if (pool.length < 6 && ans + d >= 0 && !pool.includes(ans + d)) pool.push(ans + d);
  const out = shuffle(pool.slice(0, 6), rng).slice(0, 3).map(fmt);
  return new Set(out).size === 3 && !out.includes(fmt(ans)) ? out : null;
}
const euros = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace('.', ',')} €`;
const hhmm = (m: number) => {
  const t = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
const dur = (m: number) => (m % 60 === 0 ? `${m / 60} h` : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`);

// ─────────────────────────────────────────────────────────────────────────
const numSeq: Family = {
  id: 'nsq',
  counts: () => spread(2, 2, 2, 2, 1, 1),
  make: ({ D, rng }) => {
    const kinds = D <= 2 ? ['add', 'sub'] : D <= 4 ? ['add', 'mul', 'alt', 'inc'] : D <= 6 ? ['alt', 'inc', 'fib', 'mul', 'altop'] : ['fib', 'altop', 'inter', 'inc2'];
    const kind = pick(rng, kinds);
    let seq: number[] = [];
    let expl = '';
    const L = 5;
    if (kind === 'add' || kind === 'sub') {
      const k = randInt(rng, 2, D <= 1 ? 5 : 9);
      const s = kind === 'add' ? randInt(rng, 1, 20) : randInt(rng, 40, 80);
      for (let i = 0; i <= L; i++) seq.push(s + (kind === 'add' ? k : -k) * i);
      expl = `Cada número ${kind === 'add' ? 'suma' : 'resta'} ${k} al anterior.`;
    } else if (kind === 'mul') {
      const k = pick(rng, [2, 3]);
      const s = randInt(rng, 1, 4);
      for (let i = 0; i <= L; i++) seq.push(s * k ** i);
      expl = `Cada número es el ${k === 2 ? 'doble' : 'triple'} del anterior.`;
    } else if (kind === 'alt') {
      const [a, b] = [randInt(rng, 2, 6), randInt(rng, 1, 5)];
      const sub = rng() < 0.5;
      seq = [randInt(rng, 3, 15)];
      for (let i = 1; i <= L; i++) seq.push(seq[i - 1] + (i % 2 ? a : sub ? -b : b * 2));
      expl = sub ? `Se alterna sumar ${a} y restar ${b}.` : `Se alterna sumar ${a} y sumar ${b * 2}.`;
    } else if (kind === 'inc' || kind === 'inc2') {
      const step = kind === 'inc' ? 1 : randInt(rng, 2, 3);
      let d = randInt(rng, 1, 3);
      seq = [randInt(rng, 1, 10)];
      for (let i = 1; i <= L; i++) {
        seq.push(seq[i - 1] + d);
        d += step;
      }
      expl = `Lo que se suma crece de ${step} en ${step}: ${seq.slice(1).map((v, i) => `+${v - seq[i]}`).join(', ')}.`;
    } else if (kind === 'fib') {
      seq = [randInt(rng, 1, 4), randInt(rng, 2, 6)];
      while (seq.length <= L) seq.push(seq[seq.length - 1] + seq[seq.length - 2]);
      expl = 'Cada número es la suma de los dos anteriores.';
    } else if (kind === 'altop') {
      const k = randInt(rng, 1, 4);
      seq = [randInt(rng, 2, 6)];
      for (let i = 1; i <= L; i++) seq.push(i % 2 ? seq[i - 1] * 2 : seq[i - 1] + k);
      expl = `Se alterna multiplicar por 2 y sumar ${k}.`;
    } else {
      const a0 = randInt(rng, 1, 5);
      const b0 = randInt(rng, 20, 40);
      const ka = randInt(rng, 2, 4);
      const kb = randInt(rng, 2, 5);
      for (let i = 0; i <= L; i++) seq.push(i % 2 === 0 ? a0 + ka * (i / 2) : b0 - kb * ((i - 1) / 2));
      expl = `Son dos series intercaladas: una sube de ${ka} en ${ka} desde ${a0} y otra baja de ${kb} en ${kb} desde ${b0}.`;
    }
    const ans = seq[L];
    if (ans < 0 || ans > 2000) return null;
    const w = nearNums(ans, rng, [ans + (seq[L - 1] - seq[L - 2]), seq[L - 1] * 2, ans + 1, ans - 2]);
    if (!w) return null;
    return { cat: 'secuencias', prompt: '¿Qué número sigue?', correct: String(ans), wrong: w, expl: `${expl} El siguiente es ${ans}.`, visual: [seq.slice(0, L).join(' ') + ' ?'] };
  },
};

const ITEMS = ['una camiseta', 'un libro', 'unas zapatillas', 'una mochila', 'unos cascos', 'una lámpara', 'una chaqueta', 'un juego de mesa'];
const percent: Family = {
  id: 'pct',
  counts: () => spread(1, 2, 2, 1, 1, 0),
  make: ({ D, rng }) => {
    const p = pick(rng, D <= 3 ? [10, 50] : [10, 20, 25, 50, 75]);
    const base = pick(rng, [20, 40, 60, 80, 100, 120, 200, 300].filter((b) => (b * p) % 100 === 0));
    const part = (base * p) / 100;
    const kind = D <= 2 ? 0 : randInt(rng, 0, 2);
    if (kind === 0) {
      const w = nearNums(part, rng, [base - part, part * 2, base / 10, part + 5]);
      return w && { cat: 'matematicas', prompt: `¿Cuánto es el ${p} % de ${base}?`, correct: String(part), wrong: w, expl: `El ${p} % de ${base} es ${base} × ${p} / 100 = ${part}.` };
    }
    if (kind === 1) {
      const item = pick(rng, ITEMS);
      const w = nearNums(base - part, rng, [part, base - p, base + part, base - part - 5], euros);
      return w && { cat: 'matematicas', prompt: `${cap(item)} cuesta ${base} € y tiene un ${p} % de descuento. ¿Cuánto pagas?`, correct: euros(base - part), wrong: w, expl: `El descuento es ${part} €: ${base} − ${part} = ${base - part} €.` };
    }
    const w = nearNums(base + part, rng, [base + p, part, base * 2, base + part + 10], euros);
    return w && { cat: 'matematicas', prompt: `Un abono cuesta ${base} € y este año sube un ${p} %. ¿Cuánto cuesta ahora?`, correct: euros(base + part), wrong: w, expl: `El ${p} % de ${base} es ${part}: ${base} + ${part} = ${base + part} €.` };
  },
};

const PLANS = ['La película', 'El partido', 'El concierto', 'La clase', 'El viaje en tren', 'La excursión'];
const hours: Family = {
  id: 'hor',
  counts: () => spread(1, 2, 2, 1, 1, 0),
  make: ({ D, rng }) => {
    const start = randInt(rng, 8 * 12, 21 * 12) * 5;
    const len = randInt(rng, D <= 2 ? 3 : 5, D <= 2 ? 12 : 30) * 5 + (D >= 4 ? randInt(rng, 0, 2) * 60 : 0);
    const back = D >= 3 && rng() < 0.5;
    const plan = pick(rng, PLANS);
    if (!back) {
      const ans = hhmm(start + len);
      const w = [hhmm(start + len + 60), hhmm(start + len - 10), hhmm(start + len + 10), hhmm(start + len - 60)];
      return { cat: 'matematicas', prompt: `${plan} empieza a las ${hhmm(start)} y dura ${dur(len)}. ¿A qué hora termina?`, correct: ans, wrong: shuffle(w, rng).slice(0, 3), expl: `${hhmm(start)} + ${dur(len)} = ${ans}.` };
    }
    const ans = hhmm(start);
    const w = [hhmm(start + 60), hhmm(start - 10), hhmm(start + 10), hhmm(start - 60)];
    return { cat: 'matematicas', prompt: `${plan} ha terminado a las ${hhmm(start + len)} y ha durado ${dur(len)}. ¿A qué hora empezó?`, correct: ans, wrong: shuffle(w, rng).slice(0, 3), expl: `${hhmm(start + len)} − ${dur(len)} = ${ans}.` };
  },
};

const change: Family = {
  id: 'cam',
  counts: () => spread(1, 2, 1, 1, 1, 0),
  make: ({ D, rng }) => {
    const n = D <= 2 ? 1 : randInt(rng, 2, 3);
    const unit = randInt(rng, 2, D <= 3 ? 8 : 18) * 50; // cents
    const total = unit * n;
    const pay = [500, 1000, 2000, 5000].find((p) => p > total) ?? 5000;
    if (pay <= total) return null;
    const ans = (pay - total) / 100;
    const w = nearNums(ans * 100, rng, [pay - unit, pay - total + 100, pay - total - 50, pay - total + 50, pay - total - 100, total], (c) => euros(c / 100));
    const what = n === 1 ? `algo que cuesta ${euros(unit / 100)}` : `${n === 2 ? 'dos' : 'tres'} bocadillos de ${euros(unit / 100)} cada uno`;
    return w && { cat: 'matematicas', prompt: `Pagas con un billete de ${pay / 100} € ${what}. ¿Cuánto te devuelven?`, correct: euros(ans), wrong: w, expl: `${n > 1 ? `Gastas ${euros(total / 100)}. ` : ''}${pay / 100} − ${euros(total / 100).replace(' €', '')} = ${euros(ans)}.` };
  },
};

// [unit (plural), gender of unit, middle (with article), middle plural, big (with article), big plural]
const BAL: [string, 'f' | 'm', string, string, string, string][] = [
  ['manzanas', 'f', 'un melón', 'melones', 'una sandía', 'sandías'],
  ['canicas', 'f', 'una peonza', 'peonzas', 'una pelota', 'pelotas'],
  ['clips', 'm', 'una goma', 'gomas', 'un estuche', 'estuches'],
  ['nueces', 'f', 'una pera', 'peras', 'una piña', 'piñas'],
  ['tornillos', 'm', 'una tuerca grande', 'tuercas grandes', 'un martillo', 'martillos'],
];
const balance: Family = {
  id: 'bal',
  counts: () => spread(0, 1, 2, 2, 1, 1),
  make: ({ D, rng }) => {
    const [a, g, b, bs, c, cs] = pick(rng, BAL);
    const x = randInt(rng, 2, 4);
    const y = randInt(rng, 2, 3);
    const q = D >= 6 ? randInt(rng, 2, 3) : 1;
    const ans = x * y * q;
    const w = nearNums(ans, rng, [x + y, x * y + q, ans + x, x * q]);
    const ask = q === 1 ? c : `${q === 2 ? 'dos' : 'tres'} ${cs}`;
    return w && {
      cat: 'matematicas',
      prompt: `En una balanza, ${x} ${a} pesan lo mismo que ${b}, y ${y} ${bs} pesan lo mismo que ${c}. ¿${g === 'f' ? 'Cuántas' : 'Cuántos'} ${a} pesan lo mismo que ${ask}?`,
      correct: String(ans),
      wrong: w,
      expl: `${cap(c)} equivale a ${y} ${bs}, es decir, a ${y} × ${x} = ${x * y} ${a}${q > 1 ? `; ${q} ${cs}, a ${ans}` : ''}.`,
    };
  },
};

const SPORTS = [['fútbol', 'baloncesto'], ['natación', 'tenis'], ['ajedrez', 'teatro'], ['música', 'dibujo']];
const sets: Family = {
  id: 'cjt',
  counts: () => spread(0, 1, 2, 2, 1, 1),
  make: ({ D, rng }) => {
    const [s1, s2] = pick(rng, SPORTS);
    const both = randInt(rng, 2, 6);
    const a = both + randInt(rng, 3, 9);
    const b = both + randInt(rng, 3, 9);
    const none = randInt(rng, 1, 6);
    const total = a + b - both + none;
    const kind = D <= 4 ? pick(rng, [0, 1]) : pick(rng, [0, 1, 2]);
    const intro = `En una clase de ${total} alumnos, ${a} hacen ${s1}, ${b} hacen ${s2} y ${both} hacen las dos cosas.`;
    const opts = [[a + b - both, `¿Cuántos hacen al menos una de las dos?`, `${a} + ${b} − ${both} (los que hacen las dos se contarían dos veces) = ${a + b - both}.`],
      [a - both, `¿Cuántos hacen solo ${s1}?`, `De los ${a} que hacen ${s1}, ${both} también hacen ${s2}: ${a} − ${both} = ${a - both}.`],
      [none, '¿Cuántos no hacen ninguna de las dos?', `Hacen al menos una ${a} + ${b} − ${both} = ${a + b - both}. Quedan ${total} − ${a + b - both} = ${none}.`]] as const;
    const [ans, q, ex] = opts[kind];
    const w = nearNums(ans, rng, [a + b, a, total - a, ans + both]);
    return w && { cat: 'matematicas', prompt: `${intro} ${q}`, correct: String(ans), wrong: w, expl: ex };
  },
};

const queue: Family = {
  id: 'fil',
  counts: () => spread(1, 1, 2, 1, 1, 0),
  make: ({ D, rng }) => {
    const p = pick(rng, NAMES);
    const a = randInt(rng, 2, 9);
    const b = randInt(rng, 2, 9);
    if (D <= 3 || rng() < 0.5) {
      const ans = a + b - 1;
      const w = nearNums(ans, rng, [a + b, a + b + 1, a + b - 2]);
      return w && { cat: 'problemas', prompt: `En una cola, ${p} es la persona número ${a} empezando por delante y la número ${b} empezando por detrás. ¿Cuántas personas hay en la cola?`, correct: String(ans), wrong: w, expl: `${a} + ${b} cuenta dos veces a ${p}: ${a} + ${b} − 1 = ${ans}.` };
    }
    const n = a + b + randInt(rng, 1, 6);
    const ans = n - a + 1;
    const w = nearNums(ans, rng, [n - a, n - a + 2, a]);
    return w && { cat: 'problemas', prompt: `En una cola de ${n} personas, ${p} es la número ${a} empezando por delante. ¿Qué número es empezando por detrás?`, correct: String(ans), wrong: w, expl: `Por detrás de ${p} hay ${n - a} personas, así que es la número ${ans}.` };
  },
};

const pyramid: Family = {
  id: 'pir',
  counts: () => spread(0, 1, 2, 2, 1, 1),
  make: ({ D, rng }) => {
    const levels = D <= 4 ? 3 : 4;
    const base = Array.from({ length: levels }, () => randInt(rng, 1, D <= 4 ? 9 : 15));
    const rows: number[][] = [base];
    while (rows[0].length > 1) rows.unshift(rows[0].slice(1).map((v, i) => rows[0][i] + v));
    // Hide one cell; keep enough info to deduce it.
    const r = randInt(rng, 0, levels - 1);
    const c = randInt(rng, 0, rows[r].length - 1);
    const ans = rows[r][c];
    const visual = rows.map((row, ri) => row.map((v, ci) => (ri === r && ci === c ? '?' : String(v))).join(' '));
    const w = nearNums(ans, rng, [ans + 2, ans - 3, ans + 10]);
    return w && { cat: 'matematicas', prompt: 'En esta pirámide, cada número es la suma de los dos que tiene debajo. ¿Qué número falta?', correct: String(ans), wrong: w, expl: `Sumando (o restando) las casillas vecinas se obtiene ${ans}.`, visual };
  },
};

const TOPS = { suma: (a: number, b: number) => a + b, resta: (a: number, b: number) => a - b, producto: (a: number, b: number) => a * b };
type TopK = keyof typeof TOPS;
const table: Family = {
  id: 'tab',
  counts: () => spread(1, 1, 2, 2, 1, 1),
  make: ({ D, rng }) => {
    const ops: TopK[] = D <= 3 ? ['suma'] : D <= 5 ? ['suma', 'resta'] : ['suma', 'resta', 'producto'];
    const op = pick(rng, ops);
    const rows = Array.from({ length: 3 }, () => {
      const a = randInt(rng, op === 'producto' ? 2 : 3, op === 'producto' ? 9 : 20);
      const b = randInt(rng, 2, op === 'resta' ? a - 1 : 9);
      return [a, b, TOPS[op](a, b)];
    });
    for (const k of Object.keys(TOPS) as TopK[]) if (k !== op && rows.slice(0, 2).every(([a, b, c]) => TOPS[k](a, b) === c)) return null;
    const [a, b, c] = rows[2];
    const w = nearNums(c, rng, Object.values(TOPS).map((f) => f(a, b)).concat([c + 1]));
    return w && {
      cat: 'secuencias',
      prompt: '¿Qué número falta?',
      correct: String(c),
      wrong: w,
      expl: `En cada fila, el tercer número es ${op === 'suma' ? 'la suma' : op === 'resta' ? 'la resta' : 'el producto'} de los dos primeros: ${a} ${op === 'suma' ? '+' : op === 'resta' ? '−' : '×'} ${b} = ${c}.`,
      visual: [rows[0].join(' '), rows[1].join(' '), `${a} ${b} ?`],
    };
  },
};

const speed: Family = {
  id: 'vel',
  counts: () => spread(0, 1, 2, 1, 1, 0),
  make: ({ D, rng }) => {
    const v = pick(rng, [40, 50, 60, 80, 90, 100, 120]);
    const halves = randInt(rng, 1, D <= 3 ? 4 : 6);
    const tTxt = halves === 1 ? 'media hora' : halves % 2 === 0 ? `${halves / 2} ${halves === 2 ? 'hora' : 'horas'}` : `${(halves - 1) / 2} ${halves === 3 ? 'hora' : 'horas'} y media`;
    const d = (v * halves) / 2;
    if (rng() < 0.5) {
      const w = nearNums(d, rng, [v * halves, v + halves, d + v / 2]);
      return w && { cat: 'matematicas', prompt: `Un coche va siempre a ${v} km/h. ¿Cuántos kilómetros recorre en ${tTxt}?`, correct: `${d} km`, wrong: w.map((x) => `${x} km`), expl: `${v} km cada hora durante ${tTxt}: ${d} km.` };
    }
    const opts = [halves - 1, halves + 1, halves + 2].filter((h) => h > 0).map((h) => (h === 1 ? 'Media hora' : h % 2 === 0 ? `${h / 2} ${h === 2 ? 'hora' : 'horas'}` : `${(h - 1) / 2} ${h === 3 ? 'hora' : 'horas'} y media`));
    if (opts.length < 3) opts.push('5 horas');
    return { cat: 'matematicas', prompt: `Un tren va siempre a ${v} km/h. ¿Cuánto tarda en recorrer ${d} km?`, correct: cap(tTxt), wrong: opts.slice(0, 3), expl: `${d} ÷ ${v} = ${halves / 2} horas, es decir, ${tTxt}.` };
  },
};

const clockOff: Family = {
  id: 'rel',
  counts: () => spread(1, 1, 1, 1, 1, 0),
  make: ({ rng }) => {
    const shown = randInt(rng, 6 * 12, 22 * 12) * 5;
    const off = pick(rng, [5, 10, 15, 20, 25]);
    const fast = rng() < 0.5;
    const real = fast ? shown - off : shown + off;
    const w = [hhmm(fast ? shown + off : shown - off), hhmm(shown), hhmm(real + (fast ? -5 : 5))];
    return { cat: 'problemas', prompt: `Mi reloj va ${off} minutos ${fast ? 'adelantado' : 'atrasado'} y ahora marca las ${hhmm(shown)}. ¿Qué hora es en realidad?`, correct: hhmm(real), wrong: w, expl: `Si va ${fast ? 'adelantado, hay que restar' : 'atrasado, hay que sumar'} ${off} minutos: ${hhmm(real)}.` };
  },
};

const DAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const calendar: Family = {
  id: 'cdi',
  counts: () => spread(1, 2, 1, 1, 1, 0),
  make: ({ D, rng }) => {
    const start = randInt(rng, 0, 6);
    if (D <= 3 || rng() < 0.5) {
      const n = randInt(rng, D <= 2 ? 2 : 8, D <= 2 ? 6 : 30);
      const ans = DAYS[(start + n) % 7];
      const wrong = shuffle([DAYS[(start + n + 1) % 7], DAYS[(start + n + 6) % 7], DAYS[(start + n + 2) % 7]], rng).map(cap);
      return { cat: 'problemas', prompt: `Hoy es ${DAYS[start]}. ¿Qué día de la semana será dentro de ${n} días?`, correct: cap(ans), wrong, expl: `Cada 7 días se repite el día de la semana: ${n} días son ${Math.floor(n / 7)} semana${Math.floor(n / 7) === 1 ? '' : 's'} y ${n % 7} día${n % 7 === 1 ? '' : 's'} más. Será ${ans}.` };
    }
    const d = randInt(rng, 9, 30);
    const ans = DAYS[(start + d - 1) % 7];
    const wrong = shuffle([DAYS[(start + d) % 7], DAYS[(start + d + 5) % 7], DAYS[(start + d + 1) % 7]], rng).map(cap);
    return { cat: 'problemas', prompt: `El día 1 de este mes fue ${DAYS[start]}. ¿Qué día de la semana es el día ${d}?`, correct: cap(ans), wrong, expl: `Los días 1, 8, 15, 22 y 29 caen en ${DAYS[start]}. Contando desde ahí, el ${d} es ${ans}.` };
  },
};

const PROPS: { name: string; ok: (n: number) => boolean; expl: string }[] = [
  { name: 'par', ok: (n) => n % 2 === 0, expl: 'son pares' },
  { name: 'impar', ok: (n) => n % 2 === 1, expl: 'son impares' },
  { name: 'm5', ok: (n) => n % 5 === 0, expl: 'acaban en 0 o en 5' },
  { name: 'm10', ok: (n) => n % 10 === 0, expl: 'acaban en 0' },
  { name: 'm3', ok: (n) => n % 3 === 0, expl: 'son múltiplos de 3' },
  { name: 'rep', ok: (n) => n % 11 === 0 && n < 100, expl: 'tienen las dos cifras iguales' },
];
const numIntruder: Family = {
  id: 'nin',
  counts: () => spread(1, 2, 1, 1, 0, 0),
  make: ({ D, rng }) => {
    const prop = pick(rng, D <= 2 ? PROPS.slice(0, 3) : PROPS);
    const yes = shuffle(Array.from({ length: 89 }, (_, i) => i + 11).filter(prop.ok), rng).slice(0, 3);
    const no = pick(rng, Array.from({ length: 89 }, (_, i) => i + 11).filter((n) => !prop.ok(n)));
    if (yes.length < 3 || prop.ok(no)) return null;
    // Avoid a second obvious property singling out another number.
    const all = [...yes, no];
    for (const p2 of PROPS) {
      if (p2 === prop) continue;
      const odd = all.filter((n) => !p2.ok(n));
      if (odd.length === 1 && odd[0] !== no) return null;
      const odd2 = all.filter((n) => p2.ok(n));
      if (odd2.length === 1 && odd2[0] !== no) return null;
    }
    return { cat: 'relaciones', prompt: '¿Qué número no encaja con los demás?', correct: String(no), wrong: yes.map(String), expl: `${yes.join(', ').replace(/, (\d+)$/, ' y $1')} ${prop.expl}; ${no} no.` };
  },
};

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const WVAL = ['CAFE', 'DEDO', 'BEBE', 'CABE', 'HADA', 'GAFA', 'FIJA', 'DIA', 'BIEN', 'CAMA', 'FIBRA', 'JEFE', 'LIGA', 'MAGIA', 'HILO', 'LOBO'];
const wordValue: Family = {
  id: 'wvl',
  counts: () => spread(0, 1, 1, 1, 1, 0),
  make: ({ rng }) => {
    const wd = pick(rng, WVAL);
    const ans = [...wd].reduce((s, ch) => s + ABC.indexOf(ch) + 1, 0);
    const w = nearNums(ans, rng, [ans + 1, ans - 1, ans + wd.length]);
    return w && { cat: 'matematicas', prompt: `Si A = 1, B = 2, C = 3… (abecedario sin Ñ), ¿cuánto suman las letras de ${wd}?`, correct: String(ans), wrong: w, expl: `${[...wd].map((ch) => `${ch} = ${ABC.indexOf(ch) + 1}`).join(', ')}. Total: ${ans}.` };
  },
};

// Mini sudoku 4×4: rows, columns and 2×2 boxes contain 1-4.
function sudokuSolutions(g: number[], limit = 2): number {
  const i = g.indexOf(0);
  if (i < 0) return 1;
  const r = Math.floor(i / 4);
  const c = i % 4;
  let n = 0;
  for (let v = 1; v <= 4 && n < limit; v++) {
    let ok = true;
    for (let k = 0; k < 4; k++) if (g[r * 4 + k] === v || g[k * 4 + c] === v) ok = false;
    const br = r - (r % 2);
    const bc = c - (c % 2);
    for (const [dr, dc] of [[0, 0], [0, 1], [1, 0], [1, 1]]) if (g[(br + dr) * 4 + bc + dc] === v) ok = false;
    if (!ok) continue;
    g[i] = v;
    n += sudokuSolutions(g, limit - n);
    g[i] = 0;
  }
  return n;
}
const sudoku: Family = {
  id: 'sud',
  counts: () => spread(0, 1, 1, 2, 2, 1),
  make: ({ D, rng }) => {
    const base = [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1];
    const perm = shuffle([1, 2, 3, 4], rng);
    let g = base.map((v) => perm[v - 1]);
    if (rng() < 0.5) g = [8, 9, 10, 11, 12, 13, 14, 15, 0, 1, 2, 3, 4, 5, 6, 7].map((i) => g[i]); // swap row bands
    const holes = D <= 4 ? 6 : D <= 6 ? 8 : 10;
    const blanks = sample(rng, Array.from({ length: 16 }, (_, i) => i), holes);
    const puzzle = g.map((v, i) => (blanks.includes(i) ? 0 : v));
    if (sudokuSolutions(puzzle.slice()) !== 1) return null;
    const ask = blanks[0];
    const visual = [0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => { const i = r * 4 + c; return i === ask ? '?' : puzzle[i] ? String(puzzle[i]) : '·'; }).join(' '));
    return { cat: 'deductiva', prompt: 'Minisudoku: cada fila, cada columna y cada bloque de 2 × 2 contiene los números 1, 2, 3 y 4 una sola vez. ¿Qué número va en el hueco marcado?', correct: String(g[ask]), wrong: [1, 2, 3, 4].filter((v) => v !== g[ask]).map(String), expl: `Solo hay una forma de completar la cuadrícula, y en ese hueco va el ${g[ask]}.`, visual };
  },
};

export const NUMBER_FAMILIES = [numSeq, percent, hours, change, balance, sets, queue, pyramid, table, speed, clockOff, calendar, numIntruder, wordValue, sudoku];
