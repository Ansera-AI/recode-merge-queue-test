import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decrement } from './math.js';

test('decrement subtracts one from a positive number', () => {
  assert.equal(decrement(3), 2);
});

test('decrement subtracts one from a negative number', () => {
  assert.equal(decrement(-3), -4);
});

test('decrement subtracts one from zero', () => {
  assert.equal(decrement(0), -1);
});

test('decrement subtracts one from fractional numbers', () => {
  assert.equal(decrement(1.5), 0.5);
  assert.equal(decrement(-1.5), -2.5);
});
