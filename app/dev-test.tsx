import * as Crypto from 'expo-crypto';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import nacl from 'tweetnacl';
import { decodeBase64, decodeUTF8, encodeBase64, encodeUTF8 } from 'tweetnacl-util';

type Row = { name: string; ok: boolean; note?: string };

async function runChecks(): Promise<Row[]> {
  const rows: Row[] = [];
  const check = async (name: string, fn: () => boolean | Promise<boolean>) => {
    try {
      rows.push({ name, ok: await fn() });
    } catch (e) {
      rows.push({ name, ok: false, note: String(e) });
    }
  };
  const message = 'Commit test message';
  await check('random bytes differ', () => {
    const a = encodeBase64(nacl.randomBytes(32));
    const b = encodeBase64(nacl.randomBytes(32));
    return a !== b;
  });
  await check('secretbox round trip', () => {
    const key = nacl.randomBytes(nacl.secretbox.keyLength);
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const box = nacl.secretbox(decodeUTF8(message), nonce, key);
    const out = nacl.secretbox.open(decodeBase64(encodeBase64(box)), nonce, key);
    return !!out && encodeUTF8(out) === message;
  });
  await check('secretbox rejects wrong key', () => {
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const box = nacl.secretbox(decodeUTF8(message), nonce, nacl.randomBytes(32));
    return nacl.secretbox.open(box, nonce, nacl.randomBytes(32)) === null;
  });
  await check('box round trip', () => {
    const a = nacl.box.keyPair();
    const b = nacl.box.keyPair();
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const box = nacl.box(decodeUTF8(message), nonce, b.publicKey, a.secretKey);
    const out = nacl.box.open(box, nonce, a.publicKey, b.secretKey);
    return !!out && encodeUTF8(out) === message;
  });
  await check('sign and verify, tamper fails', () => {
    const k = nacl.sign.keyPair();
    const sig = nacl.sign.detached(decodeUTF8(message), k.secretKey);
    return (
      nacl.sign.detached.verify(decodeUTF8(message), sig, k.publicKey) &&
      !nacl.sign.detached.verify(decodeUTF8(message + '!'), sig, k.publicKey)
    );
  });
  await check('sha-256 known value', async () => {
    const hex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, 'abc');
    return hex === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  });
  return rows;
}

/** Temporary. Delete after test 1 has passed on a real iPhone. */
export default function DevTest() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    runChecks().then(setRows);
  }, []);
  const allOk = rows?.every((r) => r.ok);
  return (
    <View testID="dev-test" style={{ flex: 1, padding: 24, gap: 10 }}>
      <Stack.Screen options={{ title: 'First test' }} />
      <Text className="text-3xl font-bold text-indigo-600">NativeWind class check</Text>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>
        {rows === null ? 'Running...' : allOk ? 'TEST 1: YES' : 'TEST 1: NO'}
      </Text>
      {rows?.map((r) => (
        <Text key={r.name} style={{ fontSize: 16 }}>
          {r.ok ? 'PASS' : 'FAIL'} {r.name} {r.note ?? ''}
        </Text>
      ))}
    </View>
  );
}
