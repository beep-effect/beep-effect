---
title: "Pointer commands are marked planned until the gate queries exist"
date: 2026-11-19
lane: "feat/gate-report-services"
reversal: "Mark the two query commands live and add the command-tree check."
---

The pointer table names the two planned queries of the gate command family and marks them planned. A test fails as soon as one is marked live without the check against the real command tree, which is the seam for law 9; the wiring slice adds the commands and flips the mark.
