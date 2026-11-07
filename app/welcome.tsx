import { router, Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Hachi, type HachiHandle, type HachiState } from '@/components/Hachi/Hachi';
import { DecodeText } from '@/components/motion/DecodeText';
import { PressScale } from '@/components/motion/PressScale';
import { useMode } from '@/lib/theme';
import { radius, space, type } from '@/lib/tokens';

const PAGES: { title: string; body: string; state: HachiState }[] = [
  { title: 'Find people who show up', body: 'Swipe on projects and builders by role. When you both say yes, you match.', state: 'wave' },
  { title: 'Your idea gets a commit hash', body: 'It goes into a signed, tamper-evident chain, and only your team can read it.', state: 'ink' },
  { title: 'Hold to commit', body: 'Joining a team is a promise, so it takes a held press. Showing up raises your score.', state: 'success' },
];

function Page({ i, x, width }: { i: number; x: SharedValue<number>; width: number }) {
  const { t } = useMode();
  const style = useAnimatedStyle(() => {
    const at = x.value / width - i;
    return {
      opacity: interpolate(at, [-0.7, 0, 0.7], [0, 1, 0], Extrapolation.CLAMP),
      transform: [{ translateX: at * -60 }, { scale: interpolate(at, [-1, 0, 1], [0.9, 1, 0.9], Extrapolation.CLAMP) }],
    };
  });
  return (
    <View style={{ width, paddingHorizontal: space.gutter, justifyContent: 'flex-end' }}>
      <Animated.View style={[styles.words, style]}>
        <Text style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: type.hero, lineHeight: type.hero + 4 }}>{PAGES[i].title}</Text>
        <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.lead, lineHeight: 26 }}>{PAGES[i].body}</Text>
      </Animated.View>
    </View>
  );
}

/** Hachi walks you in. The one Hachi stays put while the words slide past, reacting to each. */
export default function WelcomeScreen() {
  const { t } = useMode();
  const { width } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  const x = useSharedValue(0);
  const [page, setPage] = useState(0);
  const list = useRef<Animated.FlatList<number>>(null);
  const mascot = useRef<HachiHandle>(null);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });
  const hachiMove = useAnimatedStyle(() => ({ transform: [{ translateX: Math.sin((x.value / width) * Math.PI) * -24 }] }));
  const last = page === PAGES.length - 1;

  return (
    <View style={[styles.root, { backgroundColor: t.bg, paddingTop: top + space.l, paddingBottom: bottom + space.l }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.top}>
        <DecodeText text="commit" durationMs={500} style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: type.title }} />
        <PressScale accessibilityLabel="Skip" onPress={() => router.replace('/')}>
          <Text style={{ color: t.muted, fontFamily: t.fontBold, fontSize: type.body }}>Skip</Text>
        </PressScale>
      </View>
      <Animated.View style={[styles.stage, hachiMove]}>
        <Hachi ref={mascot} size={220} state={PAGES[page].state} animated interactive sleepAfter={0} />
      </Animated.View>
      <Animated.FlatList
        ref={list}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={PAGES.map((_, i) => i)}
        keyExtractor={(i) => String(i)}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => <Page i={item} x={x} width={width} />}
      />
      <View style={styles.bottom}>
        <View style={styles.dots}>
          {PAGES.map((p, i) => (
            <View key={p.title} style={[styles.dot, { backgroundColor: i === page ? t.primary : `${t.primary}33`, width: i === page ? 24 : 8 }]} />
          ))}
        </View>
        <PressScale
          onPress={() => {
            if (last) router.replace('/');
            else list.current?.scrollToIndex({ index: page + 1, animated: true });
            if (!last) setPage(page + 1);
          }}
          style={[styles.cta, { backgroundColor: t.primary }]}>
          <Text style={{ color: t.onPrimary, fontFamily: t.fontBold, fontSize: type.lead }}>{last ? 'Start swiping' : 'Next'}</Text>
        </PressScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.gutter },
  stage: { alignItems: 'center', paddingVertical: space.huge },
  words: { gap: space.m },
  bottom: { paddingHorizontal: space.gutter, gap: space.l, paddingTop: space.l },
  dots: { flexDirection: 'row', gap: space.s, alignSelf: 'center' },
  dot: { height: 8, borderRadius: radius.full },
  cta: { height: 56, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
});
