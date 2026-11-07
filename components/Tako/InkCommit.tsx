import * as Haptics from '@/lib/haptics';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useMode } from '@/lib/theme';
import { useMotionOff } from '@/lib/prefs';

import { Tako } from './Tako';

const GLYPHS = '0123456789abcdef';
const scramble = (text: string, seed: number) =>
  text
    .slice(0, 90)
    .split('')
    .map((c, i) => (c === ' ' ? ' ' : GLYPHS[(c.charCodeAt(0) * 7 + i * 13 + seed) % GLYPHS.length]))
    .join('');

type Props = {
  /** The idea text. It visibly turns into ciphertext glyphs. Never sent anywhere from here. */
  text: string;
  /** The real commit hash, from postIdea. */
  commitHash: string;
  onDone: () => void;
};

/**
 * Tako inks the idea: the text dissolves into glyphs, then the commit hash lands.
 * The glyphs are decoration, not the real ciphertext. Under 1.2 s, tap to skip.
 */
export function InkCommit({ text, commitHash, onDone }: Props) {
  const { t } = useMode();
  const reduced = useMotionOff();
  const [seed, setSeed] = useState(0);
  const [settled, setSettled] = useState(false);
  const ink = useSharedValue(reduced ? 1 : 0);
  const fade = useSharedValue(reduced ? 1 : 0);

  const glyphs = useMemo(() => scramble(text, seed), [text, seed]);

  useEffect(() => {
    if (reduced) {
      setSettled(true);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    ink.value = withTiming(1, { duration: 700 });
    fade.value = withDelay(120, withTiming(1, { duration: 500 }));
    const tick = setInterval(() => setSeed((s) => s + 1), 70);
    const stop = setTimeout(() => {
      clearInterval(tick);
      setSettled(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 800);
    return () => {
      clearInterval(tick);
      clearTimeout(stop);
    };
    // Plays once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cloudA = useAnimatedStyle(() => ({
    opacity: interpolate(ink.value, [0, 0.3, 1], [0, 0.32, 0.16]),
    transform: [{ scale: interpolate(ink.value, [0, 1], [0.1, 1]) }],
  }));
  const cloudB = useAnimatedStyle(() => ({
    opacity: interpolate(ink.value, [0, 0.4, 1], [0, 0.24, 0.1]),
    transform: [{ translateX: -50 }, { translateY: 30 }, { scale: interpolate(ink.value, [0, 1], [0.1, 0.8]) }],
  }));
  const cloudC = useAnimatedStyle(() => ({
    opacity: interpolate(ink.value, [0, 0.4, 1], [0, 0.24, 0.1]),
    transform: [{ translateX: 60 }, { translateY: 44 }, { scale: interpolate(ink.value, [0, 1], [0.1, 0.65]) }],
  }));
  const plain = useAnimatedStyle(() => ({ opacity: 1 - fade.value }));
  const cipher = useAnimatedStyle(() => ({ opacity: fade.value }));

  const finish = () => {
    if (settled) {
      onDone();
      return;
    }
    ink.value = 1;
    fade.value = 1;
    setSettled(true);
  };

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Continue" onPress={finish} style={[styles.root, { backgroundColor: t.bg }]}>
      <View style={styles.takoWrap}>
        <Animated.View style={[styles.cloud, { backgroundColor: t.primary }, cloudA]} />
        <Animated.View style={[styles.cloud, { backgroundColor: t.primary }, cloudB]} />
        <Animated.View style={[styles.cloud, { backgroundColor: t.primary }, cloudC]} />
        <Tako size={120} state="ink" animated />
      </View>

      <View style={styles.textBox}>
        <Animated.Text numberOfLines={4} style={[styles.textLayer, { color: t.text, fontFamily: t.fontBody }, plain]}>
          {text}
        </Animated.Text>
        <Animated.Text numberOfLines={4} style={[styles.textLayer, styles.mono, { color: t.muted }, cipher]}>
          {glyphs}
        </Animated.Text>
      </View>

      {settled ? (
        <Animated.View entering={FadeIn.duration(180)} style={styles.hashBlock}>
          <Text style={{ color: t.muted, fontFamily: t.fontBold, fontSize: 14 }}>Your commit hash</Text>
          <Text style={[styles.mono, { color: t.primary, fontSize: 32, fontWeight: '700' }]}>{commitHash.slice(0, 7)}</Text>
          <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 15 }}>Tap to continue</Text>
        </Animated.View>
      ) : (
        <View style={styles.hashBlock} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 28, padding: 24, zIndex: 10 },
  takoWrap: { alignItems: 'center', justifyContent: 'center', minHeight: 180 },
  cloud: { position: 'absolute', width: 240, height: 240, borderRadius: 120 },
  textBox: { width: '100%', minHeight: 110 },
  textLayer: { position: 'absolute', width: '100%', fontSize: 18, lineHeight: 26, textAlign: 'center' },
  mono: { fontFamily: 'JetBrainsMono_400Regular' },
  hashBlock: { alignItems: 'center', gap: 6, minHeight: 92 },
});
