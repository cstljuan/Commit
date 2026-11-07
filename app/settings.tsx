import { signOut } from '@/lib/api';
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Critter } from '@/components/critters/Critter';
import { critterFor } from '@/components/critters/identity';
import { Segmented, Switch } from '@/components/motion/Controls';
import { HashChip } from '@/components/motion/HashChip';
import { PressScale } from '@/components/motion/PressScale';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/nav/Screen';
import { Hachi } from '@/components/Hachi/Hachi';
import { usePrefs } from '@/lib/prefs';
import { useMode, type Mode } from '@/lib/theme';
import { radius, space, type } from '@/lib/tokens';

function Section({ title, index, children }: { title: string; index: number; children: ReactNode }) {
  const { t } = useMode();
  return (
    <Reveal index={index} style={styles.section}>
      <Text style={{ color: t.muted, fontFamily: t.fontBold, fontSize: type.small }}>{title}</Text>
      <View style={[styles.group, { backgroundColor: t.surface }]}>{children}</View>
    </Reveal>
  );
}

function Row({ title, note, right }: { title: string; note?: string; right?: ReactNode }) {
  const { t } = useMode();
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: type.body }}>{title}</Text>
        {note ? <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.small }}>{note}</Text> : null}
      </View>
      {right}
    </View>
  );
}

function SignOutRow() {
  return (
    <PressScale accessibilityLabel="Sign out" onPress={() => signOut().catch(() => {})}>
      <Row title="Sign out" />
    </PressScale>
  );
}

function LinkRow({ title, note, href }: { title: string; note?: string; href: Href }) {
  const { t } = useMode();
  return (
    <PressScale accessibilityLabel={title} onPress={() => router.push(href)}>
      <Row
        title={title}
        note={note}
        right={
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M9 5l7 7-7 7" stroke={t.muted} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        }
      />
    </PressScale>
  );
}

const MODES: { value: Mode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'women', label: 'Women' },
  { value: 'hack', label: 'Hack' },
];

export default function SettingsScreen() {
  const { t } = useMode();
  const { prefs, setPref } = usePrefs();
  const me = critterFor('you');
  return (
    <Screen title="Settings">
      <Reveal index={0}>
        <PressScale accessibilityLabel="See all creatures" onPress={() => router.push('/creatures')} style={[styles.me, { backgroundColor: `${me.colour}1F` }]}>
          <Critter seed="you" size={84} animated />
          <View style={styles.rowText}>
            <Text style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: type.title }}>{me.name}</Text>
            <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.small }}>Yours forever. It comes from your key.</Text>
            <HashChip hash={me.fingerprint} label="key" />
          </View>
        </PressScale>
      </Reveal>

      <Reveal index={1}>
        <PressScale accessibilityLabel="Meet Hachi" onPress={() => router.push('/hachi')} style={[styles.me, { backgroundColor: t.surface }]}>
          <Hachi size={72} animated sleepAfter={0} />
          <View style={styles.rowText}>
            <Text style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: type.title }}>Meet Hachi</Text>
            <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.small }}>Play with Hachi and choose what to wear.</Text>
          </View>
        </PressScale>
      </Reveal>

      <Section title="Open the app in" index={1}>
        <View style={styles.pad}>
          <Segmented options={MODES} value={prefs.startMode} onChange={(m) => setPref('startMode', m)} />
        </View>
      </Section>

      <Section title="Feel" index={2}>
        <Row title="Haptics" note="The little taps when things happen" right={<Switch label="Haptics" value={prefs.haptics} onChange={(v) => setPref('haptics', v)} />} />
        <Row title="Calm motion" note="Turns off decorative animation" right={<Switch label="Calm motion" value={prefs.calmMotion} onChange={(v) => setPref('calmMotion', v)} />} />
      </Section>

      <Section title="Tell me about" index={3}>
        <Row title="New matches" right={<Switch label="New matches" value={prefs.notifyMatches} onChange={(v) => setPref('notifyMatches', v)} />} />
        <Row title="Copy alerts" note="Someone reworded your idea" right={<Switch label="Copy alerts" value={prefs.notifyCopyAlerts} onChange={(v) => setPref('notifyCopyAlerts', v)} />} />
      </Section>

      <Section title="Proof" index={4}>
        <LinkRow title="Your commits" note="Everything you have signed" href="/commits" />
        <LinkRow title="Verify the chain" href="/verify" />
        <LinkRow title="Security Lab" note="Watch us try to break it" href="/lab" />
      </Section>

      <Section title="Account" index={5}>
        <LinkRow title="Edit profile" href="/onboarding/profile" />
        <LinkRow title="Sign in" href="/login" />
        <SignOutRow />
        <LinkRow title="Replay the welcome" href="/welcome" />
      </Section>

      <Reveal index={6}>
        <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.small, textAlign: 'center' }}>
          Commit. Built at PlutoHacks XI by Juan, Niki and Shahd.
        </Text>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  me: { flexDirection: 'row', alignItems: 'center', gap: space.l, padding: space.l, borderRadius: radius.hero },
  section: { gap: space.s, marginTop: space.s },
  group: { borderRadius: radius.card, paddingVertical: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.m, paddingHorizontal: space.l, minHeight: 56 },
  rowText: { flex: 1, gap: 2 },
  pad: { padding: space.m },
});
