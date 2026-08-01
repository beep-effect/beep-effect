# QA round 4 — vision judge inventory

- judge: `gpt-5.6-sol` (effort `high`)
- session: `session.json`
- findings: 1 (1 required, 0 polish)

## Required findings

### R4-01 — P1 — Reload briefly paints the obsolete branch before snapping to the restored selection

- lens: `frame-discontinuity`
- repro: Select the rewritten haiku branch, reload the page, and watch the first app-animation frames: the original Schema-First Codebase branch appears for one frame before the restored haiku branch replaces it.
- fix: Hydrate the persisted selected branch before rendering thread content; keep a neutral loading state until branch selection and message history are resolved so stale default-branch content never reaches first paint.
- evidence:
  - `frame` `frames/animation-w25_00000.png` frames 0–0 events 141, 142, 143, 144, 145
  - `frame` `frames/animation-w25_00001.png` frames 1–1 events 141, 142, 143, 144, 145

## Polish findings

_none_

REQUIRED FINDINGS: 1
