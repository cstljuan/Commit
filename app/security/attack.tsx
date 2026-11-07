import '@/lib/crypto';

import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';

import { PressScale } from '@/components/motion/PressScale';
import { Reveal } from '@/components/motion/Reveal';
import { LAB } from '@/lib/demoData';
import { open, safetyNumber, seal } from '@/lib/e2eeCore';
import { sfx } from '@/lib/sound';

const CHAT = 'this-chat';

const person = () => {
  const keys = nacl.box.keyPair();
  return { pub: encodeBase64(keys.publicKey), secret: keys.secretKey };
};

/** Runs the real open() and reports what really happened. Nothing here is a canned answer. */
const attempt = (run: () => string) => {
  try {
    return { through: true, text: run() };
  } catch (e) {
    return { through: false, text: e instanceof Error ? e.message : 'Rejected' };
  }
};

/** Flips one character of the ciphertext, the way a server editing a row would. */
const flipOne = (body: string) => {
  const at = body.length - 6;
  return body.slice(0, at) + (body[at] === 'A' ? 'B' : 'A') + body.slice(at + 1);
};

type Outcome = { id: string; through: boolean; text: string; numbers?: [string[], string[]] };
type Keys = { me: ReturnType<typeof person>; them: ReturnType<typeof person>; eve: ReturnType<typeof person> };

const ATTACKS: { id: string; title: string; line: string; run: (body: string, k: Keys) => Omit<Outcome, 'id'> }[] = [
  {
    id: 'read',
    title: 'Read it with my own key',
    line: 'The server tries to open the message.',
    run: (body, k) => attempt(() => open(body, CHAT, k.me.pub, k.me.pub, k.eve.secret)),
  },
  {
    id: 'edit',
    title: 'Change one letter',
    line: 'The server edits the stored row.',
    run: (body, k) => attempt(() => open(flipOne(body), CHAT, k.me.pub, k.me.pub, k.them.secret)),
  },
  {
    id: 'replay',
    title: 'Replay it in another chat',
    line: 'The server copies the row to a different match.',
    run: (body, k) => attempt(() => open(body, 'another-chat', k.me.pub, k.me.pub, k.them.secret)),
  },
  {
    id: 'reflect',
    title: 'Send it back to you as theirs',
    line: 'The server puts your own words in their mouth.',
    run: (body, k) => attempt(() => open(body, CHAT, k.them.pub, k.them.pub, k.me.secret)),
  },
];

function Result({ outcome }: { outcome: Outcome }) {
  const color = outcome.through ? LAB.bad : LAB.ok;
  return (
    <Animated.View entering={FadeIn.duration(180)} style={styles.result}>
      <Text style={{ color, fontFamily: LAB.monoBold, fontSize: 13 }}>{outcome.through ? 'GOT THROUGH' : 'BLOCKED'}</Text>
      <Text style={{ color: LAB.muted, fontFamily: LAB.mono, fontSize: 12 }}>{outcome.text}</Text>
    </Animated.View>
  );
}

function Attack({ title, line, outcome, onPress, disabled }: { title: string; line: string; outcome?: Outcome; onPress: () => void; disabled: boolean }) {
  return (
    <PressScale accessibilityLabel={title} disabled={disabled} onPress={onPress} style={[styles.card, { opacity: disabled ? 0.5 : 1 }]}>
      <Text style={{ color: LAB.text, fontFamily: LAB.monoBold, fontSize: 15 }}>{title}</Text>
      <Text style={{ color: LAB.muted, fontFamily: LAB.mono, fontSize: 12 }}>{line}</Text>
      {outcome ? <Result outcome={outcome} /> : null}
    </PressScale>
  );
}

/** You play the server. Every attack calls the same code the real chat uses, with test keys. */
export default function AttackScreen() {
  const [keys] = useState<Keys>(() => ({ me: person(), them: person(), eve: person() }));
  const [text, setText] = useState('our idea stays between us');
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const body = useMemo(() => seal(text, CHAT, keys.me.pub, keys.them.pub, keys.me.secret), [keys, text]);
  const empty = !text.trim();

  const record = (id: string, outcome: Omit<Outcome, 'id'>) => {
    sfx(outcome.through ? 'msg_in' : 'error');
    setOutcomes((all) => ({ ...all, [id]: { id, ...outcome } }));
  };

  const edit = (next: string) => {
    setText(next);
    setOutcomes({});
  };

  // The strongest attack: hand each person the attacker's key. Only comparing numbers catches it.
  const swap = () => {
    const mine = safetyNumber(keys.me.pub, keys.eve.pub);
    const theirs = safetyNumber(keys.them.pub, keys.eve.pub);
    sfx('error');
    setOutcomes((all) => ({
      ...all,
      swap: { id: 'swap', through: mine.join() === theirs.join(), text: 'Your numbers stop matching, so comparing them exposes it.', numbers: [mine, theirs] },
    }));
  };

  const delivered = outcomes.deliver;
  const tried = [...ATTACKS.map((a) => a.id), 'swap'].filter((id) => outcomes[id]);
  const blocked = tried.filter((id) => !outcomes[id].through).length;

  return (
    <ScrollView style={{ backgroundColor: LAB.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen
        options={{ title: 'Attack it', headerStyle: { backgroundColor: LAB.bg }, headerTintColor: LAB.text, contentStyle: { backgroundColor: LAB.bg } }}
      />
      <Reveal>
        <Text style={{ color: LAB.text, fontFamily: LAB.display, fontSize: 32, lineHeight: 38 }}>You are the server. Try to break a message.</Text>
        <Text style={[styles.note, { marginTop: 8 }]}>The real encryption code, running on this phone. These are test keys made when you opened this screen, and nothing is sent anywhere.</Text>
      </Reveal>

      <Reveal index={1} style={styles.block}>
        <Text style={styles.label}>You type</Text>
        <TextInput
          accessibilityLabel="Message to encrypt"
          value={text}
          onChangeText={edit}
          multiline
          placeholder="Type anything"
          placeholderTextColor={LAB.muted}
          style={styles.input}
        />
      </Reveal>

      <Reveal index={2} style={styles.block}>
        <Text style={styles.label}>What the server stores</Text>
        <View style={styles.cipher}>
          <Text selectable style={{ color: LAB.primary, fontFamily: LAB.mono, fontSize: 12, lineHeight: 18 }}>{body}</Text>
        </View>
      </Reveal>

      <Reveal index={3} style={styles.block}>
        <PressScale
          accessibilityLabel="Deliver it"
          disabled={empty}
          onPress={() => record('deliver', attempt(() => open(body, CHAT, keys.me.pub, keys.me.pub, keys.them.secret)))}
          style={[styles.deliver, { opacity: empty ? 0.5 : 1 }]}>
          <Text style={{ color: '#FFFFFF', fontFamily: LAB.monoBold, fontSize: 15 }}>Deliver it normally</Text>
        </PressScale>
        {delivered ? (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.card}>
            <Text style={styles.label}>Your teammate&apos;s phone opens it</Text>
            <Text style={{ color: LAB.ok, fontFamily: LAB.monoBold, fontSize: 15 }}>{delivered.text}</Text>
          </Animated.View>
        ) : null}
      </Reveal>

      <Reveal index={4} style={styles.block}>
        <View style={styles.scoreRow}>
          <Text style={styles.label}>Now attack it</Text>
          {tried.length ? <Text style={{ color: LAB.ok, fontFamily: LAB.monoBold, fontSize: 13 }}>{blocked} of {tried.length} blocked</Text> : null}
        </View>
        {ATTACKS.map((attack) => (
          <Attack
            key={attack.id}
            title={attack.title}
            line={attack.line}
            disabled={empty}
            outcome={outcomes[attack.id]}
            onPress={() => record(attack.id, attack.run(body, keys))}
          />
        ))}
        <PressScale accessibilityLabel="Swap their key" onPress={swap} style={styles.card}>
          <Text style={{ color: LAB.text, fontFamily: LAB.monoBold, fontSize: 15 }}>Swap their key for mine</Text>
          <Text style={{ color: LAB.muted, fontFamily: LAB.mono, fontSize: 12 }}>The strongest attack. The server gives each of you its own key instead.</Text>
          {outcomes.swap ? (
            <Animated.View entering={FadeIn.duration(180)} style={styles.result}>
              <Text style={{ color: outcomes.swap.through ? LAB.bad : LAB.ok, fontFamily: LAB.monoBold, fontSize: 13 }}>{outcomes.swap.through ? 'GOT THROUGH' : 'CAUGHT'}</Text>
              <Text style={{ color: LAB.muted, fontFamily: LAB.mono, fontSize: 12 }}>You see   {outcomes.swap.numbers?.[0].slice(0, 3).join(' ')}</Text>
              <Text style={{ color: LAB.muted, fontFamily: LAB.mono, fontSize: 12 }}>They see  {outcomes.swap.numbers?.[1].slice(0, 3).join(' ')}</Text>
              <Text style={{ color: LAB.muted, fontFamily: LAB.mono, fontSize: 12 }}>{outcomes.swap.text}</Text>
            </Animated.View>
          ) : null}
        </PressScale>
      </Reveal>

      <Reveal index={5}>
        <Text style={styles.note}>What this does not hide: who talks to whom, when, and roughly how long each message is. A server can also refuse to deliver a message. It cannot read or forge one.</Text>
      </Reveal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 20, paddingBottom: 48 },
  block: { gap: 10 },
  label: { color: LAB.muted, fontFamily: LAB.monoBold, fontSize: 12 },
  note: { color: LAB.muted, fontFamily: LAB.mono, fontSize: 12, lineHeight: 18 },
  input: { backgroundColor: LAB.card, color: LAB.text, fontFamily: LAB.mono, fontSize: 15, borderRadius: 14, padding: 14, minHeight: 56 },
  cipher: { backgroundColor: LAB.card, borderRadius: 14, padding: 14 },
  deliver: { backgroundColor: LAB.accent, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: LAB.card, borderRadius: 14, padding: 14, gap: 4 },
  result: { marginTop: 8, gap: 3 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
