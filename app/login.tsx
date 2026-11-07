import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Tako } from '@/components/Tako/Tako';
import { Wordmark } from '@/components/brand/Wordmark';
import { signInWithPassword, signInWithProvider } from '@/components/forms/authApi';
import { EMAIL_RE, authStyles as styles, routeAfterSignIn } from '@/components/forms/authFlow';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { authProviders } from '@/lib/api';
import { useMode } from '@/lib/theme';

type Provider = 'github' | 'google';

export default function SignInScreen() {
  const { t } = useMode();
  const router = useRouter();
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [providerBusy, setProviderBusy] = useState<Provider | null>(null);
  const [social, setSocial] = useState({ github: false, google: false });

  useEffect(() => {
    authProviders().then(setSocial).catch(() => {});
  }, []);

  const working = busy || providerBusy !== null;

  async function signIn() {
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) return setError('Enter a full email, like you@email.com');
    if (!password) return setError('Enter your password.');
    setError(null);
    setBusy(true);
    try {
      await signInWithPassword(e, password);
      await routeAfterSignIn(router);
    } catch {
      setError('Wrong email or password.');
    } finally {
      setBusy(false);
    }
  }

  async function withProvider(p: Provider) {
    setError(null);
    setProviderBusy(p);
    try {
      await signInWithProvider(p);
      await routeAfterSignIn(router);
    } catch {
      setError(`${p === 'github' ? 'GitHub' : 'Google'} sign-in did not finish. Try again.`);
    } finally {
      setProviderBusy(null);
    }
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.stack}>
            <View style={styles.hero}>
              <Tako state="idle" size={72} />
              <Wordmark height={52} />
              <Text style={[styles.sub, { color: t.muted, fontFamily: t.fontBody }]}>Sign in to find your team.</Text>
            </View>

            <TextField
              label="Email"
              placeholder="you@email.com"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (error) setError(null);
              }}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!working}
            />
            <TextField
              ref={passwordRef}
              label="Password"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                if (error) setError(null);
              }}
              secureTextEntry
              textContentType="password"
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={signIn}
              editable={!working}
            />
            {error ? (
              <Text accessibilityLiveRegion="polite" style={[styles.center, { color: t.pass, fontFamily: t.fontBold }]}>
                {error}
              </Text>
            ) : null}
            <Button testID="login-sign-in" label="Sign in" onPress={signIn} loading={busy} disabled={working} />

            {social.github || social.google ? (
              <View style={styles.dividerRow}>
                <View style={[styles.divider, { backgroundColor: t.line }]} />
                <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 14 }}>or</Text>
                <View style={[styles.divider, { backgroundColor: t.line }]} />
              </View>
            ) : null}
            {social.github ? (
              <Button variant="outline" label="Continue with GitHub" onPress={() => withProvider('github')} loading={providerBusy === 'github'} disabled={working} />
            ) : null}
            {social.google ? (
              <Button variant="outline" label="Continue with Google" onPress={() => withProvider('google')} loading={providerBusy === 'google'} disabled={working} />
            ) : null}

            <View style={styles.footer}>
              <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 15 }}>New to Commit?</Text>
              <Pressable testID="login-go-signup" onPress={() => router.push('/signup')} hitSlop={10} disabled={working}>
                <Text style={{ color: t.primary, fontFamily: t.fontBold, fontSize: 15 }}>Create account</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
