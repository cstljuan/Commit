import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SwipeCard } from '@/components/deck/SwipeCard';
import { Tako } from '@/components/Tako/Tako';
import { copy } from '@/lib/copy';
import { useMode, type Mode } from '@/lib/theme';

const MODES: Mode[] = ['normal', 'women', 'hack'];

export default function SwipeScreen() {
  const { mode, setMode, t, copy: words } = useMode();
  const { top } = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: t.bg, paddingTop: top + 12 }]}>
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
      <SwipeCard />
      <View style={styles.bottom}>
        <Tako size={72} state="happy" />
        <Text style={{ color: t.like, fontFamily: t.fontDisplay, fontSize: 22 }}>{words.stampRight}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20, gap: 20, alignItems: 'center' },
  switcher: { flexDirection: 'row', borderRadius: 999, padding: 4, gap: 4 },
  chip: { paddingVertical: 10, paddingHorizontal: 22, borderRadius: 999 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 16 },
});
