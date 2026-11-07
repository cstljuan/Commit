# Vault checkpoints

`POST /functions/v1/checkpoint` requires a valid signed-in user's bearer token. The request body is ignored. The function reads the current vault head, signs `last_seq|last_entry_hash` with Ed25519, and inserts a checkpoint. It returns 401 for invalid auth, 409 for an empty or malformed head, and 503 for unavailable configuration or storage.

The server needs the Supabase-provided `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and a base64 64-byte Ed25519 `SERVER_SIGNING_SECRET` in Supabase secrets. The private key never belongs in git, Drive, app config, shell arguments, or chat.

After the team's Supabase project is confirmed, provision once from the repository root:

```sh
npx tsx supabase/functions/checkpoint/provision.mts CONFIRMED_PROJECT_REF
```

The helper first checks for an existing secret and app pin, refuses to overwrite either, and sends the newly generated secret through stdin to the Supabase CLI. It writes only the public verification key into `lib/vault.ts`. Commit and push that public-key change, then deploy `checkpoint` to the same confirmed project. If provisioning succeeds but the public file cannot be written, the helper reports the public key so it can be pinned manually. Do not rerun provisioning or replace the stored secret.

Call the endpoint after each successful vault append and on demand with `supabase.functions.invoke('checkpoint')`. Clients must configure the cyber singleton with `configureCyberClient(supabase)` before using vault or team-key functions. A missing checkpoint or empty public-key pin produces a failed verification result, never a green proof.

A checkpoint anchors the row at `last_seq`, even if later uncheckpointed entries exist. The verifier requires that row and its exact hash to still exist (F15). Global-chain reads are paginated. Registered profile keys cannot be replaced by profile updates. The public `vault_signing_keys()` RPC reveals only signing keys for existing vault authors, so Women profile visibility does not interfere with signature verification.

## Verification

From the repository root:

```sh
npx tsc --noEmit
npx tsx --test supabase/functions/checkpoint/handler.test.mts
deno check --no-config supabase/functions/checkpoint/index.ts
node supabase/functions/checkpoint/test-crypto.cjs
node supabase/functions/checkpoint/test-provision.cjs
```

For local database tests, reuse a test-only installation of `@electric-sql/pglite`. Set `PGLITE_TEST_MODULES` to that installation's parent directory. This is optional test tooling and is not an app dependency:

```sh
PGLITE_TEST_MODULES=/path/to/test-tooling node supabase/functions/checkpoint/test-rls.cjs
```

The local database test uses `test-schema.sql`, a synthetic contract fixture, with Supabase-style roles and `auth.uid()` stubs. It applies the real 0002, 0003 and 0005 migration files. It reproduces the F1/F3 failures, proves the fixes, and checks outsider/team/match/Women policies. It is not a hosted Supabase test. Crypto tests execute the real libraries with native SecureStore and Expo hashing adapters replaced by in-memory storage and Node SHA-256. They use real tweetnacl encryption and signatures.

Hosted acceptance remains: apply Shahd's actual 0001/0004 with these migrations in number order, test outsider requests using real sessions, provision and deploy the signer, append from the phone, edit `ts` through the dashboard, and confirm Verify fails at that entry. Restore `ts` and confirm green. Also delete the checkpointed tail in a disposable synthetic fixture and confirm `checkpoint invalid`.

Limitations: a server administrator controls the database and signer. This is tamper evidence against the app's pinned checkpoint and device signatures, not an independent external witness. Key recovery, cross-device key transfer, and key rotation are not implemented. Local checks do not prove the real phone's native storage or a hosted project's policies.
