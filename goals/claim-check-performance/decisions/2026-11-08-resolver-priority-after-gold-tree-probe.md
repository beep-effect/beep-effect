---
title: "Target the reference resolver alongside root segmentation"
date: 2026-11-08
reversal: "Trigger: re-check alerts when abstention lifts. If they regress, or to undo the priority flip, remove refinesSelection and isRefinedHead, keep the probe as evidence, and return to segmentation-first."
---

A dev probe fed gold trees through the real pipeline: 59/538 with gold roots, 99/538 with every claim gold, against 48/538 today. Segmentation alone cannot reach 270, so the resolver now shares priority with it. Correction to the first report of this probe: it injects gold elements, terms and non-antecedent edges, so its figures for those layers are artefacts and its strict counts are upper bounds. The real route is also far from gold on structure, so both layers are needed.

Adopted, on inspection routes only: the nearest local introducer among repeated exact introducers, and a definite multi-word head matching an introducer with added modifiers. Real replay goes from 48 to 49 with 0 lost; gold-tree strict from 99 to 110 with 0 lost. decomposeClaim, which the self-check uses, stays on the legacy resolver. Cost: 266 new predicted edges, 58 matching. Finding counts on the 538 corpus are unchanged, but identical counts under full policy-uncovered abstention prove nothing about alert precision, so do not read them as evidence that it held. This stays an open risk until alerts are re-checked when abstention lifts.

Rejected: dropping subject-derived depends-on-element (real 41, 13 lost); dropping all definite-to-definite links (real 47, 1 lost; gold-tree 139, 9 lost); the local-only form (real 48, 0 lost, but gives back the 49th claim; gold-tree 116, 7 lost). Numbers and the next open lever are in research/resolver-probe-001.md.

Rebound after #2980 merged: the figures above were measured on the 48/538 base. Paired against main at 809ceb301b5, the merged head goes from 50 to 52 with 0 lost, gaining 14262251-root-1/4 and 16628033-root-1/1. Predicted edges go from 6100 to 6356 and matched edges from 2512 to 2640. All 538 claims still abstain. The gold-tree probe was not re-run on this base.
