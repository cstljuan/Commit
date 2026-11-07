import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

const STEP_MS = 55;

/** Staggered entrance. Pass the item's position in the list. Reduce Motion is respected. */
export function Reveal({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View
      style={style}
      entering={FadeInDown.delay(Math.min(index, 10) * STEP_MS).springify().damping(16).stiffness(170)}>
      {children}
    </Animated.View>
  );
}
