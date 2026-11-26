'use strict';
// The shared educational engine exports to window in either execution context.
self.window = self;
importScripts('../llm-lab/engine.js', 'pixels.js');
let lab;
self.onmessage = ({ data }) => {
  const { id, type } = data;
  try {
    let result;
    if (type === 'reset') {
      lab = new PixelLab.PixelTransformer(TinyDecoder, TinyAdam, data.images);
      result = lab.metrics();
    } else if (type === 'train') {
      result = lab.train(data.count, data.learningRate);
    } else if (type === 'predict') {
      result = lab.predict(data.prefix, data.temperature);
    } else throw new Error('Unknown lab operation.');
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
