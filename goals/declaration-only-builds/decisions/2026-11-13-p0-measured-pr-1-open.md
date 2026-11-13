---
title: "P0 measured: baseline and equivalence in research, PR 1 open"
date: 2026-11-13
kind: checkpoint
lane: "chore/declaration-only-builds-baseline"
reversal: "None needed; a status note."
---

Baseline (main at 2cadc8caa0d, 181 emitting packages, fastest of three, serial): compile 52.2 s, Babel 66.4 s over the 168 packages that run it, declarations-only compile 53.2 s. JavaScript and its maps are 84.0 MB of a 228.6 MB `dist` total. The saving in PR 2 is the Babel pass and the bytes; dropping JavaScript emit does not make the compile faster.

Equivalence: 2,912 build-versus-check comparisons identical, so check-once is kept. The stale tsbuildinfo glob moved to PR 2 because removing it changes every build task hash.
