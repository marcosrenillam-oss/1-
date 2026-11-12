import { shuffle } from '../../engine/rng';
import { cap, pick, randInt, sample, spread, strip, type Family } from './util';

// ─────────────────────────────────────────────────────────────────────────
// Odd one out. Every word belongs to exactly one bank.
// ─────────────────────────────────────────────────────────────────────────
const BANKS: Record<string, { label: string; words: string[] }> = {
  frutas: { label: 'frutas', words: ['manzana', 'pera', 'plátano', 'uva', 'fresa', 'cereza', 'melón', 'sandía', 'kiwi', 'mango', 'piña', 'ciruela'] },
  verduras: { label: 'verduras', words: ['lechuga', 'zanahoria', 'patata', 'cebolla', 'espinaca', 'pimiento', 'calabacín', 'puerro'] },
  colores: { label: 'colores', words: ['rojo', 'azul', 'verde', 'amarillo', 'negro', 'blanco', 'morado', 'gris'] },
  cuerda: { label: 'instrumentos de cuerda', words: ['guitarra', 'violín', 'arpa', 'violonchelo', 'laúd', 'contrabajo'] },
  viento: { label: 'instrumentos de viento', words: ['flauta', 'trompeta', 'clarinete', 'saxofón', 'oboe', 'tuba'] },
  herramientas: { label: 'herramientas', words: ['martillo', 'destornillador', 'sierra', 'alicates', 'taladro', 'llave inglesa'] },
  cocina: { label: 'utensilios de cocina', words: ['sartén', 'olla', 'cazo', 'cucharón', 'colador', 'batidora'] },
  prendas: { label: 'prendas de ropa', words: ['camisa', 'pantalón', 'falda', 'chaqueta', 'abrigo', 'bufanda', 'jersey', 'chaleco'] },
  calzado: { label: 'calzado', words: ['bota', 'zapatilla', 'sandalia', 'zapato', 'chancla', 'mocasín'] },
  muebles: { label: 'muebles', words: ['silla', 'mesa', 'sofá', 'armario', 'cama', 'estantería', 'cómoda'] },
  mamiferos: { label: 'mamíferos', words: ['perro', 'gato', 'caballo', 'vaca', 'león', 'conejo', 'oveja', 'tigre', 'ratón'] },
  aves: { label: 'aves', words: ['águila', 'paloma', 'gorrión', 'loro', 'búho', 'cigüeña', 'gallina', 'pato'] },
  peces: { label: 'peces', words: ['sardina', 'trucha', 'salmón', 'atún', 'merluza', 'bacalao'] },
  insectos: { label: 'insectos', words: ['hormiga', 'mosca', 'abeja', 'mariposa', 'mosquito', 'escarabajo'] },
  deportes: { label: 'deportes', words: ['fútbol', 'tenis', 'baloncesto', 'natación', 'ciclismo', 'voleibol', 'rugby'] },
  vehiculos: { label: 'vehículos', words: ['coche', 'autobús', 'moto', 'bicicleta', 'camión', 'tren', 'tranvía'] },
  cuerpo: { label: 'partes del cuerpo', words: ['brazo', 'pierna', 'rodilla', 'codo', 'hombro', 'tobillo', 'muñeca'] },
  profesiones: { label: 'profesiones', words: ['médico', 'panadero', 'carpintero', 'abogado', 'bombero', 'cartero', 'fontanero'] },
  dias: { label: 'días de la semana', words: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] },
  meses: { label: 'meses', words: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'octubre'] },
  formas: { label: 'figuras geométricas', words: ['círculo', 'cuadrado', 'triángulo', 'rectángulo', 'rombo', 'pentágono'] },
  verbos: { label: 'verbos (acciones)', words: ['correr', 'saltar', 'nadar', 'escribir', 'leer', 'cantar', 'dormir'] },
  emociones: { label: 'emociones', words: ['alegría', 'tristeza', 'miedo', 'enfado', 'sorpresa', 'asco'] },
  flores: { label: 'flores', words: ['rosa', 'margarita', 'tulipán', 'girasol', 'clavel', 'amapola'] },
  bebidas: { label: 'bebidas', words: ['agua', 'leche', 'zumo', 'café', 'té', 'batido'] },
  tiempo: { label: 'fenómenos del tiempo', words: ['lluvia', 'nieve', 'granizo', 'niebla', 'tormenta', 'viento'] },
};
// [level, group, intruder group]
const ODD_COMBOS: [number, string, string][] = [
  [1, 'frutas', 'muebles'], [1, 'colores', 'vehiculos'], [1, 'mamiferos', 'herramientas'], [1, 'deportes', 'frutas'],
  [1, 'prendas', 'aves'], [1, 'dias', 'colores'], [1, 'formas', 'bebidas'], [1, 'muebles', 'emociones'],
  [1, 'vehiculos', 'flores'], [1, 'profesiones', 'meses'], [1, 'bebidas', 'cuerpo'], [1, 'flores', 'deportes'],
  [2, 'frutas', 'verduras'], [2, 'mamiferos', 'aves'], [2, 'aves', 'peces'], [2, 'herramientas', 'cocina'],
  [2, 'prendas', 'calzado'], [2, 'dias', 'meses'], [2, 'insectos', 'aves'], [2, 'verbos', 'emociones'],
  [2, 'tiempo', 'emociones'], [2, 'muebles', 'cocina'], [2, 'peces', 'mamiferos'], [2, 'calzado', 'prendas'],
  [3, 'cuerda', 'viento'], [3, 'viento', 'cuerda'], [3, 'verduras', 'frutas'], [3, 'cocina', 'herramientas'],
  [3, 'insectos', 'peces'], [3, 'meses', 'dias'],
];
const oddOne: Family = {
  id: 'int',
  counts: (m) => (m === 'experto' ? spread(3, 2, 1, 0, 0, 0) : m === 'dificil' ? spread(3, 3, 2, 1, 0, 0) : spread(3, 3, 3, 2, 1, 0)),
  make: ({ D, rng }) => {
    const lv = D <= 2 ? 1 : D <= 4 ? 2 : 3;
    const [, g, x] = pick(rng, ODD_COMBOS.filter(([l]) => l === lv || (lv === 3 && l === 2)));
    const three = sample(rng, BANKS[g].words, 3);
    const intruder = pick(rng, BANKS[x].words);
    return {
      cat: 'relaciones',
      prompt: '¿Qué palabra no encaja con las demás?',
      correct: cap(intruder),
      wrong: three.map(cap),
      expl: `${cap(three.join(', ').replace(/, ([^,]*)$/, ' y $1'))} son ${BANKS[g].label}; ${intruder} no.`,
      visual: undefined,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Analogies: every pair inside a relation shares exactly that relation.
// ─────────────────────────────────────────────────────────────────────────
const REL: { lv: number; name: string; pairs: [string, string][] }[] = [
  { lv: 1, name: 'son opuestos', pairs: [['frío', 'calor'], ['alto', 'bajo'], ['día', 'noche'], ['entrar', 'salir'], ['subir', 'bajar'], ['abrir', 'cerrar'], ['rápido', 'lento'], ['lleno', 'vacío'], ['ganar', 'perder'], ['encender', 'apagar'], ['dentro', 'fuera'], ['antes', 'después'], ['duro', 'blando'], ['empezar', 'terminar'], ['mojado', 'seco']] },
  { lv: 1, name: 'son herramienta y su uso', pairs: [['tijeras', 'cortar'], ['lápiz', 'escribir'], ['escoba', 'barrer'], ['martillo', 'clavar'], ['aguja', 'coser'], ['pala', 'cavar'], ['regadera', 'regar'], ['peine', 'peinar'], ['goma', 'borrar']] },
  { lv: 1, name: 'son una prenda y la parte del cuerpo que cubre', pairs: [['guante', 'mano'], ['sombrero', 'cabeza'], ['calcetín', 'pie'], ['bufanda', 'cuello'], ['anillo', 'dedo']] },
  { lv: 2, name: 'son un profesional y su lugar de trabajo', pairs: [['médico', 'hospital'], ['maestro', 'escuela'], ['piloto', 'avión'], ['bibliotecario', 'biblioteca'], ['juez', 'tribunal'], ['panadero', 'panadería'], ['marinero', 'barco'], ['actor', 'teatro']] },
  { lv: 2, name: 'son una parte y el todo al que pertenece', pairs: [['página', 'libro'], ['rama', 'árbol'], ['rueda', 'coche'], ['tecla', 'teclado'], ['pétalo', 'flor'], ['ladrillo', 'muro'], ['eslabón', 'cadena'], ['peldaño', 'escalera']] },
  { lv: 3, name: 'son un individuo y su grupo', pairs: [['abeja', 'enjambre'], ['oveja', 'rebaño'], ['lobo', 'manada'], ['soldado', 'ejército'], ['músico', 'orquesta'], ['estrella', 'constelación'], ['isla', 'archipiélago']] },
  { lv: 3, name: 'son un instrumento y lo que mide', pairs: [['reloj', 'tiempo'], ['termómetro', 'temperatura'], ['báscula', 'peso'], ['brújula', 'dirección'], ['regla', 'longitud']] },
  { lv: 3, name: 'son un animal adulto y su cría', pairs: [['vaca', 'ternero'], ['caballo', 'potro'], ['oveja', 'cordero'], ['gallina', 'pollito'], ['perro', 'cachorro']] },
];
const analogy: Family = {
  id: 'ana',
  counts: (m) => (m === 'experto' ? spread(2, 2, 2, 1, 0, 0) : spread(3, 3, 2, 2, 1, 0)),
  make: ({ D, rng }) => {
    const maxLv = D <= 2 ? 1 : D <= 4 ? 2 : 3;
    const rel = pick(rng, REL.filter((r) => r.lv <= maxLv && r.lv >= maxLv - 1));
    const [[a, b], [c, d]] = sample(rng, rel.pairs, 2);
    const flip = rel.lv === 1 && rel.name === 'son opuestos' && rng() < 0.5;
    const [A, B, C, Dd] = flip ? [b, a, d, c] : [a, b, c, d];
    const pool = REL.filter((r) => r !== rel).flatMap((r) => r.pairs.flat());
    const wrong = sample(rng, pool.filter((w) => w !== Dd && w !== C), 3);
    return {
      cat: 'relaciones',
      prompt: `${cap(A)} es a ${B} como ${C} es a…`,
      correct: cap(Dd),
      wrong: wrong.map(cap),
      expl: `${cap(A)} y ${B} ${rel.name}; lo mismo ocurre con ${C} y ${Dd}.`,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Word games. Each answer is verified programmatically.
// ─────────────────────────────────────────────────────────────────────────
const sorted = (w: string) => strip(w).replace(/\s/g, '').split('').sort().join('');
const ANAGRAMS: [number, string, string][] = [
  [1, 'roma', 'amor'], [1, 'saco', 'cosa'], [1, 'sapo', 'paso'], [1, 'toro', 'roto'], [1, 'rata', 'tara'],
  [1, 'alma', 'mala'], [1, 'mito', 'timo'], [2, 'monja', 'jamón'], [2, 'trigo', 'grito'], [2, 'árbol', 'labor'],
  [2, 'salta', 'atlas'], [2, 'carne', 'crean'], [2, 'orca', 'roca'], [2, 'nadar', 'andar'], [2, 'pirata', 'partía'],
  [3, 'delira', 'lidera'], [3, 'animal', 'lámina'], [3, 'cartón', 'contra'], [3, 'enfriamiento', 'refinamiento'],
];
const FILLER = ['casa', 'mesa', 'perro', 'libro', 'campo', 'nube', 'piedra', 'fuego', 'cielo', 'mano', 'lápiz', 'ratón', 'silla', 'camino', 'reloj', 'bosque', 'jardín', 'puerta', 'ventana', 'tiempo', 'cuerda', 'pájaro', 'naranja', 'verano', 'montaña', 'barco', 'sombra', 'espejo', 'música', 'tormenta', 'helado', 'botella', 'cuchara', 'planeta', 'familia', 'ciudad'];

function nearMisses(word: string, rng: () => number): string[] {
  // Words of similar length that are NOT anagrams of `word`.
  const s = sorted(word);
  return shuffle(FILLER, rng).filter((f) => sorted(f) !== s && Math.abs(f.length - word.length) <= 2);
}

const anagram: Family = {
  id: 'agr',
  counts: () => spread(1, 2, 2, 2, 1, 0),
  make: ({ D, rng }) => {
    const lv = D <= 3 ? 1 : D <= 6 ? 2 : 3;
    const [, a, b] = pick(rng, ANAGRAMS.filter(([l]) => l <= lv && l >= lv - 1));
    const [src, ans] = rng() < 0.5 ? [a, b] : [b, a];
    const wrong = nearMisses(src, rng).slice(0, 3);
    if (sorted(src) !== sorted(ans) || wrong.length < 3) return null;
    return {
      cat: 'palabras',
      prompt: `¿Qué palabra se forma reordenando las letras de ${src.toUpperCase()}?`,
      correct: cap(ans),
      wrong: wrong.map(cap),
      expl: `${src.toUpperCase()} y ${ans.toUpperCase()} tienen exactamente las mismas letras.`,
    };
  },
};

const PALINDROMES = ['oso', 'ala', 'radar', 'reconocer', 'anilina', 'salas', 'solos', 'rotor', 'seres', 'somos', 'ojo', 'acurruca', 'sometemos', 'oro', 'erre', 'rajar', 'sus', 'arenera'];
const NOT_PAL = ['osa', 'ola', 'radio', 'recorrer', 'anillo', 'salsa', 'solas', 'rotar', 'series', 'sumos', 'ajo', 'ora', 'error', 'raja', 'sur', 'arena', 'nadan', 'salón', 'coloco'];
const isPal = (w: string) => { const s = strip(w); return s === [...s].reverse().join(''); };
const palindrome: Family = {
  id: 'pal',
  counts: () => spread(1, 1, 2, 1, 1, 0),
  make: ({ D, rng }) => {
    const ans = pick(rng, PALINDROMES);
    const pool = D >= 5 ? NOT_PAL : [...NOT_PAL, ...FILLER];
    const wrong = sample(rng, pool.filter((w) => !isPal(w) && w.length >= 3), 3);
    if (!isPal(ans)) return null;
    return {
      cat: 'palabras',
      prompt: '¿Qué palabra se lee igual de izquierda a derecha que de derecha a izquierda?',
      correct: cap(ans),
      wrong: wrong.map(cap),
      expl: `${ans.toUpperCase()} leída al revés sigue siendo ${ans.toUpperCase()}. Es un palíndromo.`,
    };
  },
};

const ALL_VOWELS = ['murciélago', 'euforia', 'abuelito', 'neumático', 'republicano', 'educación', 'ecuación', 'arquitecto', 'reutilizado', 'aurícula'].filter((w) => 'aeiou'.split('').every((v) => strip(w).includes(v)));
const FEW_VOWELS = ['camiseta', 'elefante', 'montaña', 'bicicleta', 'pelota', 'ventana', 'mariposa', 'chocolate', 'teléfono', 'almohada', 'periódico', 'guitarra', 'caramelo', 'zapatilla', 'helicóptero', 'paraguas', 'universo', 'ordenador'];
const hasAll = (w: string) => 'aeiou'.split('').every((v) => strip(w).includes(v));
const allVowels: Family = {
  id: 'voc',
  counts: () => spread(0, 1, 1, 2, 1, 0),
  make: ({ rng }) => {
    const ans = pick(rng, ALL_VOWELS);
    const wrong = sample(rng, FEW_VOWELS.filter((w) => !hasAll(w)), 3);
    return {
      cat: 'palabras',
      prompt: '¿Qué palabra contiene las cinco vocales?',
      correct: cap(ans),
      wrong: wrong.map(cap),
      expl: `${ans.toUpperCase()} tiene a, e, i, o y u. A las demás les falta alguna.`,
    };
  },
};

const ALPHA_SETS = [
  ['casa', 'mesa', 'perro', 'árbol', 'libro', 'zapato', 'gato', 'nube', 'tigre', 'uva', 'oso', 'dedo', 'fuego', 'helado', 'isla', 'jarra', 'kilo', 'lobo', 'vaso', 'yate'],
  ['carta', 'cartón', 'carro', 'carpa', 'carne', 'cara', 'caro', 'carbón', 'cargo', 'carril'],
  ['pelota', 'pelo', 'pelea', 'pelaje', 'película', 'peligro', 'pelícano', 'peldaño'],
  ['mano', 'manta', 'manzana', 'mango', 'manada', 'manguera', 'maniquí', 'mancha'],
  ['sol', 'sola', 'soldado', 'soleado', 'solapa', 'solución', 'solo', 'soltar'],
];
const alphabetical: Family = {
  id: 'alf',
  counts: () => spread(1, 1, 1, 1, 1, 0),
  make: ({ D, rng }) => {
    const set = D <= 2 ? ALPHA_SETS[0] : D <= 5 ? pick(rng, ALPHA_SETS.slice(0, 3)) : pick(rng, ALPHA_SETS.slice(1));
    const four = sample(rng, set, 4);
    const ord = [...four].sort((a, b) => strip(a).localeCompare(strip(b), 'es'));
    const last = rng() < 0.5;
    const ans = last ? ord[3] : ord[0];
    return {
      cat: 'palabras',
      prompt: `¿Qué palabra iría ${last ? 'la última' : 'la primera'} en el diccionario?`,
      correct: cap(ans),
      wrong: four.filter((w) => w !== ans).map(cap),
      expl: `En orden alfabético: ${ord.join(', ')}.`,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Secret codes (word transformations)
// ─────────────────────────────────────────────────────────────────────────
const CODE_WORDS = ['GATO', 'MESA', 'LUNA', 'PATO', 'CASA', 'ROSA', 'LIBRO', 'PERRO', 'NUBE', 'MANO', 'FOCA', 'TREN', 'PLATO', 'VELA', 'DEDO', 'BOTE', 'CAMPO', 'SILLA', 'MONTE', 'CIELO', 'RUEDA', 'PIANO', 'LIMON', 'TORRE', 'BARCO'];
const VOW = 'AEIOU';
const RULES: { lv: number; name: string; f: (w: string) => string }[] = [
  { lv: 1, name: 'se escribe al revés', f: (w) => [...w].reverse().join('') },
  { lv: 1, name: 'intercambia la primera y la última letra', f: (w) => w[w.length - 1] + w.slice(1, -1) + w[0] },
  { lv: 2, name: 'pasa la primera letra al final', f: (w) => w.slice(1) + w[0] },
  { lv: 2, name: 'cambia cada vocal por la siguiente (A→E, E→I, I→O, O→U, U→A)', f: (w) => [...w].map((ch) => (VOW.includes(ch) ? VOW[(VOW.indexOf(ch) + 1) % 5] : ch)).join('') },
  { lv: 3, name: 'cambia cada letra por la siguiente del abecedario (sin Ñ)', f: (w) => [...w].map((ch) => String.fromCharCode(ch.charCodeAt(0) + 1)).join('') },
  { lv: 3, name: 'intercambia las letras de dos en dos', f: (w) => w.replace(/(.)(.)/g, '$2$1') },
];
const codes: Family = {
  id: 'cod',
  counts: () => spread(1, 2, 2, 2, 2, 1),
  make: ({ D, rng }) => {
    const lv = D <= 2 ? 1 : D <= 5 ? 2 : 3;
    const rule = pick(rng, RULES.filter((r) => r.lv <= lv && r.lv >= lv - 1));
    const [w1, w2] = sample(rng, CODE_WORDS.filter((w) => !w.includes('Z')), 2);
    const c1 = rule.f(w1);
    // The example must identify the rule unambiguously.
    if (RULES.some((r) => r !== rule && r.f(w1) === c1)) return null;
    const ans = rule.f(w2);
    const wrong = RULES.filter((r) => r !== rule).map((r) => r.f(w2)).filter((x) => x !== ans && x !== w2);
    const uniq = [...new Set(shuffle(wrong, rng))].slice(0, 3);
    if (uniq.length < 3 || ans === w2) return null;
    return {
      cat: 'relaciones',
      prompt: `En un código secreto, ${w1} se escribe ${c1}. ¿Cómo se escribe ${w2}?`,
      correct: ans,
      wrong: uniq,
      expl: `La palabra ${rule.name}: ${w2} → ${ans}.`,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Letter, day and month series
// ─────────────────────────────────────────────────────────────────────────
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const letterSeq: Family = {
  id: 'let',
  counts: () => spread(2, 2, 2, 2, 1, 1),
  make: ({ D, rng }) => {
    const back = D >= 3 && rng() < 0.4;
    const inter = D >= 5 && rng() < 0.5;
    let seq: string[];
    let ans: string;
    let expl: string;
    if (!inter) {
      const step = D <= 2 ? pick(rng, [1, 2]) : pick(rng, [2, 3, 4]);
      const L = 5;
      const start = back ? randInt(rng, step * L, 25) : randInt(rng, 0, 25 - step * L);
      const at = (i: number) => ABC[start + (back ? -1 : 1) * step * i];
      seq = Array.from({ length: L }, (_, i) => at(i));
      ans = at(L);
      expl = `Se avanza ${back ? 'hacia atrás ' : ''}${step === 1 ? 'de una en una' : `saltando ${['', 'una letra', 'dos letras', 'tres letras'][step - 1]} cada vez`}: ${[...seq, ans].join(', ')}.`;
    } else {
      // Two interleaved series: one forward, one backward.
      const s1 = randInt(rng, 0, 8);
      const s2 = randInt(rng, 17, 25);
      const k = pick(rng, [1, 2]);
      seq = [];
      for (let i = 0; i < 6; i++) seq.push(i % 2 === 0 ? ABC[s1 + (i / 2) * k] : ABC[s2 - ((i - 1) / 2) * k]);
      ans = ABC[s1 + 3 * k];
      expl = `Son dos series intercaladas: las posiciones impares avanzan desde la ${ABC[s1]} y las pares retroceden desde la ${ABC[s2]}.`;
    }
    const idx = ABC.indexOf(ans);
    const near = [idx - 1, idx + 1, idx + 2, idx - 2].filter((i) => i >= 0 && i < 26).map((i) => ABC[i]);
    const wrong = shuffle(near.filter((x) => x !== ans), rng).slice(0, 3);
    if (wrong.length < 3) return null;
    const needsNote = [...seq, ans].some((ch) => ch > 'N');
    return {
      cat: 'patrones',
      prompt: `¿Qué letra sigue?${needsNote ? ' (Abecedario sin Ñ.)' : ''}`,
      correct: ans,
      wrong,
      expl,
      visual: [seq.join(' ') + ' ?'],
    };
  },
};

const DAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const calSeq: Family = {
  id: 'cal',
  counts: (m) => (m === 'experto' ? spread(1, 1, 1, 1, 0, 0) : spread(2, 2, 1, 1, 1, 0)),
  make: ({ D, rng }) => {
    const months = rng() < 0.5;
    const arr = months ? MONTHS : DAYS;
    const step = D <= 2 ? 2 : pick(rng, months ? [2, 3, 4, 5] : [2, 3, 4]);
    const back = D >= 4 && rng() < 0.5;
    const start = randInt(rng, 0, arr.length - 1);
    const at = (i: number) => arr[(start + (back ? -1 : 1) * step * i + arr.length * 10) % arr.length];
    const seq = Array.from({ length: 4 }, (_, i) => cap(at(i)));
    const ans = cap(at(4));
    const near = shuffle([at(5), at(3), arr[(arr.indexOf(at(4)) + 1) % arr.length], arr[(arr.indexOf(at(4)) + arr.length - 1) % arr.length]].map(cap), rng);
    const wrong = [...new Set(near.filter((x) => x !== ans))].slice(0, 3);
    if (wrong.length < 3) return null;
    return {
      cat: 'patrones',
      prompt: `¿Qué ${months ? 'mes' : 'día'} completa la serie?`,
      correct: ans,
      wrong,
      expl: `Se avanza ${back ? 'hacia atrás ' : ''}de ${step} en ${step}: ${seq.join(', ')}, ${ans}.`,
      visual: [seq.join(' ') + ' ?'],
    };
  },
};

export const WORD_FAMILIES = [oddOne, analogy, anagram, palindrome, allVowels, alphabetical, codes, letterSeq, calSeq];
