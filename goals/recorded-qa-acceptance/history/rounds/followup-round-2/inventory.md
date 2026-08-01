# QA round 2 — vision judge inventory

- judge: `gpt-5.6-sol` (effort `high`)
- session: `session.json`
- findings: 2 (2 required, 0 polish)

## Required findings

### R2-01 — P1 — Pointer cancellation leaves the sash in its active drag state

- lens: `cancel-reset`
- repro: Begin dragging the constrained-layout sash, dispatch pointercancel at seq 64, and inspect the next frame before the subsequent pointer move; the sash remains bright blue instead of matching the pre-gesture frame.
- fix: Route pointercancel through the same synchronous drag teardown as pointerup, including releasing pointer capture and clearing the active sash state before the next paint.
- evidence:
  - `frame` `frames/drag-w4_00003.png` events 53, 56
  - `frame` `frames/drag-w4_00004.png` events 64, 65

### R2-02 — P1 — Escape leaves focus on the canceled dragged tab

- lens: `cancel-reset`
- repro: Focus Notes, start dragging Brief toward Outline, press Escape at seq 267, then release; the post-cancel frame retains the focus-visible outline on Brief instead of restoring the pre-gesture Notes focus state.
- fix: Snapshot the focused tab when the drag begins and restore it during Escape teardown after clearing drag and drop-preview state.
- evidence:
  - `frame` `frames/drag-w20_00000.png` events 244, 246, 247
  - `frame` `frames/drag-w20_00002.png` events 251, 267, 268
  - `screenshot` `escape-cancels-tab-drag--after-escape.png` events 267, 268

## Polish findings

_none_

REQUIRED FINDINGS: 2
