import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useMode } from '@/lib/theme';

const ICONS = {
  pass: 'M6 6l12 12M18 6L6 18',
  undo: 'M9 7L4 12l5 5M4 12h10a5 5 0 0 1 0 10h-2',
  super: 'M12 3l2.8 5.9 6.2.8-4.6 4.3 1.2 6.3L12 17.2 6.4 20.3l1.2-6.3L3 9.7l6.2-.8z',
  like: 'M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z',
};

type ButtonProps = {
  icon: keyof typeof ICONS;
  label: string;
  color: string;
  size: number;
  disabled?: boolean;
  badge?: number;
  filled?: boolean;
  onPress: () => void;
};

function DeckButton({ icon, label, color, size, disabled, badge, filled, onPress }: ButtonProps) {
  const { t } = useMode();
  const [pressed, setPressed] = useState(false);
  const glyph = size * 0.46;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: t.surface,
          shadowColor: color,
          opacity: disabled ? 0.35 : 1,
          transform: [{ scale: pressed ? 0.9 : 1 }],
        },
      ]}>
      <Svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none">
        <Path
          d={ICONS[icon]}
          stroke={color}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={filled ? color : 'none'}
        />
      </Svg>
      {badge !== undefined ? (
        <View style={[styles.badge, { backgroundColor: color }]}>
          <Text style={{ color: t.onPrimary, fontFamily: t.fontBold, fontSize: 11 }}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

type Props = {
  canUndo: boolean;
  superLeft: number;
  disabled: boolean;
  onPass: () => void;
  onUndo: () => void;
  onSuper: () => void;
  onLike: () => void;
};

/** Every gesture on the deck also has a visible button. */
export function DeckButtons({ canUndo, superLeft, disabled, onPass, onUndo, onSuper, onLike }: Props) {
  const { t, copy } = useMode();
  return (
    <View style={styles.row}>
      <DeckButton icon="pass" label={copy.stampLeft} color={t.pass} size={64} disabled={disabled} onPress={onPass} />
      <DeckButton icon="undo" label={copy.undo} color={t.muted} size={48} disabled={!canUndo} onPress={onUndo} />
      <DeckButton
        icon="super"
        label={copy.stampUp}
        color={t.primary}
        size={48}
        disabled={disabled || superLeft === 0}
        badge={superLeft}
        filled
        onPress={onSuper}
      />
      <DeckButton icon="like" label={copy.stampRight} color={t.like} size={64} disabled={disabled} filled onPress={onLike} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
