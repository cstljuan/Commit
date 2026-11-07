// Deno resolves pinned npm imports; the Expo TypeScript resolver does not.
// @ts-ignore Deno npm specifier
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
// @ts-ignore Deno npm specifier
import nacl from 'npm:tweetnacl@1.0.3';
// @ts-ignore Deno npm specifier
import util from 'npm:tweetnacl-util@0.15.1';
// @ts-ignore Deno requires the .ts extension
import { createCheckpointHandler, type Checkpoint, type Head } from './handler.ts';

const { decodeBase64, decodeUTF8, encodeBase64 } = util;
const runtime = (globalThis as unknown as { Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
} }).Deno;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
let handler: ReturnType<typeof createCheckpointHandler> | undefined;
function initialize() {
  const url = runtime.env.get('SUPABASE_URL');
  const anon = runtime.env.get('SUPABASE_ANON_KEY');
  const service = runtime.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const secret = runtime.env.get('SERVER_SIGNING_SECRET');
  if (!url || !anon || !service || !secret) throw new Error('Missing checkpoint configuration');
  const signingKey = decodeBase64(secret);
  if (signingKey.length !== nacl.sign.secretKeyLength) throw new Error('Invalid checkpoint configuration');
  const pair = nacl.sign.keyPair.fromSeed(signingKey.subarray(0, nacl.sign.seedLength));
  if (!nacl.verify(pair.secretKey, signingKey)) throw new Error('Invalid checkpoint configuration');
  const auth = createClient(url, anon, options);
  const admin = createClient(url, service, options);
  return createCheckpointHandler({
    async authenticate(token: string) {
      const { data, error } = await auth.auth.getUser(token);
      return !error && Boolean(data.user);
    },
    async readHead(): Promise<Head | null> {
      const { data, error } = await admin.from('vault_log').select('seq,entry_hash').order('seq', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    sign(content: string): string { return encodeBase64(nacl.sign.detached(decodeUTF8(content), signingKey)); },
    async insert(value: Checkpoint) {
      const { error } = await admin.from('vault_checkpoints').insert(value);
      if (error) throw error;
    },
  });
}
runtime.serve(async request => {
  try { handler ??= initialize(); return await handler(request); }
  catch { return Response.json({ error: 'Checkpoint unavailable' }, { status: 503 }); }
});
