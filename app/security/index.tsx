import { router, Stack, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Critter } from '@/components/critters/Critter';
import { Hachi } from '@/components/Hachi/Hachi';
import { PressScale } from '@/components/motion/PressScale';
import { Reveal } from '@/components/motion/Reveal';
import { API_IS_MOCK } from '@/lib/api';
import { getPublicKeys } from '@/lib/crypto';
import { LAB } from '@/lib/demoData';
import { listPins } from '@/lib/e2ee';
import { getDeviceKeyState, verifyChain, type DeviceKeyState } from '@/lib/vault';

const WHAT_THE_SERVER_SEES: { thing: string; level: 'hidden' | 'partly' | 'visible'; line: string }[] = [
  { thing: 'Your secret keys', level: 'hidden', line: 'Made on this phone and kept in its secure storage. They are never uploaded.' },
  { thing: 'Chat messages', level: 'hidden', line: 'Encrypted on your phone once you both have keys. Each chat says if it is not.' },
  { thing: 'A private idea', level: 'partly', line: 'Stored encrypted. The words pass through our server once for copy detection and are not kept, but a numeric fingerprint of the idea is, which can hint at its topic.' },
  { thing: 'Who talks to whom, and when', level: 'visible', line: 'The server has to know this to deliver messages.' },
  { thing: 'Profile, swipes and matches', level: 'visible', line: 'Needed to make matches. Row rules limit who else can read them.' },
  { thing: 'A public idea', level: 'visible', line: 'You chose to show it.' },
];

const LEVEL = {
  hidden: { label: 'CANNOT READ', color: LAB.ok },
  partly: { label: 'PARTLY', color: '#FFC233' },
  visible: { label: 'CAN READ', color: LAB.bad },
};

const KEY_LINE: Record<DeviceKeyState | 'signed-out', string> = {
  ready: 'Keys are on this phone and match your account.',
  register: 'Keys are on this phone but not linked to your account yet.',
  new: 'This phone has no keys yet.',
  'other-device': 'Your keys are on another phone. Messages and private ideas can only open there.',
  'signed-out': 'Sign in to set up keys on this phone.',
};

type Chain = { state: 'loading' } | { state: 'ok'; count: number } | { state: 'broken'; at: number; reason?: string } | { state: 'unknown' };

function LinkCard({ title, line, href }: { title: string; line: string; href: Href }) {
  return (
    <PressScale accessibilityLabel={title} onPress={() => router.push(href)} style={styles.link}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: LAB.text, fontFamily: LAB.monoBold, fontSize: 15 }}>{title}</Text>
        <Text style={styles.note}>{line}</Text>
      </View>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M9 5l7 7-7 7" stroke={LAB.muted} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </PressScale>
  );
}

/** One place that says plainly what is protected, what is not, and lets you check it yourself. */
export default function SecurityCenter() {
  const [keyState, setKeyState] = useState<DeviceKeyState | 'signed-out' | null>(null);
  const [myKey, setMyKey] = useState<string | null>(null);
  const [chain, setChain] = useState<Chain>({ state: 'loading' });
  const [pins, setPins] = useState<{ username: string; verified: boolean }[]>([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listPins().then((next) => alive && setPins(next));
      getDeviceKeyState()
        .then(async (state) => {
          const key = state === 'ready' || state === 'register' ? (await getPublicKeys()).boxPublicKey : null;
          if (!alive) return;
          setKeyState(state);
          setMyKey(key);
        })
        .catch(() => alive && setKeyState('signed-out'));
      if (API_IS_MOCK) setChain({ state: 'unknown' });
      else
        verifyChain()
          .then((rows) => {
            if (!alive) return;
            const bad = rows.find((r) => !r.ok);
            setChain(bad ? { state: 'broken', at: bad.seq, reason: bad.reason } : { state: 'ok', count: rows.length });
          })
          .catch(() => alive && setChain({ state: 'unknown' }));
      return () => {
        alive = false;
      };
    }, []),
  );

  const chainLine =
    chain.state === 'loading'
      ? 'Checking every entry'
      : chain.state === 'ok'
      ? `${chain.count} entries checked on this phone. None were changed.`
      : chain.state === 'broken'
      ? `Entry ${chain.at} failed: ${chain.reason ?? 'it was changed'}`
      : 'Not checked. Sign in with a connection to run this.';
  const chainColor = chain.state === 'ok' ? LAB.ok : chain.state === 'broken' ? LAB.bad : LAB.muted;

  return (
    <ScrollView style={{ backgroundColor: LAB.bg }} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{ title: 'Security', headerStyle: { backgroundColor: LAB.bg }, headerTintColor: LAB.text, contentStyle: { backgroundColor: LAB.bg } }}
      />
      <Reveal style={styles.hero}>
        <Hachi size={92} animated interactive listen sleepAfter={0} />
        <Text style={{ flex: 1, color: LAB.text, fontFamily: LAB.display, fontSize: 28, lineHeight: 33 }}>What we can see, and what we can&apos;t.</Text>
      </Reveal>

      <Reveal index={1} style={styles.card}>
        <Text style={styles.label}>This phone</Text>
        <View style={styles.keyRow}>
          {myKey ? <Critter seed={myKey} size={56} /> : null}
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: keyState === 'ready' ? LAB.ok : LAB.text, fontFamily: LAB.monoBold, fontSize: 14 }}>
              {keyState ? KEY_LINE[keyState] : 'Checking keys'}
            </Text>
            {myKey ? <Text style={styles.note}>Public key {myKey.slice(0, 16)}</Text> : null}
          </View>
        </View>
        {keyState === 'new' || keyState === 'register' ? (
          <PressScale accessibilityLabel="Set up keys" onPress={() => router.push('/onboarding/keys')} style={styles.primary}>
            <Text style={{ color: '#FFFFFF', fontFamily: LAB.monoBold, fontSize: 15 }}>Set up keys</Text>
          </PressScale>
        ) : null}
      </Reveal>

      <Reveal index={2} style={styles.card}>
        <Text style={styles.label}>Idea chain</Text>
        <Text style={{ color: chainColor, fontFamily: LAB.monoBold, fontSize: 14, lineHeight: 20 }}>{chainLine}</Text>
      </Reveal>

      <Reveal index={3} style={{ gap: 10 }}>
        <LinkCard title="Attack it yourself" line="Play the server and try to break an encrypted message." href="/security/attack" />
        <LinkCard title="Break the vault" line="Edit one row and watch the chain catch it." href="/verify" />
        <LinkCard title="Security Lab" line="Every claim, tested live." href="/lab" />
      </Reveal>

      {pins.length ? (
        <Reveal index={4} style={{ gap: 10 }}>
          <Text style={styles.label}>People whose keys this phone knows</Text>
          {pins.map((pin) => (
            <PressScale key={pin.username} accessibilityLabel={`Compare keys with @${pin.username}`} onPress={() => router.push(`/security/compare/${pin.username}`)} style={styles.link}>
              <Critter seed={pin.username} size={36} />
              <Text style={{ flex: 1, color: LAB.text, fontFamily: LAB.monoBold, fontSize: 14 }}>@{pin.username}</Text>
              <Text style={{ color: pin.verified ? LAB.ok : LAB.muted, fontFamily: LAB.mono, fontSize: 12 }}>{pin.verified ? 'checked' : 'not checked'}</Text>
            </PressScale>
          ))}
        </Reveal>
      ) : null}

      <Reveal index={5} style={{ gap: 10 }}>
        <Text style={styles.label}>What our server can read</Text>
        {WHAT_THE_SERVER_SEES.map((row) => (
          <View key={row.thing} style={styles.row}>
            <View style={styles.rowTop}>
              <Text style={{ flex: 1, color: LAB.text, fontFamily: LAB.monoBold, fontSize: 14 }}>{row.thing}</Text>
              <Text style={{ color: LEVEL[row.level].color, fontFamily: LAB.monoBold, fontSize: 11 }}>{LEVEL[row.level].label}</Text>
            </View>
            <Text style={styles.note}>{row.line}</Text>
          </View>
        ))}
      </Reveal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 20, paddingBottom: 48 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  card: { backgroundColor: LAB.card, borderRadius: 18, padding: 16, gap: 10 },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { color: LAB.muted, fontFamily: LAB.monoBold, fontSize: 12 },
  note: { color: LAB.muted, fontFamily: LAB.mono, fontSize: 12, lineHeight: 18 },
  primary: { backgroundColor: LAB.accent, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: LAB.card, borderRadius: 14, padding: 14 },
  row: { backgroundColor: LAB.card, borderRadius: 14, padding: 14, gap: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
