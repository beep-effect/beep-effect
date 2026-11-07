# Research intake 2026-11 — Routing

Every finding mined from the November intake has exactly one disposition in
[`routing.jsonl`](./routing.jsonl): **routed** to a live packet concept,
**parked** with a re-entry trigger, or **rejected** with a reason. Rows from the
private partition carry ids, relation and disposition only; no summary, span or
URL leaves the library.

## Method

- A finding is a CiTO-typed edge from a T2 reading (or a T3 synthesis) to a
  verbatim span of its bound capture or hop-0 document, with `skos:related`
  topic ids naming packet concepts.
- **Routed:** the finding names at least one live concept (goal `active` or
  `paused`; exploration `active`). The first live concept owns it; other live
  concepts are listed in `alsoRelated`.
- **Parked:** every named concept is closed (`completed-retained`, `graduated`,
  `parked`, `superseded`, `reference`). Trigger: the owning packet reopens or a
  successor packet claims the concept.
- **Rejected:** the reading named no packet concept.
- Affirmative relations (`citesAsEvidence`, `supports`, `extends`,
  `usesMethodIn`, `usesDataFrom`) come only from complete readings; partial or
  unread captures yield `discusses` or `citesAsRelated` at most.
- The generator is deterministic over the catalog snapshot and the packet
  liveness of the lane's `origin/main` merge; re-running it after packets change
  state re-derives routed and parked rows.

## Dispositions

| Disposition | Public | Private | Total |
| --- | ---: | ---: | ---: |
| routed | 3944 | 2555 | 6499 |
| parked | 3728 | 1390 | 5118 |
| rejected | 164 | 84 | 248 |
| **all** | 7836 | 4029 | 11865 |

## Routed findings by packet

Affirmative counts drive the amendment threshold (see
[Amendments](#amendments)); negative relations (`critiques`, `disputes`,
`disagreesWith`) feed [`CONTRADICTIONS.md`](./CONTRADICTIONS.md).

| Packet | Routed | Affirmative | Negative | Public |
| --- | ---: | ---: | ---: | ---: |
| [`goals/agent-outcome-experiments`](../../../goals/agent-outcome-experiments/README.md) | 421 | 220 | 40 | 146 |
| [`goals/coding-agent-effectiveness-evidence-loop`](../../../goals/coding-agent-effectiveness-evidence-loop/README.md) | 368 | 213 | 23 | 87 |
| [`goals/agentic-professional-runtime`](../../../goals/agentic-professional-runtime/README.md) | 504 | 164 | 4 | 451 |
| [`goals/effect-native-legal-eval`](../../../goals/effect-native-legal-eval/README.md) | 381 | 153 | 31 | 242 |
| [`goals/agent-rating-critique-fixes`](../../../goals/agent-rating-critique-fixes/README.md) | 206 | 129 | 10 | 28 |
| [`goals/verification-route`](../../../goals/verification-route/README.md) | 246 | 121 | 20 | 107 |
| [`goals/uspto-prosecution-read`](../../../goals/uspto-prosecution-read/README.md) | 224 | 105 | 1 | 201 |
| [`goals/agentic-governance-laws`](../../../goals/agentic-governance-laws/README.md) | 364 | 103 | 13 | 279 |
| [`goals/skill-contract-gate-certificates`](../../../goals/skill-contract-gate-certificates/README.md) | 201 | 98 | 5 | 178 |
| [`goals/execution-authority-slice`](../../../goals/execution-authority-slice/README.md) | 200 | 91 | 1 | 158 |
| [`goals/claim-check-performance`](../../../goals/claim-check-performance/README.md) | 218 | 86 | 10 | 102 |
| [`goals/openclaw-workstation-agent`](../../../goals/openclaw-workstation-agent/README.md) | 200 | 65 | 2 | 200 |
| [`goals/agent-pool-doctrine`](../../../goals/agent-pool-doctrine/README.md) | 181 | 64 | 7 | 147 |
| [`goals/citation-extraction-engine`](../../../goals/citation-extraction-engine/README.md) | 151 | 63 | 1 | 128 |
| [`goals/model-arrangement-admission-core`](../../../goals/model-arrangement-admission-core/README.md) | 159 | 48 | 7 | 40 |
| [`goals/patent-drafting-episode-ledger`](../../../goals/patent-drafting-episode-ledger/README.md) | 145 | 48 | 0 | 118 |
| [`goals/hybrid-retrieval-fusion-core`](../../../goals/hybrid-retrieval-fusion-core/README.md) | 151 | 47 | 4 | 136 |
| [`goals/attributed-multi-claim-span`](../../../goals/attributed-multi-claim-span/README.md) | 103 | 40 | 4 | 64 |
| [`explorations/semantic-agent-graph-stack`](../../../explorations/semantic-agent-graph-stack/README.md) | 143 | 38 | 2 | 93 |
| [`explorations/protocol-as-value`](../../../explorations/protocol-as-value/README.md) | 194 | 31 | 10 | 16 |
| [`goals/effect-v4-workflow-engine-spike`](../../../goals/effect-v4-workflow-engine-spike/README.md) | 80 | 31 | 0 | 64 |
| [`goals/harness-emitters-all-providers`](../../../goals/harness-emitters-all-providers/README.md) | 61 | 31 | 0 | 53 |
| [`goals/canonical-proof-reconciliation`](../../../goals/canonical-proof-reconciliation/README.md) | 68 | 30 | 8 | 19 |
| [`goals/semantica-reasoning-spike`](../../../goals/semantica-reasoning-spike/README.md) | 55 | 30 | 2 | 12 |
| [`goals/legal-document-intake`](../../../goals/legal-document-intake/README.md) | 87 | 28 | 0 | 63 |
| [`goals/agentic-cad-patent-tooling`](../../../goals/agentic-cad-patent-tooling/README.md) | 85 | 26 | 1 | 80 |
| [`goals/oracle-loop-poc`](../../../goals/oracle-loop-poc/README.md) | 116 | 23 | 4 | 2 |
| [`goals/belief-view-engine`](../../../goals/belief-view-engine/README.md) | 60 | 23 | 1 | 24 |
| [`goals/agent-pool-picker`](../../../goals/agent-pool-picker/README.md) | 50 | 23 | 0 | 14 |
| [`goals/oa-evidence-consumer-conformance`](../../../goals/oa-evidence-consumer-conformance/README.md) | 46 | 23 | 0 | 33 |
| [`goals/knowledge-freshness-audit`](../../../goals/knowledge-freshness-audit/README.md) | 69 | 22 | 9 | 55 |
| [`goals/time-to-certainty`](../../../goals/time-to-certainty/README.md) | 43 | 19 | 2 | 14 |
| [`goals/configurable-full-document-editor`](../../../goals/configurable-full-document-editor/README.md) | 62 | 18 | 0 | 25 |
| [`goals/harness-telemetry-enrollment`](../../../goals/harness-telemetry-enrollment/README.md) | 39 | 16 | 0 | 26 |
| [`goals/folio-lynx-taxonomy-browse`](../../../goals/folio-lynx-taxonomy-browse/README.md) | 36 | 16 | 1 | 21 |
| [`goals/cloud-agent-readiness`](../../../goals/cloud-agent-readiness/README.md) | 26 | 16 | 0 | 24 |
| [`goals/ai-metrics-raw-retention`](../../../goals/ai-metrics-raw-retention/README.md) | 39 | 15 | 2 | 23 |
| [`goals/nightly-research-routine`](../../../goals/nightly-research-routine/README.md) | 44 | 12 | 0 | 43 |
| [`goals/slice-topology-audit`](../../../goals/slice-topology-audit/README.md) | 29 | 12 | 0 | 23 |
| [`goals/law-docketing-patent-spine`](../../../goals/law-docketing-patent-spine/README.md) | 56 | 11 | 1 | 52 |
| [`goals/law-docketing-reliability`](../../../goals/law-docketing-reliability/README.md) | 39 | 11 | 3 | 35 |
| [`goals/design-figure-review-loop`](../../../goals/design-figure-review-loop/README.md) | 35 | 11 | 0 | 18 |
| [`goals/doc-hub-spokes-inversion`](../../../goals/doc-hub-spokes-inversion/README.md) | 85 | 10 | 6 | 2 |
| [`goals/projection-dispatch-core`](../../../goals/projection-dispatch-core/README.md) | 26 | 10 | 0 | 12 |
| [`goals/tracked-changes-ingest-wedge`](../../../goals/tracked-changes-ingest-wedge/README.md) | 23 | 9 | 0 | 8 |
| [`goals/turborepo-cache-trust-observability`](../../../goals/turborepo-cache-trust-observability/README.md) | 11 | 9 | 0 | 0 |
| [`goals/beep-cli-composition`](../../../goals/beep-cli-composition/README.md) | 16 | 8 | 0 | 12 |
| [`goals/ontology-sidecar-stateless-identity`](../../../goals/ontology-sidecar-stateless-identity/README.md) | 14 | 8 | 0 | 12 |
| [`goals/t3code-harness-mcp`](../../../goals/t3code-harness-mcp/README.md) | 14 | 8 | 0 | 14 |
| [`goals/professional-desktop-adversarial-qa`](../../../goals/professional-desktop-adversarial-qa/README.md) | 10 | 7 | 0 | 4 |
| [`goals/practice-gateway`](../../../goals/practice-gateway/README.md) | 16 | 6 | 0 | 16 |
| [`explorations/grok-bot-automation`](../../../explorations/grok-bot-automation/README.md) | 15 | 6 | 0 | 15 |
| [`goals/ci-lane-economics`](../../../goals/ci-lane-economics/README.md) | 13 | 6 | 0 | 9 |
| [`explorations/build-pipeline-simplification`](../../../explorations/build-pipeline-simplification/README.md) | 10 | 6 | 0 | 2 |
| [`goals/hold-ledger`](../../../goals/hold-ledger/README.md) | 22 | 4 | 0 | 10 |
| [`goals/infra-alchemy-rebuild`](../../../goals/infra-alchemy-rebuild/README.md) | 19 | 4 | 0 | 17 |
| [`goals/scripts-to-beep-cli`](../../../goals/scripts-to-beep-cli/README.md) | 6 | 4 | 0 | 5 |
| [`goals/webapp-and-ci-telemetry`](../../../goals/webapp-and-ci-telemetry/README.md) | 5 | 4 | 0 | 4 |
| [`explorations/beep-mode`](../../../explorations/beep-mode/README.md) | 17 | 3 | 0 | 16 |
| [`goals/goal-packet-conflict-free-appends`](../../../goals/goal-packet-conflict-free-appends/README.md) | 11 | 3 | 0 | 4 |
| [`goals/m365-agent-outbox`](../../../goals/m365-agent-outbox/README.md) | 11 | 3 | 0 | 10 |
| [`goals/ci-step-watchdog`](../../../goals/ci-step-watchdog/README.md) | 7 | 3 | 0 | 6 |
| [`goals/legacy-drain`](../../../goals/legacy-drain/README.md) | 5 | 3 | 0 | 4 |
| [`goals/turborepo-quality-cache-adoption`](../../../goals/turborepo-quality-cache-adoption/README.md) | 3 | 3 | 0 | 0 |
| [`goals/research-intake-2026-11`](../../../goals/research-intake-2026-11/README.md) | 29 | 2 | 1 | 18 |
| [`goals/voice-composer-slice`](../../../goals/voice-composer-slice/README.md) | 17 | 2 | 0 | 17 |
| [`goals/secure-document-delivery`](../../../goals/secure-document-delivery/README.md) | 11 | 2 | 0 | 8 |
| [`goals/lejeune-demo-corpus-and-ontology`](../../../goals/lejeune-demo-corpus-and-ontology/README.md) | 5 | 2 | 0 | 4 |
| [`goals/law-time-capture-spine`](../../../goals/law-time-capture-spine/README.md) | 12 | 1 | 1 | 12 |
| [`goals/harvested-alpha-triage`](../../../goals/harvested-alpha-triage/README.md) | 9 | 1 | 0 | 3 |
| [`goals/semantica-storage-inversion`](../../../goals/semantica-storage-inversion/README.md) | 4 | 1 | 0 | 4 |
| [`goals/thread-virtualization`](../../../goals/thread-virtualization/README.md) | 4 | 1 | 0 | 2 |
| [`goals/alchemy-vault-sync-slice`](../../../goals/alchemy-vault-sync-slice/README.md) | 3 | 1 | 0 | 3 |
| [`goals/ci-fleet-endgame`](../../../goals/ci-fleet-endgame/README.md) | 3 | 1 | 0 | 1 |
| [`goals/uspto-ptmnfee2-ingest`](../../../goals/uspto-ptmnfee2-ingest/README.md) | 3 | 1 | 0 | 2 |
| [`explorations/github-merge-queue`](../../../explorations/github-merge-queue/README.md) | 2 | 1 | 0 | 2 |
| [`goals/fleet-telemetry-tailnet`](../../../goals/fleet-telemetry-tailnet/README.md) | 2 | 1 | 0 | 1 |
| [`goals/lejeune-knowledge-desk-lab`](../../../goals/lejeune-knowledge-desk-lab/README.md) | 1 | 1 | 0 | 1 |
| [`goals/t3code-spill-routing`](../../../goals/t3code-spill-routing/README.md) | 1 | 1 | 0 | 1 |
| [`goals/goal-portfolio-driver`](../../../goals/goal-portfolio-driver/README.md) | 23 | 0 | 0 | 20 |
| [`goals/lane-bootstrap`](../../../goals/lane-bootstrap/README.md) | 7 | 0 | 0 | 7 |
| [`goals/t3code-fleet-rollout`](../../../goals/t3code-fleet-rollout/README.md) | 7 | 0 | 0 | 6 |
| [`goals/packet-archive-mechanics`](../../../goals/packet-archive-mechanics/README.md) | 4 | 0 | 0 | 0 |
| [`goals/fleet-root-registry`](../../../goals/fleet-root-registry/README.md) | 2 | 0 | 0 | 2 |
| [`goals/ops-seat-timers`](../../../goals/ops-seat-timers/README.md) | 2 | 0 | 0 | 1 |
| [`explorations/textjs-console-ui`](../../../explorations/textjs-console-ui/README.md) | 1 | 0 | 0 | 0 |
| [`goals/oppold-corpus-salvage-restoration`](../../../goals/oppold-corpus-salvage-restoration/README.md) | 1 | 0 | 0 | 1 |
| [`goals/practice-mail-backfill`](../../../goals/practice-mail-backfill/README.md) | 1 | 0 | 0 | 1 |
| [`goals/repo-cli-gh-git-consolidation`](../../../goals/repo-cli-gh-git-consolidation/README.md) | 1 | 0 | 0 | 1 |

## Amendments

Pending: routing amendments land in the owning packets as decision files with a
back-link to this document.

