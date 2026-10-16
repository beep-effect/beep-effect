# Post-main provider inference smokes — 2026-10-14

Ran fresh, sequential native CLI sessions on beep-worker's readiness checkout
at `aa264886ca2748f8240c9e778c2cb55e1faa2d9e`. The operator selected testing
the other providers after the main merge. These are inference and startup
smokes, not shell-tool, T3 SDK, proxy-wrapper or development-task qualification.

All sessions received the same instruction: do not use tools, read files,
run commands, delegate, edit, authenticate or deploy; return exactly
`BEEP_WORKER_POST_MAIN_OK`. Each process had a finite 120-second deadline and
stdin from `/dev/null`. The SSH workload explicitly removed SSH_AUTH_SOCK,
loaded the default nvm runtime and used the existing authenticated clients.
Private logs are retained under
`~/.cache/beep/readiness/post-main/providers/`.

| Provider | Launch selection and profile | Observed result |
| --- | --- | --- |
| Claude native | Fable 5.1, medium; no built-in tools, strict empty MCP config | Corrected invocation exits 1 with weekly quota limit; no inference qualified |
| Cursor Agent | claude-opus-5-5-medium, ask mode, trusted workspace, sandbox enabled | Exit 0 in 28.43 seconds; exact marker; init identifies Claude Opus 5.5 300K Medium |
| Grok Build | grok-4.7, medium, one turn, empty tool selection, web search disabled | Exit 0 in 35.49 seconds; text chunks concatenate to exact marker; one model call, modelUsage grok-4.7-build |
| Muse native | muse-spark-1.3, medium, one model step, shell/write/web/reminders disabled | Exit 0 in 3.88 seconds; Meta model configuration and completed exact marker; initial untrusted workspace skips repo context |
| Muse trusted rerun | Same selection and restrictions, plus --trust-workspace | Exit 0; Meta muse-spark-1.3 configured and completed exact marker; trusted project context loads |

Muse's native Spark selection repeats the earlier named T3 native-provider
smoke. It is separate from the opt-in Wonder proxy route; that route was not
tested here. Explicit argv establishes the selected effort; do not infer
provider-internal reasoning execution solely from an effort flag.

## Friction and corrections

The first Claude command exits before any inference because its variadic
`--mcp-config` option consumes the positional prompt as a filename. Corrected
the launch with a `--` argument terminator. The corrected response contains
`is_error: true` and an empty modelUsage, despite its JSON subtype being
`success`: **weekly quota reached**, with a reported reset at 10 p.m.
America/Chicago. Exit status is one. Neither a success-shaped envelope nor an
empty stderr establishes successful inference. No automatic fallback was used:
another provider's response cannot qualify Claude's quota-blocked route.

The first Muse launch deliberately did not trust the workspace. Its startup
warns that AGENTS.md and project skills are skipped. The trusted rerun retains
shell and write restrictions and loads 58 skills. Its remaining warning says
the skills catalog was trimmed to a 32 KB limit: two descriptions compacted,
zero skill ids omitted. This is prompt-context friction, not an inference
failure. Repo-rule and skill loading do not establish that all instructions
were followed in a substantive task.

Cursor and Grok stderr are empty. Cursor's init event verifies the requested
model's medium identity. Grok's terminal event and modelUsage verify its
Grok Build route. No reauthentication, model substitution or provider
configuration change was performed.

## Preservation and limits

The primary sequential harness hashes the seven modified tracked paths and
untracked `.grok/config.toml` before/after and verifies equality. Subsequent
corrected Claude and trusted Muse runs leave the same eight changed paths and
no additional repository changes. The private primary receipts retain the
failed first Claude launch; corrected evidence is separate, not overwritten.

This closes fresh inference acceptance for native Cursor, Grok and Muse under
the recorded profiles. Claude remains quota-blocked. These sessions do not
qualify provider shell tools, sandbox filesystem/network enforcement, arbitrary
MCP integrations, T3 SDK sessions, proxy-account routes, reboot recovery,
parallel capacity or full development tasks. No repository quality tier was
rerun, and the earlier complete serial cheap-gate receipt retains its original
source and scope.
