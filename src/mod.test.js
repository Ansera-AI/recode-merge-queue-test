import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mod } from './mod.js';

test('mod is never negative', () => {
  assert.equal(mod(-1, 3), 2);
  assert.equal(mod(4, 3), 1);
});
