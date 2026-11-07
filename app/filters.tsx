import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, withSpring } from 'react-native-reanimated';

import { PressScale } from '@/components/motion/PressScale';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/nav/Screen';
import { useMode } from '@/lib/theme';
import { radius, space, type } from '@/lib/tokens';

const GROUPS = {
  Role: ['Frontend', 'Backend', 'AI/ML', 'Security', 'Mobile', 'Design', 'PM', 'Hardware'],
  Level: ['Beginner', 'Intermediate', 'Advanced'],
  Theme: ['Education', 'Finance', 'Health', 'Community', 'Safety', 'Games'],
  Timeframe: ['Weekend', '1 month', 'Semester', 'Ongoing'],
};

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { t } = useMode();
  const k = useDerivedValue(() => withSpring(on ? 1 : 0, { damping: 12, stiffness: 300 }));
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: 1 + k.value * 0.05 }] }));
  return (
    <PressScale accessibilityRole="checkbox" accessibilityLabel={label} onPress={onPress}>
      <Animated.View style={[styles.chip, { backgroundColor: on ? t.primary : `${t.primary}14` }, pop]}>
        <Text style={{ color: on ? t.onPrimary : t.text, fontFamily: t.fontBold, fontSize: type.small }}>{label}</Text>
      </Animated.View>
    </PressScale>
  );
}

/** Narrow the deck. Selections stay local until getDeck takes filters. */
export default function FiltersScreen() {
  const { t } = useMode();
  const [on, setOn] = useState<Record<string, boolean>>({});
  const count = Object.values(on).filter(Boolean).length;
  return (
    <Screen title="Filters">
      {Object.entries(GROUPS).map(([group, items], i) => (
        <Reveal key={group} index={i} style={styles.group}>
          <Text style={{ color: t.muted, fontFamily: t.fontBold, fontSize: type.small }}>{group}</Text>
          <View style={styles.chips}>
            {items.map((item) => (
              <Chip key={item} label={item} on={!!on[item]} onPress={() => setOn((o) => ({ ...o, [item]: !o[item] }))} />
            ))}
          </View>
        </Reveal>
      ))}
      <Reveal index={4} style={styles.actions}>
        <PressScale disabled={!count} onPress={() => setOn({})} style={[styles.clear, { borderColor: t.primary }]}>
          <Text style={{ color: t.primary, fontFamily: t.fontBold, fontSize: type.body }}>Clear</Text>
        </PressScale>
        <View style={styles.applyWrap}>
          <PressScale onPress={() => router.back()} style={[styles.apply, { backgroundColor: t.primary }]}>
            <Text style={{ color: t.onPrimary, fontFamily: t.fontBold, fontSize: type.lead }}>{count ? `Apply ${count}` : 'Show everyone'}</Text>
          </PressScale>
        </View>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.s, marginTop: space.m },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  chip: { paddingVertical: space.s + 2, paddingHorizontal: space.m + 2, borderRadius: radius.full },
  actions: { flexDirection: 'row', gap: space.m, marginTop: space.xl, alignItems: 'center' },
  clear: { height: 56, paddingHorizontal: space.xl, borderRadius: radius.control, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  applyWrap: { flex: 1 },
  apply: { height: 56, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
});
