# Useful agent outcomes and Phoenix experiments — specification

## Objective

Turn qualified telemetry into understandable task outcomes, calibrated annotations and repeatable experiments that improve harness experience and accepted work.

## Source hierarchy

User decisions and AGENTS.md govern; then architecture standards, this SPEC, PLAN, GOAL and research evidence. [Adopted brief](../../explorations/agent-observability-rebuild/BRIEF.md) and [decisions](../../explorations/agent-observability-rebuild/DECISIONS.md) are design provenance. Do not treat audit observations as immutable live state.

## Target surfaces

- packages/tooling/library/ai-metrics/agent-effectiveness and CLI reports
- packages/drivers/phoenix API boundaries
- existing goals/agent-effectiveness-loop contracts, reconciled with this exploration
- Phoenix annotation/dataset/experiment objects through explicit versioned manifests after proof

## Scope and constraints

This packet is paused until explicitly launched. Preserve unrelated local work, existing source identities, the masked collector recovery hold and historical archives. Metadata plus curated sanitized examples is the approved collection boundary. Use schema-first Effect code, existing drivers/tooling and architecture observability conventions. Source changes and deployments must have owned tests and rollback. Existing subscriptions only; no new paid endpoints, quota purchases or automatic broad judge runs. Do not revive retired OpenClaw.

Do not infer that an enum, installed app, green service, transport acknowledgment, query result or canary proves every activity source was captured. Unknown and intentionally excluded populations remain explicit. Keep code fixtures synthetic and disposable; do not use real prompts or secrets to make tests convenient.

## Non-goals

- Big-bang replacement, indiscriminate raw transcript collection, or immediate mass backfill.
- New generic tracing UI, one Phoenix project per worktree, or universal productivity scores.
- Claiming deployment or goal completion from packet authoring or local tests alone.
- Deleting user data, removing recovery material or changing protected credentials as a shortcut.

## Acceptance criteria

- [ ] Reconcile existing agent-effectiveness-loop concepts before adding new task/outcome schemas; retain one authoritative task ledger with versioned links to spans/traces/sessions.
- [ ] Expose useful task labels, status, validation, acceptance, rework, interventions and evidence completeness; distinguish facts, deterministic verdicts and human judgments.
- [ ] Define at least five typed rubric dimensions with annotator and version: acceptance, validation, rework, intervention/friction and collection completeness. Missing judgments stay unknown.
- [ ] Verify Phoenix20.23.0 annotation target/upsert semantics. Multi-session task outcomes remain authoritative in the task ledger and have explicit projection links.
- [ ] Create five reviewed sanitized starter examples covering navigation, diagnosis, focused implementation, review and recovery; expand to10–20 only after pilot calibration.
- [ ] Pin dataset version, repo starting revision, task/fixture version, harness/surface, declared and observed model identity, effort, tools, environment and cache treatment.
- [ ] Implement deterministic evaluator fixtures for patch applicability/behavior/gates and preserve human acceptance; validate evaluator failures and ambiguous cases before automated conclusions.
- [ ] Run one bounded matched baseline/change experiment only for qualified participant routes. Use repetitions, counterbalanced order and explicit resource/concurrency budgets; retain failures, abandonment and timeouts.
- [ ] Report paired quality/time/rework differences and uncertainty; do not present a universal provider ranking or causal conclusion from unmatched production observations.
- [ ] Keep elapsed time distinct from summed parallel work and blocked/model/tool time; calculate critical path only with adequate intervals/lineage.
- [ ] Keep API-equivalent price estimates, subscription allocation and invoiced spend distinct; missing usage/pricing is not zero cost.
- [ ] Use native Phoenix sessions, annotations, datasets, experiments and dashboards before adding a minimal coverage/task report; user can move from a finding to its evidence.
- [ ] Route synthetic health checks explicitly; document project ownership. Remove default or beep-agent-effectiveness only if writers are migrated/superseded, data protected, references updated and deletion verified.
- [ ] Preserve metadata plus curated-example privacy policy, separate retention for outcomes/datasets versus short trace retention, and expiration-aware evidence links. No blanket raw transcript import or new paid judge endpoint.

## Dependencies

goals/agent-observability-foundation, goals/harness-telemetry-enrollment

For downstream work, only already-qualified routes may be used. Design/calibration fixtures can progress before full fleet enrollment; real comparisons cannot imply unqualified coverage.

## Verification matrix

| Gate | Evidence | Required result |
| --- | --- | --- |
| Packet | JSON, links, launcher <=4000 chars, no placeholders | Pass |
| Domain proof | Typed rubric/evaluator fixture tests; Phoenix version-specific API tests in disposable backend; curated-example privacy review; five-example pilot report; paired experiment manifest/results; user-facing interpretation review and touched-package quality checks. | Assigned acceptance demonstrated |
| Privacy | Allowlisted metadata/curated-example review and rejected-field fixtures | No raw content or secret leakage |
| Deployment | Render parity, bounded route canary, read-back, resource ceilings and rollback | Evidence identifies actual routes and receipt boundary |
| Repository quality | Required touched-package verification and Yeet/hosted gates | Current repo policy satisfied |
| Closeout | Final delivery PR readiness/merge evidence and reflection | Only then completed-retained |

## Stop/hold conditions

Missing source access remains an explicit coverage gap; do independent synthetic/design work. Hold dependent rollout on unproven integrity, identity, privacy or resource bounds. Uncertain mutation outcomes must be inspected before replay. New spend requires the operator. Preserve interrupted work and record concrete blockers; do not weaken authentication or data boundaries.

## Decision log

| Date | Decision | Reason | Reversal |
| --- | --- | --- | --- |
| 2026-10-27 | Prepare paused implementation packet | Operator adopted exploration direction and asked for packets, not execution | Revise packet before launch |
| 2026-10-27 | Inherit metadata/curated-example policy | Operator decision D1 | Only explicit policy revision |
| 2026-10-27 | Preserve live state until bounded proof and rollout | Confirmed held collector and incomplete semantics | Revert owned configuration to captured baseline with validated data compatibility |

## Exception ledger

None. Deferred implementation details must be decided with evidence and recorded here, not treated as permission to omit acceptance.
