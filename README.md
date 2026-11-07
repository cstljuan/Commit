# Commit

Swipe to find people to build with. Your idea gets a commit hash.

Built at PlutoHacks XI (Nov 6 to 7, 2026) by Juan (cstljuan), Shahd (shahd06-28) and Niki (nikit07735).

Commit is a swipe app for forming hackathon and project teams. You swipe on projects or people, every card says why it is a fit, and a "shows up" score tracks who finishes what they start. Ideas are committed like code into a hash-chained, signed log, private ideas are encrypted on the phone, reworded copies of a private idea alert only the original author, and match chat is end-to-end encrypted.

## Run it

You need Node 20+, and Expo Go on a phone (or the iOS Simulator).

```bash
npm install
cp .env.example .env   # fill in the values your team lead gives you, never commit .env
npx expo start
```

Scan the QR code with Expo Go. Sign in with a demo account (see `scripts/seed/DEMO-ACCOUNTS.md`).

### Without a backend

The app has a mock API with synthetic sample data, so you can try every screen offline:

```bash
EXPO_PUBLIC_API=mock npx expo start
```

Sample data is labelled "Sample" in the app.

### Environment

`.env` holds only public client values: the Supabase URL and anon key, and the local assistant's URL, key and model name (`EXPO_PUBLIC_LLM_*`). Do not ship a web build with the `EXPO_PUBLIC_LLM_*` values set. Server secrets (service role, the vault checkpoint signing key) live only in Supabase secrets.

## Tests and checks

| Command | What it checks | Needs |
| --- | --- | --- |
| `npx tsc --noEmit` | Typecheck the whole app | nothing |
| `bash scripts/tests/run-all.sh` | 50 unit tests: encryption edge cases, deck filters, the mock API | nothing |
| `npx tsx scripts/test-e2ee.mts` | The real chat encryption code: seal, open, tamper, replay, reflect, key swap | nothing |
| `npx tsx scripts/redteam/anon-probe.mts` | 56 attacks against the hosted backend with no account. Every one must be denied | `.env` |
| `npx tsx scripts/redteam/authed-probe.mts` | 37 attacks from a signed-in QA account (Women mode, backdating, other people's rows) | QA account secrets |
| `npx tsx scripts/e2e/signed-in.mts` | 49 end-to-end checks on hosted, including encrypted chat over Realtime | QA account secrets |
| `npx tsx scripts/e2e/reliability.mts` | Finishing and leaving a team move the score | QA account secrets |
| `npx tsx scripts/e2e/checkpoint.mts` | The server signs a checkpoint of the idea log and the app's pinned key verifies it | QA account secrets |
| `npx tsx scripts/eval/run.mts` | Copy detection eval: 14 of 15 English rewrites caught, 0 of 20 unrelated flagged | service access |
| `npx tsx scripts/seed/reset-demo.mts` | Resets the two demo phones to a known state and prints YES/NO checks | `scripts/.env` |

QA and seed secrets live in a gitignored `scripts/.env` on the backend owner's machine.

## How it is built

- **App:** React Native, Expo SDK 58, Expo Router, TypeScript, Reanimated and Gesture Handler, react-native-svg for all art.
- **Backend:** Supabase. Postgres with row-level security on every table, SECURITY DEFINER functions for swipes, matching, the idea log and reliability, Realtime for chat, Auth. Migrations are in `supabase/migrations` (0001 to 0014), edge functions in `supabase/functions`.
- **Crypto:** tweetnacl on the device, keys in the phone's secure storage.
- **Copy detection:** an edge function embeds the idea with gte-small inside our backend and compares with pgvector.
- **Assistant:** Hachi's chat can use Qwen2.5 1.5B through llama.cpp on a laptop, with an offline fallback.

## Security model, in plain words

**What the server never sees**

- **Chat messages.** Each message is sealed on the phone with NaCl box (X25519, XSalsa20-Poly1305). The database stores `e2e1.<nonce>.<ciphertext>`. The sealed payload names the chat and the sender, so the server cannot replay a message into another chat or bounce your own message back as if the other person wrote it. Turn on **Server view** in a chat to see exactly what is stored.
- **Private idea text at rest.** A private idea is encrypted on the phone with a team key (secretbox). Each member gets the team key wrapped to their own public key.

**What the server can prove but not fake**

- **Who had an idea first.** Every idea writes its SHA-256 hash, a timestamp and the author's Ed25519 signature into a hash-chained log. Changing an old entry breaks every entry after it. The server also signs checkpoints of the log with its own key, and the app pins that public key. The **Verify** screen recomputes the chain on the phone.

**How you know nobody swapped a key**

- The first time you chat with someone, the app pins their key (trust on first use). If the key ever changes, the chat stops sending until you check. Two people can compare a 30-digit safety number and a creature pair on the **Compare** screen. A failed check never falls back to plain text.

**Copy detection without leaking ideas**

- If someone posts a reworded version of a private idea, only the original author is alerted. The person posting learns nothing about other ideas. We built a leaky v1 on purpose for the demo, then fixed it in v2.

**Honest limits**

- A private idea's words pass through our backend once for copy detection and are not kept, but a numeric embedding is kept and can hint at the topic.
- The server sees who talks to whom, when, and roughly how long each message is. It can drop messages. It cannot read or forge them.
- No forward secrecy and no multi-device keys yet: this is not Signal-level, and messages are tied to one phone.
- Copy detection is English-only today (0 of 5 Spanish rewrites caught).
- Women mode is set on the server and cannot be turned on from the app. There is no verification flow yet.

**Try to break it:** the **Attack it** screen lets you play the server and try five attacks on a real encrypted message. Each one runs the real crypto code.

## Demo data

All demo profiles, projects and messages are synthetic.

## Use of AI tools

We used Claude Code and Codex as coding assistants to write, test and review code and to run security checks. Every change was reviewed and committed by a team member under their own GitHub name. The agents' coordination log is public in Issue #1.
