import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, type AccessibilityRole, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

type Props = {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
};

const SPRING = { damping: 15, stiffness: 320 };

/** A press that gives back: it squashes, springs and ticks. Use it for anything tappable. */
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
        scale.value = withSpring(0.95, SPRING);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, SPRING);
      }}
      onPress={() => {
        if (haptic) Haptics.selectionAsync();
        onPress?.();
      }}>
      <Animated.View style={[animated, style, disabled && { opacity: 0.4 }]}>{children}</Animated.View>
    </Pressable>
  );
}
