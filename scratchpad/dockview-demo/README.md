# dockview-demo

Vite dev page hosting the greenfield dock adapter
(`@beep/dock-react`) against a seeded workspace, with
`options.titleMinima` wired to live `@beep/pretext` capture — the visual
smoke target for computable workspace geometry
(`explorations/computable-workspace-geometry`).

## Run

```sh
bunx vite scratchpad/dockview-demo   # http://localhost:5199
```

No install step: `scratchpad` is a bun workspace and `vite` +
`@vitejs/plugin-react` are hoisted at the repo root; `@beep/*` imports
resolve through workspace symlinks to source.

## What to try

- Drag the sash toward the long-titled left group: it stops shrinking at
  the measured sum of its tab titles plus `TabChrome` allowances (16px
  Arial, live canvas capture — the no-truncation floor).
- Tab drag between groups, edge-drop splits, Float / Maximize buttons,
  floating pane header-drag + corner resize, Escape cancels gestures.

## Proofs

```sh
bunx tsgo -p scratchpad/dockview-demo/tsconfig.json --pretty false
(cd scratchpad/dockview-demo && bunx biome check --config-path biome.json .)
```

The page itself is non-gating demo surface; the gating suites live in
`@beep/dock` and `@beep/dock-react` package tests.

## Pages

- `/` — dock adapter with live title-minima clamps.
- `/bubbles.html` — bubble shrinkwrap: `scratchpad/bubbles` `bubbleBox`
  boxes computed from live-captured word advances; the border is the math,
  the text just has to fit (`overflow: hidden` makes any mismatch visible).

Further pages: add another `.html` next to `index.html` (vite treats extra
`.html` files as additional entries) with its own `src/*.tsx`, reuse
`demo.css`.
