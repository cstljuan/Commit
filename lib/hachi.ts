import { makeMutable } from 'react-native-reanimated';

import type { HachiState } from '@/components/Hachi/model';

type Listener = (cmd: { type: 'play' | 'set'; name: HachiState | string }) => void;
const listeners = new Set<Listener>();
const touchListeners = new Set<() => void>();

/**
 * Tells Hachi what is happening, from anywhere, the way Seams called arc.play(). Keep calls
 * to play and set so the art can change without touching the app. Every Hachi on screen with
 * `listen` reacts.
 */
export const hachi = {
  /** One-shot reaction, then back to what Hachi was doing. */
  play: (name: HachiState) => listeners.forEach((l) => l({ type: 'play', name })),
  /** Holds a looping state until changed. */
  set: (name: HachiState) => listeners.forEach((l) => l({ type: 'set', name })),
  subscribe: (l: Listener) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

/** The last place a finger touched, read on the UI thread so Hachi's eyes can follow it. */
export const pointer = makeMutable({ x: 0, y: 0, t: 0 });

export const noteTouch = (x: number, y: number, t: number) => {
  pointer.value = { x, y, t };
};

export const noteTouchStart = () => touchListeners.forEach((l) => l());
export const onAnyTouch = (l: () => void) => {
  touchListeners.add(l);
  return () => {
    touchListeners.delete(l);
  };
};
