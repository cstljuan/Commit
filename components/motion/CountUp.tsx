import { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

type Props = {
  to: number;
  durationMs?: number;
  delayMs?: number;
  decimals?: number;
  suffix?: string;
  style?: StyleProp<TextStyle>;
  onDone?: () => void;
};

/** Counts up to the real number, easing out so it lands with weight. */
export function CountUp({ to, durationMs = 900, delayMs = 0, decimals = 0, suffix = '', style, onDone }: Props) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? to : 0);

  useEffect(() => {
    if (reduced) {
      setValue(to);
      onDone?.();
      return;
    }
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / durationMs);
      setValue(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
      else onDone?.();
    };
    const wait = setTimeout(() => {
      frame = requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      clearTimeout(wait);
      cancelAnimationFrame(frame);
    };
    // Runs again only if the number itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to]);

  return (
    <Text accessibilityLabel={`${to}${suffix}`} style={style}>
      {value.toFixed(decimals)}
      {suffix}
    </Text>
  );
}
