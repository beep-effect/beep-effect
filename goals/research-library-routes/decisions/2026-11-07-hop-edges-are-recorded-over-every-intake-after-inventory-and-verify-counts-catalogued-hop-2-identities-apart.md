---
title: "Hop edges are recorded over every intake after inventory, and verify counts catalogued hop-2 identities apart"
date: 2026-11-07
lane: "feat/research-library-routes"
reversal: "Record hops inside inventoryLibrary for only the new intake, and treat hop-2 sources without captures as missing"
---

Library.evidence imports Library.import, so hops run as a composed step (inventoryLibraryWithHops) rather than inside inventoryLibrary. Edge ids hash intake, depth, parent and child, so recording over all intakes is idempotent. Hop-2-only sources with no capture are catalogued identities, not reading obligations; verify reports them as cataloguedHop2 instead of missing.
