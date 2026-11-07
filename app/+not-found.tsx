import { router, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Hachi } from '@/components/Hachi/Hachi';
import { PressScale } from '@/components/motion/PressScale';
import { useMode } from '@/lib/theme';
import { radius, space, type } from '@/lib/tokens';

export default function NotFound() {
  const { t } = useMode();
  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Hachi size={180} state="thinking" animated interactive sleepAfter={0} />
      <Text style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: type.display, textAlign: 'center' }}>Hachi can&apos;t find that</Text>
      <Text style={{ color: t.muted, fontFamily: 'JetBrainsMono_400Regular', fontSize: type.small }}>fatal: not a valid object name</Text>
      <PressScale onPress={() => router.replace('/')} style={[styles.cta, { backgroundColor: t.primary }]}>
        <Text style={{ color: t.onPrimary, fontFamily: t.fontBold, fontSize: type.lead }}>Back to swiping</Text>
      </PressScale>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.l, padding: space.xl },
  cta: { height: 56, paddingHorizontal: space.xxl, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
});
