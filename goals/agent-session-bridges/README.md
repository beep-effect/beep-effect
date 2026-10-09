# Agent Session Bridges

## Status

Lifecycle: `completed-retained`

**Proposed state for merged `main`, [PR #1571](https://github.com/beep-effect/beep-effect/pull/1571).**
The lifecycle, phases and merge-conditional checklist items in this branch take
effect when this PR merges after its exact final head passes required hosted
checks, answered/resolved review threads and the 20-minute review window.
Execution remains open until then; the PR's live merge gate supplies the
completion evidence.

Source: [ops/manifest.json](ops/manifest.json).

## Mission

Compose the local router with owned native Codex, Claude and Grok sessions and CLI/MCP send/reply tools, preserving policy, capability, lifecycle and app-mode evidence.

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

Local implementation and verification are complete. The phase values describe
intended merged state; PR #1571 still requires exact final-head hosted review and
merge. External execution remains open until that gate and post-merge closeout.

First slice: Prove autonomous scoped send/reply between owned native Codex and Grok through the actual durable router; qualify Claude separately and retain Cursor access classification.

## Latest Evidence

The current router suite passes **44 tests** (23 store and 21 schema/tool/private
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

`agent-existing-session-enrollment` remains queued for exact native app/host enrollment,
UI continuity and permission proof; `agent-browser-session-bridge` remains queued for
a production local browser driver and unattended authenticated enrollment;
`agent-communication-federation` remains gated on local recovery and authority proof.
These named candidates stay in the exploration map, not falsely completed by this goal.

## Closeout

Drive the implementation PR through Yeet to mergeable under current exact-head
checks/review/window rules, merge at the existing gate, then apply this prospective declaration
and retire the lane. Same-PR final lifecycle/reflection updates are required.
