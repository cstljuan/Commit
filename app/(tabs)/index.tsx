import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Card, Direction, Role } from '@/components/deck/cardTypes';
import { sampleDecks, sampleInterested, sampleMatches } from '@/components/deck/sampleCards';
import { SwipeDeck } from '@/components/deck/SwipeDeck';
import { MatchMoment, type MatchInfo } from '@/components/match/MatchMoment';
import { ModeBackdrop } from '@/components/motion/ModeBackdrop';
import { useModeFlip } from '@/components/motion/ModeWipe';
import { PressScale } from '@/components/motion/PressScale';
import { Tako, type TakoState } from '@/components/Tako/Tako';
import { copy } from '@/lib/copy';
import { useMode, type Mode } from '@/lib/theme';

const MODES: Mode[] = ['normal', 'women', 'hack'];

export default function SwipeScreen() {
  const { mode, t } = useMode();
  const flip = useModeFlip();
  const { top } = useSafeAreaInsets();
  const [mood, setMood] = useState<TakoState>('idle');
  const [match, setMatch] = useState<MatchInfo | null>(null);

  // Replaced by swipe() from lib/api.ts, which returns { matched, match }.
  const onSwipe = (card: Card, direction: Direction, role?: Role) => {
    if (direction === 'left' || !sampleMatches.has(card.id)) return;
    setMatch({
      id: card.id,
      role: role ?? (card.kind === 'person' ? card.role : (card.roles[0]?.role ?? 'Builder')),
      otherUsername: card.kind === 'person' ? card.username : card.ownerUsername,
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: t.bg, paddingTop: top + 8 }]}>
      <ModeBackdrop />
      <View style={styles.header}>
        <View style={[styles.switcher, { backgroundColor: t.surface }]}>
          {MODES.map((m) => {
            const on = m === mode;
            return (
              <Pressable
                key={m}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={(e) => flip(m, e.nativeEvent.pageX, e.nativeEvent.pageY)}
                style={[styles.chip, on && { backgroundColor: t.primary }]}>
                <Text style={{ color: on ? t.onPrimary : t.muted, fontFamily: t.fontBold, fontSize: 15 }}>
                  {copy[m].label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Tako size={38} state={mood} animated />
      </View>
      <PressScale
        onPress={() => router.push('/likes')}
        style={[styles.interested, { backgroundColor: t.primary + '1F' }]}>
        <Text style={{ color: t.primary, fontFamily: t.fontBold, fontSize: 14 }}>
          {sampleInterested.length} builders want in
        </Text>
      </PressScale>
      {/* A new mode is a new deck, so the key resets its position. */}
      <SwipeDeck key={mode} cards={sampleDecks[mode]} onMood={setMood} onSwipe={onSwipe} />
      {match ? (
        <MatchMoment
          match={match}
          onSayHi={() => {
            setMatch(null);
            router.push(`/chat/${match.id}`);
          }}
          onCommit={() => setMatch(null)}
          onDismiss={() => setMatch(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  switcher: { flexDirection: 'row', borderRadius: 999, padding: 4, gap: 2 },
  chip: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999 },
  interested: { alignSelf: 'center', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
});
