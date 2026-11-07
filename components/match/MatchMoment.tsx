import * as Haptics from '@/lib/haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ParticleField } from '@/components/motion/Particles';
import { Critter } from '@/components/critters/Critter';
import { Tako } from '@/components/Tako/Tako';
import { useMode } from '@/lib/theme';
import { useMotionOff } from '@/lib/prefs';

export type MatchInfo = {
  id: string;
  role: string;
  otherUsername: string;
};

type Props = {
  match: MatchInfo;
  onSayHi: () => void;
  onCommit: () => void;
  onDismiss: () => void;
};

const AVATAR = 96;
/** Everything has landed by this point, so the whole moment stays under 1.5 s. */
const TOTAL_MS = 1300;

function Avatar({ seed, bg, fg }: { seed: string; bg: string; fg: string }) {
  return (
    <View style={[styles.avatar, { backgroundColor: bg, borderColor: fg }]}>
      <Critter seed={seed} size={AVATAR - 12} animated disc={false} />
    </View>
  );
}

/** Tap anywhere during the animation to skip to the buttons. It never blocks them. */
export function MatchMoment({ match, onSayHi, onCommit, onDismiss }: Props) {
  const { t, mode, copy } = useMode();
  const { width } = useWindowDimensions();
  const reduced = useMotionOff();
  const [settled, setSettled] = useState(false);

  const start = width / 2 + AVATAR;
  const fly = useSharedValue(reduced ? 1 : 0);
  const burst = useSharedValue(0);
  const pop = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      setSettled(true);
      return;
    }
    fly.value = withSpring(1, { damping: 14, stiffness: 170 });
    pop.value = withDelay(260, withSpring(1, { damping: 11, stiffness: 190 }));
    burst.value = withDelay(260, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const second = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 260);
    const third = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 420);
    const done = setTimeout(() => setSettled(true), TOTAL_MS);
    return () => {
      clearTimeout(second);
      clearTimeout(third);
      clearTimeout(done);
    };
    // Plays once, when the match appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => {
    fly.value = 1;
    pop.value = 1;
    burst.value = 1;
    setSettled(true);
  };

  const left = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(fly.value, [0, 1], [-start, -AVATAR * 0.62]) },
      { rotate: `${interpolate(fly.value, [0, 1], [-25, -6])}deg` },
    ],
  }));
  const right = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(fly.value, [0, 1], [start, AVATAR * 0.62]) },
      { rotate: `${interpolate(fly.value, [0, 1], [25, 6])}deg` },
    ],
  }));
  const takoStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }], opacity: pop.value }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: interpolate(pop.value, [0, 1], [0.6, 1]) }],
  }));

  const onBg = t.onPrimary;
  const ink = mode === 'women' ? '#FFFFFF' : mode === 'hack' ? t.bg : t.accent;

  return (
    <Animated.View
      entering={FadeIn.duration(120)}
      exiting={FadeOut.duration(160)}
      accessibilityViewIsModal
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: t.primary }]}>
      <Pressable accessibilityLabel="Skip animation" style={StyleSheet.absoluteFill} onPress={settled ? onDismiss : skip} />

      <View pointerEvents="none" style={styles.center}>
        <Animated.View style={takoStyle}>
          <Tako size={92} state="happy" color={onBg} />
        </Animated.View>

        <View style={styles.pair}>
          <ParticleField burst={burst} color={ink} reach={240} />
          <Animated.View style={[styles.avatarSlot, left]}>
            <Avatar seed="you" bg={t.surface} fg={t.primary} />
          </Animated.View>
          <Animated.View style={[styles.avatarSlot, right]}>
            <Avatar seed={match.otherUsername} bg={t.surface} fg={t.primary} />
          </Animated.View>
        </View>

        <Animated.View style={[styles.words, titleStyle]}>
          <Text style={{ color: onBg, fontFamily: t.fontDisplay, fontSize: 44, textAlign: 'center' }}>{copy.match}</Text>
          <Text style={{ color: onBg, fontFamily: t.fontBold, fontSize: 17, textAlign: 'center' }}>
            You and @{match.otherUsername}, {match.role}
          </Text>
        </Animated.View>
      </View>

      <View style={styles.buttons}>
        <Pressable
          accessibilityRole="button"
          onPress={onSayHi}
          style={[styles.primary, { backgroundColor: t.surface }]}>
          <Text style={{ color: t.primary, fontFamily: t.fontBold, fontSize: 18 }}>Say hi</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onCommit}
          style={[styles.secondary, { borderColor: onBg }]}>
          <Text style={{ color: onBg, fontFamily: t.fontBold, fontSize: 18 }}>Commit</Text>
        </Pressable>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={onDismiss}>
          <Text style={{ color: onBg, fontFamily: t.fontBody, fontSize: 15 }}>Keep swiping</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'space-between', paddingTop: 80, paddingBottom: 48, zIndex: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
  pair: { height: AVATAR + 8, width: '100%', alignItems: 'center', justifyContent: 'center' },
  avatarSlot: { position: 'absolute' },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: { gap: 8, paddingHorizontal: 24 },
  buttons: { width: '100%', paddingHorizontal: 24, gap: 12, alignItems: 'center' },
  primary: { width: '100%', height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  secondary: {
    width: '100%',
    height: 56,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
