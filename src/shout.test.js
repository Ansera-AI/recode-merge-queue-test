import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shout } from './shout.js';

test('shout uppercases text and adds a trailing exclamation mark', () => {
  assert.equal(shout('hello'), 'HELLO!');
  assert.equal(shout('Hello, World'), 'HELLO, WORLD!');
});

test('shout leaves already uppercase text and non-letters unchanged', () => {
  assert.equal(shout('HEY'), 'HEY!');
  assert.equal(shout('123'), '123!');
});

test('shout of an empty string is just an exclamation mark', () => {
  assert.equal(shout(''), '!');
});
