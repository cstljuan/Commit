import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useMode } from '@/lib/theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
};

/** The one button. Primary for the main action, outline for alternatives, ghost for small links. */
export function Button({ label, onPress, variant = 'primary', disabled, loading, icon, style, testID }: Props) {
  const { t } = useMode();
  // NativeWind drops function-style Pressable styles, so track pressed state ourselves.
  const [pressed, setPressed] = useState(false);
  const inactive = disabled || loading;
  const bg = variant === 'primary' ? t.primary : variant === 'outline' ? t.surface : 'transparent';
  const fg = variant === 'primary' ? t.onPrimary : variant === 'outline' ? t.text : t.primary;
  const border = variant === 'outline' ? t.line : 'transparent';

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={variant === 'ghost' ? 8 : 0}
      style={[
        styles.base,
        variant === 'ghost' ? styles.ghost : styles.solid,
        { backgroundColor: bg, borderColor: border, opacity: inactive ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text style={{ color: fg, fontFamily: t.fontBold, fontSize: variant === 'ghost' ? 15 : 17 }}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1.5 },
  solid: { minHeight: 54, paddingHorizontal: 20 },
  ghost: { minHeight: 44, paddingHorizontal: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
