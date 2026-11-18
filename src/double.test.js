import { test } from 'node:test';
import assert from 'node:assert/strict';
import { double } from './math.js';

test('double handles positive, negative, zero, and fractional inputs', () => {
  assert.equal(double(4), 8);
  assert.equal(double(-3), -6);
  assert.equal(double(0), 0);
  assert.equal(double(1.5), 3);
});
