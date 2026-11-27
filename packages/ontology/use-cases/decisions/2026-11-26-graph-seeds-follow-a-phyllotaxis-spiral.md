---
title: Unplaced graph nodes are seeded on a hash-perturbed phyllotaxis spiral
date: 2026-11-26
reversal: Seed unplaced nodes on a fixed-width row and column grid in deterministicPosition.
governs:
  - src/aggregates/Session/Session.visualizer.ts#deterministicPosition
  - src/aggregates/Session/Session.visualizer.ts#deterministicDepth
  - src/aggregates/Session/Session.visualizer.ts#GOLDEN_ANGLE
  - src/aggregates/Session/Session.visualizer.ts#RING_SPACING
enforcedBy: []
---

A node the simulation has not placed starts at radius `RING_SPACING * sqrt(index + 0.5)` and angle `index * GOLDEN_ANGLE`, perturbed by a hash of its IRI so nodes added in the same order do not coincide. Depth follows a second hash-perturbed golden-angle series.
The spiral spreads evenly in two dimensions at any node count and stays deterministic: the same ontology gets the same picture.
Rejected: a 512-column grid. Every ontology under 512 nodes landed on one row, drawn as a horizontal line of overlapping dots, and a collinear start is the one arrangement the force simulation cannot escape, since repulsion between points on a line only pushes them along it.
