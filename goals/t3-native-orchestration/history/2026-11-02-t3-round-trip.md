# Live T3 round trip: Codex and Claude children (2026-11-02)

Run from the orchestrator thread of this goal, a Claude Code session the T3 Code
desktop app launched on DankStation, following the rewritten `orchestrate`
skill ("T3-native procedure"). Thread ids, environment ids and the project id
are omitted; the exact `clientRequestId` values are kept because they are the
correlation keys the skill prescribes.

## Steps and receipts

| Step | Tool and arguments | Receipt |
| --- | --- | --- |
| 1 Capabilities | `orchestrator_capabilities` | `codex` lists `gpt-6.1-sol` with option `reasoningEffort`; `claudeAgent` lists `claude-opus-5-5` with option `effort`; both `canRunChildTask` and `canRunCrossProviderChildTask`. |
| 2 Launch Codex | `delegate_task` `{target: {providerInstanceId: "codex", model: "gpt-6.1-sol", options: {reasoningEffort: "medium"}}, mode: "async", clientRequestId: "orch-beep-effect-t3no-receipt-codex-launch-1"}` | `status: running`, `workState: working`, `model: gpt-6.1-sol`, `options: [{reasoningEffort: medium}]`, `next: "Completion wakes this thread…"`; child thread link returned. 11:15:18Z. |
| 2 Launch Claude | `delegate_task` `{target: {providerInstanceId: "claudeAgent", model: "claude-opus-5-5", options: {effort: "medium"}}, mode: "async", clientRequestId: "orch-beep-effect-t3no-receipt-claude-launch-1"}` | `status: running`, `model: claude-opus-5-5`, `options: [{effort: medium}]`; child thread link returned. 11:15:21Z. |
| 4 Wait on the launch runs | `t3_thread_wait {threadId, runId: <ordinal:1>, timeoutMs: 60000}` on each child | Claude: `status: completed, timedOut: false` (run 11:15:21Z → 11:15:59Z). Codex: `status: running, timedOut: true` although its assistant message was already complete at 11:15:28Z (see Findings). |
| 4 Read the first replies | `t3_thread_read {view: "messages", limit: 6, maxCharsPerItem: 600}` | Claude (position 1, run ordinal:1): `ACK t3no-claude-rt1` / `t3-code`. Codex (position 1, run ordinal:1): `ACK t3no-codex-rt1` / `none`. |
| 3 Send ACK2 | `t3_thread_send {mode: "auto", clientRequestId: "orch-beep-effect-t3no-receipt-claude-ack2-1"}` and `…codex-ack2-1` | Claude: `delivery: started`, new `runId` ordinal:2, `taskId` returned (a send to a finished child starts a fresh task). Codex: `delivery: steered`, same `runId` ordinal:1. 11:43:32Z–34Z. |
| 4 Wait and read the ACK2 replies | `t3_thread_wait` on the returned `runId` (90 s), then `t3_thread_read {afterPosition: 1}` | Claude: run ordinal:2 `completed` (11:43:32Z → 11:43:37Z); position 5 `ACK2 t3no-claude-rt2` plus an estimated time (it ran no command, as told). Codex: wait timed out again (`running`), but position 3 in run ordinal:1 carries `ACK2 t3no-codex-rt2` / `2026-11-02 11:43:37 UTC`, three seconds after the steer. |
| 5 Interrupt | `t3_thread_interrupt {runId: <codex ordinal:1>, reason, clientRequestId: "orch-beep-effect-t3no-receipt-codex-interrupt-1"}` | See below. |

Both children reported through T3 only. No beep mailbox, store, grant or adapter
existed in the tree at the time (the stack is deleted on this branch).

## Findings for the skill

- **Correlate by run and position, not by thread status.** Codex's run stayed
  `running` after each completed assistant message, so `t3_thread_wait` on its
  run timed out twice while the reply was already readable at the next
  position. The skill's rule (wait on the send's `runId`, then read after the
  sent message's position and accept the assistant message in that run) found
  both replies; a rule keyed on `completed` would have hung.
- **Steer works on a Codex child whose run is still open.** `mode: "auto"`
  reported `delivery: steered` and the reply arrived in the same run. On the
  finished Claude child the same mode started a new run and a new task.
- **The Codex child reported no visible `t3-code` server** while the Claude
  child reported it. The injected server is confirmed for Claude; for Codex the
  model either did not list its MCP servers or the injection is not visible to
  it. That does not affect orchestrator-to-child messaging (both directions
  worked through the parent's tools), but a Codex child cannot be assumed to
  message back through T3 tools of its own.
- **Interrupt the exact run, then verify.** The orchestrator ended the Codex
  run with `t3_thread_interrupt` naming its `runId` and a reason; the receipt
  and the follow-up `t3_thread_wait` status are recorded below.

## Interrupt receipt

`t3_thread_interrupt` returned `status: interrupt_requested` for the Codex run
(ordinal:1). A follow-up `t3_thread_wait` on that `runId` (30 s) returned
`status: interrupted, timedOut: false`, which is the terminal status the skill
requires before recording the unit as stopped. The Claude child needed no
interrupt: both of its runs ended `completed` on their own.

## Verdict

Codex (`gpt-6.1-sol` medium) and Claude (`claude-opus-5-5` medium) children
were launched with pinned models, each answered a first message and a second
message sent with a stable `clientRequestId`, every reply was correlated by
`runId` and item position, and the open Codex run was interrupted and verified
terminal. The acceptance criterion "send/reply/ack round trip through T3 tools"
is met for both providers.
