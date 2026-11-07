import * as Haptics from '@/lib/haptics';
import type { ReactNode } from 'react';
import { Pressable, type AccessibilityRole, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

type Props = {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
};

const QUICK = { duration: 120 };

/** A press that gives back: it dips and ticks. Use it for anything tappable. */
export function PressScale({ onPress, children, style, disabled, haptic = true, accessibilityLabel, accessibilityRole = 'button' }: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPressIn={() => {
        scale.value = withTiming(0.95, QUICK);
      }}
      onPressOut={() => {
        scale.value = withTiming(1, QUICK);
      }}
      onPress={() => {
        if (haptic) Haptics.selectionAsync();
        onPress?.();
      }}>
      <Animated.View style={[animated, style, disabled && { opacity: 0.4 }]}>{children}</Animated.View>
    </Pressable>
  );
}
