import assert from 'node:assert/strict';
import test from 'node:test';

import { formatPace } from './format.ts';

test('carries rounded seconds into the next minute', () => {
  assert.equal(formatPace(299.6, 1000), '5:00 /km');
});

test('zero-pads pace seconds', () => {
  assert.equal(formatPace(305, 1000), '5:05 /km');
});

test('uses metric and imperial pace suffixes', () => {
  assert.equal(formatPace(300, 1000, 'metric'), '5:00 /km');
  assert.equal(formatPace(300, 1609.344, 'imperial'), '5:00 /mi');
});

test('keeps normal pace values unchanged', () => {
  assert.equal(formatPace(272, 1000), '4:32 /km');
});
