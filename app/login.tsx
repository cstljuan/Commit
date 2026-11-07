import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Tako } from '@/components/Tako/Tako';
import { sendEmailCode, signInWithPassword, signInWithProvider, verifyEmailCode } from '@/components/forms/authApi';
import { authProviders, getMyProfile, signUpWithPassword } from '@/lib/api';
import { getDeviceKeyState } from '@/lib/vault';
import { Wordmark } from '@/components/brand/Wordmark';
import { Button } from '@/components/ui/Button';
import { CodeInput } from '@/components/ui/CodeInput';
import { TextField } from '@/components/ui/TextField';
import { useMode } from '@/lib/theme';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Step = 'email' | 'code';
type CodeError = 'wrong' | 'expired' | 'other' | null;
type Provider = 'github' | 'google';

function classifyCodeError(e: unknown): CodeError {
  const err = e as { code?: string; message?: string };
  const text = `${err?.code ?? ''} ${err?.message ?? ''}`.toLowerCase();
  if (text.includes('expired')) return 'expired';
  if (text.includes('invalid') || text.includes('otp') || text.includes('token')) return 'wrong';
  return 'other';
}

export default function LoginScreen() {
  const { t } = useMode();
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<CodeError>(null);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [resent, setResent] = useState(false);

  const [providerBusy, setProviderBusy] = useState<Provider | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);

  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const trimmed = email.trim().toLowerCase();
  const emailValid = EMAIL_RE.test(trimmed);
  const busy = sending || verifying || providerBusy !== null;

  // Resend countdown.
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const done = async () => {
    const profile = await getMyProfile().catch(() => null);
    if (!profile) return router.replace('/onboarding/profile');
    const keys = await getDeviceKeyState().catch(() => 'ready');
    router.replace(keys === 'new' || keys === 'register' ? '/onboarding/keys' : '/(tabs)');
  };
  const [social, setSocial] = useState({ github: false, google: false });
  useEffect(() => {
    authProviders().then(setSocial).catch(() => {});
  }, []);
  const [password, setPassword] = useState('');
  // Email codes only reach verified inboxes until the mail domain is verified, so password is the default.
  const [usePassword, setUsePassword] = useState(true);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const withPassword = async () => {
    setPasswordBusy(true);
    setPasswordError(null);
    try {
      await signInWithPassword(email.trim().toLowerCase(), password);
      await done();
    } catch {
      setPasswordError('That email and password did not work.');
    } finally {
      setPasswordBusy(false);
    }
  };

  const createAccount = async () => {
    setPasswordBusy(true);
    setPasswordError(null);
    try {
      const { needsConfirmation } = await signUpWithPassword(trimmed, password);
      if (needsConfirmation) setPasswordError('Account made. Confirm it from your email, then sign in.');
      else await done();
    } catch (e) {
      setPasswordError((e as Error).message || 'Could not create that account.');
    } finally {
      setPasswordBusy(false);
    }
  };

  async function sendCode(isResend = false) {
    if (!emailValid) {
      setEmailError('Enter a full email, like you@email.com');
      return;
    }
    setEmailError(null);
    setSending(true);
    try {
      await sendEmailCode(trimmed);
      setStep('code');
      setCode('');
      setCodeError(null);
      setResent(isResend);
      setResendIn(RESEND_SECONDS);
    } catch {
      if (isResend) setCodeError('other');
      else {
        // Codes only reach verified inboxes for now, so offer the password path right away.
        setEmailError('We could not email that address yet. Use a password, GitHub or Google.');
        setUsePassword(true);
      }
    } finally {
      setSending(false);
    }
  }

  async function verify(value: string) {
    setVerifying(true);
    setCodeError(null);
    try {
      await verifyEmailCode(trimmed, value);
      done();
    } catch (e) {
      setCodeError(classifyCodeError(e));
      setCode('');
    } finally {
      setVerifying(false);
    }
  }

  function onCodeChange(v: string) {
    setCode(v);
    if (codeError) setCodeError(null);
    if (v.length === CODE_LENGTH && !verifying) verify(v);
  }

  async function withProvider(p: Provider) {
    setProviderError(null);
    setProviderBusy(p);
    try {
      await signInWithProvider(p);
      done();
    } catch {
      setProviderError(`${p === 'github' ? 'GitHub' : 'Google'} sign-in did not finish. Try again or use email.`);
    } finally {
      setProviderBusy(null);
    }
  }

  const codeMessage =
    codeError === 'wrong'
      ? 'That code is not right. Check the email and try again.'
      : codeError === 'expired'
        ? 'That code expired. Send a new one below.'
        : codeError === 'other'
          ? 'Something went wrong. Try again in a moment.'
          : null;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {step === 'email' ? (
            <View style={styles.stack}>
              <View style={styles.hero}>
                <Tako state="idle" size={88} />
                <Wordmark height={64} />
                <Text style={[styles.sub, { color: t.muted, fontFamily: t.fontBody }]}>
                  Swipe to find your team.
                </Text>
              </View>

              {social.github ? (
                <Button variant="outline" label="Continue with GitHub" onPress={() => withProvider('github')} loading={providerBusy === 'github'} disabled={busy} />
              ) : null}
              {social.google ? (
                <Button variant="outline" label="Continue with Google" onPress={() => withProvider('google')} loading={providerBusy === 'google'} disabled={busy} />
              ) : null}
              {providerError ? (
                <Text accessibilityLiveRegion="polite" style={[styles.center, { color: t.pass, fontFamily: t.fontBold }]}>
                  {providerError}
                </Text>
              ) : null}
              {social.github || social.google ? (
                <View style={styles.dividerRow}>
                  <View style={[styles.divider, { backgroundColor: t.line }]} />
                  <Text style={{ color: t.muted, fontFamily: t.fontBody, fontSize: 14 }}>or use email</Text>
                  <View style={[styles.divider, { backgroundColor: t.line }]} />
                </View>
              ) : null}

              <TextField
                ref={emailRef}
                label="Email"
                placeholder="you@email.com"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (emailError) setEmailError(null);
                }}
                error={emailError}
                hint={usePassword ? 'New here? Create account works right away.' : 'Codes reach verified inboxes only for now.'}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType={usePassword ? 'next' : 'send'}
                onSubmitEditing={() => (usePassword ? undefined : sendCode())}
                editable={!busy}
              />
              {usePassword ? (
                <>
                  <TextField
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    error={passwordError}
                    secureTextEntry
                    textContentType="password"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Button label="Sign in" onPress={withPassword} loading={passwordBusy} disabled={!emailValid || !password || passwordBusy} />
                  <Button label="Create account" variant="outline" onPress={createAccount} disabled={!emailValid || password.length < 6 || passwordBusy} />
                </>
              ) : (
                <Button
                  testID="login-send-code"
                  label="Send code"
                  onPress={() => sendCode()}
                  loading={sending}
                  disabled={!emailValid || busy}
                />
              )}
              <Button variant="ghost" label={usePassword ? 'Use an email code instead' : 'Use a password instead'} onPress={() => setUsePassword((v) => !v)} />
            </View>
          ) : (
            <View style={styles.stack}>
              <View style={styles.hero}>
                <Tako state={codeError === 'wrong' || codeError === 'expired' ? 'alert' : 'idle'} size={72} />
                <Text style={[styles.title, styles.titleSmall, { color: t.text, fontFamily: t.fontDisplay }]}>
                  Check your email
                </Text>
                <Text style={[styles.sub, { color: t.muted, fontFamily: t.fontBody }]}>
                  Enter the 6-digit code we sent to{'\n'}
                  <Text style={{ color: t.text, fontFamily: t.fontBold }}>{trimmed}</Text>
                </Text>
              </View>

              <CodeInput value={code} onChange={onCodeChange} error={!!codeError} disabled={verifying} />

              {codeMessage ? (
                <Text accessibilityLiveRegion="polite" style={[styles.center, { color: t.pass, fontFamily: t.fontBold }]}>
                  {codeMessage}
                </Text>
              ) : resent ? (
                <Text style={[styles.center, { color: t.muted, fontFamily: t.fontBody }]}>New code sent.</Text>
              ) : null}

              <Button
                testID="login-verify"
                label="Continue"
                onPress={() => verify(code)}
                loading={verifying}
                disabled={code.length !== CODE_LENGTH || busy}
              />

              <View style={styles.links}>
                <Button
                  variant="ghost"
                  label={resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                  onPress={() => sendCode(true)}
                  disabled={resendIn > 0 || busy}
                  loading={sending}
                />
                <Button
                  variant="ghost"
                  label="Use a different email"
                  onPress={() => {
                    setStep('email');
                    setCode('');
                    setCodeError(null);
                    setTimeout(() => emailRef.current?.focus(), 50);
                  }}
                  disabled={busy}
                />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  stack: { gap: 16, width: '100%', maxWidth: 420, alignSelf: 'center' },
  hero: { alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { fontSize: 40, textAlign: 'center' },
  titleSmall: { fontSize: 30 },
  sub: { fontSize: 17, textAlign: 'center', lineHeight: 24 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  divider: { flex: 1, height: 1 },
  center: { textAlign: 'center', fontSize: 15 },
  links: { alignItems: 'center', gap: 2 },
});
