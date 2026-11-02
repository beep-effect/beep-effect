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

**No documented host-conditional syntax was found** in the official sources
reviewed below or in the installed CLI `2.1.316 (Claude Code)` help. This is a
negative finding over a bounded source set, not proof that no such mechanism
exists. Limits:

- Seven pages were read on 2026-11-02, some after this note's first draft:
  `mcp` (all of it, in two ranges), `managed-mcp`, `settings`,
  `settings-reference` (all of it, in five ranges), `cloud-environments` and
  `claude-code-on-the-web`.
- Pages that were not read include `server-managed-settings`, `managed-settings`,
  `self-hosted-environments*`, `env-vars` and `hooks`.
- The pages were read through the fetch tool's summarizer, so quoted text was
  not checked byte-for-byte against the raw HTML.

Per D7, the runbook expectation stands until a documented mechanism is found.
No conditional syntax is proposed here.

Sources, all read 2026-11-02 (the pages show no last-updated date):

| Source | What it says |
| --- | --- |
| [MCP](https://code.claude.com/docs/en/mcp) | Three scopes: local (`~/.claude.json`, this project only), project (`.mcp.json`, shared through version control), user (`~/.claude.json`, all projects). When a server is defined in more than one place, the highest-precedence definition wins whole (local > project > user > plugin > claude.ai connectors). An organization's `managedMcpServers` definition "ranks above all of these". No per-host or per-machine enable rule was found on the page. `${VAR}` and `${VAR:-default}` expand in `command`, `args`, `env`, `url` and `headers`. That is value substitution, not conditional enablement; an unset variable with no default stays as literal text, and the CLI warns. `disabledMcpjsonServers` "in any settings file still rejects the server." Committed `enabledMcpjsonServers`/`enableAllProjectMcpServers` are ignored in an untrusted folder. A stdio server that fails to start is marked failed and the session continues without its tools. |
| [Settings](https://code.claude.com/docs/en/settings) | Precedence: managed > `--settings` > `.claude/settings.local.json` > `.claude/settings.json` > `~/.claude/settings.json`. List keys merge across files. A cloud session with one repository, outside a project thread, reads the committed `.claude/settings.json` and server-managed settings. A cloud project thread applies none of the repo's permission rules, hooks or `env`. Cloud sessions do **not** read `~/.claude/settings.json` or `.claude/settings.local.json`. |
| [Settings reference](https://code.claude.com/docs/en/settings-reference) | All five MCP keys were read in full; the page was read through all of its ~442,600 characters in five ranges. `enabledMcpjsonServers` and `disabledMcpjsonServers` are arrays of `.mcp.json` server names, scope "Any file", default unset. "A rejection in any settings file applies, including a project `.claude/settings.json`." `enableAllProjectMcpServers` is a Boolean. In an untrusted folder, the approval keys are honored only from user, managed or `--settings` sources. `allowedMcpServers` and `deniedMcpServers` match by `serverName`, `serverCommand` or `serverUrl`, not by host. Some entries vary by OS, surface (cloud, desktop, VS Code) or a named environment variable, but those conditions are built into the product. None of the entries read is user-written conditional syntax, and none of them makes an MCP key apply by machine or hostname. The one dynamic mechanism is `policyHelper`, a managed-only executable that computes managed settings at startup. It is read only from a machine's MDM, registry or managed file, is ignored in server-managed settings, and per its Scope line is not read from `.claude/settings.json`. It is an organization-admin tool, not repo syntax, and is out of scope here. |
| [Managed MCP](https://code.claude.com/docs/en/managed-mcp) | These are org-admin controls: `managed-mcp.json` gives a fixed server set and exclusive control, and `managedMcpServers` gives remote servers to every user. `allowedMcpServers` and `deniedMcpServers` match by `serverName`, `serverCommand` or `serverUrl`. `managed-mcp.json` lives at a per-OS system path (`/etc/claude-code/` on Linux), and "cannot be delivered through server-managed settings". On a self-hosted runner host it also governs cloud sessions. `managedMcpServers` is read only from managed sources. Both are per-machine admin deployments, not repo syntax. No host-conditional field is documented for either. Both rank above the repo's project scope: a `managedMcpServers` entry overrides a same-name local, project or user server. |
| [Cloud environments](https://code.claude.com/docs/en/cloud-environments), "What carries over" | A repo's `.mcp.json` servers: "Yes, in a session with one repository." Repository hooks, `.mcp.json` and settings carry over only to a session with one repository, outside a project thread. Servers added with `claude mcp add` at local or user scope: "No", because they live in `~/.claude.json`. Hooks "run in both local and cloud sessions"; to scope a hook, exit early unless `CLAUDE_CODE_REMOTE` is `true`. That is a script-side check, not settings syntax. |
| [Cloud sessions](https://code.claude.com/docs/en/claude-code-on-the-web) | Lists no MCP host scoping; settings changes for a cloud session go through environment variables or the committed `.claude/settings.json`. |
| `claude --help`, `claude mcp --help` | `--mcp-config` and `--strict-mcp-config` choose servers for a single invocation; `claude mcp reset-project-choices` resets approvals. No host-conditional option. |

Routes the packet owner could consider. None is applied here, and none is
host-conditional settings syntax. Only route 1 and the hook form of route 2
are documented behavior:

1. **Per-machine split by file location.** Files in `~/.claude.json`,
   `~/.claude/settings.json` or `.claude/settings.local.json` stay on that
   machine and never reach a cloud VM. The repo already relies on this for
   user-level settings (runbook `docs/runbooks/cloud-environments.md`).
   Workstation-only servers could move from `.mcp.json` to local or user
   scope.
2. **A script-side check on `CLAUDE_CODE_REMOTE`.** The cloud-environments
   page documents this for **hooks**: "hooks run in both local and cloud
   sessions. To skip local execution, exit early unless the
   `CLAUDE_CODE_REMOTE` environment variable is `true`." The repo's hooks
   already key off the explicit `BEEP_AGENT_HOST=cloud` (D3). A stdio server's
   `command` could point at a wrapper script that makes the same check. The
   docs do not describe that pattern for MCP. It is a possible owner design,
   not a supported MCP conditional setting, and it is untested here. Under
   the documented stdio failure rule, a wrapper that exits without serving
   would likely show up as a failed server.
3. **Org-admin managed MCP** (`managed-mcp.json` or `managedMcpServers`). It
   is per-machine or organization-wide policy, outside this repo's control.

### Expected availability in a Claude cloud session (current `main`)

Server names and transports come from `.mcp.json`; approval lists from
`.claude/settings.json`. No value, command or credential was resolved. The
"Observed" column is this session's start report: a real Anthropic-hosted
session with ambient `BEEP_AGENT_HOST=cloud` and `CLAUDE_CODE_REMOTE=true`.

Two starts are recorded. **Startup** ran on a VM whose toolchain already
matched. **Resume** came later in the same session on a replaced VM, where the
bootstrap hook reinstalled dependencies (see 2a).

| Server | Transport | Committed approval | Startup | Resume (cold VM) | Expectation |
| --- | --- | --- | --- | --- | --- |
| `shadcn` | stdio | — | connected | failed: connect timeout (30 s) | connected in this session's startup; can time out |
| `next-devtools` | stdio | — | connected | failed: connect timeout (30 s) | connected in this session's startup; can time out |
| `nlp` | stdio | — | connected | connected | connected in both observed starts (after bootstrap) |
| `fallow` | stdio | — | connected | connected | connected in both observed starts (after bootstrap; F11's ENOENT was pre-bootstrap) |
| `beep-m365-outbox` | stdio | — | failed: `op` not found | same | expected to fail while `op` is absent from the cloud VM (bootstrap reports `op missing`) |
| `stately` | http | `enabledMcpjsonServers` | failed: proxy refused tunnel (403) | same | expected failure under the current allowlist (not expanded) |
| `phoenix-docs` | http | `enabledMcpjsonServers` | failed: proxy refused tunnel (403) | same | expected failure under the current allowlist (not expanded) |
| `serena` | stdio | `disabledMcpjsonServers` | not attempted | not attempted | not connected wherever the committed settings are read |
| `chrome-devtools` | stdio | `disabledMcpjsonServers` | not attempted | not attempted | not connected |
| `webstorm` | http | `disabledMcpjsonServers` | not attempted | not attempted | not connected |
| `phoenix` | http | `disabledMcpjsonServers` | not attempted | not attempted | not connected |

A PR review reported the same 30 s timeouts for both servers in another cloud
session on 2026-11-02, after a worker restart; that was not verified here.
The cause of the two resume timeouts was not established. They coincided with
the 57-second dependency reinstall, but no measurement links them.

The GitHub MCP tools in a cloud session come from the vendor session, not
`.mcp.json`.

All of these failures are **optional MCP connection errors**. They are not repo-hook
errors, and the session continued without those tools. D7 named `serena`,
`webstorm`, `phoenix`, `phoenix-docs` and `chrome-devtools`. Current `main`
differs: four of those are rejected by committed settings and were not attempted in either observed start, and
`beep-m365-outbox` and `stately` are additional cloud failures. The runbook's
prose bullet already names the three observed failures. D7 asks for a runbook
*table*, which belongs to P4 doctrine work and is still open.

## 2. Cloud SessionStart/Stop hook evidence

Hooks on `main` (`.claude/settings.json`): SessionStart runs `bootstrap.sh`
(startup and resume only), `packet-projections.sh`, `yeet-inbox.sh`,
`hook-pulse.sh` and `session-ledger.sh`. Stop runs `hook-pulse.sh` and
`yeet-inbox.sh`. SessionEnd runs `hook-pulse.sh`. No graft hook exists.

### 2a. Real vendor session (this session, read-only)

Scope: these receipts cover one Anthropic-hosted cloud session with a single
repository, outside a project thread. A cloud **project thread** runs none of
the repo's `.claude/settings.json` hooks (`settings` page, "Settings in cloud
sessions"), so this evidence does not carry over to project threads.

Source: this session's own transcript under the Claude project directory.
Only types, event names, exit codes and stderr lengths were read; no payload
or environment was printed.

The transcript only records a hook that wrote output or failed. A silent
successful hook leaves no record, so the silent hooks' exit codes and stderr
are not available. Debug logging was not enabled, and enabling it is out of
scope.

**SessionStart, startup:**

- One `hook_success` record from the bootstrap hook: exit `0`, stderr empty,
  360 ms. Its stdout said the toolchain already matched.
- No error or cancellation records.
- `packet-projections`, `yeet-inbox`, `hook-pulse` and `session-ledger` left
  no record.

**Stop, the first two turns (06:12:05Z and 06:12:23Z):**

- Each `stop_hook_summary` shows `hookCount` 3, `hookErrors` 0 and
  `preventedContinuation` false.
- The three hooks were repo `hook-pulse.sh` (97–98 ms), repo `yeet-inbox.sh`
  and a vendor user-level `~/.claude/stop-hook-git-check.sh`. The vendor hook
  is not repo code.
- `yeet-inbox.sh` has its own `hook_success` record each time: exit `0`,
  stderr empty, 3-byte stdout.
- **Limit:** `hook-pulse.sh` has no record of its own beyond the summary's
  error count.

**SessionStart, resume on a replaced VM:**

- The bootstrap hook reinstalled dependencies and succeeded: exit `0`, 57.4 s.
  Its stderr held only bun install progress lines.
- Two **repo hooks were cancelled for timing out**, recorded as
  `hook_cancelled` with `timedOut: true`:
  - `yeet-inbox.sh` hit its 2,000 ms timeout and ran 2,647 ms.
  - `packet-projections.sh` hit its 30,000 ms timeout and ran 30,020 ms.
- These are repo-hook failures, not MCP errors. The session-start banner
  showed only the bootstrap success.
- The cause was not established. Both overlapped the dependency reinstall.
  `packet-projections.sh` passes its `node_modules/effect` guard whenever the
  directory exists, then runs `goals index` and `explore atlas`. This research
  lane fixes nothing; the finding goes to the hook owner.
- `hook-pulse` and `session-ledger` left no record on resume.

### 2b. Hermetic simulation (not vendor evidence)

The startup VM ran an ad hoc version of these steps. The appendix script
packages the same steps and was run on the replaced VM with identical
results. A scratch copy
of `.claude/hooks/` was placed in a throwaway git project
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

- Pulse rows kept flowing: one row per event per host, 6 in all for
  SessionStart, Stop and SessionEnd. Each row has 11–12 `HookPulseV1` fields.
  The two PermissionRequest control runs add 2 more rows, so the harness
  prints `pulse_rows=8`. Cloud rows still
  stamp `notifierRev: desktop-ntfy-1`, the open gap recorded in
  `2026-11-01-cloud-hook-guard.md`.
- PermissionRequest control: the stub notifier was called 0 times with
  `BEEP_AGENT_HOST=cloud` and once with the variable unset. The stub is
  reachable, and the #2492 guard holds.
- Matrix command, run separately (it is not in the appendix script): `BEEP_AGENT_HOST=cloud bash .claude/hooks/hook-pulse.sh < /dev/null`:
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
| MCP host-scoping research | **answered within limits**: no documented host-conditional syntax in the reviewed sources (not an exhaustive negative) | §1 |
| SessionStart emits no error lines in a real cloud session (single repo, not a project thread) | **not met on a cold resume**: startup was clean, but on resume the repo hooks `yeet-inbox.sh` and `packet-projections.sh` were cancelled for timing out; silent hooks have no receipt | 2a |
| Stop emits no error lines in a real cloud session | **proven for two real Stop events** (`hookErrors` 0); limit: `hook-pulse.sh` has no record of its own | 2a, 2b |
| Without the variable, behavior byte-identical to before | **open**: the hermetic runs match on exit code and stderr only; no byte comparison against pre-guard writers was made | 2b |
| D7 runbook *table* | **open** (P4): the runbook has a prose bullet | §1 |

Next work to close row 4:

- The hook owner needs to address the resume timeouts.
- A receipt for the silent SessionStart hooks, from a later transcript or a
  `--debug=hooks` file if the packet owner allows one.
- A byte comparison of hook output with the variable unset against the
  pre-guard writers.

## Not investigated

A separate review noted that `Bun.spawnSync` tests may be exposed when coverage
runs under Node. It is unproven and outside this research lane; it was not
examined here.

## Appendix: hermetic hook harness

Run from the repo root with `bash <file>`. The harness:

- uses a `mktemp -d` scratch directory, which it deletes on exit;
- copies the hooks and stubs the notifier and the network CLIs;
- runs the exact hook commands from `.claude/settings.json` under `env -i`;
- prints only exit codes, line counts and call counts;
- skips `bootstrap.sh`;
- needs no network access, secrets, live ledger or live notifier.

```bash
#!/usr/bin/env bash
# Hermetic SessionStart/Stop/SessionEnd hook run. Run from the repo root.
# Temp HOME/state, copied hooks, stub notifier and network CLIs; prints
# only exit codes, line counts and call counts. Skips bootstrap.sh.
set -u
repo="$(git rev-parse --show-toplevel)"
S="$(mktemp -d)"; trap 'rm -rf "$S"' EXIT
mkdir -p "$S"/{proj/.claude,home,state,out,stubbin}
cp -r "$repo/.claude/hooks" "$S/proj/.claude/hooks"
printf '#!/usr/bin/env bash\necho call >> "%s/out/notifier-calls"\n' "$S" \
  > "$S/proj/.claude/hooks/sequence-break-notifier.sh"
for b in curl notify-send ntfy; do
  printf '#!/bin/sh\necho %s >> "%s/out/net-calls"\n' "$b" "$S" > "$S/stubbin/$b"
done
chmod +x "$S"/stubbin/* "$S/proj/.claude/hooks/sequence-break-notifier.sh"
git -C "$S/proj" init -q
git -C "$S/proj" remote add origin https://github.com/beep-effect/beep-effect.git
jq -c '.hooks' "$repo/.claude/settings.json" > "$S/hooks.json"
P="$S/stubbin:/usr/bin:/bin:$(dirname "$(command -v jq)"):$(dirname "$(command -v bun)")"
hook_env() { env -i PATH="$P" HOME="$S/home" XDG_STATE_HOME="$S/state" \
  CLAUDE_PROJECT_DIR="$S/proj" BEEP_SEQUENCE_BREAK_FOREGROUND=1 ${1:+BEEP_AGENT_HOST=$1} "${@:2}"; }
run() { # host event payload
  local i=0
  jq -r --arg ev "$2" '.[$ev][] | .hooks[].command' "$S/hooks.json" |
  while IFS= read -r cmd; do
    i=$((i+1))
    case "$cmd" in *bootstrap.sh*) echo "${1:-unset} $2 #$i bootstrap.sh: skipped"; continue;; esac
    hook_env "$1" timeout 30 bash -c "$cmd" <<<"$3" >"$S/out/o" 2>"$S/out/e"; rc=$?
    echo "${1:-unset} $2 #$i $(grep -o '[a-z-]*\.sh' <<<"$cmd" | tail -1): exit=$rc" \
      "stdout_lines=$(wc -l <"$S/out/o") stderr_lines=$(wc -l <"$S/out/e")"
  done
}
for h in cloud ""; do
  for ev in SessionStart Stop SessionEnd; do
    run "$h" "$ev" "{\"session_id\":\"hermetic-1\",\"hook_event_name\":\"$ev\",\"source\":\"startup\",\"cwd\":\"$S/proj\",\"transcript_path\":\"/nonexistent\"}"
  done
done
for h in cloud ""; do
  rm -f "$S/out/notifier-calls"
  hook_env "$h" BEEP_HOOK_PULSE_NOTIFIER_REV=desktop-ntfy-1 bash "$S/proj/.claude/hooks/hook-pulse.sh" \
    <<<"{\"session_id\":\"hermetic-1\",\"hook_event_name\":\"PermissionRequest\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"true\"},\"cwd\":\"$S/proj\"}"
  echo "${h:-unset} PermissionRequest hook-pulse.sh: exit=$? notifier_calls=$(cat "$S/out/notifier-calls" 2>/dev/null | wc -l)"
done
echo "pulse_rows=$(find "$S/state" -path '*hook-events*' -name '*.ndjson' -exec cat {} + | wc -l)" \
  "net_stub_calls=$(cat "$S/out/net-calls" 2>/dev/null | wc -l)"
```
