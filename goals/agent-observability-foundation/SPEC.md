# Trustworthy agent observability foundation — specification

## Objective

Prove metadata identity, coverage and bounded durable delivery across roots and surfaces before live enrollment.

## Source hierarchy

User decisions and AGENTS.md govern; then architecture standards, this SPEC, PLAN, GOAL and research evidence. [Adopted brief](../../explorations/agent-observability-rebuild/BRIEF.md) and [decisions](../../explorations/agent-observability-rebuild/DECISIONS.md) are design provenance. Do not treat audit observations as immutable live state.

## Target surfaces

- packages/tooling/library/ai-metrics
- packages/tooling/tool/cli AI metrics and hook evidence integration
- packages/drivers/phoenix where the existing driver needs bounded query support
- dankserver monitoring/Phoenix Ansible and tests, with owned deployment parity

## Scope and constraints

This packet is paused until explicitly launched. Preserve unrelated local work, existing source identities, the masked collector recovery hold and historical archives. Metadata plus curated sanitized examples is the approved collection boundary. Use schema-first Effect code, existing drivers/tooling and architecture observability conventions. Source changes and deployments must have owned tests and rollback. Existing subscriptions only; no new paid endpoints, quota purchases or automatic broad judge runs. Do not revive retired OpenClaw.

Do not infer that an enum, installed app, green service, transport acknowledgment, query result or canary proves every activity source was captured. Unknown and intentionally excluded populations remain explicit. Keep code fixtures synthetic and disposable; do not use real prompts or secrets to make tests convenient.

## Non-goals

- Big-bang replacement, indiscriminate raw transcript collection, or immediate mass backfill.
- New generic tracing UI, one Phoenix project per worktree, or universal productivity scores.
- Claiming deployment or goal completion from packet authoring or local tests alone.
- Deleting user data, removing recovery material or changing protected credentials as a shortcut.

## Acceptance criteria

- [ ] Publish a typed host/root/route inventory with separate capability, known-launch and expected-event denominators; unsupported/excluded/idle/stale/failed/unknown states are distinct.
- [ ] Preserve repository, clone, worktree, source session, task, attempt and event-occurrence identity separately; global Codex inputs never inherit the ingestion checkout as asserted source identity.
- [ ] Prove fair incremental discovery for N+1 sources, rotation/truncation, partial lines, copied files, oversized growth, retired worktrees and permission errors with synthetic fixtures.
- [ ] Prove event-time preservation and absence of invented durations through actual encoded OTLP, including historical replay and mixed timestamp offsets.
- [ ] Prove a bounded metadata-only native intake and journal; document the exact upstream acknowledgment boundary and pre-intake loss window.
- [ ] Derive one mutually exclusive delivery state per event from append-only receipt facts; test partial success, lost acknowledgment, crash-after-acceptance, restart, duplicate send, queue exhaustion and reclamation.
- [ ] Normalize Claude/native usage into Phoenix fields with a provider-specific cache fixture; reconcile encoded records, stored queries and UI/API totals without double counting.
- [ ] Preserve deployed transform/prom-label-collisions in dankserver source; qualify the rendered configuration before applying any deployment.
- [ ] Provide owned persistent queue bounds and health signals for lag, refusal, failed delivery, disk pressure, missing sources and missing collector self-metrics; distinguish healthy idle from stopped collection.
- [ ] Fix health-check path and backup/retention reporting weaknesses with synthetic tests; verify exact policy identity and project assignment, not the first policy returned.
- [ ] Keep the historical recovery hold intact until its resource-integrity investigation and bounded replacement proof support release; no blind restoration of old units.
- [ ] Qualify one declared host/repo with one CLI and one desktop-marked fixture against a disposable backend, then a tightly bounded canary/live route with rollback. Never claim every real session was captured.
- [ ] Record privacy/retention/dead-letter ownership, old-ID compatibility, project producers and a tested rollback. Preserve historical raw archives without reingesting them by default.

## Dependencies

Source exploration only.

For downstream work, only already-qualified routes may be used. Design/calibration fixtures can progress before full fleet enrollment; real comparisons cannot imply unqualified coverage.

## Verification matrix

| Gate | Evidence | Required result |
| --- | --- | --- |
| Packet | JSON, links, launcher <=4000 chars, no placeholders | Pass |
| Domain proof | Synthetic source/identity tests; fixed-clock actual-encoder fixture; receiver/journal/partial-ack crash tests; disposable collector/Phoenix read-back; Ansible render and backup/retention mocks; touched-package quality verification. No production disruption as a test. | Assigned acceptance demonstrated |
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
