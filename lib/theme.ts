import { createContext, createElement, useContext, useMemo, useState, type ReactNode } from 'react';

import { copy, type ModeCopy } from './copy';

export type Mode = 'normal' | 'women' | 'hack';

export type ThemeTokens = {
  bg: string;
  surface: string;
  primary: string;
  onPrimary: string;
  text: string;
  muted: string;
  like: string;
  pass: string;
  accent: string;
  line: string;
  fontDisplay: string;
  fontBody: string;
  fontBold: string;
};

// Takoyaki: batter orange, sauce brown, gold, aonori green. Flat color only, no gradients or outlines.
export const themes: Record<Mode, ThemeTokens> = {
  normal: {
    bg: '#FFEDE3',
    surface: '#FFFFFF',
    primary: '#FF6B35',
    onPrimary: '#FFFFFF',
    text: '#2A1408',
    muted: '#86604C',
    like: '#4CAF50',
    pass: '#2A1408',
    accent: '#FFC233',
    line: '#FFD9C6',
    fontDisplay: 'BricolageGrotesque_800ExtraBold',
    fontBody: 'Figtree_400Regular',
    fontBold: 'Figtree_700Bold',
  },
  women: {
    bg: '#FFE3F1',
    surface: '#FFF5FA',
    primary: '#E4688C',
    onPrimary: '#FFFFFF',
    text: '#3A0A24',
    muted: '#8A3A63',
    like: '#E4688C',
    pass: '#3A0A24',
    accent: '#FFC233',
    line: '#FFC6E2',
    fontDisplay: 'Shrikhand_400Regular',
    fontBody: 'Figtree_400Regular',
    fontBold: 'Figtree_700Bold',
  },
  hack: {
    bg: '#0F0F14',
    surface: '#1C1C24',
    primary: '#22D3EE',
    onPrimary: '#0F0F14',
    text: '#E5E7EB',
    muted: '#9CA3AF',
    like: '#00D2A0',
    pass: '#E5E7EB',
    accent: '#FF6B35',
    line: '#2C2C38',
    fontDisplay: 'JetBrainsMono_700Bold',
    fontBody: 'JetBrainsMono_400Regular',
    fontBold: 'JetBrainsMono_700Bold',
  },
};

type ModeValue = { mode: Mode; setMode: (m: Mode) => void; t: ThemeTokens; copy: ModeCopy };

const ModeContext = createContext<ModeValue | null>(null);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>('normal');
  const value = useMemo(() => ({ mode, setMode, t: themes[mode], copy: copy[mode] }), [mode]);
  return createElement(ModeContext.Provider, { value }, children);
}

/** Every screen takes colors from `t` and words from `copy`. Never hardcode either. */
export function useMode(): ModeValue {
  const value = useContext(ModeContext);
  if (!value) throw new Error('useMode must be used inside ModeProvider');
  return value;
}
