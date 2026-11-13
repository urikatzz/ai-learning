# AI Learning — Uri Katz

A single-file, responsive AI glossary with 113 terms and six categories. Includes a searchable A–Z table, category filters, sort direction, light/dark themes, and dedicated hash-based term pages. No build, framework, or server is required.

## Read the glossary

Open `index.html` in a browser. Click any term to open its page. Each explained term has a short index definition, a deeper introduction, mechanics, a worked example, common pitfalls, related terms, and source links. Five guided learning paths cover foundations, retrieval, agents, model adaptation/serving, and production AI engineering. Twenty-one responsive diagrams and fifteen expandable self-checks reinforce the core concepts. Search includes the full explanations and related-term names. The examples are illustrative, not claims about Uri's personal experience. Hash links such as `index.html#term/rag` work locally and on GitHub Pages; browser Back and Forward work too.

All 113 entries have explanations. JEV, Hermes, Orca, Herdr, Pi, Omp, and Karpathy’s LLM Wiki are identified using their official references. Gool was removed. Herdr retains the original `#term/herder` route so existing bookmarks continue to work.

## GitHub Pages

1. Create a repository named `ai-learning`.
2. Push this project, including `.github/workflows/pages.yml`, to `main`.
3. Under Settings → Pages → Build and deployment, choose **GitHub Actions** as the source.
4. Run **Deploy AI Learning to GitHub Pages** from the Actions tab, or push another change to trigger deployment automatically.

The workflow follows the portfolio's GitHub Pages setup and publishes only `index.html` and `.nojekyll`. No build tools or repository secrets are required.

For the `urikatzz` account, the expected published address is `https://urikatzz.github.io/ai-learning/` after deployment succeeds. Nothing has been published by this package itself.

The new foundations and production entries include explicit “When it matters” guidance and “How to measure it” examples within their mechanics and practical-example sections.

## Edit content

The `notes` array inside `index.html` contains the term data. Fields include `title`, `slug`, `category`, `what` (short summary), `detail` (deeper introduction), `how`, `example`, `watch`, `related`, and `sources`. Backtick-delimited text in article paragraphs renders as inline code; content is inserted as text, not HTML. Source keys resolve to the `sources` dictionary. Use unique slugs, existing titles for related links, and the six existing category keys. Set `pending: true` when the intended reference is ambiguous.

Descriptions were reviewed and expanded on 11 November 2026, with additional entries added through 12 November 2026. The 127 learning-resource links include official documentation, practical tutorials, original papers, and creator-authored visual lessons and video courses. Resources are linked from the relevant entry. Product capabilities and documentation can change. The Karpathy wiki entry links to his original LLM Wiki proposal; his video course remains a separate learning resource.

Fonts load from Google Fonts when available and fall back to installed fonts. All content, navigation, and styling are contained in the HTML file.

## Diagrams and learning paths

The `diagrams` dictionary contains accessible HTML figures with explanatory captions. Mark independent branches or alternatives with `parallel: true`; sequential diagrams use ordered steps and arrows. The temperature illustration is an inline SVG with an accessible text description. These figures work offline and adapt to light/dark themes and narrow screens.

The `learningPaths` array lists ordered term slugs. The `studyQuestions` dictionary maps slugs to a question and an answer, rendered with native expandable details. Keep all references synchronized when renaming terms.

## Validate changes

Run `python3 scripts/check-glossary.py` to check unique identifiers, required content, related terms, source references, learning paths, and JavaScript syntax. This requires Python 3 and Node.js; there are no package dependencies.

Run `python3 scripts/check-glossary.py --links --report /tmp/ai-learning-links.json` to also check all learning-resource URLs using curl. The report records status, redirect destination, and page title. HTTP success establishes reachability, not factual accuracy or future availability; inspect page content for relevance and soft error pages.

For visual checks, serve with `python3 -m http.server 8765 --bind 127.0.0.1`, then open `http://127.0.0.1:8765`. Check learning-path links, search, filters, term sections, self-checks, Back/Forward navigation, both themes, and narrow-screen diagrams.

## Animated diagrams

Term pages for RAG, temperature, transformers (attention), tokenization, embedding models, agents, context, KV cache, quantization, LoRA, mixture of experts, prompt injection, hallucinations, RAG vs GraphRAG, reranking, vector databases, tool calling, chunking, and hybrid retrieval render animated SVG diagrams from `assets/diagrams.js`, styled by `assets/diagrams.css`. Other terms keep the plain figure from the `diagrams` data in `index.html`.

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

## Index screen motion

Motion lives in `assets/ai-laptop.svg` (hero, CSS inside the SVG), `assets/motion.css` (topic icons, path cards) and `revealOnView` in `index.html`.

#### Scenario: Hero float and glow

- **GIVEN** the home screen is open
- **WHEN** the hero image loads
- **THEN** the laptop floats gently up and down and the brain glow pulses
- **AND** a few small purple dots drift toward the brain

#### Scenario: Topic icon animation

- **GIVEN** the Popular Topics cards are shown
- **WHEN** a card scrolls into view once, or is hovered or keyboard-focused
- **THEN** its icon animates: chip pins blink, ML bars grow, network nodes pulse in sequence, or the line draws itself
- **AND** the icon looks identical at rest

#### Scenario: Learning path cards stagger in

- **GIVEN** JavaScript has set `js-motion` on the page
- **WHEN** path cards scroll into view
- **THEN** each fades and slides in, delayed 80ms per card index
- **AND** without IntersectionObserver the cards are shown immediately, and without JavaScript they are never hidden

#### Scenario: Reduced motion

- **GIVEN** the visitor prefers reduced motion
- **WHEN** the home screen renders
- **THEN** the hero, icons and cards are fully visible and static
