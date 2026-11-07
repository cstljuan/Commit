import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SkillsEditor } from '@/components/forms/SkillsEditor';
import { getMyProfile, saveProfile, type Profile } from '@/components/forms/profileApi';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { TextField } from '@/components/ui/TextField';
import { useMode } from '@/lib/theme';
import { ROLES, type Role } from '@/lib/types';
import { space, type } from '@/lib/tokens';

const TAGLINE_MAX = 80;

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((s, i) => s === b[i]);

/**
 * Edit profile, opened from Profile: change your tagline, add and remove skills.
 * Loads the saved profile and writes the whole profile back with the changes.
 */
export default function EditProfile() {
  const { t } = useMode();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [tagline, setTagline] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [mainRole, setMainRole] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function load() {
    setLoadError(false);
    setProfile(null);
    getMyProfile()
      .then((p) => {
        if (!p) throw new Error('no profile');
        setProfile(p);
        setTagline(p.bio ?? '');
        setSkills(p.skills ?? []);
        setMainRole((p.role as Role) ?? null);
      })
      .catch(() => setLoadError(true));
  }
  useEffect(load, []);

  const trimmed = tagline.trim().replace(/\s+/g, ' ');
  const changed = !!profile && (trimmed !== (profile.bio ?? '') || !sameList(skills, profile.skills ?? []) || mainRole !== profile.role);

  async function save() {
    if (!profile) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { id: _id, reliability: _r, ...input } = profile;
      await saveProfile({ ...input, role: mainRole ?? input.role, bio: trimmed, skills });
      router.back();
    } catch {
      setSaveError('Could not save your changes. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <SafeAreaView style={[styles.root, styles.center, { backgroundColor: t.bg }]} edges={['bottom']}>
        <Stack.Screen options={{ title: 'Edit profile' }} />
        <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: type.lead, textAlign: 'center' }}>
          Could not load your profile.
        </Text>
        <Button label="Try again" onPress={load} />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={[styles.root, styles.center, { backgroundColor: t.bg }]} edges={['bottom']}>
        <Stack.Screen options={{ title: 'Edit profile' }} />
        <ActivityIndicator color={t.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Edit profile' }} />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <TextField
              label="Tagline"
              placeholder="Backend dev who loves late night hackathons"
              value={tagline}
              onChangeText={(v) => setTagline(v.replace(/\n/g, ' '))}
              hint={`Shows under your name on your card. ${tagline.length} of ${TAGLINE_MAX}`}
              maxLength={TAGLINE_MAX}
              multiline
              returnKeyType="done"
              blurOnSubmit
            />
            {tagline ? <Button variant="ghost" label="Clear tagline" onPress={() => setTagline('')} /> : null}
          </View>

          <View style={[styles.divider, { backgroundColor: t.line }]} />

          <View style={styles.section}>
            <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: type.small }}>Main role</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {ROLES.map((r) => (
                <Chip key={r} label={r} selected={mainRole === r} onPress={() => setMainRole(r)} />
              ))}
            </View>
            <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.small }}>Other roles you do: add them as skills below.</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {ROLES.filter((r) => r !== mainRole && !skills.includes(r)).slice(0, 16).map((r) => (
                <Chip key={r} label={`+ ${r}`} selected={false} onPress={() => setSkills([...skills, r])} />
              ))}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: t.line }]} />

          <SkillsEditor value={skills} onChange={setSkills} />

          {saveError ? (
            <Text
              accessibilityLiveRegion="polite"
              style={{ color: t.pass, fontFamily: t.fontBold, fontSize: type.small, textAlign: 'center' }}>
              {saveError}
            </Text>
          ) : null}
        </ScrollView>
        <View style={styles.footer}>
          <Button label="Save" onPress={save} loading={saving} disabled={!changed} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.l, padding: space.xl },
  scroll: { padding: space.xl, gap: space.xl },
  section: { gap: space.xs, alignItems: 'stretch' },
  divider: { height: 1 },
  footer: { padding: space.xl, paddingTop: space.s },
});
