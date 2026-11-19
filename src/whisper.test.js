import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whisper } from './whisper.js';

test('whisper lowercases mixed case strings and appends three dots', () => {
  assert.equal(whisper('HeLLo WoRLD'), 'hello world...');
});

test('whisper appends three dots to an empty string', () => {
  assert.equal(whisper(''), '...');
});

test('whisper preserves punctuation before appending three dots', () => {
  assert.equal(whisper('Hello, WORLD!?'), 'hello, world!?...');
  assert.equal(whisper('Wait...'), 'wait......');
});
