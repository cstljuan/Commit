import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Hachi, type HachiHandle, type HachiState } from '@/components/Hachi/Hachi';
import { Segmented } from '@/components/motion/Controls';
import { PressScale } from '@/components/motion/PressScale';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/nav/Screen';
import { usePrefs, type Prefs } from '@/lib/prefs';
import { useMode } from '@/lib/theme';
import { radius, space, type } from '@/lib/tokens';

const ONE_SHOTS: HachiState[] = ['happy', 'wink', 'wave', 'success', 'found', 'surprise', 'confused', 'warning', 'blocked', 'failure', 'error', 'ink', 'dizzy', 'wake'];
const HOLDS: HachiState[] = ['idle', 'thinking', 'waiting', 'talk', 'bored', 'sleep', 'verified', 'guard', 'broken'];

const ACCESSORIES: { value: Prefs['hachiAccessory']; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'band', label: 'Band' },
  { value: 'bow', label: 'Bow' },
  { value: 'party', label: 'Party' },
];

function Chips({ names, onPick }: { names: HachiState[]; onPick: (n: HachiState) => void }) {
  const { t } = useMode();
  return (
    <View style={styles.chips}>
      {names.map((n) => (
        <PressScale key={n} accessibilityLabel={n} onPress={() => onPick(n)} style={[styles.chip, { backgroundColor: `${t.primary}1A` }]}>
          <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: type.small }}>{n}</Text>
        </PressScale>
      ))}
    </View>
  );
}

/** Hachi's room. Everything Hachi can do, the way Seams had its Arc preview on the settings page. */
export default function HachiScreen() {
  const { t } = useMode();
  const { prefs, setPref } = usePrefs();
  const ref = useRef<HachiHandle>(null);
  return (
    <Screen title="Meet Hachi">
      <Reveal style={[styles.stage, { backgroundColor: t.surface }]}>
        <View testID="hachi-stage" style={styles.stageInner}>
          <Hachi ref={ref} size={200} animated interactive sleepAfter={0} />
        </View>
        <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.small, textAlign: 'center' }}>
          Tap Hachi. Hold to squeeze. Drag the body. Grab an arm and let go. Tap five times fast.
        </Text>
      </Reveal>
      <Reveal index={1} style={styles.block}>
        <Text style={{ color: t.muted, fontFamily: t.fontBold, fontSize: type.small }}>Wear</Text>
        <Segmented options={ACCESSORIES} value={prefs.hachiAccessory} onChange={(v) => setPref('hachiAccessory', v)} />
      </Reveal>
      <Reveal index={2} style={styles.block}>
        <Text style={{ color: t.muted, fontFamily: t.fontBold, fontSize: type.small }}>Reactions</Text>
        <Chips names={ONE_SHOTS} onPick={(n) => ref.current?.play(n)} />
      </Reveal>
      <Reveal index={3} style={styles.block}>
        <Text style={{ color: t.muted, fontFamily: t.fontBold, fontSize: type.small }}>Moods that hold</Text>
        <Chips names={HOLDS} onPick={(n) => ref.current?.set(n)} />
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', padding: space.xl, gap: space.l, borderRadius: radius.hero, marginTop: space.s },
  stageInner: { paddingVertical: space.xl, paddingHorizontal: space.huge },
  block: { gap: space.s, marginTop: space.s },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  chip: { paddingVertical: space.s, paddingHorizontal: space.m, borderRadius: radius.full },
});
