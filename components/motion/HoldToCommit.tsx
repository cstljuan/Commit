import * as Haptics from '@/lib/haptics';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { Burst } from '@/components/motion/Particles';
import { useMode } from '@/lib/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 104;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const LENGTH = 2 * Math.PI * RADIUS;
const HOLD_MS = 900;

type Props = { label?: string; doneLabel?: string; onCommit: () => void; committed?: boolean };

/**
 * Committing to a team is a promise, so it takes a held press, not a tap. The ring fills,
 * the haptics climb, and letting go early cancels it. VoiceOver users get a plain activate.
 */
export function HoldToCommit({ label = 'Hold to commit', doneLabel = 'Committed', onCommit, committed }: Props) {
  const { t } = useMode();
  const [done, setDone] = useState(!!committed);
  const [fire, setFire] = useState(0);
  const ticks = useRef<ReturnType<typeof setTimeout>[]>([]);
  const fill = useSharedValue(committed ? 1 : 0);
  const pop = useSharedValue(1);

  const stopTicks = () => {
    ticks.current.forEach(clearTimeout);
    ticks.current = [];
  };

  const complete = () => {
    stopTicks();
    setDone(true);
    setFire((n) => n + 1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onCommit();
  };

  const begin = () => {
    if (done) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    ticks.current = [
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), HOLD_MS * 0.3),
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), HOLD_MS * 0.55),
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), HOLD_MS * 0.75),
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), HOLD_MS * 0.9),
    ];
    pop.value = withTiming(0.92, { duration: HOLD_MS });
    fill.value = withTiming(1, { duration: HOLD_MS, easing: Easing.inOut(Easing.quad) }, (finished) => {
      if (finished) {
        pop.value = withSequence(withSpring(1.14, { damping: 7, stiffness: 320 }), withSpring(1));
        scheduleOnRN(complete);
      }
    });
  };

  const cancel = () => {
    if (done) return;
    stopTicks();
    cancelAnimation(fill);
    fill.value = withTiming(0, { duration: 220 });
    pop.value = withSpring(1);
  };

  const ring = useAnimatedProps(() => ({ strokeDashoffset: LENGTH * (1 - fill.value) }));
  const body = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={done ? doneLabel : label}
        accessibilityState={{ disabled: done }}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={() => {
          if (!done) {
            fill.value = 1;
            complete();
          }
        }}
        onPressIn={begin}
        onPressOut={cancel}>
        <Animated.View style={[styles.button, body]}>
          <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={t.primary + '33'} strokeWidth={STROKE} fill="none" />
            <AnimatedCircle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={t.primary}
              strokeWidth={STROKE}
              fill={done ? t.primary : 'none'}
              strokeLinecap="round"
              strokeDasharray={LENGTH}
              animatedProps={ring}
              rotation={-90}
              originX={SIZE / 2}
              originY={SIZE / 2}
            />
          </Svg>
          <Text style={{ color: done ? t.onPrimary : t.primary, fontFamily: t.fontBold, fontSize: done ? 40 : 15 }}>
            {done ? '✓︎' : 'Commit'}
          </Text>
        </Animated.View>
      </Pressable>
      <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 14 }}>{done ? doneLabel : label}</Text>
      <Burst fire={fire} color={t.primary} count={14} reach={150} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 10 },
  button: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
});
