# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-11-03

Operator: "Create a new exploration packet to investigate
https://textjs.org/llms.txt — very interesting to me & I would like to think
about its potential usecases although I'm not sure what that looks like."

Snapshot of the index file as fetched today:
[`assets/textjs-llms-2026-11-03.txt`](./assets/textjs-llms-2026-11-03.txt).

What it is, in the project's own words: "Text.js is a React framework for apps
that render in the DevTools console with console.log." React 19, Yoga layout,
a cell grid, run-length-encoded `%c` spans, one `console.log` per changed
frame. Source: https://github.com/anomalyco/textjs (MIT, "Copyright (c) 2026
Anomaly"; docs content lives at `apps/web/src/docs/content/*.md`).

Pages that caught the eye on first read (links only, no digest yet):

- https://textjs.org/docs/mcp — `text mcp` runs the `app/` directory headless
  and serves it over MCP: `list_routes`, `navigate`, `read_frame`, press keys,
  call route handlers. Coding agents drive the UI without DevTools.
- https://textjs.org/docs/testing — `@textjs/app/testing`: `render`, `press`,
  `type`, `lastFrame()`, `cell(x, y)`, `locate(text)`, `waitForText`. Works
  under Bun, Vitest and Jest. No browser.
- https://textjs.org/docs/terminal — `text run` and `renderToTerminal` render
  the same App Router app in a terminal with truecolor ANSI; row-diffed frames,
  synchronized-output markers.
- https://textjs.org/docs/turbolog-engine — the engine: React → Yoga →
  CellBuffer → row-hash gate → RLE → `console.log`. Frames paced ~15fps, idle
  writes nothing.
- https://textjs.org/docs/opencode — OpenCode Lite TUI built on Text.js.
- https://textjs.org/docs/server-rendering — `runtime = "server"` routes
  streamed as frames; prerendered console shells.
- https://textjs.org/docs/devtools-extension and
  https://textjs.org/docs/vscode — panel next to Console, live preview beside
  code.

Loose threads, unsorted:

- The "frame as plain text" idea cuts both ways: an agent can read a frame,
  and a test can assert on one. Same surface as a terminal. Three render
  targets (DevTools console, terminal, offscreen) from one component tree.
- Error code catalog TX001..TX031 with a stable page per code.
- Needs Bun for `text run` / `text mcp` (TX019).
- Where would a console-rendered UI even live in this repo? Dev-time
  dashboards? Agent-facing status surfaces? Unknown. That is the point of the
  packet.
