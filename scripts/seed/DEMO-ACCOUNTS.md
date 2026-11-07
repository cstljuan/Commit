# Demo accounts

All demo data is synthetic. Passwords live only in `scripts/.env` (never committed): `DEMO_ALICE_PASSWORD`, `DEMO_BOB_PASSWORD`, and `SEED_USER_PASSWORD` for the synthetic users.

## The two phones

| Who | Username | Email | Role |
| --- | --- | --- | --- |
| Alice | alice_ships | alice@commit-demo.dev | Frontend, owns Pocket Tutor |
| Bob | bob_builds | bob@commit-demo.dev | Backend, the judge's phone |

What each shows after a reset:

- **Bob**
  - Normal deck: Alice's **Pocket Tutor** is the first card. Alice has already liked Bob for it, so Bob's right swipe is an instant match.
  - **Who wants you**: 3 cards, one of them a Super Commit (from the rio and omar hack teams, plus Alice's like). Cards show role and level only, never a name.
  - **Matches**: one sample match with priya_pixels on "Sticker Lab", with a short plain chat (3 messages), so the tab is not empty.
  - No swipes yet, no device keys yet.
- **Alice**
  - Owns Pocket Tutor (public idea).
  - **Copy alert** on Pocket Tutor: a synthetic user (sam_ships_ml) posted a close rewrite, "Quiz My Notes", through `post_idea_v1`. The rewrite is hidden, so it never appears in any deck. Alice learns that someone copied, never who.
  - No device keys yet.
- Both start with **no device keys**, so each phone goes through the keys screen once.

## Synthetic users

16 more accounts at `<name>@commit-demo.dev` (priya, kenji, sam, miguel, dana, ola, lee, nina, zara, aisha, mei, fatima, rio, tess, omar, lina). Defined in `scripts/seed/data.mts`. Women mode members: nina, zara, aisha, mei, fatima. Their projects **Courtside** and **Sublet Sync** are normal posts in the Women deck and never show in Normal.

## Live demo plan (two phones)

1. Run the reset (below) shortly before the demo, and wait for "All YES".
2. On both phones, open the app in Expo Go. If a phone was signed in before the reset, sign out first (a reset can recreate the account with a new id).
3. Phone 1 signs in as Alice, phone 2 as Bob.
4. Each phone goes through the keys screen once and registers its device keys.
5. Optional on Bob: show Who wants you (3 cards, one Super Commit) and the Matches tab (priya).
6. Optional on Alice: show the copy alert on Pocket Tutor.
7. Bob swipes right on Pocket Tutor (first card in Normal). It is a match on both phones.
8. Open the new match and chat. Turn on **Server view** to show the server only stores sealed `e2e1.` ciphertext. (The priya sample chat is plain on purpose, because Bob has no keys before the demo, which makes a useful contrast.)

## Reset (one command)

```
npx tsx scripts/seed/reset-demo.mts
```

It is idempotent. It:

- deletes QA accounts (`@qa-commit.dev`) and their projects, swipes, matches and chat rows (projects with vault entries are kept and reported, F3);
- makes sure Alice and Bob have no device keys: keys cannot be replaced once set (F11), so an account with keys and no vault entries is deleted and recreated with the same email and password. An account with vault entries is left alone and reported;
- reseeds the demo domain through the deployed `post_idea` function;
- signs in as Bob and Alice with the publishable key and prints a YES/NO checklist. Exit code 0 means all YES.

It never touches an account outside `@qa-commit.dev` and `@commit-demo.dev`.

`npx tsx scripts/seed/seed.mts` still works on its own (demo-domain reset and seed, without the QA cleanup, key reset or checklist).
