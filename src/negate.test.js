import { test } from 'node:test';
import assert from 'node:assert/strict';
import { negate } from './math.js';

test('negate reverses the sign of positive and negative numbers', () => {
  assert.equal(negate(3), -3);
  assert.equal(negate(-3), 3);
});

test('negate reverses the sign of zero', () => {
  assert.equal(negate(0), -0);
  assert.equal(negate(-0), 0);
});
