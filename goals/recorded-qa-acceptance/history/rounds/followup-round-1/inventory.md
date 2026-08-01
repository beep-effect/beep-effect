# QA round 1 — vision judge inventory

- judge: `gpt-5.6-sol` (effort `high`)
- session: `session.json`
- findings: 3 (2 required, 1 polish)

## Required findings

### R1-01 — P1 — Floating resize grip moves the pane without resizing it

- lens: `floating-chrome`
- repro: Drag the floating pane by its header, then press its bottom-right resize grip and move diagonally 140 px right and 100 px down.
- fix: Stop propagation from the resize handle and route its pointerdown into dedicated resize state that anchors the pane origin and updates width and height from pointer deltas, with pointer-up and pointer-cancel cleanup.
- evidence:
  - `frame` `frames/drag-w11_00003.png` events 120
  - `frame` `frames/drag-w11_00005.png` events 123, 135
  - `screenshot` `floating-drag-resize--after-resize.png` events 123, 135

### R1-02 — P1 — Bottom drop preview spans both panels instead of the target group

- lens: `drop-preview`
- repro: Drag the Drag Source tab to the bottom edge of Drop Target and pause before releasing or pressing Escape.
- fix: Resolve the deepest hovered target group and calculate the bottom indicator relative to that group's bounds instead of the dock root.
- evidence:
  - `frame` `frames/drag-w14_00010.png` events 225, 237
  - `screenshot` `drop-quadrant-hover--preview-bottom.png` events 221, 225, 237

## Polish findings

### R1-03 — P2 — Drag label clips outside the viewport at right and bottom drop zones

- lens: `overflow`
- repro: Drag Drag Source to within 12 px of Drop Target's right edge, then repeat at its bottom edge.
- fix: Make the drag ghost viewport-aware by flipping its offset left or upward near an edge and clamping its final bounds to the visual viewport.
- evidence:
  - `screenshot` `drop-quadrant-hover--preview-right.png` events 173, 177, 190
  - `screenshot` `drop-quadrant-hover--preview-bottom.png` events 221, 225, 237

REQUIRED FINDINGS: 2
