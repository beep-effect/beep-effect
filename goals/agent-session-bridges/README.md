# Agent Session Bridges

## Status

Lifecycle: `active`

**Active attached-T3 extension, [PR #1571](https://github.com/beep-effect/beep-effect/pull/1571).**
The operator authorized integration after the T3-owned host qualification.
The earlier prospective closeout is superseded for this expanded scope. Managed
proofs remain historical evidence. T3 implementation and bounded forward/reverse
audit proof passed; full final verification and exact final-head hosted/review/window/merge gates are open. The PR returned to draft for this work.

Source: [ops/manifest.json](ops/manifest.json).

## Mission

Compose managed and attached T3-owned sessions with the durable router and scoped messaging, proving bounded repository task delegation without global role takeover.

## Launch

```text
/goal follow the instructions in goals/agent-session-bridges/GOAL.md
```

`GOAL.md` is the compact launcher; `SPEC.md` is normative.

## Read This First

1. [Spec](SPEC.md), [plan](PLAN.md), [launcher](GOAL.md) and [manifest](ops/manifest.json).
2. [Inherited source ledger](research/SOURCES.md); primary [exploration ledger](../../explorations/cross-provider-agent-communication/research/SOURCES.md).
3. [Accepted brief](../../explorations/cross-provider-agent-communication/BRIEF.md), [decisions](../../explorations/cross-provider-agent-communication/DECISIONS.md) and [executed spike](../../explorations/cross-provider-agent-communication/research/spike/README.md).
4. [Architecture proposal](../../explorations/cross-provider-agent-communication/research/ARCHITECTURE.md) and [live source inventory](../../explorations/cross-provider-agent-communication/research/repo-bricks.md).

## Current Phase

P1 implementation and bounded attached T3 task proof are complete. P2 final verification is ongoing; P3 hosted readiness and P4 closeout remain pending. The active lifecycle does not claim merge or global orchestrator authority.

First slice: Prove autonomous scoped send/reply between owned native Codex and Grok through the actual durable router; qualify Claude separately and retain Cursor access classification.

## Managed foundation evidence (historical snapshots)

The foundation router snapshot passed **44 tests** (23 store and 21 schema/tool/private
filesystem cases); the explicit CLI test project type-checks. Independent review
of the store extraction found no introduced regression and confirmed one
pre-existing P2, tracked as [R1](../agent-message-router/research/FOLLOW-UPS.md): contradictory trusted-host
provider metadata can consume send quota before the dispatcher fences it. The
latest store review therefore retains one deferred P2. Canonical quick CLI checks
pass. All three touched packages passed full audit/docgen; CLI full audit took
745.2 seconds and docgen 23.9 seconds. Hosted gates remain separate.

The actual owned Codex↔Grok autonomous exchange passed in **39.91 seconds**:
three logical messages (seed, request and correlated reply) were acknowledged,
all native dispatches settled, and each provider used exactly one persisted grant
message. The controller did not forward replies. Source and native executable
digests stayed unchanged, and owned leaders/process groups were stopped. See the
[sanitized receipt](research/GROK-MANAGED-ROUNDTRIP.json) and
[native qualification](research/NATIVE-QUALIFICATION.md). The receipt does not
qualify busy delivery, built-in tool denial or existing application enrollment.

The corrected owned Codex↔Claude run also passed, in **56.2 seconds including
setup and cleanup**. Its two-message queued-busy exercise accepted the second
message while the primer was acknowledged and its native dispatch remained
active; both messages later acknowledged and settled with no send-grant use.
The same sessions then autonomously exchanged the three-message seed/request/
reply flow. All five messages acknowledged and settled, each provider used one
send grant, source/executable digests stayed unchanged and owned groups stopped.
See the [Claude receipt](research/CLAUDE-MANAGED-ROUNDTRIP.json).

Native transport has **19 passing synthetic cases**. The earlier independent
review ended with zero findings; the final three-file Claude launch correction
also received an independent zero actionable introduced findings review. The provider full audit/docgen
passed after correction. Cursor generation remains access blocked. The
[Claude patch review](research/CLAUDE-PATCH-REVIEW.md) retains exact three-file hashes and scope.

Yeet published initial draft [PR #1571](https://github.com/beep-effect/beep-effect/pull/1571) from implementation source commit
`1565951a24da16aed9e238fde55ca7250fe9c7d2` after all 16 cheap gates and the clean-head install passed. These local
and publication facts do not establish the final head's hosted gate or merge.
The final packet wave must pass its own required checks and review window.

See [implementation progress](../agent-message-router/research/PROGRESS.md), the [approved topology](../agent-message-router/research/IMPLEMENTATION.md), and the
[agent messaging runbook](../../docs/runbooks/agent-messaging.md).

The [final reflection](history/reflections/2026-10-09-codex.md) records local
outcomes and the prospective merged-state boundary; hosted/merge evidence remains
the orchestrator’s external closeout responsibility until verified.

Local full proof binds the qualified implementation snapshot published at
`1565951a24da16aed9e238fde55ca7250fe9c7d2`. Advancing-base integration and the final
packet commit retain their own exact-head hosted/review gate; earlier local proof
is not automatically promoted to the integrated final head.

## Gated follow-ups

The [policy and portability repair receipt](../agent-message-router/research/POLICY-AND-PORTABILITY-REPAIR.md)
records the later root-policy fixes and real Node/Bun SQLite regression proof.
Original live provider receipts remain bound to their captured source snapshots.

T3-owned enrollment is admitted above. `agent-existing-session-enrollment` remains queued for separate native app enrollment,
UI continuity and permission proof; `agent-browser-session-bridge` remains queued for
a production local browser driver and unattended authenticated enrollment;
`agent-communication-federation` remains gated on local recovery and authority proof.
These named candidates stay in the exploration map, not falsely completed by this goal.

## Closeout

Drive the implementation PR through Yeet to mergeable under current exact-head
checks/review/window rules. Land scoped lifecycle/reflection updates with final
work in the same PR, effective only upon the exact final-head gate and merge;
then merge at the existing gate and retire the lane.

## Current next action: final qualification gates

The [current T3 receipt](research/T3-INTEGRATION-QUALIFICATION.json) records the
hardened forward/reverse AGENTS.md audits: four ACKed/settled messages at attempt
one, each persisted grant used twice, and seven completed same-identity native
runs per provider including prime and earlier exercises. At that historical receipt, both providers were idle
with no nonterminal runs. The inbound scope guard passed independent review and
nine regression cases. Both bridges are stopped, external credentials were
revoked/re-probed401, peer grants invalidated and register units retired as
metadata; the app/conversations remain. The no-tool prime remains negative scope
evidence in the [initial receipt](research/T3-INTEGRATION-INITIAL-QUALIFICATION.json).

Full repository docgen and final CLI package verification passed. The cohesion
refactor and final header-helper repair passed their focused tests and independent
reviews; captured live hashes remain separate from later source verification.
Final cheap gates passed 15 lanes and failed only the inherited main EV015.
See [final local verification](research/T3-LOCAL-VERIFICATION.md). Publication,
main repair 6513e85d2c is integrated at 5868dc8218; the post-integration cheap
gate completed with 14 pass/two inherited reds; exact-head hosted gates remain pending.
[Cache posture review](research/T3-CACHE-REVIEW.md) qualifies bookkeeping only.
Separate Claude/ChatGPT Desktop adapters, always-on operation, OS isolation and
global orchestrator authority remain unqualified.

The later [refactor reconciliation](research/T3-REFACTOR-RECONCILIATION.json)
records four h3 ACKs and both coordinator reports, with only the forward pair
settled. After restoring the original host profile, Codex run ten completed and
Claude run ten was cancelled; neither remains active. Canonical recovery holds
both reverse claims ambiguous. Both external credentials re-probed HTTP401;
bridges were absent and not restarted, and immutable peer grants remain behind
the ambiguity fences. No resend occurred. This partial refactor exercise does
not replace the earlier complete hardened proof or finish final goal gates.

The [scoped T3 reflection](history/reflections/2026-10-09-codex-t3.md) is prepared
for same-PR closeout. The manifest remains active until the final local gate and
publication wave are established; prospective completion takes effect only
through the exact-head hosted/review/merge gate.

The [post-integration attribution](research/T3-POST-INTEGRATION-GATES.md) records
14 passing cheap lanes and two inherited shared-main reds: Accounts schema-first
from PR #1583 and PracticeKg EV002 fingerprint drift from PR #1593. The golden
EV015 is fixed. Publication may use the explicitly inherited-fence
fallback if Yeet refuses only these two lanes; this does not grant merge readiness.
