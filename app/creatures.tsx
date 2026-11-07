import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { COLOURS, critterFor, SPECIES, type Species } from '@/components/critters/identity';
import { Critter, useCritterHop } from '@/components/critters/Critter';
import { HashChip } from '@/components/motion/HashChip';
import { PressScale } from '@/components/motion/PressScale';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/nav/Screen';
import { Hachi } from '@/components/Hachi/Hachi';
import * as Haptics from '@/lib/haptics';
import { useMode } from '@/lib/theme';
import { radius, space, type } from '@/lib/tokens';

function Tile({ species, index }: { species: Species; index: number }) {
  const { t } = useMode();
  const { style, fire } = useCritterHop();
  return (
    <Reveal index={index} style={styles.tileSlot}>
      <PressScale
        accessibilityLabel={species}
        haptic={false}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          fire();
        }}
        style={[styles.tile, { backgroundColor: t.surface }]}>
        <Animated.View style={style}>
          <Critter seed={species} species={species} colour={COLOURS[index % COLOURS.length].hex} size={72} animated disc={false} />
        </Animated.View>
        <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: type.small }}>{species[0].toUpperCase() + species.slice(1)}</Text>
      </PressScale>
    </Reveal>
  );
}

/** Type anything and watch the creature change: the same text always gives the same one. */
export default function CreaturesScreen() {
  const { t } = useMode();
  const [seed, setSeed] = useState('your name');
  const id = critterFor(seed || ' ');
  return (
    <Screen title="The creatures">
      <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.body, lineHeight: 22 }}>
        Nobody has a photo here. Your creature and colour come from your key, so the same key always gives the same creature.
      </Text>

      <View style={[styles.lab, { backgroundColor: `${id.colour}1F` }]}>
        <Animated.View key={id.name} entering={ZoomIn.springify().damping(11).stiffness(240)}>
          <Critter seed={seed || ' '} size={132} animated disc={false} />
        </Animated.View>
        <Text style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: type.title }}>{id.name}</Text>
        <HashChip hash={id.fingerprint} label="key" center />
        <TextInput
          accessibilityLabel="Type anything to see its creature"
          value={seed}
          onChangeText={setSeed}
          autoCorrect={false}
          autoCapitalize="none"
          placeholder="Type anything"
          placeholderTextColor={t.muted}
          style={[styles.input, { color: t.text, backgroundColor: t.surface, fontFamily: t.fontBody }]}
        />
      </View>

      <View style={[styles.tako, { backgroundColor: t.surface }]}>
        <Hachi size={72} animated interactive />
        <View style={styles.takoText}>
          <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: type.lead }}>Hachi is the only octopus</Text>
          <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.small }}>Nobody can roll one. Hachi runs the place.</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {SPECIES.map((s, i) => (
          <Tile key={s} species={s} index={i} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lab: { alignItems: 'center', gap: space.m, padding: space.xl, borderRadius: radius.hero, marginTop: space.s },
  input: { alignSelf: 'stretch', height: 48, borderRadius: radius.control, paddingHorizontal: space.l, fontSize: type.body, textAlign: 'center' },
  tako: { flexDirection: 'row', alignItems: 'center', gap: space.l, padding: space.l, borderRadius: radius.card },
  takoText: { flex: 1, gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, justifyContent: 'space-between' },
  tileSlot: { width: '48.5%' },
  tile: { alignItems: 'center', gap: space.s, padding: space.l, borderRadius: radius.card },
});
