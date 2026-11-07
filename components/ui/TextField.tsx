import { forwardRef, useState, type ComponentRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useMode } from '@/lib/theme';

type Props = TextInputProps & { label: string; error?: string | null; hint?: string };

/** Labelled text input with an inline error. Calm on purpose: forms are not where the fun lives. */
export const TextField = forwardRef<ComponentRef<typeof TextInput>, Props>(function TextField({ label, error, hint, style, ...rest }, ref) {
  const { t } = useMode();
  const [focused, setFocused] = useState(false);
  const border = error ? t.pass : focused ? t.primary : t.line;

  return (
    <View style={styles.wrap}>
      <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: 15 }}>{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={t.muted}
        accessibilityLabel={label}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[
          styles.input,
          { color: t.text, backgroundColor: t.surface, borderColor: border, fontFamily: t.fontBody },
          style,
        ]}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={{ color: t.pass, fontFamily: t.fontBold, fontSize: 14 }}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 14 }}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  input: { minHeight: 54, borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 16, fontSize: 17 },
});
