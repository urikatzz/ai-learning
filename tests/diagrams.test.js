// tests/diagrams.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { softmax, arcPath, staggerDelay, pairwiseVerdict, has } = require('../assets/diagrams.js');

test('softmax at T=1 for logits 2,1 gives 73% / 27%', () => {
  const [a, b] = softmax([2, 1], 1);
  assert.equal(Math.round(a * 100), 73);
  assert.equal(Math.round(b * 100), 27);
});

test('softmax sums to 1 and lower temperature sharpens the top token', () => {
  const sharp = softmax([3, 2, 1, 0.5], 0.3);
  const flat = softmax([3, 2, 1, 0.5], 2);
  assert.ok(Math.abs(sharp.reduce((x, y) => x + y) - 1) < 1e-9);
  assert.ok(sharp[0] > flat[0]);
});

test('arcPath draws a quadratic curve lifted above the baseline', () => {
  assert.equal(arcPath(10, 110, 100, 40), 'M10 100Q60 60 110 100');
});

test('staggerDelay scales by index', () => {
  assert.equal(staggerDelay(0), '0s');
  assert.equal(staggerDelay(3), '0.36s');
  assert.equal(staggerDelay(2, 0.5), '1s');
});

test('pairwiseVerdict keeps a winner only when both orders agree', () => {
  assert.equal(pairwiseVerdict('A', 'A'), 'A');
  assert.equal(pairwiseVerdict('B', 'B'), 'B');
  assert.equal(pairwiseVerdict('A', 'B'), 'tie');
});

test('judge-biases diagram is registered', () => {
  assert.ok(has('judge-biases'));
});
