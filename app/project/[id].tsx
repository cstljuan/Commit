import * as Haptics from '@/lib/haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { Critter } from '@/components/critters/Critter';
import { DecodeText } from '@/components/motion/DecodeText';
import { HashChip } from '@/components/motion/HashChip';
import { Burst } from '@/components/motion/Particles';
import { PressScale } from '@/components/motion/PressScale';
import { Reveal } from '@/components/motion/Reveal';
import { Hachi } from '@/components/Hachi/Hachi';
import { demoProjects } from '@/lib/demoData';
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={username ? `Open @${username}` : `${role} is open`}
      disabled={!username || username === 'you'}
      onPress={() => router.push(`/person/${username}`)}
      style={[styles.slot, { backgroundColor: filled ? t.surface : t.line }]}>
      {filled ? (
        <Animated.View style={[styles.badge, badge]}>
          <Critter seed={username ?? 'open'} size={44} />
        </Animated.View>
      ) : (
        <View style={[styles.badge, styles.open, { backgroundColor: t.bg }]}>
          <Text style={{ color: t.muted, fontFamily: t.fontBold, fontSize: 20 }}>+</Text>
        </View>
      )}
      <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: 15 }}>{role}</Text>
      <Text numberOfLines={1} style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 13 }}>
        {username ? `@${username}` : 'Open'}
      </Text>
    </Pressable>
  );
}

export default function TeamScreen() {
  const { t } = useMode();
  const { id } = useLocalSearchParams<{ id: string }>();
  const team = demoProjects.find((p) => p.id === id) ?? demoProjects[0];
  const [fire, setFire] = useState(0);
  const filled = team.roles.filter((r) => r.username).length;
  const total = team.roles.length;
  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: team.status === 'private' ? 'Private idea' : 'Team' }} />
      <Reveal>
        <Text style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: 34 }}>{team.title}</Text>
        <View style={{ marginTop: 6 }}>
          <HashChip hash={team.commitHash} />
        </View>
      </Reveal>

      <Reveal index={1} style={styles.meter}>
        <Hachi size={84} animated interactive listen />
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
        {team.roles.map((r, i) => (
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
          text={team.idea}
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
  slot: { width: '48.5%', borderRadius: 20, padding: 14, gap: 4, alignItems: 'flex-start' },
  badge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  open: { borderStyle: 'dashed' },
  idea: { padding: 18, borderRadius: 22, gap: 8 },
  button: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
