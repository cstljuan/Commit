import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { useMode } from '@/lib/theme';

import type { ProjectCard, Role } from './cardTypes';

type Props = {
  card: ProjectCard;
  onPick: (role: Role) => void;
  onCancel: () => void;
};

/** One tap picks a role. No confirm button. Tapping outside brings the card back. */
export function RolePickerSheet({ card, onPick, onCancel }: Props) {
  const { t } = useMode();
  const open = card.roles.filter((r) => r.open > 0);
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)} style={StyleSheet.absoluteFill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel and bring the card back"
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onCancel}
        />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.duration(220)}
        exiting={SlideOutDown.duration(160)}
        style={[styles.sheet, { backgroundColor: t.surface }]}>
        <Text style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: 26 }}>Which role?</Text>
        <Text numberOfLines={1} style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 15 }}>
          {card.title}
        </Text>
        {open.map((r) => (
          <Pressable
            key={r.role}
            accessibilityRole="button"
            onPress={() => onPick(r.role)}
            style={[styles.option, { backgroundColor: t.primary + '1A' }]}>
            <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: 17 }}>{r.role}</Text>
            <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 14 }}>{r.open} open</Text>
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: '#00000059' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 24,
    gap: 10,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
  },
});
