import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { DecodeText } from '@/components/motion/DecodeText';
import { HashChip } from '@/components/motion/HashChip';
import { PressScale } from '@/components/motion/PressScale';
import { Reveal } from '@/components/motion/Reveal';
import { SampleBadge } from '@/components/motion/SampleBadge';
import { ScoreRing } from '@/components/motion/ScoreRing';
import { Screen } from '@/components/nav/Screen';
import { Tako } from '@/components/Tako/Tako';
import { demoAlert } from '@/lib/demoData';
import { useMode } from '@/lib/theme';
import { radius, space, type } from '@/lib/tokens';

/** What a copy alert means, and the proof you were first. Only the owner ever sees this. */
export default function AlertScreen() {
  const { t } = useMode();
  return (
    <Screen title="Someone reworded your idea">
      <SampleBadge color={t.bg} background={t.muted} />
      <Reveal style={[styles.head, { backgroundColor: `${t.pass}1F` }]}>
        <Tako size={72} state="alert" animated />
        <View style={styles.text}>
          <DecodeText text="Only you can see this." durationMs={500} style={{ color: t.text, fontFamily: t.fontBold, fontSize: type.lead }} />
          <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.small, lineHeight: 20 }}>
            The other person was told nothing. Their post just says submitted.
          </Text>
        </View>
      </Reveal>

      <Reveal index={1} style={[styles.card, { backgroundColor: t.surface }]}>
        <ScoreRing score={demoAlert.similarity} size={104} label="Similarity" color={t.pass} />
        <View style={styles.text}>
          <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: type.lead }}>Similar in meaning</Text>
          <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.small, lineHeight: 20 }}>
            Compared by meaning, not by matching words, so rewording does not hide it.
          </Text>
        </View>
      </Reveal>

      <Reveal index={2} style={[styles.timeline, { backgroundColor: t.surface }]}>
        <View style={styles.event}>
          <View style={[styles.dot, { backgroundColor: t.like }]} />
          <View style={styles.text}>
            <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: type.body }}>You posted first</Text>
            <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.small }}>{demoAlert.yours}</Text>
            <HashChip hash={demoAlert.hash} />
          </View>
        </View>
        <View style={[styles.stem, { backgroundColor: t.muted }]} />
        <View style={styles.event}>
          <View style={[styles.dot, { backgroundColor: t.pass }]} />
          <View style={styles.text}>
            <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: type.body }}>Reworded version posted</Text>
            <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.small }}>{demoAlert.theirs}</Text>
          </View>
        </View>
      </Reveal>

      <Reveal index={3}>
        <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.small, lineHeight: 20 }}>
          This is a tamper-evident record of who was first, not legal protection.
        </Text>
      </Reveal>

      <Reveal index={4}>
        <PressScale onPress={() => router.push('/verify')} style={[styles.cta, { backgroundColor: t.primary }]}>
          <Text style={{ color: t.onPrimary, fontFamily: t.fontBold, fontSize: type.lead }}>Check the proof yourself</Text>
        </PressScale>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.l, padding: space.l, borderRadius: radius.card },
  text: { flex: 1, gap: space.xs },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.l, padding: space.l, borderRadius: radius.card },
  timeline: { padding: space.l, borderRadius: radius.card },
  event: { flexDirection: 'row', gap: space.m },
  dot: { width: 14, height: 14, borderRadius: 7, marginTop: 4 },
  stem: { width: 2, height: 24, marginLeft: 6, marginVertical: space.xs, opacity: 0.4 },
  cta: { height: 56, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
});
