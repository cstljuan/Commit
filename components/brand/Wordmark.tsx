import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useMotionOff } from '@/lib/prefs';
import { useMode } from '@/lib/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const WIDTH = 358;
const HEIGHT = 92;
const STROKE = 13;
const DRAW = 1000;

type Stroke = { base: string; foot?: (s: number) => string };

// Built like Hachi: one thick round stroke per part. The m's legs and the t's tail are little
// tentacles that sway, the o is a commit node, and the dot on the i is a takoyaki ball.
const leg = (x: number) => (s: number) => {
  'worklet';
  return `V61C${x} 70 ${x - 2 + s * 0.6} 75 ${x - 8 + s * 1.6} 75`;
};
const tail = (s: number) => {
  'worklet';
  return `V58C320 70 326 76 ${340 + s} ${70 - s * 0.6}`;
};

// Stems sit 28 apart with room between each m, so the letters stay readable at small sizes.
const LETTERS: Stroke[][] = [
  [{ base: 'M45 41A19 19 0 1 0 45 67' }],
  [
    { base: 'M122 38', foot: leg(122) },
    { base: 'M122 50C122 34 150 34 150 50', foot: leg(150) },
    { base: 'M150 50C150 34 178 34 178 50', foot: leg(178) },
  ],
  [
    { base: 'M202 38', foot: leg(202) },
    { base: 'M202 50C202 34 230 34 230 50', foot: leg(230) },
    { base: 'M230 50C230 34 258 34 258 50', foot: leg(258) },
  ],
  [{ base: 'M282 40V72' }],
  [{ base: 'M320 20', foot: tail }, { base: 'M307 38H336' }],
];

function Part({ part, sway, drawn, color, phase }: { part: Stroke; sway: { value: number }; drawn: { value: number }; color: string; phase: number }) {
  const { base, foot } = part;
  const props = useAnimatedProps(() => ({
    d: foot ? base + foot(sway.value * Math.cos(phase)) : base,
    strokeDashoffset: 260 * (1 - drawn.value),
    opacity: drawn.value > 0.002 ? 1 : 0,
  }));
  return (
    <AnimatedPath
      animatedProps={props}
      stroke={color}
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="260 260"
      fill="none"
    />
  );
}

function Letter({ strokes, index, sway, animated, color }: { strokes: Stroke[]; index: number; sway: { value: number }; animated: boolean; color: string }) {
  const drawn = useSharedValue(animated ? 0 : 1);
  useEffect(() => {
    if (animated) drawn.value = withDelay(index * 110, withTiming(1, { duration: DRAW / 2, easing: Easing.out(Easing.cubic) }));
  }, [animated, drawn, index]);
  return (
    <>
      {strokes.map((part, i) => (
        <Part key={part.base} part={part} sway={sway} drawn={drawn} color={color} phase={index + i * 1.4} />
      ))}
    </>
  );
}

/** The Commit wordmark. It draws itself, then its legs keep moving. */
export function Wordmark({ height = 56, animated = true, color, accent }: { height?: number; animated?: boolean; color?: string; accent?: string }) {
  const { t } = useMode();
  const off = useMotionOff();
  const live = animated && !off;
  const ink = color ?? t.text;
  const pop = accent ?? t.primary;
  const sway = useSharedValue(0);
  const node = useSharedValue(live ? 0 : 1);
  const ball = useSharedValue(live ? 0 : 1);

  useEffect(() => {
    if (!live) return;
    sway.value = withRepeat(
      withSequence(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), withTiming(-1, { duration: 1100, easing: Easing.inOut(Easing.sin) })),
      -1,
      true,
    );
    node.value = withDelay(110, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
    // The takoyaki ball pops in last, in place, so it never leaves the logo's box.
    ball.value = withDelay(620, withSpring(1, { damping: 11, stiffness: 220 }));
  }, [ball, live, node, sway]);

  const nodeProps = useAnimatedProps(() => ({ strokeDashoffset: 120 * (1 - node.value), opacity: node.value > 0.002 ? 1 : 0 }));
  const ballProps = useAnimatedProps(() => ({ strokeWidth: Math.max(0.01, 19 * ball.value), opacity: ball.value > 0.01 ? 1 : 0 }));

  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Commit" style={{ width: (height * WIDTH) / HEIGHT, height }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} fill="none">
        <Letter strokes={LETTERS[0]} index={0} sway={sway} animated={live} color={ink} />
        <AnimatedPath
          animatedProps={nodeProps}
          d="M78 36A18 18 0 1 1 78 72A18 18 0 1 1 78 36"
          stroke={pop}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray="120 120"
          fill="none"
        />
        {LETTERS.slice(1).map((strokes, i) => (
          <Letter key={strokes[0].base} strokes={strokes} index={i + 2} sway={sway} animated={live} color={ink} />
        ))}
        <AnimatedPath animatedProps={ballProps} d="M282 15h0.01" stroke={pop} strokeLinecap="round" fill="none" />
      </Svg>
    </View>
  );
}
