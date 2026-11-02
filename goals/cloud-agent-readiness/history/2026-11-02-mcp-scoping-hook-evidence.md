# MCP host scoping and cloud hook evidence (P2) — 2026-11-02

Scope: the two open P2 research items, MCP scoping by host (D7) and cloud
SessionStart/Stop hook evidence (acceptance row 4, D3). Research only: no
settings, `.mcp.json`, bootstrap, hook, source or test change. P2 stays
`pending`; this note flips no phase or lifecycle status. Base: `main` at
`67890daa`, which contains #2492 (`cda8f0d1`, notifier guard) and #2498
(`65b170d3`, packet-projections skip). The same PR also marks the retired
`graft-hooks.cjs` item in the PLAN P2 row and detail bullet as superseded by
the 2026-10-28 graft retirement. Ids and status are unchanged.

## 1. Can `.claude/settings.json` or `.mcp.json` scope servers by host?

**No.** Official Claude Code documentation describes no host-, machine-, OS- or
environment-conditional syntax for either file. Per D7, the runbook expectation
is the answer. No conditional syntax is proposed here.

Evidence, all read 2026-11-02 (the pages show no last-updated date), plus the
installed CLI `2.1.316 (Claude Code)`:

| Source | What it says |
| --- | --- |
| [MCP](https://code.claude.com/docs/en/mcp) | Three scopes: local (`~/.claude.json`, this project only), project (`.mcp.json`, shared through version control), user (`~/.claude.json`, all projects). When a server is defined in more than one place, the highest-precedence definition wins whole (local > project > user > plugin > claude.ai connectors). There is no per-host or per-machine enable rule. `${VAR}` and `${VAR:-default}` expand in `command`, `args`, `env`, `url` and `headers`. That is value substitution, not conditional enablement; an unset variable with no default stays as literal text, and the CLI warns. `disabledMcpjsonServers` "in any settings file still rejects the server." Committed `enabledMcpjsonServers`/`enableAllProjectMcpServers` are ignored in an untrusted folder. A stdio server that fails to start is marked failed and the session continues without its tools. |
| [Settings](https://code.claude.com/docs/en/settings) | Precedence: managed > `--settings` > `.claude/settings.local.json` > `.claude/settings.json` > `~/.claude/settings.json`. List keys merge across files. Cloud sessions read the committed `.claude/settings.json` (single-repo sessions only) and server-managed settings; they do **not** read `~/.claude/settings.json` or `.claude/settings.local.json`. |
| [Settings reference](https://code.claude.com/docs/en/settings-reference) | The index lists `enabledMcpjsonServers`, `disabledMcpjsonServers`, `enableAllProjectMcpServers`, `allowedMcpServers` and `deniedMcpServers` with scope "Any file". None of the index rows read describes conditional application. The full per-key entries were not read: the fetch was truncated. |
| [Cloud environments](https://code.claude.com/docs/en/cloud-environments), "What carries over" | A repo's `.mcp.json` servers: "Yes, in a session with one repository." Servers added with `claude mcp add` at local or user scope: "No", because they live in `~/.claude.json`. Hooks "run in both local and cloud sessions"; to scope a hook, exit early unless `CLAUDE_CODE_REMOTE` is `true`. That is a script-side check, not settings syntax. |
| [Cloud sessions](https://code.claude.com/docs/en/claude-code-on-the-web) | Lists no MCP host scoping; settings changes for a cloud session go through environment variables or the committed `.claude/settings.json`. |
| `claude --help`, `claude mcp --help` | `--mcp-config` and `--strict-mcp-config` choose servers for a single invocation; `claude mcp reset-project-choices` resets approvals. No host-conditional option. |

What the docs do support is a per-machine split by **file location**, not by
condition: what sits in `~/.claude.json`, `~/.claude/settings.json` or
`.claude/settings.local.json` stays on that machine and never reaches a cloud
VM. The repo already relies on this for user-level settings (runbook
`docs/runbooks/cloud-environments.md`). Whether to move workstation-only
servers out of `.mcp.json` into local or user scope is a design call for the
packet owner. This note does not make it.

### Expected availability in a Claude cloud session (current `main`)

Server names and transports come from `.mcp.json`; approval lists from
`.claude/settings.json`. No value, command or credential was resolved. The
"Observed" column is this session's start report: a real Anthropic-hosted
session with ambient `BEEP_AGENT_HOST=cloud` and `CLAUDE_CODE_REMOTE=true`.

| Server | Transport | Committed approval | Observed in this cloud session | Expectation |
| --- | --- | --- | --- | --- |
| `shadcn` | stdio | — | connected (tools listed) | available |
| `next-devtools` | stdio | — | connected | available |
| `nlp` | stdio | — | connected | available after bootstrap |
| `fallow` | stdio | — | connected | available after bootstrap (F11's ENOENT was pre-bootstrap) |
| `beep-m365-outbox` | stdio | — | failed: executable `op` not found | expected failure; `op` never enters the cloud |
| `stately` | http | `enabledMcpjsonServers` | failed: proxy refused tunnel (403) | expected failure under the current allowlist (not expanded) |
| `phoenix-docs` | http | `enabledMcpjsonServers` | failed: proxy refused tunnel (403) | expected failure under the current allowlist (not expanded) |
| `serena` | stdio | `disabledMcpjsonServers` | not attempted | not connected (rejected by committed settings everywhere) |
| `chrome-devtools` | stdio | `disabledMcpjsonServers` | not attempted | not connected |
| `webstorm` | http | `disabledMcpjsonServers` | not attempted | not connected |
| `phoenix` | http | `disabledMcpjsonServers` | not attempted | not connected |

The GitHub MCP tools in a cloud session come from the vendor session, not
`.mcp.json`.

The three failures are **optional MCP transport errors**. They are not repo-hook
errors, and the session continued without those tools. D7 named `serena`,
`webstorm`, `phoenix`, `phoenix-docs` and `chrome-devtools`. Current `main`
differs: four of those are rejected by committed settings and never fail, and
`beep-m365-outbox` and `stately` are additional cloud failures. The runbook's
prose bullet already names the three observed failures. D7 asks for a runbook
*table*, which belongs to P4 doctrine work and is still open.

## 2. Cloud SessionStart/Stop hook evidence

Hooks on `main` (`.claude/settings.json`): SessionStart runs `bootstrap.sh`
(startup and resume only), `packet-projections.sh`, `yeet-inbox.sh`,
`hook-pulse.sh` and `session-ledger.sh`. Stop runs `hook-pulse.sh` and
`yeet-inbox.sh`. SessionEnd runs `hook-pulse.sh`. No graft hook exists.

### 2a. Real vendor session (this session, read-only)

Source: this session's own transcript under the Claude project directory.
Only types, event names, exit codes and stderr lengths were read; no payload
or environment was printed.

- One `hook_success` record: `SessionStart:startup`, the bootstrap hook, exit
  `0`, stderr empty, 360 ms. Its stdout reported the toolchain already matched
  and no install ran.
- Zero `hook_error`, `hook_non_blocking_error`, `hook_blocking_error` or
  `hook_cancelled` records.
- **Limit:** the transcript only recorded the hook that wrote stdout. The four
  silent SessionStart hooks left no record, so this transcript cannot show
  their exit codes or stderr. It shows only that no error record was written.
  Debug logging was not enabled, and enabling it is out of scope.
- **Stop:** no real cloud Stop was available when this note was written. This
  session's first Stop fires after the note is pushed, and no other cloud
  session's logs are in this container.

### 2b. Hermetic simulation (not vendor evidence)

A scratch copy of `.claude/hooks/` was placed in a throwaway git project
(origin URL only, no network, no `node_modules`). Each hook ran under
`env -i` with temp `HOME` and `XDG_STATE_HOME`, `CLAUDE_PROJECT_DIR` pointing
at the copy, and `BEEP_SEQUENCE_BREAK_FOREGROUND=1`. The commands were the
exact strings from `.claude/settings.json`, fed synthetic payloads. A stub
`sequence-break-notifier.sh` and stub `curl`/`notify-send`/`ntfy` on `PATH`
only counted calls. The bootstrap hook was skipped (covered by 2a). No live
notifier, ledger, network or secret was touched.

| Host | Event | Hooks | Exit | stderr lines |
| --- | --- | --- | --- | --- |
| `cloud` | SessionStart | projections, yeet-inbox, hook-pulse, session-ledger | all `0` | 0 |
| `cloud` | Stop | hook-pulse, yeet-inbox (prints `{}`) | all `0` | 0 |
| `cloud` | SessionEnd | hook-pulse | `0` | 0 |
| unset | same three events | same | all `0` | 0 |

- Pulse rows kept flowing: 6 rows, one per event per host (SessionStart,
  Stop and SessionEnd under `cloud` and unset), each with the 11–12 `HookPulseV1` field set. Cloud rows still
  stamp `notifierRev: desktop-ntfy-1`, the open gap recorded in
  `2026-11-01-cloud-hook-guard.md`.
- PermissionRequest control: the stub notifier was called 0 times with
  `BEEP_AGENT_HOST=cloud` and once with the variable unset. The stub is
  reachable, and the #2492 guard holds.
- Matrix command `BEEP_AGENT_HOST=cloud bash .claude/hooks/hook-pulse.sh < /dev/null`:
  exit `0`, no stdout or stderr, one content-free refusal row in the temp
  state (expected for empty stdin).
- `packet-projections.sh` exits `0` at once without `node_modules/effect`
  (#2498).

## 3. P2 acceptance status (row 4 plus the PLAN P2 bullets)

| Item | Status | Receipt |
| --- | --- | --- |
| Desktop notifier does not fire under `cloud` | **proven** | #2492 tests plus the 2b control |
| Pulse rows keep flowing; no `HookPulseV1` literal needed | **proven** | 2b rows; `2026-11-01-cloud-hook-guard.md` |
| `packet-projections.sh` skip without `node_modules/effect` | **proven** (landed #2498) | 2b |
| `graft` session-start skipped | **retired**: graft removed 2026-10-28; not reintroduced | PLAN row and bullet now say so |
| MCP host-scoping research | **answered: unsupported**; §1 records current capability and expectations | §1 |
| SessionStart emits no error lines in a real cloud session | **partly proven**: bootstrap clean and no error records, but no receipt for the four silent hooks | 2a |
| Stop emits no error lines in a real cloud session | **open**: hermetic only | 2a, 2b |
| Without the variable, behavior byte-identical to before | **open**: the hermetic runs match on exit code and stderr only; no byte comparison against pre-guard writers was made | 2b |
| D7 runbook *table* | **open** (P4): the runbook has a prose bullet | §1 |

Next evidence needed to close row 4: a later cloud session's transcript (or a
`--debug=hooks` debug file, if the packet owner allows it) that records the
Stop hooks and the silent SessionStart hooks, plus a byte comparison of hook
output with the variable unset against the pre-guard writers.

## Not investigated

A separate review noted that `Bun.spawnSync` tests may be exposed when coverage
runs under Node. It is unproven and outside this research lane; it was not
examined here.
