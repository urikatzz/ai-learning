# AI Learning — Uri Katz

A single-file, responsive AI glossary with 98 terms and six categories. Includes a searchable A–Z table, category filters, sort direction, light/dark themes, and dedicated hash-based term pages. No build, framework, or server is required.

## Read the glossary

Open `index.html` in a browser. Click any term to open its page. Each explained term has a definition, mechanics, practical example, key distinction, related terms, and source links. The examples are illustrative, not claims about Uri's personal experience. Hash links such as `index.html#term/rag` work locally and on GitHub Pages; browser Back and Forward work too.

91 entries have explanations. JEV, Hermes, Orca, Gool, Herder, Pi, and Omp need a precise reference before a project-specific description can be written. The Karpathy wiki / second brain entry describes the general pattern and notes that its exact project reference needs confirmation.

## GitHub Pages

1. Create a repository named `ai-learning`.
2. Push this project, including `.github/workflows/pages.yml`, to `main`.
3. Under Settings → Pages → Build and deployment, choose **GitHub Actions** as the source.
4. Run **Deploy AI Learning to GitHub Pages** from the Actions tab, or push another change to trigger deployment automatically.

The workflow follows the portfolio's GitHub Pages setup and publishes only `index.html` and `.nojekyll`. No build tools or repository secrets are required.

For the `urikatzz` account, the expected published address is `https://urikatzz.github.io/ai-learning/` after deployment succeeds. Nothing has been published by this package itself.

## Edit content

The `notes` array inside `index.html` contains the term data. Fields include `title`, `slug`, `category`, `what`, `how`, `example`, `watch`, `related`, and `sources`. Source keys resolve to the `sources` dictionary. Use unique slugs, existing titles for related links, and the six existing category keys. Set `pending: true` when the intended reference is ambiguous.

Descriptions were prepared with primary documentation and research sources on 11 November 2026. Sources are linked from the relevant entry. Product capabilities and documentation can change.

Fonts load from Google Fonts when available and fall back to installed fonts. All content, navigation, and styling are contained in the HTML file.
