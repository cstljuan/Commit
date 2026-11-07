import { router, Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import * as Haptics from '@/lib/haptics';
import { useMode } from '@/lib/theme';
import { space, type } from '@/lib/tokens';

type Props = { title: string; children: ReactNode; bg?: string; ink?: string; muted?: string; titleFont?: string; right?: ReactNode };

const BAR = 48;

/**
 * Our own screen frame. The big title squashes as you pull and hands off to the small
 * title in the bar as you scroll, driven by the scroll position on the UI thread.
 */
export function Screen({ title, children, bg, ink, muted, titleFont, right }: Props) {
  const { t } = useMode();
  const { top } = useSafeAreaInsets();
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  const background = bg ?? t.bg;
  const text = ink ?? t.text;
  const font = titleFont ?? t.fontDisplay;

  const big = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, 48], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(y.value, [-120, 0, 60], [24, 0, -10], Extrapolation.CLAMP) },
      { scale: interpolate(y.value, [-140, 0], [1.18, 1], Extrapolation.CLAMP) },
    ],
    transformOrigin: 'left center',
  }));
  const small = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [32, 64], [0, 1], Extrapolation.CLAMP) }));
  const rule = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [32, 64], [0, 0.25], Extrapolation.CLAMP) }));

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.bar, { paddingTop: top, height: top + BAR, backgroundColor: background }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={() => {
            Haptics.selectionAsync();
            if (router.canGoBack()) router.back();
            else router.replace('/');
          }}
          style={styles.back}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5l-7 7 7 7" stroke={text} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Animated.Text numberOfLines={1} style={[styles.smallTitle, { color: text, fontFamily: font }, small]}>
          {title}
        </Animated.Text>
        <View style={styles.right}>{right}</View>
        <Animated.View style={[styles.rule, { backgroundColor: text }, rule]} />
      </View>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Animated.View style={big}>
          <Text style={{ color: text, fontFamily: font, fontSize: type.display }}>{title}</Text>
        </Animated.View>
        {children}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.m, zIndex: 2 },
  back: { width: 44, height: BAR, justifyContent: 'center' },
  smallTitle: { flex: 1, textAlign: 'center', fontSize: type.lead },
  right: { minWidth: 44, height: BAR, alignItems: 'flex-end', justifyContent: 'center' },
  rule: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1 },
  content: { paddingHorizontal: space.gutter, paddingBottom: space.huge, gap: space.m },
});
