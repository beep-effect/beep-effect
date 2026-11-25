---
title: "P8: attributed-multi-claim-span's retention is lifted, so the packet becomes archivable"
date: 2026-11-25
lane: "goals/text-knowledge-stack-rebuild-p7-retirement"
reversal: "Restore the retentionReason in goals/attributed-multi-claim-span/ops/manifest.json"
---

SPEC Relationships keeps `goals/attributed-multi-claim-span` retained on `main` until P4's acceptance item `ClaimGate.two-claims-one-occurrence.test.ts` is green, and archives it only then. That test is on `main` at `packages/foundation/modeling/epistemics/test/ClaimGate.two-claims-one-occurrence.test.ts`, landed by #3540 (`b288d08e014`), and hosted CI ran it green at the merge. Its manifest's `retentionReason` is the one thing that keeps `goals archive` from selecting a `superseded` packet (`Archive.service.ts` selects `completed-retained` or `superseded` goals with no `archive` block and no `retentionReason`), so the final PR removes it. Moving the packet to the archive repository is the routine `goals archive --plan` / `--write --expect` batch, which moves packets across repositories in planned batches; this packet does not run it on its own.
