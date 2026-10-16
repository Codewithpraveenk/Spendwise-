import test from 'node:test';
import assert from 'node:assert/strict';
import { startupFailure } from '../src/startupFailure.js';

test('startup diagnostics distinguish deployment failures without leaking driver details', () => {
  const fixtures = [
    [{ name: 'MongooseServerSelectionError' }, 'DATABASE_UNREACHABLE'],
    [{ code: 18 }, 'DATABASE_AUTHENTICATION_FAILED'],
    [{ code: 13 }, 'DATABASE_PERMISSION_DENIED'],
    [{ code: 11000 }, 'DATABASE_DUPLICATE_RECORDS'],
    [{ code: 85 }, 'DATABASE_INDEX_CONFLICT'],
    [{ name: 'MongoParseError' }, 'DATABASE_URI_INVALID'],
    [{}, 'DATABASE_STARTUP_FAILED'],
  ];
  for (const [error, code] of fixtures) {
    const value = startupFailure({ ...error, message: 'mongodb://private-user:private-password@private-host/db', stack: 'private stack' }, 'database_connection');
    assert.equal(value.code, code);
    assert.doesNotMatch(JSON.stringify(value), /private-user|private-password|private-host|private stack/);
  }
  assert.equal(startupFailure(new Error('private configuration'), 'configuration').code, 'CONFIGURATION_ERROR');
});
