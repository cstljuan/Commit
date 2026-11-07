import * as Haptics from '@/lib/haptics';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInLeft } from 'react-native-reanimated';

import { SampleBadge } from '@/components/motion/SampleBadge';
import { demoAttacks, LAB } from '@/lib/demoData';

const STEP_MS = 170;

/** Replaced by redteam_runs, kind rls, from scripts/redteam/rls.ts. */
export default function RlsScreen() {
  const [shown, setShown] = useState(0);
  const total = demoAttacks.length;

  useEffect(() => {
    if (shown >= total) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    const step = setTimeout(() => {
      setShown((n) => n + 1);
      Haptics.selectionAsync();
    }, STEP_MS);
    return () => clearTimeout(step);
  }, [shown, total]);

  return (
    <ScrollView style={{ backgroundColor: LAB.bg }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Locked doors', headerStyle: { backgroundColor: LAB.bg }, headerTintColor: LAB.text, contentStyle: { backgroundColor: LAB.bg } }} />
      <SampleBadge color={LAB.bg} background={LAB.accent} />
      <View style={styles.big}>
        <Text style={{ color: LAB.ok, fontFamily: LAB.display, fontSize: 96, lineHeight: 104 }}>{shown}</Text>
        <Text style={{ color: LAB.text, fontFamily: LAB.monoBold, fontSize: 22, flex: 1 }}>of {total} attacks denied</Text>
      </View>
      {demoAttacks.slice(0, shown).map((attack) => (
        <Animated.View key={attack} entering={FadeInLeft.springify().damping(16).stiffness(220)} style={[styles.row, { backgroundColor: LAB.card }]}>
          <Text style={{ color: LAB.ok, fontFamily: LAB.monoBold, fontSize: 15 }}>DENIED</Text>
          <Text numberOfLines={1} style={{ color: LAB.text, fontFamily: LAB.mono, fontSize: 13, flex: 1 }}>{attack}</Text>
        </Animated.View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 8, paddingBottom: 40 },
  big: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
});
