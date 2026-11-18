import { test } from 'node:test';
import assert from 'node:assert/strict';
import { add, multiply, square, subtract } from './math.js';

test('add, subtract, multiply, square', () => {
  assert.equal(add(2, 3), 5);
  assert.equal(subtract(5, 3), 2);
  assert.equal(multiply(4, 3), 12);
  assert.equal(square(-3), 9);
});
