/** Legacy authoring names of the first four difficulty levels. */
export type Mode = 'facil' | 'normal' | 'dificil' | 'experto';

/** Global difficulty level of a question: 1 (gentle) … 7 (brutal). */
export type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const LEVELS: Level[] = [1, 2, 3, 4, 5, 6, 7];
export const LEVEL_OF_MODE: Record<Mode, Level> = { facil: 1, normal: 2, dificil: 3, experto: 4 };

/**
 * How the player answers:
 *  - choice: pick one of 4 options (default)
 *  - order:  tap the items in the right order
 *  - tap:    tap the right cell of the visual grid
 *  - memory: watch cells light up, then tap them back
 *  - paint:  paint cells of a 3×3 grid to build the answer
 */
export type QKind = 'choice' | 'order' | 'tap' | 'memory' | 'paint';

export type Category =
  | 'deductiva'
  | 'secuencias'
  | 'matematicas'
  | 'adivinanzas'
  | 'patrones'
  | 'visual'
  | 'palabras'
  | 'lateral'
  | 'observacion'
  | 'relaciones'
  | 'verbal'
  | 'problemas'
  | 'paradojas'
  | 'filosofia'
  | 'tactil'
  | 'memoria';

/** Difficulty band inside a run: 1 = intro … 6 = final challenge. */
export type Tier = 1 | 2 | 3 | 4 | 5 | 6;

export interface Question {
  id: string;
  level: Level;
  tier: Tier;
  category: Category;
  prompt: string;
  /**
   * Optional visual block. Each string is a row; cells are separated by
   * whitespace. Inside a cell, `{token}` renders a vector shape (see Glyph.tsx)
   * and `?` renders the "missing" slot.
   */
  visual?: string[];
  /** Options as authored. options[answer] is the correct one. */
  options: string[];
  answer: number;
  explanation: string;
  /**
   * Puzzle type (e.g. a generator family). A run avoids repeating a style.
   * Defaults to the category for hand-written questions.
   */
  style?: string;
  /** Answer mechanic (default 'choice'). */
  kind?: QKind;
  /** order: the items in their correct order (shown shuffled). */
  items?: string[];
  /** tap: index (reading order) of the correct cell of `visual`. */
  cell?: number;
  /** memory: side of the square grid, cells to remember and whether order matters. */
  size?: number;
  seq?: number[];
  ordered?: boolean;
  /** paint: 9-char target mask ('1' = painted) of the 3×3 grid. */
  target?: string;
  /** Eligible as a world boss (adventure). */
  boss?: boolean;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  deductiva: 'Lógica deductiva',
  secuencias: 'Secuencias numéricas',
  matematicas: 'Cálculo cotidiano',
  adivinanzas: 'Adivinanzas',
  patrones: 'Patrones y series',
  visual: 'Patrones visuales',
  palabras: 'Juegos de palabras',
  lateral: 'Pensamiento lateral',
  observacion: 'Observación',
  relaciones: 'Relaciones',
  verbal: 'Lógica verbal',
  problemas: 'Resolución de problemas',
  paradojas: 'Paradojas',
  filosofia: 'Filosofía y falacias',
  tactil: 'Desafío táctil',
  memoria: 'Memoria',
};

/**
 * Authoring helper. The CORRECT option is always written first; the game
 * shuffles option order at runtime, so source order never leaks the answer.
 */
export function makeQ(mode: Mode | Level, extra: Partial<Question> = {}) {
  const level: Level = typeof mode === 'number' ? mode : LEVEL_OF_MODE[mode];
  return (
    id: string,
    tier: Tier,
    category: Category,
    prompt: string,
    options: [string, string, string, string],
    explanation: string,
    visual?: string[],
  ): Question => ({ id, level, tier, category, prompt, options, answer: 0, explanation, ...(visual ? { visual } : {}), ...extra });
}
