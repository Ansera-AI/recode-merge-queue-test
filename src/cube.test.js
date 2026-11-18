import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cube } from './math.js';

test('cube handles positive, negative, zero, and fractional inputs', () => {
  assert.equal(cube(3), 27);
  assert.equal(cube(-3), -27);
  assert.equal(cube(0), 0);
  assert.equal(cube(0.5), 0.125);
});
