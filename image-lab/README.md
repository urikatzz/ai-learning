# Image Generation Lab

A separate, browser-local lab at `image-lab/`. Serve the repository root:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000/image-lab/>. An HTTP server is required for the Web Worker; opening the HTML file directly shows setup instructions. There are no model APIs, packages, or build steps.

## First experiment

Press **Run the demo**: the model draws an untrained baseline, trains for exactly 100 steps, then draws again. The comparison keeps both images and their losses visible. It uses the saved collection, initialization seed 42, sampling seed 42, temperature 0.8, learning rate 0.02, and no prefix. Each run restarts the model from scratch; an unsaved drawing is not part of the collection. Saving a drawing, resetting, or manually training clears the comparison so different runs are not mixed.

Learning rate and model details live under **Advanced training & model details**. Temperature, sampling seed, and prefix completion live under **Advanced sampling & drawing completion**. The experiment overrides those settings with its fixed defaults for a controlled comparison. A lower loss means better predictions on the training collection, not a guarantee that each generated image will match a pattern.

## Learn by doing

1. Choose lines or shapes. Select a thumbnail, click or drag to paint in the editor, and save the drawing (the page asks before discarding unsaved work). Add up to eight examples or remove examples down to one.
2. Train continuously or perform a single optimizer update. Pause to keep the current weights. Dataset changes and Reset rebuild the same seeded model.
3. Generate an image or sample one pixel at a time. Adjust temperature and seed. Use the prefix slider to complete the first N pixels of the current editor drawing; Generate and Restart apply that prefix.
4. Open **Look inside** and select a generated pixel to inspect its conditional probabilities and the actual causal attention matrix. Attention cells expose their source, destination, and weight on hover, keyboard focus, or click.

Recent completed images retain the training step, temperature, and seed in the current page session. Nothing is persisted or uploaded. Google Fonts is optional; system fonts work offline.

## Model and training

This reuses `../llm-lab/engine.js` unchanged: scalar reverse-mode autodiff, a decoder-only Transformer, and Adam. The image model has one pre-normalized block, width 8, one attention head, a 16-wide GELU feed-forward layer, and learned token/position embeddings. All training and model inference run in a dedicated Web Worker.

A 4×4 image is flattened in row-major order and encoded as START (token 0), followed by 16 binary pixel tokens: black (token 1) or white (token 2). Each optimizer update uses one full image with teacher forcing. Loss is averaged over its 16 next-pixel targets. The chart shows mean corpus loss, evaluated after each update batch. Training stops at 2,000 steps.

Training uses the shared engine's three-way output softmax, including START, which is never a target. Generation excludes START and renormalizes the black/white logits after temperature scaling. Therefore the displayed binary sampling probabilities differ from the three-way probabilities used by the training loss. Generation has a fixed length of 16 pixels; no EOS is needed.

The seed controls sampling only. Model initialization is always seed 42. Repeating generation with the same sampling seed, weights, temperature, and prefix gives the same image. Attention inspection recomputes the selected pixel's prediction using its earlier pixels and the current weights and temperature; it is not a historical snapshot from a prior model state.

This is a teaching-scale autoregressive image model, not a diffusion model or a general text-to-image model. It learns tiny patterns; it is not designed for photographs or semantic prompts. Different training images can share the same prefix, so some next-pixel uncertainty is unavoidable.

## Verification

From the repository root:

```sh
node --test image-lab/tests/*.test.js llm-lab/tests/*.test.js
```

Image tests check row-major encoding, binary sampling and temperature, repeatable random sampling, real image-corpus loss reduction, prefix length, and causal attention masking. Existing Transformer tests cover gradients and future-token isolation.

For browser checks, verify drawing edits and dataset resets, single-step and continuous training, pause, seeded generation, manual pixel stepping, prefix completion, attention inspection, dark/light themes, and narrow screens. The GitHub Pages workflow copies this page together with the shared `llm-lab` engine.
