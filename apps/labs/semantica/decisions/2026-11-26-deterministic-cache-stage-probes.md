---
title: Drive competing cache entries at deterministic read stages
date: 2026-11-26
reversal: Rely on real filesystem write-once races to cover every competing stage.
governs:
  - test/ProviderCache.test.ts#CompetingStageProbe
enforcedBy: []
---

Use one cache directory and sequenced filesystem for competing-stage cases, registering a distinct target per concurrent case. Publish each competing entry on a chosen read of that target.
Reason: real write-once races reach whichever stage the scheduler happens to permit, so they cannot guarantee that every outcome is exercised.
Rejected: race-only stage coverage. Fixed read points drive every stage independently of which interleaving an uncontrolled race takes.
