import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Critter } from '@/components/critters/Critter';
import { critterFor } from '@/components/critters/identity';
import { HashChip } from '@/components/motion/HashChip';
import { useMode } from '@/lib/theme';

import type { Card, PersonCard, ProjectCard, RoleCount } from './cardTypes';

const DARK_INK = '#2A1408';
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Text on a colored art block: dark on light colors like orange and gold, white on deep ones. */
const inkOn = (hex: string) => {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#FFFFFF';
  const l = luminance(hex);
  return (l + 0.05) / (luminance(DARK_INK) + 0.05) > 1.05 / (l + 0.05) ? DARK_INK : '#FFFFFF';
};

const rolesText = (roles: RoleCount[]) => {
  const open = roles.filter((r) => r.open > 0).map((r) => `${r.open} ${r.role}`);
  return open.length ? `Need ${open.join(', ')}` : 'Team is full';
};

function Reason({ text }: { text: string }) {
  const { t } = useMode();
  return (
    <View style={[styles.pill, { backgroundColor: t.accent }]}>
      <Text numberOfLines={1} style={{ color: '#2A1408', fontFamily: t.fontBold, fontSize: 13 }}>
        {text}
      </Text>
    </View>
  );
}

function Reliability({ score }: { score: number }) {
  const { t } = useMode();
  return (
    <View accessibilityLabel={`Shows up score ${score}`} style={styles.score}>
      <Text style={{ color: t.muted, fontFamily: t.fontBold, fontSize: 12 }}>shows up</Text>
      <Text style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: 22 }}>{score}</Text>
    </View>
  );
}

function ProjectBody({ card }: { card: ProjectCard }) {
  const { t } = useMode();
  const art = critterFor(card.ownerBoxPublicKey ?? card.ownerUsername).color;
  const ink = inkOn(art);
  return (
    <>
      <View style={[styles.art, { backgroundColor: art }]}>
        <View style={styles.artCritter}>
          <Critter seed={card.ownerBoxPublicKey ?? card.ownerUsername} size={128} disc={false} color="#FFFFFF" />
        </View>
        <Text style={{ color: ink, fontFamily: t.fontBold, fontSize: 14 }}>
          {card.theme} · {card.timeframe[0]?.toUpperCase()}{card.timeframe.slice(1)}
        </Text>
        <View style={styles.row}>
          <Text style={{ color: ink, fontFamily: t.fontBody, fontSize: 13 }}>
            {card.visibility === 'private' ? 'Private idea' : 'Public idea'}
          </Text>
          <HashChip hash={card.commitHash} solid />
        </View>
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
  const art = critterFor(card.boxPublicKey ?? card.username).color;
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open @${card.username}`} onPress={() => router.push(`/person/${card.username}`)} style={styles.personTop}>
        <Critter seed={card.boxPublicKey ?? card.username} size={72} />
        <View style={styles.personName}>
          <Text numberOfLines={1} style={[styles.title, { color: t.text, fontFamily: t.fontDisplay, fontSize: 26 }]}>
            @{card.username}
          </Text>
          <Text style={[styles.body, { color: t.muted, fontFamily: t.fontBody }]}>
            {card.role}, {card.level}, {card.occupation}
          </Text>
        </View>
      </Pressable>
      <Text numberOfLines={2} style={[styles.body, { color: t.text, fontFamily: t.fontBody }]}>
        {card.skills.join(', ')}
      </Text>
      {prompt ? (
        <View style={[styles.prompt, { backgroundColor: art }]}>
          <Text style={{ color: inkOn(art), fontFamily: t.fontBold, fontSize: 13 }}>{prompt.q}</Text>
          <Text numberOfLines={3} style={{ color: inkOn(art), fontFamily: t.fontDisplay, fontSize: 26 }}>
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
        { backgroundColor: t.surface, shadowColor: t.line },
      ]}>
      {card.isSuper ? (
        <View style={[styles.superBand, { backgroundColor: t.accent }]}>
          <Text style={{ color: '#2A1408', fontFamily: t.fontBold, fontSize: 13 }}>{'\u2605\uFE0E'} {copy.stampUp}</Text>
        </View>
      ) : null}
      {card.kind === 'project' ? <ProjectBody card={card} /> : <PersonBody card={card} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 32,
    padding: 16,
    paddingBottom: 18,
    gap: 10,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 6 },
  },
  superBand: { marginTop: -16, marginHorizontal: -16, paddingTop: 12, paddingBottom: 10, paddingHorizontal: 20, borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  score: { flexDirection: 'row', alignItems: 'baseline', gap: 5, flexShrink: 0 },
  art: { flexGrow: 1, minHeight: 90, borderRadius: 20, padding: 16, justifyContent: 'flex-end', gap: 2 },
  artCritter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 30 },
  body: { fontSize: 16, lineHeight: 22 },
  roles: { fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pill: { flexShrink: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  personTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  personName: { flex: 1, gap: 2 },
  prompt: { flexGrow: 1, borderRadius: 20, padding: 16, gap: 6, justifyContent: 'center' },
});
