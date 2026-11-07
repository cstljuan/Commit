import { Tabs } from 'expo-router';

import { useMode } from '@/lib/theme';

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
        tabBarIconStyle: { display: 'none' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Swipe' }} />
      <Tabs.Screen name="teams" options={{ title: 'Matches' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
