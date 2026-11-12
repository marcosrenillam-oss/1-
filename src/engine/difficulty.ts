import type { Mode, Tier } from '../data/types';

export const RUN_LENGTH = 20;

export const MODES: Mode[] = ['facil', 'normal', 'dificil', 'experto'];

export interface ModeInfo {
  id: Mode;
  label: string;
  level: 1 | 2 | 3 | 4;
  tagline: string;
}

export const MODE_INFO: Record<Mode, ModeInfo> = {
  facil: { id: 'facil', label: 'Fácil', level: 1, tagline: 'Calienta motores. Lógica clara, sin trampas.' },
  normal: { id: 'normal', label: 'Normal', level: 2, tagline: 'Más pasos, más atención. Aquí empiezan las dudas.' },
  dificil: { id: 'dificil', label: 'Difícil', level: 3, tagline: 'Deducciones encadenadas. Cada detalle importa.' },
  experto: { id: 'experto', label: 'Experto', level: 4, tagline: 'Para el 1 %. Sin margen de error.' },
};

/**
 * Tier required at each of the 20 slots:
 *  1-4 intro · 5-8 intermedio · 9-12 avanzado · 13-16 elevado · 17-19 muy difícil · 20 final
 */
export const SLOT_TIERS: Tier[] = [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 6];

export const TIER_LABEL: Record<Tier, string> = {
  1: 'Introducción',
  2: 'Intermedio',
  3: 'Avanzado',
  4: 'Elevado',
  5: 'Muy difícil',
  6: 'Desafío final',
};
