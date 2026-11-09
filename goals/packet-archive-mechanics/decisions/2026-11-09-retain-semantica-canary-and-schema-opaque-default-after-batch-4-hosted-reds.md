---
title: "Retain semantica-canary, schema-opaque-default and speed-loop after batch 4 hosted reds"
date: 2026-11-09
lane: "feat/packet-archive-batch-4b"
reversal: "Remove each retentionReason; for semantica-canary first replace the sealed witness test, for schema-opaque-default first remove the codemod dependency, and for speed-loop first retire its security test"
---

Batch 4 first moved the sealed Semantica C2 report into a test fixture and archived schema-opaque-default. It also moved the speed-loop runner-burst script to scripts/. Hosted CI then failed: Secret Scanning on two digests in the moved report, the retired IRI law on its IRIs, fallow on @typescript/typescript6 losing its last consumer, and the tracked-shell law on the moved script. All three packets stay on main with a retentionReason, because a sweep batch should not add shell scripts. The archive commits were already public, so the archive repo still holds copies of them; those copies are harmless and inbound references rewritten to them still resolve. The batch landed from a new branch so the report never appears in the PR's commit range; nothing was force-pushed.
