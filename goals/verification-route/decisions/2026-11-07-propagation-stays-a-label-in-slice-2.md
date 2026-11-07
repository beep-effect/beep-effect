---
title: "Propagation stays a label in slice 2"
date: 2026-11-07
lane: "feat/verification-route-slice-2"
reversal: "Read the workspace graph at the head (batched git cat-file) when a lane first selects from affected packages"
---

No slice-2 refinement selects lanes from affected packages; every decision comes from atoms whose owners already resolve at the commit. The SPEC row about the head graph applies only once a lane selects from affected packages, which slice 2 does not do.
