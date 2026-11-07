import { Stack, useRouter } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Tako } from '@/components/Tako/Tako';
import { EMAIL_RE, MIN_PASSWORD, authStyles as styles, routeAfterSignIn } from '@/components/forms/authFlow';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { signUpWithPassword } from '@/lib/api';
import { useMode } from '@/lib/theme';

type Field = 'email' | 'password' | 'confirm';

export default function SignUpScreen() {
  const { t } = useMode();
  const router = useRouter();
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clear = (f: Field) => {
    if (errors[f]) setErrors((e) => ({ ...e, [f]: undefined }));
    if (formError) setFormError(null);
  };

  async function create() {
    const e = email.trim().toLowerCase();
    const next: Partial<Record<Field, string>> = {};
    if (!EMAIL_RE.test(e)) next.email = 'Enter a full email, like you@email.com';
    if (password.length < MIN_PASSWORD) next.password = `At least ${MIN_PASSWORD} characters.`;
    if (!next.password && confirm !== password) next.confirm = 'The passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    setFormError(null);
    try {
      const { needsConfirmation } = await signUpWithPassword(e, password);
      if (needsConfirmation) setFormError('Account made. Confirm it from your email, then sign in.');
      else await routeAfterSignIn(router);
    } catch (err) {
      const msg = String((err as Error)?.message ?? '').toLowerCase();
      setFormError(msg.includes('registered') || msg.includes('exists') ? 'That email already has an account. Sign in instead.' : 'Could not create the account. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const goSignIn = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.stack}>
            <View style={styles.hero}>
              <Tako state="idle" size={64} />
              <Text style={[styles.title, { color: t.text, fontFamily: t.fontDisplay }]}>Create your account</Text>
              <Text style={[styles.sub, { color: t.muted, fontFamily: t.fontBody }]}>You pick your username next.</Text>
            </View>

            <TextField
              ref={emailRef}
              label="Email"
              placeholder="you@email.com"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                clear('email');
              }}
              error={errors.email}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!busy}
            />
            <TextField
              ref={passwordRef}
              label="Password"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                clear('password');
              }}
              error={errors.password}
              hint={`At least ${MIN_PASSWORD} characters.`}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              editable={!busy}
            />
            <TextField
              ref={confirmRef}
              label="Confirm password"
              value={confirm}
              onChangeText={(v) => {
                setConfirm(v);
                clear('confirm');
              }}
              error={errors.confirm}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={create}
              editable={!busy}
            />
            {formError ? (
              <Text accessibilityLiveRegion="polite" style={[styles.center, { color: t.pass, fontFamily: t.fontBold }]}>
                {formError}
              </Text>
            ) : null}
            <Button testID="signup-create" label="Create account" onPress={create} loading={busy} disabled={busy} />

            <View style={styles.footer}>
              <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 15 }}>Already have an account?</Text>
              <Pressable testID="signup-go-login" onPress={goSignIn} hitSlop={10} disabled={busy}>
                <Text style={{ color: t.primary, fontFamily: t.fontBold, fontSize: 15 }}>Sign in</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
