# Agent pools

## Purpose

Binding pool-order doctrine for token-heavy agent lanes in beep-effect. Orchestrators read
`AGENTS.md` for the rule and this runbook for copy-paste launch recipes, meters, and failure
signatures. Goal B (`beep agent-pool pick`) automates the picker; until then, choose lanes by hand.

## Pool order

Three steps, evaluated in order on every admitted lane (D2, D7, D8):

1. **Codex pool.** When any admitted Codex account has more than 5% weekly remaining, launch
   `codex exec` on `gpt-6-astra` with `medium` reasoning (D3, D8). The union of accounts
   includes the `codex` CLI login and OAuth credentials admitted to CLIProxyAPI.
2. **Cursor pool (fail-open).** When Codex is at or below the floor, launch `cursor-agent -p`
   on the seat for the lane tier (D6, D17). Cursor counts as available until a lane proves
   otherwise (see Meters).
3. **Hold and notify.** When both pools are below floor, queue the lane and notify the
   operator. Fable children are never the fallback pool (D7). `grok-4.6` proxy lanes
   (CLIProxyAPI, xAI) stay reserved for research-class work (D7) — not to be confused with
   `cursor-grok-4.6-xhigh`, the Cursor volume fallback seat (D16).

## Meters

### Codex

The Codex app-server protocol exposes `account/rateLimits/read` and
`account/rateLimits/updated` (confirmed from `codex app-server generate-json-schema`,
2026-09-16). Stdin must stay open; on this workstation the reply arrived in under 40 s, so
hold stdin for about 40 s.

```sh
( printf '%s\n' '{"id":1,"method":"initialize","params":{"clientInfo":{"name":"beep-probe","version":"0.0.1"}}}'
  sleep 1; printf '%s\n' '{"method":"initialized"}'
  sleep 1; printf '%s\n' '{"id":2,"method":"account/rateLimits/read","params":null}'
  sleep 40 ) | timeout 50 codex app-server 2>/dev/null \
  | jq -c 'select(.id==2) | .result | {ordinaryUsageAllowed, used: .rateLimits.primary.usedPercent, resetsAt: .rateLimits.primary.resetsAt}'
```

**Field meanings:**

| Field | Meaning |
| --- | --- |
| `ordinaryUsageAllowed` | Boolean gate. `null` means unavailable — do not infer availability from percentages alone. |
| `rateLimits.primary.usedPercent` | Primary window consumption (0–100). Codex is at or below the floor when `usedPercent` ≥ 95 → fall through to the Cursor pool (step 2); hold only when Cursor is also below floor (D7). |
| `rateLimits.primary.resetsAt` | ISO timestamp when the primary window resets. |
| `rateLimits.primary.windowDurationMins` | Window length in minutes (CLI account: 10080 = weekly). |
| `rateLimits.secondary` | Secondary window with the same shape when present. |
| `rateLimitsByLimitId` | Per-alias limits keyed by quota id (this workstation: `codex`, `codex_bengalfox`). |

The picker (Goal B) evaluates the union: CLI account via the probe above; proxy accounts via
CLIProxyAPI management API when it exposes quota, else probe fallback (D8).

### Cursor

**Fail-open (D17).** No official per-account usage endpoint exists for individual Ultra. Team
Admin API routes (`/teams/spend`, `/teams/daily-usage-data`) are team-scoped. `cursor-agent
about`/`status` carry no usage. stream-json emits no usage or rate-limit events
(https://cursor.com/docs/cli/reference/output-format).

**Limit signature.** A lane that exits nonzero with `Total usage limit reached` (user-reported
wording, unpublished — match loosely, never as an exact literal) or kin quota wording in
stderr, and no terminal `type=="result" && subtype=="success"` line in the NDJSON
capture, marks the Cursor pool below floor for the session (D7, D17). On-demand disabled → hard
stop; no quality downgrade (https://cursor.com/help/account-and-billing/overages).

**Human meter.** The Cursor dashboard Usage tab (CSV export) is the operator-facing meter.
Hold Cursor lanes when the target bucket shows less than 5% remaining (human dashboard check,
D7/D17); check the bucket bars before admitting Cursor-bucket lanes (see Seat map).

**No scraper.** Community meters call private `api2.cursor.sh` ConnectRPC endpoints or reuse
dashboard cookies. Cursor staff (Dean Rie, 2026-08-10) classed that with unofficial proxies:
"can trigger abuse enforcement, up to and including an account ban"
(https://forum.cursor.com/t/does-using-oh-my-pi-s-cursor-provider-or-an-openai-compatible-proxy-to-the-same-endpoints-violate-cursor-s-tos/167778).
Do not ship a usage scraper in this public repo (D17).

## Seat map

Ultra meters API-list-price dollars in two buckets
(https://cursor.com/docs/models-and-pricing,
https://cursor.com/help/models-and-usage/usage-limits):

| Tier | Primary | Fallback | Bucket | Input / output ($/1M) |
| --- | --- | --- | --- | --- |
| Volume implementation | `composer-2.5` | `cursor-grok-4.6-xhigh` | Cursor Models | $0.50 / $2.50; $2 / $6 |
| Review / adversarial | `claude-opus-5-thinking-high` | `gpt-5.6-sol-xhigh` | Other Models | $5 / $25; $4 / $20 |
| Lightweight mechanical | `composer-2.5` | `gpt-5.6-luna-high` | Cursor Models → Other | $0.50 / $2.50; $0.20 / $1.20 |

**Never list (D16, D18):** any `-fast` id (`composer-2.5-fast` is 6× input), `auto`, `kimi-k3-*`,
`claude-fable-5-1-*` — on any Cursor lane, volume or review. Always pin the non-fast id
(https://cursor.com/docs/models-and-pricing).

**Spill warning (D7, D16).** Cursor Models drains first, then spills into Other Models; Other
never drains Cursor Models (https://forum.cursor.com/t/possible-bug-in-cursor-token-statistics-other-models-disabled-after-grok-quota-exhausted/169032/5).
Stop Cursor-bucket lanes before the Cursor Models bar hits 100% or the review pool disappears
too. Ultra Other Models allowance is about $400/mo API-list-price
(https://forum.cursor.com/t/how-much-usage-is-available-on-the-200-subscription/163309).

**ZDR note (D11).** Most Cursor seats are ZDR. Fable 5 / 5.1 are NO ZDR — Anthropic retains I/O
~30 days for harm prevention regardless of Privacy Mode
(https://cursor.com/docs/models/claude-fable-5-1). Fable seats are excluded from lanes (D16, D18);
the retention fact is recorded because nothing from the out-of-repo corpus, client documents, or
secrets may enter any Cursor lane prompt.

## Cursor lane recipe v2

Canonical headless volume lane (D12, D13). Capture to `<lane>.ndjson` and `<lane>.stderr`.

**Auth.** One-time `cursor-agent login` on the workstation (the current setup), or
`export CURSOR_API_KEY=…` for CI. Never pass `--api-key` on argv: it is visible in `ps`
(https://cursor.com/docs/cli/reference/authentication).

```bash
LANE=/abs/path/to/captures/run   # one placeholder: <lane> below is $LANE
timeout 15m \
  cursor-agent -p \
    --trust \
    --force \
    --sandbox enabled \
    --workspace /abs/path/to/beep-effect \
    --model 'composer-2.5' \
    --output-format stream-json \
    "Implement <bounded change>. Do not run git. Do not commit, push, or edit .git/. You may read files and run tests. Stop after the diff is in the worktree." \
    </dev/null \
  > "$LANE.ndjson" 2> "$LANE.stderr"
```

**Success rule:** exit code 0 **and** at least one NDJSON line with `type=="result"` and
`subtype=="success"`. Fail on nonzero exit or missing result line
(https://cursor.com/docs/cli/reference/output-format).

**Flags deliberately omitted:**

| Omitted | Why |
| --- | --- |
| `--stream-partial-output` | Assistant text double-counted without timestamp/model_call_id filter. |
| `--worktree` | Forks under `~/.cursor/worktrees/`; GC at 25 per machine. |
| `--approve-mcps` | Headless waits on slow stdio MCP servers. |
| `--mode plan` | CI runs 5–6 min, exit 0, no usable output. |
| `cursor-agent worker` / Cloud Agents API | Same pools plus infra; Aug–Sep 2026 stuck-run class (D6). |

**Prompt contract:** bounded scope; no git, commit, push, or `.git/` edits; write files early
and refine in place; orchestrator stages by name — the lane does not run `git` even though the
binary is not sandbox-blocked (D21).

### jq cookbook

Assume capture file `run.ndjson`. Ignore unknown fields.

```bash
# session id + init metadata
jq -r 'select(.type=="system" and .subtype=="init")
  | "session=\(.session_id) model=\(.model) key=\(.apiKeySource) perm=\(.permissionMode) cwd=\(.cwd)"' run.ndjson

# final assistant text (prefer over concatenating assistant events)
jq -r 'select(.type=="result" and .subtype=="success") | .result' run.ndjson

# commands run (generic function-form tools incl. shell)
jq -c 'select(.type=="tool_call" and .tool_call.function)
  | {subtype, call_id, name: .tool_call.function.name, arguments: .tool_call.function.arguments}' run.ndjson

# D13-style command extraction (also try nested "command" keys)
jq -c 'select(.type=="tool_call") | .. | objects | select(has("command")) | {command}' run.ndjson

# files written (completed)
jq -c 'select(.type=="tool_call" and .subtype=="completed" and .tool_call.writeToolCall)
  | {call_id, path: .tool_call.writeToolCall.result.success.path,
     lines: .tool_call.writeToolCall.result.success.linesCreated,
     bytes: .tool_call.writeToolCall.result.success.fileSize}' run.ndjson

# success check + session_id from result
jq -r 'select(.type=="result") | "subtype=\(.subtype) err=\(.is_error) session=\(.session_id) req=\(.request_id // "")"' run.ndjson
```

Source: https://cursor.com/docs/cli/reference/output-format

## Structural guards

### `.cursor/cli.json` deny list (D21)

Project permissions deny wins over `--force`
(https://cursor.com/docs/cli/reference/permissions):

```json
{
  "permissions": {
    "deny": [
      "Shell(git)",
      "Shell(sudo)",
      "Shell(pkexec)"
    ]
  }
}
```

The sandbox does not block the `git` binary; only protected git metadata paths are write-blocked
(https://cursor.com/docs/reference/sandbox). Deny beats `--force`, making the no-git rule
structural. `sudo`/`pkexec` denial prevents YubiKey prompts that hang headless runs.

`Shell(commandBase)` matches only the **first token** of a command line
(https://cursor.com/docs/cli/reference/permissions), so `/usr/bin/git`, `env git`, and
`bash -lc "git ..."` slip past `cli.json`. The second layer is `.cursor/hooks/deny-shell.sh` on
`beforeShellExecution` with `failClosed: true`: it denies when **any** token's basename is `git`,
`sudo`, or `pkexec`, and a crash or timeout blocks the command. Before splitting it deletes
backslashes and quotes, so `\git`, `g"i"t`, and `git\ status` rejoin into the real word, then
treats shell operators, backticks, `$`, and `=` as separators, so `$(git ...)` and `var=git` expose
the name. Arguments count: `echo git` and `rg sudo` are denied on purpose, so lanes search with the
agent's file tools instead of shell. Smoke (goal history `2026-09-16-deny-shell-proof.md`): 18
fixtures, including the escape, quote-splice, and substitution evasions.

A static scan cannot follow runtime expansion: `a=gi; ${a}t status` still passes the hook. The
post-lane git state check below is the backstop for anything that slips through.

### Transcript verification (tsgo-045 D13)

After a Cursor lane, the orchestrator verifies no git commands ran:

```sh
grep -oE '"command":"[^"]*"' <lane>.ndjson | { grep -cE '\bgit\b' || true; }
```

Count must be 0 (`grep -c` exits 1 on zero matches, hence the `|| true` under `set -e`). The
transcript grep only sees literal command text, so the orchestrator (not the lane) also compares git
state captured before and after the lane:

```sh
git_state() {
  git rev-parse HEAD
  git for-each-ref --format='%(refname) %(objectname)' refs/heads refs/stash
  git diff --cached --name-only
}
git_state > "$LANE.git-before"   # before launching the lane
git_state | diff "$LANE.git-before" - && git status --porcelain   # after the lane exits
```

Any diff line means a git write happened inside the lane: stop and inspect before staging.

## Hooks and metrics

Native `.cursor/hooks.json` (schema `version: 1`) routes six events to the D14 adapter at
`.cursor/hooks/hook-pulse.sh` — it answers Cursor's protocol first, then maps camelCase event names
to PascalCase and runs the shared writer body as `agentKind cursor-cli` under a 3 s cap so metrics
never sit on the allow/continue critical path (D9, D14, D19). A seventh entry,
`beforeShellExecution` → `deny-shell.sh` (`failClosed`), is the D21 second layer (Structural guards).

**Registered in `.cursor/hooks.json`:**

| Event | Ledger event | Headless (`-p`) |
| --- | --- | --- |
| `preToolUse` | PreToolUse | fires (smoke: 3) |
| `postToolUse` | PostToolUse | fires (smoke: 2) |
| `postToolUseFailure` | PostToolUseFailure | fires (smoke: 1) |
| `sessionEnd` | SessionEnd — also the Stop stand-in | fires (smoke: 1) |
| `stop` | Stop | registered; GAP — did not fire headless |
| `beforeSubmitPrompt` | UserPromptSubmit | registered; GAP — did not fire headless |

**Observed in the smoke test, not wired** (`cursor-agent` 2026.09.10, 65 s wall): `sessionStart`
(no `HookPulseEvent` literal; deliberately unwired, D14/SPEC), `afterFileEdit` (no output
channel, so not the law-pulse hook), `beforeShellExecution`, `afterShellExecution`. law-pulse
belongs on `postToolUse`, the only Cursor event that returns `additional_context`, matched on
write tools (Cursor's write `tool_input` carries `path`/`fileText`, not `file_path`); it and the
yeet-inbox P0 deny on `preToolUse` are Goal A follow-on work (`goals/agent-pool-doctrine/PLAN.md`),
not shipped.

**GAPs (D13):** `stop`, `beforeSubmitPrompt`, and any Notification analogue do not fire headless.
UserPromptSubmit and Notification pulses are absent; wait attribution stays comparable only within
the `cursor-cli` harness.

**Cloud Agent differences (D19):** Cloud Agents load only repo command hooks — no `sessionStart` /
`sessionEnd`. Use native `.cursor/hooks.json`; do not rely on the account-flagged third-party
loader (`.claude/settings.json`), which skips PostToolUseFailure and Notification.

**Permission protocol.** Hook stdin delivers snake_case keys (`hook_event_name`, `session_id`,
`cwd`, `transcript_path`, `tool_name`, …) matching what the pulse script already reads. Hooks run
host-side. Every hook on a permission event (`preToolUse`, `beforeShellExecution`,
`beforeMCPExecution`, `beforeReadFile`, `subagentStart`) must print a decision — an empty stdout
is malformed JSON and **blocks the tool**. The adapter prints `{"permission":"allow"}`, the lowest
priority, so a deny from another hook (yeet-inbox P0) still wins; exit 2 denies.

Artifacts: `explorations/cursor-agent-pool/ops/hooks-smoke/`.

## Sandbox notes

`--sandbox enabled` applies `workspace_readwrite` by default
(https://cursor.com/docs/reference/sandbox):

- **Network:** `networkPolicy.default` = `deny`. Allow domains in `<workspace>/.cursor/sandbox.json`
  (repo wins over user `~/.cursor/sandbox.json`). Private ranges (10/8, 172.16/12, 192.168/16,
  127/8, link-local, cloud metadata) stay blocked even when `default: allow`.
- **Protected paths (write-blocked):** `.cursor/*.json`, `.cursor/**/*.json`,
  `.claude/*.json`, `.vscode/**`, `.git/hooks/**`, `.git/config`, `.git/info/attributes`,
  `.cursorignore`.
- **Writable `.cursor` subdirs:** `rules/`, `commands/`, `worktrees/`, `skills/`, `agents/`.
- **Git binary:** not blocked by the sandbox; structural deny in `cli.json` handles no-git (D21).
- **Never `--sandbox disabled`** (SPEC stop condition). If a lane cannot run under the sandbox,
  stop and report the blocked path; `--trust`/`--force` are not a substitute for the boundary.
- **Linux:** process remapped to UID 0 inside user namespace; use `$CURSOR_ORIG_UID` /
  `$CURSOR_ORIG_GID` for Docker `--user` (https://cursor.com/docs/agent/security/run-modes).

`--force` is required with `--sandbox enabled` or non-sandboxable commands are silently denied
(https://cursor.com/docs/cli/headless).

## Codex lane recipe

When Codex is above the 5% floor, launch the existing volume lane unchanged (D2):

```sh
codex exec --model gpt-6-astra -c 'model_reasoning_effort="medium"' \
  "<bounded task prompt>" </dev/null
```

Run it from the lane's worktree root. Working-directory, sandbox, `--add-dir`, and commit-capable
flags follow the operator's Codex rules; this runbook does not restate them.

Pin model and reasoning effort per `AGENTS.md` "Codex (pool 1)". Native subagents, the Codex
plugin/companion, and proxy Workflow children use the same pins. Do not set
`CLAUDE_CODE_SUBAGENT_MODEL` in proxy wrappers.

## Failure signatures and remedies

| Signature | Remedy |
| --- | --- |
| Hang / no exit | Host `timeout 15m` (no CLI wall clock; watch scripts and stuck subagents hold `-p`). |
| Silent denials (changes not applied) | Add `--force`; without it print mode only proposes changes. |
| Fast id default / 6× burn | Pin non-fast ids (`composer-2.5`, not `composer-2.5-fast`). |
| `--mode plan` in CI, no output | Drop plan mode for headless implement lanes. |
| Stuck subagent holds `-p` | Single-turn `-p` waits for delegated subagents; kill or avoid Explore subagents. |
| Cursor Models spill zeros Other | Floor-check dashboard; stop Cursor-bucket lanes before 100%. |
| `Total usage limit reached` | Mark Cursor below floor; hold and notify (D7). |
| Sudo / YubiKey prompt hang | `Shell(sudo)` and `Shell(pkexec)` in deny list (D21). |
| Workspace trust hang | `--trust` on every headless lane. |
| Missing `result/success` + exit 0 | Treat as failure; inspect stderr. |
| Linux sandbox `unshare EPERM` | Host fix `sysctl kernel.apparmor_restrict_unprivileged_userns=0`; if the lane still cannot run, stop and report the blocked path — never `--sandbox disabled` (https://forum.cursor.com/t/agent-cli-linux-sandbox-preflight-fails-unshare-eperm-unless-run-under-strace-apparmor-restrict-unprivileged-userns-1/160039). |

## Sources

https://cursor.com/docs/cli/headless
https://cursor.com/docs/cli/reference/output-format
https://cursor.com/docs/cli/reference/parameters
https://cursor.com/docs/cli/reference/permissions
https://cursor.com/docs/reference/sandbox
https://cursor.com/docs/agent/security/run-modes
https://cursor.com/docs/cli/reference/authentication
https://cursor.com/docs/models-and-pricing
https://cursor.com/docs/models/claude-fable-5-1
https://cursor.com/help/models-and-usage/usage-limits
https://cursor.com/help/account-and-billing/overages
https://forum.cursor.com/t/possible-bug-in-cursor-token-statistics-other-models-disabled-after-grok-quota-exhausted/169032/5
https://forum.cursor.com/t/how-much-usage-is-available-on-the-200-subscription/163309
https://forum.cursor.com/t/does-using-oh-my-pi-s-cursor-provider-or-an-openai-compatible-proxy-to-the-same-endpoints-violate-cursor-s-tos/167778
https://forum.cursor.com/t/agent-cli-linux-sandbox-preflight-fails-unshare-eperm-unless-run-under-strace-apparmor-restrict-unprivileged-userns-1/160039
