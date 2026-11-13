# Animated SVG diagrams for term pages

## Goal
Give key glossary terms infographic-style diagrams (tinted cards, numbered badges, mini-diagrams, flowing arrows, draw-in animation) in place of plain text-box figures.

## Scope
Nine diagrams: RAG, Temperature (upgrade), Attention, Tokenization, Embeddings, Agents, Context Window, KV Cache. Phase 1 pilot is RAG + Temperature; the rest follow.

## Architecture
- `assets/diagrams.js`: one builder per diagram (e.g. `ragFigure()`), plus shared helpers `svgNode()`, `drawArrow()`, `revealOnScroll()`.
- `assets/diagrams.css`: category colors (teal text/tokens, blue retrieval, orange models/cache, purple training/agents) as tokens with dark-theme overrides; card styles; keyframes.
- `index.html`: only a slug -> builder registry. `conceptFigure()` stays as fallback for slugs without a builder. `agents` and `rag` plain figures are replaced; `temperatureFigure()` is upgraded.
- No external libraries. `.github/workflows/pages.yml` must publish the new assets.

## Animation
- Flow: dashed arrows move along their path continuously.
- Draw-in: on scroll into view, strokes draw (`stroke-dashoffset`) and boxes stagger in, once (`IntersectionObserver`).
- Per diagram: RAG dot travels Ask->Docs->LLM->Answer; Temperature bars morph sharp<->flat; Attention arcs draw between tokens; Tokenization word splits; Embeddings points cluster; Agents loop with self-evaluation arrows; Context window slides, oldest tokens drop; KV cache reuses cached tokens as a new one is added.
- `prefers-reduced-motion`: final static state, no motion.

## Accessibility and responsiveness
Each SVG has `role="img"` and a `<title>` stating the fact shown. `viewBox` scaling; wide diagrams re-layout vertically at phone width.

## Scenarios

#### Scenario: Diagram animates on first view
- **GIVEN** a term page with an SVG diagram below the fold
- **WHEN** the figure scrolls into view
- **THEN** strokes draw and boxes stagger in once
- **AND** flowing arrows keep animating

#### Scenario: Reduced motion
- **GIVEN** the visitor prefers reduced motion
- **WHEN** a term page with a diagram loads
- **THEN** the diagram renders in its final static state
- **AND** no flow or draw animation runs

#### Scenario: Term without a builder
- **GIVEN** a term with a plain `diagrams` entry and no SVG builder
- **WHEN** its page renders
- **THEN** the existing text-box figure is shown

#### Scenario: Dark theme
- **GIVEN** the dark theme is active
- **WHEN** a diagram renders
- **THEN** category colors use their dark-theme token values

## Testing
Run `scripts/check-glossary.py`; check each page at desktop and phone width, light/dark, reduced motion. Document scenarios in README.
