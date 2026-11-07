import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useMode } from '@/lib/theme';
import { useMotionOff } from '@/lib/prefs';

import { MascotArt, type TakoState } from './art';

export type { TakoState };

const BROKEN_RED = '#E5484D';

type Props = {
  state?: TakoState;
  size?: number;
  /** Overrides the mode colour, for example on a coloured background. */
  color?: string;
  /** Breathes at rest and reacts when its state changes. Leave off for Tako on cards. */
  animated?: boolean;
};

/** The mascot with its motion. Its drawing lives in art.tsx, so it can be swapped there. */
export function Tako({ state = 'idle', size = 96, color, animated = false }: Props) {
  const { t } = useMode();
  const reduced = useMotionOff();
  const fill = state === 'broken' ? BROKEN_RED : (color ?? t.primary);

  const scale = useSharedValue(1);
  const shift = useSharedValue(0);

  useEffect(() => {
    if (!animated || reduced) return;
    cancelAnimation(scale);
    cancelAnimation(shift);
    shift.value = 0;
    if (state === 'idle') {
      scale.value = withRepeat(
        withSequence(withTiming(1.04, { duration: 1100 }), withTiming(1, { duration: 1100 })),
        -1,
      );
    } else if (state === 'happy') {
      scale.value = withSequence(withSpring(1.2, { damping: 8, stiffness: 300 }), withSpring(1));
    } else if (state === 'ink') {
      scale.value = withSequence(withTiming(0.86, { duration: 120 }), withSpring(1.1, { damping: 7 }), withSpring(1));
    } else {
      // Alert and broken both shake. Broken is the louder of the two.
      const amount = state === 'broken' ? 7 : 3;
      scale.value = withSpring(1);
      shift.value = withSequence(
        withTiming(-amount, { duration: 45 }),
        withRepeat(withTiming(amount, { duration: 70 }), 5, true),
        withTiming(0, { duration: 45 }),
      );
    }
  }, [animated, reduced, scale, shift, state]);

  const motion = useAnimatedStyle(() => ({
    transform: [{ translateX: shift.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={motion}>
      <MascotArt state={state} fill={fill} size={size} />
    </Animated.View>
  );
}
