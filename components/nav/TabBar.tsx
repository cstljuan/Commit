import { Tabs } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import * as Haptics from '@/lib/haptics';
import { useMode } from '@/lib/theme';
import { radius, space } from '@/lib/tokens';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONS: Record<string, string> = {
  index: 'M8 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM3 7v10',
  projects: 'M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  teams: 'M21 12a8 8 0 0 1-8 8H4l2.5-3A8 8 0 1 1 21 12z',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
};
const SPRING = { damping: 17, stiffness: 240 };
// The gap around the highlight, the same on every side, so it stays inside the bar's round ends.
const INSET = 5;

/** The bar floats over the screen, so tab screens pad their bottom by this much. */
export const useTabInset = () => {
  const { bottom } = useSafeAreaInsets();
  return 56 + Math.max(bottom - 8, space.s) + space.s;
};

/** A floating bar whose highlight slides between tabs, in the colour of the current mode. */
export function TabBar({ state, descriptors, navigateToTab }: BottomTabBarProps) {
  const { t } = useMode();
  const { bottom } = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const count = state.routes.length;
  const slot = (width - INSET * 2) / count;
  const x = useSharedValue(0);

  useEffect(() => {
    if (width) x.value = withSpring(state.index * slot, SPRING);
  }, [slot, state.index, width, x]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(bottom - 8, space.s) }]}>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.bar, { backgroundColor: t.surface, shadowColor: t.primary }]}>
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
                if (!on) navigateToTab(route.key);
              }}>
              <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
                <Path d={ICONS[route.name] ?? ICONS.index} stroke={on ? t.onPrimary : t.muted} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
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
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  pill: { position: 'absolute', top: INSET, bottom: INSET, left: INSET, borderRadius: radius.full },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 1 },
});
