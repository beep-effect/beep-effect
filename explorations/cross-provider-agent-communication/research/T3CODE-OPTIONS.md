# T3 Code as a visible agent host

Research date: 2026-10-09. Read-only source and official documentation inspection; no installation, provider inference, authentication change, or live-session attachment.

## Recommendation

T3 Code is a strong candidate **if the operator accepts running the visible Claude and Codex coding conversations inside T3 Code**. It already owns the provider processes, visible thread UI, authenticated messaging tools, queue/steer distinctions, and durable orchestration projections needed for an agent host. Prefer its existing MCP boundary over recreating its internal control plane.

It is **not established as a bridge into already-open Claude Code Desktop or Codex Desktop conversations**. The inspected Claude SDK and Codex app-server adapters create/manage their own runtime resources. Native continuation IDs and shared provider homes support T3 continuation; they do not demonstrate attaching to another application's active process, preserving that application's permissions, or showing injected turns in that application's conversation. An external Claude/Codex agent can control T3 threads through OAuth MCP, but that is a directional control relationship, not enrollment of the external application's own conversation as a T3 endpoint.

Keep the requested native Desktop attachment investigation separate. T3 is an alternative host with substantially more existing orchestration functionality, not a proven substitute for the exact existing-session requirement.

## Provenance and freshness

The existing `.repos/t3code` reference was clean at commit `101f8b2f55df50d4f8d70ed8e6b8e0edf71a2f31`, committed 2026-10-09. No reference refresh occurred. The official main branch was `454b94a13aea918f27bb060d8d054d4cfb791bc2` at the read-only GitHub check, later on the same date. Source assertions below bind to the local reference commit; current official documentation was checked separately. This is research qualification, not an executed T3 integration proof.

The local `t3` command was absent from PATH and the bounded process-name check found no T3-named process. A later targeted artifact check found the existing `t3code` launcher, source-built AppImage, desktop entries, and updater unit. Its installed source stamp is `365aa87982a4d81cc8e0c085e8d1a40ca7daecdc`, which differs from the October 9 reference used for this assessment. Reuse and qualify that installed build before deciding whether an update is needed. No app was launched or configuration changed, and no T3 UI inventory was obtained, so existing visible T3 sessions and the installed build's messaging capabilities are **not verified**. No user transcript or provider session directory was inspected.

## Existing control surface

| Capability | Exact source at the inspected commit | Meaning and limit |
| --- | --- | --- |
| Visible thread addressing and reads | `apps/server/src/mcp/toolkits/orchestrator/tools.ts`: thread list/read tools, send at line 220, wait at 233, interrupt at 247 | Addresses T3 thread records in the connected environment. Wait reports durable terminal status; it does not itself prove context consumption. |
| Idle wake and busy routing | `apps/server/src/orchestration-v2/ThreadManagementService.ts:589`; `apps/server/src/mcp/OrchestratorMcpService.ts:2377` | `auto` selects active steering when a turn is steerable, otherwise immediate-start intent; orchestration may queue behind a not-yet-steerable turn. Explicit `queue`, `steer`, and `restart` distinguish follow-up, active update, and interruption/restart. Send uses stable client-request-derived command/message identities. |
| Peer reply path | `apps/server/src/mcp/toolkits/orchestrator/tools.ts:220` | A T3-owned agent can call `t3_thread_send` back to an authorized T3 thread. A two-provider visible conversation exchange is plausible from implemented tools but was not run in this inspection. Arbitrary message acceptance is not proof of an autonomous reply. |
| Child completion wake | `apps/server/src/mcp/toolkits/orchestrator/tools.ts:64` | `delegate_task` requires a live T3 parent and creates T3-owned children. The documented completion path notifies the parent, steering where supported and otherwise queueing. This is distinct from messaging unrelated native Desktop sessions. |
| New visible conversation | `apps/server/src/mcp/toolkits/project/tools.ts:103` | `t3_thread_launch` binds root/worktree/scratch before launching. It has no retry key: a lost response requires list/read reconciliation before another launch. |
| Queue inspection/control | `apps/server/src/mcp/toolkits/thread/tools.ts:83` onward | Queue list/read/edit/cancel/reorder/promote tools reuse thread commands; promotion targets a specific active run. |
| Provider/model choice | `apps/server/src/mcp/toolkits/orchestrator/tools.ts:51`; `apps/server/src/mcp/toolkits/thread/tools.ts`: configuration/configure tools | `orchestrator_capabilities` reports live configured instances/models; configure changes selection without changing permission modes. Actual availability of the required model pins needs live catalog verification. |
| Event/control API | `packages/contracts/src/orchestrationV2.ts:3139`, `:3232`, `:3281`, `:3566`, `:3606` | Typed `orchestration.dispatchCommand`, launch/projection APIs, and `subscribeShell`/`subscribeThread`; subscriptions support sequence-based continuation. Use the authenticated public MCP surface first; a direct event adapter would require explicit authorization and version compatibility. |
| Owned runtime resume | `apps/server/src/orchestration-v2/ProviderSessionManager.ts:1509`, `:1716`, `:1834` | Idle runtimes can unload native resources and resume on the next T3 turn. This provides an implemented lifecycle seam, not proof that an unrelated application's active runtime can be adopted. |

## Provider mechanisms and identity boundary

**Codex:** `apps/server/src/provider/Drivers/CodexDriver.ts:1` describes instance-owned app-server processes and independent home environments. `apps/server/src/orchestration-v2/Adapters/CodexAdapterV2.ts:6204` calls `turn/start`; lines 6485 and 6650 use `thread/resume` and `turn/steer`; interruption uses `turn/interrupt`. Its runtime-mode mapping at line 683 maps Full access to `never` plus `dangerFullAccess`. T3-owned provider identity, native thread identity, and T3 UI thread identity are separate identifiers.

**Claude:** `apps/server/src/provider/Drivers/ClaudeDriver.ts:1` routes through the Claude Agent SDK. `apps/server/src/orchestration-v2/Adapters/ClaudeAdapterV2.ts:632` constructs the SDK query; line 847 supplies native resume identity; line 7761 validates the active provider turn and offers a priority-now user message into the existing query. Permission mapping begins at line 1511; a reused query restores its opened mode at lines 7297–7299. The adapter injects T3 orchestration MCP into its owned runtime. These are useful seams for T3-owned sessions, not evidence of a Claude Code Desktop attachment API.

The official provider guides distinguish shared-home Codex continuation from separate-home isolation and restrict Claude continuation to compatible config directories. Reusing login/configuration is an account setup feature; it does not establish concurrent ownership of an already-running Desktop session. [Codex guide](https://github.com/pingdotgg/t3code/blob/main/docs/user/providers-codex.md), [Claude guide](https://github.com/pingdotgg/t3code/blob/main/docs/user/providers-claude.md).

## Authorization and permission continuity

Official outside-agent MCP uses an environment `/mcp` URL and OAuth approval. Read-only is the outside-client default; approved mutating clients can start/message/stop threads with a permission ceiling. Connections can be revoked. Documented CLI enrollment commands are `claude mcp add --transport http t3 <environment-mcp-url>` followed by `claude mcp login t3`, or `codex mcp add t3 --url <environment-mcp-url>` followed by `codex mcp login t3`. These are future setup steps; none was executed. [Outside-agent guide](https://github.com/pingdotgg/t3code/blob/main/docs/user/outside-agents.md).

Implemented fences include read-only refusal in `apps/server/src/mcp/McpToolAccess.ts:100`, live caller checks for mutating operations, and target mode comparison before sending in `OrchestratorMcpService.ts:2377`. `McpToolAccess.race.test.ts:31` explicitly exercises a user raising target permissions after the tool check. This source evidence is stronger than relying on composer labels, but those tests were not executed here. Existing-thread modes are intended to persist; provider-specific mappings differ. [Permission modes](https://github.com/pingdotgg/t3code/blob/main/docs/user/permission-modes.md).

An outside-client grant may cover every project in an environment. That is broader than the router's recipient/conversation-scoped grant. Before adopting this as a host, decide whether dedicated environment isolation or a narrower T3 authorization extension is needed. Do not silently equate environment-wide OAuth permission with the router's scoped launch grant, or T3 task orchestration with this repository's registered orchestrator/merge authority.

## Required proof before adoption

1. Observe two owned visible T3 threads with the exact approved Claude/Codex model pins and recorded runtime policy, without inspecting unrelated conversations.
2. Exchange one bounded autonomous request/reply/ACK through the actual T3 tools; correlate T3 thread/run and native session identity privately, and verify both visible histories persist after reconnect.
3. Exercise idle wake and a genuinely active busy turn separately. Verify steering versus queue disposition, model consumption, and receipt ordering rather than treating send acceptance as delivery.
4. Verify Full access/approval behavior after idle unload/resume, reconnect, external MCP steering, and provider selection changes. Reject any policy mismatch before inference; prove read-only denial and revoked-client denial.
5. Qualify restart, duplicate client-request behavior, and interruption without simultaneous native execution. Keep launch's non-idempotent behavior explicit.
6. If the desired target remains an already-open external Desktop conversation, require an application-supported attachment path and same-session UI evidence. T3-owned replacement conversations alone do not satisfy that requirement.

Official project entry points: [T3 Code](https://t3.codes/), [repository README](https://github.com/pingdotgg/t3code/blob/main/README.md). Source links can be reproduced using the pinned [reference commit](https://github.com/pingdotgg/t3code/tree/101f8b2f55df50d4f8d70ed8e6b8e0edf71a2f31).
