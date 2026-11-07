import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';

import { Hachi } from '@/components/Hachi/Hachi';
import { Wordmark } from '@/components/brand/Wordmark';
import { DecodeText } from '@/components/motion/DecodeText';
import { useMode } from '@/lib/theme';
import { useMotionOff } from '@/lib/prefs';

const TOTAL_MS = 1500;

/** Opens the app like a terminal command, once per launch, and any tap skips it. */
export function IntroSplash() {
  const { t } = useMode();
  const reduced = useMotionOff();
  const [gone, setGone] = useState(!!reduced);

  useEffect(() => {
    if (reduced) return;
    const done = setTimeout(() => setGone(true), TOTAL_MS);
    return () => {
      clearTimeout(done);
    };
  }, [reduced]);

  if (gone) return null;
  return (
    <Animated.View exiting={FadeOut.duration(220)} style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: t.bg }]}>
      <Pressable accessibilityLabel="Skip intro" style={StyleSheet.absoluteFill} onPress={() => setGone(true)} />
      <View pointerEvents="none" style={styles.center}>
        <Hachi size={110} state="wave" animated sleepAfter={0} />
        <Wordmark height={72} />
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
