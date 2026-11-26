(() => {
  'use strict';
  const presets = {
    lines: ['0000111100000000', '0000000011110000', '0100010001000100', '0010001000100010'],
    shapes: ['1111100110011111', '1001011001101001', '0110111111110110', '0110011001100110'],
  };
  for (const key of Object.keys(presets)) presets[key] = presets[key].map(image => Array.from(image, Number));

  function validate(pixels) {
    if (!pixels.every(pixel => pixel === 0 || pixel === 1)) throw new Error('Images must have binary pixels.');
  }
  function encode(pixels) {
    if (pixels.length !== 16) throw new Error('Each image must contain 16 pixels.');
    validate(pixels);
    // Token 0 = start; token 1 = black pixel; token 2 = white pixel.
    return [0, ...pixels.map(pixel => pixel + 1)];
  }
  function pixelProbabilities(logits, temperature) {
    if (!Number.isFinite(temperature) || temperature <= 0) throw new Error('Temperature must be positive.');
    const scores = logits.slice(1, 3).map(value => value / temperature);
    const maximum = Math.max(...scores);
    const exp = scores.map(value => Math.exp(value - maximum));
    return exp.map(value => value / (exp[0] + exp[1]));
  }
  function samplePixel(probabilities, random) { return random() < probabilities[0] ? 0 : 1; }
  function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return (state + 1) / 4294967297;
    };
  }
  class PixelTransformer {
    constructor(Decoder, Adam, images) {
      if (!images.length || images.length > 8) throw new Error('Use between 1 and 8 images.');
      this._sequences = images.map(encode);
      this._model = new Decoder(['<START>', 'black', 'white'], { layers: 1, width: 8, seed: 42 });
      this._optimizer = new Adam(this._model.params, .02);
      this._steps = 0;
    }
    train(count, learningRate) {
      this._optimizer.setRate(learningRate);
      for (let i = 0; i < count; i++) {
        const loss = this._model.loss(this._sequences[this._steps % this._sequences.length]);
        if (!Number.isFinite(loss.data)) throw new Error('Training became unstable. Reset and lower the learning rate.');
        loss.backward();
        if (this._model.params.some(parameter => !Number.isFinite(parameter.grad))) throw new Error('Non-finite gradient. Reset and lower the learning rate.');
        this._optimizer.step();
        this._steps++;
      }
      return this.metrics();
    }
    metrics() {
      return {
        steps: this._steps,
        loss: this._sequences.reduce((total, sequence) => total + this._model.loss(sequence).data, 0) / this._sequences.length,
        parameters: this._model.params.length,
      };
    }
    predict(prefix, temperature) {
      if (prefix.length > 16) throw new Error('The prefix cannot exceed 16 pixels.');
      validate(prefix);
      const snapshot = this._model.inspect([0, ...prefix.map(pixel => pixel + 1)]);
      return {
        probabilities: pixelProbabilities(snapshot.logits.at(-1).map(value => value.data), temperature),
        attention: snapshot.layers[0].attention,
      };
    }
  }
  window.PixelLab = { presets, encode, pixelProbabilities, samplePixel, seededRandom, PixelTransformer };
})();
