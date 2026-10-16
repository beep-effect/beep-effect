# Post-main provider shell-tool smokes — 2026-10-14

Native Cursor, Grok and Muse pass bounded shell execution on beep-worker at
`eaefd67372063250d41193e957c4b04d60a6d4ae`. This supplements the prior
[inference smokes](2026-10-14-post-main-provider-smokes.md). Claude remains
weekly-quota blocked by that receipt and was not relaunched here.

Each session was instructed to use its shell tool exactly once for:

```sh
hostname; pwd; node --version; bun --version
```

Tool execution evidence, rather than only the final model response, confirms
the exact command, exit zero and this output for every accepted run:

```text
beep-worker
/home/elpresidank/YeeBois/projects/beep-effect-worktrees/linux-agent-readiness
v24.21.0
1.4.2
```

## Profiles and evidence

| Provider | Profile | Result |
| --- | --- | --- |
| Cursor Agent | claude-opus-5-5-medium; trusted workspace; plan mode; sandbox enabled; canonical --force route retaining configured denials | Process exit 0, 26.34 seconds; one shellToolCall starts/completes, command exit 0, stdout matches |
| Grok Build, corrected | grok-4.7, medium; maximum three turns; web disabled; --tools Bash; explicit Shell allow rules for the four commands | Process exit 0, 19.58 seconds; one run_terminal_command completes with command exit 0 and matching output |
| Muse native | muse-spark-1.3, medium; maximum three model steps; trusted workspace; non-shell writes/web/reminders disabled; on-request approval and default sandbox retained | Process exit 0, 17.02 seconds; one bash tool.result reports success, exact command, exit 0 and matching output |

The primary runs were sequential, each with a finite 180-second host deadline.
The harness would terminate only its own process group on timeout; none timed
out. The corrected Grok run was also bounded to 180 seconds. All workloads
explicitly removed SSH_AUTH_SOCK and inherited the worker's default nvm runtime.
No source files, credentials, services or persistent permission configuration
were changed. No sudo, Git, deployment or delegation tool request was made.

Cursor's tool trace requests a workspace-readwrite sandbox policy with network
access false. The selected command is read-only, but this is not an OS-enforced
read-only workspace profile. Likewise Muse's --disable-write affects non-shell
writes, not every possible shell action. This smoke proves the observed harmless
command works; it does not prove arbitrary writes or network calls are blocked.

## Grok selector correction

The first Grok run executed the exact harmless command successfully in 17.93
seconds, but stderr warned that `--tools run_terminal_command` names no tool
and leaves other tools available. The emitted tool RPC name is not the accepted
CLI selector. That run is retained as evidence of launch friction, not accepted
as a restricted-tool-profile pass.

Reran with the supported selector `--tools Bash`, preserving the four exact
Shell allow rules and other limits. The corrected run has empty stderr and
successful tool execution. Its RPC event is still named run_terminal_command;
do not reuse that event name as the CLI selector. The earlier inference receipt
qualifies observed no-tool behavior, not enforcement of an empty Grok selector.

## Muse context and preservation

Muse loads 58 skills with workspace trust enabled. The previously observed
32 KB catalog warning remains: two descriptions compacted, zero skill ids
omitted. Its actual shell result passes with no reported approval or sandbox
failure; that does not qualify unrelated commands or approval paths.

The harness hashes all seven pre-existing tracked modifications and the
untracked `.grok/config.toml` before and after the primary runs and confirms
byte equality. The corrected Grok run also verifies those same hashes. No
additional repository modifications were observed. Private JSON events,
stderr, launch argv, timings and hash receipts are retained under
`~/.cache/beep/readiness/post-main/shell-providers/`.

Native inference plus one bounded shell call is now qualified for Cursor,
Grok and Muse under these profiles. Fresh T3 SDK/provider sessions,
CLIProxyAPI routes, Claude after quota reset, MCP authentication, reboot
recovery, concurrency and substantive development tasks remain separate.
The earlier complete serial cheap-gate proof was not rerun in this step.
