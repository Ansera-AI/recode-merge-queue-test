import { test } from 'node:test';
import assert from 'node:assert/strict';
import { farewell } from './farewell.js';

test('farewell says goodbye to the given name', () => {
  assert.equal(farewell('Ada'), 'Goodbye, Ada.');
});

test('farewell handles an empty name', () => {
  assert.equal(farewell(''), 'Goodbye, .');
});
