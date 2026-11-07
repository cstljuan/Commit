import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useMode } from '@/lib/theme';

type Props = { label: string; selected: boolean; onPress: () => void };

/** Tappable chip for multi or single choice. Selected state uses colour and a check mark, never colour alone. */
export function Chip({ label, selected, onPress }: Props) {
  const { t } = useMode();
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? t.primary : t.surface,
          borderColor: selected ? t.primary : t.line,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      <Text style={{ color: selected ? t.onPrimary : t.text, fontFamily: t.fontBold, fontSize: 16 }}>
        {selected ? `✓ ${label}` : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center' },
});
