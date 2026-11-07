import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Critter } from '@/components/critters/Critter';
import { Hachi } from '@/components/Hachi/Hachi';
import { Segmented } from '@/components/motion/Controls';
import { HashChip } from '@/components/motion/HashChip';
import { PressScale } from '@/components/motion/PressScale';
import { Reveal } from '@/components/motion/Reveal';
import { SampleBadge } from '@/components/motion/SampleBadge';
import { useTabInset } from '@/components/nav/TabBar';
import { demoProjects, type DemoProject } from '@/lib/demoData';
import { useMode } from '@/lib/theme';
import { radius, space, type } from '@/lib/tokens';

const STATUS: Record<DemoProject['status'], string> = { recruiting: 'Recruiting', building: 'Building', private: 'Private idea' };
type Filter = 'all' | 'mine' | 'joined';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'Yours' },
  { value: 'joined', label: 'Joined' },
];

function RoleDots({ project }: { project: DemoProject }) {
  const { t } = useMode();
  return (
    <View style={styles.dots}>
      {project.roles.map((r, i) =>
        r.username ? (
          <View key={`${r.role}${i}`} style={[styles.dotWrap, { borderColor: t.surface, marginLeft: i ? -8 : 0 }]}>
            <Critter seed={r.username} size={34} />
          </View>
        ) : (
          <View key={`${r.role}${i}`} style={[styles.open, { borderColor: t.muted, marginLeft: i ? -4 : 0, backgroundColor: t.surface }]}>
            <Text style={{ color: t.muted, fontFamily: t.fontBold, fontSize: 16 }}>+</Text>
          </View>
        ),
      )}
    </View>
  );
}

function ProjectCard({ project, index }: { project: DemoProject; index: number }) {
  const { t } = useMode();
  const filled = project.roles.filter((r) => r.username).length;
  const need = project.roles.filter((r) => !r.username).map((r) => r.role);
  const tint = project.status === 'private' ? t.muted : project.status === 'building' ? t.like : t.primary;
  return (
    <Reveal index={index + 1}>
      <PressScale
        accessibilityLabel={`Open ${project.title}`}
        onPress={() => router.push(`/project/${project.id}` as Href)}
        style={[styles.card, { backgroundColor: t.surface, shadowColor: t.primary }]}>
        <View style={styles.cardTop}>
          <View style={[styles.status, { backgroundColor: `${tint}22` }]}>
            <Text style={{ color: project.status === 'building' ? t.text : tint, fontFamily: t.fontBold, fontSize: 12 }}>{STATUS[project.status]}</Text>
          </View>
          <HashChip hash={project.commitHash} />
        </View>
        <Text numberOfLines={1} style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: type.title }}>
          {project.title}
        </Text>
        <Text numberOfLines={2} style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.small, lineHeight: 20 }}>
          {project.idea}
        </Text>
        <View style={[styles.track, { backgroundColor: `${t.primary}1A` }]}>
          <View style={[styles.fill, { backgroundColor: t.primary, width: `${(filled / project.roles.length) * 100}%` }]} />
        </View>
        <View style={styles.cardBottom}>
          <RoleDots project={project} />
          <Text numberOfLines={2} style={{ flex: 1, textAlign: 'right', color: need.length ? t.text : t.muted, fontFamily: t.fontBold, fontSize: type.small }}>
            {need.length ? `Needs ${need.join(', ')}` : 'Team is full'}
          </Text>
        </View>
        {project.wantIn ? (
          <PressScale
            accessibilityLabel={`${project.wantIn} builders want in`}
            onPress={() => router.push('/likes')}
            style={[styles.want, { backgroundColor: `${t.primary}1F` }]}>
            <Text style={{ color: t.primary, fontFamily: t.fontBold, fontSize: type.small }}>{project.wantIn} builders want in</Text>
          </PressScale>
        ) : null}
      </PressScale>
    </Reveal>
  );
}

/** Everything you are building. Swipe finds people, Matches talks to them, this is the work. */
export default function ProjectsScreen() {
  const { t, mode } = useMode();
  const { top } = useSafeAreaInsets();
  const inset = useTabInset();
  const [filter, setFilter] = useState<Filter>('all');
  const shown = demoProjects.filter((p) => filter === 'all' || (filter === 'mine' ? p.mine : !p.mine));
  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={[styles.content, { paddingTop: top + space.m, paddingBottom: inset + space.l }]}>
      <View style={styles.head}>
        <Text style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: 34 }}>{mode === 'hack' ? 'repos' : 'Projects'}</Text>
        <Hachi size={56} animated listen sleepAfter={0} />
      </View>
      <Reveal>
        <PressScale
          accessibilityLabel="Post a new project"
          onPress={() => router.push('/project/new' as Href)}
          style={[styles.newCard, { backgroundColor: t.primary }]}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke={t.onPrimary} strokeWidth={3} strokeLinecap="round" />
          </Svg>
          <Text style={{ color: t.onPrimary, fontFamily: t.fontBold, fontSize: type.lead }}>{mode === 'hack' ? 'git init' : 'New project'}</Text>
        </PressScale>
      </Reveal>
      <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      <SampleBadge color={t.bg} background={t.muted} />
      {shown.map((p, i) => (
        <ProjectCard key={p.id} project={p} index={i} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.gutter, gap: space.m },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  newCard: { height: 56, borderRadius: radius.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s },
  card: { padding: space.l, borderRadius: radius.card, gap: space.s + 2, shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  status: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.full },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  dots: { flexDirection: 'row', alignItems: 'center' },
  dotWrap: { borderRadius: 19, borderWidth: 2 },
  open: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  want: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.full },
});
