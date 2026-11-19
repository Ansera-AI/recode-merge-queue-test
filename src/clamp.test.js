import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp } from './math.js';

test('clamp raises values below the range to min', () => {
  assert.equal(clamp(-5, 0, 10), 0);
});

test('clamp leaves values inside the range unchanged', () => {
  assert.equal(clamp(5, 0, 10), 5);
});

test('clamp lowers values above the range to max', () => {
  assert.equal(clamp(15, 0, 10), 10);
});

test('clamp returns values on either bound unchanged', () => {
  assert.equal(clamp(0, 0, 10), 0);
  assert.equal(clamp(10, 0, 10), 10);
});

test('clamp works with negative ranges', () => {
  assert.equal(clamp(-20, -10, -5), -10);
  assert.equal(clamp(-7, -10, -5), -7);
  assert.equal(clamp(0, -10, -5), -5);
});
