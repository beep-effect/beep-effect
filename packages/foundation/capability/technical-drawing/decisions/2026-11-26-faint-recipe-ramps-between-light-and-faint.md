---
title: The graded band ramps from the light recipe to the faint one between exposures 0.6 and 0.7
date: 2026-11-26
reversal: Make faintShareOf a step at a single exposure (0.6), so a face switches from the light recipe to the faint one at once.
governs:
  - src/Shading.rules.ts#faintShareOf
enforcedBy: []
---

faintShareOf blends the light and faint recipes linearly across exposures 0.6 to 0.7. gradedOffsets and gradedExtents read that share, so line count and taper change a little per step of exposure.
Reason: with the recipe's single edge at 0.6, the cliff took 1.5 of a band's 3.5 chord lengths at once. Five walls of the default perspective camera set were then banded differently in two views that lit them within 0.01 of each other.
Rejected: one cliff at 0.6. It is simpler, but it lets two views that light a wall alike draw it with visibly different bands.
