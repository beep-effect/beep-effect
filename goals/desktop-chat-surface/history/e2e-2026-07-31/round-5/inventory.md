# QA round 5 — vision judge inventory

- judge: `gpt-5.6-sol` (effort `high`)
- session: `session.json`
- findings: 2 (1 required, 1 polish)

## Required findings

### R5-01 — P1 — Reload briefly paints obsolete branch content before snapping to the restored selection

- lens: `frame-discontinuity`
- repro: Edit the original message to create a branch, wait for the rewritten response, then reload; around the recorded animation start at t=58.228, the first frame shows the obsolete code response and the next frame abruptly replaces it with the restored poem.
- fix: Hydrate the persisted branch and selected-version state before rendering thread content; show a neutral loading state until both selection and history resolve atomically.
- evidence:
  - `frame` `frames/animation-w26_00000.png` frames 0–0 events 199, 200, 201, 202, 203
  - `frame` `frames/animation-w26_00001.png` frames 1–1 events 199, 200, 201, 202, 203

## Polish findings

### R5-02 — P2 — A newly created thread is indistinguishable from the existing empty thread

- lens: `visual-hierarchy`
- repro: Click New thread while the initial empty thread remains in the sidebar; two adjacent rows display the same New thread title and Jul 31 date.
- fix: Give untitled threads an immediate distinguishing label such as an ordinal or creation time, and strengthen the active-row treatment.
- evidence:
  - `frame` `frames/click-w3_00002.png` frames 2–2 events 32, 34

REQUIRED FINDINGS: 1
