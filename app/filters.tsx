import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressScale } from '@/components/motion/PressScale';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/nav/Screen';
import { getDeckFilters, setDeckFilters, type DeckFilters, type FilterGroup } from '@/lib/filters';
import { useMode } from '@/lib/theme';
import { radius, space, type } from '@/lib/tokens';

const GROUPS: Record<FilterGroup, string[]> = {
  Role: ['Frontend', 'Backend', 'AI/ML', 'Security', 'Mobile', 'Design', 'PM', 'Hardware'],
  Level: ['Beginner', 'Intermediate', 'Advanced'],
  Theme: ['AI', 'Education', 'Health', 'Climate', 'Fintech', 'Games', 'Security', 'Social good', 'Social', 'Food', 'Campus'],
  Timeframe: ['Weekend', '1 month', 'Semester', 'Ongoing'],
};

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { t } = useMode();
  return (
    <PressScale accessibilityRole="checkbox" accessibilityLabel={label} onPress={onPress}>
      <View style={[styles.chip, { backgroundColor: on ? t.primary : t.surface }]}>
        <Text style={{ color: on ? t.onPrimary : t.text, fontFamily: t.fontBold, fontSize: type.small }}>{label}</Text>
      </View>
    </PressScale>
  );
}

/** Narrows the deck, on the phone for now, until getDeck takes filters. */
export default function FiltersScreen() {
  const { t } = useMode();
  const [on, setOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(Object.entries(getDeckFilters()).flatMap(([g, list]) => (list ?? []).map((item) => [`${g}:${item}`, true]))),
  );
  const count = Object.values(on).filter(Boolean).length;
  const apply = () => {
    const next: DeckFilters = {};
    for (const [key, active] of Object.entries(on)) {
      if (!active) continue;
      const [group, item] = key.split(':') as [FilterGroup, string];
      (next[group] ??= []).push(item);
    }
    setDeckFilters(next);
    router.back();
  };
  return (
    <Screen title="Filters">
      {Object.entries(GROUPS).map(([group, items], i) => (
        <Reveal key={group} index={i} style={styles.group}>
          <Text style={{ color: t.muted, fontFamily: t.fontBold, fontSize: type.small }}>{group}</Text>
          <View style={styles.chips}>
            {items.map((item) => (
              <Chip key={item} label={item} on={!!on[`${group}:${item}`]} onPress={() => setOn((o) => ({ ...o, [`${group}:${item}`]: !o[`${group}:${item}`] }))} />
            ))}
          </View>
        </Reveal>
      ))}
      <Reveal index={4} style={styles.actions}>
        <PressScale disabled={!count} onPress={() => setOn({})} style={[styles.clear, { backgroundColor: t.surface }]}>
          <Text style={{ color: t.primary, fontFamily: t.fontBold, fontSize: type.body }}>Clear</Text>
        </PressScale>
        <View style={styles.applyWrap}>
          <PressScale onPress={apply} style={[styles.apply, { backgroundColor: t.primary }]}>
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
  clear: { height: 56, paddingHorizontal: space.xl, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  applyWrap: { flex: 1 },
  apply: { height: 56, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
});
