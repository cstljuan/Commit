import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { MatchMoment, type MatchInfo } from '@/components/match/MatchMoment';
import { sampleReveal } from '@/components/deck/sampleCards';
import { API_IS_MOCK, commitToMatch, getInterested, respondToInterested } from '@/lib/api';
import { hachi } from '@/lib/hachi';
import { sfx } from '@/lib/sound';
import type { Interested } from '@/lib/types';
import { useMode } from '@/lib/theme';

/**
 * Who wants you. Nothing identifying is on this screen until you swipe right: the data
 * has no name or photo, so there is nothing to unblur. The server keeps it that way (F5).
 */
export default function LikesScreen() {
  const { t } = useMode();
  const [items, setItems] = useState<Interested[]>([]);
  const [match, setMatch] = useState<MatchInfo | null>(null);

  useEffect(() => {
    getInterested()
      .then((r) => setItems(r.cards))
      .catch(() => setItems([]));
  }, []);

  /** The name only exists once you like back: the server sends it in the match, never on the card (F5). */
  const answer = (item: Interested, like: boolean) => {
    sfx(like ? 'like' : 'pass');
    setItems((list) => list.filter((i) => i.swipeRef !== item.swipeRef));
    if (API_IS_MOCK) {
      if (like) setMatch(sampleReveal(item));
      return;
    }
    respondToInterested(item.swipeRef, like)
      .then(({ match: made }) => {
        if (made) setMatch({ id: made.id, role: made.role, otherUsername: made.otherUsername });
      })
      .catch(() => {
        // The server said no, so bring the card back.
        sfx('error');
        setItems((list) => [item, ...list]);
      });
  };

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <Stack.Screen options={{ title: 'Who wants you' }} />
      <FlatList
        data={items}
        keyExtractor={(i) => i.swipeRef}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: 28, marginBottom: 4 }}>
            {items.length} {items.length === 1 ? 'builder wants' : 'builders want'} in
          </Text>
        }
        ListEmptyComponent={
          <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 16 }}>Nobody new right now.</Text>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.tile,
              { backgroundColor: t.surface },
              item.isSuper && { backgroundColor: t.accent },
            ]}>
            <View style={[styles.mystery, { backgroundColor: t.primary + '2E' }]}>
              <Text style={{ color: t.primary, fontFamily: t.fontDisplay, fontSize: 40 }}>?</Text>
            </View>
            <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: 16 }}>{item.role}</Text>
            <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 14 }}>{item.level}</Text>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Pass on this ${item.role}`}
                onPress={() => answer(item, false)}
                style={[styles.action, { backgroundColor: t.pass }]}>
                <Text style={{ color: t.bg, fontFamily: t.fontBold, fontSize: 16 }}>{'✕︎'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Like this ${item.role} and reveal them`}
                onPress={() => answer(item, true)}
                style={[styles.action, { backgroundColor: t.like }]}>
                <Text style={{ color: t.onPrimary, fontFamily: t.fontBold, fontSize: 16 }}>{'♥︎'}</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
      {match ? (
        <MatchMoment
          match={match}
          onSayHi={() => {
            setMatch(null);
            if (!API_IS_MOCK) router.push(`/chat/${match.id}`);
          }}
          onCommit={() => {
            setMatch(null);
            if (API_IS_MOCK) return;
            commitToMatch(match.id)
              .then(() => hachi.play('success'))
              .catch(() => hachi.play('blocked'));
          }}
          onDismiss={() => setMatch(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: 20, gap: 14 },
  row: { gap: 14 },
  tile: { flex: 1, maxWidth: '48%', borderRadius: 24, padding: 16, gap: 6, alignItems: 'center' },
  mystery: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  action: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
