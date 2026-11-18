import { test } from 'node:test';
import assert from 'node:assert/strict';
import { increment } from './math.js';

test('increment adds one to a positive number', () => {
  assert.equal(increment(3), 4);
});

test('increment adds one to a negative number', () => {
  assert.equal(increment(-3), -2);
});

test('increment adds one to zero', () => {
  assert.equal(increment(0), 1);
});

test('increment adds one to fractional numbers', () => {
  assert.equal(increment(1.5), 2.5);
  assert.equal(increment(-1.5), -0.5);
});
