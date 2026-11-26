(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const { presets, seededRandom, samplePixel } = window.PixelLab;
  let images = presets.lines.map(image => [...image]);
  let selectedExample = 0;
  let collection = 'lines';
  let drawing = [...images[0]];
  let generated = [];
  let inspected = 0;
  let metrics = { steps: 0, loss: 0, parameters: 0 };
  let history = [];
  let gallery = [];
  let training = false;
  let generating = false;
  let busy = true;
  let failed = false;
  let random = seededRandom(42);
  let nextRequest = 0;
  const pending = new Map();
  let worker;
  let experimentStage = 0;
  let experimentRunning = false;

  function status(message) { $('status').textContent = message; }
  function report(error) {
    training = false;
    generating = false;
    status(error.message);
    if (experimentRunning) {
      experimentStage = 0;
      renderExperiment();
      $('experiment-status').textContent = 'Experiment interrupted: ' + error.message + ' Start again to retry.';
    }
  }
  function request(type, data = {}) {
    return new Promise((resolve, reject) => {
      const id = ++nextRequest;
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, type, ...data });
    });
  }
  function syncControls() {
    document.querySelectorAll('[data-lock]').forEach(control => { control.disabled = busy || failed; });
    $('train').disabled = failed || experimentRunning || (busy && !training);
    $('train').textContent = training ? 'Ⅱ Pause' : '▶ Train';
    $('stop').disabled = !generating;
    $('apply').disabled = busy || failed || !canSave();
    $('remove').disabled = busy || failed || selectedExample === null || images.length <= 1;
    $('add').disabled = busy || failed || images.length >= 8;
    document.querySelectorAll('#editor button, #examples button').forEach(button => { button.disabled = busy || failed; });
    document.querySelectorAll('#generated button').forEach((button, i) => { button.disabled = busy || failed || i > generated.length; });
  }
  function isEdited() {
    if (selectedExample === null) return drawing.some(Boolean);
    return drawing.some((pixel, i) => pixel !== images[selectedExample][i]);
  }
  // A new example may be saved even when blank; an existing one only after a change.
  function canSave() { return selectedExample === null || isEdited(); }
  function confirmDiscard() { return !isEdited() || window.confirm('Discard your unsaved drawing?'); }
  function renderDraftState() {
    const count = `${images.length} training image${images.length === 1 ? '' : 's'}`;
    $('dataset-note').textContent = isEdited() ? 'Unsaved drawing · press Save drawing to teach it to the model (training restarts).'
      : selectedExample === null ? 'Paint a new example, then save it.' : `${count} · select a thumbnail to edit.`;
    $('dataset-note').classList.toggle('unsaved', isEdited());
    syncControls();
  }
  function paintPixel(index, value) {
    drawing[index] = value;
    const button = $('editor').children[index];
    button.classList.toggle('on', Boolean(value));
    button.setAttribute('aria-pressed', String(Boolean(value)));
    renderDraftState();
  }
  function setBusy(value) { busy = value; syncControls(); }
  async function perform(action) {
    if (busy || failed) return;
    setBusy(true);
    try { await action(); } catch (error) { report(error); }
    finally { setBusy(false); }
  }
  function miniGrid(pixels) {
    const grid = document.createElement('div');
    grid.className = 'mini-grid';
    grid.setAttribute('aria-hidden', 'true');
    pixels.forEach(pixel => {
      const cell = document.createElement('i');
      if (pixel) cell.className = 'on';
      grid.append(cell);
    });
    return grid;
  }
  function renderExamples() {
    $('examples').replaceChildren(...images.map((image, index) => {
      const button = document.createElement('button');
      button.className = 'example' + (index === selectedExample ? ' selected' : '');
      button.setAttribute('aria-label', `Edit example ${index + 1}`);
      button.setAttribute('aria-pressed', String(index === selectedExample));
      const label = document.createElement('small');
      label.textContent = `#${index + 1}`;
      button.append(miniGrid(image), label);
      button.onclick = () => {
        if (busy || index === selectedExample || !confirmDiscard()) return;
        selectedExample = index;
        drawing = [...images[index]];
        renderExamples();
        renderEditor();
      };
      return button;
    }));
    renderDraftState();
  }
  function renderEditor() {
    $('editor-label').textContent = selectedExample === null ? 'Drawing a new example' : `Editing example ${selectedExample + 1}`;
    $('editor').replaceChildren(...drawing.map((pixel, i) => {
      const button = document.createElement('button');
      button.className = pixel ? 'on' : '';
      button.setAttribute('aria-label', `Drawing row ${Math.floor(i / 4) + 1}, column ${i % 4 + 1}`);
      button.setAttribute('aria-pressed', String(Boolean(pixel)));
      button.dataset.index = i;
      return button;
    }));
    renderDraftState();
  }
  function renderGenerated() {
    $('generated').replaceChildren(...Array.from({ length: 16 }, (_, i) => {
      const button = document.createElement('button');
      const known = i < generated.length;
      button.className = (known ? (generated[i] ? 'on' : '') : 'unknown') + (i === inspected ? ' selected' : '');
      button.textContent = known ? '' : '·';
      button.setAttribute('aria-label', `Generated pixel ${i + 1}: ${known ? (generated[i] ? 'white' : 'black') : 'not generated'}`);
      button.setAttribute('aria-pressed', String(i === inspected));
      button.onclick = () => perform(async () => {
        inspected = i;
        renderGenerated();
        await inspect();
      });
      return button;
    }));
    $('pixel-count').textContent = `${generated.length} / 16`;
    $('scan-label').textContent = generated.length === 16 ? 'IMAGE COMPLETE · SELECT A PIXEL' : `NEXT PIXEL: ROW ${Math.floor(generated.length / 4) + 1}, COLUMN ${generated.length % 4 + 1}`;
    syncControls();
  }
  function renderMetrics(value) {
    metrics = value;
    history.push({ step: value.steps, loss: value.loss });
    if (history.length > 240) history.shift();
    $('steps').textContent = value.steps.toLocaleString();
    $('loss').textContent = value.loss.toFixed(3);
    $('parameters').textContent = value.parameters.toLocaleString();
    const maximum = Math.max(.1, ...history.map(point => point.loss)) * 1.1;
    const firstStep = history[0].step;
    const span = Math.max(1, value.steps - firstStep);
    const points = history.map(point => `${10 + (point.step - firstStep) / span * 340},${135 - point.loss / maximum * 120}`);
    $('loss-line').setAttribute('points', points.join(' '));
    $('loss-area').setAttribute('d', `M10 135 L${points.join(' L')} L${10 + (value.steps - firstStep) / span * 340} 135 Z`);
    $('chart-start').textContent = `step ${firstStep}`;
    $('chart-end').textContent = `step ${value.steps}`;
    $('loss-chart').setAttribute('aria-label', `Dataset loss ${value.loss.toFixed(3)} after ${value.steps} training steps`);
  }
  function renderPrediction(prediction) {
    const index = Math.min(inspected, 15);
    $('prediction-title').textContent = index < generated.length ? `Inspecting pixel ${index + 1}` : `Next: pixel ${index + 1}`;
    ['black', 'white'].forEach((color, i) => {
      const percent = prediction.probabilities[i] * 100;
      $(color + '-bar').style.width = percent + '%';
      $(color + '-probability').textContent = percent.toFixed(0) + '%';
    });
    const prefix = generated.slice(0, index);
    const tokens = ['START', ...prefix.map((pixel, i) => `${i + 1}:${pixel}`)];
    $('sequence').replaceChildren(...tokens.map((token, i) => {
      const element = document.createElement('span');
      element.className = 'token' + (i === tokens.length - 1 ? ' query' : '');
      element.textContent = token;
      return element;
    }));
    const size = prediction.attention.length;
    $('attention').style.gridTemplateColumns = `repeat(${size}, minmax(0,1fr))`;
    $('attention').setAttribute('aria-label', `${size} by ${size} causal attention matrix; final row predicts pixel ${index + 1}`);
    const cells = [];
    prediction.attention.forEach((row, r) => row.forEach((value, c) => {
      const cell = document.createElement('button');
      const masked = c > r;
      cell.className = 'attention-cell' + (masked ? ' masked' : '');
      if (!masked) cell.style.background = `rgb(${Math.round(36 + value * 166)},${Math.round(26 + value * 137)},${Math.round(53 + value * 202)})`;
      const description = masked ? `${tokens[r]} → ${tokens[c]}: future token, masked` : `${tokens[r]} → ${tokens[c]}: ${(value * 100).toFixed(1)}% attention`;
      cell.title = description;
      cell.setAttribute('aria-label', description);
      cell.onclick = () => { $('attention-readout').textContent = description; };
      cell.onfocus = () => { $('attention-readout').textContent = description; };
      cell.onmouseenter = () => { $('attention-readout').textContent = description; };
      cells.push(cell);
    }));
    $('attention').replaceChildren(...cells);
    $('attention-readout').textContent = `Last row predicts pixel ${index + 1} using ${prefix.length} earlier pixel${prefix.length === 1 ? '' : 's'} + START.`;
  }
  async function inspect() {
    const prefix = generated.slice(0, Math.min(inspected, 15));
    const prediction = await request('predict', { prefix, temperature: Number($('temperature').value) });
    renderPrediction(prediction);
    return prediction;
  }
  function restartCanvas() {
    generated = drawing.slice(0, Number($('prefix').value));
    inspected = generated.length;
    random = seededRandom(Number($('seed').value));
    renderGenerated();
  }
  async function reset() {
    clearExperiment();
    history = [];
    const result = await request('reset', { images });
    renderMetrics(result);
    restartCanvas();
    await inspect();
    status('Ready · run the demo above, or train and generate on your own.');
  }
  async function update(count) {
    if (!experimentRunning) clearExperiment();
    const result = await request('train', { count, learningRate: Number($('learning-rate').value) });
    renderMetrics(result);
    await inspect();
  }
  async function drawNextPixel() {
    if (generated.length >= 16) restartCanvas();
    inspected = generated.length;
    const prediction = await inspect();
    generated.push(samplePixel(prediction.probabilities, random));
    inspected = Math.min(generated.length, 15);
    renderGenerated();
    if (generated.length === 16) saveGeneration();
    await inspect();
  }
  function saveGeneration() {
    gallery.unshift({ pixels: [...generated], step: metrics.steps, temperature: $('temperature').value, seed: $('seed').value });
    gallery = gallery.slice(0, 4);
    $('gallery').replaceChildren(...gallery.map(image => {
      const figure = document.createElement('figure');
      figure.setAttribute('aria-label', `Generated image at step ${image.step}, pixels ${image.pixels.join('')}`);
      const caption = document.createElement('figcaption');
      caption.textContent = `step ${image.step} · T ${image.temperature}`;
      figure.title = `Seed ${image.seed} · ${image.pixels.join('')}`;
      figure.append(miniGrid(image.pixels), caption);
      return figure;
    }));
  }

  function renderExperiment() {
    ['guide-before', 'guide-train', 'guide-after'].forEach((id, index) => {
      $(id).classList.toggle('complete', index < experimentStage);
      if (index === experimentStage) $(id).setAttribute('aria-current', 'step');
      else $(id).removeAttribute('aria-current');
    });
    $('experiment-next').textContent = ['▶ Run the demo', 'Running…', 'Running…', '↻ Run the demo again'][experimentStage];
  }
  function clearExperiment() {
    experimentStage = 0;
    $('comparison').hidden = true;
    $('after-image').replaceChildren(document.createTextNode('?'));
    $('after-image').classList.add('empty-preview');
    $('after-image').removeAttribute('aria-label');
    $('after-caption').textContent = 'After training · waiting';
    $('comparison-note').textContent = 'Can the untrained model reproduce the patterns in your collection?';
    $('experiment-status').textContent = 'The demo starts the model from scratch, so earlier training is erased.';
    renderExperiment();
  }
  function experimentSettings() {
    $('seed').value = '42';
    $('temperature').value = '0.8';
    $('temperature-value').textContent = '0.8';
    $('prefix').value = '0';
    $('prefix-value').textContent = '0 pixels';
    $('learning-rate').value = '0.02';
    $('rate-value').textContent = '0.020';
  }
  async function experimentImage() {
    restartCanvas();
    while (generated.length < 16) {
      await drawNextPixel();
      await new Promise(resolve => setTimeout(resolve, 60));
    }
  }
  function showStage(stage, message) {
    experimentStage = stage;
    renderExperiment();
    $('experiment-status').textContent = message;
  }
  function showSnapshot(id, label) {
    $(id + '-image').replaceChildren(miniGrid(generated));
    $(id + '-image').classList.remove('empty-preview');
    $(id + '-image').setAttribute('aria-label', `${label} image, row-major pixels: ${generated.join('')}`);
    $(id + '-caption').textContent = `${label} · step ${metrics.steps} · loss ${metrics.loss.toFixed(3)}`;
  }
  async function runDemo() {
    experimentSettings();
    await reset();
    showStage(0, '1 of 3 · Drawing before any training…');
    await experimentImage();
    const startingLoss = metrics.loss;
    showSnapshot('before', 'Before');
    $('comparison').hidden = false;
    showStage(1, '2 of 3 · Practising on your examples…');
    while (metrics.steps < 100) {
      await update(Math.min(5, 100 - metrics.steps));
      $('experiment-status').textContent = `2 of 3 · Practising on your examples: ${metrics.steps} / 100 steps.`;
    }
    showStage(2, '3 of 3 · Drawing again with the trained model…');
    await experimentImage();
    showSnapshot('after', 'After');
    $('comparison-note').textContent = `Error went from ${startingLoss.toFixed(3)} to ${metrics.loss.toFixed(3)}. Which picture looks more like your examples? One sample is only a glimpse: try other seeds in advanced sampling.`;
    showStage(3, 'Done. Now paint your own example below, or open “Look inside” to see attention.');
    status('Demo complete · select a generated pixel to see its odds.');
  }
  $('experiment-next').onclick = () => perform(async () => {
    experimentRunning = true;
    syncControls();
    try {
      await runDemo();
    } catch (error) {
      report(error);
    } finally {
      experimentRunning = false;
    }
  });

  $('train').onclick = async () => {
    if (training) { training = false; syncControls(); status('Pausing after the current batch…'); return; }
    await perform(async () => {
      training = true;
      syncControls();
      status('Training locally · pause at any time.');
      while (training && metrics.steps < 2000) await update(Math.min(5, 2000 - metrics.steps));
      training = false;
      status(metrics.steps >= 2000 ? 'Step limit reached · reset to start a new run.' : 'Paused · weights kept. Ready to generate.');
    });
  };
  $('step').onclick = () => perform(async () => {
    if (metrics.steps >= 2000) { status('Step limit reached · reset to start a new run.'); return; }
    await update(1);
    status('Paused · one optimizer update complete.');
  });
  $('reset').onclick = () => perform(reset);
  $('generate').onclick = () => perform(async () => {
    generating = true;
    syncControls();
    restartCanvas();
    status('Generating from the learned weights…');
    while (generating && generated.length < 16) {
      await drawNextPixel();
      if (generated.length < 16) await new Promise(resolve => setTimeout(resolve, 150));
    }
    generating = false;
    status(generated.length === 16 ? `Image complete · sampled from the model at step ${metrics.steps}.` : 'Generation stopped · use Next pixel to continue.');
  });
  $('stop').onclick = () => { generating = false; $('stop').disabled = true; };
  $('next').onclick = () => perform(async () => {
    await drawNextPixel();
    status(generated.length === 16 ? 'Image complete · select a pixel to inspect its prediction.' : `Sampled ${generated.length} / 16 pixels.`);
  });
  $('restart').onclick = () => perform(async () => { restartCanvas(); await inspect(); status('Canvas restarted with the drawing prefix.'); });
  $('preset').onchange = () => perform(async () => {
    if (!confirmDiscard()) { $('preset').value = collection; return; }
    collection = $('preset').value;
    images = presets[$('preset').value].map(image => [...image]);
    selectedExample = 0;
    drawing = [...images[0]];
    renderExamples();
    renderEditor();
    await reset();
  });
  $('apply').onclick = () => perform(async () => {
    if (selectedExample === null) { images.push([...drawing]); selectedExample = images.length - 1; }
    else images[selectedExample] = [...drawing];
    renderExamples();
    renderEditor();
    await reset();
    status('Drawing saved · training restarted with the updated examples.');
  });
  $('add').onclick = () => {
    if (busy || !confirmDiscard()) return;
    selectedExample = null;
    drawing = Array(16).fill(0);
    renderExamples();
    renderEditor();
  };
  $('remove').onclick = () => perform(async () => {
    if (!confirmDiscard()) return;
    images.splice(selectedExample, 1);
    selectedExample = 0;
    drawing = [...images[0]];
    renderExamples();
    renderEditor();
    await reset();
  });
  $('clear').onclick = () => {
    if (busy) return;
    drawing = Array(16).fill(0);
    renderEditor();
  };
  $('learning-rate').oninput = () => { $('rate-value').textContent = Number($('learning-rate').value).toFixed(3); };
  $('temperature').oninput = () => {
    $('temperature-value').textContent = Number($('temperature').value).toFixed(1);
  };
  $('temperature').onchange = () => perform(inspect);
  $('prefix').oninput = () => { $('prefix-value').textContent = `${$('prefix').value} pixels`; };
  $('theme').onclick = () => {
    const light = document.body.classList.toggle('light');
    $('theme').textContent = light ? '☾' : '☼';
    $('theme').setAttribute('aria-label', `Switch to ${light ? 'dark' : 'light'} theme`);
  };
  ['hero-grid', 'hero-output'].forEach((id, index) => {
    const grid = miniGrid(presets.shapes[index ? 2 : 0]);
    $(id).replaceChildren(...grid.children);
  });
  new window.PixelPainter($('editor'), {
    canPaint: () => !busy && !failed,
    read: index => drawing[index],
    paint: paintPixel,
  });
  renderExamples();
  renderEditor();
  renderGenerated();
  async function initialize() {
    try {
      if (location.protocol === 'file:') throw new Error('Serve the repository with python3 -m http.server 8000, then open http://localhost:8000/image-lab/ to enable local training.');
      worker = new Worker('worker.js');
      worker.onmessage = ({ data }) => {
        const job = pending.get(data.id);
        if (!job) return;
        pending.delete(data.id);
        if (data.error) job.reject(new Error(data.error));
        else job.resolve(data.result);
      };
      worker.onerror = () => {
        failed = true;
        const error = new Error('The training worker could not start. Reload the page using a local HTTP server.');
        pending.forEach(job => job.reject(error));
        pending.clear();
        report(error);
        syncControls();
      };
      await reset();
    } catch (error) {
      failed = true;
      report(error);
      $('experiment-status').textContent = error.message;
    }
    finally { setBusy(false); }
  }
  window.addEventListener('pagehide', () => { training = false; generating = false; if (worker) worker.terminate(); });
  initialize();
})();
