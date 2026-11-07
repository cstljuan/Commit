// Tests the pure parts of lib/filters.ts. Run: npx tsx scripts/tests/filters.mts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { filterCount, getDeckFilters, matchesFilters, setDeckFilters } from '../../lib/filters.ts';
import type { PersonCard, ProjectCard } from '../../lib/types.ts';

const person = (over: Partial<PersonCard> = {}): PersonCard => ({
  kind: 'person', id: 'p1', username: 'ben', avatarUrl: null, role: 'Backend', level: 'intermediate', occupation: 'student',
  skills: [], prompts: [], reliability: 80, reason: '', isSuper: false, forProjectId: 'x', ...over,
});
const project = (over: Partial<ProjectCard> = {}): ProjectCard => ({
  kind: 'project', id: 'j1', title: 'T', teaser: '', visibility: 'public', theme: 'Health', timeframe: '24h',
  roles: [{ role: 'Backend', open: 1, filled: 0 }, { role: 'Design', open: 0, filled: 1 }],
  ownerUsername: 'o', ownerReliability: 80, reason: '', commitHash: 'abc', isSuper: false, ...over,
});

test('empty filters match everything', () => {
  assert.ok(matchesFilters(person(), {}));
  assert.ok(matchesFilters(project(), {}));
  assert.ok(matchesFilters(person(), { Role: [], Level: [] }));
});

test('filterCount sums every selected value', () => {
  assert.equal(filterCount({}), 0);
  assert.equal(filterCount({ Role: ['a', 'b'], Theme: ['c'], Level: [] }), 3);
  assert.equal(filterCount({ Role: undefined }), 0);
});

test('person Role and Level match case-insensitively and combine with AND', () => {
  assert.ok(matchesFilters(person(), { Role: ['backend'] }));
  assert.ok(matchesFilters(person(), { Role: ['Design', 'BACKEND'] }));
  assert.ok(!matchesFilters(person(), { Role: ['Design'] }));
  assert.ok(matchesFilters(person(), { Role: ['Backend'], Level: ['Intermediate'] }));
  assert.ok(!matchesFilters(person(), { Role: ['Backend'], Level: ['advanced'] }));
});

test('person ignores Theme and Timeframe', () => {
  assert.ok(matchesFilters(person(), { Theme: ['Nope'], Timeframe: ['Nope'] }));
});

test('project Role matches only roles with open seats', () => {
  assert.ok(matchesFilters(project(), { Role: ['Backend'] }));
  assert.ok(!matchesFilters(project(), { Role: ['Design'] }), 'Design is full (open 0)');
  assert.ok(!matchesFilters(project(), { Role: ['Mobile'] }));
});

test('project Theme and Timeframe match case-insensitively', () => {
  assert.ok(matchesFilters(project(), { Theme: ['health'], Timeframe: ['24H'] }));
  assert.ok(!matchesFilters(project(), { Theme: ['Climate'] }));
  assert.ok(!matchesFilters(project(), { Timeframe: ['48h'] }));
});

test('project Role filter is case-insensitive like the person filter', () => {
  // Source inconsistency: person uses hit() (case-insensitive), project uses Array.includes (case-sensitive).
  assert.ok(matchesFilters(project(), { Role: ['backend'] }));
});

test('project Level filter is ignored', () => {
  assert.ok(matchesFilters(project(), { Level: ['advanced'] }));
});

test('set and get deck filters', () => {
  setDeckFilters({ Role: ['Design'] });
  assert.deepEqual(getDeckFilters(), { Role: ['Design'] });
  setDeckFilters({});
  assert.deepEqual(getDeckFilters(), {});
});
