import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useMode } from '@/lib/theme';
import { radius, space, type } from '@/lib/tokens';

/** A command that types itself over the deck, then leaves. Hack mode's own swipe reward. */
export function TypedLine({ text, fire }: { text: string; fire: number }) {
  const { t } = useMode();
  const [shown, setShown] = useState(0);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!fire) return;
    setLive(true);
    setShown(0);
    const typing = setInterval(() => setShown((n) => n + 1), 24);
    const leave = setTimeout(() => {
      clearInterval(typing);
      setLive(false);
    }, 1100);
    return () => {
      clearInterval(typing);
      clearTimeout(leave);
    };
  }, [fire]);

  if (!live) return null;
  return (
    <Animated.View pointerEvents="none" entering={FadeIn.duration(80)} exiting={FadeOut.duration(160)} style={[styles.line, { backgroundColor: t.bg, borderColor: t.primary }]}>
      <Text numberOfLines={1} style={{ color: t.primary, fontFamily: 'JetBrainsMono_700Bold', fontSize: type.small }}>
        {text.slice(0, shown)}
        {shown < text.length ? '_' : ''}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  line: { position: 'absolute', left: space.l, right: space.l, bottom: space.l, padding: space.m, borderRadius: radius.s },
});
