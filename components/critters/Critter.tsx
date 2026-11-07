import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useMotionOff } from '@/lib/prefs';

import { critterFor, type Species } from './identity';
import { SHAPES } from './shapes';

const eye = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;

type Props = {
  /** The person's public key. A username works until keys are wired in. */
  seed: string;
  size?: number;
  /** Bobs and blinks. Leave off in long lists. */
  animated?: boolean;
  /** Draws on a tinted disc, for avatars. */
  disc?: boolean;
  /** Overrides what the seed picked, for the gallery. */
  species?: Species;
  colour?: string;
};

export function Critter({ seed, size = 56, animated = false, disc = true, species, colour }: Props) {
  const motionOff = useMotionOff();
  const id = critterFor(seed);
  const shape = SHAPES[species ?? id.species];
  const fill = colour ?? id.colour;
  const [blink, setBlink] = useState(false);
  const bob = useSharedValue(0);
  const live = animated && !motionOff;

  useEffect(() => {
    if (!live) return;
    bob.value = withDelay(
      seed.length * 40,
      withRepeat(withSequence(withTiming(-size * 0.03, { duration: 1100 }), withTiming(size * 0.03, { duration: 1100 })), -1, true),
    );
    let close: ReturnType<typeof setTimeout>;
    const every = setInterval(() => {
      setBlink(true);
      close = setTimeout(() => setBlink(false), 130);
    }, 2800 + (seed.charCodeAt(0) % 9) * 300);
    return () => {
      clearInterval(every);
      clearTimeout(close);
    };
  }, [bob, live, seed, size]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));

  const rx = 5.5;
  const ry = blink ? 0.9 : 8;
  const eyes = eye(shape.eyes[0], shape.eyeY, rx, ry) + eye(shape.eyes[1], shape.eyeY, rx, ry);
  const nose = shape.nose ? `M${50 - 4.5} ${shape.eyeY + 13}h9l-4.5 5.5Z` : '';
  // The first body path carries the face, so the eyes cut through it.
  const [main, ...rest] = shape.body;

  const art = (
    <Svg width={disc ? size * 0.78 : size} height={disc ? size * 0.78 : size} viewBox="0 0 100 100" fill="none">
      {rest.map((d) => (
        <Path key={d} d={d} fill={fill} />
      ))}
      {shape.limbs?.map((d) => (
        <Path key={d} d={d} stroke={fill} strokeWidth={7.5} strokeLinecap="round" />
      ))}
      <Path d={main + eyes + nose} fill={fill} fillRule="evenodd" clipRule="evenodd" />
    </Svg>
  );

  return (
    <View
      accessibilityLabel={id.name}
      style={
        disc
          ? { width: size, height: size, borderRadius: size / 2, backgroundColor: `${fill}24`, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }
          : undefined
      }>
      <Animated.View style={style}>{art}</Animated.View>
    </View>
  );
}

/** A little hop, for when a creature gets tapped. */
export function useCritterHop() {
  const hop = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: hop.value }] }));
  const fire = () => {
    hop.value = withSequence(withSpring(1.25, { damping: 6, stiffness: 400 }), withSpring(1, { damping: 8 }));
  };
  return { style, fire };
}
