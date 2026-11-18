---
title: "Judge MetadataComposition coverage against the same focused group on clean HEAD"
date: 2026-11-13
lane: "perf/citation-hoist-installs"
reversal: "Add focused tests for the substitution invalid-match refusal and the fallback native admission."
---

With twenty focused metadata test files MetadataComposition measures 98.46 lines, 97.88 statements, 91.42 branches and 100 functions, below the whole-suite floor (99.22, 98.58, 92.68, 100). The two uncovered lines, 64 (substitution invalid-match refusal) and 178 (fallback native admission when none is supplied), are unchanged by A3. The same twenty files on clean HEAD measure 98.38, 97.79, 91.42 and 100 with the same two lines uncovered, so the slice regresses nothing and the floor depends on tests outside the focused group. Hosted CI measures the whole suite. No floor was lowered.
