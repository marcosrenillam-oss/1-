import { LEVELS, type Level, type Question } from '../types';
import { FACIL } from './facil';
import { NORMAL } from './normal';
import { DIFICIL } from './dificil';
import { EXPERTO } from './experto';
import { ENIGMAS } from './enigmas';
import { IDEAS } from './ideas';
import GENERATED from './generated.json';

/**
 * The full local question bank, by difficulty level (1-7):
 *  - facil/normal/dificil/experto.ts: original hand-written questions (levels 1-4)
 *  - enigmas.ts: riddles, lateral thinking, kinship and classic puzzles
 *  - ideas.ts: paradoxes, philosophy, fallacies and boss questions
 *  - generated.json: solver-verified template questions (`npm run gen`)
 * To extend it, append questions (any level, tier or category): the selector adapts.
 */
export const ALL_QUESTIONS: Question[] = [...FACIL, ...NORMAL, ...DIFICIL, ...EXPERTO, ...ENIGMAS, ...IDEAS, ...(GENERATED as Question[])];

export const BANK: Record<Level, Question[]> = Object.fromEntries(
  LEVELS.map((l) => [l, ALL_QUESTIONS.filter((q) => q.level === l)]),
) as Record<Level, Question[]>;

const BY_ID = new Map<string, Question>();
for (const q of ALL_QUESTIONS) BY_ID.set(q.id, q);

export function getQuestion(id: string): Question | undefined {
  return BY_ID.get(id);
}

export const TOTAL_QUESTIONS = BY_ID.size;
