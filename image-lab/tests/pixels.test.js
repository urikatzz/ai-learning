'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const scope = { window: {} };
vm.createContext(scope);
vm.runInContext(fs.readFileSync('llm-lab/engine.js', 'utf8'), scope);
const path = 'image-lab/pixels.js';
if (fs.existsSync(path)) vm.runInContext(fs.readFileSync(path, 'utf8'), scope);

test('images become row-major next-pixel targets with a start token', () => {
  assert.ok(scope.window.PixelLab, 'pixel lab module should be available');
  const { encode } = scope.window.PixelLab;
  const pixels = [0,1,0,0, 0,1,0,0, 0,1,0,0, 0,1,0,0];
  assert.deepEqual(Array.from(encode(pixels)), [0,1,2,1,1,1,2,1,1,1,2,1,1,1,2,1,1]);
  assert.throws(() => encode([0,1]), /16/);
  assert.throws(() => encode(Array(16).fill(2)), /binary/);
});

test('sampling excludes the start token and temperature changes binary probabilities', () => {
  assert.ok(scope.window.PixelLab, 'pixel lab module should be available');
  const { pixelProbabilities, samplePixel, seededRandom } = scope.window.PixelLab;
  const warm = pixelProbabilities([100,0,2], 1);
  const cold = pixelProbabilities([100,0,2], .5);
  assert.ok(Math.abs(warm[1] - .8807970779778823) < 1e-10);
  assert.ok(cold[1] > warm[1]);
  assert.equal(samplePixel(warm, () => 0), 0);
  assert.equal(samplePixel(warm, () => .999), 1);
  const a = seededRandom(7), b = seededRandom(7);
  assert.deepEqual(Array.from({length:16}, () => a()), Array.from({length:16}, () => b()));
});

test('actual Transformer training learns a tiny image corpus', () => {
  assert.ok(scope.window.PixelLab, 'pixel lab module should be available');
  const { PixelTransformer, presets } = scope.window.PixelLab;
  const lab = new PixelTransformer(scope.window.TinyDecoder, scope.window.TinyAdam, presets.lines);
  const before = lab.metrics().loss;
  lab.train(180, .02);
  const after = lab.metrics();
  assert.ok(after.loss < before * .65, `expected image loss reduction: ${before} -> ${after.loss}`);
  assert.equal(after.steps, 180);
  assert.ok(lab.predict([], 1).probabilities.every(Number.isFinite));
});

test('pixel attention uses only the supplied prefix and preserves causal masking', () => {
  assert.ok(scope.window.PixelLab, 'pixel lab module should be available');
  const { PixelTransformer, presets } = scope.window.PixelLab;
  const lab = new PixelTransformer(scope.window.TinyDecoder, scope.window.TinyAdam, presets.lines);
  const prediction = lab.predict([0,1,0,0], 1);
  assert.equal(prediction.attention.length, 5);
  assert.ok(Math.abs(prediction.probabilities.reduce((a,b) => a+b, 0) - 1) < 1e-10);
  prediction.attention.forEach((row, r) => {
    assert.ok(Math.abs(row.reduce((a,b) => a+b, 0) - 1) < 1e-10);
    row.slice(r+1).forEach(value => assert.equal(value, 0));
  });
  assert.throws(() => lab.predict(Array(17).fill(0), 1), /prefix/);
});
