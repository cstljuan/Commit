import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { MatchMoment, type MatchInfo } from '@/components/match/MatchMoment';
import { sampleReveal } from '@/components/deck/sampleCards';
import { API_IS_MOCK, getInterested } from '@/lib/api';
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

  const remove = (ref: string) => setItems((list) => list.filter((i) => i.swipeRef !== ref));

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
                onPress={() => remove(item.swipeRef)}
                style={[styles.action, { backgroundColor: t.pass }]}>
                <Text style={{ color: t.bg, fontFamily: t.fontBold, fontSize: 16 }}>{'✕︎'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Like this ${item.role} and reveal them`}
                onPress={() => {
                  remove(item.swipeRef);
                  // On the real backend identity stays hidden (F5): they appear in your deck to swipe on.
                  if (API_IS_MOCK) setMatch(sampleReveal(item));
                  else router.back();
                }}
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
          onSayHi={() => setMatch(null)}
          onCommit={() => setMatch(null)}
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
