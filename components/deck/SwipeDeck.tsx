import { sfx } from '@/lib/sound';
import { hachi } from '@/lib/hachi';
import * as Haptics from '@/lib/haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { Burst } from '@/components/motion/Particles';
import { PressScale } from '@/components/motion/PressScale';
import { TypedLine } from '@/components/motion/TypedLine';
import { Hachi, type HachiState } from '@/components/Hachi/Hachi';
import { useMode } from '@/lib/theme';

import type { Card, Direction, ProjectCard, Role } from './cardTypes';
import { DeckButtons } from './DeckButtons';
import { DeckCard, type DeckCardHandle, type Zone } from './DeckCard';
import { RolePickerSheet } from './RolePickerSheet';

type Props = {
  cards: Card[];
  superPerDay?: number;
  onSwipe?: (card: Card, direction: Direction, role?: Role) => void;
  onUndo?: () => void;
  /** Lets the screen react to the drag, for example Hachi's face. */
  onMood?: (mood: HachiState) => void;
  /** When filters hid everything, the empty deck says so and offers to clear them. */
  onClearFilters?: () => void;
  /** Replaces the empty deck line, for example when Women mode is not on for this account. */
  emptyNote?: string;
};

type Swiped = { dir: Direction };

export function SwipeDeck({ cards, superPerDay = 1, onSwipe, onUndo, onMood, onClearFilters, emptyNote }: Props) {
  const { copy, mode, t } = useMode();
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<Swiped[]>([]);
  const [superLeft, setSuperLeft] = useState(superPerDay);
  const [enterFrom, setEnterFrom] = useState<Direction | null>(null);
  const [picking, setPicking] = useState<ProjectCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [fire, setFire] = useState(0);
  const [typed, setTyped] = useState('');
  const firstRender = useRef(true);
  useEffect(() => {
    firstRender.current = false;
  }, []);
  const progress = useSharedValue(0);
  const top = useRef<DeckCardHandle>(null);

  // Reset only after the new top card has rendered, so the card behind never jumps.
  useEffect(() => {
    progress.value = 0;
    setBusy(false);
  }, [index, progress]);

  const onZone = useCallback(
    (zone: Zone) => {
      sfx('tick');
      onMood?.(zone === 'none' ? 'idle' : zone === 'left' ? 'guard' : 'happy');
      if (zone === 'none') {
        Haptics.selectionAsync();
      } else if (zone === 'up') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    },
    [onMood],
  );

  const onBlockedSuper = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    sfx('error');
    onMood?.('blocked');
  }, [onMood]);

  const advance = useCallback((dir: Direction) => {
    setEnterFrom(null);
    setHistory((h) => [...h, { dir }]);
    setIndex((i) => i + 1);
    onMood?.('idle');
  }, [onMood]);

  const onCommit = useCallback(
    (dir: Direction) => {
      const card = cards[index];
      sfx(dir === 'left' ? 'pass' : dir === 'super' ? 'super' : 'like');
      if (dir !== 'left') setFire((n) => n + 1);
      if (mode === 'hack' && card.kind === 'person') {
        setTyped(dir === 'left' ? `$ echo @${card.username} >> .gitignore` : `$ git add @${card.username}`);
      }
      if (dir === 'super') setSuperLeft((s) => Math.max(0, s - 1));
      // After advance() settles the mood, so the reaction is not cut off.
      const reaction = index + 1 >= cards.length ? 'confused' : dir === 'left' ? 'wink' : dir === 'super' ? 'jump' : 'happy';
      setTimeout(() => hachi.play(reaction), 40);
      const open = card.kind === 'project' ? card.roles.filter((r) => r.open > 0) : [];
      if (dir !== 'left' && card.kind === 'project' && open.length > 1) {
        // The card has flown off, so ask for the role before the swipe counts.
        setPicking(card);
        advance(dir);
        return;
      }
      onSwipe?.(card, dir, open[0]?.role);
      advance(dir);
    },
    [advance, cards, index, mode, onSwipe],
  );

  const undo = useCallback(() => {
    const last = history[history.length - 1];
    if (!last) return;
    Haptics.selectionAsync();
    sfx('undo');
    if (last.dir === 'super') setSuperLeft((s) => s + 1);
    setHistory((h) => h.slice(0, -1));
    setEnterFrom(last.dir);
    setIndex((i) => i - 1);
    onUndo?.();
  }, [history, onUndo]);

  const fling = (dir: Direction) => {
    if (busy) return;
    setBusy(true);
    Haptics.impactAsync(dir === 'super' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium);
    top.current?.fling(dir);
  };

  const visible = cards.slice(index, index + 3);
  const done = visible.length === 0;

  return (
    <View style={styles.root}>
      <View style={styles.stack}>
        {done ? (
          <View style={styles.empty}>
            <Hachi size={120} state="confused" animated interactive />
            <Text style={{ color: t.muted, fontFamily: t.fontBold, fontSize: 16, textAlign: 'center' }}>
              {onClearFilters ? 'Your filters are hiding everyone.' : emptyNote ?? copy.emptyDeck}
            </Text>
            {onClearFilters ? (
              <PressScale accessibilityLabel="Clear filters" onPress={onClearFilters} style={[styles.clearFilters, { backgroundColor: t.primary }]}>
                <Text style={{ color: t.onPrimary, fontFamily: t.fontBold, fontSize: 16 }}>Clear filters</Text>
              </PressScale>
            ) : null}
          </View>
        ) : (
          [...visible].reverse().map((card, i, list) => {
            const isTop = card.id === visible[0].id;
            return (
              <DeckCard
                key={card.id}
                ref={isTop ? top : undefined}
                card={card}
                active={isTop}
                enterFrom={isTop ? enterFrom : null}
                progress={progress}
                canSuper={superLeft > 0}
                onCommit={onCommit}
                onZone={onZone}
                onBlockedSuper={onBlockedSuper}
                dealDelay={firstRender.current ? (list.length - 1 - i) * 90 : undefined}
              />
            );
          })
        )}
        <Burst fire={fire} color={t.like} />
        <TypedLine text={typed} fire={history.length} />
      </View>
      <DeckButtons
        canUndo={history.length > 0}
        superLeft={superLeft}
        disabled={done}
        onPass={() => fling('left')}
        onUndo={undo}
        onSuper={() => fling('super')}
        onLike={() => fling('right')}
      />
      {picking ? (
        <RolePickerSheet
          card={picking}
          onPick={(role) => {
            Haptics.selectionAsync();
            const dir = history[history.length - 1]?.dir ?? 'right';
            onSwipe?.(picking, dir, role);
            setPicking(null);
          }}
          onCancel={() => {
            setPicking(null);
            undo();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', gap: 16 },
  stack: { flex: 1, marginHorizontal: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24 },
  clearFilters: { height: 48, paddingHorizontal: 22, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
