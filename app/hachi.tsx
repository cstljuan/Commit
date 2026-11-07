import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Hachi, type HachiGesture, type HachiHandle, type HachiState } from '@/components/Hachi/Hachi';
import { Segmented } from '@/components/motion/Controls';
import { PressScale } from '@/components/motion/PressScale';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/nav/Screen';
import { usePrefs, type Prefs } from '@/lib/prefs';
import { useMascotName } from '@/lib/mascot';
import { useMode } from '@/lib/theme';
import { radius, space, type } from '@/lib/tokens';

const ONE_SHOTS: HachiState[] = ['purr', 'giggle', 'flip', 'jump', 'poke', 'bonk', 'happy', 'wink', 'wave', 'success', 'found', 'surprise', 'confused', 'warning', 'blocked', 'failure', 'error', 'ink', 'dizzy', 'wake'];
const HOLDS: HachiState[] = ['idle', 'thinking', 'waiting', 'talk', 'bored', 'sleep', 'verified', 'guard', 'broken'];

const TRICKS: { id: HachiGesture; label: string }[] = [
  { id: 'tap', label: 'Tap' },
  { id: 'double', label: 'Double tap' },
  { id: 'poke', label: 'Poke an eye' },
  { id: 'bonk', label: 'Bonk the head' },
  { id: 'arm', label: 'Pull an arm' },
  { id: 'tug', label: 'Tug the bow or knot' },
  { id: 'drag', label: 'Drag the body' },
  { id: 'fling', label: 'Fling upward' },
  { id: 'pet', label: 'Pet slowly' },
  { id: 'tickle', label: 'Tickle fast' },
  { id: 'hold', label: 'Squeeze' },
  { id: 'overhold', label: 'Squeeze too long' },
  { id: 'dizzy', label: 'Tap five times' },
];

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
  const name = useMascotName();
  const { prefs, setPref } = usePrefs();
  const ref = useRef<HachiHandle>(null);
  const [found, setFound] = useState<HachiGesture[]>([]);
  const onGesture = (g: HachiGesture) =>
    setFound((list) => {
      if (list.includes(g)) return list;
      const next = [...list, g];
      if (next.length === TRICKS.length) setTimeout(() => ref.current?.play('success'), 900);
      return next;
    });
  return (
    <Screen title={`Meet ${name}`}>
      <Reveal style={[styles.stage, { backgroundColor: t.surface }]}>
        <View testID="hachi-stage" style={styles.stageInner}>
          <Hachi ref={ref} size={200} animated sleepAfter={0} onGesture={onGesture} />
        </View>
        <View style={styles.tricksHead}>
          <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: type.body }}>
            {found.length === TRICKS.length ? 'You found every trick' : 'Find every trick'}
          </Text>
          <Text style={{ color: t.primary, fontFamily: 'JetBrainsMono_700Bold', fontSize: type.body }}>
            {found.length}/{TRICKS.length}
          </Text>
        </View>
        <View style={styles.chips}>
          {TRICKS.map((trick) => {
            const on = found.includes(trick.id);
            return (
              <View key={trick.id} style={[styles.trick, { backgroundColor: on ? t.primary : `${t.primary}14` }]}>
                <Text style={{ color: on ? t.onPrimary : t.muted, fontFamily: t.fontBold, fontSize: 12 }}>{trick.label}</Text>
              </View>
            );
          })}
        </View>
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
  tricksHead: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trick: { paddingVertical: 5, paddingHorizontal: space.s + 2, borderRadius: radius.full },
  block: { gap: space.s, marginTop: space.s },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  chip: { paddingVertical: space.s, paddingHorizontal: space.m, borderRadius: radius.full },
});
