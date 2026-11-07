import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useMode, type Mode } from '@/lib/theme';
import { useMotionOff } from '@/lib/prefs';

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

/** A big flat ball drifting very slowly, like takoyaki on the grill. */
function Ball({ size, left, top, color, delay }: { size: number; left: number; top: number; color: string; delay: number }) {
  const drift = useSharedValue(0);
  const off = useMotionOff();
  useEffect(() => {
    if (off) return;
    drift.value = withDelay(delay, withRepeat(withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [delay, drift, off]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: drift.value * 14 }] }));
  return <Animated.View style={[{ position: 'absolute', left, top, width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

/** The mood behind the deck: flat color shapes, plus drifting glyphs in Women and Hack. */
export function ModeBackdrop() {
  const { mode, t } = useMode();
  const { width, height } = useWindowDimensions();
  const reduced = useMotionOff();
  const glyphs = useMemo(() => (reduced ? [] : (FLOATERS[mode] ?? [])), [mode, reduced]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Ball size={width * 0.9} left={width * 0.45} top={-width * 0.35} color={t.line} delay={0} />
      <Ball size={width * 1.1} left={-width * 0.5} top={height * 0.62} color={t.line} delay={1500} />
      {glyphs.map((g, i) => (
        <Floater key={`${mode}${i}`} glyph={g} i={i} color={t.primary} width={width} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  floater: { position: 'absolute', top: 0 },
});
