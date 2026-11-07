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
  concepts are listed in `alsoRelated`. A concept that is a graduated
  exploration routes to its first live successor goal (`links.goals` in the
  exploration manifest); such rows carry `reason: via graduated <exploration>`.
- **Parked:** every named concept is closed (`completed-retained`, `graduated`
  with no live successor, `parked`, `superseded`, `reference`). Trigger: the
  owning packet reopens or a successor packet claims the concept.
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
| routed | 5609 | 2863 | 8472 |
| parked | 2515 | 1082 | 3597 |
| rejected | 177 | 84 | 261 |
| **all** | 8301 | 4029 | 12330 |

## Routed findings by packet

Affirmative counts drive the amendment threshold (see
[Amendments](#amendments)); negative relations (`critiques`, `disputes`,
`disagreesWith`) feed [`CONTRADICTIONS.md`](./CONTRADICTIONS.md).

| Packet | Routed | Affirmative | Negative | Public |
| --- | ---: | ---: | ---: | ---: |
| [`goals/skill-contract-gate-certificates`](../../../goals/skill-contract-gate-certificates/README.md) | 522 | 243 | 9 | 455 |
| [`goals/agent-outcome-experiments`](../../../goals/agent-outcome-experiments/README.md) | 432 | 229 | 40 | 157 |
| [`goals/coding-agent-effectiveness-evidence-loop`](../../../goals/coding-agent-effectiveness-evidence-loop/README.md) | 373 | 215 | 23 | 90 |
| [`goals/citation-extraction-engine`](../../../goals/citation-extraction-engine/README.md) | 479 | 202 | 11 | 423 |
| [`goals/uspto-prosecution-read`](../../../goals/uspto-prosecution-read/README.md) | 363 | 182 | 4 | 327 |
| [`goals/agentic-professional-runtime`](../../../goals/agentic-professional-runtime/README.md) | 506 | 165 | 4 | 453 |
| [`goals/effect-native-legal-eval`](../../../goals/effect-native-legal-eval/README.md) | 454 | 165 | 33 | 315 |
| [`goals/agent-rating-critique-fixes`](../../../goals/agent-rating-critique-fixes/README.md) | 206 | 129 | 10 | 28 |
| [`goals/ontology-sidecar-stateless-identity`](../../../goals/ontology-sidecar-stateless-identity/README.md) | 214 | 126 | 1 | 204 |
| [`goals/verification-route`](../../../goals/verification-route/README.md) | 252 | 123 | 20 | 110 |
| [`goals/agentic-governance-laws`](../../../goals/agentic-governance-laws/README.md) | 389 | 110 | 14 | 304 |
| [`goals/execution-authority-slice`](../../../goals/execution-authority-slice/README.md) | 211 | 96 | 1 | 169 |
| [`goals/claim-check-performance`](../../../goals/claim-check-performance/README.md) | 223 | 86 | 11 | 107 |
| [`goals/agent-pool-doctrine`](../../../goals/agent-pool-doctrine/README.md) | 191 | 69 | 7 | 157 |
| [`goals/openclaw-workstation-agent`](../../../goals/openclaw-workstation-agent/README.md) | 241 | 68 | 2 | 241 |
| [`goals/hybrid-retrieval-fusion-core`](../../../goals/hybrid-retrieval-fusion-core/README.md) | 210 | 62 | 5 | 193 |
| [`goals/effect-v4-workflow-engine-spike`](../../../goals/effect-v4-workflow-engine-spike/README.md) | 151 | 62 | 0 | 116 |
| [`goals/model-arrangement-admission-core`](../../../goals/model-arrangement-admission-core/README.md) | 178 | 56 | 9 | 51 |
| [`goals/patent-drafting-episode-ledger`](../../../goals/patent-drafting-episode-ledger/README.md) | 152 | 49 | 0 | 124 |
| [`goals/attributed-multi-claim-span`](../../../goals/attributed-multi-claim-span/README.md) | 112 | 43 | 4 | 70 |
| [`goals/harness-telemetry-enrollment`](../../../goals/harness-telemetry-enrollment/README.md) | 104 | 43 | 1 | 72 |
| [`goals/folio-lynx-taxonomy-browse`](../../../goals/folio-lynx-taxonomy-browse/README.md) | 104 | 40 | 3 | 46 |
| [`explorations/semantic-agent-graph-stack`](../../../explorations/semantic-agent-graph-stack/README.md) | 145 | 38 | 2 | 95 |
| [`goals/research-intake-2026-11`](../../../goals/research-intake-2026-11/README.md) | 113 | 38 | 1 | 53 |
| [`goals/slice-topology-audit`](../../../goals/slice-topology-audit/README.md) | 72 | 37 | 0 | 65 |
| [`goals/harness-emitters-all-providers`](../../../goals/harness-emitters-all-providers/README.md) | 67 | 35 | 0 | 59 |
| [`goals/semantica-reasoning-spike`](../../../goals/semantica-reasoning-spike/README.md) | 60 | 33 | 3 | 17 |
| [`explorations/protocol-as-value`](../../../explorations/protocol-as-value/README.md) | 194 | 31 | 10 | 16 |
| [`goals/canonical-proof-reconciliation`](../../../goals/canonical-proof-reconciliation/README.md) | 68 | 30 | 8 | 19 |
| [`goals/oracle-loop-poc`](../../../goals/oracle-loop-poc/README.md) | 135 | 29 | 5 | 2 |
| [`goals/legal-document-intake`](../../../goals/legal-document-intake/README.md) | 91 | 28 | 0 | 67 |
| [`goals/agentic-cad-patent-tooling`](../../../goals/agentic-cad-patent-tooling/README.md) | 88 | 26 | 1 | 83 |
| [`goals/belief-view-engine`](../../../goals/belief-view-engine/README.md) | 75 | 25 | 1 | 35 |
| [`goals/oa-evidence-consumer-conformance`](../../../goals/oa-evidence-consumer-conformance/README.md) | 55 | 24 | 0 | 39 |
| [`goals/knowledge-freshness-audit`](../../../goals/knowledge-freshness-audit/README.md) | 73 | 23 | 9 | 59 |
| [`goals/agent-pool-picker`](../../../goals/agent-pool-picker/README.md) | 50 | 23 | 0 | 14 |
| [`goals/configurable-full-document-editor`](../../../goals/configurable-full-document-editor/README.md) | 75 | 21 | 0 | 34 |
| [`goals/practice-gateway`](../../../goals/practice-gateway/README.md) | 98 | 19 | 0 | 97 |
| [`goals/time-to-certainty`](../../../goals/time-to-certainty/README.md) | 43 | 19 | 2 | 14 |
| [`goals/cloud-agent-readiness`](../../../goals/cloud-agent-readiness/README.md) | 30 | 19 | 0 | 28 |
| [`goals/ai-metrics-raw-retention`](../../../goals/ai-metrics-raw-retention/README.md) | 39 | 15 | 2 | 23 |
| [`goals/law-docketing-patent-spine`](../../../goals/law-docketing-patent-spine/README.md) | 75 | 14 | 1 | 71 |
| [`goals/design-figure-review-loop`](../../../goals/design-figure-review-loop/README.md) | 52 | 14 | 0 | 32 |
| [`goals/nightly-research-routine`](../../../goals/nightly-research-routine/README.md) | 45 | 13 | 0 | 44 |
| [`goals/projection-dispatch-core`](../../../goals/projection-dispatch-core/README.md) | 73 | 12 | 2 | 49 |
| [`goals/law-docketing-reliability`](../../../goals/law-docketing-reliability/README.md) | 40 | 12 | 3 | 36 |
| [`goals/doc-hub-spokes-inversion`](../../../goals/doc-hub-spokes-inversion/README.md) | 85 | 10 | 6 | 2 |
| [`goals/tracked-changes-ingest-wedge`](../../../goals/tracked-changes-ingest-wedge/README.md) | 23 | 9 | 0 | 8 |
| [`goals/turborepo-cache-trust-observability`](../../../goals/turborepo-cache-trust-observability/README.md) | 11 | 9 | 0 | 0 |
| [`goals/beep-cli-composition`](../../../goals/beep-cli-composition/README.md) | 16 | 8 | 0 | 12 |
| [`goals/t3code-harness-mcp`](../../../goals/t3code-harness-mcp/README.md) | 14 | 8 | 0 | 14 |
| [`goals/ci-lane-economics`](../../../goals/ci-lane-economics/README.md) | 14 | 7 | 0 | 10 |
| [`goals/professional-desktop-adversarial-qa`](../../../goals/professional-desktop-adversarial-qa/README.md) | 10 | 7 | 0 | 4 |
| [`goals/thread-virtualization`](../../../goals/thread-virtualization/README.md) | 36 | 6 | 0 | 30 |
| [`explorations/grok-bot-automation`](../../../explorations/grok-bot-automation/README.md) | 23 | 6 | 1 | 23 |
| [`explorations/build-pipeline-simplification`](../../../explorations/build-pipeline-simplification/README.md) | 10 | 6 | 0 | 2 |
| [`goals/hold-ledger`](../../../goals/hold-ledger/README.md) | 27 | 5 | 0 | 13 |
| [`goals/infra-alchemy-rebuild`](../../../goals/infra-alchemy-rebuild/README.md) | 19 | 4 | 0 | 17 |
| [`goals/scripts-to-beep-cli`](../../../goals/scripts-to-beep-cli/README.md) | 6 | 4 | 0 | 5 |
| [`goals/webapp-and-ci-telemetry`](../../../goals/webapp-and-ci-telemetry/README.md) | 5 | 4 | 0 | 4 |
| [`goals/voice-composer-slice`](../../../goals/voice-composer-slice/README.md) | 41 | 3 | 0 | 41 |
| [`explorations/beep-mode`](../../../explorations/beep-mode/README.md) | 18 | 3 | 0 | 17 |
| [`goals/secure-document-delivery`](../../../goals/secure-document-delivery/README.md) | 14 | 3 | 0 | 11 |
| [`goals/m365-agent-outbox`](../../../goals/m365-agent-outbox/README.md) | 12 | 3 | 0 | 11 |
| [`goals/goal-packet-conflict-free-appends`](../../../goals/goal-packet-conflict-free-appends/README.md) | 11 | 3 | 0 | 4 |
| [`goals/ci-step-watchdog`](../../../goals/ci-step-watchdog/README.md) | 8 | 3 | 0 | 7 |
| [`goals/legacy-drain`](../../../goals/legacy-drain/README.md) | 5 | 3 | 0 | 4 |
| [`goals/practice-mail-backfill`](../../../goals/practice-mail-backfill/README.md) | 5 | 3 | 0 | 5 |
| [`goals/turborepo-quality-cache-adoption`](../../../goals/turborepo-quality-cache-adoption/README.md) | 3 | 3 | 0 | 0 |
| [`goals/fleet-root-registry`](../../../goals/fleet-root-registry/README.md) | 20 | 2 | 0 | 19 |
| [`goals/alchemy-vault-sync-slice`](../../../goals/alchemy-vault-sync-slice/README.md) | 11 | 2 | 1 | 4 |
| [`goals/uspto-ptmnfee2-ingest`](../../../goals/uspto-ptmnfee2-ingest/README.md) | 7 | 2 | 0 | 6 |
| [`goals/fleet-telemetry-tailnet`](../../../goals/fleet-telemetry-tailnet/README.md) | 5 | 2 | 0 | 4 |
| [`goals/lejeune-demo-corpus-and-ontology`](../../../goals/lejeune-demo-corpus-and-ontology/README.md) | 5 | 2 | 0 | 4 |
| [`goals/law-time-capture-spine`](../../../goals/law-time-capture-spine/README.md) | 15 | 1 | 1 | 15 |
| [`goals/harvested-alpha-triage`](../../../goals/harvested-alpha-triage/README.md) | 9 | 1 | 0 | 3 |
| [`goals/semantica-storage-inversion`](../../../goals/semantica-storage-inversion/README.md) | 4 | 1 | 0 | 4 |
| [`goals/ci-fleet-endgame`](../../../goals/ci-fleet-endgame/README.md) | 3 | 1 | 0 | 1 |
| [`explorations/github-merge-queue`](../../../explorations/github-merge-queue/README.md) | 2 | 1 | 0 | 2 |
| [`goals/lejeune-knowledge-desk-lab`](../../../goals/lejeune-knowledge-desk-lab/README.md) | 1 | 1 | 0 | 1 |
| [`goals/t3code-spill-routing`](../../../goals/t3code-spill-routing/README.md) | 1 | 1 | 0 | 1 |
| [`goals/goal-portfolio-driver`](../../../goals/goal-portfolio-driver/README.md) | 23 | 0 | 0 | 20 |
| [`goals/lane-bootstrap`](../../../goals/lane-bootstrap/README.md) | 7 | 0 | 0 | 7 |
| [`goals/t3code-fleet-rollout`](../../../goals/t3code-fleet-rollout/README.md) | 7 | 0 | 0 | 6 |
| [`goals/packet-archive-mechanics`](../../../goals/packet-archive-mechanics/README.md) | 5 | 0 | 0 | 0 |
| [`goals/oppold-corpus-salvage-restoration`](../../../goals/oppold-corpus-salvage-restoration/README.md) | 2 | 0 | 0 | 2 |
| [`goals/ops-seat-timers`](../../../goals/ops-seat-timers/README.md) | 2 | 0 | 0 | 1 |
| [`goals/semantica-atlas-sync`](../../../goals/semantica-atlas-sync/README.md) | 2 | 0 | 0 | 1 |
| [`explorations/textjs-console-ui`](../../../explorations/textjs-console-ui/README.md) | 1 | 0 | 0 | 0 |
| [`goals/repo-cli-gh-git-consolidation`](../../../goals/repo-cli-gh-git-consolidation/README.md) | 1 | 0 | 0 | 1 |

## Amendments

Every live goal packet with at least 40 affirmative routed findings received one
decision file in its own `decisions/` directory, holding the counts, the five
strongest public findings and a back-link here. The amendment adds evidence only;
it changes no acceptance criterion, and the owning lane decides what to act on.
Packets below the threshold, and all explorations, are served by the rows in
`routing.jsonl`.

| Packet | Affirmative | Amendment |
| --- | ---: | --- |
| `goals/skill-contract-gate-certificates` | 243 | [decision](../../../goals/skill-contract-gate-certificates/decisions/2026-11-07-research-intake-2026-11-routed-findings.md) |
| `goals/agent-outcome-experiments` | 229 | [decision](../../../goals/agent-outcome-experiments/decisions/2026-11-07-research-intake-2026-11-routed-findings.md) |
| `goals/coding-agent-effectiveness-evidence-loop` | 215 | [decision](../../../goals/coding-agent-effectiveness-evidence-loop/decisions/2026-11-07-research-intake-2026-11-routed-findings.md) |
| `goals/citation-extraction-engine` | 202 | [decision](../../../goals/citation-extraction-engine/decisions/2026-11-07-research-intake-2026-11-routed-findings.md) |
| `goals/uspto-prosecution-read` | 182 | [decision](../../../goals/uspto-prosecution-read/decisions/2026-11-07-research-intake-2026-11-routed-findings.md) |
| `goals/agentic-professional-runtime` | 165 | [decision](../../../goals/agentic-professional-runtime/decisions/2026-11-07-research-intake-2026-11-routed-findings.md) |
| `goals/effect-native-legal-eval` | 165 | [decision](../../../goals/effect-native-legal-eval/decisions/2026-11-07-research-intake-2026-11-routed-findings.md) |
| `goals/agent-rating-critique-fixes` | 129 | [decision](../../../goals/agent-rating-critique-fixes/decisions/2026-11-07-research-intake-2026-11-routed-findings.md) |
| `goals/ontology-sidecar-stateless-identity` | 126 | [decision](../../../goals/ontology-sidecar-stateless-identity/decisions/2026-11-07-research-intake-2026-11-routed-findings.md) |
| `goals/verification-route` | 123 | [decision](../../../goals/verification-route/decisions/2026-11-07-research-intake-2026-11-routed-findings.md) |
| `goals/agentic-governance-laws` | 110 | [decision](../../../goals/agentic-governance-laws/decisions/2026-11-07-research-intake-2026-11-routed-findings.md) |
| `goals/execution-authority-slice` | 96 | [decision](../../../goals/execution-authority-slice/decisions/2026-11-07-research-intake-2026-11-routed-findings.md) |
| `goals/claim-check-performance` | 86 | [decision](../../../goals/claim-check-performance/decisions/2026-11-07-research-intake-2026-11-routed-findings.md) |
| `goals/agent-pool-doctrine` | 69 | [decision](../../../goals/agent-pool-doctrine/decisions/2026-11-07-research-intake-2026-11-routed-findings.md) |
| `goals/openclaw-workstation-agent` | 68 | [decision](../../../goals/openclaw-workstation-agent/decisions/2026-11-07-research-intake-2026-11-routed-findings.md) |
| `goals/effect-v4-workflow-engine-spike` | 62 | [decision](../../../goals/effect-v4-workflow-engine-spike/decisions/2026-11-07-research-intake-2026-11-routed-findings.md) |
| `goals/hybrid-retrieval-fusion-core` | 62 | [decision](../../../goals/hybrid-retrieval-fusion-core/decisions/2026-11-07-research-intake-2026-11-routed-findings.md) |
| `goals/model-arrangement-admission-core` | 56 | [decision](../../../goals/model-arrangement-admission-core/decisions/2026-11-07-research-intake-2026-11-routed-findings.md) |
| `goals/patent-drafting-episode-ledger` | 49 | [decision](../../../goals/patent-drafting-episode-ledger/decisions/2026-11-07-research-intake-2026-11-routed-findings.md) |
| `goals/harness-telemetry-enrollment` | 43 | [decision](../../../goals/harness-telemetry-enrollment/decisions/2026-11-07-research-intake-2026-11-routed-findings.md) |
| `goals/attributed-multi-claim-span` | 43 | [decision](../../../goals/attributed-multi-claim-span/decisions/2026-11-07-research-intake-2026-11-routed-findings.md) |
| `goals/folio-lynx-taxonomy-browse` | 40 | [decision](../../../goals/folio-lynx-taxonomy-browse/decisions/2026-11-07-research-intake-2026-11-routed-findings.md) |
