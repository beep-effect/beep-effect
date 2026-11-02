# Retention calibration source ledger

Inspected 2026-10-28 at source commit
`732e11fd6dc417e5954b22fbbd856a026299ea50`.

| Source | Role / facts | Limits |
| --- | --- | --- |
| User instruction, 2026-10-28 | Prepare next packet from merged report; calibration evidence and explicit approval gate activation | Preparation only; no dataset or activation approval |
| [PR #2322](https://github.com/beep-effect/beep-effect/pull/2322) | Merged standalone report baseline; local HEAD matches its squash commit | Future work must reverify source; old CI is not new-head proof |
| [Predecessor SPEC](../../epistemic-memory-retention-projections/SPEC.md) | Authority isolation, deterministic rebuild, inert policy constraints | Mechanism completion is not calibration |
| [Report runbook](../../epistemic-memory-retention-projections/ops/REPORT.md) | CLI, canonical payload bytes, rational decay, receipt/trusted-registry conditions | No product policy values or production registry |
| [P0 contract](../../epistemic-memory-retention-projections/history/2026-10-28-p0-contract.md) | Frozen authority/report/calibration seam | Fixture proof only |
| [Verification](../../epistemic-memory-retention-projections/history/2026-10-28-verification.md) | Baseline acceptance and test evidence | Historical exact-head results |
| [Retention model](../../../packages/epistemic/domain/src/values/Retention/Retention.model.ts) | Five positive ordered policy values; exact receipt fields and purpose | Decode does not establish trust/approval |
| [Retention behavior](../../../packages/epistemic/domain/src/values/Retention/Retention.behavior.ts) | Canonical policy digest helper | Reuse exact encoding |
| [Registry port](../../../packages/epistemic/use-cases/src/Retention/Retention.ports.ts) | Deployment-owned find port, inert layer | No production registry adapter |
| [Report service](../../../packages/epistemic/use-cases/src/Retention/Retention.service.ts) | Digest/org/mechanism/purpose/knownAt receipt checks, reporting semantics | Evidence authenticity/revocation owned by registry |
| [Standalone CLI](../../../packages/epistemic/server/scripts/retention-report.ts) | Explicit inert composition | Preserve this default |
| [Authority fixture](../../../packages/epistemic/server/test/RetentionAuthority.pglite.test.ts) | Migrated accepted-authority and full delete/rebuild precedent | Synthetic test data cannot justify production |
| [Architecture](../../../standards/ARCHITECTURE.md) and [packet standard](../../README.md) | Governing placement, lifecycle, exact-head completion convention | Outrank packet-local shortcuts |

No new external literature or donor implementation is needed to author this
packet. No third-party code/constants are copied. Agentmemory remains citation-
only in the predecessor exploration. No product dataset, workload labels or
calibration results have been inspected or admitted by this preparation.
