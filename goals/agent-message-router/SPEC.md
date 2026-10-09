# Agent Message Router Spec

## Objective

Implement a local durable agent-message contract, transactional delivery store and routing service with per-session capabilities, policy fingerprints and explicit ambiguous recovery.

The operator authorized graduation and beginning router plus bridges on 2026-10-09.
The implementation promise is bounded to local managed communication and its
contract; existing app and federation gates retain their separate acceptance.

## Non-Goals

- Provider SDK/CLI implementations, browser automation or native Desktop attachment; those belong to the bridge goal or named gated follow-ups.
- Production orchestrator takeover, Yeet producer or merge-policy changes, provider fallback changes, remote federation and a new shared-memory service.
- Exactly-once model effects, universal real-time claims, a full Agent Relay backend or automatic settings/app-binary patches.
- General group/topic fan-out and rich artifact transfer in the first slice; retain extensible address/payload shapes and explicitly unsupported operations until their semantics are implemented.

## Source Hierarchy

1. The operator's accepted brief and instruction to graduate these goals and begin implementation.
2. `AGENTS.md`, required skills and governing architecture/package standards.
3. This `SPEC.md`, then `PLAN.md` and the compact `GOAL.md`.
4. Source exploration decisions, spike receipts and the inherited source ledger.

Higher sources outrank lower ones. Historical probes establish feasibility within their recorded boundaries, not production qualification.

## Target Surfaces

Repo-operational contracts/services and their CLI composition, transactional local state, injected endpoint ports, focused tests and this goal's evidence. Initial home is the existing tooling CLI or an earned tooling library after architecture admission. External runtime wrappers are excluded from this goal; the sibling owns them. Placement is recorded in [IMPLEMENTATION.md](../agent-message-router/research/IMPLEMENTATION.md).

## Constraints

- Activate schema-first-development and effect-first-development before implementation; use the local Effect reference and exported documentation rules.
- Run `bun run beep architecture` before adding concept/role files and `bun run beep create-package` for a genuinely necessary package. Topology is finalized by the owning architecture review before code lands; no generic foundation runtime is presumed.
- Compose the live ACP/auth, session/register, scheduler and MCP bricks cited in the source inventory. Do not turn packet lifecycle storage or Yeet remediation rows into a generic mailbox.
- Existing register/ledger facts authorize enrollment; communication epochs fence only message control. No new orchestrator election, merge authority, fallback chain or billing route.
- Preserve provider-specific features and per-session evidence. Unknown, blocked and unsupported are distinct; a successful socket write is not model consumption.
- Public reports redact account/session/host identifiers, secrets and absolute home paths. Private state has explicit ownership and restrictive permissions.
- Use existing authorized subscriptions and model pins. New paid endpoints, purchases, quota top-ups or plan changes require the operator.
- Preserve unrelated edits and processes. Disposable test workspaces belong under the Beep cache; raw transcripts never enter tracked packets.

## Acceptance Criteria

**Proposed state for merged `main`, [PR #1571](https://github.com/beep-effect/beep-effect/pull/1571).**
The lifecycle, phases and merge-conditional checklist items in this branch take
effect when this PR merges after its exact final head passes required hosted
checks, answered/resolved review threads and the 20-minute review window.
Execution remains open until then; the PR's live merge gate supplies the
completion evidence.

- [x] Schema-first identities distinguish participant, runtime/session, run/turn, repository/lane, app host/backend and role. Versioned envelopes carry stable message/conversation/reply IDs, bounded payload, requested mode and scoped sender/target identity.
- [x] Transactional local storage commits message acceptance and per-recipient attempt/receipt state atomically. Equal-ID/equal-content retries return the same logical acceptance; identity conflicts fail with typed errors.
- [x] Service and public operator entry points expose registration/discovery, send/reply, inbox/ack, subscriptions and delivery inspection; endpoint ports let the bridge goal compose real runtimes. Unsupported operations are explicit.
- [x] Per-session capabilities and enrolled model/effort/permission fingerprint are persisted with ownership/generation evidence. Effective mismatch fences inference; peer text cannot expand authority.
- [x] Queued recipients survive service restart. Consumption without acknowledgement becomes an owned `ambiguous` state with a next reconciliation action; a non-reconcilable route holds unsafe retry rather than duplicating model mutations.
- [x] Recipient/conversation ordering, bounded backpressure, delivery expiry, stable attempts and duplicate acknowledgement behavior are defined and tested against real store code.
- [x] Atomic claims prevent competing dispatcher ownership. Generation replacement rejects stale endpoint/control actions; role/direct addresses remain distinct without changing current orchestrator ownership policy.
- [x] First vertical slice uses two injected owned endpoints to prove request/reply correlation through the real router, including restart, duplicate send and a dropped acknowledgement. The sibling bridge goal must replace these fixtures with autonomous managed cross-provider send/reply before claiming the overall communication capability.
- [x] Real-store process-crash recovery and restrictive state/socket ownership pass; any power-loss durability claim has its own storage/fsync evidence. Migration/reversal preserves pending messages.
- [x] **Merge-conditional:** Touched packages pass package-verify; applicable lint/check/tests/docgen and exact-head hosted gates pass; every actionable review thread is answered/resolved.
- [x] **Merge-conditional:** Yeet drives the owning PR to mergeable and merger follows the existing gate; closeout/reflection and lifecycle updates land with final work. No unrelated refactors.

Functional checkboxes reflect the current real-store/transport fixtures and owned
managed live receipts. The current 44-case suite and autonomous bridge receipts qualify
the functional slice; [R1](research/FOLLOW-UPS.md) remains a deferred pre-existing P2
for inconsistent trusted-host enrollment, fenced before inference. State ownership
and stopped-writer reversal are proved; no new network socket or power-loss
durability claim is introduced. Full local package proof is achieved. Hosted/Yeet/closeout boxes declare only the
intended merged state and remain unfulfilled on this branch until the gate above.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet contract | `bun run beep goals doctor` and `bun run beep explore --check` | Valid manifest, provenance and launcher |
| Launcher bound | `test "$(wc -m < goals/agent-message-router/GOAL.md)" -le 4000` | Pass |
| Diff hygiene | `git diff --check -- goals/agent-message-router` | Pass |
| Touched package handoff | `bun run beep quality package-verify` with each exact touched package | Green required package audit/docgen, or precisely attributed inherited issue remediated at owner |
| Behavior | Focused contract/adapter tests and sanitized bounded integration receipts defined in PLAN | Observable acceptance without fixture/runtime conflation |
| Hosted gate | Yeet publish/ready/monitor and immediate thread reread | Exact final head mergeable under current rules |
| Reflection | `bun run beep lint reflection-artifacts` at P4 | Valid dated final reflection |

## Stop Conditions

- New money, services, quota top-ups or plan changes require the operator.
- A provider or app route changes ownership/permissions unexpectedly: stop that route before inference and record its receipt; continue independent work.
- The same external blocker persists after bounded investigation: record exact evidence and recovery owner; do not change providers to evade a failed test.
- Missing required source or irreconcilable scope/topology facts must be resolved before dependent edits. Routine design choices are recorded and carried forward under the existing autonomy charter.

## Decision Log

| Date | Decision | Reason | Reversal |
| --- | --- | --- | --- |
| 2026-10-09 | Graduate the local router and native managed bridges now | Operator selected implementation; native managed edges have bounded receipt evidence | Disable new enrollment/service; retain/export pending messages |
| 2026-10-09 | Durable acceptance with explicit ambiguous recovery; no exactly-once effects | Provider consumption and acknowledgement can separate across crash | Hold affected dispatch mode and reconcile original attempts |
| 2026-10-09 | Explicit model/permission fingerprint before inference | Default Codex server restart widened sandbox in the recorded probe | Disable resume/queue for affected adapter without discarding mail |
| 2026-10-09 | Keep browser/native Desktop/federation as named gated follow-ups | Browser/manual and CLI fixtures establish different evidence modes | Reopen exploration at decompose when a named gate fires |
| 2026-10-09 | Preserve current orchestrator, launch/fallback and merge policy | Message delivery is not authority transfer | Stop bridge/router while retaining existing register/Yeet workflows |
| 2026-10-09 | Refresh only reviewed agent-messaging cache baseline subjects through `beep cache baseline --request` | Intentional ACP/provider/MCP imports and six added policy-fingerprint inputs change the graph; cache flags, qualification scope and ledger remain unchanged | Revert the generated baseline/request/review with the owned dependency and Turbo changes, then rerun cache audit; never hide graph drift with an old baseline |

| 2026-10-09 | Carry prospective merged-state lifecycle, phases and reflection in PR #1571 | Same-PR packet-state law requires closeout artifacts with final implementation; local full proofs passed, while final hosted checks/review/window and merge remain conditional | Before merge retain external open status; if publication/gate fails restore active manifest/phase values without discarding receipts; never infer merge from local projection |

Primary dated decisions and rejected alternatives remain in the [source log](../../explorations/cross-provider-agent-communication/DECISIONS.md).

## Exception Ledger

The owning implementation records reviewed Effect Vitest resource judgments in
`standards/effect-vitest.inventory.jsonc`: real private filesystem/process
services, dynamic per-path SQLite and per-grant MCP layers, and the shorter writer
scope needed for stopped-writer backup. Assertions use the canonical helpers.
These entries preserve the tested lifetime and authority boundaries; they do not
waive failing behavior. Revisit each entry if the fixture stops exercising that
boundary or the detector learns the dynamic layer provenance.
