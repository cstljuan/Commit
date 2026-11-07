import type { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { getMyProfile } from '@/lib/api';
import { getDeviceKeyState } from '@/lib/vault';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
export const MIN_PASSWORD = 6;

/** Where a signed-in person goes next: profile setup (with the username they picked), device keys, or the app. */
export async function routeAfterSignIn(router: ReturnType<typeof useRouter>, username?: string) {
  const profile = await getMyProfile().catch(() => null);
  if (!profile) {
    router.replace(username ? { pathname: '/onboarding/profile', params: { username } } : '/onboarding/profile');
    return;
  }
  const keys = await getDeviceKeyState().catch(() => 'ready');
  router.replace(keys === 'new' || keys === 'register' ? '/onboarding/keys' : '/(tabs)');
}

export const authStyles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  stack: { gap: 14, width: '100%', maxWidth: 420, alignSelf: 'center' },
  hero: { alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { fontSize: 30, textAlign: 'center' },
  sub: { fontSize: 17, textAlign: 'center', lineHeight: 24 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 2 },
  divider: { flex: 1, height: 1 },
  center: { textAlign: 'center', fontSize: 15 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 6 },
});
