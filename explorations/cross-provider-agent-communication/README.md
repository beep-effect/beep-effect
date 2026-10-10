# Cross-provider agent communication

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [ops/manifest.json](ops/manifest.json)

## Spark

The operator wants Grok, Claude, ChatGPT/Codex and Cursor agents to communicate
in real time under the new orchestrator and PR workflow. Capability has priority.
The confirmed scope includes existing app sessions and Beep-launched agents.

## Recommendation

Implement Beep's durable routing and authority contract with native session
adapters. The authorized spike proved managed Codex active steering, Claude/Grok
queued delivery, and a Codex → Grok → Codex round trip. Codex restart requires
explicit permission pinning and verification. Cursor hit an existing-plan access
barrier. Agent Relay remains an optional component candidate after local fixtures;
its full backend and existing-app routes are unqualified.

Start with the [executed spike and receipts](research/spike/README.md) and the
[subsequent visible-app proof](research/spike/APP-PROOF.md). One already-open
Claude web conversation exchanged a request/reply/acknowledgement with a managed
Grok session through the visible UI; the same conversation survived reload.
Busy browser delivery failed to submit and remains unqualified.
The remaining uncertainty is reliable native/app-wide enrollment and autonomous
reply tools. The browser proof qualifies only Claude web idle conversation. A
new CLI worker, resumed history or socket write cannot qualify another app. The earlier
fleet packet left push/pull delivery unimplemented; later PR-event probes cut
idle wake after every detached sender failed.

The later [T3-owned desktop-host qualification](research/T3CODE-QUALIFICATION.md)
proved autonomous Claude/Codex exchanges in both directions, active steering,
consumed queued replies and permission continuity through supported T3 detach and
reattach. This is a qualified alternative host; external native-app attachment
and a production Beep-to-T3 adapter remain separate gates.

## Implementation handoff

Graduated to [Agent Message Router](../../goals/agent-message-router/README.md)
and [Agent Session Bridges](../../goals/agent-session-bridges/README.md).
The first builds durable scoped direct delivery; the second composes native
managed sessions and autonomous send/reply tools. Deferred app and federation
gates remain explicit in [MAP.md](MAP.md). No alignment question blocks these goals.

## Read This First

1. [Research and recommendation](RESEARCH.md).
2. [Earlier packets and their actual outcomes](research/prior-packets.md).
3. [Provider interface evidence](research/provider-interfaces.md).
4. [Reusable repo code](research/repo-bricks.md).
5. [Proposed architecture contract](research/ARCHITECTURE.md).
6. [Live capability probe plan](research/PROBE-PLAN.md).
7. [Decisions](DECISIONS.md), [brief](BRIEF.md), and [candidate goals](MAP.md).
8. [Source and license ledger](research/SOURCES.md).
9. [Executed capability spike](research/spike/README.md).

## Validation

[Validation receipt](research/VALIDATION.md): Atlas and manifest checks pass;
local links resolve; lineage, provider and architecture reviews report zero
actionable findings.

## Evidence boundary

Research inspected checkout `d1e8350670f87c7fa2d744f87c8cdbf99ad1852f`, installed
CLI help and current primary documentation on 2026-10-09. The accepted brief
led to disposable managed-provider experiments and synthetic recovery fixtures.
Claude web idle delivery and reload passed through a controller-mediated UI
bridge. Later managed implementation and T3 receipts qualify their named autonomous
reply modes. Other native app attachment remains unverified. The packet graduated
on 2026-10-09; old packet states are preserved. PR #1571 contains the implementation;
the latest local correction and T3 qualification await publication.

## Trail

- 2026-10-09: Operator authorized graduation and implementation. Both promised-now
  goals exist with source provenance; app, browser, role and federation gates
  remain queued. The implementation lane merged origin/main at `7febc0287b`.

- 2026-10-09: Claude web enrollment, managed Grok reply/acknowledgement and
  same-conversation reload passed. Busy browser send remained unsent. Current
  Codex Desktop was identified as a separate bundled stdio runtime. Returned
  to alignment with native and browser capabilities kept distinct.

- 2026-10-09: Operator authorized disposable existing-app enrollment and reply
  proof. Returned to research; visible Claude web enrollment started, and Codex
  app/daemon ownership discovery is read-only.

- 2026-10-09: Authorized spike completed with passing, blocked and unknown cells.
  Native managed adapters selected for the next implementation slice; existing
  app enrollment remains the acceptance frontier. Returned to alignment.

- 2026-10-09: Operator accepted the brief and authorized the capability spike.
  Returned to research for disposable protocol and model-delivery experiments.

- 2026-10-09: Prior packet lineage, source inventory, installed-interface census
  and external comparison complete. Operator confirmed both session modes.
  Recommendation and probe contract written; alignment remains open.
- 2026-10-09: Packet opened from the exploration template in an isolated lane.

## Next Open Question

No blocking admission question remains. Implement the approved attached T3 slice in the bridge goal; qualify the policy-race boundary and real delegated audit before marking it achieved.

- 2026-10-09: T3 enrollment gate fired; reopened at decompose and admitted the bridge extension. New driver, attached-host composition and scoped peer CLI are approved; global role handoff remains deferred.

- 2026-10-09: Re-graduated the admitted T3 slice into the active bridge goal. Thin external driver, attach-t3 and scoped peer CLI have explicit acceptance and policy limits; store-owner admission review has zero blockers. Provider-owner separate admission review also reports zero blockers; implementation/task proof remains pending.
