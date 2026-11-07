import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import type { Card, Direction, Role } from '@/components/deck/cardTypes';
import { SwipeDeck } from '@/components/deck/SwipeDeck';
import { MatchMoment, type MatchInfo } from '@/components/match/MatchMoment';
import { ModeBackdrop } from '@/components/motion/ModeBackdrop';
import { useModeFlip } from '@/components/motion/ModeWipe';
import { PressScale } from '@/components/motion/PressScale';
import { useTabInset } from '@/components/nav/TabBar';
import { Hachi, type HachiState } from '@/components/Hachi/Hachi';
import { commitToMatch, getDeck, getInterested, superCommitsLeft, swipe, undoLastSwipe } from '@/lib/api';
import { rememberMatch } from '@/lib/chatbot';
import { copy } from '@/lib/copy';
import { filterCount, matchesFilters, useDeckFilters } from '@/lib/filters';
import { hachi } from '@/lib/hachi';
import { useMode, type Mode } from '@/lib/theme';

const MODES: Mode[] = ['normal', 'women', 'hack'];

export default function SwipeScreen() {
  const { mode, t } = useMode();
  const flip = useModeFlip();
  const { top } = useSafeAreaInsets();
  const inset = useTabInset();
  const [mood, setMood] = useState<HachiState>('idle');
  const [match, setMatch] = useState<MatchInfo | null>(null);

  const filters = useDeckFilters();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [wanting, setWanting] = useState(0);
  const [superLeft, setSuperLeft] = useState(1);
  const [version, setVersion] = useState(0);

  const load = useCallback(() => {
    setCards(null);
    setFailed(false);
    let live = true;
    Promise.all([getDeck(mode), superCommitsLeft()])
      .then(([deck, left]) => {
        if (!live) return;
        setCards(deck);
        setSuperLeft(left);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [mode]);

  // A new mode or new filters means a fresh deck without the cards already swiped.
  useEffect(() => load(), [load, filters]);
  useEffect(() => {
    getInterested()
      .then((r) => setWanting(r.count))
      .catch(() => setWanting(0));
  }, [mode]);

  const shown = useMemo(() => cards?.filter((c) => matchesFilters(c, filters)) ?? [], [cards, filters]);

  const onSwipe = (card: Card, direction: Direction, role?: Role) => {
    swipe(card, direction, role)
      .then((result) => {
        if (!result.matched || !result.match) return;
        rememberMatch(result.match.id, { role: result.match.role, project: result.match.projectTitle ?? (card.kind === 'project' ? card.title : 'your project') });
        setMatch({ id: result.match.id, role: result.match.role, otherUsername: result.match.otherUsername });
      })
      .catch(() => {
        // The server said no, such as a second Super Commit today, so bring the card back.
        hachi.play('blocked');
        setVersion((v) => v + 1);
        load();
      });
  };

  const onUndo = () => {
    undoLastSwipe().catch(() => {
      hachi.play('blocked');
      setVersion((v) => v + 1);
      load();
    });
  };

  const active = filterCount(filters);

  return (
    <View style={[styles.root, { backgroundColor: t.bg, paddingTop: top + 8, paddingBottom: inset }]}>
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
        <Hachi size={46} state={mood} animated interactive listen />
      </View>
      <View style={styles.pills}>
        <PressScale
          onPress={() => router.push(mode === 'hack' ? '/hack/needs' : '/likes')}
          style={[styles.interested, { backgroundColor: t.surface }]}>
          <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: 14 }}>
            {mode === 'hack' ? 'Team needs 2 Backend, 1 Design' : `${wanting} ${wanting === 1 ? 'builder wants' : 'builders want'} in`}
          </Text>
        </PressScale>
        <PressScale
          accessibilityLabel="Filters"
          onPress={() => router.push('/filters')}
          style={[styles.interested, { backgroundColor: t.surface }]}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" stroke={t.text} strokeWidth={2.4} strokeLinecap="round" />
          </Svg>
          {active ? <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: 14 }}>{active}</Text> : null}
        </PressScale>
      </View>
      {/* A new mode is a new deck, so the key resets its position. */}
      {cards ? (
        <SwipeDeck key={`${mode}${version}${active}`} cards={shown} superPerDay={superLeft} onMood={setMood} onSwipe={onSwipe} onUndo={onUndo} />
      ) : (
        <View style={styles.state}>
          <Hachi size={110} state={failed ? 'error' : 'thinking'} animated />
          <Text style={{ color: t.muted, fontFamily: t.fontBold, fontSize: 16 }}>{failed ? 'Could not load the deck' : 'Finding your people'}</Text>
          {failed ? (
            <PressScale onPress={load} style={[styles.retry, { backgroundColor: t.primary }]}>
              <Text style={{ color: t.onPrimary, fontFamily: t.fontBold, fontSize: 16 }}>Try again</Text>
            </PressScale>
          ) : null}
        </View>
      )}
      {match ? (
        <MatchMoment
          match={match}
          onSayHi={() => {
            setMatch(null);
            router.push(`/chat/${match.id}`);
          }}
          onCommit={() => {
            commitToMatch(match.id)
              .then(() => hachi.play('success'))
              .catch(() => hachi.play('blocked'));
            setMatch(null);
          }}
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
  pills: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 8 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  retry: { height: 48, paddingHorizontal: 24, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  interested: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
});
