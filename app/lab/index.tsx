import { router, Stack, type Href } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { DecodeText } from '@/components/motion/DecodeText';
import { PressScale } from '@/components/motion/PressScale';
import { Reveal } from '@/components/motion/Reveal';
import { LAB } from '@/lib/demoData';

const PROOFS: { href: Href; cmd: string; title: string; line: string; color: string }[] = [
  { href: '/verify', cmd: './verify', title: 'Break the vault', line: 'Edit one row. Watch the chain catch it.', color: LAB.ok },
  { href: '/lab/oracle', cmd: './oracle', title: 'The oracle attack', line: 'Copy detection can leak. Here is the fix.', color: LAB.accent },
  { href: '/lab/report', cmd: './report', title: 'Report card', line: 'How good the copy detection really is.', color: LAB.primary },
  { href: '/lab/rls', cmd: './rls', title: 'Locked doors', line: 'An outsider tries everything.', color: '#F59E0B' },
];

export default function LabScreen() {
  return (
    <ScrollView style={{ backgroundColor: LAB.bg }} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: 'Security Lab',
          headerStyle: { backgroundColor: LAB.bg },
          headerTintColor: LAB.text,
          contentStyle: { backgroundColor: LAB.bg },
        }}
      />
      <DecodeText
        text="Every security claim we make, we break live."
        durationMs={700}
        style={{ color: LAB.text, fontFamily: LAB.display, fontSize: 32, lineHeight: 38 }}
      />
      {PROOFS.map((p, i) => (
        <Reveal key={p.cmd} index={i + 2}>
          <PressScale onPress={() => router.push(p.href)} style={[styles.card, { backgroundColor: LAB.card, borderLeftColor: p.color }]}>
            <Text style={{ color: p.color, fontFamily: LAB.monoBold, fontSize: 14 }}>$ {p.cmd}</Text>
            <Text style={{ color: LAB.text, fontFamily: LAB.display, fontSize: 24 }}>{p.title}</Text>
            <Text style={{ color: LAB.muted, fontFamily: 'Figtree_400Regular', fontSize: 15 }}>{p.line}</Text>
          </PressScale>
        </Reveal>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  card: { padding: 18, borderRadius: 20, borderLeftWidth: 6, gap: 4 },
});
