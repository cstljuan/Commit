import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Critter, useCritterHop } from '@/components/critters/Critter';
import { critterFor } from '@/components/critters/identity';
import { HashChip } from '@/components/motion/HashChip';
import { PressScale } from '@/components/motion/PressScale';
import { Reveal } from '@/components/motion/Reveal';
import { ScoreRing } from '@/components/motion/ScoreRing';
import { Screen } from '@/components/nav/Screen';
import * as Haptics from '@/lib/haptics';
import { demoPeople } from '@/lib/demoData';
import { useMode } from '@/lib/theme';
import { radius, space, type } from '@/lib/tokens';

const FALLBACK = { role: 'Builder', level: 'intermediate', occupation: 'student', score: 70, skills: [], prompts: [] };

export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useMode();
  const username = id ?? 'builder';
  const person = demoPeople[username] ?? FALLBACK;
  const creature = critterFor(username);
  const { style, fire } = useCritterHop();
  return (
    <Screen title={`@${username}`}>
      <Reveal>
        <PressScale
          accessibilityLabel={creature.name}
          haptic={false}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            fire();
          }}
          style={[styles.hero, { backgroundColor: `${creature.color}24` }]}>
          <Animated.View style={style}>
            <Critter seed={username} size={160} animated disc={false} />
          </Animated.View>
          <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: type.lead }}>{creature.name}</Text>
          <HashChip hash={creature.fingerprint} label="key" center />
        </PressScale>
      </Reveal>

      <Reveal index={1} style={[styles.score, { backgroundColor: t.surface }]}>
        <ScoreRing score={person.score} size={96} />
        <View style={styles.text}>
          <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: type.lead }}>
            {person.role}, {person.level}
          </Text>
          <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.small }}>
            {person.occupation === 'student' ? 'Student' : 'Working'}. Shows up score out of 100.
          </Text>
        </View>
      </Reveal>

      {person.skills.length ? (
        <Reveal index={2} style={styles.chips}>
          {person.skills.map((s) => (
            <View key={s} style={[styles.chip, { backgroundColor: `${t.primary}1A` }]}>
              <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: type.small }}>{s}</Text>
            </View>
          ))}
        </Reveal>
      ) : null}

      {person.prompts.map((p, i) => (
        <Reveal key={p.q} index={3 + i} style={[styles.prompt, { backgroundColor: t.surface }]}>
          <Text style={{ color: t.muted, fontFamily: t.fontBold, fontSize: type.small }}>{p.q}</Text>
          <Text style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: type.title }}>{p.a}</Text>
        </Reveal>
      ))}

      <Reveal index={6}>
        <PressScale onPress={() => router.push('/chat/m1')} style={[styles.cta, { backgroundColor: t.primary }]}>
          <Text style={{ color: t.onPrimary, fontFamily: t.fontBold, fontSize: type.lead }}>Say hi</Text>
        </PressScale>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.s, padding: space.xl, borderRadius: radius.hero, marginTop: space.s },
  score: { flexDirection: 'row', alignItems: 'center', gap: space.l, padding: space.l, borderRadius: radius.card },
  text: { flex: 1, gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  chip: { paddingVertical: space.s, paddingHorizontal: space.m, borderRadius: radius.full },
  prompt: { padding: space.l, borderRadius: radius.card, gap: space.xs },
  cta: { height: 56, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
});
