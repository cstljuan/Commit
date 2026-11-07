import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';

import { CountUp } from '@/components/motion/CountUp';
import { SampleBadge } from '@/components/motion/SampleBadge';
import { demoEval, LAB } from '@/lib/demoData';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const HEIGHT = 240;
const PAD = 26;
const DASH = 1400;

function Curve({ d, color, delay }: { d: string; color: string; delay: number }) {
  const draw = useSharedValue(0);
  useEffect(() => {
    draw.value = withDelay(delay, withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.cubic) }));
  }, [delay, draw]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: DASH * (1 - draw.value) }));
  return <AnimatedPath d={d} stroke={color} strokeWidth={4} fill="none" strokeLinecap="round" strokeDasharray={DASH} animatedProps={props} />;
}

/** Replaced by eval_results from scripts/eval/run.ts. */
export default function ReportScreen() {
  const { width } = useWindowDimensions();
  const W = width - 40;
  const pts = demoEval.points;
  const min = pts[0].threshold;
  const max = pts[pts.length - 1].threshold;
  const px = (th: number) => PAD + ((th - min) / (max - min)) * (W - PAD * 2);
  const py = (v: number) => HEIGHT - PAD - ((v - 0.3) / 0.7) * (HEIGHT - PAD * 2);
  const path = (key: 'precision' | 'recall') =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${px(p.threshold).toFixed(1)} ${py(p[key]).toFixed(1)}`).join(' ');
  const chosen = pts.find((p) => p.threshold === demoEval.chosen) ?? pts[0];

  return (
    <ScrollView style={{ backgroundColor: LAB.bg }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Report card', headerStyle: { backgroundColor: LAB.bg }, headerTintColor: LAB.text, contentStyle: { backgroundColor: LAB.bg } }} />
      <SampleBadge color={LAB.bg} background={LAB.accent} />
      <View style={styles.numbers}>
        <View style={styles.number}>
          <CountUp to={chosen.precision * 100} suffix="%" style={{ color: LAB.primary, fontFamily: LAB.display, fontSize: 60 }} />
          <Text style={{ color: LAB.text, fontFamily: LAB.mono, fontSize: 14 }}>precision</Text>
        </View>
        <View style={styles.number}>
          <CountUp to={chosen.recall * 100} suffix="%" delayMs={150} style={{ color: LAB.accent, fontFamily: LAB.display, fontSize: 60 }} />
          <Text style={{ color: LAB.text, fontFamily: LAB.mono, fontSize: 14 }}>recall</Text>
        </View>
      </View>
      <View style={[styles.chart, { backgroundColor: LAB.card }]}>
        <Svg width={W} height={HEIGHT}>
          <Line x1={PAD} x2={W - PAD} y1={HEIGHT - PAD} y2={HEIGHT - PAD} stroke={LAB.line} strokeWidth={2} />
          <Line x1={px(demoEval.chosen)} x2={px(demoEval.chosen)} y1={PAD - 8} y2={HEIGHT - PAD} stroke={LAB.text} strokeWidth={2} strokeDasharray="5 6" />
          <Curve d={path('precision')} color={LAB.primary} delay={100} />
          <Curve d={path('recall')} color={LAB.accent} delay={300} />
          <SvgText x={PAD} y={HEIGHT - 8} fill={LAB.muted} fontSize={12}>{min.toFixed(2)}</SvgText>
          <SvgText x={W - PAD} y={HEIGHT - 8} fill={LAB.muted} fontSize={12} textAnchor="end">{max.toFixed(2)}</SvgText>
        </Svg>
      </View>
      <Animated.Text entering={FadeIn.delay(1200)} style={{ color: LAB.text, fontFamily: LAB.mono, fontSize: 15, lineHeight: 22 }}>
        Threshold {demoEval.chosen.toFixed(2)}, chosen by best F1 on a labeled set of synthetic ideas.
      </Animated.Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  numbers: { flexDirection: 'row', gap: 14 },
  number: { flex: 1 },
  chart: { borderRadius: 22, overflow: 'hidden' },
});
