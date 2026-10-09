# Architecture/reuse review

Reviewed 2026-10-09: `explorations/cross-provider-agent-communication` in the cross-provider-agent-comms lane. Read-only review of architecture, probe plan, brief, research, decisions, map and the source-backed reuse inventory. No implementation or provider run.

## Terminal re-review

Re-read the repaired exact `research/ARCHITECTURE.md` and `research/PROBE-PLAN.md` on 2026-10-09. **0 actionable findings.** Both initial P2 findings below are closed.

Role authority is now explicitly limited to communication control, existing ownership authorizes enrollment, mismatch enters reconciling, and durable handoff fences/projection/readback precede activation (`ARCHITECTURE.md:21-36`). Execution validates the epoch through the serialized executor and accepted in-flight control reaches a recorded outcome before successor activation. Fault probes cover partial writes, competing claims and in-flight actions (`PROBE-PLAN.md:55-60`).

Delivery now separates broker acceptance/retryable dispatch from conditional confirmed consumption, models ambiguous outcomes with recovery ownership and holds unsafe retries (`ARCHITECTURE.md:52-67`). Probes include a non-reconcilable adapter and distinguish logical receipts from repeated attempts and role messages from original-run replies (`PROBE-PLAN.md:51-60`).

These are reviewed design requirements and proposed probes, not implementation or runtime success claims.

## Initial findings (resolved)

### P2 — Specify the single role-handoff authority and crash reconciliation

Location: `research/ARCHITECTURE.md:14-19`; `research/PROBE-PLAN.md:50-51`.

The proposal reads current role ownership from the existing append-only ledger/register, then adds a distinct atomic generation-fenced communication lease. It does not specify which record wins when a crash leaves the ledger naming a successor while the communication epoch still belongs to the predecessor, or when the epoch commits before the ledger append. Atomic lease acquisition alone cannot make those separate writes atomic. Both views can independently appear current, producing misrouted pending role messages or authorizing predecessor control.

Requested repair: name one authoritative role epoch for communication control, define how it binds to the existing ledger owner and how disagreement yields a fail-closed/reconciling state, and require the adapter/control executor to validate that epoch at execution rather than only at enqueue. Preserve the existing ledger as fleet/orchestrator facts rather than quietly introducing a second independent orchestrator election. Add fault probes for crashes before and after each handoff write, competing claims, and an already-dispatched predecessor action crossing the handoff boundary.

### P2 — Scope the delivery guarantee around ambiguous provider consumption

Location: `research/ARCHITECTURE.md:35-45`; `research/PROBE-PLAN.md:20`, `:47-51`.

The contract says 'Provide at-least-once delivery' while also correctly refusing automatic repetition after unknown provider consumption. For a provider without readable history/receipts, parking an ambiguous attempt means eventual model delivery cannot be guaranteed. The probe matrix's 'Replay once per recipient' and handoff 'deliver ... once' can additionally be read as exactly-once provider consumption, despite the explicit disclaimer about side effects. `ambiguous` also is not represented in the listed delivery states.

Requested repair: state that the guarantee applies to durable broker acceptance and retryable dispatch, with confirmed context delivery conditional on adapter reconciliation capability. Model an explicit ambiguous/deferred-with-ambiguity reason, recovery owner and action. Change 'once' wording to one logical message/recipient receipt while allowing repeated transport attempts, and distinguish a role-addressed pending message that follows the successor from a direct session/run reply that remains addressed to the original run. Probe unknown-consumption on a deliberately non-reconcilable adapter, preserving the message without an unsafe retry or a false completion receipt.

## No additional findings

Package routing matches current architecture: operational contracts/services in tooling, concrete external wrappers in drivers, no unjustified shared/foundation runtime. Reuse inventory properly distinguishes ACP transport, provider auth/home support, Yeet remediation inbox, scheduler admission, packet events and product chat. It explicitly avoids claiming architecture-example driver names as implementation.

Capability breadth retains all requested provider families and both existing/managed modes, with unsupported/unknown cells visible. Native extensions, active steering versus queued follow-up, permission continuity, app ownership, quota/model pins, remote scope and attachment behavior are appropriately separated. Orchestrator launch/fallback authority and Yeet merge gates remain distinct from peer messaging. No new memory/index service is proposed.
