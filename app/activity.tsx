import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Critter } from '@/components/critters/Critter';
import { Hachi } from '@/components/Hachi/Hachi';
import { PressScale } from '@/components/motion/PressScale';
import { Reveal } from '@/components/motion/Reveal';
import { SampleBadge } from '@/components/motion/SampleBadge';
import { Screen } from '@/components/nav/Screen';
import { API_IS_MOCK, getActivity } from '@/lib/api';
import type { DemoEvent } from '@/lib/demoData';
import { useMode } from '@/lib/theme';
import { radius, space, type } from '@/lib/tokens';

const BADGE: Record<DemoEvent['kind'], string> = {
  alert: 'M12 4l9 16H3zM12 10v4M12 17h0.01',
  super: 'M12 3l2.8 5.9 6.2.8-4.6 4.3 1.2 6.3L12 17.2 6.4 20.3l1.2-6.3L3 9.7l6.2-.8z',
  match: 'M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z',
  team: 'M5 12l5 5L20 7',
  commit: 'M12 3v6M12 15v6M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6z',
};

function Row({ event, index }: { event: DemoEvent; index: number }) {
  const { t } = useMode();
  const hot = event.kind === 'alert' || event.kind === 'super';
  const tint = event.kind === 'alert' ? t.pass : t.primary;
  return (
    <Reveal index={index}>
      <PressScale accessibilityLabel={event.title} onPress={() => router.push(event.href as Href)} style={[styles.row, { backgroundColor: hot ? `${tint}14` : t.surface }]}>
        <View>
          {event.kind === 'alert' ? <Hachi size={48} state="guard" animated interactive={false} /> : <Critter seed={event.seed} size={48} />}
          <View style={[styles.badge, { backgroundColor: tint }]}>
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
              <Path d={BADGE[event.kind]} stroke={event.kind === 'alert' ? t.bg : t.onPrimary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
        </View>
        <View style={styles.text}>
          <Text style={{ color: t.text, fontFamily: t.fontBold, fontSize: type.body }}>{event.title}</Text>
          <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.small }}>{event.when}</Text>
        </View>
      </PressScale>
    </Reveal>
  );
}

export default function ActivityScreen() {
  const { t } = useMode();
  const [events, setEvents] = useState<DemoEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    getActivity()
      .then(setEvents)
      .catch(() => setFailed(true));
  }, []);
  const line = failed ? 'Could not load your activity. Check your connection.' : events ? 'Nothing yet. Matches, commits and alerts show up here.' : 'Loading';
  return (
    <Screen title="Activity">
      {API_IS_MOCK ? <SampleBadge color={t.bg} background={t.muted} /> : null}
      {events?.length ? (
        events.map((e, i) => <Row key={e.id} event={e} index={i} />)
      ) : (
        <View style={styles.empty}>
          <Hachi size={96} state={failed ? 'confused' : events ? 'idle' : 'thinking'} animated />
          <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: type.body, textAlign: 'center' }}>{line}</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, borderRadius: radius.card },
  empty: { alignItems: 'center', gap: space.m, paddingVertical: space.xl },
  text: { flex: 1, gap: 2 },
  badge: { position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
