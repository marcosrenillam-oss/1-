import type { Mode, Question } from '../types';
import { FACIL } from './facil';
import { NORMAL } from './normal';
import { DIFICIL } from './dificil';
import { EXPERTO } from './experto';
import { ENIGMAS } from './enigmas';
import GENERATED from './generated.json';

/**
 * The full local question bank:
 *  - facil/normal/dificil/experto.ts: original hand-written questions
 *  - enigmas.ts: riddles, lateral thinking, kinship and classic puzzles
 *  - generated.json: solver-verified template questions (`npm run gen`)
 * To extend it, append questions (any tier, any category): the selector adapts.
 */
const EXTRA: Question[] = [...ENIGMAS, ...(GENERATED as Question[])];
const extraFor = (m: Mode) => EXTRA.filter((q) => q.mode === m);

export const BANK: Record<Mode, Question[]> = {
  facil: [...FACIL, ...extraFor('facil')],
  normal: [...NORMAL, ...extraFor('normal')],
  dificil: [...DIFICIL, ...extraFor('dificil')],
  experto: [...EXPERTO, ...extraFor('experto')],
};

const BY_ID = new Map<string, Question>();
for (const list of Object.values(BANK)) for (const q of list) BY_ID.set(q.id, q);

export function getQuestion(id: string): Question | undefined {
  return BY_ID.get(id);
}

export const TOTAL_QUESTIONS = BY_ID.size;
