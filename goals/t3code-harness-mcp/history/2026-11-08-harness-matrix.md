# Harness MCP proof matrix (2026-11-08)

Tokens, tailnet names, environment ids and thread titles stay out of this file. Each cell is one
headless turn in an empty directory, outside T3, using that host's user-scope `t3-code` entry: list
one thread, read it, and print a sentinel. Pins: Claude `claude-opus-5-5` medium, Codex `gpt-6.1-sol`
medium, Grok `grok-4.7` medium, Cursor `composer-2.5` with its sandbox enabled.

| Host | Claude | Codex | Grok | cursor-agent | Junie turn | Junie token, direct MCP |
| --- | --- | --- | --- | --- | --- | --- |
| DankStation | ok | ok | ok | ok | blocked: balance | ok |
| beep-worker | ok | ok | ok | ok | blocked: no login | ok |
| dankserver | ok | ok | ok | ok | blocked: no login | ok |
| tbk-worker | ok | ok | ok | ok | blocked: no login | ok |
| tom-pc-1-wsl | ok | ok | ok | ok | blocked: no login | ok |
| grok-bot | ok | ok | ok | ok | not attempted | ok |

`ok` means `T3MCP list=ok read=ok`: both tools succeeded.

## Junie

Junie's registration works, shown by the last column: a direct MCP `initialize`, `t3_thread_list` and
`t3_thread_read` with the token from each host's Junie config. **No Junie turn has actually called the
server, so Junie's own MCP client is unproven.**

- DankStation: `Insufficient account balance. All tokens in your account have been spent.`, on both the
  pinned and the default model. `beep accounts status` shows the JetBrains row at 0 of 10.
- Workers: `Cannot find authorization` on an older build (`1468.30`), whose catalog also lacks
  `claude-opus-5-5`. The spec forbids copying credentials between hosts, and login is a person's step.
- grok-bot: not attempted, for the same reason; the probe skips Junie on builds older than the hub's.

Both blocks are in `SPEC.md`'s Exception Ledger.

## What the first pass got wrong

The first prompt called `t3_thread_list` with only `limit`. Outside a T3 thread that returns
`target_required`, so Codex, some Grok and some Cursor runs honestly printed `list=fail`. Claude
retried with a target. The corrected prompt passes `allProjects: true`. This was a probe defect, and
the runbook now names the error.

## Cursor sandbox on beep-worker

Cursor passed on beep-worker in the first pass, then failed with `SandboxUnsupportedError`. Cursor
auto-updated to `2026.11.05-86047df` at 07:38 local, between the passes, and the host's AppArmor profile
pins exact helper paths (`goals/cloud-agent-readiness/history/2026-10-14-t3-provider-qualification.md`).
Following that receipt's procedure, the two paths were re-pinned through YubiKey sudo (backup under
`/root`), then `cursor-agent sandbox run echo ok` printed `ok` and the turn above passed. The sandbox
stayed enabled throughout. The T3 service was not restarted, so a preflight failure it cached before
the fix would persist until its next restart.

## No double load in T3-launched sessions

| Session | MCP servers seen | Same tool under two names | `t3_environment_read` |
| --- | --- | --- | --- |
| T3-launched Claude, hub | `t3-code` | no | ok |
| T3-launched Codex, hub | `mcp__t3_code` (68 tools), `mcp__t3_code_direct` (1: `t3_thread_wait`) | no | ok |

The Codex pair is T3's own deferred and direct split, not the user-scope entry loading a second time;
no tool name appears in both. That session's inventory does not expose connection details, so this
rests on the tool lists and on T3's adapter overriding the `t3-code` key.

## Renewal reminder

`t3code-fleet-renewal-reminder.timer` on DankStation is enabled for 2027-04-23 09:00 America/Chicago,
two weeks before the 2027-05-07 expiry. Starting its service by hand posted the notification:
`Result=success`, `ExecMainStatus=0`. `t3_environment_links` lists all five links expiring 2027-05-07.
