import type { Mode, Question } from '../types';
import { FACIL } from './facil';
import { NORMAL } from './normal';
import { DIFICIL } from './dificil';
import { EXPERTO } from './experto';

/**
 * The full local question bank. To extend it, append questions to the
 * per-mode files (any tier, any category): the selector adapts automatically.
 */
export const BANK: Record<Mode, Question[]> = {
  facil: FACIL,
  normal: NORMAL,
  dificil: DIFICIL,
  experto: EXPERTO,
};

const BY_ID = new Map<string, Question>();
for (const list of Object.values(BANK)) for (const q of list) BY_ID.set(q.id, q);

export function getQuestion(id: string): Question | undefined {
  return BY_ID.get(id);
}

export const TOTAL_QUESTIONS = BY_ID.size;
