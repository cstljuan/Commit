import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutDown, LinearTransition } from 'react-native-reanimated';

import type { Role } from '@/components/deck/cardTypes';
import { PressScale } from '@/components/motion/PressScale';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/nav/Screen';
import { getHackRoles, setHackRoles } from '@/lib/api';
import { useMode } from '@/lib/theme';
import { radius, space, type } from '@/lib/tokens';

const ROLES: Role[] = ['Frontend', 'Backend', 'AI/ML', 'Security', 'Mobile', 'Design', 'PM', 'Hardware'];
const MAX_OTHERS = 3; // Teams cap at 4, and one of them is you.

function Stepper({ value, onChange, canAdd, label }: { value: number; onChange: (v: number) => void; canAdd: boolean; label: string }) {
  const { t } = useMode();
  const button = (text: string, disabled: boolean, next: number, a11y: string) => (
    <PressScale
      accessibilityLabel={a11y}
      disabled={disabled}
      onPress={() => onChange(next)}
      style={[styles.step, { backgroundColor: `${t.primary}26` }]}>
      <Text style={{ color: t.primary, fontFamily: t.fontBold, fontSize: type.lead }}>{text}</Text>
    </PressScale>
  );
  return (
    <View style={styles.stepper}>
      {button('-', value === 0, value - 1, `One less ${label}`)}
      <Animated.Text key={value} entering={FadeInUp.springify().damping(14)} exiting={FadeOutDown.duration(90)} style={{ color: t.text, fontFamily: t.fontBold, fontSize: type.lead, width: 22, textAlign: 'center' }}>
        {value}
      </Animated.Text>
      {button('+', !canAdd, value + 1, `One more ${label}`)}
    </View>
  );
}

/** Hack mode has no project ideas, just who your team still needs. From the whiteboard. */
export default function NeedsScreen() {
  const { t } = useMode();
  const [needs, setNeeds] = useState<Partial<Record<Role, number>>>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    getHackRoles()
      .then((roles) => {
        const saved = Object.fromEntries(roles.map((r) => [r.role, r.open]));
        // Never replace what someone already changed while this loaded.
        setNeeds((current) => (Object.keys(current).length ? current : saved));
      })
      .catch(() => {});
  }, []);
  const save = () => {
    setSaving(true);
    setFailed(false);
    const roles = ROLES.filter((r) => needs[r]).map((r) => ({ role: r, open: needs[r] as number }));
    setHackRoles(roles)
      .then(() => router.back())
      .catch(() => {
        setFailed(true);
        setSaving(false);
      });
  };
  const total = Object.values(needs).reduce((a, b) => a + (b ?? 0), 0);
  const line = ROLES.filter((r) => needs[r]).map((r) => `${needs[r]} ${r.toLowerCase()}`).join(', ') || 'nobody yet';
  return (
    <Screen title="Who do you need?">
      <Reveal style={[styles.terminal, { backgroundColor: t.surface }]}>
        <Text style={{ color: t.primary, fontFamily: 'JetBrainsMono_700Bold', fontSize: type.small }}>
          $ git commit -m &quot;need {line}&quot;
        </Text>
        <Text style={{ color: t.muted, fontFamily: 'JetBrainsMono_400Regular', fontSize: type.micro }}>
          {total + 1} of 4 on the team. No idea text is ever shown in Hack mode.
        </Text>
      </Reveal>
      {ROLES.map((role, i) => (
        <Reveal key={role} index={i + 1}>
          <Animated.View layout={LinearTransition} style={[styles.row, { backgroundColor: t.surface }]}>
            <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: type.body, flex: 1 }}>{role}</Text>
            <Stepper
              label={role}
              value={needs[role] ?? 0}
              canAdd={total < MAX_OTHERS}
              onChange={(v) => setNeeds((n) => ({ ...n, [role]: v }))}
            />
          </Animated.View>
        </Reveal>
      ))}
      {failed ? (
        <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: type.small, textAlign: 'center' }}>Could not save. Check your connection and try again.</Text>
      ) : null}
      <PressScale accessibilityLabel="Save" disabled={saving} onPress={save} style={[styles.cta, { backgroundColor: t.primary, opacity: saving ? 0.6 : 1 }]}>
        <Text style={{ color: t.onPrimary, fontFamily: t.fontBold, fontSize: type.lead }}>{saving ? 'Saving' : 'Save'}</Text>
      </PressScale>
    </Screen>
  );
}

const styles = StyleSheet.create({
  terminal: { padding: space.l, borderRadius: radius.control, gap: space.s, marginTop: space.s },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.s, paddingHorizontal: space.l, borderRadius: radius.control },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  step: { width: 40, height: 40, borderRadius: radius.s, alignItems: 'center', justifyContent: 'center' },
  cta: { height: 56, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', marginTop: space.m },
});
