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
  const h = { svgNode, makeFigure, box, arrow };
  function has(slug) { return Object.prototype.hasOwnProperty.call(builders, slug); }
  function build(slug) { return builders[slug](h); }

  const api = { softmax, arcPath, staggerDelay, has, build, builders };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Diagrams = api;
})(typeof window !== 'undefined' ? window : globalThis);
