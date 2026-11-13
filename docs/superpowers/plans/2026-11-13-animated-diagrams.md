# Animated SVG Diagrams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace plain text-box figures on key term pages with infographic-style animated SVG diagrams.

**Architecture:** `assets/diagrams.js` (classic script, exposes `window.Diagrams`) holds pure helpers plus one builder per diagram. `assets/diagrams.css` holds tones, card styling and keyframes. `index.html` only links both files and asks `Diagrams.has(slug)` / `Diagrams.build(slug)`; the old `conceptFigure()` remains the fallback.

**Tech Stack:** Vanilla JS, inline SVG, CSS keyframes, `IntersectionObserver`. Tests: `node --test` for pure helpers; browser check for rendering.

**Spec:** `docs/superpowers/specs/2026-11-13-animated-diagrams-design.md`

**Spec adjustments (deliberate):**
- Temperature shows two panels (low and high T) that grow in, instead of one set of bars morphing. The reduced-motion static state then shows both cases.
- Wide diagrams use one `viewBox` 480 units wide with 15+ unit text, instead of a separate vertical layout at phone width.
- There is no `attention` term. The attention diagram attaches to `transformers`. The context window diagram attaches to `context`, and embeddings to `embedding-models`.

## File Structure

- Create `assets/diagrams.css`: tone tokens (light/dark), `.dg-*` classes, keyframes, reduced-motion.
- Create `assets/diagrams.js`: helpers (`softmax`, `arcPath`, `staggerDelay`, `svgNode`, `makeFigure`, `box`, `arrow`) and builders.
- Create `tests/diagrams.test.js`: unit tests for pure helpers.
- Modify `index.html`: link CSS (line 34), script tag (before line 54), `termPage` (~line 3313), delete `temperatureFigure()`.
- Modify `README.md`: scenario specs.
- `.github/workflows/pages.yml` needs no change: it already runs `cp -R assets dist/`.

---

### Task 1: Pure helpers with tests

**Files:**
- Create: `tests/diagrams.test.js`
- Create: `assets/diagrams.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/diagrams.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { softmax, arcPath, staggerDelay } = require('../assets/diagrams.js');

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/`
Expected: FAIL, `Cannot find module '../assets/diagrams.js'`

- [ ] **Step 3: Write minimal implementation**

```js
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

  const api = { softmax, arcPath, staggerDelay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Diagrams = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add tests/diagrams.test.js assets/diagrams.js
git commit -m "Add diagram helper functions with tests

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Shared CSS (tones, cards, animations)

**Files:**
- Create: `assets/diagrams.css`

- [ ] **Step 1: Write the stylesheet**

```css
/* Animated diagrams: tones, card look, motion. Static final state is the default
   for reduced motion; animations only run inside .dg-in (set by revealOnScroll). */
:root{--dg-teal:#0f8b8d;--dg-blue:#2f6fd0;--dg-orange:#d9701f;--dg-purple:#7c4ddb}
body.dark{--dg-teal:#4fd1c5;--dg-blue:#6ea8ff;--dg-orange:#ffa15c;--dg-purple:#b18cff}

.dg-figure{overflow:hidden}
.dg-figure svg{max-width:640px;margin:auto}
.dg-figure text{font-family:'DM Sans',sans-serif;font-size:15px;fill:var(--ink)}
.dg-figure .dg-small{font-size:13px;fill:var(--muted)}

.dg-teal{--tone:var(--dg-teal)}.dg-blue{--tone:var(--dg-blue)}
.dg-orange{--tone:var(--dg-orange)}.dg-purple{--tone:var(--dg-purple)}
.dg-box rect{fill:color-mix(in srgb,var(--tone) 14%,var(--paper));stroke:var(--tone);stroke-width:2}
.dg-box.dg-solid rect{fill:var(--tone)}
.dg-box.dg-solid text{fill:#fff;font-weight:700}
.dg-box text{font-weight:600}
.dg-stroke{fill:none;stroke:var(--tone,var(--muted));stroke-width:2;stroke-linecap:round}
.dg-dash{stroke-dasharray:5 5;fill:none;stroke:var(--tone,var(--muted));stroke-width:1.6}
.dg-dot{fill:var(--tone,var(--accent))}
.dg-fill{fill:var(--tone)}
.dg-old{opacity:.35}

/* Entrance: hidden until the figure scrolls into view */
.dg-pop{opacity:0;transform:translateY(8px)}
.dg-draw{stroke-dasharray:1;stroke-dashoffset:1}
.dg-grow{transform-box:fill-box;transform-origin:bottom;transform:scaleY(0)}
.dg-in .dg-pop{animation:dg-pop .5s ease-out forwards;animation-delay:calc(var(--i,0)*.12s)}
.dg-in .dg-draw{animation:dg-draw .9s ease-out forwards;animation-delay:calc(var(--i,0)*.12s)}
.dg-in .dg-grow{animation:dg-grow .8s cubic-bezier(.2,.8,.2,1) forwards;animation-delay:calc(var(--i,0)*.12s)}

/* Continuous motion */
.dg-flow{stroke-dasharray:6 6}
.dg-in .dg-flow{animation:dg-flow 1s linear infinite}
.dg-travel{offset-rotate:0deg;offset-distance:100%}
.dg-in .dg-travel{animation:dg-travel 3.2s ease-in-out infinite}
.dg-slide{}
.dg-in .dg-slide{animation:dg-slide 4s ease-in-out infinite}
.dg-in .dg-drop{animation:dg-drop 4s ease-in-out infinite}
.dg-in .dg-add{animation:dg-add 4s ease-in-out infinite}
.dg-drift{}
.dg-in .dg-drift{animation:dg-drift 1.4s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i,0)*.1s)}

@keyframes dg-pop{to{opacity:1;transform:none}}
@keyframes dg-draw{to{stroke-dashoffset:0}}
@keyframes dg-grow{to{transform:scaleY(1)}}
@keyframes dg-flow{to{stroke-dashoffset:-12}}
@keyframes dg-travel{0%{offset-distance:0%}85%,100%{offset-distance:100%}}
@keyframes dg-slide{0%,35%{transform:translateX(0)}55%,100%{transform:translateX(36px)}}
@keyframes dg-drop{0%,35%{opacity:1}55%,100%{opacity:.35}}
@keyframes dg-add{0%,35%{opacity:.35}55%,100%{opacity:1}}
@keyframes dg-drift{from{transform:translate(var(--dx),var(--dy))}to{transform:none}}

@media(prefers-reduced-motion:reduce){
  .dg-pop,.dg-draw,.dg-grow,.dg-flow,.dg-travel,.dg-slide,.dg-drop,.dg-add,.dg-drift{animation:none!important}
  .dg-pop{opacity:1;transform:none}
  .dg-draw{stroke-dashoffset:0}
  .dg-grow{transform:none}
  .dg-drop{opacity:.35}
}
```

- [ ] **Step 2: Commit**

```bash
git add assets/diagrams.css
git commit -m "Add diagram stylesheet with tones and animations

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: DOM helpers, registry, and index.html wiring

**Files:**
- Modify: `assets/diagrams.js`
- Modify: `index.html` (line 34, before line 54, `termPage`, delete `temperatureFigure`)

- [ ] **Step 1: Add DOM helpers and registry to `assets/diagrams.js`**

Replace the line `const api = { softmax, arcPath, staggerDelay };` with the block below. (Builders are added to `builders` in Tasks 4–6.)

```js
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
```

- [ ] **Step 2: Wire `index.html`**

Edit line 34, after the theme link:

```html
<link rel="stylesheet" href="assets/theme.css">
<link rel="stylesheet" href="assets/diagrams.css">
```

Add before the inline `<script>` that starts at line 54:

```html
<script src="assets/diagrams.js"></script>
```

In `termPage` replace these two lines

```js
  if(diagrams[note.slug])article.querySelector('#mechanics').append(conceptFigure(diagrams[note.slug]));
  if(note.slug==='temperature')article.querySelector('#mechanics').append(temperatureFigure());
```

with

```js
  if(Diagrams.has(note.slug))article.querySelector('#mechanics').append(Diagrams.build(note.slug));
  else if(diagrams[note.slug])article.querySelector('#mechanics').append(conceptFigure(diagrams[note.slug]));
```

Delete the whole `function temperatureFigure(){ ... }` (from `function temperatureFigure(){` to the `}` just before `function renderLearningPaths(){`). It is replaced in Task 4.

- [ ] **Step 3: Verify nothing broke**

Run: `node --test tests/ && python3 scripts/check-glossary.py`
Expected: tests pass; the checker prints its usual success output. Then open `index.html` in a browser, open `#term/temperature`, and confirm the page renders with no figure and no console errors (temperature builder arrives in Task 4).

- [ ] **Step 4: Commit**

```bash
git add assets/diagrams.js index.html
git commit -m "Wire diagram registry into term pages

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Pilot — RAG and Temperature

**Files:**
- Modify: `assets/diagrams.js` (add to `builders` before the `// --- Registry ---` comment is closed, i.e. after `const builders = {};`)

- [ ] **Step 1: Add the RAG builder**

```js
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
```

- [ ] **Step 2: Add the Temperature builder**

```js
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
```

Note: `softmax` is in scope because builders live in the same IIFE.

- [ ] **Step 3: Visual verification (browser)**

Open `index.html#term/rag` and `#term/temperature`. Confirm:
- Cards fade in staggered when scrolled into view; arrows keep flowing; the orange dot loops along the RAG pipeline.
- Temperature bars grow up; the left panel has one tall bar, the right panel four similar bars.
- Toggle dark mode (theme button): colors stay legible.
- DevTools → Rendering → "Emulate prefers-reduced-motion: reduce" and reload: everything is visible and static.
- Resize to ~375px: text stays readable, no horizontal scroll.
- Console: no errors.

- [ ] **Step 4: Commit**

```bash
git add assets/diagrams.js
git commit -m "Add animated RAG and temperature diagrams

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

**Checkpoint: stop here and show the user the pilot before continuing.**

---

### Task 5: Language-model concepts — Tokenization, Attention, Embeddings

**Files:**
- Modify: `assets/diagrams.js` (add after the temperature builder)

- [ ] **Step 1: Tokenization**

```js
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
```

- [ ] **Step 2: Attention (attached to `transformers`)**

```js
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
```

- [ ] **Step 3: Embeddings (attached to `embedding-models`)**

```js
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
```

- [ ] **Step 4: Visual verification**

Open `#term/tokenization`, `#term/transformers`, `#term/embedding-models`. Confirm tokens pop in left to right, attention arcs draw from "its" with different thickness, embedding points drift into their clusters, then dashed rings appear. Check dark mode, reduced motion, 375px width.

- [ ] **Step 5: Commit**

```bash
git add assets/diagrams.js
git commit -m "Add tokenization, attention and embedding diagrams

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Agents, Context window, KV cache

**Files:**
- Modify: `assets/diagrams.js` (add after the embeddings builder)

- [ ] **Step 1: Agents**

```js
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
```

- [ ] **Step 2: Context window (attached to `context`)**

```js
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
```

- [ ] **Step 3: KV cache**

```js
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
```

Note: the lifted path in `kv-cache` uses a negative lift so the curve dips below the row (`y - lift` = 148); it draws from the new token back toward the cache.

- [ ] **Step 4: Visual verification**

Open `#term/agents`, `#term/context`, `#term/kv-cache`. Confirm: the agents dot loops around the cycle; the context window outline slides one cell while the oldest cell dims and the newest brightens; the KV cache reuse arrow flows and the append curve draws. Check dark mode, reduced motion, 375px width, console clean.

- [ ] **Step 5: Commit**

```bash
git add assets/diagrams.js
git commit -m "Add agents, context window and KV cache diagrams

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Docs, full verification, and cleanup

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append scenario specs to `README.md`**

```markdown
## Animated diagrams

Term pages for RAG, temperature, transformers (attention), tokenization, embedding models, agents, context, and KV cache render animated SVG diagrams from `assets/diagrams.js`, styled by `assets/diagrams.css`. Other terms keep the plain figure from the `diagrams` data in `index.html`.

#### Scenario: Diagram animates on first view

- **GIVEN** a term page with an SVG diagram below the fold
- **WHEN** the figure scrolls into view
- **THEN** strokes draw and boxes stagger in once
- **AND** flowing arrows keep animating

#### Scenario: Reduced motion

- **GIVEN** the visitor prefers reduced motion
- **WHEN** a term page with a diagram loads
- **THEN** the diagram renders in its final static state
- **AND** no flow, draw, or slide animation runs

#### Scenario: Term without a builder

- **GIVEN** a term with a plain `diagrams` entry and no SVG builder
- **WHEN** its page renders
- **THEN** the existing text-box figure is shown

#### Scenario: Dark theme

- **GIVEN** the dark theme is active
- **WHEN** a diagram renders
- **THEN** category colors use their dark-theme token values
```

- [ ] **Step 2: Full verification**

Run: `node --test tests/ && python3 scripts/check-glossary.py`
Expected: all tests pass; checker succeeds.

Then in the browser, visit all eight pages (`rag`, `temperature`, `transformers`, `tokenization`, `embedding-models`, `agents`, `context`, `kv-cache`) plus one page that keeps the plain figure (e.g. `chunking`). For each: desktop and 375px, light and dark, reduced motion, console clean.

- [ ] **Step 3: Confirm the Pages build includes assets**

Run: `mkdir -p /tmp/dg-check && cp index.html .nojekyll /tmp/dg-check/ && cp -R assets /tmp/dg-check/ && ls /tmp/dg-check/assets`
Expected: lists `diagrams.css`, `diagrams.js`, `theme.css`, `ai-laptop.svg`. Then `rm -rf /tmp/dg-check`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "Document animated diagram scenarios

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-review

- **Spec coverage:** architecture (Tasks 1–3), look and tones (Task 2), animations per diagram (Tasks 4–6), reduced motion (Task 2 + `revealOnScroll`), accessibility titles (`makeFigure`), fallback (Task 3), scenarios (Task 7), Pages publish (Task 7 step 3). Deviations are listed at the top.
- **Placeholders:** none.
- **Name consistency:** `makeFigure`, `box`, `arrow`, `svgNode`, `arcPath`, `softmax` and `Diagrams.has/build` are used the same way in every task. Builders receive `h = { svgNode, makeFigure, box, arrow }`; `arcPath` and `softmax` are IIFE-scoped.
- **Known risk to check in Task 4:** `color-mix()` and CSS `offset-path` need a current browser; both are supported in all evergreen browsers.
