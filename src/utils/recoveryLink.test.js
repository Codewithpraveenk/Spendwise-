import test from 'node:test';
import assert from 'node:assert/strict';
import { readRecoveryToken, consumeRecoveryFragment } from './recoveryLink.js';

test('recovery links accept only complete opaque tokens and never accept malformed credentials', () => {
  const token = 'a'.repeat(64);
  assert.equal(readRecoveryToken(`#token=${token}`), token);
  for (const fragment of ['', '#token=short', '#token=' + 'z'.repeat(64), '#unrelated=value']) assert.equal(readRecoveryToken(fragment), '');
});
test('reset fragments are scrubbed without discarding router state or an already captured token', () => {
  const calls = []; const state = { key: 'router-key', idx: 2 };
  const history = { state, replaceState(...values) { calls.push(values); } };
  const location = { pathname: '/reset-password', search: '?from=email', hash: '#token=' + 'a'.repeat(64) };
  assert.equal(consumeRecoveryFragment(location, history), 'a'.repeat(64));
  assert.deepEqual(calls[0], [state, '', '/reset-password?from=email']);
  assert.ok(!calls[0][2].includes('token'));
  location.hash = ''; assert.equal(consumeRecoveryFragment(location, history), null); assert.equal(calls.length, 1);
  location.hash = '#token=' + 'b'.repeat(64); assert.equal(consumeRecoveryFragment(location, history), 'b'.repeat(64));
  location.hash = '#token=invalid'; assert.equal(consumeRecoveryFragment(location, history), '');
});
