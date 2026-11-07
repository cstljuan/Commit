import { useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useMode } from '@/lib/theme';

type Props = {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  error?: boolean;
  disabled?: boolean;
};

/**
 * Six boxes backed by one hidden input, so paste and iOS "From Messages" autofill both work.
 * Tapping any box focuses the input.
 */
export function CodeInput({ value, onChange, length = 6, error, disabled }: Props) {
  const { t } = useMode();
  const ref = useRef<ComponentRef<typeof TextInput>>(null);

  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityLabel={`${length}-digit code`}>
      <View style={styles.row}>
        {Array.from({ length }, (_, i) => {
          const char = value[i] ?? '';
          const active = i === Math.min(value.length, length - 1) && !disabled;
          const border = error ? t.pass : active ? t.primary : t.line;
          return (
            <View key={i} style={[styles.box, { backgroundColor: t.surface, borderColor: border }]}>
              <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: 26 }}>{char}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        autoFocus
        editable={!disabled}
        caretHidden
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: { flex: 1, aspectRatio: 0.82, maxWidth: 56, borderWidth: 1.5, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
