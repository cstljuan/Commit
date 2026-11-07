import { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { useMotionOff } from '@/lib/prefs';

const GLYPHS = '0123456789abcdef';

function scrambled(text: string, shown: number, tick: number) {
  return text
    .split('')
    .map((c, i) => (i < shown || c === ' ' ? c : GLYPHS[(c.charCodeAt(0) * 7 + i * 13 + tick * 11) % GLYPHS.length]))
    .join('');
}

type Props = {
  text: string;
  durationMs?: number;
  delayMs?: number;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  onDone?: () => void;
};

/** Text that decrypts itself, left to right. Screen readers always get the plain text. */
export function DecodeText({ text, durationMs = 800, delayMs = 0, style, numberOfLines, onDone }: Props) {
  const reduced = useMotionOff();
  const [shown, setShown] = useState(reduced ? text.length : 0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduced) {
      setShown(text.length);
      onDone?.();
      return;
    }
    setShown(0);
    let timer: ReturnType<typeof setInterval> | undefined;
    const wait = setTimeout(() => {
      const startedAt = Date.now();
      timer = setInterval(() => {
        const t = Math.min(1, (Date.now() - startedAt) / durationMs);
        setShown(Math.floor(text.length * t));
        setTick((n) => n + 1);
        if (t >= 1) {
          clearInterval(timer);
          onDone?.();
        }
      }, 45);
    }, delayMs);
    return () => {
      clearTimeout(wait);
      if (timer) clearInterval(timer);
    };
    // Runs again only if the text itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <Text accessibilityLabel={text} numberOfLines={numberOfLines} style={style}>
      {shown >= text.length ? text : scrambled(text, shown, tick)}
    </Text>
  );
}
