import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tako } from '@/components/Tako/Tako';
import { API_IS_MOCK } from '@/lib/api';
import { useMode } from '@/lib/theme';
import { getDeviceKeyState, registerDeviceKeys, type DeviceKeyState } from '@/lib/vault';

type Status = DeviceKeyState | 'loading' | 'saving' | 'error';
export default function KeysScreen() {
  const { t } = useMode();
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');
  async function inspect() {
    setStatus('loading');
    setError('');
    try { setStatus(await getDeviceKeyState()); }
    catch { setError('We could not check your account keys. Sign in and try again.'); setStatus('error'); }
  }
  useEffect(() => {
    let active = true;
    // Sample data has no account, so there is nothing to check: keys count as ready.
    if (API_IS_MOCK) { setStatus('ready'); return; }
    getDeviceKeyState().then(state => { if (active) setStatus(state); }).catch(() => {
      if (active) { setError('We could not check your account keys. Sign in and try again.'); setStatus('error'); }
    });
    return () => { active = false; };
  }, []);
  async function create() {
    if (status !== 'new' && status !== 'register') return;
    setStatus('saving');
    try { await registerDeviceKeys(); setStatus(await getDeviceKeyState()); }
    catch { setError('Your keys were preserved. We could not register them. Try checking again.'); setStatus('error'); }
  }
  const busy = status === 'loading' || status === 'saving';
  const title = status === 'ready' ? 'Your keys are ready' : status === 'other-device' ? 'Use your original device' : 'Your ideas, your keys';
  const detail = status === 'ready' ? 'Your existing keys match this account. You can sign ideas and open ideas shared with your team.'
    : status === 'other-device' ? "This account's keys are on another device. Open Commit on that device to sign ideas or read private team ideas. Your existing keys have been preserved."
    : 'Commit keeps your signing and encryption keys in secure storage on this phone. Keep this device to access your private ideas. Key recovery is not available yet.';
  return <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'bottom']}>
    <Stack.Screen options={{ headerShown: false }} />
    <ScrollView contentContainerStyle={styles.content}>
    <View style={{ alignItems: 'center', marginBottom: 8 }}><Tako state={status === 'error' ? 'alert' : 'idle'} size={88} /></View>
    <View style={[styles.panel, { backgroundColor: t.surface }]}>
      <Text accessibilityRole="header" style={{ color: t.text, fontFamily: t.fontDisplay, fontSize: 32 }}>{title}</Text>
      <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 17, lineHeight: 25 }}>{detail}</Text>
      {busy && <ActivityIndicator accessibilityLabel="Checking device keys" color={t.primary} />}
      {error !== '' && <Text accessibilityRole="alert" style={{ color: t.text, fontFamily: t.fontBody }}>{error}</Text>}
      {(status === 'new' || status === 'register') && <Pressable accessibilityRole="button" onPress={create}
        style={[styles.button, { backgroundColor: t.primary }]}>
        <Text style={{ color: t.onPrimary, fontFamily: t.fontBold }}>{status === 'register' ? 'Register existing keys' : 'Create my device keys'}</Text>
      </Pressable>}
      {status === 'ready' && <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)')}
        style={[styles.button, { backgroundColor: t.primary }]}>
        <Text style={{ color: t.onPrimary, fontFamily: t.fontBold }}>Continue</Text>
      </Pressable>}
      {(status === 'error' || status === 'other-device') && <Pressable accessibilityRole="button" onPress={inspect}
        style={[styles.button, { backgroundColor: t.line }]}>
        <Text style={{ color: t.text, fontFamily: t.fontBold }}>Check again</Text>
      </Pressable>}
      {status === 'error' && <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)')} style={styles.button}>
        <Text style={{ color: t.muted, fontFamily: t.fontBold }}>Skip for now, set up keys later in Security</Text>
      </Pressable>}
    </View>
  </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  panel: { gap: 22, padding: 24, borderRadius: 24 },
  button: { minHeight: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', padding: 16 },
});
