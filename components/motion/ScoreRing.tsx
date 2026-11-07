import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useMode } from '@/lib/theme';

import { CountUp } from './CountUp';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Starts the ring at the top. Rotating the whole Svg also works on web.
const ROTATE = { transform: [{ rotate: '-90deg' }] };

export function ScoreRing({ score, size = 132, label = 'Shows up score', color }: { score: number; size?: number; label?: string; color?: string }) {
  const { t } = useMode();
  const stroke = size * 0.09;
  const r = (size - stroke) / 2;
  const length = 2 * Math.PI * r;
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withDelay(200, withTiming(score / 100, { duration: 1000, easing: Easing.out(Easing.cubic) }));
  }, [fill, score]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - fill.value) }));
  return (
    <View accessibilityLabel={`${label} ${score} out of 100`} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={`${t.primary}26`} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? t.like}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={length}
          animatedProps={props}
        />
      </Svg>
      <CountUp to={score} delayMs={200} durationMs={1000} style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: size * 0.3 }} />
    </View>
  );
}
