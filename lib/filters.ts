import { useSyncExternalStore } from 'react';

import type { Card } from './types';

export type FilterGroup = 'Role' | 'Level' | 'Theme' | 'Timeframe';
export type DeckFilters = Partial<Record<FilterGroup, string[]>>;

let current: DeckFilters = {};
const listeners = new Set<() => void>();

export const getDeckFilters = () => current;
export const setDeckFilters = (next: DeckFilters) => {
  current = next;
  listeners.forEach((l) => l());
};
export const useDeckFilters = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getDeckFilters,
  );

export const filterCount = (f: DeckFilters) => Object.values(f).reduce((n, list) => n + (list?.length ?? 0), 0);

const hit = (list: string[] | undefined, value: string) => !list?.length || list.some((x) => x.toLowerCase() === value.toLowerCase());

/** Filters run on the phone for now. A group only applies to cards that have that field. */
export const matchesFilters = (card: Card, f: DeckFilters) => {
  if (card.kind === 'person') return hit(f.Role, card.role) && hit(f.Level, card.level);
  const roleOk = !f.Role?.length || card.roles.some((r) => r.open > 0 && f.Role!.includes(r.role));
  return roleOk && hit(f.Theme, card.theme) && hit(f.Timeframe, card.timeframe);
};
