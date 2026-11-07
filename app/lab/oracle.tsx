import * as Haptics from 'expo-haptics';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { CountUp } from '@/components/motion/CountUp';
import { PressScale } from '@/components/motion/PressScale';
import { SampleBadge } from '@/components/motion/SampleBadge';
import { demoOracle, LAB } from '@/lib/demoData';

/** Replaced by a Realtime subscription to redteam_runs, kind oracle. */
export default function OracleScreen() {
  const [run, setRun] = useState(0);
  const [v1Done, setV1Done] = useState(false);
  return (
    <ScrollView style={{ backgroundColor: LAB.bg }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Oracle attack', headerStyle: { backgroundColor: LAB.bg }, headerTintColor: LAB.text, contentStyle: { backgroundColor: LAB.bg } }} />
      <SampleBadge color={LAB.bg} background={LAB.accent} />
      <Text style={{ color: LAB.muted, fontFamily: LAB.mono, fontSize: 15, lineHeight: 22 }}>
        An attacker posts {demoOracle.attempts} guesses and watches what copy detection tells them.
      </Text>
      <View key={run} style={styles.stack}>
        <View style={[styles.panel, { borderColor: LAB.bad }]}>
          <Text style={{ color: LAB.bad, fontFamily: LAB.monoBold, fontSize: 18 }}>v1, vulnerable</Text>
          <CountUp
            to={demoOracle.v1Revealed}
            durationMs={1200}
            onDone={() => {
              setV1Done(true);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }}
            style={{ color: LAB.bad, fontFamily: LAB.display, fontSize: 112, lineHeight: 120 }}
          />
          <Text style={{ color: LAB.text, fontFamily: LAB.monoBold, fontSize: 20 }}>private ideas revealed</Text>
        </View>
        {v1Done ? (
          <Animated.View entering={FadeInDown.springify().damping(14)} style={[styles.panel, { borderColor: LAB.ok }]}>
            <Text style={{ color: LAB.ok, fontFamily: LAB.monoBold, fontSize: 18 }}>v2, fixed</Text>
            <Text style={{ color: LAB.ok, fontFamily: LAB.display, fontSize: 112, lineHeight: 120 }}>{demoOracle.v2Revealed}</Text>
            <Text style={{ color: LAB.text, fontFamily: LAB.monoBold, fontSize: 20 }}>revealed</Text>
            <Animated.Text entering={FadeIn.delay(350)} style={{ color: LAB.muted, fontFamily: LAB.mono, fontSize: 14 }}>
              {demoOracle.v2RateLimited} of {demoOracle.attempts} rate limited. Only the owner gets the alert.
            </Animated.Text>
          </Animated.View>
        ) : null}
      </View>
      <PressScale
        onPress={() => {
          setV1Done(false);
          setRun((n) => n + 1);
        }}
        style={[styles.again, { borderColor: LAB.primary }]}>
        <Text style={{ color: LAB.primary, fontFamily: LAB.monoBold, fontSize: 15 }}>Run again</Text>
      </PressScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  stack: { gap: 14 },
  panel: { padding: 18, borderRadius: 22, borderWidth: 2, backgroundColor: LAB.card, gap: 2 },
  again: { alignSelf: 'flex-start', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, borderWidth: 2 },
});
