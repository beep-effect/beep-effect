# Capability and packet baseline

Read-only repository inventory pinned to `7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8`, compared with lane base
`3778ac719d5b1f149c598b26aedce415fee83c8c`. Recorded 2026-10-06T12:41:06.825740+00:00. This is pre-synthesis
inventory. Runtime surfaces, design commitments, lifecycle metadata, and live PR
state are separate evidence boundaries. No external-corpus findings or proposed
goal outcomes are inferred here.

The pinned range contains six commits and 130 changed files. At inspection,
none overlap the research lane's three modified tracked files or 36 untracked
files. This is changed-path evidence; an actual merge and its quality gates have
not been performed. No Research, Knowledge, Goals command source or top-level
nightly `research/` content changed in this range.

| Fresh-main change | Established boundary | Source and coordination |
| --- | --- | --- |
| Mail-tagging core, #1464 | Three public MailTagging entry points, schemas, matching, tagging job, filing, undo, and file ledgers shipped. Packet P1 remains in progress; adapters and live verification follow. | [goals/practice-mail-tagging/README.md](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/practice-mail-tagging/README.md); [goals/practice-mail-tagging/PLAN.md](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/practice-mail-tagging/PLAN.md); [packages/law-practice/domain/package.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/packages/law-practice/domain/package.json); [packages/law-practice/use-cases/package.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/packages/law-practice/use-cases/package.json); [packages/law-practice/server/package.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/packages/law-practice/server/package.json) |
| CI-Ops projection, #1459 | P2 complete. Live replay records 197/200 first-choice agreement beside 41/41 golden; P3 auditor run and P4 KPI verdict pending. The planner emits a proposal with provisional vocabulary. | [goals/ciops-ontology-pipeline/PLAN.md](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/ciops-ontology-pipeline/PLAN.md); [goals/ciops-ontology-pipeline/research/s7-live-replay-evidence.md](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/ciops-ontology-pipeline/research/s7-live-replay-evidence.md); [explorations/beep-ci-operational-ontology/ontology/docs/s7-projection-contract.md](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/explorations/beep-ci-operational-ontology/ontology/docs/s7-projection-contract.md) |
| Docket adversarial review, #1478 | Slice 3b is design only: bounded rounds, deterministic checks, agreement score, typed configuration, persistence, flagged outcomes. Starts after slice 3. | [goals/practice-docket-intake/SPEC.md](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/practice-docket-intake/SPEC.md); [goals/practice-docket-intake/PLAN.md](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/practice-docket-intake/PLAN.md) |
| Yeet REST fallback, #1468 | PR discovery falls back to REST on GraphQL rate limits. | [packages/tooling/tool/cli/src/commands/Yeet/internal/PullRequest.ts](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/packages/tooling/tool/cli/src/commands/Yeet/internal/PullRequest.ts) |
| Effect/Vitest fixture scope, #1467 | CLI artifact and Effect-function fixtures now run under runner layers. | [packages/tooling/tool/cli/test/artifacts-io.test.ts](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/packages/tooling/tool/cli/test/artifacts-io.test.ts); [packages/tooling/tool/cli/test/effect-fn.test.ts](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/packages/tooling/tool/cli/test/effect-fn.test.ts) |
| Scratchpad SemVer retirement, #1479 | Scratchpad SemVer source and export removed. Retired paths are excluded from reuse candidates. | [scratchpad/package.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/scratchpad/package.json); commit `7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8` |

Live GitHub metadata checked during the audit identifies these coordination
leads; this does not establish their hosted readiness:

- [PR #1475](https://github.com/beep-effect/beep-effect/pull/1475),
  `feat/docket-intake-app`: open, non-draft, docket adapters and service.
- [PR #1480](https://github.com/beep-effect/beep-effect/pull/1480),
  `feat/practice-mail-adapters`: open, non-draft, Outlook, practice-KG, Box adapters.
- No matching open CI-Ops PR was returned by the bounded title search.

The docket README's statement that #1455, #1456, and #1458 are open drafts is
stale. GitHub reports all three merged: [packet/runbook #1455](https://github.com/beep-effect/beep-effect/pull/1455),
[M365 write lane #1456](https://github.com/beep-effect/beep-effect/pull/1456), and
[docket core #1458](https://github.com/beep-effect/beep-effect/pull/1458).
These merges precede the inspected range. Packet phase metadata still describes
P1 as in progress and does not prove live rollout.

Ownership boundaries remain explicit:

- Workstream A, practice-docket-intake, owns every M365 driver edit. Mail tagging
  consumes those verbs through ports; coordinate through the orchestrator.
  Source: [goals/practice-mail-tagging/README.md](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/practice-mail-tagging/README.md) and
  [goals/practice-mail-tagging/SPEC.md](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/practice-mail-tagging/SPEC.md) decisions D-5 and D-15.
- Practice-KG owns matter lookup/reference grammar; mail tagging consumes
  `PracticeKgMatterLookup` and `extractPracticeKgReferences`. Box onboarding
  owns the private folder map and shared API-call metering. The public packet
  records contracts, not private mailbox or client evidence.
  Source: [goals/practice-mail-tagging/SPEC.md](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/practice-mail-tagging/SPEC.md) decisions D-14 through D-16.
- CI-Ops owns operational ontology, projection, auditor runs and KPI verdict.
  Time-to-certainty retains deployed wave order, proof-ledger/C4.2 and handoff
  single-writer ownership. Facts cross as documents by path and SHA-256.
  Source: [goals/ciops-ontology-pipeline/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/ciops-ontology-pipeline/ops/manifest.json) provenance.

| Existing packet | Recorded capability/state boundary | Authority |
| --- | --- | --- |
| practice-kg-mcp | P6/P7 complete: client-keyed graph, stable matter lookup. P5/P8 in progress; P9 pending; deployment/acceptance still open. | [goals/practice-kg-mcp/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/practice-kg-mcp/ops/manifest.json) |
| legal-document-intake | P4 waits for practice-KG P8 handoff; Box test tenant recorded unprovisioned. | [goals/legal-document-intake/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/legal-document-intake/ops/manifest.json) |
| citation-extraction-engine | Eyecite pinned/tested; P0 accounting in progress; production blocked by verified-span and reporter-vocabulary contracts. | [goals/citation-extraction-engine/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/citation-extraction-engine/ops/manifest.json) |
| knowledge-surface-automation | Provides knowledge/doctor, skills/warehouse, goals/graph, goals/bootstrap. P1 in progress; P2/P3 complete; later work gated. | [goals/knowledge-surface-automation/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/knowledge-surface-automation/ops/manifest.json) |
| coding-agent-effectiveness-evidence-loop | Active P2 in progress; later phases pending. Older agent-effectiveness-loop is completed-retained. | [goals/coding-agent-effectiveness-evidence-loop/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/coding-agent-effectiveness-evidence-loop/ops/manifest.json); [goals/agent-effectiveness-loop/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/agent-effectiveness-loop/ops/manifest.json) |
| nightly-research-routine | P0 shipped and timer operation recorded; P1-P4 queued. | [goals/nightly-research-routine/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/nightly-research-routine/ops/manifest.json) |
| file-processing-capability and langextract-capability | Completed-retained; file processing explicitly handed its outcome to legal-document-intake P4. | [goals/file-processing-capability/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/file-processing-capability/ops/manifest.json); [goals/langextract-capability/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/langextract-capability/ops/manifest.json) |
| semantic-foundation | Completed-retained for M1/R1-R4; M2-M4 remain future product-gated work. | [goals/semantic-foundation/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/semantic-foundation/ops/manifest.json) |
| time-to-certainty | Paused on ruling 80 resume condition; C4.2 and closure work remain open. | [goals/time-to-certainty/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/time-to-certainty/ops/manifest.json) |

The exact pinned-tree census excludes both templates and this uncommitted
research-corpus exploration. There are 207 real goal manifests: 57 active,
130 completed-retained, 15 paused, four reference, one superseded. There are
82 real exploration manifests: eight active, 15 parked, 59 graduated.
Only 18 active goals declare `provides`, totaling 29 capability tokens;
39 active goals need packet docs and package surfaces to establish reuse.
The manifest graph alone is not a complete capability inventory.

The active goals below are lifecycle metadata, not a claim that each has an
active worker or finished runtime. Each row's source is the exact pinned
`ops/manifest.json`.

| Active goal | Open phase metadata | Declared provides |
| --- | --- | --- |
| [goals/agent-pool-doctrine/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/agent-pool-doctrine/ops/manifest.json) | P1: in-progress, P2: pending, P3: pending, P4: pending | not declared |
| [goals/agentic-cad-patent-tooling/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/agentic-cad-patent-tooling/ops/manifest.json) | P1: pending, P2: pending, P3: pending, P4: pending, P5: pending, P6: pending, P7: pending | not declared |
| [goals/agentic-governance-laws/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/agentic-governance-laws/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending, P4: pending | not declared |
| [goals/agentic-professional-runtime/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/agentic-professional-runtime/ops/manifest.json) | P1: pending, P4: pending | not declared |
| [goals/ai-metrics-raw-retention/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/ai-metrics-raw-retention/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending, P4: pending | telemetry/raw-retention |
| [goals/canonical-proof-reconciliation/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/canonical-proof-reconciliation/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending, P4: pending | architecture/proof-reconciled |
| [goals/ci-fleet-endgame/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/ci-fleet-endgame/ops/manifest.json) | P4: superseded, P5: superseded, P6: pending | not declared |
| [goals/ci-lane-economics/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/ci-lane-economics/ops/manifest.json) | P3: in-progress | not declared |
| [goals/ciops-ontology-pipeline/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/ciops-ontology-pipeline/ops/manifest.json) | P3: pending, P4: pending, P5: pending, P6: pending | ciops/operational-ontology, ciops/projection-engine, ciops/kpi-verdict |
| [goals/citation-extraction-engine/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/citation-extraction-engine/ops/manifest.json) | P0: in-progress, P1: pending, P2: pending, P3: pending, P4: pending, P5: pending | not declared |
| [goals/cloud-agent-readiness/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/cloud-agent-readiness/ops/manifest.json) | P2: pending, P3: pending, P4: pending, P5: pending, P6: pending | not declared |
| [goals/coding-agent-effectiveness-evidence-loop/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/coding-agent-effectiveness-evidence-loop/ops/manifest.json) | P2: in-progress, P3: pending, P4: pending, P5: pending, P6: pending, P7: pending, P8: pending | not declared |
| [goals/design-figure-generation/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/design-figure-generation/ops/manifest.json) | P1: pending, P2: pending, P3: pending, P4: pending, P5: pending | not declared |
| [goals/effect-v4-workflow-engine-spike/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/effect-v4-workflow-engine-spike/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending | not declared |
| [goals/effect-vitest-canon/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/effect-vitest-canon/ops/manifest.json) | P1: in-progress, P2: in-progress, P3: pending | not declared |
| [goals/epistemic-contradiction-detection/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/epistemic-contradiction-detection/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending, P4: pending | not declared |
| [goals/epistemic-memory-retention-projections/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/epistemic-memory-retention-projections/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending, P4: pending | not declared |
| [goals/fleet-root-registry/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/fleet-root-registry/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending, P4: pending | fleet/root-config, fleet/registry |
| [goals/folio-lynx-taxonomy-browse/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/folio-lynx-taxonomy-browse/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending, P4: pending | not declared |
| [goals/hybrid-retrieval-fusion-core/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/hybrid-retrieval-fusion-core/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending | not declared |
| [goals/ingestion-secret-scrub/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/ingestion-secret-scrub/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending | not declared |
| [goals/knowledge-surface-automation/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/knowledge-surface-automation/ops/manifest.json) | P1: in-progress, P4: pending, P5: pending, P6: pending | knowledge/doctor, skills/warehouse, goals/graph, goals/bootstrap |
| [goals/lane-bootstrap/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/lane-bootstrap/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending, P4: pending | fleet/lane-bootstrap |
| [goals/law-doc-structure-oa-slice/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/law-doc-structure-oa-slice/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending | not declared |
| [goals/law-docketing-patent-spine/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/law-docketing-patent-spine/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending, P4: pending | not declared |
| [goals/law-docketing-reliability/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/law-docketing-reliability/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending, P4: pending | not declared |
| [goals/law-time-capture-spine/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/law-time-capture-spine/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending, P4: pending | not declared |
| [goals/legacy-drain/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/legacy-drain/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending, P4: pending | fleet/drain |
| [goals/legal-document-intake/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/legal-document-intake/ops/manifest.json) | P4: pending, P5: pending, P6: pending, P7: pending | not declared |
| [goals/lejeune-demo-corpus-and-ontology/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/lejeune-demo-corpus-and-ontology/ops/manifest.json) | P3: in-progress | lejeune/demo-corpus-and-ontology |
| [goals/m365-agent-outbox/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/m365-agent-outbox/ops/manifest.json) | P1: pending, P2: pending, P3: pending, P4: pending | m365/agent-outbox |
| [goals/nightly-research-routine/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/nightly-research-routine/ops/manifest.json) | P1: pending, P2: pending, P3: pending, P4: pending | not declared |
| [goals/ontology-sidecar-stateless-identity/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/ontology-sidecar-stateless-identity/ops/manifest.json) | P1: pending, P2: pending, P3: pending, P4: pending | not declared |
| [goals/openclaw-workstation-agent/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/openclaw-workstation-agent/ops/manifest.json) | P2: in-progress, P3: pending, P4: pending | not declared |
| [goals/oppold-corpus-salvage-restoration/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/oppold-corpus-salvage-restoration/ops/manifest.json) | P0: in-progress, P1: pending, P2: pending, P3: pending | not declared |
| [goals/ops-seat-timers/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/ops-seat-timers/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending, P4: pending | fleet/ops-seat |
| [goals/practice-docket-intake/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/practice-docket-intake/ops/manifest.json) | P1: in-progress, P2: pending, P3: pending, P4: pending | practice/docket-intake, drivers/m365-calendar-write |
| [goals/practice-kg-mcp/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/practice-kg-mcp/ops/manifest.json) | P5: in-progress, P8: in-progress, P9: pending | not declared |
| [goals/practice-m365-contacts/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/practice-m365-contacts/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending, P4: pending | practice/contacts-seeded, drivers/m365-app-only-lane |
| [goals/practice-mail-backfill/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/practice-mail-backfill/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending, P4: pending | practice/mail-history-searchable |
| [goals/practice-mail-tagging/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/practice-mail-tagging/ops/manifest.json) | P1: in-progress, P2: pending, P3: pending, P4: pending | law-practice/mail-matter-tagging, law-practice/attachment-auto-filing |
| [goals/professional-desktop-adversarial-qa/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/professional-desktop-adversarial-qa/ops/manifest.json) | P1: in-progress, P2: pending, P3: pending, P4: pending | not declared |
| [goals/projection-dispatch-core/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/projection-dispatch-core/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending | not declared |
| [goals/runner-trust-boundary/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/runner-trust-boundary/ops/manifest.json) | P8: pending | not declared |
| [goals/secure-document-delivery/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/secure-document-delivery/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending | not declared |
| [goals/semantica-atlas-sync/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/semantica-atlas-sync/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending | semantica/atlas-verdicts |
| [goals/semantica-reasoning-spike/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/semantica-reasoning-spike/ops/manifest.json) | P1: pending, P2: pending, P3: pending, P4: pending, P5: pending | semantica/rules-fixture, semantica/reasoning-kernel |
| [goals/semantica-storage-inversion/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/semantica-storage-inversion/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending, P4: pending | semantica/tombstone-law, semantica/storage-semantics |
| [goals/slice-topology-audit/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/slice-topology-audit/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending, P4: pending | architecture/slice-audit |
| [goals/spar-document-annotation-wire/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/spar-document-annotation-wire/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending, P4: pending | not declared |
| [goals/thread-virtualization/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/thread-virtualization/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending, P4: pending | not declared |
| [goals/tracked-changes-ingest-wedge/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/tracked-changes-ingest-wedge/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending, P4: pending | not declared |
| [goals/turborepo-cache-conformance/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/turborepo-cache-conformance/ops/manifest.json) | P0: in-progress, P1: in-progress, P2: pending, P3: pending, P4: pending, P5: pending, P6: pending | not declared |
| [goals/turborepo-cache-trust-observability/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/turborepo-cache-trust-observability/ops/manifest.json) | P0: in-progress, P1: pending, P2: pending, P3: pending, P4: pending, P5: pending, P6: pending | not declared |
| [goals/uspto-prosecution-read/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/uspto-prosecution-read/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending | not declared |
| [goals/uspto-ptmnfee2-ingest/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/uspto-ptmnfee2-ingest/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending | not declared |
| [goals/voice-composer-slice/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/goals/voice-composer-slice/ops/manifest.json) | P0: pending, P1: pending, P2: pending, P3: pending | not declared |

| Active exploration | Stage | Linked goal ownership |
| --- | --- | --- |
| [explorations/beep-mode/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/explorations/beep-mode/ops/manifest.json) | align | not declared |
| [explorations/cloud-environment-fanout/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/explorations/cloud-environment-fanout/ops/manifest.json) | research | not declared |
| [explorations/github-merge-queue/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/explorations/github-merge-queue/ops/manifest.json) | capture | not declared |
| [explorations/gpu-document-ocr/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/explorations/gpu-document-ocr/ops/manifest.json) | research | not declared |
| [explorations/grok-bot-automation/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/explorations/grok-bot-automation/ops/manifest.json) | align | goals/nightly-research-routine |
| [explorations/protocol-as-value/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/explorations/protocol-as-value/ops/manifest.json) | shape | not declared |
| [explorations/stacked-pr-adoption/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/explorations/stacked-pr-adoption/ops/manifest.json) | research | not declared |
| [explorations/typed-agent-skill-contracts/ops/manifest.json](https://github.com/beep-effect/beep-effect/blob/7c2d2b51993d70ca082a41aa31969bbc8f2e6ff8/explorations/typed-agent-skill-contracts/ops/manifest.json) | decompose | goals/skill-contract-kernel |

Phase 2 research synthesis remains gated on the library Phase 1 verification.
