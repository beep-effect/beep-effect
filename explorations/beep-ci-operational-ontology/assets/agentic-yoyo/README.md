# The Agentic Yoyo, illustrated

Source for the illustrated page that carries the X article `THE_AGENTIC_YOYO.md`
(repo root) under its animation. The article file is the single source of truth
for the prose; this directory holds the page shell, the real data the animation
runs on, and the build that joins them.

| File | Role |
| --- | --- |
| `shell.html` | Page template: tokens, slim sticky header, scroll-away hero stage, the fixed peek overlay a "show me" opens (closes itself after about half a viewport of scrolling, or on hide), animation, legend, beat links, receipts markup. |
| `build.mjs` | Node, stdlib only. Renders the article markdown into the shell and injects the data. |
| `subdag.json` | The real fan of commit `8733d894e0`: 26 packages, 123 `dependsOn` edges. |
| `files.json` | The 46 distinct basenames of the 48 paths that commit edited (the edit beads). |
| `lanes.json` | The real yeet planner steps (the check chips) and the S7 replay census. |

Rebuild (any output path; the page is published as an Artifact, never served from the repo):

```sh
node explorations/beep-ci-operational-ontology/assets/agentic-yoyo/build.mjs --out /path/to/agentic-yoyo.html
```

Add `--artifact-url <url>` once the page is shared; it fills the commented Sources
line in the rendered page without touching the article file.

Add `--standalone` to wrap the output in a doctype/html/head/body skeleton for viewing
the file locally (the Artifact host adds that skeleton itself; without it a raw file
opens in quirks mode and the sticky stage collapses). `dist/` is gitignored, so
`--out dist/agentic-yoyo.html` beside this README is a safe local preview target.
