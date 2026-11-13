import type { Question } from '../types';
import { LOGIC_FAMILIES } from './logic';
import { MORE_FAMILIES } from './more';
import { NUMBER_FAMILIES } from './numbers';
import { PHILO_FAMILIES } from './philo';
import { TOUCH_FAMILIES } from './touch';
import { VISUAL_FAMILIES } from './visual';
import { WORD_FAMILIES } from './words';
import { buildGenerated } from './util';

export const ALL_FAMILIES = [...LOGIC_FAMILIES, ...VISUAL_FAMILIES, ...WORD_FAMILIES, ...NUMBER_FAMILIES, ...MORE_FAMILIES, ...TOUCH_FAMILIES, ...PHILO_FAMILIES];

/**
 * Template-based questions, each verified by a solver (unique answer).
 * Generated once with `npm run gen` into questions/generated.json, so the
 * app ships them as static data: nothing is generated at runtime.
 */
export function generateAll(): Question[] {
  return buildGenerated(ALL_FAMILIES);
}
