import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { PressScale } from '@/components/motion/PressScale';
import { Reveal } from '@/components/motion/Reveal';
import { API_IS_MOCK, getMyProjects } from '@/lib/api';
import { LAB } from '@/lib/demoData';
import { proofFor, type ProofReceipt } from '@/lib/e2ee';
import { sfx } from '@/lib/sound';
import { readIdea } from '@/lib/teamKeys';
import { hashIdea } from '@/lib/vault';

const header = { headerStyle: { backgroundColor: LAB.bg }, headerTintColor: LAB.text, contentStyle: { backgroundColor: LAB.bg } };

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={{ color: LAB.text, fontFamily: LAB.mono, fontSize: 12, lineHeight: 18 }}>{value}</Text>
    </View>
  );
}

/** Proves an idea existed at a time, without showing the idea. Anyone with the text can recheck it. */
export default function ProofScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState('');
  const [receipt, setReceipt] = useState<ProofReceipt | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'none' | 'error'>('loading');
  const [text, setText] = useState('');
  const [match, setMatch] = useState<boolean | null>(null);

  useEffect(() => {
    if (!id) return;
    if (API_IS_MOCK) return setState('none');
    proofFor(id)
      .then((next) => {
        setReceipt(next);
        setState(next ? 'ready' : 'none');
      })
      .catch(() => setState('error'));
    getMyProjects()
      .then((list) => {
        const project = list.find((p) => p.id === id);
        if (!project) return;
        setTitle(project.title);
        // A private idea decrypts on this phone, so the check can run on the real words.
        if (project.status === 'private') readIdea(id).then((idea) => idea && setText(idea)).catch(() => {});
      })
      .catch(() => {});
  }, [id]);

  const check = async () => {
    if (!receipt) return;
    const ok = (await hashIdea(receipt.ts, text)) === receipt.ideaHash;
    sfx(ok ? 'commit' : 'error');
    setMatch(ok);
  };

  const share = () => {
    if (!receipt) return;
    Share.share({
      message: [
        `Commit proof receipt${title ? ` for ${title}` : ''}`,
        `Entry ${receipt.seq}, ${new Date(receipt.ts).toISOString()}`,
        `Idea hash ${receipt.ideaHash}`,
        `Entry hash ${receipt.entryHash}`,
        `Previous hash ${receipt.prevHash}`,
        `Signature ${receipt.signature}`,
      ].join('\n'),
    }).catch(() => {});
  };

  if (state !== 'ready' || !receipt) {
    const line =
      state === 'loading'
        ? 'Loading the receipt'
        : state === 'error'
        ? 'Could not reach the server, so this receipt cannot be checked right now.'
        : API_IS_MOCK
        ? 'This is a sample project, so it has no real receipt. Post a real idea and one appears here.'
        : 'This project has no entry in the vault yet.';
    return (
      <View style={[styles.empty, { backgroundColor: LAB.bg }]}>
        <Stack.Screen options={{ title: 'Proof receipt', ...header }} />
        <Text style={{ color: LAB.text, fontFamily: LAB.mono, fontSize: 15, textAlign: 'center', lineHeight: 22 }}>{line}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: LAB.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Proof receipt', ...header }} />
      <Reveal>
        <Text style={{ color: LAB.text, fontFamily: LAB.display, fontSize: 30, lineHeight: 36 }}>{title || 'This idea'} existed at this moment.</Text>
        <Text style={[styles.note, { marginTop: 8 }]}>The hash proves the words without showing them. Change one letter and the hash stops matching.</Text>
      </Reveal>

      <Reveal index={1} style={styles.card}>
        <Text style={{ color: receipt.signedByRightKey ? LAB.ok : LAB.bad, fontFamily: LAB.monoBold, fontSize: 14 }}>
          {receipt.signedByRightKey ? 'Signature checked on this phone' : 'Signature does not check out'}
        </Text>
        <Field label="Time" value={new Date(receipt.ts).toISOString()} />
        <Field label="Chain entry" value={String(receipt.seq)} />
        <Field label="Idea hash" value={receipt.ideaHash} />
        <Field label="Entry hash" value={receipt.entryHash} />
        <Field label="Previous entry" value={receipt.prevHash} />
        <Field label="Author signature" value={receipt.signature} />
      </Reveal>

      <Reveal index={2} style={{ gap: 10 }}>
        <Text style={styles.label}>Check an idea against this receipt</Text>
        <TextInput
          accessibilityLabel="Idea text to check"
          value={text}
          onChangeText={(next) => {
            setText(next);
            setMatch(null);
          }}
          multiline
          placeholder="Paste the exact idea"
          placeholderTextColor={LAB.muted}
          style={styles.input}
        />
        <PressScale accessibilityLabel="Check the words" disabled={!text} onPress={check} style={[styles.primary, { opacity: text ? 1 : 0.5 }]}>
          <Text style={styles.primaryText}>Check the words</Text>
        </PressScale>
        {match !== null ? (
          <Animated.Text entering={FadeIn.duration(180)} style={{ color: match ? LAB.ok : LAB.bad, fontFamily: LAB.monoBold, fontSize: 14 }}>
            {match ? 'MATCH. These are the exact words from that moment.' : 'NO MATCH. These words are not what was committed.'}
          </Animated.Text>
        ) : null}
      </Reveal>

      <Reveal index={3}>
        <PressScale accessibilityLabel="Share this receipt" onPress={share} style={styles.secondary}>
          <Text style={{ color: LAB.text, fontFamily: LAB.monoBold, fontSize: 15 }}>Share this receipt</Text>
        </PressScale>
      </Reveal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 20, paddingBottom: 48 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  label: { color: LAB.muted, fontFamily: LAB.monoBold, fontSize: 12 },
  note: { color: LAB.muted, fontFamily: LAB.mono, fontSize: 12, lineHeight: 18 },
  card: { backgroundColor: LAB.card, borderRadius: 18, padding: 16, gap: 12 },
  input: { backgroundColor: LAB.card, color: LAB.text, fontFamily: LAB.mono, fontSize: 14, borderRadius: 14, padding: 14, minHeight: 80 },
  primary: { backgroundColor: LAB.accent, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontFamily: LAB.monoBold, fontSize: 15 },
  secondary: { backgroundColor: LAB.card, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
