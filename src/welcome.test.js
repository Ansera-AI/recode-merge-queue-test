import { test } from 'node:test';
import assert from 'node:assert/strict';
import { welcome } from './welcome.js';

test('welcome handles a normal name, an empty string, spaces, and unicode', () => {
  assert.equal(welcome('Ada'), 'Welcome, Ada.');
  assert.equal(welcome(''), 'Welcome, .');
  assert.equal(welcome('Ada Lovelace'), 'Welcome, Ada Lovelace.');
  assert.equal(welcome('Zoë'), 'Welcome, Zoë.');
});
