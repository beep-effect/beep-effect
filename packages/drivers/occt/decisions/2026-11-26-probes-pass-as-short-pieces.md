---
title: Probes and room columns enter the hidden-line pass as chains of short pieces
date: 2026-11-26
reversal: Make chopped return the edge as one piece, then re-run the graded shading tests.
governs:
  - src/internal/shading.ts#PROBE_PIECE_PITCHES
  - src/internal/shading.ts#chopped
  - src/internal/kernel.ts#regionsOf
  - src/internal/kernel.ts#joinedIntervals
enforcedBy: []
---

A probe or room column is cut into pieces of at most `PROBE_PIECE_PITCHES` minimum pitches, made one compound, and the kernel joins the visible pieces that touch (within `PIECE_BOUNDARY_GAP`).
Reason: OCCT's hidden-line pass misreads a long chord that starts inside a part standing on the face (a wall behind a fin) along its whole length, while it reads each short piece on its own.
Rejected: one edge per chord, which reports whole stretches visible or hidden wrongly.
