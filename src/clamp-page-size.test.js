import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampPageSize } from './math.js';

test('clampPageSize raises values below 1 to 1', () => {
  assert.equal(clampPageSize(0), 1);
  assert.equal(clampPageSize(-10), 1);
});

test('clampPageSize leaves values inside the range unchanged', () => {
  assert.equal(clampPageSize(50), 50);
});

test('clampPageSize lowers values above 100 to 100', () => {
  assert.equal(clampPageSize(500), 100);
});

test('clampPageSize returns the bounds 1 and 100 unchanged', () => {
  assert.equal(clampPageSize(1), 1);
  assert.equal(clampPageSize(100), 100);
});
