import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
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
import { getReply, getThread, HACHI_CHAT, saveThread } from '@/lib/chatbot';
import { demoIcebreakers, demoMatches, demoThreads, HACHI_CHIPS, type DemoMessage } from '@/lib/demoData';
import { hachi } from '@/lib/hachi';
import { llmAvailable } from '@/lib/llm';
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
  const isHachi = matchId === HACHI_CHAT;
  const match = demoMatches.find((m) => m.id === matchId) ?? demoMatches[0];
  const chatId = isHachi ? HACHI_CHAT : match.id;
  const initial = demoThreads[chatId] ?? demoThreads.m1;
  const [messages, setMessages] = useState<DemoMessage[]>(() => getThread(chatId, initial));
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [source, setSource] = useState<'local' | 'built-in'>(llmAvailable() ? 'local' : 'built-in');
  const [showCommit, setShowCommit] = useState(!isHachi && !match.iCommitted);
  const [committed, setCommitted] = useState(match.iCommitted);
  const list = useRef<FlatList<DemoMessage>>(null);
  const latest = useRef(messages);
  const alive = useRef(true);
  const turn = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const push = (message: Omit<DemoMessage, 'id'>) => {
    latest.current = [...latest.current, { ...message, id: `${Date.now()}-${latest.current.length}` }];
    saveThread(chatId, latest.current);
    setMessages(latest.current);
  };

  const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

  /** Their side of the conversation: typing, a pause that fits the length, then each text in turn. */
  const respond = async () => {
    const mine = ++turn.current;
    setTyping(true);
    const started = Date.now();
    const reply = await getReply(chatId, isHachi ? undefined : match.username, latest.current);
    if (!alive.current || mine !== turn.current) return;
    setSource(reply.source);
    for (let i = 0; i < reply.texts.length; i++) {
      const text = reply.texts[i];
      const pause = Math.min(1700, 450 + text.length * 16) - (i === 0 ? Date.now() - started : 0);
      if (pause > 0) await wait(pause);
      if (!alive.current || mine !== turn.current) return;
      const isLast = i === reply.texts.length - 1;
      push({ mine: false, body: text, action: isLast ? reply.action : undefined });
      if (isLast) setTyping(false);
      else await wait(250);
    }
    if (isHachi) hachi.play('happy');
  };

  const send = (body: string) => {
    const text = body.trim();
    if (!text) return;
    setDraft('');
    push({ mine: true, body: text });
    respond();
  };

  const stateLine = isHachi
    ? source === 'local'
      ? 'Hachi is running on a model on our own laptop'
      : 'Hachi answers from what is built into the app'
    : `Sample teammate, not a real person. ${source === 'local' ? 'Replies from a local model.' : 'Replies are built in.'}`;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: t.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <Stack.Screen
        options={{
          title: isHachi ? 'Hachi' : `@${match.username}`,
          headerRight: () => isHachi ? null : (
            <PressScale accessibilityLabel={`Open @${match.username}`} onPress={() => router.push(`/person/${match.username}`)}>
              <Critter seed={match.username} size={34} />
            </PressScale>
          ),
        }}
      />
      <View style={[styles.honest, { backgroundColor: t.surface }]}>
        <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 12, textAlign: 'center' }}>{stateLine}</Text>
      </View>
      {isHachi ? (
        <View style={[styles.stage, { backgroundColor: t.surface }]}>
          <Hachi size={84} animated listen sleepAfter={0} state={typing ? 'thinking' : 'idle'} />
        </View>
      ) : null}
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
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
            {item.action ? (
              <PressScale
                accessibilityLabel={item.action.label}
                onPress={() => router.push(item.action!.href as Href)}
                style={[styles.action, { backgroundColor: t.primary }]}>
                <Text style={{ color: t.onPrimary, fontFamily: t.fontBold, fontSize: 14 }}>{item.action.label}</Text>
              </PressScale>
            ) : null}
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
                    setTimeout(() => {
                      if (alive.current) push({ mine: false, body: `lets go, ${match.project} is official. I will start tonight` });
                    }, 1900);
                  }}
                />
              </Animated.View>
            ) : null}
          </View>
        }
      />
      {(isHachi || messages.length <= initial.length) && !typing ? (
        <FlatList
          horizontal
          style={styles.chipRow}
          showsHorizontalScrollIndicator={false}
          data={isHachi ? HACHI_CHIPS : demoIcebreakers(match.username)}
          keyExtractor={(s) => s}
          contentContainerStyle={styles.chips}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={isHachi ? undefined : <Hachi size={36} animated interactive={false} sleepAfter={0} />}
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
  stage: { alignItems: 'center', paddingBottom: 8, paddingTop: 2 },
  action: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
  bubble: { maxWidth: '82%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20 },
  footer: { gap: 12, marginTop: 4 },
  typing: { flexDirection: 'row', gap: 5, alignSelf: 'flex-start', padding: 14, borderRadius: 18 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  commit: { alignItems: 'center', gap: 12, padding: 18, borderRadius: 24, marginTop: 8 },
  chipRow: { flexGrow: 0 },
  chips: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, alignItems: 'center' },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1 },
  input: { flex: 1, height: 44, borderRadius: 22, paddingHorizontal: 16, fontSize: 16 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
