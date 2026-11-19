---
title: "The model package uses flat leaf modules"
date: 2026-11-19
lane: "feat/gate-report-core"
reversal: "Move each module into a concept folder with role files and write an export map."
---

The scaffold exports every source file as a leaf, and the neighbouring modeling packages are flat, so the model keeps one module per concept at the top of its source folder with private helpers under an internal folder. Concept folders would need a hand-written export map.
