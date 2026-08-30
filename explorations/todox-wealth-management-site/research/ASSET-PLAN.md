# Asset plan — Terminal of Record build

Decompose deliverable, 2026-08-27. Every asset the implementation goal needs,
each one original or explicitly licensed. Nothing from the reference corpus
(`VISUAL-INSPIRATION.md` captures, screenshots, fonts, photography,
compositions) enters production; that corpus is observation only.

## Typefaces

Requirements from the shape brief: a terminal monospace with true tabular
figures and CRT-era character for screen passages; an ink register for
fanfold printout passages; open licenses recorded before ship; none of the
Impeccable calibration-banned defaults (Space Mono, IBM Plex, Inter-as-display,
and the rest of that list) without a reason no other face satisfies.

| Role | Candidates to evaluate at build | License to verify |
| --- | --- | --- |
| Terminal screen face | Martian Mono, Commit Mono, Fragment Mono, Server Mono | OFL for each; confirm tabular figures and box-drawing coverage |
| Printout body face | Courier Prime, Nimbus Mono PS, same terminal face in ink | OFL / UFL; test at 14–16px reading sizes |
| Dot-matrix display (printout headers, wordmark variant) | Workbench, Sixtyfour, Silkscreen, or an authored SVG dot-matrix lettering | OFL, or original SVG (no license needed) |

Rules: at most two families plus the optional dot-matrix display register;
final choice happens in the build against rendered specimens; the chosen
faces and licenses get recorded in the build's DESIGN.md sidecar. Google
Fonts hosting is acceptable for OFL faces; self-hosting preferred if Next.js
font optimization makes it trivial.

## Authored graphics (all original, SVG/CSS, no stock)

| Asset | Form | Notes |
| --- | --- | --- |
| TODOX wordmark, screen variant | SVG, terminal-set caps | original lettering in the chosen mono, not a licensed logo |
| TODOX wordmark, printout variant | SVG dot-matrix | prints as if from the fanfold printer |
| Favicon | SVG/ICO, amber block glyph on near-black | keep legible at 16px |
| Fanfold sprocket strips + paper edge | CSS/SVG pattern | repeats cleanly; prints the printout passages' frame |
| Green-bar stripes | CSS background | tabular printout sections only |
| CRT ground treatment | CSS (vignette, faint scanline) | restraint rule: light only where there is data; no bloom, no glass; fully disabled under reduced motion where animated |
| Function-key caps (F2/F9) | CSS component | real buttons, not images |
| Record/state chrome (rules, cursors, chain lines) | CSS/SVG | measured-grid discipline |
| OG/social card | Raster produced at build from the built first viewport | authored render, provenance embedded per the Impeccable `embed-prompt.mjs` discipline |

## Explicitly excluded

- Stock or scraped photography, illustration, faces, offices, lifestyle
  imagery of any kind (the world needs none).
- Third-party logos, wordmarks, screenshots, or trade dress, including every
  reference-site capture.
- Proprietary fonts observed in references (Avenir, Sentinel, agileSans,
  Aeonik, Noe Display, Europa, Season, and any other captured face).
- Charts, waveforms, or performance-shaped graphics (claim hazard; also a
  binding raise).
- Any asset implying certification, award, press, or customer proof.

## Provenance discipline

Every raster that ships carries embedded provenance (generation prompt or
origin) per the Impeccable finish rules; SVG and CSS assets carry a source
comment naming this plan. License receipts for typefaces land in the goal
packet before publication.
