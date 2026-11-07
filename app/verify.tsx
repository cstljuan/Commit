import * as Haptics from '@/lib/haptics';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { PressScale } from '@/components/motion/PressScale';
import { SampleBadge } from '@/components/motion/SampleBadge';
import { Hachi } from '@/components/Hachi/Hachi';
import { demoChainBroken, demoChainGood, LAB, type ChainRow } from '@/lib/demoData';

const STEP_MS = 340;

function Link({ row, last }: { row: ChainRow; last: boolean }) {
  const shake = useSharedValue(0);
  useEffect(() => {
    if (row.ok) return;
    shake.value = withSequence(withTiming(-8, { duration: 45 }), withRepeat(withTiming(8, { duration: 70 }), 5, true), withTiming(0, { duration: 45 }));
  }, [row.ok, shake]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const color = row.ok ? LAB.ok : LAB.bad;
  return (
    <Animated.View entering={FadeInDown.springify().damping(15).stiffness(190)}>
      <Animated.View style={[styles.link, { borderColor: color, backgroundColor: LAB.card }, style]}>
        <Text style={{ color, fontFamily: LAB.monoBold, fontSize: 20 }}>{row.ok ? '✓︎' : '✕︎'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: LAB.text, fontFamily: LAB.monoBold, fontSize: 18 }}>
            #{row.seq} {row.hash}
          </Text>
          {row.reason ? <Text style={{ color: LAB.bad, fontFamily: LAB.mono, fontSize: 15 }}>{row.reason}</Text> : null}
        </View>
      </Animated.View>
      {last ? null : <View style={[styles.connector, { backgroundColor: color }]} />}
    </Animated.View>
  );
}

/** Walks the chain link by link. Stops at the first broken link, as the real check does. */
export default function VerifyScreen() {
  // Replaced by verifyChain() from lib/vault.ts. The toggle stands in for a real dashboard edit.
  const [tampered, setTampered] = useState(false);
  const [shown, setShown] = useState(0);
  const chain = tampered ? demoChainBroken : demoChainGood;
  const firstBad = chain.findIndex((r) => !r.ok);
  const end = firstBad === -1 ? chain.length : firstBad + 1;
  const running = shown < end;
  const broken = !running && firstBad !== -1;

  // One link at a time. Setting shown back to 0 restarts the walk.
  useEffect(() => {
    if (shown >= end) {
      Haptics.notificationAsync(firstBad === -1 ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (shown > 0) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const step = setTimeout(() => setShown((n) => n + 1), STEP_MS);
    return () => clearTimeout(step);
  }, [end, firstBad, shown]);

  const verdict = running ? 'Verifying...' : broken ? 'CHAIN BROKEN' : 'CHAIN VERIFIED';
  const verdictColor = running ? LAB.muted : broken ? LAB.bad : LAB.ok;

  return (
    <ScrollView style={{ backgroundColor: LAB.bg }} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: 'Verify',
          headerStyle: { backgroundColor: LAB.bg },
          headerTintColor: LAB.text,
          contentStyle: { backgroundColor: LAB.bg },
        }}
      />
      <SampleBadge color={LAB.bg} background={LAB.accent} />
      <View style={styles.head}>
        <Hachi size={84} state={broken ? 'broken' : running ? 'inspect' : 'verified'} color={LAB.primary} animated interactive />
        <Text style={{ color: verdictColor, fontFamily: LAB.display, fontSize: 34, flex: 1 }}>{verdict}</Text>
      </View>
      <View>
        {chain.slice(0, Math.min(shown, end)).map((row, i, list) => (
          <Link key={`${tampered}${row.seq}`} row={row} last={i === list.length - 1} />
        ))}
      </View>
      {!running ? (
        <Animated.View entering={FadeInDown.delay(150)} style={styles.actions}>
          <PressScale onPress={() => {
              setShown(0);
              setTampered((v) => !v);
            }} style={[styles.action, { borderColor: tampered ? LAB.ok : LAB.bad }]}>
            <Text style={{ color: tampered ? LAB.ok : LAB.bad, fontFamily: LAB.monoBold, fontSize: 15 }}>
              {tampered ? 'Undo the edit' : 'Simulate an edit'}
            </Text>
          </PressScale>
          <PressScale onPress={() => setShown(0)} style={[styles.action, { borderColor: LAB.primary }]}>
            <Text style={{ color: LAB.primary, fontFamily: LAB.monoBold, fontSize: 15 }}>Run again</Text>
          </PressScale>
        </Animated.View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, borderWidth: 2 },
  connector: { width: 4, height: 18, marginLeft: 30 },
  actions: { flexDirection: 'row', gap: 10 },
  action: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, borderWidth: 2 },
});
