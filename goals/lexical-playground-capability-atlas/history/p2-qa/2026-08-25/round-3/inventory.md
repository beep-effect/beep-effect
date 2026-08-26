# QA round 3 — vision judge inventory

- judge: `gpt-5.6-sol` (effort `high`)
- session: `session.json`
- findings: 3 (3 required, 0 polish)

## Required findings

### R3-01 — P1 — Narrow layout compresses the three desktop panes until their body text is clipped

- lens: `overflow`
- repro: Resize to 480x800, open Editor proof, close the canonical JSON drawer, select editor content, and tap Bold; inspect the Explorer, Graph, and Inspector panes in the resulting steady state.
- fix: At the narrow breakpoint, replace the fixed three-column upper dock with a single active pane plus tabs or a drawer, and let pane messages wrap within padded responsive containers.
- evidence:
  - `screenshot` `narrow-viewport-and-touch--after-touch.png` events 691, 716, 718, 719, 720

### R3-02 — P1 — Keyboard focus entering the editor has no visible focus indication

- lens: `focus-ring`
- repro: Select Document proof and press Tab through the import controls and all toolbar commands until focus enters the editor; inspect the frame immediately after focus-in seq 620.
- fix: Add a persistent high-contrast :focus-visible outline or inset ring to the contenteditable root so keyboard users can identify the focused editing surface.
- evidence:
  - `frame` `frames/marker-w0_00050.png` frames 50–50 events 401, 620, 621

### R3-03 — P1 — Focus-driven scrolling leaves the import controls partially exposed beneath sticky toolbar chrome

- lens: `floating-chrome`
- repro: Tab through every Document proof control into the editor; when the final focus event scrolls the panel, observe the two green import buttons reduced to clipped slivers between the tab strip and command toolbar.
- fix: Keep mode and import controls outside the editor scroller, or apply the full sticky-header height as scroll padding and use an opaque toolbar background so underlying controls cannot remain partially visible.
- evidence:
  - `frame` `frames/marker-w0_00050.png` frames 50–50 events 620, 621

## Polish findings

_none_

REQUIRED FINDINGS: 3
