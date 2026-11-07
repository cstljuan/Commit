import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SkillsEditor } from '@/components/forms/SkillsEditor';
import { getMyProfile, saveProfile } from '@/components/forms/profileApi';
import { Button } from '@/components/ui/Button';
import { useMode } from '@/lib/theme';
import { space, type } from '@/lib/tokens';

/** Edit skills, opened from Profile. Loads the saved list, saves the whole profile back with new skills. */
export default function EditSkills() {
  const { t } = useMode();
  const router = useRouter();
  const [skills, setSkills] = useState<string[] | null>(null);
  const [original, setOriginal] = useState<string[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function load() {
    setLoadError(false);
    setSkills(null);
    getMyProfile()
      .then((p) => {
        const s = p?.skills ?? [];
        setSkills(s);
        setOriginal(s);
      })
      .catch(() => setLoadError(true));
  }
  useEffect(load, []);

  const changed = skills !== null && (skills.length !== original.length || skills.some((s, i) => s !== original[i]));

  async function save() {
    if (!skills) return;
    setSaving(true);
    setSaveError(null);
    try {
      const p = await getMyProfile();
      if (!p) throw new Error('no profile');
      const { id: _id, reliability: _r, ...input } = p;
      await saveProfile({ ...input, skills });
      router.back();
    } catch {
      setSaveError('Could not save your skills. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Edit skills' }} />
      {loadError ? (
        <View style={styles.center}>
          <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: type.lead }}>Could not load your skills.</Text>
          <Button label="Try again" onPress={load} />
        </View>
      ) : skills === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={t.primary} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <SkillsEditor value={skills} onChange={setSkills} />
            {saveError ? (
              <Text accessibilityLiveRegion="polite" style={{ color: t.pass, fontFamily: t.fontBold, fontSize: type.small, textAlign: 'center' }}>
                {saveError}
              </Text>
            ) : null}
          </ScrollView>
          <View style={styles.footer}>
            <Button label="Save" onPress={save} loading={saving} disabled={!changed} />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: space.xl, gap: space.l },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.l, padding: space.xl },
  footer: { padding: space.xl, paddingTop: space.s },
});
