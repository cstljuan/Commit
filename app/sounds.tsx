import { StyleSheet, Text, View } from 'react-native';

import { PressScale } from '@/components/motion/PressScale';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/nav/Screen';
import { sfx, type Sound } from '@/lib/sound';
import { useMode } from '@/lib/theme';
import { radius, space, type } from '@/lib/tokens';

const GROUPS: { title: string; note?: string; items: [Sound, string][] }[] = [
  {
    title: 'The big moments',
    note: 'These change voice with the mode, so try them in Normal, Women and Hack.',
    items: [['match', 'Match'], ['commit', 'Commit lands'], ['like', 'Like'], ['pass', 'Pass'], ['tap', 'Tap']],
  },
  {
    title: 'Around the app',
    items: [['super', 'Super Commit'], ['hold', 'Holding to commit'], ['undo', 'Undo'], ['mode', 'Switch mode'], ['ink', 'Ink'], ['msg_out', 'Send'], ['msg_in', 'Receive'], ['toggle', 'Toggle'], ['tick', 'Tick'], ['error', 'Error']],
  },
  {
    title: "Hachi's voice",
    items: [['h_happy', 'Happy'], ['h_wink', 'Wink'], ['h_poke', 'Poke'], ['h_bonk', 'Bonk'], ['h_giggle', 'Giggle'], ['h_purr', 'Purr'], ['h_jump', 'Jump'], ['h_flip', 'Flip'], ['h_dizzy', 'Dizzy'], ['h_sad', 'Sad'], ['h_wake', 'Wake'], ['h_squeeze', 'Squeeze']],
  },
];

/** Hear every sound in one place. */
export default function SoundsScreen() {
  const { t } = useMode();
  return (
    <Screen title="Sounds">
      {GROUPS.map((group, i) => (
        <Reveal key={group.title} index={i} style={styles.group}>
          <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: type.lead }}>{group.title}</Text>
          {group.note ? <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.small }}>{group.note}</Text> : null}
          <View style={styles.chips}>
            {group.items.map(([name, label]) => (
              <PressScale key={name} haptic={false} accessibilityLabel={`Play ${label}`} onPress={() => sfx(name)} style={[styles.chip, { backgroundColor: t.surface }]}>
                <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: type.small }}>{label}</Text>
              </PressScale>
            ))}
          </View>
        </Reveal>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.s, marginTop: space.m },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  chip: { paddingVertical: space.m, paddingHorizontal: space.l, borderRadius: radius.full },
});
