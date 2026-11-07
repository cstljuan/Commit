import { sfx } from '@/lib/sound';
import * as Haptics from '@/lib/haptics';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { copy } from '@/lib/copy';
import { themes, useMode, type Mode } from '@/lib/theme';
import { useMotionOff } from '@/lib/prefs';

type Flip = (mode: Mode, x: number, y: number) => void;
const FlipContext = createContext<Flip>(() => {});

/** Switch modes with a color wipe from where the finger is. */
export const useModeFlip = () => useContext(FlipContext);

type Wipe = { mode: Mode; x: number; y: number };

/**
 * The new mode pours out of the tapped chip and fills the screen, its name stamps in, and
 * the app is already that color underneath when it clears. Under 700 ms, and it never
 * blocks touches.
 */
export function ModeWipeProvider({ children }: { children: ReactNode }) {
  const { mode, setMode } = useMode();
  const { width, height } = useWindowDimensions();
  const reduced = useMotionOff();
  const [wipe, setWipe] = useState<Wipe | null>(null);
  const grow = useSharedValue(0);
  const fade = useSharedValue(1);

  const size = Math.hypot(width, height) * 2;

  const clear = useCallback(() => setWipe(null), []);
  const swap = useCallback(
    (next: Mode) => {
      setMode(next);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    },
    [setMode],
  );

  const flip = useCallback<Flip>(
    (next, x, y) => {
      if (next === mode) return;
      Haptics.selectionAsync();
      sfx('mode');
      if (reduced) {
        setMode(next);
        return;
      }
      setWipe({ mode: next, x, y });
      grow.value = 0;
      fade.value = 1;
      grow.value = withTiming(1, { duration: 340, easing: Easing.bezier(0.3, 0, 0.2, 1) }, (done) => {
        if (done) scheduleOnRN(swap, next);
      });
      fade.value = withDelay(460, withTiming(0, { duration: 200 }, (done) => {
        if (done) scheduleOnRN(clear);
      }));
    },
    [clear, fade, grow, mode, reduced, setMode, swap],
  );

  const circle = useAnimatedStyle(() => ({ transform: [{ scale: grow.value }] }));
  const layer = useAnimatedStyle(() => ({ opacity: fade.value }));
  const stamp = useAnimatedStyle(() => ({
    opacity: interpolate(grow.value, [0.45, 0.8], [0, 1], 'clamp'),
    transform: [
      { scale: interpolate(grow.value, [0.45, 0.85, 1], [1.8, 0.96, 1], 'clamp') },
      { rotate: wipe?.mode === 'hack' ? '0deg' : '-5deg' },
    ],
  }));

  const target = wipe ? themes[wipe.mode] : null;

  return (
    <FlipContext.Provider value={flip}>
      {children}
      {wipe && target ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip, layer]}>
          <Animated.View
            style={[
              styles.circle,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                left: wipe.x - size / 2,
                top: wipe.y - size / 2,
                backgroundColor: target.bg,
              },
              circle,
            ]}
          />
          <View style={styles.center}>
            <Animated.View style={stamp}>
              <Text style={{ color: target.primary, fontFamily: target.fontDisplay, fontSize: 64 }}>
                {wipe.mode === 'hack' ? '$ hack' : copy[wipe.mode].label}
              </Text>
            </Animated.View>
          </View>
        </Animated.View>
      ) : null}
    </FlipContext.Provider>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', zIndex: 50 },
  circle: { position: 'absolute' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
