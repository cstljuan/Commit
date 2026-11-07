// Tests lib/api.mock.ts in Node. Run: npx tsx scripts/tests/api-mock.mts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  API_IS_MOCK, getHackRoles, getInterested, getMatches, getMessages, getMyProfile, getScoreEvents, respondToInterested, setHackRoles,
} from '../../lib/api.mock.ts';

test('mock flag is on', () => {
  assert.equal(API_IS_MOCK, true);
});

test('liking an interested card removes it and returns a match for that role', async () => {
  const before = await getInterested();
  assert.equal(before.count, before.cards.length);
  const card = before.cards[0];
  const res = await respondToInterested(card.swipeRef, true);
  assert.equal(res.matched, true);
  assert.ok(res.match);
  assert.equal(res.match.role, card.role);
  assert.equal(res.match.iCommitted, false);
  assert.equal(res.match.isTeam, false);
  const after = await getInterested();
  assert.equal(after.count, before.count - 1);
  assert.ok(!after.cards.some((c) => c.swipeRef === card.swipeRef));
  const matches = await getMatches();
  assert.ok(matches.some((m) => m.id === res.match!.id));
  assert.deepEqual(await getMessages(res.match.id), []);
});

test('passing removes the card and returns matched false with no match', async () => {
  const before = await getInterested();
  const card = before.cards[0];
  const matchesBefore = (await getMatches()).length;
  const res = await respondToInterested(card.swipeRef, false);
  assert.equal(res.matched, false);
  assert.equal(res.match, undefined);
  const after = await getInterested();
  assert.equal(after.count, before.count - 1);
  assert.equal((await getMatches()).length, matchesBefore);
});

test('responding to an unknown or already used card throws', async () => {
  await assert.rejects(respondToInterested('sr_nope', true), /not found/i);
  const [card] = (await getInterested()).cards;
  await respondToInterested(card.swipeRef, false);
  await assert.rejects(respondToInterested(card.swipeRef, true), /not found/i);
});

test('setHackRoles then getHackRoles round trips, and returns a copy', async () => {
  const roles = [{ role: 'Mobile' as const, open: 3 }, { role: 'PM' as const, open: 1 }];
  await setHackRoles(roles);
  const got = await getHackRoles();
  assert.deepEqual(got, roles);
  got[0].open = 99;
  assert.deepEqual(await getHackRoles(), roles, 'mutating the result must not change the store');
  await setHackRoles([]);
  assert.deepEqual(await getHackRoles(), []);
});

test('score event deltas sum to the profile score', async () => {
  const events = await getScoreEvents();
  const profile = await getMyProfile();
  assert.ok(profile);
  assert.ok(events.length > 0);
  assert.equal(events.reduce((n, e) => n + e.delta, 0), profile.reliability);
});

test('getMyProfile returns a copy', async () => {
  const p = await getMyProfile();
  assert.ok(p);
  p.username = 'hacked';
  assert.notEqual((await getMyProfile())!.username, 'hacked');
});
