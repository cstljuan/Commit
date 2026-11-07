import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { DecodeText } from '@/components/motion/DecodeText';
import { Burst } from '@/components/motion/Particles';
import { PressScale } from '@/components/motion/PressScale';
import { Reveal } from '@/components/motion/Reveal';
import { Tako } from '@/components/Tako/Tako';
import { demoTeam } from '@/lib/demoData';
import { useMode } from '@/lib/theme';

function RoleSlot({ role, username, index, filled, onFilled }: { role: string; username: string | null; index: number; filled: boolean; onFilled?: () => void }) {
  const { t } = useMode();
  const scale = useSharedValue(filled ? 0 : 1);
  useEffect(() => {
    if (!filled) return;
    scale.value = withDelay(index * 130 + 200, withSpring(1, { damping: 10, stiffness: 240 }));
    const tick = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onFilled?.();
    }, index * 130 + 260);
    return () => clearTimeout(tick);
    // Plays once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const badge = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: scale.value }));
  return (
    <View style={[styles.slot, { backgroundColor: filled ? t.surface : 'transparent', borderColor: filled ? t.surface : t.muted + '66' }]}>
      {filled ? (
        <Animated.View style={[styles.badge, { backgroundColor: t.primary }, badge]}>
          <Text style={{ color: t.onPrimary, fontFamily: t.fontDisplay, fontSize: 20 }}>{(username ?? '?')[0].toUpperCase()}</Text>
        </Animated.View>
      ) : (
        <View style={[styles.badge, styles.open, { borderColor: t.muted }]}>
          <Text style={{ color: t.muted, fontFamily: t.fontBold, fontSize: 20 }}>+</Text>
        </View>
      )}
      <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: 15 }}>{role}</Text>
      <Text numberOfLines={1} style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 13 }}>
        {username ? `@${username}` : 'Open'}
      </Text>
    </View>
  );
}

export default function TeamScreen() {
  const { t } = useMode();
  const [fire, setFire] = useState(0);
  const filled = demoTeam.roles.filter((r) => r.username).length;
  const total = demoTeam.roles.length;
  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Team' }} />
      <Reveal>
        <Text style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: 34 }}>{demoTeam.title}</Text>
        <Text style={{ color: t.primary, fontFamily: 'JetBrainsMono_700Bold', fontSize: 14, marginTop: 4 }}>
          commit {demoTeam.commitHash.slice(0, 7)}
        </Text>
      </Reveal>

      <Reveal index={1} style={styles.meter}>
        <Tako size={72} state={filled === total ? 'happy' : 'idle'} animated />
        <View style={styles.meterText}>
          <Text style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: 28 }}>
            {filled} of {total} roles
          </Text>
          <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 14 }}>
            {filled === total ? 'Team complete' : `Still need ${total - filled}`}
          </Text>
        </View>
      </Reveal>

      <View style={styles.grid}>
        {demoTeam.roles.map((r, i) => (
          <RoleSlot
            key={r.role}
            role={r.role}
            username={r.username}
            index={i}
            filled={!!r.username}
            onFilled={i === filled - 1 ? () => setFire((n) => n + 1) : undefined}
          />
        ))}
        <Burst fire={fire} color={t.primary} count={10} reach={120} />
      </View>

      <Reveal index={3} style={[styles.idea, { backgroundColor: t.surface }]}>
        <Text style={{ color: t.muted, fontFamily: t.fontBold, fontSize: 13 }}>The idea, decrypted for this team</Text>
        <DecodeText
          text={demoTeam.idea}
          delayMs={600}
          durationMs={1100}
          style={{ color: t.text, fontFamily: t.fontBody, fontSize: 16, lineHeight: 24 }}
        />
      </Reveal>

      <Reveal index={4}>
        <PressScale onPress={() => router.push('/chat/m1')} style={[styles.button, { backgroundColor: t.primary }]}>
          <Text style={{ color: t.onPrimary, fontFamily: t.fontBold, fontSize: 17 }}>Open chat</Text>
        </PressScale>
      </Reveal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  meter: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  meterText: { flex: 1, gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot: { width: '48.5%', borderRadius: 20, borderWidth: 2, padding: 14, gap: 4, alignItems: 'flex-start' },
  badge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  open: { borderWidth: 2, borderStyle: 'dashed' },
  idea: { padding: 18, borderRadius: 22, gap: 8 },
  button: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
