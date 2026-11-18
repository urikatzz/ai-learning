# Interactive Transformer Lab

The lab is a static page at `llm-lab/`. From the repository root, run:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000/llm-lab/>. No build step, backend, package install, or model API is required.

## What runs in the browser

`engine.js` implements a seeded scalar reverse-mode autodiff engine, a decoder-only Transformer, and Adam. The default model has two pre-normalized causal attention blocks, width 8, one attention head, a 16-wide GELU feed-forward layer, learned token and position embeddings, learned LayerNorm scale and bias, and a vocabulary output projection. Dropout is off. Loss averages cross-entropy over every next-token target in one sentence per optimizer step. The corpus evaluation loss and accuracy use all next-token positions from all edited sentences.

The default vocabulary is built from lowercase words, punctuation, BOS, EOS, and UNK. The architecture has 1,663 trainable scalar parameters for the default data. Reset rebuilds the same seeded initialization. Checkpoints preserve weights, Adam moments, frozen parameters, step counters, dataset, and loss history in memory for the current page session. Weight Surgery edits individual live parameters used by both prediction and training; freezing a selected scalar keeps Adam from changing it. Editing a scalar clears that parameter's Adam moments.

The Python panel is equivalent illustrative code. Training itself runs in JavaScript on the browser main thread; there is no Python or PyTorch runtime.

## Verification

Run the numerical tests with:

```sh
node --test llm-lab/tests/engine.test.js
```

They check causal attention normalization and future-token isolation, finite-difference gradients through Q and FFN weights, seeded corpus loss reduction, tensor shapes and parameter count, and live weight edits and freezing.

## Current scope

The live matrix selector shows Q, K, V, or attention for the latest Transformer layer. Weight Surgery lets learners browse tensors, select a scalar from its heatmap, edit it, and freeze it during Adam updates. Architecture changes rebuild the model. The lab does not yet include multi-head configurations, worker-based training, full operation-by-operation debug stepping, per-cell derivation views, checkpoint comparisons or persistent checkpoints, Python export, or missions. Training currently runs on the browser main thread. The Python panel is illustrative; parameter edits apply to the live JavaScript model and are not sent to a PyTorch process.
