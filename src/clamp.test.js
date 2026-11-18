import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp } from './clamp.js';

test('clamp keeps n between lo and hi', () => {
  assert.equal(clamp(5, 0, 10), 5);
});
