export type Mode = 'facil' | 'normal' | 'dificil' | 'experto';

export type Category =
  | 'deductiva'
  | 'adivinanzas'
  | 'patrones'
  | 'visual'
  | 'palabras'
  | 'lateral'
  | 'observacion'
  | 'relaciones'
  | 'verbal'
  | 'problemas';

/** Difficulty band inside a run: 1 = intro … 6 = final challenge. */
export type Tier = 1 | 2 | 3 | 4 | 5 | 6;

export interface Question {
  id: string;
  mode: Mode;
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
}

export const CATEGORY_LABEL: Record<Category, string> = {
  deductiva: 'Lógica deductiva',
  adivinanzas: 'Adivinanzas',
  patrones: 'Patrones y series',
  visual: 'Patrones visuales',
  palabras: 'Juegos de palabras',
  lateral: 'Pensamiento lateral',
  observacion: 'Observación',
  relaciones: 'Relaciones',
  verbal: 'Lógica verbal',
  problemas: 'Resolución de problemas',
};

/**
 * Authoring helper. The CORRECT option is always written first; the game
 * shuffles option order at runtime, so source order never leaks the answer.
 */
export function makeQ(mode: Mode) {
  return (
    id: string,
    tier: Tier,
    category: Category,
    prompt: string,
    options: [string, string, string, string],
    explanation: string,
    visual?: string[],
  ): Question => ({ id, mode, tier, category, prompt, options, answer: 0, explanation, visual });
}
