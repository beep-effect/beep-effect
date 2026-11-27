---
title: The light-to-dark ink order is checked again on drawn ink after a whole-chord band
date: 2026-11-26
reversal: Skip settleRedrawnInk in drawView and keep the tapers settled on planned ink.
governs:
  - src/internal/kernel.ts#settleRedrawnInk
  - src/internal/kernel.ts#litFloorOf
  - src/internal/kernel.ts#drawView
enforcedBy: []
---

A band drawn on whole chords and cut back to its taper can still carry more ink than the darker face beside it, since the tapers were settled on planned ink.
Drawn ink is compared across shared visible edges and between faces of one seen area a tone step apart (`inkTwins`). A face whose such band out-inks a darker neighbour has it stepped to the lit floor (the two lines nearest its shadow edge at 0.6 and 0.4, `gradedExtents` with no full-length line), and, when it still out-inks, left bare.
A band left bare this way is bare by design (an `ink-order` skip, never lost) and its face still counts as shaded.
Rejected: trusting the planned-ink tapers, which lets a lit face out-ink its darker neighbour on the sheet.
