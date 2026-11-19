import type { Mode, Pref } from './tokens';

export function resolveMode(pref: Pref, system: 'light' | 'dark' | null | undefined): Mode {
  if (pref === 'terang' || pref === 'gelap') return pref;
  return system === 'dark' ? 'gelap' : 'terang';
}
