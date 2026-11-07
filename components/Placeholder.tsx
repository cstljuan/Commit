import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useMode } from '@/lib/theme';

/** Temporary home for a route until its owner builds it. Delete when replaced. */
export function Placeholder({ title, owner }: { title: string; owner: string }) {
  const { t } = useMode();
  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <Stack.Screen options={{ title }} />
      <Text style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: 28 }}>{title}</Text>
      <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 15 }}>Owner: {owner}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
});
