import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ReduceMotion, ReducedMotionConfig, useReducedMotion } from 'react-native-reanimated';

import { setHapticsEnabled } from './haptics';
import { useMode, type Mode } from './theme';

export type Prefs = {
  haptics: boolean;
  calmMotion: boolean;
  startMode: Mode;
  notifyMatches: boolean;
  notifyCopyAlerts: boolean;
};

const DEFAULTS: Prefs = { haptics: true, calmMotion: false, startMode: 'normal', notifyMatches: true, notifyCopyAlerts: true };
const KEY = 'commit.prefs';

type Value = { prefs: Prefs; setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void };
const PrefsContext = createContext<Value>({ prefs: DEFAULTS, setPref: () => {} });

export function PrefsProvider({ children }: { children: ReactNode }) {
  const { setMode } = useMode();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = { ...DEFAULTS, ...JSON.parse(raw) } as Prefs;
        setPrefs(saved);
        setHapticsEnabled(saved.haptics);
        setMode(saved.startMode);
      })
      // Bad or missing saved settings just mean defaults.
      .catch(() => {});
  }, [setMode]);

  const value = useMemo<Value>(
    () => ({
      prefs,
      setPref: (key, next) => {
        setPrefs((current) => {
          const updated = { ...current, [key]: next };
          AsyncStorage.setItem(KEY, JSON.stringify(updated)).catch(() => {});
          return updated;
        });
        if (key === 'haptics') setHapticsEnabled(next as boolean);
      },
    }),
    [prefs],
  );

  return (
    <PrefsContext.Provider value={value}>
      {prefs.calmMotion ? <ReducedMotionConfig mode={ReduceMotion.Always} /> : null}
      {children}
    </PrefsContext.Provider>
  );
}

export const usePrefs = () => useContext(PrefsContext);

/** True when the phone or Commit's own setting asks for calm. Use this, not useReducedMotion. */
export function useMotionOff() {
  const system = useReducedMotion();
  return system || useContext(PrefsContext).prefs.calmMotion;
}
