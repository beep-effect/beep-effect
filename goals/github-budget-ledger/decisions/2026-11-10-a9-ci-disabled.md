---
title: "A9 The ledger is disabled in CI and by BEEP_GITHUB_LEDGER=off"
date: 2026-11-10
reversal: "Enable it with a CI state root."
---

The ledger sink is disabled when `isCiSync()` holds or `BEEP_GITHUB_LEDGER=off`, read through `configStringOption`. The github-headroom parcel still reads whatever ledger the host has.

Resolves SPEC ambiguity A9 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").
