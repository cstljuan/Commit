import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Critter } from '@/components/critters/Critter';
import { PressScale } from '@/components/motion/PressScale';
import { Reveal } from '@/components/motion/Reveal';
import { LAB } from '@/lib/demoData';
import { chatSecurity, markVerified, type ChatSecurity } from '@/lib/e2ee';
import { orderedPair, safetyNumber } from '@/lib/e2eeCore';
import { sfx } from '@/lib/sound';

const header = { headerStyle: { backgroundColor: LAB.bg }, headerTintColor: LAB.text, contentStyle: { backgroundColor: LAB.bg } };

/** Two people open this on their own phones. Same number means no one swapped a key in between. */
export default function CompareKeysScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const [security, setSecurity] = useState<ChatSecurity | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    if (!username) return;
    chatSecurity(username)
      .then((next) => {
        setSecurity(next);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [username]);
  useEffect(load, [load]);

  const myKey = security?.myKey;
  const peerKey = security?.peerKey;
  const changed = security?.state === 'changed';

  if (!myKey || !peerKey) {
    const line = failed
      ? 'Could not reach the server, so there is nothing to compare yet.'
      : !security
      ? 'Loading keys'
      : !myKey
      ? 'This phone has no keys yet. Set them up first.'
      : changed
      ? `@${username} no longer has a key on the server. That is unusual, so messages stay paused.`
      : `@${username} has no keys yet, so there is nothing to compare.`;
    return (
      <View style={[styles.empty, { backgroundColor: LAB.bg }]}>
        <Stack.Screen options={{ title: 'Compare keys', ...header }} />
        <Text style={{ color: LAB.text, fontFamily: LAB.mono, fontSize: 15, textAlign: 'center', lineHeight: 22 }}>{line}</Text>
        {security && !myKey ? (
          <PressScale accessibilityLabel="Set up keys" onPress={() => router.push('/onboarding/keys')} style={styles.primary}>
            <Text style={styles.primaryText}>Set up keys</Text>
          </PressScale>
        ) : null}
      </View>
    );
  }

  const [left, right] = orderedPair(myKey, peerKey);
  const number = safetyNumber(myKey, peerKey);

  return (
    <ScrollView style={{ backgroundColor: LAB.bg }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Compare keys', ...header }} />

      {changed ? (
        <Animated.View entering={FadeIn.duration(200)} style={[styles.warning, { backgroundColor: LAB.bad }]}>
          <Text style={{ color: '#2A1408', fontFamily: LAB.monoBold, fontSize: 15 }}>@{username}&apos;s key changed</Text>
          <Text style={{ color: '#2A1408', fontFamily: LAB.mono, fontSize: 13, lineHeight: 19 }}>
            Maybe they got a new phone. Or someone is trying to read your chat. Messages are paused until you check with them in person.
          </Text>
        </Animated.View>
      ) : null}

      <Reveal style={styles.pair}>
        <View style={styles.side}>
          <Critter seed={left} size={84} />
        </View>
        <Text style={{ color: LAB.muted, fontFamily: LAB.monoBold, fontSize: 18 }}>+</Text>
        <View style={styles.side}>
          <Critter seed={right} size={84} />
        </View>
      </Reveal>

      <Reveal index={1} style={styles.numberCard}>
        <Text style={styles.label}>Safety number with @{username}</Text>
        <View style={styles.grid}>
          {number.map((group, i) => (
            <Text key={`${group}${i}`} style={styles.group}>{group}</Text>
          ))}
        </View>
      </Reveal>

      <Reveal index={2}>
        <Text style={styles.note}>
          Open this screen on both phones and compare. Same creatures and same number means the two of you hold each other&apos;s real keys, and the server could not have swapped one in between.
        </Text>
      </Reveal>

      <Reveal index={3} style={{ gap: 10 }}>
        {changed ? (
          <PressScale
            accessibilityLabel="I checked with them, trust the new key"
            onPress={async () => {
              await markVerified(username ?? '', peerKey);
              sfx('commit');
              load();
            }}
            style={styles.primary}>
            <Text style={styles.primaryText}>I checked with them, trust the new key</Text>
          </PressScale>
        ) : security?.verified ? (
          <View style={styles.done}>
            <Text style={{ color: LAB.ok, fontFamily: LAB.monoBold, fontSize: 15 }}>You checked this key</Text>
          </View>
        ) : (
          <PressScale
            accessibilityLabel="The numbers match"
            onPress={async () => {
              await markVerified(username ?? '', peerKey);
              sfx('commit');
              load();
            }}
            style={styles.primary}>
            <Text style={styles.primaryText}>The numbers match</Text>
          </PressScale>
        )}
      </Reveal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 20, paddingBottom: 48 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 28 },
  warning: { borderRadius: 14, padding: 14, gap: 6 },
  pair: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  side: { alignItems: 'center' },
  numberCard: { backgroundColor: LAB.card, borderRadius: 18, padding: 18, gap: 12 },
  label: { color: LAB.muted, fontFamily: LAB.monoBold, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  group: { width: '31%', color: LAB.text, fontFamily: LAB.monoBold, fontSize: 22, textAlign: 'center' },
  note: { color: LAB.muted, fontFamily: LAB.mono, fontSize: 12, lineHeight: 18 },
  primary: { backgroundColor: LAB.accent, minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  primaryText: { color: '#2A1408', fontFamily: LAB.monoBold, fontSize: 15, textAlign: 'center' },
  done: { backgroundColor: LAB.card, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
