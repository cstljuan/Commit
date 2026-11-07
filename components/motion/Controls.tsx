import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import * as Haptics from '@/lib/haptics';
import { GLIDE } from '@/lib/motion';
import { useMode } from '@/lib/theme';
import { radius, space, type } from '@/lib/tokens';

const W = 54;
const H = 32;
const KNOB = 26;

/** Our own switch: the knob stretches a little as it travels. */
export function Switch({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const { t } = useMode();
  const on = useSharedValue(value ? 1 : 0);
  const press = useSharedValue(0);
  useEffect(() => {
    on.value = withTiming(value ? 1 : 0, GLIDE);
  }, [on, value]);
  const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(on.value, [0, 1], [`${t.muted}55`, t.primary]) }));
  const knob = useAnimatedStyle(() => ({
    width: KNOB + press.value * 6,
    transform: [{ translateX: 3 + on.value * (W - KNOB - 6 - press.value * 6) }],
  }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      onPressIn={() => {
        press.value = withTiming(1, GLIDE);
      }}
      onPressOut={() => {
        press.value = withTiming(0, GLIDE);
      }}
      onPress={() => {
        Haptics.selectionAsync();
        onChange(!value);
      }}>
      <Animated.View style={[styles.track, track]}>
        <Animated.View style={[styles.knob, knob]} />
      </Animated.View>
    </Pressable>
  );
}

/** Segments with a highlight that slides between them. */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { t } = useMode();
  const [width, setWidth] = useState(0);
  const slot = (width - 8) / options.length;
  const x = useSharedValue(0);
  const index = options.findIndex((o) => o.value === value);
  useEffect(() => {
    if (width) x.value = withTiming(index * slot, GLIDE);
  }, [index, slot, width, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={[styles.segments, { backgroundColor: `${t.primary}14` }]}>
      {width ? <Animated.View style={[styles.segmentPill, { width: slot, backgroundColor: t.primary }, pill]} /> : null}
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="button"
          accessibilityState={{ selected: o.value === value }}
          style={styles.segment}
          onPress={() => {
            Haptics.selectionAsync();
            onChange(o.value);
          }}>
          <Text style={{ color: o.value === value ? t.onPrimary : t.text, fontFamily: t.fontBold, fontSize: type.small }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: W, height: H, borderRadius: H / 2, justifyContent: 'center' },
  knob: { height: KNOB, borderRadius: KNOB / 2, backgroundColor: '#FFFFFF' },
  segments: { flexDirection: 'row', height: 44, borderRadius: radius.control, padding: space.xs },
  segmentPill: { position: 'absolute', top: space.xs, bottom: space.xs, left: space.xs, borderRadius: radius.s },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
