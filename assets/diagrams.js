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

  const h = { svgNode, makeFigure, box, arrow };
  function has(slug) { return Object.prototype.hasOwnProperty.call(builders, slug); }
  function build(slug) { return builders[slug](h); }

  const api = { softmax, arcPath, staggerDelay, has, build, builders };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Diagrams = api;
})(typeof window !== 'undefined' ? window : globalThis);
