import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cubeRoot } from './math.js';

test('cubeRoot handles positive, negative, zero, and fractional inputs', () => {
  assert.equal(cubeRoot(27), 3);
  assert.equal(cubeRoot(-27), -3);
  assert.equal(cubeRoot(0), 0);
  assert.equal(cubeRoot(0.125), 0.5);
});
