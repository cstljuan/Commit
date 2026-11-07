import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Critter } from '@/components/critters/Critter';
import { PressScale } from '@/components/motion/PressScale';
import { Reveal } from '@/components/motion/Reveal';
import { SampleBadge } from '@/components/motion/SampleBadge';
import { useTabInset } from '@/components/nav/TabBar';
import { Hachi } from '@/components/Hachi/Hachi';
import { API_IS_MOCK, getCopyAlerts, getMatches, getMyProjects } from '@/lib/api';
import type { MyProject } from '@/lib/types';
import { lastLineOf, peerOf } from '@/lib/chatbot';
import { demoMatches, type DemoMatch } from '@/lib/demoData';
import { useMascotName } from '@/lib/mascot';
import { useMode } from '@/lib/theme';

function status(m: DemoMatch) {
  if (m.iCommitted && m.theyCommitted) return 'Team formed';
  if (m.iCommitted) return 'Waiting on them';
  if (m.theyCommitted) return 'Waiting on you';
  return 'Say hi first';
}

function MatchRow({ match, index }: { match: DemoMatch; index: number }) {
  const { t } = useMode();
  const yourMove = match.theyCommitted && !match.iCommitted;
  return (
    <Reveal index={index}>
      <PressScale
        accessibilityLabel={`Chat with ${match.username}, ${status(match)}`}
        onPress={() => router.push(`/chat/${match.id}`)}
        style={[styles.row, { backgroundColor: t.surface }]}>
        <Critter seed={match.username} size={56} />
        <View style={styles.rowText}>
          <Text numberOfLines={1} style={{ color: t.text, fontFamily: t.fontBold, fontSize: 17 }}>
            @{match.username}
          </Text>
          <Text numberOfLines={1} style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 14 }}>
            {lastLineOf(match.id) ?? match.lastLine}
          </Text>
          <Text style={{ color: yourMove ? t.text : t.muted, fontFamily: t.fontBold, fontSize: 13 }}>
            {match.role} · {status(match)}
          </Text>
        </View>
      </PressScale>
    </Reveal>
  );
}

function AskHachi() {
  const { t } = useMode();
  const name = useMascotName();
  return (
    <Reveal>
      <PressScale
        accessibilityLabel={`Ask ${name}`}
        onPress={() => router.push('/chat/hachi')}
        style={[styles.row, { backgroundColor: t.surface }]}>
        <Hachi size={56} animated interactive={false} sleepAfter={0} />
        <View style={styles.rowText}>
          <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: 17 }}>Ask {name}</Text>
          <Text numberOfLines={1} style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 14 }}>
            {lastLineOf('hachi') ?? 'Teammates, your pitch, your score, proof'}
          </Text>
        </View>
      </PressScale>
    </Reveal>
  );
}

export default function MatchesScreen() {
  const { t, mode } = useMode();
  const { top } = useSafeAreaInsets();
  const inset = useTabInset();
  // Coming back from a chat refreshes the last line of each row.
  const [seen, setSeen] = useState(0);
  const [live, setLive] = useState<DemoMatch[]>([]);
  const [team, setTeam] = useState<MyProject | null>(null);
  const [hasAlert, setHasAlert] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setSeen((n) => n + 1);
      getMatches()
        .then((list) =>
          setLive(
            list.map((m) => ({
              id: m.id,
              username: m.otherUsername,
              role: m.role,
              project: m.projectTitle ?? peerOf(m.id)?.project ?? 'your project',
              iCommitted: m.iCommitted,
              theyCommitted: m.theyCommitted,
              lastLine: 'Say hi',
            })),
          ),
        )
        .catch(() => setLive([]));
      getMyProjects()
        .then((list) => setTeam(list.find((p) => p.roles.filter((r) => r.username).length > 1) ?? list[0] ?? null))
        .catch(() => setTeam(null));
      getCopyAlerts()
        .then((list) => setHasAlert(API_IS_MOCK || list.length > 0))
        .catch(() => setHasAlert(false));
    }, []),
  );
  // Sample chats stay only until the real API is on.
  const rows = API_IS_MOCK ? [...live, ...demoMatches] : live;
  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <FlatList
        data={rows}
        extraData={seen}
        keyExtractor={(m) => m.id}
        contentContainerStyle={[styles.list, { paddingTop: top + 12, paddingBottom: inset }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: 34 }}>
                {mode === 'hack' ? 'git log' : 'Matches'}
              </Text>
              <PressScale accessibilityLabel="Activity" onPress={() => router.push('/activity')} style={styles.bell}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2zM10 21h4" stroke={t.text} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </PressScale>
            </View>
            {API_IS_MOCK ? <SampleBadge color={t.bg} background={t.muted} /> : null}
            {hasAlert ? <Reveal>
                <PressScale
                  accessibilityLabel="Copy alert. Someone posted a reworded version of your idea. Tap to see your proof."
                  onPress={() => router.push('/alert')}
                  style={[styles.alert, { backgroundColor: t.accent }]}>
                  <Hachi size={52} state="guard" color="#2A1408" animated interactive={false} />
                  <View style={styles.rowText}>
                    <Text style={{ color: '#2A1408', fontFamily: t.fontBold, fontSize: 15 }}>Someone reworded your idea</Text>
                    <Text style={{ color: '#2A1408', fontFamily: t.fontBody, fontSize: 13 }}>
                      Only you can see this. Your commit hash proves you were first.
                    </Text>
                  </View>
                </PressScale>
            </Reveal> : null}
            {team ? <Reveal index={1}>
              <PressScale
                accessibilityLabel={`Open team ${team.title}`}
                onPress={() => router.push(`/project/${team.id}`)}
                style={[styles.team, { backgroundColor: t.primary }]}>
                <Text style={{ color: t.onPrimary, fontFamily: t.fontBold, fontSize: 13 }}>Your team</Text>
                <Text style={{ color: t.onPrimary, fontFamily: t.fontDisplay, fontSize: 24 }}>{team.title}</Text>
                <Text style={{ color: t.onPrimary, fontFamily: t.fontBody, fontSize: 14 }}>{team.roles.filter((r) => r.username).length} of {team.roles.length} roles filled</Text>
              </PressScale>
            </Reveal> : null}
            <AskHachi />
          </View>
        }
        renderItem={({ item, index }) => <MatchRow match={item} index={index + 2} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  header: { gap: 12, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 22 },
  rowText: { flex: 1, gap: 2 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bell: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  team: { padding: 18, borderRadius: 24, gap: 4 },
});
