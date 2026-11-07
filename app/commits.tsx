import { useEffect } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInLeft, useAnimatedProps, useSharedValue, withDelay, withTiming, ZoomIn } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { HashChip } from '@/components/motion/HashChip';
import { PressScale } from '@/components/motion/PressScale';
import { SampleBadge } from '@/components/motion/SampleBadge';
import { Screen } from '@/components/nav/Screen';
import { demoCommits, type DemoCommit } from '@/lib/demoData';
import { useMode } from '@/lib/theme';
import { radius, space, type } from '@/lib/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const ROW = 76;
const STEP_MS = 220;
const X_MAIN = 14;
const X_BRANCH = 40;

const offBranch = (kind: DemoCommit['kind']) => kind === 'team';

function buildPath(commits: DemoCommit[]) {
  const mid = (i: number) => i * ROW + ROW / 2;
  // The main line runs top to bottom, and team commits sit out on a branch that merges back.
  let d = `M${X_MAIN} ${mid(0)}V${mid(commits.length - 1)}`;
  commits.forEach((c, i) => {
    if (!offBranch(c.kind)) return;
    const prevOn = i > 0 && offBranch(commits[i - 1].kind);
    const nextOn = i < commits.length - 1 && offBranch(commits[i + 1].kind);
    if (!prevOn) d += `M${X_MAIN} ${mid(i) - ROW}C${X_MAIN} ${mid(i) - ROW / 2} ${X_BRANCH} ${mid(i) - ROW / 2} ${X_BRANCH} ${mid(i)}`;
    if (nextOn) d += `M${X_BRANCH} ${mid(i)}V${mid(i + 1)}`;
    else d += `M${X_BRANCH} ${mid(i)}C${X_BRANCH} ${mid(i) + ROW / 2} ${X_MAIN} ${mid(i) + ROW / 2} ${X_MAIN} ${mid(i) + ROW}`;
  });
  return d;
}

/** Your history as a real git graph: it draws itself, then each commit pops onto the line. */
export default function CommitsScreen() {
  const { t } = useMode();
  const commits = demoCommits;
  const height = commits.length * ROW;
  const length = height * 2.4;
  const draw = useSharedValue(0);
  useEffect(() => {
    draw.value = withDelay(100, withTiming(1, { duration: commits.length * STEP_MS + 200, easing: Easing.inOut(Easing.quad) }));
  }, [commits.length, draw]);
  const line = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - draw.value) }));

  return (
    <Screen title="Your commits">
      <SampleBadge color={t.bg} background={t.muted} />
      <View style={{ height, marginTop: space.s }}>
        <Svg width={60} height={height} style={StyleSheet.absoluteFill}>
          <AnimatedPath d={buildPath(commits)} stroke={t.primary} strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray={length} animatedProps={line} />
        </Svg>
        {commits.map((c, i) => {
          const x = offBranch(c.kind) ? X_BRANCH : X_MAIN;
          const merge = c.kind === 'merge';
          return (
            <View key={c.hash} style={[styles.row, { top: i * ROW }]}>
              <Animated.View
                entering={ZoomIn.delay(i * STEP_MS + 120).springify().damping(9).stiffness(260)}
                style={[
                  styles.node,
                  { left: x - (merge ? 10 : 7), width: merge ? 20 : 14, height: merge ? 20 : 14, backgroundColor: merge ? t.like : t.primary, borderColor: t.bg },
                ]}
              />
              <Animated.View entering={FadeInLeft.delay(i * STEP_MS + 160).springify().damping(16)} style={styles.text}>
                <Text numberOfLines={1} style={{ color: t.text, fontFamily: t.fontBold, fontSize: type.body }}>{c.message}</Text>
                <View style={styles.meta}>
                  <HashChip hash={c.hash} label="" />
                  <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.micro }}>{c.when}</Text>
                </View>
              </Animated.View>
            </View>
          );
        })}
      </View>
      <PressScale onPress={() => router.push('/verify')} style={[styles.cta, { backgroundColor: t.primary }]}>
        <Text style={{ color: t.onPrimary, fontFamily: t.fontBold, fontSize: type.lead }}>Verify the whole chain</Text>
      </PressScale>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { position: 'absolute', left: 0, right: 0, height: ROW, justifyContent: 'center' },
  node: { position: 'absolute', borderRadius: radius.full, borderWidth: 3 },
  text: { marginLeft: 62, gap: space.xs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  cta: { height: 56, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', marginTop: space.m },
});
