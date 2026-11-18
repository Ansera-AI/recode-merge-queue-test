import { test } from 'node:test';
import assert from 'node:assert/strict';
import { triple } from './math.js';

test('triple handles positive, negative, zero, and fractional inputs', () => {
  assert.equal(triple(3), 9);
  assert.equal(triple(-3), -9);
  assert.equal(triple(0), 0);
  assert.equal(triple(0.5), 1.5);
});
