// assets/diagrams.js
(function (root) {
  'use strict';

  // --- Pure helpers (unit tested, no DOM) ---
  function softmax(logits, temperature) {
    const max = Math.max(...logits);
    const exps = logits.map(l => Math.exp((l - max) / temperature));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(v => v / sum);
  }
  function arcPath(x1, x2, y, lift) {
    return `M${x1} ${y}Q${(x1 + x2) / 2} ${y - lift} ${x2} ${y}`;
  }
  function staggerDelay(index, step = 0.12) {
    return `${+(index * step).toFixed(2)}s`;
  }

  // --- DOM helpers (browser only) ---
  const NS = 'http://www.w3.org/2000/svg';

  function svgNode(parent, tag, attrs = {}, text = '') {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text) node.textContent = text;
    parent.append(node);
    return node;
  }

  // Adds .dg-in once the figure is visible, which starts the CSS animations.
  function revealOnScroll(figure) {
    const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) { figure.classList.add('dg-in'); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { figure.classList.add('dg-in'); observer.disconnect(); }
    }, { threshold: 0.25 });
    observer.observe(figure);
  }

  // Builds <figure class="concept-figure dg-figure"> with an accessible SVG; returns {figure, svg}.
  function makeFigure({ title, alt, caption, width = 480, height }) {
    const figure = document.createElement('figure');
    figure.className = 'concept-figure dg-figure';
    const heading = document.createElement('h3');
    heading.textContent = title;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('role', 'img');
    const titleId = 'dg-title-' + Math.random().toString(36).slice(2, 8);
    svg.setAttribute('aria-labelledby', titleId);
    svgNode(svg, 'title', { id: titleId }, alt);
    const figcaption = document.createElement('figcaption');
    figcaption.textContent = caption;
    figure.append(heading, svg, figcaption);
    revealOnScroll(figure);
    return { figure, svg };
  }

  // Rounded labelled box; index staggers its entrance.
  function box(svg, { x, y, w, h = 44, label, tone, index = 0, solid = false }) {
    const g = svgNode(svg, 'g', { class: `dg-box dg-${tone} dg-pop${solid ? ' dg-solid' : ''}`, style: `--i:${index}` });
    svgNode(g, 'rect', { x, y, width: w, height: h, rx: 10 });
    svgNode(g, 'text', { x: x + w / 2, y: y + h / 2 + 5, 'text-anchor': 'middle' }, label);
    return g;
  }

  // Animated dashed arrow with a small head; points from (x1,y1) to (x2,y2).
  function arrow(svg, { x1, y1, x2, y2, tone = 'blue', index = 0 }) {
    const g = svgNode(svg, 'g', { class: `dg-${tone} dg-pop`, style: `--i:${index}` });
    svgNode(g, 'line', { x1, y1, x2, y2, class: 'dg-dash dg-flow' });
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const head = [-0.5, 0.5].map(d => {
      const a = angle + Math.PI + d;
      return `${x2 + 8 * Math.cos(a)} ${y2 + 8 * Math.sin(a)}`;
    });
    svgNode(g, 'path', { d: `M${head[0]}L${x2} ${y2}L${head[1]}`, class: 'dg-stroke' });
    return g;
  }

  // --- Registry ---
  const builders = {};

  builders.rag = ({ svgNode, makeFigure, box, arrow }) => {
    const { figure, svg } = makeFigure({
      title: 'Search first, then generate',
      alt: 'A question goes to a document search, the retrieved passages go to the language model, and the model writes an answer grounded in them.',
      caption: 'The model answers using passages retrieved for this question, so the answer can be traced back to sources. Retrieval quality still limits answer quality.',
      height: 200
    });
    box(svg, { x: 16, y: 40, w: 84, label: 'Ask', tone: 'blue', index: 0 });
    box(svg, { x: 132, y: 40, w: 84, label: 'Docs', tone: 'blue', index: 1 });
    box(svg, { x: 248, y: 40, w: 84, label: 'LLM', tone: 'orange', index: 2 });
    box(svg, { x: 364, y: 40, w: 100, label: 'Answer', tone: 'teal', index: 3, solid: true });
    arrow(svg, { x1: 100, y1: 62, x2: 130, y2: 62, tone: 'blue', index: 1 });
    arrow(svg, { x1: 216, y1: 62, x2: 246, y2: 62, tone: 'blue', index: 2 });
    arrow(svg, { x1: 332, y1: 62, x2: 362, y2: 62, tone: 'orange', index: 3 });
    // Source stack under "Docs"
    for (let i = 0; i < 3; i++) {
      const g = svgNode(svg, 'g', { class: 'dg-blue dg-pop', style: `--i:${4 + i}` });
      svgNode(g, 'rect', { x: 140 + i * 8, y: 112 + i * 8, width: 56, height: 22, rx: 4, class: 'dg-box', style: 'fill:var(--paper);stroke:var(--tone);stroke-width:1.5' });
    }
    svgNode(svg, 'text', { x: 174, y: 172, 'text-anchor': 'middle', class: 'dg-small' }, 'your documents');
    svgNode(svg, 'path', { d: 'M174 110V86', class: 'dg-dash dg-blue' });
    // Dot travelling along the whole pipeline
    svgNode(svg, 'circle', { r: 6, class: 'dg-dot dg-orange dg-travel', style: "offset-path:path('M58 62H414')" });
    return figure;
  };

  builders.temperature = ({ svgNode, makeFigure }) => {
    const logits = [3, 2, 1, 0.5];
    const labels = ['A', 'B', 'C', 'D'];
    const panels = [
      { x: 20, name: 'Low temperature: sharp', t: 0.3, tone: 'blue' },
      { x: 260, name: 'High temperature: flat', t: 2, tone: 'orange' }
    ];
    const top = panels.map(p => Math.round(softmax(logits, p.t)[0] * 100));
    const { figure, svg } = makeFigure({
      title: 'Same scores, different sampling odds',
      alt: `Four candidate tokens with fixed scores. At low temperature token A gets ${top[0]}% of the probability; at high temperature it gets ${top[1]}%.`,
      caption: 'Temperature reshapes the probabilities of the same candidate tokens. Lower values favor the top token more strongly; this does not make the top token correct.',
      height: 240
    });
    const base = 190, max = 120;
    panels.forEach((panel, pi) => {
      svgNode(svg, 'text', { x: panel.x + 100, y: 24, 'text-anchor': 'middle' }, panel.name);
      svgNode(svg, 'line', { x1: panel.x, y1: base, x2: panel.x + 200, y2: base, stroke: 'var(--line)', 'stroke-width': 2 });
      softmax(logits, panel.t).forEach((p, i) => {
        const height = Math.max(p * max, 3);
        const x = panel.x + 14 + i * 48;
        const g = svgNode(svg, 'g', { class: `dg-${panel.tone}` });
        svgNode(g, 'rect', { x, y: base - height, width: 34, height, rx: 4, class: 'dg-fill dg-grow', style: `--i:${pi * 2 + i}` });
        svgNode(g, 'text', { x: x + 17, y: base - height - 6, 'text-anchor': 'middle', class: 'dg-small dg-pop', style: `--i:${pi * 2 + i + 3}` }, Math.round(p * 100) + '%');
        svgNode(svg, 'text', { x: x + 17, y: base + 20, 'text-anchor': 'middle' }, labels[i]);
      });
    });
    svgNode(svg, 'text', { x: 240, y: 232, 'text-anchor': 'middle', class: 'dg-small' }, 'next-token odds');
    return figure;
  };
  builders.tokenization = ({ svgNode, makeFigure, box, arrow }) => {
    const { figure, svg } = makeFigure({
      title: 'Text is split into tokens',
      alt: 'The word unhappiness is split into the tokens un, happi and ness, and each token is then mapped to a number.',
      caption: 'The split is illustrative; real tokenizers choose pieces from their own learned vocabulary. The model sees the resulting numbers, not letters.',
      height: 190
    });
    box(svg, { x: 16, y: 40, w: 140, label: 'unhappiness', tone: 'teal', index: 0 });
    arrow(svg, { x1: 156, y1: 62, x2: 192, y2: 62, tone: 'teal', index: 1 });
    ['un', 'happi', 'ness'].forEach((label, i) => {
      const x = 196 + i * 92;
      box(svg, { x, y: 40, w: 80, label, tone: 'teal', index: 2 + i, solid: i === 1 });
      arrow(svg, { x1: x + 40, y1: 86, x2: x + 40, y2: 116, tone: 'blue', index: 5 + i });
      box(svg, { x: x + 10, y: 120, w: 60, h: 34, label: 'ID', tone: 'blue', index: 6 + i });
    });
    svgNode(svg, 'text', { x: 240, y: 178, 'text-anchor': 'middle', class: 'dg-small' }, 'then token IDs');
    return figure;
  };

  builders.transformers = ({ svgNode, makeFigure, box }) => {
    const { figure, svg } = makeFigure({
      title: 'Attention: each token weighs the others',
      alt: 'In the sentence dog chased its tail, the token its attends most strongly to dog, less to chased, and least to tail.',
      caption: 'Arc thickness shows attention weight. Here "its" leans most on "dog" to resolve what it refers to. The weights are illustrative.',
      height: 180
    });
    const tokens = [['dog', 60], ['chased', 170], ['its', 290], ['tail', 400]];
    const links = [[60, 3.6, 78, 'blue'], [170, 2, 48, 'purple'], [400, 1.2, 40, 'orange']];
    links.forEach(([x, width, lift, tone], i) => {
      svgNode(svg, 'path', {
        d: arcPath(290, x, 120, lift), pathLength: 1, class: `dg-stroke dg-draw dg-${tone}`,
        style: `--i:${i + 4};stroke-width:${width}`
      });
    });
    tokens.forEach(([label, cx], i) => {
      box(svg, { x: cx - 38, y: 126, w: 76, h: 36, label, tone: 'teal', index: i, solid: label === 'its' });
    });
    return figure;
  };

  builders['embedding-models'] = ({ svgNode, makeFigure }) => {
    const { figure, svg } = makeFigure({
      title: 'Similar meanings sit close together',
      alt: 'A two-dimensional sketch of an embedding space: king and queen are close, car and bus are close, apple and banana are close, and the three groups are far apart.',
      caption: 'A simplified 2D sketch; real embeddings have hundreds or thousands of dimensions. Closeness approximates similarity of meaning, not truth.',
      height: 210
    });
    const groups = [
      { tone: 'purple', cx: 100, cy: 70, words: [['king', -26, -8], ['queen', 22, 14]], start: [-70, 40] },
      { tone: 'blue', cx: 370, cy: 60, words: [['car', -18, -6], ['bus', 24, 16]], start: [60, 60] },
      { tone: 'orange', cx: 240, cy: 150, words: [['apple', -26, 4], ['banana', 26, -4]], start: [-40, -80] }
    ];
    let index = 0;
    groups.forEach(group => {
      const ring = svgNode(svg, 'ellipse', { cx: group.cx, cy: group.cy, rx: 62, ry: 36, class: `dg-dash dg-${group.tone} dg-pop`, style: `--i:${index + 6}` });
      group.words.forEach(([word, dx, dy]) => {
        const g = svgNode(svg, 'g', { class: `dg-${group.tone} dg-drift`, style: `--i:${index};--dx:${group.start[0]}px;--dy:${group.start[1]}px` });
        svgNode(g, 'circle', { cx: group.cx + dx, cy: group.cy + dy, r: 7, class: 'dg-dot' });
        svgNode(g, 'text', { x: group.cx + dx + 12, y: group.cy + dy + 5 }, word);
        index++;
      });
    });
    return figure;
  };

  builders.agents = ({ svgNode, makeFigure, box, arrow }) => {
    const { figure, svg } = makeFigure({
      title: 'The decision and action loop',
      alt: 'An agent loops through four steps: observe the task and evidence, decide the next step, act with a tool, then check the result before repeating or finishing.',
      caption: 'The model chooses steps; the surrounding application executes them. The loop ends when the check passes or a limit is reached.',
      height: 220
    });
    box(svg, { x: 40, y: 30, w: 120, label: 'Observe', tone: 'blue', index: 0 });
    box(svg, { x: 320, y: 30, w: 120, label: 'Decide', tone: 'purple', index: 1, solid: true });
    box(svg, { x: 320, y: 140, w: 120, label: 'Act', tone: 'orange', index: 2 });
    box(svg, { x: 40, y: 140, w: 120, label: 'Check', tone: 'teal', index: 3 });
    arrow(svg, { x1: 160, y1: 52, x2: 318, y2: 52, tone: 'blue', index: 1 });
    arrow(svg, { x1: 380, y1: 76, x2: 380, y2: 138, tone: 'purple', index: 2 });
    arrow(svg, { x1: 320, y1: 162, x2: 162, y2: 162, tone: 'orange', index: 3 });
    arrow(svg, { x1: 100, y1: 138, x2: 100, y2: 78, tone: 'teal', index: 4 });
    svgNode(svg, 'text', { x: 240, y: 112, 'text-anchor': 'middle', class: 'dg-small' }, 'repeat until done');
    svgNode(svg, 'circle', { r: 6, class: 'dg-dot dg-purple dg-travel', style: "offset-path:path('M100 52H380V162H100Z')" });
    return figure;
  };

  builders.context = ({ svgNode, makeFigure }) => {
    const { figure, svg } = makeFigure({
      title: 'A context window slides over the text',
      alt: 'A row of tokens with a highlighted window over the most recent ones. As a new token arrives on the right, the oldest token on the left falls out of view.',
      caption: 'The model can only consult what fits in the window. Older tokens that fall out are not visible to it unless re-supplied or summarized.',
      height: 150
    });
    const x0 = 20, step = 36;
    for (let i = 0; i < 12; i++) {
      const classes = ['dg-teal'];
      if (i < 4) classes.push('dg-old');
      if (i === 4) classes.push('dg-drop');
      if (i === 11) classes.push('dg-add');
      const g = svgNode(svg, 'g', { class: classes.join(' ') + ' dg-box' });
      svgNode(g, 'rect', { x: x0 + i * step, y: 50, width: 28, height: 34, rx: 6, style: i === 11 ? 'opacity:1' : '' });
    }
    // Window outline sits over cells 4..10 and slides one cell to the right
    svgNode(svg, 'rect', {
      x: x0 + 4 * step - 5, y: 42, width: 7 * step + 2, height: 50, rx: 10,
      fill: 'none', stroke: 'var(--dg-purple)', 'stroke-width': 3, class: 'dg-slide'
    });
    svgNode(svg, 'text', { x: 240, y: 128, 'text-anchor': 'middle', class: 'dg-small' }, 'newest in, oldest out');
    return figure;
  };

  builders['kv-cache'] = ({ svgNode, makeFigure, box, arrow }) => {
    const { figure, svg } = makeFigure({
      title: 'Reuse stored keys and values',
      alt: 'Earlier tokens The, cat and sat have their keys and values stored in a cache. When the new token on arrives, the model reuses the cache instead of recomputing the earlier tokens, then adds the new token to the cache.',
      caption: 'Caching saves recomputation of earlier tokens during generation, at the cost of memory that grows with context length.',
      height: 190
    });
    const container = svgNode(svg, 'g', { class: 'dg-blue dg-pop', style: '--i:0' });
    svgNode(container, 'rect', { x: 16, y: 40, width: 270, height: 70, rx: 12, class: 'dg-dash' });
    svgNode(container, 'text', { x: 28, y: 34, class: 'dg-small' }, 'KV cache');
    ['The', 'cat', 'sat'].forEach((label, i) => box(svg, { x: 30 + i * 84, y: 52, w: 72, h: 46, label, tone: 'blue', index: 1 + i }));
    arrow(svg, { x1: 288, y1: 75, x2: 346, y2: 75, tone: 'orange', index: 4 });
    box(svg, { x: 350, y: 52, w: 100, h: 46, label: 'on', tone: 'orange', index: 5, solid: true });
    svgNode(svg, 'text', { x: 400, y: 40, 'text-anchor': 'middle', class: 'dg-small' }, 'new token');
    svgNode(svg, 'text', { x: 151, y: 134, 'text-anchor': 'middle', class: 'dg-small' }, 'computed once, reused');
    svgNode(svg, 'path', {
      d: arcPath(400, 270, 108, -40), pathLength: 1,
      class: 'dg-stroke dg-draw dg-orange', style: '--i:6;stroke-dasharray:1'
    });
    svgNode(svg, 'text', { x: 330, y: 178, 'text-anchor': 'middle', class: 'dg-small' }, 'then appended to the cache');
    return figure;
  };

  // Draws an X or check glyph from paths (shape, not colour alone, carries the meaning).
  function glyph(svgNode, svg, kind, cx, cy, tone, index) {
    const d = kind === 'x'
      ? `M${cx - 12} ${cy - 12}L${cx + 12} ${cy + 12}M${cx + 12} ${cy - 12}L${cx - 12} ${cy + 12}`
      : `M${cx - 12} ${cy}L${cx - 3} ${cy + 11}L${cx + 14} ${cy - 12}`;
    return svgNode(svg, 'path', { d, pathLength: 1, class: `dg-stroke dg-draw dg-${tone}`, style: `--i:${index};stroke-width:4` });
  }

  builders.quantization = ({ svgNode, makeFigure }) => {
    const { figure, svg } = makeFigure({
      title: 'Fewer bits per weight',
      alt: 'Two bars compare storage per weight: a long orange bar for 16 bits per weight and a bar a quarter as long, in teal, for 4 bits per weight.',
      caption: 'Storing weights in 4 bits instead of 16 needs roughly 4x less memory for those weights, at the cost of some precision loss. Activations and the KV cache are quantized separately, and real savings depend on the format.',
      height: 190
    });
    [['16 bits per weight', 440, 'orange', 28], ['4 bits per weight', 110, 'teal', 92]].forEach(([label, w, tone, y], i) => {
      svgNode(svg, 'text', { x: 20, y, class: 'dg-pop', style: `--i:${i}` }, label);
      const g = svgNode(svg, 'g', { class: `dg-${tone}` });
      svgNode(g, 'rect', { x: 20, y: y + 10, width: w, height: 30, rx: 6, class: 'dg-fill dg-grow', style: `--i:${i * 3 + 1}` });
    });
    svgNode(svg, 'text', { x: 140, y: 150, class: 'dg-small dg-pop', style: '--i:6' }, '~4x less memory for weights');
    svgNode(svg, 'text', { x: 140, y: 172, class: 'dg-small dg-pop', style: '--i:7' }, 'some precision is lost');
    return figure;
  };

  builders.lora = ({ svgNode, makeFigure, box, arrow }) => {
    const { figure, svg } = makeFigure({
      title: 'Train a small adapter, keep W frozen',
      alt: 'A large blue weight matrix W marked frozen and a small orange adapter made of two thin matrices A and B both feed a sum that gives the output: output = W x + adapter. Only the adapter is trained.',
      caption: 'LoRA freezes the base weights and trains only two small matrices whose product approximates the weight update. The adapter is a small fraction of the parameters, but quality depends on the chosen rank and data.',
      height: 220
    });
    box(svg, { x: 24, y: 36, w: 200, h: 64, label: 'W (frozen)', tone: 'blue', index: 0 });
    const ad = svgNode(svg, 'g', { class: 'dg-orange dg-pop dg-pulse', style: '--i:2' });
    svgNode(ad, 'rect', { x: 70, y: 126, width: 16, height: 56, rx: 3, class: 'dg-fill' });
    svgNode(ad, 'rect', { x: 110, y: 146, width: 64, height: 16, rx: 3, class: 'dg-fill' });
    svgNode(svg, 'text', { x: 78, y: 120, 'text-anchor': 'middle', class: 'dg-small' }, 'A');
    svgNode(svg, 'text', { x: 142, y: 140, 'text-anchor': 'middle', class: 'dg-small' }, 'B');
    svgNode(svg, 'text', { x: 122, y: 204, 'text-anchor': 'middle', class: 'dg-small' }, 'adapter (trained)');
    arrow(svg, { x1: 224, y1: 68, x2: 298, y2: 68, tone: 'blue', index: 1 });
    svgNode(svg, 'path', { d: 'M178 154H320V90', pathLength: 1, class: 'dg-stroke dg-draw dg-orange', style: '--i:3' });
    const plus = svgNode(svg, 'g', { class: 'dg-purple dg-pop', style: '--i:3' });
    svgNode(plus, 'circle', { cx: 320, cy: 68, r: 18, class: 'dg-dot' });
    svgNode(plus, 'text', { x: 320, y: 74, 'text-anchor': 'middle', style: 'fill:#fff;font-weight:700' }, '+');
    arrow(svg, { x1: 338, y1: 68, x2: 376, y2: 68, tone: 'purple', index: 4 });
    box(svg, { x: 380, y: 46, w: 84, h: 44, label: 'output', tone: 'teal', index: 5, solid: true });
    svgNode(svg, 'text', { x: 340, y: 190, 'text-anchor': 'middle', class: 'dg-small' }, 'output = W x + adapter');
    return figure;
  };

  builders['mixture-of-experts'] = ({ svgNode, makeFigure, box, arrow }) => {
    const { figure, svg } = makeFigure({
      title: 'A router picks a few experts',
      alt: 'A token goes to a router, which sends it to two of four experts, experts 1 and 3. The other two experts do not run for this token.',
      caption: 'In a sparse mixture-of-experts layer only the selected experts process each token, so total parameters can be much larger than those used per token. Other layers are usually shared, and the chosen experts here are illustrative.',
      height: 232
    });
    box(svg, { x: 12, y: 90, w: 80, label: 'Token', tone: 'blue', index: 0 });
    arrow(svg, { x1: 92, y1: 112, x2: 128, y2: 112, tone: 'blue', index: 1 });
    box(svg, { x: 132, y: 90, w: 84, label: 'Router', tone: 'purple', index: 2, solid: true });
    const chosen = [true, false, true, false];
    chosen.forEach((on, i) => {
      const cy = 29 + i * 52;
      svgNode(svg, 'path', { d: `M216 112L340 ${cy}`, pathLength: 1, class: on ? 'dg-stroke dg-draw dg-teal' : 'dg-dash dg-blue dg-pop', style: `--i:${3 + i}` });
      box(svg, { x: 340, y: cy - 17, w: 120, h: 34, label: `Expert ${i + 1}`, tone: on ? 'teal' : 'blue', index: 3 + i, solid: on });
      if (on) svgNode(svg, 'circle', { r: 6, class: 'dg-dot dg-teal dg-travel', style: `offset-path:path('M216 112L340 ${cy}')` });
    });
    svgNode(svg, 'text', { x: 174, y: 190, 'text-anchor': 'middle', class: 'dg-small' }, 'top-2 of 4 run');
    return figure;
  };

  builders['prompt-injection'] = ({ svgNode, makeFigure, box, arrow }) => {
    const { figure, svg } = makeFigure({
      title: 'Outside text is data, not orders',
      alt: 'A trusted system instruction reaches the model. An untrusted web page saying ignore all rules tries to reach it too, but its path is marked blocked with an X. Outside content should be treated as data.',
      caption: 'Text from pages, files or tool results can contain instructions aimed at the model. Treating it as data, with permission limits, reduces the risk; no wording alone guarantees safety.',
      height: 232
    });
    box(svg, { x: 16, y: 20, w: 200, label: 'System: be helpful', tone: 'teal', index: 0 });
    const bad = svgNode(svg, 'g', { class: 'dg-orange dg-pop', style: '--i:1' });
    svgNode(bad, 'rect', { x: 16, y: 150, width: 240, height: 44, rx: 10, class: 'dg-dash', style: 'fill:var(--paper);stroke-width:2' });
    svgNode(bad, 'text', { x: 136, y: 177, 'text-anchor': 'middle' }, 'Page: ignore all rules');
    box(svg, { x: 340, y: 86, w: 100, label: 'LLM', tone: 'purple', index: 2, solid: true });
    arrow(svg, { x1: 216, y1: 42, x2: 338, y2: 98, tone: 'teal', index: 2 });
    arrow(svg, { x1: 256, y1: 172, x2: 338, y2: 118, tone: 'orange', index: 3 });
    glyph(svgNode, svg, 'x', 297, 145, 'orange', 4);
    svgNode(svg, 'text', { x: 240, y: 222, 'text-anchor': 'middle', class: 'dg-small' }, 'treat outside content as data');
    return figure;
  };

  builders.hallucinations = ({ svgNode, makeFigure, box, arrow }) => {
    const { figure, svg } = makeFigure({
      title: 'Fluent is not the same as true',
      alt: 'Asked for the capital of Australia, a model answers Sydney, of course, which is fluent but wrong and is marked with an X. The truth, Canberra, is marked with a check.',
      caption: 'A confident, well-written answer can be unsupported. Ground answers in sources and verify claims that matter; evidence helps but does not guarantee correctness.',
      height: 204
    });
    box(svg, { x: 16, y: 14, w: 250, h: 40, label: 'Capital of Australia?', tone: 'blue', index: 0 });
    arrow(svg, { x1: 141, y1: 56, x2: 141, y2: 80, tone: 'blue', index: 1 });
    box(svg, { x: 16, y: 84, w: 250, h: 40, label: 'Sydney, of course.', tone: 'orange', index: 2 });
    glyph(svgNode, svg, 'x', 306, 104, 'orange', 3);
    svgNode(svg, 'text', { x: 336, y: 109, class: 'dg-small dg-pop', style: '--i:3' }, 'fluent, but wrong');
    arrow(svg, { x1: 141, y1: 126, x2: 141, y2: 150, tone: 'teal', index: 4 });
    box(svg, { x: 16, y: 154, w: 250, h: 40, label: 'Truth: Canberra', tone: 'teal', index: 5, solid: true });
    glyph(svgNode, svg, 'check', 306, 174, 'teal', 6);
    svgNode(svg, 'text', { x: 336, y: 179, class: 'dg-small dg-pop', style: '--i:6' }, 'matches a source');
    return figure;
  };

  builders['rag-vs-graphrag'] = ({ svgNode, makeFigure, box, arrow }) => {
    const { figure, svg } = makeFigure({
      title: 'Similar chunks vs connected entities',
      alt: 'Left: a query retrieves three text chunks by vector similarity. Right: a small graph of five entities linked by relations such as relates and uses, which retrieval can follow.',
      caption: 'GraphRAG is a form of RAG that also uses relationships between entities, not a replacement for it. Building and maintaining the graph adds cost, and which approach helps depends on the questions.',
      height: 232
    });
    svgNode(svg, 'text', { x: 121, y: 22, 'text-anchor': 'middle' }, 'RAG: similar chunks');
    svgNode(svg, 'text', { x: 359, y: 22, 'text-anchor': 'middle' }, 'GraphRAG: connected entities');
    box(svg, { x: 16, y: 98, w: 72, h: 40, label: 'Query', tone: 'blue', index: 0 });
    [0, 1, 2].forEach(i => {
      const y = 46 + i * 52;
      arrow(svg, { x1: 88, y1: 118, x2: 138, y2: y + 15, tone: 'blue', index: 1 + i });
      box(svg, { x: 142, y, w: 84, h: 30, label: `chunk ${i + 1}`, tone: 'blue', index: 2 + i });
    });
    svgNode(svg, 'text', { x: 121, y: 214, 'text-anchor': 'middle', class: 'dg-small' }, 'vector similarity');
    const n = [[300, 70], [400, 60], [350, 130], [280, 190], [430, 170]];
    [[0, 1, 0], [0, 2, 1], [1, 2, 2], [2, 3, 3], [2, 4, 4]].forEach(([a, b, i]) => {
      svgNode(svg, 'path', { d: `M${n[a][0]} ${n[a][1]}L${n[b][0]} ${n[b][1]}`, pathLength: 1, class: 'dg-stroke dg-draw dg-purple', style: `--i:${i + 2}` });
    });
    svgNode(svg, 'text', { x: 350, y: 48, 'text-anchor': 'middle', class: 'dg-small dg-pop', style: '--i:7' }, 'relates');
    svgNode(svg, 'text', { x: 400, y: 138, class: 'dg-small dg-pop', style: '--i:7' }, 'uses');
    n.forEach(([cx, cy], i) => {
      const g = svgNode(svg, 'g', { class: 'dg-purple dg-pop', style: `--i:${i + 1}` });
      svgNode(g, 'circle', { cx, cy, r: 14, class: 'dg-dot' });
    });
    svgNode(svg, 'text', { x: 359, y: 224, 'text-anchor': 'middle', class: 'dg-small' }, 'follow relationships');
    return figure;
  };

  builders.reranking = ({ svgNode, makeFigure, box }) => {
    const { figure, svg } = makeFigure({
      title: 'Re-score the shortlist',
      alt: 'Four candidates c1 to c4 come from retrieval in that order. A reranker scores each against the query and reorders them, moving c3 to the top. The scores are illustrative.',
      caption: 'A reranker reads the query together with each candidate and reorders the shortlist; this is usually more accurate but costs extra computation. The scores shown are illustrative.',
      height: 246
    });
    svgNode(svg, 'text', { x: 66, y: 24, 'text-anchor': 'middle' }, 'Retrieved order');
    svgNode(svg, 'text', { x: 414, y: 24, 'text-anchor': 'middle' }, 'By relevance');
    const order = [['c3', '0.92'], ['c1', '0.71'], ['c2', '0.55'], ['c4', '0.30']];
    const from = { c1: 0, c2: 1, c3: 2, c4: 3 };
    for (let i = 0; i < 4; i++) box(svg, { x: 16, y: 40 + i * 48, w: 100, h: 36, label: `c${i + 1}`, tone: 'blue', index: i });
    order.forEach(([id, score], to) => {
      const top = id === 'c3';
      svgNode(svg, 'path', {
        d: `M118 ${58 + from[id] * 48}L362 ${58 + to * 48}`, pathLength: 1,
        class: `dg-stroke dg-draw dg-${top ? 'orange' : 'blue'}`, style: `--i:${4 + to};stroke-width:${top ? 3.5 : 1.6}`
      });
      box(svg, { x: 364, y: 40 + to * 48, w: 100, h: 36, label: `${id}  ${score}`, tone: top ? 'orange' : 'blue', index: 6 + to, solid: top });
    });
    svgNode(svg, 'text', { x: 240, y: 238, 'text-anchor': 'middle', class: 'dg-small' }, 'scores are illustrative');
    return figure;
  };

  builders['vector-databases'] = ({ svgNode, makeFigure }) => {
    const { figure, svg } = makeFigure({
      title: 'Find the nearest vectors',
      alt: 'A 2D cloud of twelve stored points and a purple query point. Lines connect the query to its three nearest neighbors, which are returned as results.',
      caption: 'A vector database returns stored embeddings nearest to the query. Approximate nearest-neighbor search trades a little recall for speed, and nearby vectors are similar, not necessarily correct.',
      height: 214
    });
    const q = [240, 100];
    const pts = [[60, 40], [120, 150], [90, 90], [150, 50], [200, 70], [275, 125], [228, 138], [330, 50], [380, 120], [420, 60], [350, 160], [440, 150]];
    const near = [4, 5, 6];
    pts.forEach(([cx, cy], i) => {
      const hit = near.includes(i);
      const g = svgNode(svg, 'g', { class: `dg-${hit ? 'purple' : 'blue'} dg-pop`, style: `--i:${i % 6}` });
      svgNode(g, 'circle', { cx, cy, r: hit ? 7 : 5, class: 'dg-dot' });
    });
    near.forEach((p, i) => {
      svgNode(svg, 'path', { d: `M${q[0]} ${q[1]}L${pts[p][0]} ${pts[p][1]}`, pathLength: 1, class: 'dg-stroke dg-draw dg-purple', style: `--i:${6 + i};stroke-width:1.6` });
    });
    const query = svgNode(svg, 'g', { class: 'dg-purple dg-pop', style: '--i:5' });
    svgNode(query, 'circle', { cx: q[0], cy: q[1], r: 14, class: 'dg-stroke dg-pulse' });
    svgNode(query, 'circle', { cx: q[0], cy: q[1], r: 6, class: 'dg-dot' });
    svgNode(svg, 'text', { x: 240, y: 76, 'text-anchor': 'middle', class: 'dg-small' }, 'query');
    svgNode(svg, 'text', { x: 240, y: 200, 'text-anchor': 'middle', class: 'dg-small' }, '3 nearest neighbors returned');
    return figure;
  };

  builders['tool-calling'] = ({ svgNode, makeFigure, box, arrow }) => {
    const { figure, svg } = makeFigure({
      title: 'The model asks, the application acts',
      alt: 'The model sends a request with a tool name and arguments to the tool, the application runs the tool, and the result returns to the model. The application executes the tool, not the model.',
      caption: 'The model only requests a call with a name and arguments; your application validates and runs it, then returns the result. A requested call is not evidence that it ran.',
      height: 220
    });
    box(svg, { x: 20, y: 78, w: 110, h: 60, label: 'Model', tone: 'purple', index: 0, solid: true });
    box(svg, { x: 350, y: 78, w: 110, h: 60, label: 'Tool', tone: 'orange', index: 1 });
    arrow(svg, { x1: 132, y1: 94, x2: 348, y2: 94, tone: 'purple', index: 2 });
    svgNode(svg, 'text', { x: 240, y: 82, 'text-anchor': 'middle', class: 'dg-small dg-pop', style: '--i:3' }, 'request: name + arguments');
    arrow(svg, { x1: 348, y1: 124, x2: 132, y2: 124, tone: 'orange', index: 3 });
    svgNode(svg, 'text', { x: 240, y: 150, 'text-anchor': 'middle', class: 'dg-small dg-pop', style: '--i:4' }, 'result');
    svgNode(svg, 'text', { x: 405, y: 164, 'text-anchor': 'middle', class: 'dg-small dg-pop', style: '--i:4' }, 'run by your app');
    svgNode(svg, 'circle', { r: 6, class: 'dg-dot dg-purple dg-travel', style: "offset-path:path('M132 94H348V124H132');animation-duration:4s" });
    svgNode(svg, 'text', { x: 240, y: 204, 'text-anchor': 'middle', class: 'dg-small' }, 'the application executes the tool, not the model');
    return figure;
  };

  builders.chunking = ({ svgNode, makeFigure, box }) => {
    const { figure, svg } = makeFigure({
      title: 'Split a document into overlapping chunks',
      alt: 'A long document bar is split into four chunks. Neighboring chunks share a small overlap, highlighted and labelled overlap, so a sentence cut at a boundary still appears whole in one chunk.',
      caption: 'Chunks are the units a retrieval system stores and returns. A small overlap keeps boundary context; sizes and overlap are tunable, and too much overlap duplicates text.',
      height: 206
    });
    box(svg, { x: 20, y: 20, w: 440, h: 30, label: 'long document', tone: 'blue', index: 0 });
    for (let i = 0; i < 4; i++) {
      const g = svgNode(svg, 'g', { class: 'dg-drift', style: `--i:${i + 1};--dx:0px;--dy:-64px` });
      box(g, { x: 20 + i * 105, y: i % 2 ? 124 : 80, w: 125, h: 34, label: `chunk ${i + 1}`, tone: 'teal', index: 3 });
    }
    for (let i = 1; i < 4; i++) {
      const x = 20 + i * 105;
      const g = svgNode(svg, 'g', { class: 'dg-orange dg-pop', style: `--i:${6 + i}` });
      svgNode(g, 'rect', { x, y: 74, width: 20, height: 90, rx: 4, style: 'fill:var(--tone);fill-opacity:.35;stroke:var(--tone);stroke-width:1.5' });
      svgNode(g, 'text', { x: x + 10, y: 188, 'text-anchor': 'middle', class: 'dg-small' }, 'overlap');
    }
    return figure;
  };

  builders['hybrid-retrieval'] = ({ svgNode, makeFigure, box, arrow }) => {
    const { figure, svg } = makeFigure({
      title: 'Two searches, one fused list',
      alt: 'A query goes to a keyword lane using BM25 and a vector lane. Each returns its own ranked list, and a fuse step merges the two lists into one.',
      caption: 'Keyword search catches exact terms and codes; vector search catches similar meaning. Fusing their ranked lists can improve coverage. Rankings shown are illustrative and fusion methods vary.',
      height: 214
    });
    box(svg, { x: 12, y: 98, w: 70, label: 'Query', tone: 'blue', index: 0 });
    const lanes = [['keyword (BM25)', 40, 'blue', ['d1', 'd3', 'd2']], ['vector', 160, 'teal', ['d2', 'd1', 'd4']]];
    lanes.forEach(([label, y, tone, ids], li) => {
      const cy = y + 20;
      arrow(svg, { x1: 82, y1: li ? 130 : 110, x2: 106, y2: cy + (li ? -6 : 6), tone, index: 1 });
      box(svg, { x: 108, y, w: 124, h: 40, label, tone, index: 2 });
      ids.forEach((id, k) => box(svg, { x: 244 + k * 40, y: cy - 14, w: 34, h: 28, label: id, tone, index: 3 + k }));
      arrow(svg, { x1: 366, y1: cy, x2: 386, y2: cy + (li ? -22 : 22), tone, index: 6 });
    });
    box(svg, { x: 388, y: 98, w: 80, label: 'fuse', tone: 'orange', index: 7, solid: true });
    svgNode(svg, 'text', { x: 428, y: 162, 'text-anchor': 'middle', class: 'dg-small dg-pop', style: '--i:8' }, 'one merged list');
    svgNode(svg, 'text', { x: 428, y: 182, 'text-anchor': 'middle', class: 'dg-small dg-pop', style: '--i:8' }, 'd1 d2 d3 d4');
    return figure;
  };

  builders['react-agent-loop'] = ({ svgNode, makeFigure, box, arrow }) => {
    const { figure, svg } = makeFigure({
      title: 'Think, act, observe, repeat',
      alt: 'A loop of three boxes: think, act with a tool, observe the result. The loop returns to think until a stop condition sends it to the final answer; a step budget also stops it.',
      caption: 'The model decides, the runtime executes, and the result feeds the next decision. Stop conditions and budgets keep the loop bounded. Step counts are illustrative.',
      height: 214
    });
    box(svg, { x: 12, y: 30, w: 100, label: 'think', tone: 'blue', index: 0 });
    box(svg, { x: 190, y: 30, w: 100, label: 'act (tool)', tone: 'teal', index: 2 });
    box(svg, { x: 190, y: 120, w: 100, label: 'observe', tone: 'orange', index: 4 });
    arrow(svg, { x1: 112, y1: 50, x2: 188, y2: 50, tone: 'teal', index: 1 });
    arrow(svg, { x1: 240, y1: 70, x2: 240, y2: 118, tone: 'orange', index: 3 });
    arrow(svg, { x1: 188, y1: 140, x2: 62, y2: 72, tone: 'blue', index: 5 });
    box(svg, { x: 360, y: 30, w: 108, label: 'final answer', tone: 'blue', index: 6, solid: true });
    arrow(svg, { x1: 290, y1: 50, x2: 358, y2: 50, tone: 'blue', index: 6 });
    svgNode(svg, 'text', { x: 324, y: 42, 'text-anchor': 'middle', class: 'dg-small dg-pop', style: '--i:7' }, 'done?');
    svgNode(svg, 'text', { x: 414, y: 142, 'text-anchor': 'middle', class: 'dg-small dg-pop', style: '--i:7' }, 'budget: max 8 steps');
    svgNode(svg, 'text', { x: 414, y: 162, 'text-anchor': 'middle', class: 'dg-small dg-pop', style: '--i:7' }, 'then stop and report');
    return figure;
  };

  builders['hnsw'] = ({ svgNode, makeFigure, box }) => {
    const { figure, svg } = makeFigure({
      title: 'Hop down the layers toward the query',
      alt: 'Three layers of a graph, sparse at the top and dense at the bottom. A search path enters at the top, hops toward the query, drops a layer, and ends at the nearest vectors on the bottom layer.',
      caption: 'Search starts on a sparse layer, makes long hops, then refines on denser layers. It is approximate: it may miss the true nearest neighbour. Positions are illustrative.',
      height: 214
    });
    const layers = [['layer 2 (sparse)', 20, [60, 200, 380]], ['layer 1', 80, [40, 120, 220, 300, 400]], ['layer 0 (all vectors)', 140, [30, 90, 150, 210, 270, 330, 390, 440]]];
    layers.forEach(([label, y, xs], li) => {
      svgNode(svg, 'text', { x: 10, y: y - 6, class: 'dg-small dg-pop', style: '--i:' + li }, label);
      xs.forEach((x, k) => svgNode(svg, 'circle', { cx: x, cy: y + 14, r: 6, class: 'dg-pop', style: 'fill:var(--tone);fill-opacity:.35;stroke:var(--tone);stroke-width:1.5;--i:' + (li * 2 + (k % 2)) }));
    });
    svgNode(svg, 'path', { d: 'M60 34L200 34L220 94L270 154L330 154', class: 'dg-draw', style: 'fill:none;stroke:var(--tone);stroke-width:2.5;--i:4' });
    svgNode(svg, 'text', { x: 340, y: 190, 'text-anchor': 'middle', class: 'dg-small dg-pop', style: '--i:6' }, 'nearest neighbours found');
    return figure;
  };

  builders['reciprocal-rank-fusion'] = ({ svgNode, makeFigure, box, arrow }) => {
    const { figure, svg } = makeFigure({
      title: 'Fuse ranks, not scores',
      alt: 'Two ranked lists, keyword and vector, each give document A a rank. The formula 1 over 60 plus rank is added for each list, and document A has the highest total, so it is first in the fused list.',
      caption: 'Each list contributes 1/(60 + rank) per document; totals decide the fused order. Documents ranked well by both retrievers rise. Numbers are illustrative.',
      height: 214
    });
    box(svg, { x: 12, y: 30, w: 110, label: 'keyword: B, A, C', tone: 'blue', index: 0 });
    box(svg, { x: 12, y: 120, w: 110, label: 'vector: D, A, B', tone: 'teal', index: 1 });
    arrow(svg, { x1: 122, y1: 50, x2: 176, y2: 92, tone: 'blue', index: 2 });
    arrow(svg, { x1: 122, y1: 140, x2: 176, y2: 112, tone: 'teal', index: 2 });
    box(svg, { x: 178, y: 80, w: 130, label: 'sum 1/(60+rank)', tone: 'orange', index: 3, solid: true });
    arrow(svg, { x1: 308, y1: 100, x2: 340, y2: 100, tone: 'orange', index: 4 });
    ['1. A  (.0325)', '2. B  (.0323)', '3. D  (.0164)', '4. C  (.0159)'].forEach((t, k) => svgNode(svg, 'text', { x: 346, y: 70 + k * 22, class: 'dg-small dg-pop', style: '--i:' + (5 + k) }, t));
    return figure;
  };

  builders['human-in-the-loop'] = ({ svgNode, makeFigure, box, arrow }) => {
    const { figure, svg } = makeFigure({
      title: 'Pause before the risky step',
      alt: 'An agent drafts an action and reaches an approval gate. A person approves, edits, or rejects. Approve and edit continue to execution; reject goes to a handled fallback. The state is saved while waiting.',
      caption: 'The gate shows the exact action. Approve or edit resumes execution; rejection is a handled path, not an error. Workflow state is saved while waiting.',
      height: 214
    });
    box(svg, { x: 12, y: 86, w: 90, label: 'draft action', tone: 'blue', index: 0 });
    arrow(svg, { x1: 102, y1: 106, x2: 140, y2: 106, tone: 'blue', index: 1 });
    box(svg, { x: 142, y: 86, w: 100, label: 'approval gate', tone: 'orange', index: 2, solid: true });
    [['approve / edit', 30, 'teal', 'execute'], ['reject', 150, 'blue', 'fallback']].forEach(([lab, y, tone, out], i) => {
      arrow(svg, { x1: 242, y1: 106, x2: 280, y2: y + 20, tone, index: 3 });
      box(svg, { x: 282, y, w: 90, h: 40, label: lab, tone, index: 4 });
      arrow(svg, { x1: 372, y1: y + 20, x2: 398, y2: y + 20, tone, index: 5 });
      box(svg, { x: 400, y, w: 70, h: 40, label: out, tone, index: 6 });
    });
    svgNode(svg, 'text', { x: 192, y: 138, 'text-anchor': 'middle', class: 'dg-small dg-pop', style: '--i:7' }, 'state saved');
    return figure;
  };

  builders['golden-datasets'] = ({ svgNode, makeFigure, box, arrow }) => {
    const { figure, svg } = makeFigure({
      title: 'A regression gate before release',
      alt: 'A change goes through a golden dataset run. Scores are compared to the baseline by slice. If no slice drops below threshold the change ships; otherwise it is blocked.',
      caption: 'Compare each slice with the baseline, not just the overall score. A slice that drops, such as refunds, blocks the release. Numbers are illustrative.',
      height: 214
    });
    box(svg, { x: 12, y: 86, w: 80, label: 'change', tone: 'blue', index: 0 });
    arrow(svg, { x1: 92, y1: 106, x2: 118, y2: 106, tone: 'blue', index: 1 });
    box(svg, { x: 120, y: 86, w: 110, label: 'golden set run', tone: 'teal', index: 2 });
    arrow(svg, { x1: 230, y1: 106, x2: 256, y2: 106, tone: 'teal', index: 3 });
    box(svg, { x: 258, y: 86, w: 100, label: 'vs. baseline', tone: 'orange', index: 4, solid: true });
    arrow(svg, { x1: 358, y1: 96, x2: 386, y2: 52, tone: 'teal', index: 5 });
    arrow(svg, { x1: 358, y1: 116, x2: 386, y2: 160, tone: 'blue', index: 5 });
    box(svg, { x: 388, y: 32, w: 82, h: 40, label: 'ship', tone: 'teal', index: 6 });
    box(svg, { x: 388, y: 140, w: 82, h: 40, label: 'blocked', tone: 'blue', index: 6 });
    svgNode(svg, 'text', { x: 308, y: 190, 'text-anchor': 'middle', class: 'dg-small dg-pop', style: '--i:7' }, 'refunds slice 95% to 80%');
    return figure;
  };

  const h = { svgNode, makeFigure, box, arrow };
  function has(slug) { return Object.prototype.hasOwnProperty.call(builders, slug); }
  function build(slug) { return builders[slug](h); }

  const api = { softmax, arcPath, staggerDelay, has, build, builders };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Diagrams = api;
})(typeof window !== 'undefined' ? window : globalThis);
