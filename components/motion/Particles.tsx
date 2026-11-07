import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useMode, type Mode } from '@/lib/theme';
import { useMotionOff } from '@/lib/prefs';

export const MODE_GLYPHS: Record<Mode, string[]> = {
  normal: ['★︎', '●', '▲'],
  women: ['♥︎', '✦', '♡︎'],
  hack: ['+', '{ }', '</>'],
};

function Particle({ i, count, burst, glyph, color, reach }: { i: number; count: number; burst: SharedValue<number>; glyph: string; color: string; reach: number }) {
  const angle = (i / count) * Math.PI * 2 + (i % 2) * 0.22;
  const distance = reach * (0.6 + ((i * 37) % 40) / 100);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(burst.value, [0, 0.12, 0.7, 1], [0, 1, 1, 0]),
    transform: [
      { translateX: Math.cos(angle) * distance * burst.value },
      // Particles fall a little as they spread.
      { translateY: Math.sin(angle) * distance * burst.value + 50 * burst.value * burst.value },
      { rotate: `${i * 40 * burst.value}deg` },
      { scale: interpolate(burst.value, [0, 0.2, 1], [0.3, 1.15, 0.7]) },
    ],
  }));
  return (
    <Animated.View style={[styles.particle, style]}>
      <Text style={{ color, fontSize: 18 + (i % 3) * 6, fontWeight: '700' }}>{glyph}</Text>
    </Animated.View>
  );
}

type FieldProps = { burst: SharedValue<number>; count?: number; color: string; reach?: number; glyphs?: string[] };

/** Driven by a shared value from 0 to 1, so a parent can time it with other motion. */
export function ParticleField({ burst, count = 18, color, reach = 220, glyphs }: FieldProps) {
  const { mode } = useMode();
  const set = glyphs ?? MODE_GLYPHS[mode];
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Particle key={i} i={i} count={count} burst={burst} glyph={set[i % set.length]} color={color} reach={reach} />
      ))}
    </>
  );
}

/** Fires once each time `fire` changes, centred in its parent. Never blocks touches. */
export function Burst({ fire, color, count = 12, reach = 170 }: { fire: number; color: string; count?: number; reach?: number }) {
  const burst = useSharedValue(0);
  const reduced = useMotionOff();
  useEffect(() => {
    if (!fire || reduced) return;
    burst.value = 0;
    burst.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) });
  }, [burst, fire, reduced]);
  return (
    <View pointerEvents="none" style={styles.center}>
      <ParticleField burst={burst} color={color} count={count} reach={reach} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  particle: { position: 'absolute' },
});
