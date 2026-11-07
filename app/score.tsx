import { StyleSheet, Text, View } from 'react-native';

import { Hachi } from '@/components/Hachi/Hachi';
import { CountUp } from '@/components/motion/CountUp';
import { Reveal } from '@/components/motion/Reveal';
import { SampleBadge } from '@/components/motion/SampleBadge';
import { ScoreRing } from '@/components/motion/ScoreRing';
import { Screen } from '@/components/nav/Screen';
import { demoScoreEvents } from '@/lib/demoData';
import { useMode } from '@/lib/theme';
import { radius, space, type } from '@/lib/tokens';

const RULES = [
  { delta: '+5', text: 'Finish a project you committed to' },
  { delta: '-3', text: 'Leave with notice and a reason' },
  { delta: '-15', text: 'Ghost your team' },
];

export default function ScoreScreen() {
  const { t } = useMode();
  const total = demoScoreEvents.reduce((a, e) => a + e.delta, 0);
  return (
    <Screen title="Shows up score">
      <SampleBadge color={t.bg} background={t.muted} />
      <Reveal style={[styles.hero, { backgroundColor: t.surface }]}>
        <ScoreRing score={total} size={168} />
        <Hachi size={72} state="happy" animated interactive sleepAfter={0} />
      </Reveal>
      <Reveal index={1} style={[styles.card, { backgroundColor: t.surface }]}>
        <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: type.lead }}>How you got here</Text>
        {demoScoreEvents.map((e, i) => (
          <View key={e.label} style={styles.line}>
            <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.small, flex: 1 }}>{e.label}</Text>
            {i > 0 ? (
              <Text style={{ color: e.delta < 0 ? t.muted : t.like, fontFamily: 'JetBrainsMono_700Bold', fontSize: type.body }}>{e.delta < 0 ? '-' : '+'}</Text>
            ) : null}
            <CountUp
              to={Math.abs(e.delta)}
              delayMs={300 + i * 140}
              durationMs={500}
              style={{ color: e.delta < 0 ? t.muted : t.like, fontFamily: 'JetBrainsMono_700Bold', fontSize: type.body, textAlign: 'right' }}
            />
          </View>
        ))}
      </Reveal>
      <Reveal index={2} style={styles.rules}>
        {RULES.map((r) => (
          <View key={r.text} style={[styles.rule, { backgroundColor: `${t.primary}12` }]}>
            <Text style={{ color: t.primary, fontFamily: 'JetBrainsMono_700Bold', fontSize: type.lead, width: 52 }}>{r.delta}</Text>
            <Text style={{ color: t.text, fontFamily: t.fontBody, fontSize: type.body, flex: 1 }}>{r.text}</Text>
          </View>
        ))}
      </Reveal>
      <Reveal index={3}>
        <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.small, lineHeight: 20 }}>
          Everyone starts at 70, so beginners are not punished, and scores recover over time.
        </Text>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', padding: space.xl, borderRadius: radius.hero, marginTop: space.s },
  card: { padding: space.l, borderRadius: radius.card, gap: space.s },
  line: { flexDirection: 'row', alignItems: 'center' },
  rules: { gap: space.s },
  rule: { flexDirection: 'row', alignItems: 'center', padding: space.m, borderRadius: radius.control },
});
