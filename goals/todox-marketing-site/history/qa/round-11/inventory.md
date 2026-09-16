# QA round 11 — vision judge inventory

- judge: `claude-fable-5-1` (effort `medium`)
- session: `session.json`
- findings: 1 (0 required, 1 polish)

## Required findings

_none_

## Polish findings

### R11-01 — P2 — Two cursor marks show at once while a row other than the resting row holds keyboard focus

- lens: `focus-ring`
- repro: Focus the first review row, press ArrowDown three times at ~600 ms; while TSK 0202 shows the inverse-video focus cursor, CLM 0101 still shows its resting cursor glyph.
- fix: Suppress the resting cursor while the row set has focus-within on another row (.rowsets:focus-within .row[data-cursor]:not(:focus-visible) .row__no::after { content: none }).
- evidence:
  - `frame` `frames/animation-w9_00004.png` frames 4–4 events 118, 122, 127

REQUIRED FINDINGS: 0
