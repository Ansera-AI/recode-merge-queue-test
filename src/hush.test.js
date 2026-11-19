import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hush } from './hush.js';

test('hush removes repeated and scattered exclamation marks', () => {
  assert.equal(hush('Hello!!!'), 'Hello');
  assert.equal(hush('!Hello! Wo!rld!'), 'Hello World');
  assert.equal(hush('!!!'), '');
});

test('hush returns an empty string for empty input', () => {
  assert.equal(hush(''), '');
});

test('hush preserves all other characters', () => {
  assert.equal(hush('HeLLo, 世界!\tHow are you?\n'), 'HeLLo, 世界\tHow are you?\n');
  assert.equal(hush('Quiet words...'), 'Quiet words...');
});
