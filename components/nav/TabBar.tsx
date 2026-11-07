import { sfx } from '@/lib/sound';
import { Tabs } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import * as Haptics from '@/lib/haptics';
import { GLIDE } from '@/lib/motion';
import { useMode } from '@/lib/theme';
import { radius, space } from '@/lib/tokens';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONS: Record<string, string> = {
  index: 'M9 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM3 6a1 1 0 0 1 2 0v12a1 1 0 0 1-2 0z',
  projects: 'M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  teams: 'M21 12a8 8 0 0 1-8 8H4l2.5-3A8 8 0 1 1 21 12z',
  profile: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM3.5 21.5a8.5 8 0 0 1 17 0z',
};
// The gap around the highlight, the same on every side, so it stays inside the bar's round ends.
const INSET = 5;

/** The bar floats over the screen, so tab screens pad their bottom by this much. */
export const useTabInset = () => {
  const { bottom } = useSafeAreaInsets();
  return 56 + Math.max(bottom - 8, space.s) + space.s;
};

/** A floating bar whose highlight slides between tabs, in the color of the current mode. */
export function TabBar({ state, descriptors, navigateToTab }: BottomTabBarProps) {
  const { t } = useMode();
  const { bottom } = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const count = state.routes.length;
  const slot = (width - INSET * 2) / count;
  const x = useSharedValue(0);

  useEffect(() => {
    if (width) x.value = withTiming(state.index * slot, GLIDE);
  }, [slot, state.index, width, x]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(bottom - 8, space.s) }]}>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.bar, { backgroundColor: t.surface, shadowColor: t.line }]}>
        {width ? <Animated.View style={[styles.pill, { width: slot, backgroundColor: t.primary }, pill]} /> : null}
        {state.routes.map((route, i) => {
          const on = state.index === i;
          const label = descriptors[route.key].options.title ?? route.name;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={label}
              style={styles.tab}
              onPress={() => {
                Haptics.selectionAsync();
                if (!on) sfx('tap');
                if (!on) navigateToTab(route.key);
              }}>
              <Svg width={19} height={19} viewBox="0 0 24 24">
                <Path d={ICONS[route.name] ?? ICONS.index} fill={on ? t.onPrimary : t.muted} />
              </Svg>
              <Text style={{ color: on ? t.onPrimary : t.muted, fontFamily: t.fontBold, fontSize: 11 }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.gutter },
  bar: {
    flexDirection: 'row',
    height: 56,
    paddingHorizontal: INSET,
    borderRadius: radius.full,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
  },
  pill: { position: 'absolute', top: INSET, bottom: INSET, left: INSET, borderRadius: radius.full },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 1 },
});
