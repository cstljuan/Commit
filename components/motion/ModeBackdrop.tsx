import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useMode, type Mode } from '@/lib/theme';

const GLOW: Record<Mode, { a: string; b: string; strength: number }> = {
  normal: { a: '#6C5CE7', b: '#00D2A0', strength: 0.14 },
  women: { a: '#FF2E93', b: '#D9C2FF', strength: 0.5 },
  hack: { a: '#22D3EE', b: '#E879F9', strength: 0.2 },
};

const FLOATERS: Partial<Record<Mode, string[]>> = {
  women: ['♥︎', '✦', '♡︎', '✧', '♥︎', '✦', '♡︎', '✧'],
  hack: ['</>', '{ }', '$_', '&&', 'git', '0x', '//', '=>'],
};

function Floater({ glyph, i, color, width, height }: { glyph: string; i: number; color: string; width: number; height: number }) {
  const rise = useSharedValue(0);
  const x = ((i * 137) % 100) / 100;
  const size = 14 + ((i * 53) % 18);
  const drift = (i % 2 ? 1 : -1) * (10 + (i * 7) % 22);
  useEffect(() => {
    rise.value = withDelay((i * 900) % 5000, withRepeat(withTiming(1, { duration: 7000 + (i * 700) % 4000, easing: Easing.linear }), -1, false));
  }, [i, rise]);
  const style = useAnimatedStyle(() => {
    const fade = rise.value < 0.15 ? rise.value / 0.15 : rise.value > 0.8 ? (1 - rise.value) / 0.2 : 1;
    return {
      opacity: fade * 0.5,
      transform: [
        { translateY: height - rise.value * (height + 60) },
        { translateX: Math.sin(rise.value * Math.PI * 3) * drift },
        { rotate: `${rise.value * 40 * (i % 2 ? 1 : -1)}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[styles.floater, { left: x * width }, style]}>
      <Text style={{ color, fontSize: size, fontWeight: '700' }}>{glyph}</Text>
    </Animated.View>
  );
}

/** The mood behind the deck: a soft glow, plus drifting glyphs in Women and Hack. */
export function ModeBackdrop() {
  const { mode, t } = useMode();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const glow = GLOW[mode];
  const glyphs = useMemo(() => (reduced ? [] : (FLOATERS[mode] ?? [])), [mode, reduced]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="a" cx="85%" cy="12%" r="65%">
            <Stop offset="0" stopColor={glow.a} stopOpacity={glow.strength} />
            <Stop offset="1" stopColor={glow.a} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="b" cx="5%" cy="90%" r="65%">
            <Stop offset="0" stopColor={glow.b} stopOpacity={glow.strength} />
            <Stop offset="1" stopColor={glow.b} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#a)" />
        <Rect width={width} height={height} fill="url(#b)" />
      </Svg>
      {glyphs.map((g, i) => (
        <Floater key={`${mode}${i}`} glyph={g} i={i} color={t.primary} width={width} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  floater: { position: 'absolute', top: 0 },
});
