import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { TextField } from '@/components/ui/TextField';
import { useMode } from '@/lib/theme';
import { radius, space, type } from '@/lib/tokens';

export const SUGGESTED_SKILLS = [
  'TypeScript', 'JavaScript', 'Python', 'Swift', 'Kotlin', 'Java', 'C++', 'Rust', 'Go',
  'React', 'React Native', 'Next.js', 'Vue', 'Node', 'SQL', 'Supabase', 'Firebase', 'AWS', 'Docker',
  'PyTorch', 'TensorFlow', 'Figma', 'Unity', 'Arduino', 'Flutter', 'Tailwind', 'GraphQL', 'C#', 'Solidity',
];
export const MAX_SKILLS = 15;
const MAX_LEN = 24;

type Props = {
  value: string[];
  onChange: (skills: string[]) => void;
  /** Optional: let the screen see a typed skill that was not added yet, so Continue can add it. */
  draft?: string;
  onDraftChange?: (draft: string) => void;
};

/**
 * Add and remove skills. Your skills sit on top, each with a remove button.
 * Below: suggestions to tap, plus a field to add anything that is not listed.
 * Used by onboarding and by the Edit skills screen reached from Profile.
 */
export function SkillsEditor({ value, onChange, draft: outerDraft, onDraftChange }: Props) {
  const { t } = useMode();
  const [innerDraft, setInnerDraft] = useState('');
  const draft = outerDraft ?? innerDraft;
  const setDraft = (v: string) => (onDraftChange ? onDraftChange(v) : setInnerDraft(v));
  const [error, setError] = useState<string | null>(null);
  const full = value.length >= MAX_SKILLS;
  const has = (s: string) => value.some((v) => v.toLowerCase() === s.toLowerCase());

  function add(raw: string) {
    const s = raw.trim().replace(/\s+/g, ' ');
    if (!s) return;
    if (s.length > MAX_LEN) return setError(`Keep it under ${MAX_LEN} characters.`);
    if (has(s)) return setError(`${s} is already on your list.`);
    if (full) return setError(`You can list up to ${MAX_SKILLS} skills.`);
    onChange([...value, s]);
    setDraft('');
    setError(null);
  }

  function remove(s: string) {
    onChange(value.filter((v) => v !== s));
    setError(null);
  }

  const suggestions = SUGGESTED_SKILLS.filter((s) => !has(s));

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: t.text, fontFamily: t.fontBold }]}>
        Your skills ({value.length} of {MAX_SKILLS})
      </Text>
      {value.length === 0 ? (
        <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.body }}>
          None yet. Tap a suggestion or type your own below.
        </Text>
      ) : (
        <View style={styles.chips}>
          {value.map((s) => (
            <View key={s} style={[styles.mine, { backgroundColor: t.primary }]}>
              <Text style={{ color: t.onPrimary, fontFamily: t.fontBold, fontSize: type.body }}>{s}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${s}`}
                hitSlop={10}
                onPress={() => remove(s)}
                style={[styles.remove, { backgroundColor: t.onPrimary }]}>
                <Text style={{ color: t.primary, fontFamily: t.fontBold, fontSize: type.small, lineHeight: type.small + 2 }}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <TextField
        label="Add a skill"
        placeholder="Something not listed, like Three.js"
        value={draft}
        onChangeText={(v) => {
          setDraft(v);
          if (error) setError(null);
        }}
        error={error}
        maxLength={MAX_LEN}
        autoCorrect={false}
        returnKeyType="done"
        blurOnSubmit={false}
        onSubmitEditing={() => add(draft)}
        editable={!full}
      />
      {draft.trim() ? <Chip label={`Add "${draft.trim()}"`} selected={false} onPress={() => add(draft)} /> : null}

      {suggestions.length > 0 && !full ? (
        <>
          <Text style={[styles.label, { color: t.text, fontFamily: t.fontBold }]}>Suggestions</Text>
          <View style={styles.chips}>
            {suggestions.map((s) => (
              <Chip key={s} label={`+ ${s}`} selected={false} onPress={() => add(s)} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.m },
  label: { fontSize: type.small, marginTop: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s + 2 },
  mine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    minHeight: 44,
    paddingLeft: space.l,
    paddingRight: space.s,
    borderRadius: radius.full,
  },
  remove: { width: 24, height: 24, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
