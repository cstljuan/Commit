import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeOut, useReducedMotion } from 'react-native-reanimated';

import { Tako } from '@/components/Tako/Tako';
import { DecodeText } from '@/components/motion/DecodeText';
import { useMode } from '@/lib/theme';

const WORD = 'commit';
const TOTAL_MS = 1500;

/** Opens the app like a terminal command, once per launch, and any tap skips it. */
export function IntroSplash() {
  const { t } = useMode();
  const reduced = useReducedMotion();
  const [letters, setLetters] = useState(0);
  const [gone, setGone] = useState(!!reduced);

  useEffect(() => {
    if (reduced) return;
    const typing = setInterval(() => setLetters((n) => Math.min(WORD.length, n + 1)), 75);
    const done = setTimeout(() => setGone(true), TOTAL_MS);
    return () => {
      clearInterval(typing);
      clearTimeout(done);
    };
  }, [reduced]);

  if (gone) return null;
  return (
    <Animated.View exiting={FadeOut.duration(220)} style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: t.bg }]}>
      <Pressable accessibilityLabel="Skip intro" style={StyleSheet.absoluteFill} onPress={() => setGone(true)} />
      <View pointerEvents="none" style={styles.center}>
        <Tako size={84} state="happy" animated />
        <Text style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: 52 }}>
          {WORD.slice(0, letters)}
          <Text style={{ color: t.primary }}>{letters < WORD.length ? '_' : ''}</Text>
        </Text>
        <DecodeText
          text="find your team. keep your idea."
          delayMs={500}
          durationMs={600}
          style={{ color: t.muted, fontFamily: 'JetBrainsMono_400Regular', fontSize: 14 }}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
});
