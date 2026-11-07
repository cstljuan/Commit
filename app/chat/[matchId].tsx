import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Critter } from '@/components/critters/Critter';
import { HoldToCommit } from '@/components/motion/HoldToCommit';
import { PressScale } from '@/components/motion/PressScale';
import { Hachi } from '@/components/Hachi/Hachi';
import { demoIcebreakers, demoMatches, demoMessages, type DemoMessage } from '@/lib/demoData';
import { useMode } from '@/lib/theme';

function Dot({ i, color }: { i: number; color: string }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(i * 120, withRepeat(withSequence(withTiming(-5, { duration: 240 }), withTiming(0, { duration: 240 })), -1));
  }, [i, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

export default function ChatScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { t } = useMode();
  const { bottom } = useSafeAreaInsets();
  const match = demoMatches.find((m) => m.id === matchId) ?? demoMatches[0];
  const [messages, setMessages] = useState<DemoMessage[]>(demoMessages);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [showCommit, setShowCommit] = useState(!match.iCommitted);
  const [committed, setCommitted] = useState(match.iCommitted);
  const list = useRef<FlatList<DemoMessage>>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const send = (body: string) => {
    const text = body.trim();
    if (!text) return;
    setDraft('');
    setMessages((m) => [...m, { id: String(Date.now()), mine: true, body: text }]);
    // Stands in for subscribeMessages until lib/api.ts lands.
    setTyping(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { id: String(Date.now()), mine: false, body: 'Love it. Commit when you are ready.' }]);
    }, 1400);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: t.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <Stack.Screen
        options={{
          title: `@${match.username}`,
          headerRight: () => (
            <PressScale accessibilityLabel={`Open @${match.username}`} onPress={() => router.push(`/person/${match.username}`)}>
              <Critter seed={match.username} size={34} />
            </PressScale>
          ),
        }}
      />
      <View style={[styles.honest, { backgroundColor: t.surface }]}>
        <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 12, textAlign: 'center' }}>
          Not end-to-end encrypted yet
        </Text>
      </View>
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <Animated.View
            entering={FadeInDown.springify().damping(15).stiffness(190)}
            layout={LinearTransition.springify().damping(18)}
            style={[
              styles.bubble,
              item.mine
                ? { backgroundColor: t.primary, alignSelf: 'flex-end', borderBottomRightRadius: 6 }
                : { backgroundColor: t.surface, alignSelf: 'flex-start', borderBottomLeftRadius: 6 },
            ]}>
            <Text style={{ color: item.mine ? t.onPrimary : t.text, fontFamily: t.fontBody, fontSize: 16, lineHeight: 22 }}>
              {item.body}
            </Text>
          </Animated.View>
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            {typing ? (
              <Animated.View entering={FadeIn.duration(120)} style={[styles.typing, { backgroundColor: t.surface }]}>
                {[0, 1, 2].map((i) => (
                  <Dot key={i} i={i} color={t.muted} />
                ))}
              </Animated.View>
            ) : null}
            {showCommit ? (
              <Animated.View entering={FadeInDown.delay(200)} style={[styles.commit, { backgroundColor: t.surface }]}>
                <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: 16, textAlign: 'center' }}>
                  {committed ? `You committed to ${match.project}` : `Ready to build ${match.project}?`}
                </Text>
                <HoldToCommit
                  committed={committed}
                  onCommit={() => {
                    setCommitted(true);
                    setTimeout(() => setShowCommit(false), 1600);
                  }}
                />
              </Animated.View>
            ) : null}
          </View>
        }
      />
      {messages.length <= demoMessages.length ? (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={demoIcebreakers(match.username)}
          keyExtractor={(s) => s}
          contentContainerStyle={styles.chips}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={<Hachi size={36} animated sleepAfter={0} state={typing ? 'waiting' : 'idle'} />}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 70)}>
              <PressScale
                onPress={() => send(item)}
                style={[styles.chip, { backgroundColor: t.primary + '1F', borderColor: t.primary + '55' }]}>
                <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: 14 }}>{item}</Text>
              </PressScale>
            </Animated.View>
          )}
        />
      ) : null}
      <View style={[styles.inputRow, { paddingBottom: bottom + 8, backgroundColor: t.surface, borderTopColor: t.line }]}>
        <TextInput
          accessibilityLabel="Message"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => send(draft)}
          placeholder="Say something"
          placeholderTextColor={t.muted}
          returnKeyType="send"
          style={[styles.input, { color: t.text, backgroundColor: t.bg, fontFamily: t.fontBody }]}
        />
        <PressScale
          accessibilityLabel="Send"
          disabled={!draft.trim()}
          onPress={() => send(draft)}
          style={[styles.send, { backgroundColor: t.primary }]}>
          <Text style={{ color: t.onPrimary, fontFamily: t.fontBold, fontSize: 18 }}>{'↑︎'}</Text>
        </PressScale>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  honest: { paddingVertical: 6 },
  list: { padding: 16, gap: 8, flexGrow: 1 },
  bubble: { maxWidth: '82%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20 },
  footer: { gap: 12, marginTop: 4 },
  typing: { flexDirection: 'row', gap: 5, alignSelf: 'flex-start', padding: 14, borderRadius: 18 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  commit: { alignItems: 'center', gap: 12, padding: 18, borderRadius: 24, marginTop: 8 },
  chips: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, alignItems: 'center' },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1 },
  input: { flex: 1, height: 44, borderRadius: 22, paddingHorizontal: 16, fontSize: 16 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
