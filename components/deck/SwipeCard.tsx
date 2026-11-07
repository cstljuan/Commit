import { StyleSheet, Text, View } from 'react-native';

import { Tako } from '@/components/Tako/Tako';
import { useMode } from '@/lib/theme';

import type { Card, PersonCard, ProjectCard, RoleCount } from './cardTypes';

const rolesText = (roles: RoleCount[]) => {
  const open = roles.filter((r) => r.open > 0).map((r) => `${r.open} ${r.role}`);
  return open.length ? `Need ${open.join(', ')}` : 'Team is full';
};

function Reason({ text }: { text: string }) {
  const { t } = useMode();
  return (
    <View style={[styles.pill, { backgroundColor: t.like + '2E' }]}>
      <Text numberOfLines={1} style={{ color: t.text, fontFamily: t.fontBold, fontSize: 13 }}>
        {text}
      </Text>
    </View>
  );
}

function Reliability({ score }: { score: number }) {
  const { t } = useMode();
  return (
    <Text style={{ color: t.muted, fontFamily: t.fontBold, fontSize: 13 }}>Shows up {score}</Text>
  );
}

function ProjectBody({ card }: { card: ProjectCard }) {
  const { t } = useMode();
  return (
    <>
      <View style={[styles.art, { backgroundColor: t.primary + '24' }]}>
        <View style={styles.artTako}>
          <Tako size={112} state="idle" />
        </View>
        <Text style={{ color: t.primary, fontFamily: t.fontBold, fontSize: 13 }}>
          {card.theme} · {card.timeframe}
        </Text>
        <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 13 }}>
          {card.visibility === 'private' ? 'Private idea' : 'Public idea'} · commit {card.commitHash}
        </Text>
      </View>
      <Text numberOfLines={2} style={[styles.title, { color: t.text, fontFamily: t.fontDisplay }]}>
        {card.title}
      </Text>
      <Text numberOfLines={3} style={[styles.body, { color: t.muted, fontFamily: t.fontBody }]}>
        {card.teaser}
      </Text>
      <Text style={[styles.roles, { color: t.text, fontFamily: t.fontBold }]}>{rolesText(card.roles)}</Text>
      <View style={styles.row}>
        <Reason text={card.reason} />
        <Reliability score={card.ownerReliability} />
      </View>
    </>
  );
}

function PersonBody({ card }: { card: PersonCard }) {
  const { t } = useMode();
  const prompt = card.prompts[0];
  return (
    <>
      <View style={styles.personTop}>
        <View style={[styles.avatar, { backgroundColor: t.primary }]}>
          <Text style={{ color: t.onPrimary, fontFamily: t.fontDisplay, fontSize: 30 }}>
            {card.username[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.personName}>
          <Text numberOfLines={1} style={[styles.title, { color: t.text, fontFamily: t.fontDisplay, fontSize: 26 }]}>
            @{card.username}
          </Text>
          <Text style={[styles.body, { color: t.muted, fontFamily: t.fontBody }]}>
            {card.role}, {card.level}, {card.occupation}
          </Text>
        </View>
      </View>
      <Text numberOfLines={2} style={[styles.body, { color: t.text, fontFamily: t.fontBody }]}>
        {card.skills.join(', ')}
      </Text>
      {prompt ? (
        <View style={[styles.prompt, { backgroundColor: t.primary + '14' }]}>
          <Text style={{ color: t.muted, fontFamily: t.fontBold, fontSize: 13 }}>{prompt.q}</Text>
          <Text numberOfLines={2} style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: 22 }}>
            {prompt.a}
          </Text>
        </View>
      ) : null}
      {card.rolesNeeded ? (
        <Text style={[styles.roles, { color: t.text, fontFamily: t.fontBold }]}>{rolesText(card.rolesNeeded)}</Text>
      ) : null}
      <View style={styles.row}>
        <Reason text={card.reason} />
        <Reliability score={card.reliability} />
      </View>
    </>
  );
}

export function SwipeCard({ card }: { card: Card }) {
  const { t, copy } = useMode();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: t.surface, shadowColor: t.primary },
        card.isSuper && { borderColor: t.accent, borderWidth: 3 },
      ]}>
      {card.isSuper ? (
        <Text style={{ color: t.primary, fontFamily: t.fontBold, fontSize: 13 }}>{copy.stampUp}</Text>
      ) : null}
      {card.kind === 'project' ? <ProjectBody card={card} /> : <PersonBody card={card} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 32,
    padding: 24,
    gap: 12,
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  art: { flexGrow: 1, minHeight: 90, borderRadius: 20, padding: 16, justifyContent: 'flex-end', gap: 2 },
  artTako: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 30 },
  body: { fontSize: 16, lineHeight: 22 },
  roles: { fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pill: { flexShrink: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  personTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  personName: { flex: 1, gap: 2 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  prompt: { flexGrow: 1, borderRadius: 20, padding: 16, gap: 6, justifyContent: 'center' },
});
