import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useMode } from '@/lib/theme';

const icon = (d: string) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path d={d} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  };

const SwipeIcon = icon('M8 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM3 7v10');
const MatchesIcon = icon('M21 12a8 8 0 0 1-8 8H4l2.5-3A8 8 0 1 1 21 12z');
const ProfileIcon = icon('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0');

export default function TabsLayout() {
  const { t } = useMode();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.line },
        tabBarLabelStyle: { fontFamily: t.fontBold },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Swipe', tabBarIcon: SwipeIcon }} />
      <Tabs.Screen name="teams" options={{ title: 'Matches', tabBarIcon: MatchesIcon }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ProfileIcon }} />
    </Tabs>
  );
}
