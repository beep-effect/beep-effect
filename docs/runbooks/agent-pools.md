# Agent pools

## Purpose

Binding pool-order doctrine for token-heavy agent lanes in beep-effect. Orchestrators read
`AGENTS.md` for the rule and this runbook for copy-paste launch recipes, meters, and failure
signatures. Goal B (`beep agent-pool pick`) automates the picker; until then, choose lanes by hand.

## Pool order

The approved model defaults and delegation policy (operator, 2026-10-01, amended 2026-10-14) replaced the
three-step pool order of 2026-09-24 (Opus only → authorized Cursor → hold). Two chains now
exist, keyed by the orchestrator that started the work, and each step runs at medium effort
where the route supports it:

| Originator | 1 | 2 | 3 |
| --- | --- | --- | --- |
| Codex | `gpt-6.1-sol` medium through the Codex CLI, plugin, or `claudex` proxy | `cursor-agent --model claude-opus-5-5-medium` | grok-build (`grok -m grok-4.7 --effort medium`) |
| Claude Code | `claude-opus-5-5` medium child (Agent tool, Workflow child, `claude -p`) | `cursor-agent --model claude-opus-5-5-medium` | grok-build (`grok -m grok-4.7 --effort medium`) |

Defaults: Codex `gpt-6.1-sol` medium (`$HOME/.codex/config.toml`); the Claude Code orchestrator
runs `claude-fable-5-1` medium (`$HOME/.claude/settings.json`) and every Claude child runs
`claude-opus-5-5` medium. Within these routes same-provider substitution (`gpt-6-sol`,
`claude-opus-5`, the `fable`/`opus` aliases) is a drift, not a fallback. Named roles are not
substitutions: the `review.panel` members (`gpt-6-astra`, `claude-fable-5-1`, `grok-4.7`, all
xhigh) and the Junie volume pool below. The lightweight route (`gpt-6-luna` default children)
keeps its lightweight tasks.

**Junie volume pool (2026-10-14).** JetBrains AI Pro credits are a separate, chronically
unspent pool. While `bun run beep accounts` shows JetBrains credits left in the cycle, route
bounded implementation, exploration and second-opinion review lanes to Junie first (recipe
below). Junie is not a chain step: a quota failure elsewhere still steps the originating chain
down, and a Junie worker never delegates onward.

Keep GPT-6 Luna lightweight routes and Grok 4.7 web research. Graft deep uses
Opus 5.5 through the proxy. Junie is a bounded spend-down pool when JetBrains
credits remain, not a fallback; Muse remains opt-in. The manifest's separate
JSDoc title-migration specialist uses Grok 4.7. Historical probes below retain
their dates and results; current recipes use the live declared pins.

## Meters

### Opus

`bun run beep accounts` opens a live screen of every Claude, Codex, Muse Code, and Grok Build account
the local proxy holds a login for: one panel per provider, each ranked on its own, re-polled every
60 seconds (`--every <seconds>`, at least 15; `r` polls now, `q` quits). Inside the Claude and Codex
panels the account to use next carries `▶`, and the panel title says whether to stay on the account
the CLI is signed in to (`●`, read from the Claude and Codex CLIs' own config files) or switch.
Ranking: ready accounts first; a week already running down before an untouched one, whose quota
cannot expire while it waits; then weekly percent left per hour until reset. Every percentage means
quota left. A detail line shows the session window, model-scoped windows, credit balances (Claude
cloud session credits with their expiry, ChatGPT credits), unused ChatGPT limit resets, and the plan.
A poll that fails keeps the account's last good reading, marked with its age. `bun run beep accounts
status` prints the same board once; `--json` emits the `accounts-status/v2` report (one group per
provider). Muse reports no windows while its five-hour window is idle. Cursor is not polled (D17):
the SuperGrok Heavy panel shows `accounts-snapshot/v1` files that a local collector leaves in
`$HOME/.local/state/beep/accounts/` (`BEEP_ACCOUNTS_SNAPSHOT_DIR` overrides), each with its age; a
snapshot window that has reset since capture shows as `ready (est.)`. It only reads the proxy's
stored logins under `$HOME/.cli-proxy-api`; an account appears once it is signed in to the proxy,
and one whose login the provider rejects shows as
`needs login`. The usage endpoints are undocumented and can change without notice, so inside a
running lane the signal is still the request itself. A delegation that fails with `rate_limit_error` ("This request would exceed your
account's rate limit") marks the Opus pool below floor for the session: finish what is already
running, then step the Claude chain down (2026-10-01 policy): launch the next bounded lane on
`cursor-agent --model claude-opus-5-5-medium`, and when Cursor is below floor too, on grok-build
`grok -m grok-4.7 --effort medium`. Hold and notify only when both fallbacks are exhausted.
Never route the step onto Codex. `claude` shows the live windows with `/usage`.

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
| `rateLimits.primary.usedPercent` | Primary window consumption (0–100). Codex is at or below the floor when `usedPercent` ≥ 95. For a Codex orchestrator that means: finish running lanes, then step the Codex chain down to `cursor-agent --model claude-opus-5-5-medium`, then grok-build; never onto direct Claude. Hold and notify once both fallbacks are exhausted. |
| `rateLimits.primary.resetsAt` | ISO timestamp when the primary window resets. |
| `rateLimits.primary.windowDurationMins` | Window length in minutes (CLI account: 10080 = weekly). |
| `rateLimits.secondary` | Secondary window with the same shape when present. |
| `rateLimitsByLimitId` | Per-alias limits keyed by quota id (this workstation: `codex`, `codex_bengalfox`). |

The picker (Goal B) evaluates the union: CLI account via the probe above; proxy accounts via
CLIProxyAPI management API when it exposes quota, else probe fallback (D8).

### Cursor

**Fail-open (D17, amended 2026-10-01).** Cursor is step 2 of both chains, so a confirmed quota,
availability, or unsupported-model failure on step 1 is the only trigger that moves a lane onto
it; Cursor then counts as available until a lane proves otherwise, unless the dashboard already
shows less than 5% remaining in the target bucket (see Human meter). A below-floor bucket marks
Cursor below floor before admission, and the lane steps straight to grok-build. Ordinary code
failures and unfavorable reviews never move a lane. No official per-account usage endpoint exists for individual Ultra.
Team Admin API routes (`/teams/spend`, `/teams/daily-usage-data`) are team-scoped. `cursor-agent
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
| Fallback (policy 2026-10-01, id 2026-10-14) | `claude-opus-5-5-medium` | — | Other Models | Opus 5.5 list price |
| Review / adversarial | `claude-opus-5-5-high` | `gpt-5.6-sol-xhigh` | Other Models | Opus 5.5 list price; $4 / $20 |
| Lightweight mechanical | `composer-2.5` | `gpt-5.6-luna-high` | Cursor Models → Other | $0.50 / $2.50; $0.20 / $1.20 |

Manifest projection of the Cursor seats (tool-owned block):

<!-- beep-models:begin cursor-seats -->
| Role | Surface | Model | Effort |
| --- | --- | --- | --- |
| fallback.cursor | cursor-seat | `claude-opus-5-5-medium` | — |
| cursor.volume | cursor-seat | `composer-2.5` | — |
| cursor.review | cursor-seat | `claude-opus-5-5-high` | — |
| cursor.mechanical | cursor-seat | `composer-2.5` | — |

superseded: gpt-5.6-sol, gpt-6-sol, grok-4.6, gpt-5.6-luna, claude-opus-5, claude-opus-5-thinking-high, muse-spark-1.3, grok-4.5, gpt-5.4, gpt-5.4-mini
<!-- beep-models:end cursor-seats -->

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
`beforeShellExecution` with `failClosed: true`. It denies in two cases, and a crash, a timeout, or
an unreadable payload also blocks the command:

- **A denied name in any token.** Before splitting it deletes backslashes and quotes, so `\git`,
  `g"i"t`, and `git\ status` rejoin into the real word, then treats shell operators, backticks, `$`,
  and `=` as separators. Arguments count: `echo git` and `rg sudo` are denied on purpose.
- **Any shell expansion.** `$name`, `${...}`, `$(...)`, `$'...'`, positional parameters, and
  backticks and pathname globs (`*`, `?`, `[`, `]`) are refused, because a static scan cannot
  know what `a=su; ${a}do` or `/usr/bin/g[i]t` produces. A regex anchor such as
  `grep -E 'end$'` is denied too, since the guard cannot tell it from `$'...'`.

Lanes therefore pass literal values and search with the agent's file tools instead of shell. Smoke
(goal history `2026-09-16-deny-shell-proof.md`): 27 command fixtures plus five payload fixtures.
An interpreter that assembles a name at runtime (a Python or Node string) stays out of static
reach. The post-lane git state check below catches git writes from that route. `sudo` still needs a
YubiKey touch on a per-terminal ticket, which a headless lane cannot supply.

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
  git ls-files --stage | sha256sum
}
git_state > "$LANE.git-before"   # before launching the lane
git_state | diff "$LANE.git-before" - && git status --porcelain   # after the lane exits
```

The index digest covers staged content, not just staged paths, so re-staging a changed file also
shows up. Any diff line means a git write happened inside the lane: stop and inspect before staging.

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

## Opus lane recipe

Every delegation carries the explicit id and medium effort. Native subagent through the Agent tool:

```text
Agent({ subagent_type: "general-purpose", model: "claude-opus-5-5", prompt: "<bounded task>" })
```

Workflow child:

```js
await agent("<bounded task>", { model: "claude-opus-5-5", phase: "Implement" })
```

Cursor fallback (step 2 of either chain), verified 2026-10-14:

```sh
timeout 1800 cursor-agent -p --trust --force --sandbox enabled --workspace "$PWD" \
  --model claude-opus-5-5-medium --output-format stream-json "<bounded task>" </dev/null
```

`cursor-agent --list-models` lists `claude-opus-5-5-{low,medium,high,xhigh,max}` since
2026-10-14 (the bare `claude-opus-5-5` is still accepted and is the same seat). The stream-json
init event reports `"model":"Claude Opus 5.5 300K Medium"` for `-medium` and `… High` for
`-high`; the list's "1M" label is cosmetic, and `claude-opus-5-5[effort=medium]` is rejected.
On 2026-10-14 `--sandbox enabled` failed on the workstation with "Sandbox mode is enabled but not
available on this system … possibly due to AppArmor configuration". The hint is generic: AppArmor
was not an active LSM on that boot, unprivileged `unshare` worked, and after the reboot into kernel
7.2.10 the same sandboxed lane ran a shell tool cleanly. Diagnose before touching host security
settings, and never drop to `--sandbox disabled` for a real lane:

```sh
cat /sys/kernel/security/lsm                      # is apparmor an active LSM at all?
unshare --user --map-root-user true && echo ok    # unprivileged user namespaces
cursor-agent sandbox run echo sandbox-ok          # Cursor's own sandbox, no model call
```

Only when `apparmor` is listed and `unshare` fails does the host fix below apply. grok-build fallback (step 3):

```sh
grok -m grok-4.7 --effort medium --always-approve --no-subagents --max-turns 60 \
  -p "<bounded task>" --output-format streaming-json --no-auto-update </dev/null
```

`modelUsage` reports `grok-4.7-build`; `--effort` is accepted but not echoed back. Neither
worker delegates onward.

Bounded scope, files written early and refined in place, and the orchestrator stages by name —
the same prompt contract as the Cursor lane. Continue related follow-ups on the same subagent
(SendMessage) instead of spawning fresh ones.

**Proxy sessions.** `claudex`, `claudeg`, `claudep`, and `claudem` children use the same id.
CLIProxyAPI did not route `claude-opus-5-5` on 2026-09-27 (`unknown provider for model`); its
`GET /v1/models` lists the id since 2026-10-14, so proxy Workflow children can take the Opus pin.
Do not set `CLAUDE_CODE_SUBAGENT_MODEL` in proxy wrappers.

## Junie lane recipe

Junie (`junie` CLI, JetBrains AI Pro) is the spend-down volume pool. Check the meter first:
`bun run beep accounts status` shows the JetBrains row with credits left, cycle used percentage,
and the next refill date when detailed quota is available. Its cycle window uses the existing
ranking: a large unused balance near reset makes this pool urgent to spend. Detailed-quota
failures preserve the balance-only row. Stored access tokens without a cached ID token skip
the cycle window until the normal refresh-on-rejection path supplies one. Then run one bounded
lane per invocation, verified 2026-10-14:

```sh
timeout 1800 junie --model=claude-opus-5-5 --effort=medium --output-format json \
  --skip-update-check -p "$PWD" "<bounded task>" </dev/null > junie-result.json
```

`--effort` accepts `low|medium|high`. The JSON `llmUsage[]` array is the identity evidence:
the primary entry reports `model: claude-opus-5-5` with a `cost`; Junie also bills small helper
models there (title, routing), so sum `cost` for the lane. A trivial lane cost about $0.15,
mostly a one-time 26k-token cache write. The JetBrains route also accepts `claude-fable-5-1`,
`gpt-6.1-sol`, `gpt-6-astra` and `grok-4.7` (bundled catalogue); keep `claude-opus-5-5`
unless a task names another. Junie lanes leave the tree dirty; the orchestrator stages by name
and commits. Junie never delegates onward and follows the Cursor data boundary (D11).

## Codex lane recipe

A Codex orchestrator (or a task the operator names Codex for) launches the volume lane:

```sh
codex exec --model gpt-6.1-sol -c 'model_reasoning_effort="medium"' \
  "<bounded task prompt>" </dev/null
```

Run it from the lane's worktree root. Working-directory, sandbox, `--add-dir`, and commit-capable
flags follow the operator's Codex rules; this runbook does not restate them.

Pin model and reasoning effort per `AGENTS.md` "Volume pools". The Codex plugin/companion
(`--model gpt-6.1-sol --effort medium`) and proxy Workflow children (`gpt-6.1-sol(medium)`) use
the same pins. Verified 2026-10-01: the session rollout records `model=gpt-6.1-sol`,
`reasoning_effort=medium`; `$HOME/.codex/models_cache.json` had not yet listed the id, so the
interactive picker may lag while `-m gpt-6.1-sol` works.

## Failure signatures and remedies

| Signature | Remedy |
| --- | --- |
| Hang / no exit | Host `timeout 15m` (no CLI wall clock; watch scripts and stuck subagents hold `-p`). |
| Silent denials (changes not applied) | Add `--force`; without it print mode only proposes changes. |
| Fast id default / 6× burn | Pin non-fast ids (`composer-2.5`, not `composer-2.5-fast`). |
| `--mode plan` in CI, no output | Drop plan mode for headless implement lanes. |
| Stuck subagent holds `-p` | Single-turn `-p` waits for delegated subagents; kill or avoid Explore subagents. |
| Cursor Models spill zeros Other | Floor-check dashboard; stop Cursor-bucket lanes before 100%. |
| `Total usage limit reached` | Mark Cursor below floor; step to grok-build (`grok -m grok-4.7 --effort medium`), then hold and notify when that is exhausted too. |
| `rate_limit_error` on a `claude-opus-5-5` delegation | Opus pool below floor: finish running children, then step the Claude chain to `cursor-agent --model claude-opus-5-5-medium`, then grok-build; hold and notify only after both. |
| Sudo / YubiKey prompt hang | `Shell(sudo)` and `Shell(pkexec)` in deny list (D21). |
| Workspace trust hang | `--trust` on every headless lane. |
| Missing `result/success` + exit 0 | Treat as failure; inspect stderr. |
| `GraphQL: API rate limit exceeded` from `gh pr view\|edit\|ready\|merge\|checks` | GitHub GraphQL is one 5,000-point hourly budget shared by every session on the account (resets at the hour's `resetAt`). Use `bun run beep yeet gh <command>` (REST for PR status, labels, comments, checks, and merge; the ready flip and thread read go through a budget guard that waits for the reset, or exits 75 with `--no-wait`). `bun run beep yeet gh rate-limit` shows both budgets. An identity with its own budget: `--token-ref op://…` / `BEEP_GH_TOKEN_REF`, or a GitHub App via `BEEP_GH_APP_ID`, `BEEP_GH_APP_INSTALLATION_ID`, `BEEP_GH_APP_KEY_REF`. |
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

## Desktop permission continuity

Use the [permission continuity runbook](./agent-permission-continuity.md) for
effective-policy readers, disposable Desktop route fixtures, and the rule to
stop on a mismatch. A visible composer label is not runtime policy evidence.

## Native model configuration writes and recovery

`bun run beep models apply` validates owned spans and native syntax before writing.
`bun run beep models restore --journal <id>` uses the same publication protocol.
Both require GNU `mv --exchange --no-copy` (Linux `renameat2(RENAME_EXCHANGE)`);
the service probes support once using disposable files. Unsupported exchange
fails closed with a typed `ModelsLocatorError`; there is no unverified-concurrency
fallback for home or repository files.

Publication atomically exchanges the staged file and live path, then checks the
actual displaced entry kind, inode and hash against the planned pre-image. A
displaced symlink is refused even when its target has the planned inode/hash. A mismatch is a
concurrent-write failure, even if recovery succeeds. Recovery exchanges files
again and verifies what it displaced; a newer writer encountered during recovery
is returned through a further exchange. Recovery is bounded to eight exchanges;
continuing contention fails and retains both path occupants rather than deleting
recovery state. Errors name the journal id. The `.concurrent` event records the
retained and displaced artifact paths; inspect these and the current native file
before manual recovery. Never blindly copy a stale backup over a newer file.

Native clients that hold an already displaced inode may still write after its
last observation. Use a maintenance boundary excluding those clients when strict
mutual exclusion is required. The writer detects observed races and preserves
recovery artifacts; it does not lock native clients out.

ModelsApply `apply --write` and `restore` support only TOML and JSON locators,
whose parsed non-owned fields are independently compared. Under
RSC-F-WRITE-SCOPE-TOML-JSON, YAML, XML and shell targets are check-only.
`models check` and `models apply --check` detect drift; default apply and
`--dry-run` preview the expected value without creating backups or stages.
Write and restore requests return a typed `<format> targets are check-only;
edit by hand.` refusal. This includes equal values, YAML manifest targets,
XML escaped-JSON attributes and historical recovery journals. Repository
Markdown and TypeScript projection owners retain their separate generation
commands; ModelsApply does not write those formats either.

Shell, YAML and XML readers return extracted values only as hints. Both
`models check` and `models apply --check` always report `manual verification
required` for these targets; equality of a hint never certifies clean. The JSON
report carries a separate `manual` array with that status and the extracted
`current` hint. The summary counts distinct manual targets separately from drift
findings. Manual status alone exits zero; recognized drift and unsupported forms
exit non-zero. Only TOML and JSON can be certified clean. Re-enabling another
format requires a full-fidelity parser, parsed non-owned-field equality and its
own independent panel (RSC-F-NO-CLEAN-WITHOUT-FULL-PARSER).

YAML reads simple block-mapping scalars and accounts for plain keys; anchors,
aliases, tags, flow collections, complex keys, multiline scalars and multiple
documents fail closed. XML reads exact elements and attributes with single or
double quotes; prefix and qualified element names cannot stand in for the owned
element. Occurrences inside comments, CDATA and processing instructions fail
closed. Re-enabling any removed writer requires a full ownership model and its
own independent panel.

New journals record locator ownership, the canonical regular file, and the
requested path plus link spelling when present. Restore re-resolves both paths
and verifies entry kind and target before staging, then checks again before
publication. A symlink introduced at the canonical path, a moved target, a
changed parent link or changed requested link refuses with a typed error naming
the journal. Existing symlinks survive normal apply/restore. Check-only-format journals and
older journals lacking ownership or destination identity refuse safely; retain
their backups for manual recovery after inspecting current state.

A TOML/JSON refusal before publication can retain a backup and journal pair
without changing the native file. These are diagnostic recovery artifacts;
restore is an idempotent no-op when the live hash already equals `beforeHash`.
Keep the pair until the refusal has been investigated, then remove the pair
through the normal backup-retention process. Never treat an unsuccessful apply
as evidence that publication occurred.

Skill projection and lockfile writes resolve existing symlinks before backup,
staging and publication; remote skill directories follow the same rule. Stages
live beside the canonical target and backups hold its prior bytes. The visible
link remains a link. All destinations and existing parents must resolve within
the repository root; dangling and out-of-root links refuse before the update
creates backups or stages. ModelsApply already resolves the native target;
its command boundary validates the canonical target against the selected home
or repository root, and explicitly refuses dangling optional destinations.


Write eligibility also requires the matching `.toml` or `.json` extension on the
canonical target path, successful parsing of current bytes and an existing owned
path (except an already absent removal). A locator tag cannot authorize a shell
or YAML destination even if its bytes parse as TOML or JSON. The CLI preflights
format, locator and extension before any target access or optional-file skip;
the service repeats the guard on canonical paths. Historical restore journals
receive the same checks before target publication or new backup artifacts.
