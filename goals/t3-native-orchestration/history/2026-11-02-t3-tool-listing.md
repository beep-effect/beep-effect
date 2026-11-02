# Installed T3 MCP tool listing (2026-11-02)

Captured from the `t3-code` MCP server this orchestrator session loads: a Claude
Code thread launched by the T3 Code desktop app on DankStation (fork
`beep-effect/t3code` at `fa31b66bbb2ae5234205a8628a78e038d917202f`). Tool names
and argument names were read from the live tool schemas (`ToolSearch`), then
cross-checked against the fork's `packages/contracts/src/orchestratorMcp.ts`
and `apps/server/src/mcp/toolkits/*/tools.ts`. No ids, hosts or tokens are
recorded here.

## Tools the skill names, as the server exposes them

| Tool | Arguments (optional in parentheses) |
| --- | --- |
| `orchestrator_capabilities` | (`environmentId`, `search`) |
| `delegate_task` | `task`; (`title`, `role`, `target{providerInstanceId|driverKind, model, options, environmentId, projectId}`, `isolation` shared/worktree, `mode` async/wait, `timeoutMs`, `clientRequestId`, `runtimeMode`, `interactionMode`) |
| `task_status` / `task_cancel` | `taskId` |
| `create_threads` | `threads[1..20]{title, prompt, target, runtimeMode, interactionMode}`; (`clientRequestId`) |
| `t3_thread_launch` | `title`; (`message`, `modelSelection{provider, model, options, instanceId}`, `workspaceStrategy{type root/existing_worktree/worktree, baseRef, branch, startFromOrigin, worktreePath}`, `projectId`, `scratch`, `runtimeMode`, `interactionMode`, `attachments`, `delegatedFrom`, `environmentId`, `clientRequestId`) |
| `t3_thread_list` | (`environmentId`, `projectId`, `allProjects`, `statuses`, `titleContains`, `settled`, `snoozed`, `includeSubagents`, `cursor`, `limit`) |
| `t3_thread_read` | `threadId`; (`environmentId`, `view` messages/activity, `itemId`, `textOffset`, `afterPosition`, `limit`, `runLimit`, `maxCharsPerItem`) |
| `t3_thread_send` | `threadId`, `message`; (`environmentId`, `mode` auto/queue/steer/restart, `clientRequestId`) |
| `t3_thread_wait` | `threadId`; (`environmentId`, `runId`, `timeoutMs`, `untilDelegatedWorkSettled`) |
| `t3_thread_interrupt` | `threadId`; (`environmentId`, `runId`, `reason`, `stop`, `clientRequestId`) |
| `t3_thread_configure` | (`threadId`, `environmentId`, `modelSelection{model, provider, options, instanceId}`) |
| `schedule_task` | `prompt`, `schedule{type interval/fixed_time/once/webhook, everyMs, timeOfDay, weekdays, runAt, filters, dedupe, signature, maxDeliveryAgeMinutes}`; (`title`, `enabled`, `bindToCurrentThread`, `projectId`, `environmentId`, `scheduledTaskId`, `clientRequestId`) |
| `list_scheduled_tasks` / `delete_scheduled_task` / `update_scheduled_task` / `run_scheduled_task_now` | as the fork's `orchestratorMcp.ts:702-843` |
| `t3_workflow_stop` | `threadId`, `subagentId`; (`environmentId`) |
| `watch_pull_request` / `unwatch_pull_request` / `link_pull_request(s)` | PR url or `repository`+`number`; (`environmentId`, `threadId`) |

## Findings

- `t3_thread_configuration` does not exist; the tool is `t3_thread_configure`.
  The spec and skills were corrected (SPEC Decision Log 2026-11-02).
- `t3_environment_links`, `t3_environment_link` and `t3_environment_unlink` are
  not listed in this session: the Linked environments beta is off on this
  host, and the fork hides them while it is off
  (`apps/server/src/mcp/McpInvocationContext.ts`). `environmentId` is still an
  accepted argument everywhere the skill says.
- Capabilities seen (`orchestrator_capabilities`): provider instances `codex`
  (`gpt-6.1-sol`, option `reasoningEffort`), `claudeAgent` (`claude-opus-5-5`,
  option `effort`), `cursor`, `grok`, `muse`; `opencode`, `antigravity`, `fx`,
  `pi` disabled; Kimi CLI unauthenticated. Features: app-owned subagents,
  async polling, cancellation, batch thread creation (max 20), thread
  management, incremental thread read, scheduled tasks.
- The TokenEconomizer toolprune deny list in the gitignored local Claude
  settings had hidden every orchestrator tool from beep-effect sessions
  (`orchestrator_capabilities`, `delegate_task`, `t3_thread_*`, `schedule_task`,
  PR watch tools). They were restored and marked kept repo-wide this session;
  the listing above is what a session sees once they are allowed.
