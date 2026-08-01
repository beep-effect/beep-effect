# QA round 4 — vision judge inventory

- judge: `gpt-5.6-sol` (effort `high`)
- session: `session.json`
- findings: 1 (1 required, 0 polish)

## Required findings

### R4-01 — P1 — Pointer cancellation leaves the sash active until pointerup

- lens: `cancel-reset`
- repro: Begin dragging the constrained-layout sash, dispatch pointercancel, then move the pointer before releasing it; the next frame still shows the bright-blue active sash until the later pointerup.
- fix: Route pointercancel through the same synchronous teardown as pointerup: clear the active sash and resize state, release pointer capture, and ignore subsequent moves for the canceled pointer without waiting for pointerup.
- evidence:
  - `frame` `frames/drag-w4_00003.png`
  - `frame` `frames/drag-w4_00004.png` events 62, 63
  - `frame` `frames/drag-w4_00005.png` events 69

## Polish findings

_none_

REQUIRED FINDINGS: 1
