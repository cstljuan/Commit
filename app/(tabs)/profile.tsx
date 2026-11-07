import { Link, router } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { CountUp } from '@/components/motion/CountUp';
import { PressScale } from '@/components/motion/PressScale';
import { Reveal } from '@/components/motion/Reveal';
import { useMode } from '@/lib/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SIZE = 132;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const LENGTH = 2 * Math.PI * RADIUS;

function ScoreRing({ score }: { score: number }) {
  const { t } = useMode();
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withDelay(200, withTiming(score / 100, { duration: 1000, easing: Easing.out(Easing.cubic) }));
  }, [fill, score]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: LENGTH * (1 - fill.value) }));
  return (
    <View accessibilityLabel={`Shows up score ${score} out of 100`} style={styles.ring}>
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={t.primary + '26'} strokeWidth={STROKE} fill="none" />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={t.like}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={LENGTH}
          animatedProps={props}
          rotation={-90}
          originX={SIZE / 2}
          originY={SIZE / 2}
        />
      </Svg>
      <CountUp to={score} delayMs={200} durationMs={1000} style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: 40 }} />
    </View>
  );
}

const SKILLS = ['TypeScript', 'React Native', 'Figma', 'Supabase'];

export default function ProfileScreen() {
  const { t } = useMode();
  const { top } = useSafeAreaInsets();
  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={[styles.content, { paddingTop: top + 12 }]}>
      <Reveal style={styles.head}>
        <View style={[styles.avatar, { backgroundColor: t.primary }]}>
          <Text style={{ color: t.onPrimary, fontFamily: t.fontDisplay, fontSize: 36 }}>Y</Text>
        </View>
        <View style={styles.headText}>
          <Text style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: 28 }}>@you</Text>
          <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 15 }}>Frontend, intermediate, student</Text>
        </View>
      </Reveal>

      <Reveal index={1} style={[styles.card, styles.scoreCard, { backgroundColor: t.surface }]}>
        <ScoreRing score={70} />
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
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  card: { padding: 18, borderRadius: 24, gap: 10 },
  scoreCard: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ring: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999 },
  proof: { padding: 18, borderRadius: 24, gap: 4 },
});
