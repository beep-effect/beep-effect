# Implementation map

The operator graduated the two promised-now goals on 2026-10-09. The native
spike and controller-mediated Claude web/Grok proof are complete within their
reported bounds. They do not substitute for the acceptance gates below.

| Goal or candidate | State and mission | Dependency or re-entry gate | Reuse and new work |
| --- | --- | --- | --- |
| [agent-message-router](../../goals/agent-message-router/SPEC.md) | Active: local durable addressing, receipts, ordering, recovery and scoped direct delivery | Accepted spike contract | Existing Effect SQLite and CLI services; new delivery semantics, claims and receipt store |
| [agent-session-bridges](../../goals/agent-session-bridges/SPEC.md) | Authored: native owned runtimes and autonomous CLI/MCP messaging | Router schema and injected vertical slice pass | Existing ACP, provider auth discovery and MCP kit; new managed launch profiles and provider wire adapters |
| `agent-existing-session-enrollment` | Queued: native visible-app enrollment and continuity | A supported ownership/permission-safe app control route is available | Existing read-only app discovery; new identity bridge and same-visible-session tests |
| `agent-browser-session-bridge` | Queued: deployable opt-in browser bridge | Local router and managed bridge pass; production local browser control route selected | Controller-mediated Claude web proof; new deployed enrollment, assistant extraction, busy and recovery behavior |
| `orchestrator-live-coordination` | Queued: owner/role routing, reviews, reds and handoff | Two qualified bridges plus local recovery; existing register authority composed | Existing Yeet inbox and session register; new producer routing and fenced control dispatch |
| `agent-communication-federation` | Queued: remote-host routing, rich payloads and task interoperability | Local recovery and authority proof | Existing host boundaries where applicable; new authenticated gateway and optional A2A mapping |

## First production vertical slice

1. Real transactional store plus two injected endpoints prove acceptance,
   duplicate send, scoped reply, restart and ambiguous recovery.
2. Owned Codex and Grok sessions invoke message tools autonomously through that
   same store. The controller starts and observes; it does not copy peer replies.
3. Claude native managed idle/busy delivery is qualified. Cursor reports its
   observed access blocker accurately until the approved subscription route works.
4. Run package and hosted gates, then ship the bounded local capability.

Direct addresses are supported first. Role addresses remain distinct in the
contract but unsupported at dispatch until existing register authority and
handoff semantics are integrated. Existing web/native app attachment is a
separate family; none of the managed outcomes qualifies it.

## Deferred questions and reopening

Native Desktop permission continuity, autonomous browser replies and cross-host
delivery are explicitly deferred, with the gates above. A fired gate reopens
this packet at `decompose`. Cursor's paid access remedy remains an operator-only
money decision; other adapters can ship without it.

## Capability and evidence references

Use [repo inventory](research/repo-bricks.md), [architecture](research/ARCHITECTURE.md),
[native receipts](research/spike/README.md), [visible-app proof](research/spike/APP-PROOF.md),
and [probe specification](research/PROBE-PLAN.md). Proposed latency objectives
remain targets, not production measurements. Preview APIs, permission resets,
owner replacement, account switching and lost acknowledgements remain explicit
test risks. Agent Relay is optional reference material, not an adopted backend.
