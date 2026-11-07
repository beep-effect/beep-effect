---
title: "Hop edges are recorded for the intake each inventory run records, and verify counts catalogued hop-2 identities apart"
date: 2026-11-07
lane: "feat/research-library-routes"
reversal: "Re-derive hops for every intake on each inventory, and treat hop-2 sources without captures as missing"
---

Library.evidence imports Library.import, so hops run as a composed step (inventoryLibraryWithHops) rather than inside inventoryLibrary. The step derives edges only for the intake that run recorded (the intake whose input roots equal the run's roots, or the newest intake when default roots were used). The first version re-derived every historical intake, which rewrote October's accounting on the real library (about 3k hop-1 and 87k hop-2 edges per October intake) and made status and the gate quadratic; the fix was cherry-picked from c860570375c on feat/research-intake-2026-11. Edge ids hash intake, depth, parent and child, so a rerun on the same roots adds no duplicates, and hop lookups use one index per catalog. Hop-2-only sources with no capture are catalogued identities, not reading obligations; verify reports them as cataloguedHop2 instead of missing.
