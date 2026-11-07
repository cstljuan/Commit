import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useMode } from '@/lib/theme';

export type TakoState = 'idle' | 'happy' | 'ink' | 'alert' | 'broken';

const ARMS = [
  'M46 136C30 160 16 168 8 196',
  'M60 142C50 170 40 186 38 214',
  'M76 146C72 176 68 194 70 224',
  'M92 148C92 178 92 198 92 230',
  'M108 148C108 178 108 198 108 230',
  'M124 146C128 176 132 194 130 224',
  'M140 142C150 170 160 186 162 214',
  'M154 136C170 160 184 168 192 196',
];
const ARMS_UP = [...ARMS];
ARMS_UP[0] = 'M46 136C24 120 12 96 8 66';
ARMS_UP[7] = 'M154 136C176 120 188 96 192 66';

const HEAD = 'M100 14C146 14 172 50 172 92C172 122 158 142 142 152H58C42 142 28 122 28 92C28 50 54 14 100 14Z';
const eye = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;

const EYES: Record<TakoState, string> = {
  idle: eye(76, 86, 11, 16) + eye(124, 86, 11, 16),
  ink: eye(76, 86, 11, 16) + eye(124, 86, 11, 16),
  alert: eye(74, 84, 17, 23) + eye(126, 84, 17, 23),
  happy: 'M64 92C66 74 86 74 88 92L80 92C78 84 74 84 72 92ZM112 92C114 74 134 74 136 92L128 92C126 84 122 84 120 92Z',
  broken:
    'M64 76L72 70L88 88L80 96ZM88 76L80 70L64 88L72 96ZM112 76L120 70L136 88L128 96ZM136 76L128 70L112 88L120 96Z',
};

const BROKEN_RED = '#E5484D';

type Props = {
  state?: TakoState;
  size?: number;
  /** Overrides the mode colour, for example on a coloured background. */
  color?: string;
  /** Breathes at rest and reacts when its state changes. Leave off for Tako on cards. */
  animated?: boolean;
};

/** One solid colour per mode, negative-space eyes, no mouth, no gradient. */
export function Tako({ state = 'idle', size = 96, color, animated = false }: Props) {
  const { t } = useMode();
  const reduced = useReducedMotion();
  const fill = state === 'broken' ? BROKEN_RED : (color ?? t.primary);
  const arms = state === 'happy' || state === 'alert' ? ARMS_UP : ARMS;

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
      <Svg width={size} height={(size * 240) / 200} viewBox="0 0 200 240" fill="none">
        {arms.map((d) => (
          <Path key={d} d={d} stroke={fill} strokeWidth={13} strokeLinecap="round" />
        ))}
        <Path fill={fill} fillRule="evenodd" clipRule="evenodd" d={HEAD + EYES[state]} />
      </Svg>
    </Animated.View>
  );
}
