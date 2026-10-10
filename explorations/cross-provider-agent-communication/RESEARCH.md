# Research

2026-10-09. Recommendation based on current source, installed CLI interfaces,
primary vendor documentation, and earlier packet evidence. Detailed provenance
is in [SOURCES.md](research/SOURCES.md). The initial census below predates live
tests; the [executed spike](research/spike/README.md) is authoritative for measured
capabilities and overrides the earlier unknown cells.

## Recommendation

Implement a Beep-owned communication contract with replaceable delivery
adapters. Keep durable addressing, receipts, orchestrator role routing and Yeet
integration under repo control. Use the richest available provider interface
per session, retaining native extensions instead of reducing everything to a
single prompt/output abstraction.

The strongest adoption candidate remains Agent Relay. Its local-only broker and
published runtime class passed synthetic delivery/recovery fixtures. Native
provider probes now justify beginning the managed adapter layer independently;
Relay is an optional backend pending the remaining capability gates.
Its current managed native adapters are experimental, and its advertised attach
paths do not establish all four existing app integrations. The best supported
architecture is clear; a full backend comparison remains incomplete. See [Relay harnesses at the inspected revision](https://github.com/AgentWorkforce/relay/blob/5b30a69d7ac62190e89f8b1e13ccbd9a38a3a2db/packages/harnesses/README.md).

Prioritize these outcomes: direct peer conversation, busy-turn intervention,
idle wake, durable reconnect/replay, visible app continuity, cancellation,
streaming progress, artifacts, remote hosts and coordinator handoff. Ease of
installation and implementation size break ties after capability. The operator
explicitly selected both existing app sessions and Beep-launched agents.

## What earlier work already decided or disproved

| Prior work | Actual result | Consequence for this packet |
| --- | --- | --- |
| `fleet-coordination` → `fleet-mirror` | Derived fleet view shipped; push plus pull decided but delivery rung explicitly unimplemented | Reuse fleet facts; build the missing communication capability |
| `pr-event-awareness` → `yeet-pr-events` | Durable event capture shipped; detached socket delivery failed in W7 and idle-wake W8 was cut | Repeat busy and idle tests for every new route; never revive the cut design as proven |
| `orchestrator-handoff` | Register, role, handoff and exact-head merge gate work | Route messages through existing ownership facts; add delivery and role fencing |
| `cursor-agent-pool` | CLI delegation and admission investigated; old execution-path choices were scoped decisions | Re-evaluate ACP/SDK capability and record any route-policy amendment before production |
| `llm-provider-subscription-auth` | Auth and isolated-home foundations | Do not confuse authentication with an implemented conversation runtime |
| `agent-chat-interface` | Product chat and turn work, ACP binding deferred | Keep repo operations distinct from product chat |

Exact paths, line anchors, stale SPEC contradictions and supporting lineages are
in [prior-packets.md](research/prior-packets.md). Earlier rejection of Buzz and
interoperability protocols optimized a narrow collision-mirror problem. It does
not settle this broader request. No old packet is overwritten or marked complete.

## Provider capability comparison

Pre-spike interface census: D = primary documentation; H = installed help
observed; U = unverified at that census. These rows describe candidates. Measured
managed-runtime results are in the [spike matrix](research/spike/README.md).

| Runtime | Best candidate for existing sessions | Best managed-session interface | Busy/idle distinctions and unresolved coverage |
| --- | --- | --- | --- |
| Claude Code | Channels inject events into an enrolled open session (D); installed 2.1.295 help lacks the flag (H) | Official Agent SDK or persistent stream-json input (D/H) | Queued input is distinct from steering. Preview/auth/org activation required. Claude Desktop attach remains U |
| Codex | Shared-daemon `queue`, `agents`, `app-server proxy` in installed 0.162.0 (H) | App-server thread and turn APIs (D/H) | `turn/steer` targets the active turn; queue is follow-up. Desktop daemon ownership and permissions remain U |
| Grok Build | Shared leader/server attachment candidate (H); exact TUI/GUI bridge U | `grok agent stdio` ACP or server endpoint, installed 1.0.50 (H/D) | Upstream interjection supports attached-client events and late/idle handling; installed extension negotiation needs proof |
| Cursor | Persistent CLI attach (H); arbitrary IDE chat attach U | ACP in installed 2026.10.01-e373342 (H/D), SDK for stronger local steering (D) | SDK acknowledges active local delivery; detached/cloud handles fall back to follow-up. ACP alone does not promise steering |
| ChatGPT Desktop / Work / cloud-backed chat | Identify backing kind and app host first; app task tools are session-specific candidates, not a generic external control API | Separate from Codex CLI/app-server unless identity proves otherwise | Existing Desktop/Work local-executor and cloud chat routes remain U; ordinary ChatGPT web injection was not established. Do not count Codex success for these cells |

Sources: [Claude channels](https://code.claude.com/docs/en/channels),
[channels contract](https://code.claude.com/docs/en/channels-reference),
[Codex app-server](https://developers.openai.com/codex/app-server),
[Grok headless control](https://docs.x.ai/build/cli/headless-scripting),
[Cursor ACP](https://cursor.com/docs/cli/acp),
[Cursor SDK steering](https://cursor.com/docs/sdk/typescript).
Local command observations and finer limitations are in
[provider-interfaces.md](research/provider-interfaces.md).

The repo's app-level `send_message_to_thread` warning remains binding until
permission continuity is verified. A shared-daemon queue or proxy is a separate
candidate to test, not an assumed exemption. Peer text never widens authority.

## External options

| Option | Capability value | Fit / decision |
| --- | --- | --- |
| Native provider interfaces plus Beep router | Full native features, explicit session ownership, existing repo control | Recommended architecture; net-new broker semantics and app bridges |
| Agent Relay | Durable channels, DMs, threads, per-session delivery modes, receipts and managed sessions | Strongest adoption candidate; compare on the same probes and pin components |
| `cross-agent_mcp` | Concrete Claude/Codex/Grok IDE launch-shim patterns | Useful MIT reference; no proven Cursor integration or arbitrary desktop attach |
| `claude-relay` | WebSocket/MCP coordination, documented hook wake and delegate fallback | Reference-only: no license found in inspected root; fallback workers are distinct from existing visible sessions |
| MCP Agent Mail | Asynchronous inbox, thread and advisory reservation model | Not selected for adoption; current license has a restrictive rider, and inbox access alone does not establish wake or steer |
| ACP | Prompt/update, permissions, session lifecycle and cancel through a common coding-agent interface | Reuse existing driver; keep native extensions for richer control |
| A2A | Remote task/message streaming and task interoperability | Optional network boundary; it does not attach to desktop runtimes |
| Generic pub/sub or MCP tools alone | Transport, tool access, or durable queues | Insufficient without a verified session-delivery adapter |

[Agent Relay](https://agentrelay.com/docs/introduction) separates durable messages
from delivery into a runtime. Its [session capabilities](https://agentrelay.com/docs/session-capabilities)
are per instance, a useful model for this design. The inspected
[native adapter registry](https://github.com/AgentWorkforce/relay/blob/5b30a69d7ac62190e89f8b1e13ccbd9a38a3a2db/packages/harnesses/src/ai-sdk/adapter-registry.ts)
includes Claude and Codex but no Cursor/Grok native entries; its default Codex
model also differs from this repo's pin. Explicit overrides and observed route
identity would be required. PTY support is a useful compatibility path, but
inferred terminal activity cannot substitute for exact steering or tool events.

[Relay Connect](https://agentrelay.com/docs/relay-connect) claims existing
Claude/Codex conversation integration through a local probe and hosted Connect.
It changes Claude inbound settings during setup. This is a separate candidate
from managed workers and needs permission-continuity and same-session probes.
Do not run its installer over the live fleet as part of research.

[`cross-agent_mcp`](https://github.com/whooperlove/cross-agent_mcp/tree/ab67426fdd08c007a0c40f7b92228c5adce40010)
wraps configured IDE-launched processes. Its documented Claude/Grok bridges
queue around busy turns, and its Codex setting is marked development-only.
Its CLI-resume fallback must be labelled a separate execution mode. The repo is
MIT at the inspected revision; no code is copied here.

[`claude-relay`](https://github.com/gvorwaller/claude-relay/tree/1937dc802fd2baf9c8d4c52fabcc029912a700ac)
documents wake hooks and starts non-Claude delegates for some routes. These are
upstream claims, not successful local probes. No root license was found.

[MCP Agent Mail's inspected license](https://github.com/Dicklesworthstone/mcp_agent_mail/blob/2f487bdb1f1d2744707d1e9dba181f68b9162b38/LICENSE)
is not plain MIT: it includes an OpenAI/Anthropic rider. Record the license text
as a due-diligence finding and do not vendor, port or benchmark this candidate
under an assumed permissive license. No legal interpretation is needed to pick
the better-documented permissive alternatives for the spike.

[ACP](https://agentclientprotocol.com/protocol/v1/overview) controls coding-agent
sessions. [A2A](https://a2a-protocol.org/latest/specification/) supports remote
agent tasks. [MCP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
provides tool and transport contracts. These operate at different boundaries;
none grants a universal right or ability to interrupt a running app session.
Pin protocol revisions. Newer MCP SDK
[migration guidance](https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28)
changes notification/request behavior; existing repo transport support must be
checked independently. Claude channels are a host-specific contract.

## Existing implementation to compose

| Repo component | Reuse | Missing capability |
| --- | --- | --- |
| `@beep/acp` | Typed bidirectional NDJSON RPC, prompt/cancel/update and extension hooks | Durable receipts, replay and universal provider attach |
| `@beep/ai-provider-cli` | Auth checks and isolated provider homes | Prompt/run/stream service contract |
| Session ledger and orchestrator register | Ownership, role and orphan-plan facts | Endpoint enrollment, generation fence and transport liveness |
| Yeet inbox, PR registry and wave notifier | Durable quality-event capture, dedupe, ack and owner routing | General peer conversations and confirmed model delivery |
| Quality scheduler and RunScope | Admission and child lifetime | Message routing and provider turn ownership |
| MCP kit | Typed client framing and tool transport precedent | Durable agent identities and runtime wake contract |
| Packet event store | Immutable event and lock implementation precedent | A general delivery store; do not reuse packet lifecycle data as mail |

[Source inventory](research/repo-bricks.md) names implementation files and symbols.
The ACP pending-notification buffer is capped at 256, drops the oldest on
overflow, and is in memory. It is not the broker's durable queue. Eventlog,
message-storage and workflow driver names in architecture examples are not
implemented packages in this checkout.

## Selection and implementation strategy

1. Fix the observable message/receipt contract and compatibility matrix first.
2. Test existing-session attachment early, especially Codex shared daemon,
   Claude channels, Grok leader and Cursor IDE versus persistent CLI.
3. Run the same cases against Agent Relay. Adopt a component when it preserves
   more required capability; implement only missing behavior and Beep policy glue.
4. Keep native extensions and per-session capabilities in the contract regardless
   of backend, so a weaker adapter does not constrain stronger peers.
5. Integrate the current orchestrator, then expand network reach and attachments.

The [architecture](research/ARCHITECTURE.md), [probe plan](research/PROBE-PLAN.md)
and [candidate map](MAP.md) make this proposal concrete. The operator accepted
the brief and the authorized spike is complete within its tested scope. Native
managed routes and explicit policy assertions are the implementation starting
point. Existing-app attachment and production qualification remain open.

## Post-spike implementation decision

See [executed results](research/spike/README.md) for the complete matrix. Codex
passed five idle and five same-turn steering exchanges; Claude and Grok each
passed five idle and five queued busy exchanges. One controller-mediated
Codex/Grok round trip passed. Cursor initialization succeeded but generation
hit a plan-access barrier. A default Codex server restart widened the sandbox;
explicit server/resume/queue policy plus read-back passed the mitigation.

Build the provider capability/permission contract first, then the durable local
router and autonomous tools. Keep existing app enrollment as a parallel critical
path: managed success alone cannot finish the requested capability. The SQLite
contract fixture and Relay synthetic fixtures inform this design; neither is a
production implementation.


## Subsequent existing-app experiment

The authorized [visible-app proof](research/spike/APP-PROOF.md) passed an idle
Grok → already-open Claude web → same Grok session exchange, returning the final
acknowledgement to the app. Its conversation identity and transcript survived
reload. The controller used the visible browser UI; autonomous reply tools and
native Desktop attachment were not involved. A busy-send attempt timed out and
remained an unsent draft, so no busy capability is inferred.

This adds a browser-mediated conversation route alongside native adapters. Keep
its typed capabilities narrower: visible idle send/reply and observed persistence
only. Native APIs remain preferred for active steering and permission control.
Read-only installed-source discovery found the running Codex Desktop uses its
own bundled alpha.17.2 stdio app-server rather than the PATH CLI's shared daemon.
The process-only daemon opt-in is a future experiment, not a deployed route.
