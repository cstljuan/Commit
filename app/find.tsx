import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PressScale } from '@/components/motion/PressScale';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/nav/Screen';
import { ProfileCreature } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import {
  API_IS_MOCK,
  askToJoin,
  getMyOwnProjects,
  getMyProfile,
  getProjectsOf,
  inviteToProject,
  searchPeople,
  type FoundPerson,
  type SmallProject,
} from '@/lib/api';
import { sfx } from '@/lib/sound';
import { useMode } from '@/lib/theme';
import { radius, space, type } from '@/lib/tokens';

type Outcome = { kind: 'match'; matchId: string } | { kind: 'sent'; text: string } | { kind: 'error'; text: string };

/**
 * Find someone by username and add them: ask to join one of their projects, or invite them to one
 * of yours. Both are normal right swipes, so when both of you have added each other it is a match.
 */
export default function FindPeople() {
  const { t } = useMode();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoundPerson[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState<FoundPerson | null>(null);
  const [theirs, setTheirs] = useState<SmallProject[]>([]);
  const [mine, setMine] = useState<SmallProject[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    getMyOwnProjects().then(setMine).catch(() => setMine([]));
    getMyProfile().then((p) => setMyRole(p?.role ?? null)).catch(() => {});
  }, []);

  // Search as you type, newest query wins.
  useEffect(() => {
    const n = ++seq.current;
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      searchPeople(query)
        .then((r) => n === seq.current && setResults(r))
        .catch(() => n === seq.current && setResults([]))
        .finally(() => n === seq.current && setSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const pick = (p: FoundPerson) => {
    setOutcome(null);
    if (open?.id === p.id) return setOpen(null);
    setOpen(p);
    setTheirs([]);
    getProjectsOf(p.id).then(setTheirs).catch(() => setTheirs([]));
  };

  const run = async (key: string, action: () => Promise<{ matched: boolean; matchId?: string }>, sent: string) => {
    setBusy(key);
    setOutcome(null);
    try {
      const res = await action();
      if (res.matched && res.matchId) {
        sfx('match');
        setOutcome({ kind: 'match', matchId: res.matchId });
      } else {
        sfx('tick');
        setOutcome({ kind: 'sent', text: sent });
      }
    } catch {
      sfx('error');
      setOutcome({ kind: 'error', text: 'That did not go through. Try again.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen title="Find people">
      <TextField
        label="Username"
        placeholder="Type at least 2 letters"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        hint={API_IS_MOCK ? 'Sample data: try ben, priya or rio.' : 'Add a teammate, then they add you back. That is a match.'}
      />
      {searching ? <ActivityIndicator color={t.primary} /> : null}
      {!searching && query.trim().length >= 2 && results.length === 0 ? (
        <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.body }}>Nobody with that username yet.</Text>
      ) : null}

      {results.map((p, i) => (
        <Reveal key={p.id} index={i}>
          <PressScale
            accessibilityLabel={`Open @${p.username}`}
            onPress={() => pick(p)}
            style={[styles.row, { backgroundColor: t.surface }]}>
            <ProfileCreature url={p.avatarUrl} seed={p.username} size={52} />
            <View style={styles.rowText}>
              <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: type.lead }}>@{p.username}</Text>
              <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.small }}>
                {[p.role, p.level].filter(Boolean).join(', ') || 'Builder'}. Shows up {p.score}.
              </Text>
            </View>
          </PressScale>

          {open?.id === p.id ? (
            <View style={[styles.panel, { backgroundColor: t.surface }]}>
              <Text style={[styles.label, { color: t.text, fontFamily: t.fontBold }]}>Ask to join their project</Text>
              {theirs.length === 0 ? (
                <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.small }}>No projects yet.</Text>
              ) : (
                <View style={styles.chips}>
                  {theirs.map((pr) => (
                    <Button
                      key={pr.id}
                      variant="outline"
                      label={busy === `join-${pr.id}` ? 'Sending...' : `I want in: ${pr.title}`}
                      onPress={() => run(`join-${pr.id}`, () => askToJoin(pr.id, myRole), `Sent. When @${p.username} adds you to ${pr.title}, it is a match.`)}
                    />
                  ))}
                </View>
              )}

              <Text style={[styles.label, { color: t.text, fontFamily: t.fontBold }]}>Invite them to yours</Text>
              {mine.length === 0 ? (
                <Button variant="ghost" label="Make a project first" onPress={() => router.push('/project/new')} />
              ) : (
                <View style={styles.chips}>
                  {mine.map((pr) => (
                    <Button
                      key={pr.id}
                      variant="outline"
                      label={busy === `inv-${pr.id}` ? 'Sending...' : `Invite to ${pr.title}`}
                      onPress={() => run(`inv-${pr.id}`, () => inviteToProject(p.id, pr.id), `Invited. When @${p.username} asks to join ${pr.title}, it is a match.`)}
                    />
                  ))}
                </View>
              )}

              {outcome?.kind === 'match' ? (
                <View style={[styles.match, { backgroundColor: t.primary }]}>
                  <Text style={{ color: t.onPrimary, fontFamily: t.fontDisplay, fontSize: 28 }}>It&apos;s a match!</Text>
                  <Button variant="outline" label={`Say hi to @${p.username}`} onPress={() => router.push(`/chat/${outcome.matchId}`)} />
                </View>
              ) : outcome ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={{ color: outcome.kind === 'error' ? t.pass : t.text, fontFamily: t.fontBold, fontSize: type.small }}>
                  {outcome.text}
                </Text>
              ) : null}
            </View>
          ) : null}
        </Reveal>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, borderRadius: radius.card },
  rowText: { flex: 1, gap: 2 },
  panel: { marginTop: space.s, padding: space.l, borderRadius: radius.card, gap: space.m },
  label: { fontSize: type.small },
  chips: { gap: space.s },
  match: { padding: space.l, borderRadius: radius.card, gap: space.m, alignItems: 'center' },
});
