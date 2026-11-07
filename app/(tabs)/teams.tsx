import { router } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Critter } from '@/components/critters/Critter';
import { PressScale } from '@/components/motion/PressScale';
import { Reveal } from '@/components/motion/Reveal';
import { useTabInset } from '@/components/nav/TabBar';
import { Hachi } from '@/components/Hachi/Hachi';
import { demoMatches, demoTeam, type DemoMatch } from '@/lib/demoData';
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
            {match.lastLine}
          </Text>
          <Text style={{ color: yourMove ? t.primary : t.muted, fontFamily: t.fontBold, fontSize: 13 }}>
            {match.role} · {status(match)}
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
  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <FlatList
        data={demoMatches}
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
            <Reveal>
                <PressScale
                  accessibilityLabel="Copy alert. Someone posted a reworded version of your idea. Tap to see your proof."
                  onPress={() => router.push('/alert')}
                  style={[styles.alert, { backgroundColor: t.pass + '1F', borderColor: t.pass }]}>
                  <Hachi size={52} state="guard" animated interactive={false} />
                  <View style={styles.rowText}>
                    <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: 15 }}>Someone reworded your idea</Text>
                    <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 13 }}>
                      Only you can see this. Your commit hash proves you were first.
                    </Text>
                  </View>
                </PressScale>
            </Reveal>
            <Reveal index={1}>
              <PressScale
                accessibilityLabel={`Open team ${demoTeam.title}`}
                onPress={() => router.push(`/project/${demoTeam.id}`)}
                style={[styles.team, { backgroundColor: t.primary }]}>
                <Text style={{ color: t.onPrimary, fontFamily: t.fontBold, fontSize: 13 }}>Your team</Text>
                <Text style={{ color: t.onPrimary, fontFamily: t.fontDisplay, fontSize: 24 }}>{demoTeam.title}</Text>
                <Text style={{ color: t.onPrimary, fontFamily: t.fontBody, fontSize: 14 }}>3 of 4 roles filled</Text>
              </PressScale>
            </Reveal>
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
  alert: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, borderWidth: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bell: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  team: { padding: 18, borderRadius: 24, gap: 4 },
});
