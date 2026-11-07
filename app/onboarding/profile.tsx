import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { saveProfile, type Level, type ProfileInput, type Role } from '@/components/forms/profileApi';
import { AVATAR_IDS, Avatar, avatarUrlFor } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { TextField } from '@/components/ui/TextField';
import { useMode } from '@/lib/theme';

const ROLES: Role[] = ['Frontend', 'Backend', 'AI/ML', 'Security', 'Mobile', 'Design', 'PM', 'Hardware'];
const LEVELS: { value: Level; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];
const SKILLS = [
  'TypeScript', 'JavaScript', 'Python', 'Swift', 'Kotlin', 'Java', 'C++', 'Rust', 'Go',
  'React', 'React Native', 'Node', 'SQL', 'Supabase', 'Firebase', 'AWS', 'PyTorch', 'Figma', 'Unity', 'Arduino',
];
const PROMPTS = ['Worst commit message', 'Tabs or spaces', 'My 3 AM snack', 'A bug I am proud of fixing'];
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

type StepId = 'username' | 'role' | 'skills' | 'occupation' | 'prompt' | 'avatar';
const STEPS: StepId[] = ['username', 'role', 'skills', 'occupation', 'prompt', 'avatar'];

const TITLES: Record<StepId, { title: string; sub: string }> = {
  username: { title: 'Pick a username', sub: 'This is how teams will see you.' },
  role: { title: 'What do you do?', sub: 'Your main role and how deep you are in it.' },
  skills: { title: 'Skills and languages', sub: 'Tap all that apply.' },
  occupation: { title: 'Student or working?', sub: 'Helps match you with similar schedules.' },
  prompt: { title: 'One fun one', sub: 'Pick a prompt. It shows on your card.' },
  avatar: { title: 'Choose your avatar', sub: 'You can change it later.' },
};

export default function OnboardingProfile() {
  const { t } = useMode();
  const router = useRouter();

  const [i, setI] = useState(0);
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [occupation, setOccupation] = useState<'student' | 'working' | null>(null);
  const [promptQ, setPromptQ] = useState<string | null>(null);
  const [promptA, setPromptA] = useState('');
  const [avatar, setAvatar] = useState<string>(AVATAR_IDS[0]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const step = STEPS[i];
  const isLast = i === STEPS.length - 1;
  const usernameValid = USERNAME_RE.test(username.trim());

  async function finish() {
    setSaving(true);
    setSaveError(null);
    const input: ProfileInput = {
      username: username.trim(),
      role,
      level,
      occupation,
      skills,
      prompts: promptQ && promptA.trim() ? [{ q: promptQ, a: promptA.trim() }] : [],
      avatarUrl: avatarUrlFor(avatar),
    };
    try {
      await saveProfile(input);
      router.replace('/(tabs)');
    } catch (e) {
      const msg = String((e as Error)?.message ?? '').toLowerCase();
      if (msg.includes('unique') || msg.includes('duplicate')) {
        setUsernameError('That username is taken. Try another one.');
        setI(0);
      } else {
        setSaveError('Could not save your profile. Check your connection and try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  function next() {
    if (step === 'username' && !usernameValid) {
      setUsernameError('3 to 20 letters, numbers or underscores.');
      return;
    }
    if (isLast) finish();
    else setI(i + 1);
  }

  const canContinue = step === 'username' ? usernameValid : true;
  const { title, sub } = TITLES[step];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        {i > 0 ? (
          <Button variant="ghost" label="Back" onPress={() => setI(i - 1)} disabled={saving} />
        ) : (
          <View style={styles.topSpacer} />
        )}
        <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 15 }}>
          {i + 1} of {STEPS.length}
        </Text>
        {step !== 'username' ? (
          <Button variant="ghost" label="Skip" onPress={isLast ? finish : () => setI(i + 1)} disabled={saving} />
        ) : (
          <View style={styles.topSpacer} />
        )}
      </View>
      <View style={[styles.track, { backgroundColor: t.line }]}>
        <View style={[styles.fill, { backgroundColor: t.primary, width: `${((i + 1) / STEPS.length) * 100}%` }]} />
      </View>

      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: t.text, fontFamily: t.fontDisplay }]}>{title}</Text>
          <Text style={[styles.sub, { color: t.muted, fontFamily: t.fontBody }]}>{sub}</Text>

          {step === 'username' && (
            <TextField
              label="Username"
              placeholder="octo_dev"
              value={username}
              onChangeText={(v) => {
                setUsername(v);
                if (usernameError) setUsernameError(null);
              }}
              error={usernameError}
              hint="Letters, numbers and underscores."
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              maxLength={20}
              returnKeyType="next"
              onSubmitEditing={next}
            />
          )}

          {step === 'role' && (
            <View style={styles.section}>
              <Text style={[styles.label, { color: t.text, fontFamily: t.fontBold }]}>Role</Text>
              <View style={styles.chips}>
                {ROLES.map((r) => (
                  <Chip key={r} label={r} selected={role === r} onPress={() => setRole(role === r ? null : r)} />
                ))}
              </View>
              <Text style={[styles.label, { color: t.text, fontFamily: t.fontBold }]}>Level</Text>
              <View style={styles.chips}>
                {LEVELS.map((l) => (
                  <Chip
                    key={l.value}
                    label={l.label}
                    selected={level === l.value}
                    onPress={() => setLevel(level === l.value ? null : l.value)}
                  />
                ))}
              </View>
            </View>
          )}

          {step === 'skills' && (
            <View style={styles.chips}>
              {SKILLS.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  selected={skills.includes(s)}
                  onPress={() => setSkills(skills.includes(s) ? skills.filter((x) => x !== s) : [...skills, s])}
                />
              ))}
            </View>
          )}

          {step === 'occupation' && (
            <View style={styles.section}>
              <Chip label="Student" selected={occupation === 'student'} onPress={() => setOccupation('student')} />
              <Chip label="Working" selected={occupation === 'working'} onPress={() => setOccupation('working')} />
            </View>
          )}

          {step === 'prompt' && (
            <View style={styles.section}>
              <View style={styles.chips}>
                {PROMPTS.map((q) => (
                  <Chip key={q} label={q} selected={promptQ === q} onPress={() => setPromptQ(q)} />
                ))}
              </View>
              {promptQ ? (
                <TextField
                  label={promptQ}
                  placeholder="Your answer"
                  value={promptA}
                  onChangeText={setPromptA}
                  maxLength={80}
                  hint={`${promptA.length} of 80`}
                  autoFocus
                />
              ) : null}
            </View>
          )}

          {step === 'avatar' && (
            <View style={styles.section}>
              <View style={styles.avatarPreview}>
                <Avatar id={avatar} size={112} />
              </View>
              <View style={styles.avatarGrid}>
                {AVATAR_IDS.map((id, n) => (
                  <Pressable
                    key={id}
                    accessibilityRole="button"
                    accessibilityLabel={`Avatar ${n + 1}`}
                    accessibilityState={{ selected: avatar === id }}
                    onPress={() => setAvatar(id)}
                    style={[
                      styles.avatarCell,
                      {
                        backgroundColor: t.surface,
                        borderColor: avatar === id ? t.primary : t.line,
                        borderWidth: avatar === id ? 3 : 1.5,
                      },
                    ]}>
                    <Avatar id={id} size={44} />
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {saveError ? (
            <Text accessibilityLiveRegion="polite" style={[styles.error, { color: t.pass, fontFamily: t.fontBold }]}>
              {saveError}
            </Text>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button label={isLast ? 'Finish' : 'Continue'} onPress={next} disabled={!canContinue} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 48 },
  topSpacer: { width: 56 },
  track: { height: 4, marginHorizontal: 24, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  scroll: { padding: 24, gap: 16 },
  title: { fontSize: 32 },
  sub: { fontSize: 17, lineHeight: 24, marginTop: -8 },
  section: { gap: 12 },
  label: { fontSize: 15, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  avatarPreview: { alignItems: 'center', paddingVertical: 8 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  avatarCell: { width: 68, height: 68, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  error: { fontSize: 15, textAlign: 'center' },
  footer: { padding: 24, paddingTop: 8 },
});
