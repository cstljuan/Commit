import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  FadeInDown,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { SWIPE } from '@/lib/motion';
import { useMode } from '@/lib/theme';

import type { Card, Direction } from './cardTypes';
import { SwipeCard } from './SwipeCard';

export type Zone = 'none' | 'right' | 'left' | 'up';
export type DeckCardHandle = { fling: (dir: Direction) => void };

type Props = {
  card: Card;
  active: boolean;
  /** Set when this card is coming back from an undo. */
  enterFrom: Direction | null;
  /** 0 at rest, 1 when the top card has crossed its threshold. Scales the card behind. */
  progress: SharedValue<number>;
  canSuper: boolean;
  onCommit: (dir: Direction) => void;
  onZone: (zone: Zone) => void;
  onBlockedSuper: () => void;
  /** Set on the deck's first render, so the cards deal in one after another. */
  dealDelay?: number;
};

export const DeckCard = forwardRef<DeckCardHandle, Props>(function DeckCard(
  { card, active, enterFrom, progress, canSuper, onCommit, onZone, onBlockedSuper, dealDelay },
  ref,
) {
  const { width: W, height: H } = useWindowDimensions();
  const { copy, t } = useMode();
  const reduced = useReducedMotion();

  const offX = W * 1.4;
  const offY = H * 1.2;
  const x = useSharedValue(enterFrom === 'right' ? offX : enterFrom === 'left' ? -offX : 0);
  const y = useSharedValue(enterFrom === 'super' ? -offY : 0);
  const zone = useSharedValue<Zone>('none');

  const thresholdX = W * SWIPE.thresholdX;
  const thresholdY = H * SWIPE.thresholdY;
  const flyMs = reduced ? 1 : SWIPE.flyMs;

  useEffect(() => {
    if (!enterFrom) return;
    x.value = withSpring(0, SWIPE.spring);
    y.value = withSpring(0, SWIPE.spring);
    // Only on mount: an undone card flies back once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fly = (dir: Direction) => {
    'worklet';
    const done = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(onCommit, dir);
    };
    progress.value = withTiming(1, { duration: flyMs });
    if (dir === 'super') {
      y.value = withTiming(-offY, { duration: flyMs }, done);
    } else {
      x.value = withTiming(dir === 'right' ? offX : -offX, { duration: flyMs }, done);
    }
  };

  const settle = () => {
    'worklet';
    x.value = withSpring(0, SWIPE.spring);
    y.value = withSpring(0, SWIPE.spring);
    progress.value = withSpring(0, SWIPE.spring);
    if (zone.value !== 'none') {
      zone.value = 'none';
      scheduleOnRN(onZone, 'none');
    }
  };

  useImperativeHandle(ref, () => ({ fling: (dir) => fly(dir) }));

  const pan = usePanGesture({
    enabled: active,
    onUpdate: (e) => {
      'worklet';
      x.value = e.translationX;
      y.value = e.translationY;
      const up = Math.max(0, -e.translationY);
      const px = Math.abs(e.translationX) / thresholdX;
      const py = up / thresholdY;
      progress.value = Math.min(1, Math.max(px, py));
      const next: Zone = py >= 1 && py > px ? 'up' : px >= 1 ? (e.translationX > 0 ? 'right' : 'left') : 'none';
      if (next !== zone.value) {
        zone.value = next;
        scheduleOnRN(onZone, next);
      }
    },
    onDeactivate: (e) => {
      'worklet';
      const fastX = Math.abs(e.velocityX) > SWIPE.flickVelocity && Math.abs(e.velocityX) > Math.abs(e.velocityY);
      const fastUp = e.velocityY < -SWIPE.flickVelocity && Math.abs(e.velocityY) > Math.abs(e.velocityX);
      const wantsUp = zone.value === 'up' || fastUp;
      if (wantsUp) {
        if (canSuper) {
          fly('super');
        } else {
          settle();
          scheduleOnRN(onBlockedSuper);
        }
      } else if (zone.value === 'right' || zone.value === 'left' || fastX) {
        fly(x.value > 0 ? 'right' : 'left');
      } else {
        settle();
      }
    },
  });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = reduced
      ? 0
      : interpolate(x.value, [-W, 0, W], [-SWIPE.maxRotateDeg, 0, SWIPE.maxRotateDeg], Extrapolation.CLAMP);
    const scale = active ? 1 : interpolate(progress.value, [0, 1], [SWIPE.nextScale, 1], Extrapolation.CLAMP);
    return {
      transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${rotate}deg` }, { scale }],
    };
  });

  const start = W * SWIPE.stampStart;
  const rightStamp = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [start, thresholdX], [0, 1], Extrapolation.CLAMP),
  }));
  const leftStamp = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-thresholdX, -start], [1, 0], Extrapolation.CLAMP),
  }));
  const upStamp = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [-thresholdY, -H * SWIPE.stampStart], [1, 0], Extrapolation.CLAMP),
  }));

  const stampText = { fontFamily: t.fontDisplay, fontSize: 26 };

  return (
    <Animated.View
      style={StyleSheet.absoluteFill}
      entering={dealDelay === undefined ? undefined : FadeInDown.delay(dealDelay).springify().damping(15).stiffness(150)}>
    <GestureDetector gesture={pan}>
      <Animated.View style={[StyleSheet.absoluteFill, cardStyle]}>
        <SwipeCard card={card} />
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.stamp, styles.stampRight, { borderColor: t.like }, rightStamp]}>
            <Text style={[stampText, { color: t.like }]}>{'\u2665\uFE0E'} {copy.stampRight}</Text>
          </Animated.View>
          <Animated.View style={[styles.stamp, styles.stampLeft, { borderColor: t.pass }, leftStamp]}>
            <Text style={[stampText, { color: t.pass }]}>{'\u2715\uFE0E'} {copy.stampLeft}</Text>
          </Animated.View>
          <Animated.View style={[styles.stamp, styles.stampUp, { borderColor: t.primary }, upStamp]}>
            <Text style={[stampText, { color: t.primary }]}>{'\u2605\uFE0E'} {copy.stampUp}</Text>
          </Animated.View>
        </View>
      </Animated.View>
    </GestureDetector>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  stamp: {
    position: 'absolute',
    borderWidth: 4,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
  },
  stampRight: { top: 28, left: 20, transform: [{ rotate: '-10deg' }] },
  stampLeft: { top: 28, right: 20, transform: [{ rotate: '10deg' }] },
  stampUp: { bottom: 40, alignSelf: 'center' },
});
