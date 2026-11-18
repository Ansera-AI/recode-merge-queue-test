import { test } from 'node:test';
import assert from 'node:assert/strict';
import { halve } from './math.js';

test('halve handles even, odd, negative, zero, and fractional inputs', () => {
  assert.equal(halve(8), 4);
  assert.equal(halve(5), 2.5);
  assert.equal(halve(-6), -3);
  assert.equal(halve(0), 0);
  assert.equal(halve(1.5), 0.75);
});
