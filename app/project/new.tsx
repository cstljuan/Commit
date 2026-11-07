import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Tako } from '@/components/Tako/Tako';
import type { Level, Role } from '@/components/forms/profileApi';
import { postIdea, type RoleNeed } from '@/components/forms/projectApi';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { TextField } from '@/components/ui/TextField';
import { useMode } from '@/lib/theme';

const ROLES: Role[] = ['Frontend', 'Backend', 'AI/ML', 'Security', 'Mobile', 'Design', 'PM', 'Hardware'];
const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced'];
const LEVEL_LABEL: Record<Level, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
const THEMES = ['AI', 'Health', 'Education', 'Climate', 'Fintech', 'Games', 'Social good', 'Security', 'Other'];
const TIMEFRAMES = [
  { value: 'weekend', label: 'A weekend' },
  { value: '1 month', label: '1 month' },
  { value: 'semester', label: 'A semester' },
  { value: 'ongoing', label: 'Ongoing' },
];
const MAX_TEAM = 3; // owner plus 3 is the max team of 4
const GITHUB_RE = /^https:\/\/(www\.)?github\.com\/[\w.-]+(\/[\w.-]+)?\/?$/i;

type Errors = Partial<Record<'title' | 'teaser' | 'idea' | 'roles' | 'theme' | 'timeframe' | 'github' | 'submit', string>>;

export default function NewProject() {
  const { t } = useMode();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [teaser, setTeaser] = useState('');
  const [idea, setIdea] = useState('');
  const [theme, setTheme] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleNeed[]>([]);
  const [draftRole, setDraftRole] = useState<Role | null>(null);
  const [draftLevel, setDraftLevel] = useState<Level>('intermediate');
  const [timeframe, setTimeframe] = useState<string | null>(null);
  const [github, setGithub] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState<{ projectId: string; commitHash: string } | null>(null);

  const totalSeats = roles.reduce((n, r) => n + r.count, 0);

  function clear(key: keyof Errors) {
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function addRole() {
    if (!draftRole || totalSeats >= MAX_TEAM) return;
    setRoles((rs) => {
      const existing = rs.find((r) => r.role === draftRole && r.level === draftLevel);
      if (existing) return rs.map((r) => (r === existing ? { ...r, count: r.count + 1 } : r));
      return [...rs, { role: draftRole, level: draftLevel, count: 1 }];
    });
    setDraftRole(null);
    clear('roles');
  }

  function changeCount(idx: number, delta: number) {
    setRoles((rs) =>
      rs
        .map((r, i) => (i === idx ? { ...r, count: r.count + delta } : r))
        .filter((r) => r.count > 0),
    );
  }

  function validate(): Errors {
    const e: Errors = {};
    if (title.trim().length < 3) e.title = 'Give it a name, at least 3 characters.';
    if (visibility === 'private' && teaser.trim().length < 10) e.teaser = 'Write a short teaser, at least 10 characters.';
    if (idea.trim().length < 20) e.idea = 'Describe the idea in at least 20 characters.';
    if (!theme) e.theme = 'Pick a theme.';
    if (roles.length === 0) e.roles = 'Add at least one role you need.';
    if (!timeframe) e.timeframe = 'Pick a timeframe.';
    if (github.trim() && !GITHUB_RE.test(github.trim())) e.github = 'Use a link like https://github.com/you/repo';
    return e;
  }

  async function submit() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setPosting(true);
    try {
      const fullIdea = idea.trim();
      const res = await postIdea({
        title: title.trim(),
        visibility,
        teaser: visibility === 'private' ? teaser.trim() : fullIdea.slice(0, 140),
        idea: fullIdea,
        theme: theme!,
        roles,
        githubUrl: github.trim() || undefined,
        timeframe: timeframe!,
      });
      setResult(res);
    } catch {
      setErrors({ submit: 'Could not post your project. Your text is still here, try again.' });
    } finally {
      setPosting(false);
    }
  }

  if (result) {
    // TODO(niki-agent): replace with <InkCommit text={idea} commitHash={hash} onDone={...} /> once PR #2 is on main.
    return (
      <SafeAreaView style={[styles.root, styles.done, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <Tako state="ink" size={120} />
        <Text style={[styles.doneTitle, { color: t.text, fontFamily: t.fontDisplay }]}>Idea committed</Text>
        <Text style={[styles.doneSub, { color: t.muted, fontFamily: t.fontBody }]}>
          {visibility === 'private'
            ? 'Encrypted. Only your team can read it after they commit.'
            : 'Posted. Anyone can read it, and the hash proves it was yours first.'}
        </Text>
        <View style={[styles.hashBox, { backgroundColor: t.surface, borderColor: t.line }]}>
          <Text style={{ color: t.muted, fontFamily: t.fontBold, fontSize: 13 }}>Commit hash</Text>
          <Text selectable style={{ color: t.text, fontFamily: t.fontBody, fontSize: 15, letterSpacing: 0.5 }}>
            {result.commitHash.slice(0, 32)}
            {'\n'}
            {result.commitHash.slice(32)}
          </Text>
        </View>
        <View style={styles.doneActions}>
          <Button label="Open team page" onPress={() => router.replace(`/project/${result.projectId}`)} />
          <Button variant="ghost" label="Back to swiping" onPress={() => router.replace('/(tabs)')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Post a project' }} />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TextField
            label="Project name"
            placeholder="Study buddy finder"
            value={title}
            onChangeText={(v) => {
              setTitle(v);
              clear('title');
            }}
            error={errors.title}
            maxLength={60}
          />

          <View style={styles.section}>
            <Text style={[styles.label, { color: t.text, fontFamily: t.fontBold }]}>Who can read the idea?</Text>
            <View style={[styles.segment, { backgroundColor: t.surface, borderColor: t.line }]}>
              {(['private', 'public'] as const).map((v) => {
                const on = visibility === v;
                return (
                  <Pressable
                    key={v}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => setVisibility(v)}
                    style={[styles.segmentItem, { backgroundColor: on ? t.primary : 'transparent' }]}>
                    <Text style={{ color: on ? t.onPrimary : t.text, fontFamily: t.fontBold, fontSize: 16 }}>
                      {v === 'private' ? 'Private' : 'Public'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 15, lineHeight: 21 }}>
              {visibility === 'private'
                ? 'People see a short teaser. The full idea stays encrypted until they commit to your team.'
                : 'Anyone swiping can read the full idea. It still gets a commit hash that proves it is yours.'}
            </Text>
          </View>

          {visibility === 'private' ? (
            <TextField
              label="Public teaser"
              placeholder="An app that pairs students for study sessions"
              value={teaser}
              onChangeText={(v) => {
                setTeaser(v);
                clear('teaser');
              }}
              error={errors.teaser}
              hint={`Shown on your card. ${teaser.length} of 140`}
              maxLength={140}
              multiline
            />
          ) : null}

          <TextField
            label={visibility === 'private' ? 'Full idea (encrypted)' : 'Full idea'}
            placeholder="What it does, who it is for, what makes it different"
            value={idea}
            onChangeText={(v) => {
              setIdea(v);
              clear('idea');
            }}
            error={errors.idea}
            multiline
            maxLength={2000}
            style={styles.multiline}
          />

          <View style={styles.section}>
            <Text style={[styles.label, { color: t.text, fontFamily: t.fontBold }]}>Theme</Text>
            <View style={styles.chips}>
              {THEMES.map((th) => (
                <Chip
                  key={th}
                  label={th}
                  selected={theme === th}
                  onPress={() => {
                    setTheme(th);
                    clear('theme');
                  }}
                />
              ))}
            </View>
            {errors.theme ? <Text style={[styles.err, { color: t.pass, fontFamily: t.fontBold }]}>{errors.theme}</Text> : null}
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: t.text, fontFamily: t.fontBold }]}>
              Roles you need ({totalSeats} of {MAX_TEAM})
            </Text>
            {roles.map((r, idx) => (
              <View key={`${r.role}-${r.level}`} style={[styles.roleRow, { backgroundColor: t.surface, borderColor: t.line }]}>
                <Text style={{ flex: 1, color: t.text, fontFamily: t.fontBold, fontSize: 16 }}>
                  {r.role} <Text style={{ color: t.muted, fontFamily: t.fontBody }}>{LEVEL_LABEL[r.level]}</Text>
                </Text>
                <Button variant="ghost" label="−" onPress={() => changeCount(idx, -1)} />
                <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: 17, minWidth: 18, textAlign: 'center' }}>
                  {r.count}
                </Text>
                <Button variant="ghost" label="+" onPress={() => changeCount(idx, 1)} disabled={totalSeats >= MAX_TEAM} />
              </View>
            ))}
            {totalSeats < MAX_TEAM ? (
              <>
                <View style={styles.chips}>
                  {ROLES.map((r) => (
                    <Chip key={r} label={r} selected={draftRole === r} onPress={() => setDraftRole(draftRole === r ? null : r)} />
                  ))}
                </View>
                {draftRole ? (
                  <>
                    <View style={styles.chips}>
                      {LEVELS.map((l) => (
                        <Chip key={l} label={LEVEL_LABEL[l]} selected={draftLevel === l} onPress={() => setDraftLevel(l)} />
                      ))}
                    </View>
                    <Button variant="outline" label={`Add ${draftRole}`} onPress={addRole} />
                  </>
                ) : null}
              </>
            ) : (
              <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 15 }}>Team is full: you plus 3.</Text>
            )}
            {errors.roles ? <Text style={[styles.err, { color: t.pass, fontFamily: t.fontBold }]}>{errors.roles}</Text> : null}
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: t.text, fontFamily: t.fontBold }]}>Timeframe</Text>
            <View style={styles.chips}>
              {TIMEFRAMES.map((tf) => (
                <Chip
                  key={tf.value}
                  label={tf.label}
                  selected={timeframe === tf.value}
                  onPress={() => {
                    setTimeframe(tf.value);
                    clear('timeframe');
                  }}
                />
              ))}
            </View>
            {errors.timeframe ? <Text style={[styles.err, { color: t.pass, fontFamily: t.fontBold }]}>{errors.timeframe}</Text> : null}
          </View>

          <TextField
            label="GitHub link (optional)"
            placeholder="https://github.com/you/repo"
            value={github}
            onChangeText={(v) => {
              setGithub(v);
              clear('github');
            }}
            error={errors.github}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          {errors.submit ? (
            <Text accessibilityLiveRegion="polite" style={[styles.err, styles.center, { color: t.pass, fontFamily: t.fontBold }]}>
              {errors.submit}
            </Text>
          ) : null}
          {Object.keys(errors).some((k) => k !== 'submit' && errors[k as keyof Errors]) ? (
            <Text style={[styles.err, styles.center, { color: t.pass, fontFamily: t.fontBold }]}>
              A few fields need a look above.
            </Text>
          ) : null}

          <Button label="Post project" onPress={submit} loading={posting} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 24, gap: 20, paddingBottom: 48 },
  section: { gap: 10 },
  label: { fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  segment: { flexDirection: 'row', borderRadius: 16, padding: 4 },
  segmentItem: { flex: 1, minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  multiline: { minHeight: 120, paddingTop: 14, textAlignVertical: 'top' },
  roleRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingLeft: 16, paddingRight: 4, minHeight: 54 },
  err: { fontSize: 14 },
  center: { textAlign: 'center' },
  done: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  doneTitle: { fontSize: 34, textAlign: 'center' },
  doneSub: { fontSize: 17, textAlign: 'center', lineHeight: 24, maxWidth: 340 },
  hashBox: { borderRadius: 16, padding: 16, gap: 6, alignSelf: 'stretch', maxWidth: 420 },
  doneActions: { alignSelf: 'stretch', gap: 8, maxWidth: 420, marginTop: 8 },
});
