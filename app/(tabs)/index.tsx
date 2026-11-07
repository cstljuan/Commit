import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sampleDecks } from '@/components/deck/sampleCards';
import { SwipeDeck } from '@/components/deck/SwipeDeck';
import { Tako, type TakoState } from '@/components/Tako/Tako';
import { copy } from '@/lib/copy';
import { useMode, type Mode } from '@/lib/theme';

const MODES: Mode[] = ['normal', 'women', 'hack'];

export default function SwipeScreen() {
  const { mode, setMode, t } = useMode();
  const { top } = useSafeAreaInsets();
  const [mood, setMood] = useState<TakoState>('idle');

  return (
    <View style={[styles.root, { backgroundColor: t.bg, paddingTop: top + 8 }]}>
      <View style={styles.header}>
        <View style={[styles.switcher, { backgroundColor: t.surface }]}>
          {MODES.map((m) => {
            const on = m === mode;
            return (
              <Pressable
                key={m}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setMode(m)}
                style={[styles.chip, on && { backgroundColor: t.primary }]}>
                <Text style={{ color: on ? t.onPrimary : t.muted, fontFamily: t.fontBold, fontSize: 15 }}>
                  {copy[m].label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Tako size={38} state={mood} />
      </View>
      {/* A new mode is a new deck, so the key resets its position. */}
      <SwipeDeck key={mode} cards={sampleDecks[mode]} onMood={setMood} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  switcher: { flexDirection: 'row', borderRadius: 999, padding: 4, gap: 2 },
  chip: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999 },
});
