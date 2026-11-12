import type { Question } from '../types';
import { LOGIC_FAMILIES } from './logic';
import { VISUAL_FAMILIES } from './visual';
import { WORD_FAMILIES } from './words';
import { buildGenerated } from './util';

/**
 * Template-based questions, each verified by a solver (unique answer).
 * Generated once with `npm run gen` into questions/generated.json, so the
 * app ships them as static data: nothing is generated at runtime.
 */
export function generateAll(): Question[] {
  return buildGenerated([...LOGIC_FAMILIES, ...VISUAL_FAMILIES, ...WORD_FAMILIES]);
}
