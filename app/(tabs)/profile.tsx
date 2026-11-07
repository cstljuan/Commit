import { Link, router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Critter } from '@/components/critters/Critter';
import { critterFor } from '@/components/critters/identity';
import { PressScale } from '@/components/motion/PressScale';
import { Reveal } from '@/components/motion/Reveal';
import { ScoreRing } from '@/components/motion/ScoreRing';
import { useTabInset } from '@/components/nav/TabBar';
import { useMode } from '@/lib/theme';

const SKILLS = ['TypeScript', 'React Native', 'Figma', 'Supabase'];

export default function ProfileScreen() {
  const { t } = useMode();
  const { top } = useSafeAreaInsets();
  const inset = useTabInset();
  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={[styles.content, { paddingTop: top + 12, paddingBottom: inset }]}>
      <Reveal style={styles.head}>
        <PressScale accessibilityLabel="Your creature" onPress={() => router.push('/creatures')}>
          <Critter seed="you" size={84} animated />
        </PressScale>
        <View style={styles.headText}>
          <Text style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: 28 }}>@you</Text>
          <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 15 }}>{critterFor('you').name}. Frontend, student.</Text>
        </View>
        <PressScale accessibilityLabel="Settings" onPress={() => router.push('/settings')} style={styles.gear}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" stroke={t.text} strokeWidth={2.2} strokeLinecap="round" />
          </Svg>
        </PressScale>
      </Reveal>

      <Reveal index={1} style={[styles.card, styles.scoreCard, { backgroundColor: t.surface }]}>
        <PressScale accessibilityLabel="How your score works" onPress={() => router.push('/score')}>
          <ScoreRing score={70} />
        </PressScale>
        <View style={styles.headText}>
          <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: 18 }}>Shows up score</Text>
          <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 14, lineHeight: 20 }}>
            Everyone starts at 70. Finishing projects raises it, ghosting lowers it, and it recovers.
          </Text>
        </View>
      </Reveal>

      <Reveal index={2} style={[styles.card, { backgroundColor: t.surface }]}>
        <Text style={{ color: t.muted, fontFamily: t.fontBold, fontSize: 13 }}>Skills</Text>
        <View style={styles.chips}>
          {SKILLS.map((s) => (
            <View key={s} style={[styles.chip, { backgroundColor: t.primary + '1A' }]}>
              <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: 14 }}>{s}</Text>
            </View>
          ))}
        </View>
      </Reveal>

      <Reveal index={3} style={[styles.card, { backgroundColor: t.surface }]}>
        <Text style={{ color: t.muted, fontFamily: t.fontBold, fontSize: 13 }}>My 3 AM snack</Text>
        <Text style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: 24 }}>Whatever the vending machine gives me</Text>
      </Reveal>

      <Reveal index={4}>
        <PressScale onPress={() => router.push('/commits')} style={[styles.card, { backgroundColor: t.surface }]}>
          <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: 18 }}>Your commits</Text>
          <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 14 }}>Everything you have signed, as a git graph</Text>
        </PressScale>
      </Reveal>

      <Reveal index={5}>
        <PressScale onPress={() => router.push('/lab')} style={[styles.proof, { backgroundColor: '#0F0F14' }]}>
          <Text style={{ color: '#22D3EE', fontFamily: 'JetBrainsMono_700Bold', fontSize: 17 }}>$ proof --live</Text>
          <Text style={{ color: '#9CA3AF', fontFamily: t.fontBody, fontSize: 14 }}>Watch us try to break our own security</Text>
        </PressScale>
      </Reveal>

      <Link href="/dev-test" style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 13, alignSelf: 'center' }}>
        Run first test
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 4 },
  headText: { flex: 1, gap: 4 },
  gear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { padding: 18, borderRadius: 24, gap: 10 },
  scoreCard: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999 },
  proof: { padding: 18, borderRadius: 24, gap: 4 },
});
