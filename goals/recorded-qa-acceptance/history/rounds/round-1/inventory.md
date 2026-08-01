# QA round 1 — vision judge inventory

- judge: `gpt-5.6-sol` (effort `high`)
- session: `session.json`
- findings: 3 (2 required, 1 polish)

## Required findings

### R1-01 — P1 — Floating resize grip translates the pane without resizing it

- lens: `floating-chrome`
- repro: Drag the Scratch floating header from (314,143) to (574,323), then perform the recorded floating-grip-resize drag from (421,327) to (555,416). The pane moves down and right while remaining 320x252.
- fix: Bind the resize interaction to the actual lower-right grip and apply pointer deltas to width and height while preserving the pane origin; keep the header grip bound only to translation.
- evidence:
  - `frame` `frames/drag-w11_00003.png` events 116, 118
  - `frame` `frames/drag-w11_00005.png` events 118, 130
  - `screenshot` `floating-drag-resize--after-move.png` events 115, 116
  - `screenshot` `floating-drag-resize--after-resize.png` events 118, 130

### R1-02 — P1 — Escape cancellation leaves the dragged Brief tab activated

- lens: `cancel-reset`
- repro: With Notes active, begin dragging the inactive Brief tab toward the Outline group, press Escape at seq 251 before pointer-up, then release. Brief remains active instead of restoring the pre-gesture Notes state.
- fix: Snapshot the active panel when tab dragging starts and restore it on Escape cancellation together with the original layout and cleared drop-preview state.
- evidence:
  - `frame` `frames/drag-w18_00000.png` events 237
  - `frame` `frames/drag-w18_00002.png` events 251, 253
  - `screenshot` `escape-cancels-tab-drag--after-escape.png` events 251, 253

## Polish findings

### R1-03 — P2 — Drag label is clipped at the right and bottom viewport edges

- lens: `overflow`
- repro: Drag the source into the target's right or bottom quadrant until the witness cursor reaches the viewport edge. The pointer-adjacent Drag Source label extends beyond the viewport and becomes partially or entirely hidden.
- fix: Clamp the drag-label overlay to the viewport and flip its horizontal or vertical offset to the opposite side of the pointer when the preferred placement would overflow.
- evidence:
  - `screenshot` `drop-quadrant-hover--preview-right.png` events 163, 167, 181, 183
  - `screenshot` `drop-quadrant-hover--preview-bottom.png` events 209, 213, 227, 229

REQUIRED FINDINGS: 2
