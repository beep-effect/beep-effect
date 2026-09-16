# L1 — Cursor CLI headless surface

**Lane:** L1 (CLI headless surface)
**Repo context:** beep-effect Cursor volume pool
**Accessed:** 2026-09-16
**Status:** complete 2026-09-16 (docs.cursor.com 308-redirects to cursor.com/docs; all fetches used cursor.com/docs)

Canonical binary names: `agent` in docs; locally `cursor-agent` (alias `agent`) v2026.09.10-fd3934a.

## Scope

Exact semantics of Cursor Agent CLI (`cursor-agent` / `agent`) for a headless Bash lane analogous to `codex exec`. Official cursor.com/docs first, then changelog, forum, GitHub, X.

---

## 1. Print mode (`-p`) and output formats

### 1.1 `-p` / `--print` semantics

From the parameters reference: `-p, --print` is **"Print responses to console (for scripts or non-interactive use). Has access to all tools, including write and shell."** [web:params]

From Using Agent in CLI: `-p`/`--print` is non-interactive execution; response is printed to stdout; suitable for scripts and CI. **Non-interactive mode has full write access.** [web:using]

From Headless CLI: print mode is the automation entry point. Without `--force`, **proposed changes are not applied**; with `--force`/`--yolo`, the agent may write files. [web:headless]

```bash
agent -p "Analyze this code"
agent -p --force "Refactor this code to use modern ES6+ syntax"
```

Auth for scripts: `export CURSOR_API_KEY=...` or `--api-key`. [web:headless] [web:params]

`--output-format` **only works with `--print`**. Values: `text`, `json`, `stream-json`. Default of `--output-format` is **`text`**. [web:params]

INFERENCE vs local D13: the beep-effect D13 recipe used `--output-format stream-json` explicitly (correct, because default is text, not stream-json). Some search-snippet summaries claimed stream-json is default; the parameters page contradicts that.

`--stream-partial-output` only works with `--print` **and** `stream-json`. [web:params] [web:outfmt]

Output format is also inferred when stdout is non-TTY or stdin is piped (output-format page). [web:outfmt]

### 1.2 `text` format

Emits **only the final assistant message**. No progress, no intermediate assistant segments, no tool-call summaries. Intended for scripts needing clean human-readable output. [web:outfmt]

### 1.3 `json` format

On success, **one terminal JSON object** after completion. No deltas or tool events. [web:outfmt]

```json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "duration_ms": 1234,
  "duration_api_ms": 1234,
  "result": "<complete assistant response>",
  "session_id": "<session UUID>",
  "request_id": "<optional request ID>"
}
```

On failure: process exits **nonzero**, writes error to **stderr**, and **does not emit a valid success object**. [web:outfmt]

**No usage/token-count fields are documented** on the result object. [web:outfmt]

### 1.4 `stream-json` format (NDJSON)

One JSON object per line. Session IDs stay constant for the run. Thinking events are **suppressed in print mode**. Consumers should ignore unknown future fields. A successful stream ends with a `result` event; failed streams **may terminate without one** and write errors to stderr. [web:outfmt]

#### Event: system/init

```json
{
  "type": "system",
  "subtype": "init",
  "apiKeySource": "env|flag|login",
  "cwd": "/absolute/path",
  "session_id": "<session UUID>",
  "model": "<model display name>",
  "permissionMode": "default"
}
```

Additional fields such as `tools` or `mcp_servers` "may be added later". [web:outfmt]

#### Event: user

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [{ "type": "text", "text": "<user prompt>" }]
  },
  "session_id": "<session UUID>"
}
```

#### Event: assistant

```json
{
  "type": "assistant",
  "message": {
    "role": "assistant",
    "content": [{ "type": "text", "text": "<assistant message segment>" }]
  },
  "session_id": "<session UUID>"
}
```

Without `--stream-partial-output`, assistant events contain **complete messages between tool calls**. [web:outfmt]

With `--stream-partial-output`: [web:outfmt]

- Events with `timestamp_ms` and **no** `model_call_id` contain new text → **append**.
- Events with **both** `timestamp_ms` and `model_call_id` are buffered pre-tool-call duplicates → **ignore**.
- Events **lacking both** fields are final duplicate flushes → **ignore**.

#### Event: tool_call started

Typed form (read):

```json
{
  "type": "tool_call",
  "subtype": "started",
  "call_id": "<tool call ID>",
  "tool_call": { "readToolCall": { "args": { "path": "file.txt" } } },
  "session_id": "<session UUID>"
}
```

Generic function form also exists: [web:outfmt]

```json
{
  "tool_call": {
    "function": { "name": "<tool name>", "arguments": "<serialized arguments>" }
  }
}
```

Headless page's jq example also mentions assistant text deltas and read/write tool details. [web:headless]

#### Event: tool_call completed (read)

```json
{
  "type": "tool_call",
  "subtype": "completed",
  "call_id": "<tool call ID>",
  "tool_call": {
    "readToolCall": {
      "args": { "path": "file.txt" },
      "result": {
        "success": {
          "content": "<file contents>",
          "isEmpty": false,
          "exceededLimit": false,
          "totalLines": 54,
          "totalChars": 1254
        }
      }
    }
  },
  "session_id": "<session UUID>"
}
```

Write args include `path`, `fileText`, `toolCallId`. Successful write results include absolute `path`, `linesCreated`, `fileSize`. [web:outfmt]

#### Terminal result

Same shape as json-format success object (`type: result`, `subtype: success`, durations, `is_error: false`, aggregated `result` text, `session_id`, optional `request_id`). [web:outfmt]

**No documented error-event schema.** Failures = nonzero exit + stderr. [web:outfmt]

### 1.5 Exit codes

Headless page only shows a script treating `$? == 0` as success and otherwise printing failure then `exit 1`. **No complete exit-code table is published.** [web:headless]

INFERENCE: treat 0 as success; any nonzero as failure (auth, quota, tool, crash). There is **no published CLI exit-code table**. Auth troubleshooting documents the string `"Not authenticated"`. [web:headless] [web:auth]

### 1.6 Quota exhaustion / errors

Not documented on headless or output-format pages. Failures surface as **nonzero exit + stderr**, possibly **without** a `result` event in stream-json. [web:outfmt] [web:headless]

**Exact quota-exhaustion stderr is unpublished.** Closest official signals:

- Changelog 2026-03: classified server failures **including rate limits display the actual server message** (do not grep a frozen string). [web:changelog]
- Interactive `/usage` shows included usage, Auto/API breakdown, on-demand, reset dates (2026-07-13). Not a `-p` JSON field. [web:changelog]
- Auth page: `"Not authenticated"` only. [web:auth]
- SDK: `RateLimitError` with `is_retryable` / `retry_after`. [web:sdk-py]
- Operator has on-demand **disabled** → included-pool exhaustion is a **hard stop**, not silent overage. [web:pricing]

Wrapper: exit nonzero **or** missing `type=="result" && subtype=="success"` → fail the lane and print stderr. Do not parse tokens from CLI stream-json (not on the 2026-09-16 output-format schema). [web:outfmt]

---

## 2. Modes, force, sandbox, permissions, trust, workspace

### 2.1 `--mode plan|ask` (and `--plan`)

Parameters: `--mode <mode>` **"Set agent mode: `plan` or `ask` (agent is the default when no mode is specified)"**. `--plan` is shorthand for `--mode=plan`. [web:params]

Using page: [web:using]

- **Plan**: design an approach before coding; agent asks clarifying questions. Also `Shift+Tab`, `/plan`.
- **Ask**: inspect and answer **without editing files**. Also `/ask`.

Read-only guarantee: **Ask mode is documented as not editing files.** Plan mode is *planning-first*, not a hard filesystem lock — it "asks clarifying questions" and you can "explicitly request that no code be written". INFERENCE: `--mode=ask` is the read-only CLI analogue; `--mode=plan` is **not** a sandbox/read-only guarantee.

Default (no `--mode`) is **agent** (full tools, including write+shell in print mode). [web:params] [web:using]

### 2.2 `--force` / `--yolo` vs default vs `--auto-review`

`--force` / `-f`: **"Force allow commands unless explicitly denied"**. `--yolo` is an alias. [web:params]

Headless: without `--force`, proposed changes are **not applied**; with it, file modifications proceed without confirmation. [web:headless]

Permissions page: print mode may use write and shell; **`allow`, `deny`, and `--force` determine which operations run without prompts.** Deny still wins. [web:perms]

`--auto-review` is **not on the published parameters page**. Local `--help` lists it. Changelog 2026-06-22: **"Turn it on with `--auto-review`, in `/config`, or with `/auto-review`"**. CLI `approvalMode` values: `allowlist | auto-review | unrestricted`. [web:changelog] [web:cliconfig]

Run Modes page (IDE + local agent; **Cloud Agents do not use Run Modes**): [web:runmodes]

| Mode | Runs without asking | Sandbox | Classifier |
|---|---|---|---|
| **Auto-review** | Allowlisted immediately; other shell in sandbox when possible; else classifier (Haiku 4.5 or GPT-5.4 Mini) | Yes (shell) | Yes |
| **Allowlist** | Allowlist only; optional sandbox | Optional | No |
| **Run Everything** | Every tool call | No | No |

`--force` / `--yolo` is the CLI analogue of **Run Everything** plus "force allow commands unless explicitly denied" (deny still wins). Changelog 2026-02: `--yolo` enables fully autonomous runs **including trust, MCP, and command approvals**. Parameters page lists `--yolo` as an alias of `--force`. [web:params] [web:changelog] [web:headless]

INFERENCE: `--auto-review` is a **safety classifier**, not a permission bypass and not a post-edit code-review. SDK `local.autoReview: true` **denies** blocked calls in headless rather than prompting. [web:sdk-ts]

Default (no `--force`): command approval is required in interactive mode (`y`/`n` before terminal commands). [web:using] In print mode without `--force`, writes are proposed but not applied. [web:headless]

Linux sandbox gotcha: process is remapped to **UID 0 inside a user namespace**. `id -u` returns 0. Use `CURSOR_ORIG_UID` / `CURSOR_ORIG_GID`. `CURSOR_SANDBOX=native` (or `seatbelt` on macOS). Landlock status via `CURSOR_SANDBOX_LANDLOCK_STATUS` (`fully_enforced` | `bubblewrap`). [web:runmodes]

### 2.3 `--sandbox enabled|disabled`

Parameters: `--sandbox <mode>` **"Set sandbox mode: `enabled` or `disabled`"**. [web:params]

Hidden `agent sandbox` subcommands: [web:params]

| Syntax | Meaning |
|---|---|
| `agent sandbox enable` | Enable sandbox mode for command execution |
| `agent sandbox disable` | Disable sandbox and use **allowlist mode** |
| `agent sandbox reset` | Reset sandbox config to defaults |
| `agent sandbox run <cmd>` | Run one command in a sandbox |

`sandbox run` flags: `--allow-paths`, `--readonly-paths`, `--blocked-patterns` (gitignore-style), `--sandbox` (workspace r/w policy, default true), `--network` (default **false**), `--sb-debug`. [web:params]

`sandbox.json` (user `~/.cursor/sandbox.json`, repo `<ws>/.cursor/sandbox.json`; repo wins; then team-admin then built-in, which **cannot be relaxed**): [web:sandbox]

- `type`: `workspace_readwrite` (default) | `workspace_readonly` | `insecure_none` (sandbox off)
- Extra r/w and r/o path lists; `disableTmpWrite`; `enableSharedBuildCache`
- `networkPolicy.default`: `allow` | `deny` (default deny); allow/deny of exact domains, `*.example.com`, CIDR
- **Private/loopback/link-local/cloud-metadata blocked by default** even if `default: allow`: 10/8, 172.16/12, 192.168/16, 127/8, 169.254.169.254, ::1, fe80::/10, fc00::/7
- SSL cert paths and `~/.ssh` remain readable
- `/tmp` writable unless `disableTmpWrite`

**Protected paths (always write-blocked, cannot override):** [web:sandbox]

```
.cursor/*.json
.cursor/**/*.json
.cursor/.workspace-trusted
.claude/*.json
.claude/**/*.json
.vscode/**
.code-workspace
.git/hooks/**
.git/config
.git/info/attributes
.cursorignore
```

Writable `.cursor` dirs: `rules/`, `commands/`, `worktrees/`, `skills/`, `agents/`. [web:sandbox]

**Git:** hooks, `.git/config`, `.git/info/attributes` are protected. The sandbox page does **not** say `git` the binary is blocked; it protects those git metadata paths. Network default-deny means `git fetch`/`push` need network allow or `--network`. INFERENCE: `git commit` locally may work if the workspace is r/w, but mutating `.git/config`/`hooks` will fail.

CLI `--sandbox` flag interaction with `sandbox.json` is **not specified** on the sandbox.json page. INFERENCE: `--sandbox enabled` turns on the sandbox policy from sandbox.json + built-ins; `--sandbox disabled` is `insecure_none` / allowlist mode (matches `agent sandbox disable` wording).

Local `~/.cursor/cli-config.json` (operator shared context) has `sandbox: {mode, networkAccess}` — that object is **not** documented on the permissions page we fetched. Need cli-config schema page.

### 2.4 Permissions allow/deny (`cli-config.json` / `.cursor/cli.json`)

User: `~/.cursor/cli-config.json`. Project: `<project>/.cursor/cli.json`. Deny overrides allow. [web:perms]

```json
{
  "permissions": {
    "allow": [
      "Shell(ls)",
      "Read(src/**/*.ts)",
      "Write(package.json)",
      "WebFetch(docs.github.com)",
      "Mcp(datadog:*)"
    ],
    "deny": [
      "Shell(rm)",
      "Read(.env*)",
      "Write(**/*.key)",
      "WebFetch(malicious-site.com)"
    ]
  }
}
```

Syntax: [web:perms]

| Kind | Form | Notes |
|---|---|---|
| Shell | `Shell(commandBase)` | First token of the command line. `Shell(git)` allows git subcommands. Optional `command:args`; `Shell(curl:*)` any args |
| Read | `Read(pathOrGlob)` | Relative = workspace-scoped; absolute may escape project |
| Write | `Write(pathOrGlob)` | |
| Web | `WebFetch(domainOrPattern)` | `*`, `*.example.com`, exact domain. No allow → each fetch prompts |
| MCP | `Mcp(server:tool)` | `Mcp(datadog:*)`, `Mcp(*:search)`, `Mcp(*:*)` |

`approvalMode` **is** on the configuration page (not the permissions page): `allowlist | auto-review | unrestricted`. Local `~/.cursor/cli-config.json` has `approvalMode: "allowlist"`. [web:cliconfig] [web:perms]

Configuration page (2026-09-16): user file `~/.cursor/cli-config.json` (Linux may also use `$XDG_CONFIG_HOME/cursor/cli-config.json`); override dir `CURSOR_CONFIG_DIR`; project file `<project>/.cursor/cli.json` is **permissions only** — other settings are global. Required: `version` (schema `1`), `editor.vimMode`, `permissions.allow`, `permissions.deny`. Optional of headless interest: `model`, `maxMode` (remembers picker Max preference), `approvalMode`, `sandbox.mode`, `sandbox.networkAccess`, `network.useHttp1ForAgent` (HTTP/1.1+SSE for HTTP/2-broken proxies; default false), `attribution.attributeCommitsToAgent` (default true), `attribution.attributePRsToAgent` (default true). File must be valid JSON **without comments**. Invalid files get `.bad` backup. [web:cliconfig]

`--add-dir` is **still absent** from the parameters page; changelog 2026-06-29: **"Repeat `--add-dir <path>` to add directories at launch"** plus interactive `/add-dir`. INFERENCE: extra readable/writable roots, Codex-like. SDK equivalent: Python `LocalAgentOptions.dirs`. [web:changelog] [web:sdk-py]

### 2.5 `--trust`, `--workspace`, `--add-dir`

`--trust`: **"Trust the workspace without prompting (headless mode only)"**. [web:params] Required for `-p` in unattended runs (otherwise a workspace-trust prompt can hang).

`--workspace <path>`: **"Workspace directory to use"**. [web:params] Using page: pair with `--worktree` to name the repo root. [web:using]

`--add-dir`: **not on the published parameters page**. Local `--help` lists it. Changelog 2026-06-29: **"Repeat `--add-dir <path>` to add directories at launch"** plus interactive `/add-dir`. INFERENCE: extra readable/writable roots, Codex-like. SDK equivalent: Python `LocalAgentOptions.dirs`. [web:changelog] [web:sdk-py]

`--approve-mcps`: automatically approve all MCP servers. [web:params]

`--plugin-dir <path>`: load a local plugin directory (repeatable). [web:params]

---

## 3. Session control (resume, continue, create-chat, ls, persist, worktrees)

### 3.1 Resume / continue / ls / create-chat

Parameters + using page: [web:params] [web:using]

| Flag/cmd | Semantics |
|---|---|
| `--resume [chatId]` | Resume a chat session |
| `--continue` | Continue previous session (**alias for `--resume=-1`**) |
| `agent ls` | Listed as "Resume a chat session" on parameters page; using page says run `agent ls` to **select an earlier chat** |
| `agent resume` | Resume the **latest** chat session |
| `agent create-chat` | Create a new empty chat and **return its ID** |

`persist` is on the changelog, not the parameters command table. See §3.3.

### 3.2 Worktrees

`--worktree [name]` / `-w`: **"Run in a new Git worktree under `~/.cursor/worktrees/<reponame>/<name>`."** [web:params]

`--worktree-base <branch>`: **"Branch or ref to base the new worktree on (default: current HEAD)"**. [web:params]

`--skip-worktree-setup`: **"Skip running worktree setup scripts from `.cursor/worktrees.json`"**. [web:params]

Using examples: [web:using]

```bash
agent --worktree "upgrade the test runner and fix any broken snapshots"
agent --workspace ~/src/my-app --worktree auth-fix "fix the flaky auth test and open a PR"
```

Cleanup follows editor retention rules. Worktrees config page fetched 2026-09-16: https://cursor.com/docs/configuration/worktrees [web:worktrees]

Cursor reads `.cursor/worktrees.json` when creating worktrees via Agents Window, IDE, **or CLI**. Search order: (1) the worktree path, (2) the project's root path. [web:worktrees]

```json
{
  "setup-worktree-unix": "...",
  "setup-worktree-windows": "...",
  "setup-worktree": ["npm ci", "cp $ROOT_WORKTREE_PATH/.env .env"]
}
```

- Unix/macOS prefers `setup-worktree-unix`; Windows prefers `setup-worktree-windows`; `setup-worktree` is the fallback.
- Values: array of shell commands (run sequentially in the worktree) **or** a script path relative to `.cursor/worktrees.json`.
- Scripts live in `.cursor/` beside the JSON. Env: `ROOT_WORKTREE_PATH` = the root checkout (copy `.env`, migrate DB, etc.).
- `--skip-worktree-setup` skips these scripts. [web:params]
- CLI path: `~/.cursor/worktrees/<reponame>/<name>` with `--worktree-base` defaulting to current HEAD. [web:params]
- Setup commands **wait for workspace trust** (2026-07-13) — pair with `--trust` in `-p`. [web:changelog]
- Retention (machine-scoped editor settings, also affect CLI-created trees because cleanup re-discovers any worktree under the machine root): `cursor.worktreeCleanupIntervalHours` default-ish 6, `cursor.worktreeMaxCount` default **25 per machine across all workspaces**. Exceeding the limit can trigger debounced immediate cleanup. Externally created `git worktree add` trees **may be deleted**. [web:worktrees]

INFERENCE for beep-effect: do **not** use `--worktree` for the D13 volume lane (it forks the tree and can be GC'd). Use it only for parallel isolated experiments. If used, add `.cursor/worktrees.json` with `mise`/`pnpm` install, not `npm ci`.

### 3.3 persist (survives detach)

Changelog 2026-08-26: [web:changelog]

- Start a persistent session: `agent persist`
- Detach: `/detach`
- Reconnect: `agent persist attach`
- Manage: `agent persist list|stop`
- Continue an existing conversation: `agent persist --resume`

What survives: the **session process + conversation**, so you can disconnect a TTY and reattach later. This is **not** the same as `--resume <chatId>` (which reopens a chat transcript in a new process). INFERENCE: persist is for long interactive/remote tmux-like runs, **not** for D13 one-shot `-p` jobs (those already exit when the turn ends). Headless `-p` should use `--resume`/`--continue`/`create-chat` if it needs conversation continuity across process lifetimes.

Other session notes from changelog: [web:changelog]

- `--continue` is `/continue`-style recent-chat continuation (2026-01).
- Chats can be resumed **from any directory** (2026-07-06).
- Resumed subagents retain previous context and checkpoints (2026-07-06).
- Headless transcripts use **Claude Code–compatible JSONL** (2026-02).
- Failed runs record errors in transcripts so scripts can detect them (2026-04).
- `AGENT_CLI_CREDENTIAL_STORE=file` enables unencrypted owner-only credential storage (2026-06-29) — relevant for headless boxes without a keychain.

---

## 4. Model bracket overrides, auto, Max, fast variants

### 4.1 CLI flag surface

Parameters page only documents `--model <model>` **"Model to use"** and `--list-models`. **No bracket-override syntax on that page.** [web:params]

Local `--help` (operator shared context, CLI v2026.09.10-fd3934a) documents bracket overrides like `'claude-opus-4-8[context=1m,effort=high,fast=false]'`. Official docs do **not** currently spell that grammar on the parameters page. Closest official analogue is the **SDK / Cloud API `model.params[]`** array (`id`/`value` pairs, e.g. `{ "id": "fast", "value": "true" }`) and `GET /v1/models` which returns per-model `parameters` and `variants`. [web:sdk-py] [web:api-ep]

INFERENCE: CLI brackets are a sugar for the same `params` map: `context`, `effort`, `fast` (and possibly others from the catalog). Confirm with `cursor-agent --list-models` (227-line local catalog already lists `composer-2.5(-fast)`, `cursor-grok-4.6-{low..xhigh}(-fast)`, `claude-fable-5-1-{low..max}`, `gpt-5.6-sol-{high,xhigh}(-fast)`, etc.). Prefer **explicit model IDs with `-fast` / effort suffix** from `--list-models` over undocumented brackets when writing the beep-effect recipe, and use brackets only when the ID itself does not encode the param.

Changelog confirmations: [web:changelog]

- 2026-05-14: **"Fast and high-effort model variants supplied through `--model` remain active in `-p` mode."**
- 2026-08-11: **"Headless keeps Max-mode variants."** (previously could be downgraded)
- 2026-07-06: new installs default to **Auto**; `/opus`, `/composer`, `/fast` shortcuts; Fast toggles when supported.
- 2026-07-13: Max Mode no longer sticks on after selecting a model that does not require it.

### 4.2 `auto` / Cursor Router

SDK: Router is `id="auto-smart"` with required `optimize_for` ∈ `{cost, balanced, intelligence}`. `id="auto"` is a **fallback server-selected Auto**, not the Router contract. [web:sdk-py]

Pricing page: Auto has three routing modes **Cost / Balance / Intelligence**. Each request is billed at the **listed price of the model Cursor Router selected**. Auto **can route to a third-party model** (then Teams/Enterprise also pay the Cursor Token Rate). Cursor Models do not incur that rate. [web:pricing]

INFERENCE: CLI `--model auto` is the fallback Auto; do not assume it is `auto-smart` with `balanced`. For a volume pool, **pin an explicit ID** (Composer 2.5 or a Cursor Grok variant) so we stay in the **Cursor Models** bucket.

### 4.3 Max mode

Max Mode exists **only on legacy request-based plans**. It extends context beyond the default window and adds **20%** to the model's API rate. Fast and Max can compound. [web:pricing]

On current Ultra ($200/mo) usage-pool billing, Max Mode is a **legacy concept**. The local catalog still has `*-max` / `*-thinking-*` IDs (e.g. `claude-fable-5-1-{low..max}`). INFERENCE: those IDs select a high-effort/long-context variant billed at the model's listed API rate against the **Other Models** pool, not a separate "Max" toggle.

### 4.4 Fast variants — cost

Cursor Models (per million tokens): [web:pricing]

| Model | Input | Cache read | Output | Fast vs normal |
|---|---:|---:|---:|---|
| Grok 4.6 | $2 | $0.50 | $6 | Fast $4 / $1 / $12 → **2× / 2× / 2×** |
| Grok 4.5 | $2 | $0.50 | $6 | Fast $4 / $1 / $18 → **2× / 2× / 3×** |
| Composer 2.5 | $0.50 | $0.20 | $2.50 | Fast $3 / $0.50 / $15 → **6× / 2.5× / 6×** |

No separate "quota multiplier" is published. Because Fast has higher token rates, **the same included-usage pool drains faster**. Composer 2.5 Fast is the worst Fast multiplier of the Cursor-model set (6× in/out). [web:pricing]

Other Fast notes: GPT-5 Fast 2×; GPT-5.6 Fast 2×; Claude Opus 4.7 fast mode **6×**. [web:pricing]

### 4.5 Two dashboard buckets (matches operator screenshot)

Ultra $200/mo includes **both** pools; they reset with the billing cycle: [web:pricing]

1. **"Cursor Models"** — first-party: Grok 4.6, Grok 4.5, Composer 2.5.
2. **"Other Models"** — third-party billed at listed API rates (Claude Fable 5.1 $10/$12.50/$0.25/$50 per M tokens; GPT-5.6 Sol $4/$5/$0.40/$20; Kimi K3 $3/—/$0.30/$15; Kimi K2.7 Code $0.95/—/$0.19/$4; GLM 5.2 $1.40/—/$0.26/$4.40).

After included usage is exhausted: buy on-demand at the same API rates or upgrade. **Requests are not reduced in quality or speed.** Operator has on-demand **disabled** — exhaustion = hard stop, not silent overage. [web:pricing]

Start plan excludes Other Models, on-demand, Auto, SDK. Irrelevant for Ultra. [web:pricing]

Fable 5.1 is **Other Models**, expensive, and "requires the stated data-retention approval conditions"; security-guardrail-triggered requests route to Claude Opus. Local catalog marks some Fable IDs **"NO ZDR"**. Do not use Fable on Cursor for beep-effect (we already have Anthropic-direct Fable). [web:pricing]

### 4.6 Model ID stability

Pricing page does **not** document ID stability or CLI-vs-API ID policy. Cloud API: **"Model IDs must come from `GET /v1/models`"**; IDs have `aliases` (example: `composer-2` has alias `composer-latest`) and per-model `parameters`/`variants`. [web:api-ep] [web:pricing]

Changelog: model catalog **refreshes periodically during long sessions** (2026-07-20); `/model` picker refetches if startup retrieval timed out (2026-07-13). [web:changelog]

INFERENCE: treat `--list-models` output as the source of truth per CLI version; pin IDs in recipes; expect aliases to move (`composer-latest`). The `-fast` suffix and `{low,high,xhigh,max}` effort suffixes in the local catalog are more stable than bracket sugar.

Kimi (operator: "heard Kimi is good"): Kimi K2.7 Code is cheap on Other Models ($0.95/$4); Kimi K3 is Sonnet-class priced ($3/$15). Quality claims are out of scope here — pick by bucket + rate.

---

## 5. CLI SDK / programmatic API

Fetched 2026-09-16: https://cursor.com/docs/sdk/python

### 5.1 Language and package

Documented package is **Python `cursor-sdk`**, Python **3.10+**. `pip install cursor-sdk`. It wraps **the same agent that runs in the Cursor IDE, CLI, and web app**. No dedicated TypeScript/JS SDK API is documented on this page; other languages are mentioned only via an **SDK Bridge**. ACP remains a CLI surface: `agent acp` starts an ACP server over stdin/stdout (advanced, hidden). [web:sdk-py] [web:params] [web:using]

Auth: `CURSOR_API_KEY` or `api_key=` argument. User API keys (Dashboard → API Keys) and **service-account** keys (Team settings) work. **Team Admin API keys are not supported.** [web:sdk-py]

### 5.2 How it wraps the agent

`Agent.create()` takes either:

- `local=LocalAgentOptions(...)` — runs against files on local disk.
- `cloud=CloudAgentOptions(...)` — Cursor-hosted isolated VM; clones repos into it.

Cloud agent IDs start with `bc-`; local IDs start with `agent-`. Cloud is for when the caller lacks the repo, wants parallel agents, or work must continue after disconnect. Cloud agents permit **only one active run at a time**. [web:sdk-py]

One-shot analogue of CLI `-p`: `Agent.prompt(...)`. Conversational: `agent.send(...).text()` / `run.wait()`. There is **no documented Python flag equivalent of `--print`**; `Agent.prompt()` is the closest one-shot. [web:sdk-py]

### 5.3 Streaming

`run.stream()` / `run.messages()` yield typed `SDKMessage` (stream consumable **once**). Variants: `system`, `user`, `assistant`, `thinking`, `tool_call`, `status`, `task`, `request`, `usage`. Tool-call events generally appear once when running and again when completed/failed. Tool arg/result schemas are **intentionally unstable**. Lower-level `run.events()` returns `RunStreamEvent` envelopes. `SendOptions.on_delta` / `on_step` for raw `InteractionUpdate` (text-delta, thinking-delta, tool-call, token, step, turn, shell-output, summary, user-message). [web:sdk-py]

Unlike CLI `stream-json` print mode (thinking **suppressed**), the SDK **does emit thinking** events. SDK also emits `usage` messages (`message.usage.total_tokens`) — **not documented on the CLI stream-json result object**. [web:sdk-py] [web:outfmt]

Run statuses: `"running" | "finished" | "error" | "cancelled" | "expired"`. [web:sdk-py]

### 5.4 Billing vs CLI

> "SDK runs follow Cursor's existing pricing, request pools, and Privacy Mode rules. Usage appears in the team usage dashboard under the **SDK** tag." [web:sdk-py]

The page does **not** say SDK is a separate paid product or that it is excluded from Ultra/subscription included usage. INFERENCE: same model-pricing / request-pool as CLI and IDE; dashboard-tagged `SDK`. Runtime tokens via `run.usage` / `RunResult.usage`; billed usage via `agent.get_usage()` (`usage.usage.total_tokens`, `usage.cost.charged_cents`; `cost` may be `None` initially — delayed). [web:sdk-py]

### 5.5 Model, permissions, sandbox, resume

- Models: string or `ModelSelection(id=..., params=[ModelParameterValue(id="fast", value="true")])`. Catalog: `Cursor.models.list()`. Router is `id="auto-smart"` with required `optimize_for` ∈ `{cost, balanced, intelligence}`. `ModelSelection(id="auto")` is a **fallback Auto**, not the Router contract. [web:sdk-py]
- Local tool allow/deny: `tools=["read","grep","glob","ls"]` or `disallowed_tools=["shell"]`. Capability names include `"read"`, `"edit"`, `"task"`, `"webSearch"`, plus groups `"shell"` and `"mcp"`. Deny wins. `tools=[]` removes all built-ins. Local-only; **not retained across resume**. [web:sdk-py]
- `LocalAgentOptions`: `cwd`, `dirs` (INFERENCE: extra roots ≈ CLI `--add-dir`), `setting_sources`, `sandbox_options`, `store`, `auto_review`, `custom_tools`. [web:sdk-py]
- Modes: `AgentOptions(mode="plan"|"agent")`; later `SendOptions(mode=...)`. **Ask mode is not listed** on the SDK page. [web:sdk-py]
- Resume: `Agent.resume("bc-abc123")` or local `agent-…`. Inline MCP, tool restrictions, custom tools **must be re-supplied** on resume. [web:sdk-py]
- Errors include `RateLimitError` (retry via `is_retryable` / `retry_after`), `AgentBusyError`, `APITimeoutError`, `AuthenticationError`. [web:sdk-py]

### 5.6 TypeScript SDK (`@cursor/sdk`)

Fetched 2026-09-16: https://cursor.com/docs/sdk/typescript — **this is the beep-effect-native option**. [web:sdk-ts]

- Package: `@cursor/sdk`. Node **22.13+**. `npm install @cursor/sdk`. Auth: `CURSOR_API_KEY` or `apiKey`, or `Cursor.auth.login()`.
- Same dual runtime as Python: **local** (agent loop in the Node process, files on disk; inference still Cursor-hosted) vs **cloud** (isolated VM). Same agent family as IDE/CLI/web.
- One-shot analogue of `-p`: `Agent.prompt(...)`. Durable: `Agent.create` → `agent.send` → `run.wait()`.
- Streaming: `run.stream()` async generator of `SDKMessage`: `system|user|assistant|thinking|tool_call|status|task|request|usage`. Lower-level `onDelta`/`onStep` with `text-delta`, `thinking-delta`, `tool-call-*`, `token-delta`, `shell-output-delta`, `turn-ended`, etc. Tool payloads **unstable** — parse as `unknown`.
- Billing: **"Spend shows up in your team's usage dashboard under the SDK tag."** Same pricing, request pools, Privacy Mode as IDE/Cloud Agent. User keys charge the user plan; service-account keys charge the team. `run.usage` has `inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `totalTokens`, optional `reasoningTokens` (already inside `outputTokens`). `agent.getUsage()` returns `rawCostCents` / `chargedCents` (delayed; `chargedCents` can be 0 for included-plan / BYOK / credits).
- Headless local runs **auto-execute tool calls** (no approval prompt). Controls: `tools`, `disallowedTools`, hooks (`.cursor/hooks.json` / `~/.cursor/hooks.json`, `beforeShellExecution`, `preToolUse`), `local.autoReview` (classifier; blocked calls **denied**, not prompted), `local.sandboxOptions: { enabled: true }` (writes, shell, network allowlist). **Local sandbox is disabled by default** in the SDK (opposite of D13 CLI `--sandbox enabled`).
- Extra dirs: Python `LocalAgentOptions.dirs`; TS `local` object (exact `dirs` field name on the truncated page — INFERENCE: mirrors Python).
- Resume: `Agent.resume(agentId)`. Local store: `SqliteLocalAgentStore` or `JsonlLocalAgentStore` (JSONL for no-SQLite envs) via `Cursor.configure()`. Inline MCP **not** retained across resume.
- Legacy `composer-2` / `composer-2-fast` reroute to Composer 2.5. Sticky per-run model override on `agent.send()`.
- Other languages: **SDK Bridge** (https://cursor.com/docs/sdk/bridge) — not a first-class TS-from-Python story; TS package is the in-process one.

### 5.7 For beep-effect

Both SDKs are **the same agent, same request pools, dashboard tag `SDK`** — not a fourth quota pool. Volume lane should stay **`cursor-agent -p`** unless we want typed `usage` events, `run.steer()`, or in-process custom tools. If we do embed, use **`@cursor/sdk`** (Node 22.13; beep-effect already on modern Node) not Python. Enable `local.sandboxOptions.enabled: true` explicitly — SDK default is unsandboxed. Do not assume SDK spend is "free Ultra included" just because CLI is; it is tagged separately on the dashboard (still the same two model pools per pricing page).

---

## 6. `cursor-agent worker` (self-hosted Cloud Agent / My Machines)

Fetched 2026-09-16: https://cursor.com/docs/cloud-agent/self-hosted plus parameters table. [web:selfhost] [web:params]

### 6.1 What it is

Self-Hosted Machines run **Cloud Agent execution on your hardware**. Cursor still owns the agent loop, inference, and planning; the worker performs file edits, terminal commands, computer-use, and local MCP. The worker keeps checkout, build cache, and machine-local credentials; it sends Cursor file contents, terminal output, diffs, screenshots, MCP results, and routing metadata. Managed Cloud Agents remain Cursor's recommended default. [web:selfhost]

CLI: `agent worker` = **"Start a private cloud worker that runs agents in your environment"**. Subcommands: `worker start`, `worker debug`, `worker help`. [web:params]

```bash
curl https://cursor.com/install -fsS | bash
agent login                    # My Machines (personal)
export CURSOR_API_KEY="..."    # Team Pools (service-account)
agent worker start
```

Creates a **long-lived outbound HTTPS** connection. No public IP / inbound port / VPN required. Outbound: `api2.cursor.sh`, `api2direct.cursor.sh`, `cloud-agent-artifacts.s3.us-east-1.amazonaws.com`. Proxy via `HTTPS_PROXY` / `https_proxy`. Blocking S3 only drops artifact uploads (screenshots/videos/logs in PRs/dashboard), not tool execution. [web:selfhost]

Caps: **200 workers per user, 1,000 per team**. [web:selfhost]

### 6.2 How a job is dispatched

Two routing models: [web:selfhost]

| Model | Who | Auth | Dispatch |
|---|---|---|---|
| **My Machines** | personal worker on a laptop/VM | `agent login` or personal API key | attached to an individual Cursor account; multiple agents may run on one machine |
| **Team Pools** | shared routing target | Enterprise + service-account key + team-admin allow/require self-hosted | client UI selects the pool; requests wait until a worker **claims** them; **one agent per worker** after claim |

API (not just dashboard) covers workers/pools, pending-request listing, SSE watch, claim/release, worker tokens. Concrete routes live under Cloud Agents API v0 private-workers (see §7). Dashboard toggles "Allow Self-Hosted Machines" / "Require Self-Hosted Machines". [web:selfhost] [web:api-ep]

Controller patterns: persistent (`systemd`/`launchd`/Docker), dynamic (`agent worker controller --spawn`, optional `--warm-idle`), Kubernetes `anysphere/k8s-workers`, partner hosts (AWS Lambda, Cloudflare, Namespace, Modal, Daytona, E2B, Vercel, Tensorlake, Coder). [web:selfhost]

### 6.3 Start flags (parameters page, not on the overview)

`--auth-token-file`, `--worker-dir` (repeatable; first value is assignment identity), `--management-addr` (`/healthz`, `/readyz`, `/metrics`), `--label` / `--labels-file` (`CURSOR_WORKER_LABELS_FILE`), `--idle-release-timeout` (0 = disable), `--pool` (one cloud agent claims the worker at a time), `--single-use` (legacy alias for `--pool`), `--pool-name` (default `default`), `--name` (default hostname), `--data-dir`, `--debug`, `--computer-use`, `--display` (Linux X11), `--share-desktop [view|view_and_control]` (Linux). [web:params]

Linux computer-use deps: `dbus-x11 ffmpeg tigervnc-standalone-server x11-utils x11-xserver-utils xdotool xfce4`. macOS needs a signed-in desktop + Accessibility + Screen Recording. [web:selfhost]

### 6.4 Billing bucket

> "Every runtime option uses the selected model and follows its pricing." [web:selfhost]

Managed Cloud Agents include execution infrastructure. Self-hosted **adds the cost of the machines you run**. The page does **not** name a separate subscription-vs-on-demand bucket for worker jobs vs CLI `-p`. INFERENCE: model tokens come out of the same Cursor model/request pools as Cloud Agents; infra is yours. Privacy Mode still applies. [web:selfhost]

### 6.5 Viable orchestration lane vs `-p`?

**No, not as a drop-in for D13.** Worker is a **Cloud Agent executor** (jobs created via dashboard, `&` CLI handoff, or `POST /v1/agents` with `env.type=machine|pool`). It is long-lived, needs outbound Cursor control plane, and is for private-network / custom-hardware / pre-warmed-image cases. Headless volume for beep-effect stays **`cursor-agent -p` on the workstation** (local files, stream-json, no cloud VM, no claim loop). Use worker only if we later want Cloud Agent jobs to run *on DankStation* instead of Cursor's VMs.

---

## 7. Cloud Agents / Background Agents HTTP API

Fetched 2026-09-16: https://cursor.com/docs/cloud-agent/api/endpoints (Cloud Agents API **v1 public beta**). `https://cursor.com/docs/cloud-agent.md` **404s**. There is no separate "Background Agents" API surface on this page; v1 is the current public API. Legacy v0 remains for webhooks. OpenAPI: https://cursor.com/docs-static/cloud-agents-openapi.yaml [web:api-ep]

### 7.1 Auth

Base: `https://api.cursor.com`. HTTP **Basic** (`-u YOUR_API_KEY:`) or **Bearer** (`Authorization: Bearer YOUR_SERVICE_ACCOUNT_API_KEY`). User keys from https://cursor.com/dashboard/api ; service-account keys documented under enterprise service-accounts. CLI `--api-key` / `CURSOR_API_KEY` is the **CLI** auth path (headless/parameters pages); the HTTP API page does not document `--api-key` but worker examples use `export CURSOR_API_KEY=...`. [web:api-ep] [web:headless] [web:params]

`GET /v1/me` returns API-key metadata (`apiKeyName`, `createdAt`; user-scoped keys also include `userId`/`userEmail`/name). [web:api-ep]

### 7.2 Billing: subscription vs on-demand

The endpoints page **does not** state whether API usage is included in Ultra or billed on-demand, and does **not** name a CLI-vs-API bucket. Combined with pricing: Ultra included usage is the two pools (Cursor Models / Other Models); on-demand is opt-in at the same API rates. SDK usage is dashboard-tagged `SDK`. INFERENCE: Cloud Agent HTTP jobs consume the same model pools as IDE/CLI Cloud Agents (the selected model's listed rate), **not** a third bucket. They are **not** a free extra pool. Operator has on-demand disabled → API jobs stop when included usage hits 0. [web:api-ep] [web:pricing] [web:sdk-py]

Image limits (API prompts): max 5 images, 15 MB each, png/jpeg/gif/webp; `data`+`mimeType` or HTTPS `url`. [web:api-ep]

### 7.3 Agent/run endpoints (v1)

| Method | Path | Role |
|---|---|---|
| POST | `/v1/agents` | Create durable agent + queue initial run |
| GET | `/v1/agents` | List (`limit` default 20 max 100, `cursor`, `prUrl`, `includeArchived` default true) |
| GET | `/v1/agents/{id}` | Durable metadata; execution state is on `latestRunId` |
| POST | `/v1/agents/{id}/runs` | Follow-up run (409 `agent_busy` if one run already active) |
| GET | `/v1/agents/{id}/runs` | List runs |
| GET | `/v1/agents/{id}/runs/{runId}` | Get run (`CREATING\|RUNNING\|FINISHED\|ERROR\|CANCELLED\|EXPIRED`) |
| GET | `/v1/agents/{id}/runs/{runId}/stream` | SSE (`Accept: text/event-stream`); `Last-Event-ID` resume; 400 `invalid_last_event_id`; 410 `stream_expired` |
| POST | `/v1/agents/{id}/runs/{runId}/cancel` | Terminal cancel; 409 `run_not_cancellable` |
| GET | `/v1/agents/{id}/usage` | Token totals (`inputTokens`, `outputTokens`, `cacheWriteTokens`, `cacheReadTokens`, `totalTokens`) optional `?runId=` |
| POST | `/v1/agents/{id}/archive` | Idempotent |
| POST | `/v1/agents/{id}/unarchive` | Idempotent |
| DELETE | `/v1/agents/{id}` | Permanent |
| GET | `/v1/agents/{id}/artifacts` | List under `artifacts/` |
| GET | `/v1/agents/{id}/artifacts/download?path=` | 15-minute presigned S3 URL |
| GET | `/v1/models` | Catalog (IDs **must** come from here) |
| GET | `/v1/repositories` | GitHub repos; **1 req/user/min, 30/user/hour** |

Create body highlights: required `prompt.text`; optional `model.id` + `model.params[]`; `env.type` = `cloud | pool | machine` (this is how a job is dispatched onto a **My Machines** worker); `repos[]` (max 20; cannot combine with a named cloud environment); omit both `repos` and `env` → no-repo agent; `workOnCurrentBranch` default false → commits to autogenerated `cursor/...` branch; `autoCreatePR`; `envVars` max 50, no `CURSOR_*` names; `mode` `agent|plan`; optional client `agentId` `bc-<uuid>` (409 `agent_id_conflict` on reuse). Agent statuses: `ACTIVE`, `IDLE`, `ARCHIVED`. [web:api-ep]

SSE events: `status`, `assistant` (text delta), `thinking`, `tool_call`, `interaction_update`, `heartbeat`, `result`, `error` `{code,message}`, `done`. [web:api-ep]

v1 webhooks: **forthcoming**. Legacy v0 webhooks still documented separately. [web:api-ep]

### 7.4 Worker/pool API (v0 `/v0/private-workers`)

Service-account key. List/get workers, summary, list/register/deregister pools, list pending requests, SSE watch (`created|claimed|claimed_offline|expired|heartbeat`; cursor expires in 5 min → 410 `cursor_expired`; **max 4 concurrent streams per service account**), claim (`POST /v0/private-workers/claim`), release. User-scoped worker tokens: `POST /v1/sub-tokens` (1 hour, cannot mint another). [web:api-ep]

### 7.5 `.cursor/environment.json`

Fetched 2026-09-16: https://cursor.com/docs/cloud-agent/setup (schema URL https://www.cursor.com/schemas/environment.schema.json — full schema body not inlined on the page). `https://cursor.com/docs/cloud-agent.md` 404s in this fetch; llms.txt still lists it. [web:ca-setup]

Cloud Agents run on **isolated Ubuntu VMs**. An environment = repos + tools + deps + secrets + network + commands. Create from https://cursor.com/dashboard/cloud-agents#environments. Precedence: **(1) repo `.cursor/environment.json` > (2) personal saved env > (3) team saved env**. [web:ca-setup]

Two setup styles: agent-driven (dashboard clones GH/GL/ADO/Bitbucket, installs, verifies, first Build) or **Dockerfile-based** via this JSON.

Documented fields / concepts: [web:ca-setup]

| Field | Role |
|---|---|
| `snapshot` | prepared environment snapshot id |
| `install` | Build-time command: complete, repeatable, **idempotent**; deps, codegen, compile, cache warm; **no long-running processes** |
| `start` | post-Build environment services (e.g. Docker daemon) |
| `terminals` | app processes in a shared **tmux** session visible to user and agent |
| `build.dockerfile` | Dockerfile path **relative to `.cursor`** |
| `build.context` | Docker context; default `.cursor`; `.` / `./` / `..` mean repo root |

**There is no special `.cursor/install.sh` key.** A script is just something `install` can invoke (`"pnpm install && ./custom_script.sh"`). beep-effect's `.cursor/install.sh` is therefore a **repo convention** called from `install`, not a Cursor-discovered filename. [web:ca-setup]

Builds clone + run `install` + snapshot disk. Future agents boot from the latest successful Build. Disk is preserved; **running processes, shell exports, memory caches are not**. Secrets live in the dashboard (env-scoped), not in the JSON. AWS IAM via `CURSOR_AWS_ASSUME_IAM_ROLE_ARN`; OIDC for AWS/GCP/Azure; Cloudflare Access; Tailscale **userspace** networking. Cloud agents read `AGENTS.md` (add a cloud-only section). [web:ca-setup]

This JSON does **not** apply to local `cursor-agent -p`. It is Cloud Agent VM provisioning only.

Official JSON Schema (fetched 2026-09-16): https://www.cursor.com/schemas/environment.schema.json — `unevaluatedProperties: false`; comments allowed, trailing commas not. Composition: `allOf` container + common. [web:env-schema]

**Common fields:** `name`, `user` (run-as), `install` ("install script to run on VM startup (after pulling latest changes) to refresh dependencies"), `start`, `repositoryDependencies[]` (URLs like `github.com/org/repo` that must be in the generated GitHub token), `disableAllMcpServers` (blocks user/team MCP; **built-in MCP never restricted**; empty allowlist alone does not disable MCP), `mcpServerAllowlist[]` (`serverUrl` XOR `command`, optional `name`, `toolAllowlist`), `egressAllowlist[]`, `egressMode` ∈ `allow_all | parent_plus_network_settings | default_with_network_settings | network_settings_only`, `chromeExecutablePath`, `enable_testing` (default true; bool or `"true"`/`"false"` string), `ports[]` (`port` required 1–65535, optional `name`), `terminals` (object `{name,command,description}` or nested array of those; `command` required).

**Container/base (one of):** `snapshot` (ID; **takes precedence** over build/image), `image` (registry ref), `build.dockerfile` | `build.dockerfileContents` (XOR), `build.context` (relative to the folder containing `environment.json`). `agentCanUpdateSnapshot` default true for snapshot/default-base; **always false** when base is `build` or `image`.

INFERENCE: beep-effect's `.cursor/install.sh` should be invoked from `install`, not relied on as a magic filename. Keep `unevaluatedProperties` in mind — extra keys will fail schema.

### 7.6 CLI vs API as a volume lane

Cloud Agent API is a **remote VM / pool / machine** job, not a local `-p` substitute. Use it for `&` handoff / background PRs. For beep-effect headless volume on DankStation, stay on `cursor-agent -p`. API **does** expose per-run token usage (`GET /v1/agents/{id}/usage`) that CLI stream-json docs omit (changelog 2026-02 claims stream-json grew per-turn token totals — see §8).

---

## 8. Known headless pitfalls

Official docs + changelog + X, 2026-09-16.

### 8.1 Will hang or look hung

- **Workspace trust prompt** without `--trust` (headless-only flag). Jan 2026: headless requires trust unless `--trust` **or `--force`**. Keep both. [web:params] [web:changelog]
- **Open stdin pipe** used to hang `-p` (fixed Feb 2026: "Headless hang fixed"). Still pass `</dev/null`. Piped stdin also **infers print mode / output-format**. [web:changelog] [web:outfmt]
- **MCP OAuth** hung when callback port occupied (fixed Jul 20 2026 — now errors). Headless waits for slow stdio MCP servers (May 14). [web:changelog]
- **No auto-timeout on agent-spawned bash**. Peter Steinberger 2025-08-10: `cursor-agent` (and Codex / Cursor IDE) do not add an auto-timeout when they run bash; a log-follow / file-watch script that needs an explicit exit hangs the agent. Claude Code has default timeouts + background process monitoring. Prompt-level "no long-running watches" + host `timeout(1)` around the CLI. [post:steipete-bash]
- **Subagents**: single-turn/headless runs now **wait for delegated subagents before exiting** (Aug 11 2026). A stuck Explore subagent holds the process. [web:changelog]
- **Sudo prompts** inside the agent were a headless footgun (Jul 6 2026 input/sudo/TSTP fixes). On DankStation, sudo needs a YubiKey touch — deny `Shell(sudo)` / `Shell(pkexec)` in project cli.json. [web:changelog]
- Worktree setup **waits for workspace trust** (Jul 13). [web:changelog]

### 8.2 Writes / permissions / sandbox

- Without `--force`, **changes are only proposed**. [web:headless]
- `--sandbox enabled` + default network **deny** + RFC1918/loopback/link-local/metadata **always blocked** even if `default: allow`. Breaks npm, git remotes, 1Password SSH agent socket (looks like "network") unless allowlisted or `--sandbox disabled`. [web:sandbox] [web:runmodes]
- Protected paths: `.git/hooks/**`, `.git/config`, `.git/info/attributes`, `.cursor/*.json`, `.claude/*.json`, `.vscode/**`, `.cursorignore`. Git **binary is not blocked**. Changelog Aug 11: git ops **ignore repo-controlled hooks and external diff tools**. [web:sandbox] [web:changelog]
- Linux sandbox **UID 0** inside the namespace — Docker `--user $(id -u)` is wrong; use `$CURSOR_ORIG_UID`. [web:runmodes]
- `--force` does **not** override `deny`. [web:perms]
- Cloud Agents **never prompt** (no Run Modes). Local `-p` does. [web:runmodes]

### 8.3 Output / errors / quota

- Failed `json`/`stream-json`: **nonzero exit + stderr**; stream-json **may omit** the terminal `result`. [web:outfmt]
- **No documented CLI exit-code table.** Sample scripts treat `$? == 0` vs else. [web:headless]
- **No usage/token fields** on the current output-format result object (re-fetched 2026-09-16). Changelog Feb 2026 claimed stream-json grew per-turn input/output/cache totals + `request_id`. `request_id` **is** on the documented result; token totals are **not**. Treat token accounting as **docs-vs-changelog mismatch** — parse defensively (`usage` / `inputTokens` if present; do not require them). SDK/API **do** expose tokens. [web:outfmt] [web:changelog] [web:sdk-ts] [web:api-ep]
- Thinking events **suppressed in print mode**. [web:outfmt]
- `result` concatenates assistant segments **without separators** (docs example: `"I'll read the README.md fileBased on the README..."`). [web:outfmt]
- Exact **quota-exhaustion string is unpublished**. Interactive `/usage` shows included usage, Auto/API breakdown, on-demand, reset dates (Jul 13). March 2026: classified server failures **including rate limits display the actual server message**. SDK: `RateLimitError` with `retry_after`. Auth page only documents `"Not authenticated"`. [web:changelog] [web:auth] [web:sdk-py]
- Operator has **on-demand disabled** → included-pool exhaustion is a **hard stop**, not silent overage. [web:pricing]
- **Grok Bot weekly usage is a third meter**, not Cursor CLI. Cursor CLI draws the Ultra **Cursor Models / Other Models** pools. Grok (official account, 2026-09-16): "Cursor CLI usage draws from your Cursor plan … Linking SuperGrok grants Grok Bot access on Cursor but does not transfer quota to Cursor CLI." Separate Ultra-vs-Grok-Bot reports the same split (Ultra included ~3% while Grok Bot weekly ~80%). [post:grok-cli-quota] [post:ultra-vs-grokbot]
- Unbounded agent loops can drain a **month of included usage in a day**; support may refuse a reset. Put a host retry budget / `timeout` around `-p --force`. [post:quota-drain]

### 8.4 Session / resume / concurrency / TTY

- Resume after crash: `--resume <chatId>` from the `system/init` `session_id` (or `agent ls` / `create-chat`). `--continue` = `--resume=-1`. Chats resume **from any directory** (Jul 6). [web:params] [web:changelog]
- `agent persist` is a **long-lived process** (`/detach`, `persist attach|list|stop`, `persist --resume`) — not for one-shot `-p`. Not on the slash-command table. [web:changelog] [web:slash]
- Headless transcripts are **Claude Code–compatible JSONL**; failed runs record errors in transcripts (Apr 2026). [web:changelog]
- No published CLI concurrency cap. Cloud API: **one active run per agent** (`409 agent_busy`); worker watch SSE **max 4 concurrent streams per service account**. [web:api-ep]
- No published CLI wall-clock timeout. Use host `timeout`.
- `AGENT_CLI_CREDENTIAL_STORE=file` for boxes without a keychain (Jun 29). [web:changelog]
- `status` / `about` have JSON output for scripts (Apr 2026). [web:changelog]
- Enterprise can **disable headless** (Jun 9). [web:changelog]
- CI recipe (GitHub Actions): `agent -p --model …` + `CURSOR_API_KEY`; docs recommend **CI owns git** (branch/commit/push/PR), agent only edits the workdir. Does **not** mention `--trust`/`--force`/`--sandbox` — add them anyway. [web:gha]

### 8.5 Model / billing traps

- Default `--output-format` is **`text`**, not stream-json. [web:outfmt] [web:params]
- New installs default to **Auto** (Jul 6). Cursor Router (`auto-smart`) is **Teams/Enterprise only**; Balance/Intelligence drain faster than Cost. Personal Ultra `--model auto` is **not** documented as Router. Pin an explicit ID. [web:router] [web:changelog]
- Fast variants stay active in `-p` (May 14); Max-mode variants stay active in headless (Aug 11). Composer 2.5 Fast is **6×** in/out vs normal. [web:changelog] [web:pricing]
- Fable on Cursor is **Other Models**, `$10/$50` per M, data-retention caveats, some IDs **NO ZDR**. Do not spend Ultra Other-Models on Fable — use Anthropic-direct. [web:pricing]
- SDK spend is dashboard-tagged **`SDK`** but same request pools. [web:sdk-ts]

---

## Headless lane recipe v2

Improves D13 (`cursor-agent -p --trust --force --sandbox enabled --model <id> --output-format stream-json "<prompt>" </dev/null`). D13 was already the right skeleton.

### Write / implement (volume)

```bash
export CURSOR_API_KEY=…   # or `agent login` once on the box; do not pass --api-key on the argv (ps leakage)

timeout 15m \
  cursor-agent -p \
    --trust \
    --force \
    --sandbox enabled \
    --workspace /abs/path/to/beep-effect \
    --model 'composer-2.5' \
    --output-format stream-json \
    -- "Implement <bounded change>. Do not run git. Do not commit, push, or edit .git/. You may read files and run tests. Stop after the diff is in the worktree." \
    </dev/null
```

Capture: `> /tmp/cursor-lane.ndjson 2> /tmp/cursor-lane.err`; success = exit 0 **and** a `type=="result" && subtype=="success"` line. Missing result + nonzero = failure (auth/quota/crash).

### Read-only research

Same as above but `--mode=ask` and **drop `--force`**. Ask is the documented no-edit mode. Do **not** use `--mode=plan` as a safety lock (planning-first, not a FS lock; plan **does** work with `-p` as of Apr 2026). [web:using] [web:params] [web:changelog]

### What changed vs D13 and why

| Change | Why |
|---|---|
| Keep `-p --trust --force --sandbox enabled --output-format stream-json </dev/null` | Still required. Default format is **text**. Trust prompt hangs. Open stdin used to hang (fixed, still close it). [web:outfmt] [web:params] [web:changelog] |
| Add `--workspace <abs repo>` | Parameters: workspace directory to use. Avoids cwd accidents. [web:params] |
| **Do not** add `--stream-partial-output` unless the consumer implements the three-way `timestamp_ms`/`model_call_id` filter | Otherwise you double-count assistant text. Prefer the terminal `result` event. [web:outfmt] |
| Pin `--model composer-2.5` (Cursor Models bucket) | Cheapest first-party ($0.50/$2.50 per M). Ultra included. Avoid Composer **Fast** (6×). Avoid Fable (Other Models, $10/$50, NO ZDR). Avoid `--model auto` on personal Ultra (Router is Teams/Enterprise). [web:pricing] [web:router] |
| `timeout 15m` around the process | No CLI timeout; bash-watch scripts hang; subagents can block exit. [post:steipete-bash] [web:changelog] |
| Prompt-level **and** `deny: ["Shell(git)","Shell(sudo)","Shell(pkexec)"]` in `<repo>/.cursor/cli.json` | Sandbox does not block the git binary; DankStation sudo is a YubiKey hang. Deny wins over `--force`. [web:sandbox] [web:perms] |
| Auth: `CURSOR_API_KEY` from 1Password, not `--api-key` on argv | Official env-var path. [web:auth] [web:gha] |
| `--approve-mcps` only if the job needs MCP | Otherwise skip. Headless waits on slow stdio MCP. [web:params] [web:changelog] |
| Do **not** use `--worktree` for the volume lane | Forks under `~/.cursor/worktrees/<repo>/<name>`, GC at 25/machine. [web:worktrees] |
| Do **not** use `agent persist` for one-shot | Different lifetime (detach/attach). Use `--resume <session_id>` only to continue a crashed `-p`. [web:changelog] |
| Do **not** use `cursor-agent worker` / Cloud API as the D13 replacement | Those are Cloud Agent executors (VM/pool/machine), billed on the same model pools, extra infra. [web:selfhost] [web:api-ep] |

### Model pick for "as close to Astra/Fable as possible"

Tier policy to codify (operator): Codex Astra if Codex pool >5%; else Cursor.

On Cursor Ultra, spend **Cursor Models first** (resets Oct 11 this cycle):

1. `composer-2.5` — default volume, cheapest, same family as IDE Composer.
2. `cursor-grok-4.6-high` or `cursor-grok-4.6-xhigh` — closer to Grok 4.6 quality; **2×** if you add `-fast`.
3. Only if Cursor Models is empty: Other Models `kimi-k2.7-code` ($0.95/$4) or `kimi-k3-high` ($3/$15), then `glm-5.2-high`. Not Fable, not Sol (those pools exist cheaper on Anthropic-direct / Codex).

Confirm IDs with `cursor-agent --list-models` at recipe-freeze time. Bracket sugar `'id[context=1m,effort=high,fast=false]'` is **CLI-help-only**; official analogue is SDK/API `model.params[]`. Prefer suffix IDs from the catalog. [web:params] [web:sdk-ts] [web:api-ep]

### Project files to add (parity, not a worker)

- `<repo>/.cursor/cli.json` — `permissions.allow` / `deny` only (project file cannot hold other settings). [web:cliconfig]
- Keep user `~/.cursor/cli-config.json` `approvalMode: "allowlist"` + `sandbox.mode` aligned with `--sandbox enabled`.
- Optional `<repo>/.cursor/sandbox.json` network allowlist if the lane must hit npm/GH; never `allow_all` without a reason. [web:sandbox]
- `.cursor/environment.json` is **Cloud Agent only** — do not expect `-p` to read `install`. [web:ca-setup]
- Hooks: CLI documents `.cursor/hooks.json` (SDK too). Existing beep-effect `.claude/settings.json` hooks do **not** automatically fire in Cursor; if we want pulse/law-pulse parity, add Cursor hooks separately. [web:sdk-ts]

---

## stream-json extraction cookbook

NDJSON, one object per line. Ignore unknown fields. Thinking is **not** present in `-p`. [web:outfmt]

Assume the log is `run.ndjson`.

```bash
# session + model + auth source + permission mode (init)
jq -r 'select(.type=="system" and .subtype=="init")
  | "session=\(.session_id) model=\(.model) key=\(.apiKeySource) perm=\(.permissionMode) cwd=\(.cwd)"' run.ndjson

# success? (empty = crash / quota / auth — then read stderr)
jq -r 'select(.type=="result") | "subtype=\(.subtype) err=\(.is_error) wall_ms=\(.duration_ms) req=\(.request_id // "")"' run.ndjson

# final assistant text (prefer this over concatenating assistant events)
jq -r 'select(.type=="result" and .subtype=="success") | .result' run.ndjson

# all file writes (completed)
jq -c 'select(.type=="tool_call" and .subtype=="completed" and .tool_call.writeToolCall)
  | {call_id, path: .tool_call.writeToolCall.result.success.path,
     lines: .tool_call.writeToolCall.result.success.linesCreated,
     bytes: .tool_call.writeToolCall.result.success.fileSize}' run.ndjson

# write payloads (started — includes fileText)
jq -r 'select(.type=="tool_call" and .subtype=="started" and .tool_call.writeToolCall)
  | .tool_call.writeToolCall.args | "\(.path)\n\(.fileText)"' run.ndjson

# reads
jq -c 'select(.type=="tool_call" and .subtype=="completed" and .tool_call.readToolCall)
  | {path: .tool_call.readToolCall.args.path,
     lines: .tool_call.readToolCall.result.success.totalLines,
     truncated: .tool_call.readToolCall.result.success.exceededLimit}' run.ndjson

# generic function-form tools (shell and anything not read/write)
jq -c 'select(.type=="tool_call" and .tool_call.function)
  | {subtype, call_id, name: .tool_call.function.name, arguments: .tool_call.function.arguments}' run.ndjson

# D13-style command extraction (INFERENCE from live D13 transcript `"command":` keys
# plus docs "other tools use tool_call.function". Try both.)
jq -c 'select(.type=="tool_call") | .. | objects | select(has("command")) | {command}' run.ndjson

# assistant text without --stream-partial-output (one event per segment between tools)
jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="text") | .text' run.ndjson

# with --stream-partial-output: ONLY appendable deltas
jq -r 'select(.type=="assistant" and has("timestamp_ms") and (has("model_call_id")|not))
  | .message.content[0].text // empty' run.ndjson

# defensive usage (NOT in current output-format docs; changelog Feb 2026 claimed per-turn totals)
jq -c 'select(.usage != null or .inputTokens != null or .type=="usage")' run.ndjson

# correlate tool start/complete
jq -s 'map(select(.type=="tool_call")) | group_by(.call_id)
  | map({call_id: .[0].call_id, events: map(.subtype), tool: (.[0].tool_call|keys)})' run.ndjson
```

Headless page's own progress script is the canonical consumer: branch on `.type` ∈ `system|assistant|tool_call|result`, and for assistant+partial-output require `has("timestamp_ms")` and not `has("model_call_id")`. It only special-cases `writeToolCall` / `readToolCall`. [web:headless]

Wrapper:

```bash
set -euo pipefail
log=$(mktemp)
err=$(mktemp)
set +e
timeout 15m cursor-agent -p --trust --force --sandbox enabled \
  --workspace "$PWD" --model composer-2.5 \
  --output-format stream-json -- "$PROMPT" </dev/null \
  >"$log" 2>"$err"
ec=$?
set -e
if ! jq -e 'select(.type=="result" and .subtype=="success" and .is_error==false)' "$log" >/dev/null; then
  echo "cursor-agent failed ec=$ec" >&2
  cat "$err" >&2
  exit "${ec:-1}"
fi
jq -r 'select(.type=="result") | .result' "$log"
```

---

## Sources

Citation keys in the body map 1:1 to a URL below. Only pages actually fetched (or X posts retrieved in this lane) are listed. `https://cursor.com/docs/cloud-agent.md` 404s; used `/cloud-agent/setup` + the environment schema instead. `llms.txt` was a catalog, not evidence. Local `--help` is `cursor-agent` v2026.09.10-fd3934a, not a URL.

### Official docs (accessed 2026-09-16)

- [web:headless] https://cursor.com/docs/cli/headless — print mode, `--force`/`--yolo`, `--trust`, `CURSOR_API_KEY`, jq consumer, sample exit 0/1
- [web:outfmt] https://cursor.com/docs/cli/reference/output-format — `text`/`json`/`stream-json` schemas, event types, partial-output 3-way filter, no token fields, failure = stderr + nonzero, optional `request_id`
- [web:params] https://cursor.com/docs/cli/reference/parameters — flag table (`-p`, `--force`/`--yolo`, `--mode`, `--trust`, `--sandbox`, `--workspace`, `--resume=-1`, `--output-format` default `text`, worker subcommands); `--add-dir` **absent** here
- [web:using] https://cursor.com/docs/cli/using — Ask is read-only; Plan is planning-first; `-p` has full write access; MCP/rules/`AGENTS.md`; worktree examples; cloud `&` handoff
- [web:perms] https://cursor.com/docs/cli/reference/permissions — `allow`/`deny` syntax (`Shell`/`Read`/`Write`/`WebFetch`/`Mcp`); deny wins; `approvalMode`
- [web:sandbox] https://cursor.com/docs/reference/sandbox — `sandbox.json` layers, network default deny, protected `.git/hooks/**` / `.git/config` / `.cursor/*.json`; git binary **not** blocked
- [web:auth] https://cursor.com/docs/cli/reference/authentication — `agent login`, `CURSOR_API_KEY`, `--api-key`, `NO_OPEN_BROWSER`, `AGENT_CLI_CREDENTIAL_STORE=file`; documented string `"Not authenticated"`
- [web:runmodes] https://cursor.com/docs/agent/security/run-modes — Auto-review / Allowlist / Run Everything; `--force` ≈ Run Everything; Cloud Agents ignore Run Modes; Linux sandbox UID 0 / `CURSOR_ORIG_UID` / `CURSOR_SANDBOX`
- [web:slash] https://cursor.com/docs/cli/reference/slash-commands — `/ask`, `/plan`, `/run-everything` (`/auto-run`), `/max-mode` (legacy), `/resume`, `/sandbox`, `/mcp`, `/config`; **no** `/detach` or persist
- [web:router] https://cursor.com/docs/cursor-router — `auto-smart` + `optimize_for` ∈ cost|balanced|intelligence; **Teams/Enterprise only**; `auto` is fallback Auto
- [web:sdk-py] https://cursor.com/docs/sdk/python — `cursor-sdk` 3.10+; `Agent.prompt()` ≈ `-p`; `LocalAgentOptions.dirs`; `RateLimitError`; local sandbox **off** by default
- [web:sdk-ts] https://cursor.com/docs/sdk/typescript — `@cursor/sdk` Node 22.13+; dashboard tag `SDK`; `model.params[]`; `local.autoReview` denies in headless; `sandboxOptions`
- [web:selfhost] https://cursor.com/docs/cloud-agent/self-hosted — `agent worker`; My Machines vs Team Pools; outbound api2.cursor.sh / S3; caps 200 workers/user, 1000/team
- [web:api-ep] https://cursor.com/docs/cloud-agent/api/endpoints — `https://api.cursor.com` v1 public beta; `POST /v1/agents`, SSE, usage, artifacts, `GET /v1/models`; Basic or Bearer
- [web:ca-setup] https://cursor.com/docs/cloud-agent/setup — Cloud VM env; `.cursor/environment.json` precedence (repo > personal > team); **not** used by local `-p`
- [web:env-schema] https://www.cursor.com/schemas/environment.schema.json — Cloud env JSON schema; no magic `.cursor/install.sh` filename
- [web:openapi] https://cursor.com/docs-static/cloud-agents-openapi.yaml — Cloud Agents OpenAPI; worker/pool under `/v0/private-workers`
- [web:worktrees] https://cursor.com/docs/configuration/worktrees — `--worktree` under `~/.cursor/worktrees/<reponame>/<name>`; max 25/machine; `--worktree-base`, `--skip-worktree-setup`, `.cursor/worktrees.json`
- [web:gha] https://cursor.com/docs/cli/github-actions — CI example uses `CURSOR_API_KEY`; omits `--trust`/`--force`/`--sandbox` (do not copy as-is for D13)
- [web:cliconfig] https://cursor.com/docs/cli/reference/configuration — `~/.cursor/cli-config.json` vs `<project>/.cursor/cli.json` (project file is **permissions-only**)
- [web:changelog] https://cursor.com/changelog — `--add-dir` (2026-06-29), `--auto-review` (2026-06-22), `--yolo` also covers trust/MCP (Feb 2026), stdin hang fix, persist/`/detach` (Aug 2026), Plan+`-p` (Apr 2026), Fast in `-p` (May 2026), Max variants in headless (Aug 2026), git ops ignore repo hooks (Aug 11), single-turn waits for subagents (Aug 11), rate-limit messages (Mar 2026), claimed stream-json token totals (Feb 2026; **not** on live output-format page)
- [web:pricing] https://cursor.com/docs/models-and-pricing — Cursor Models vs Other Models; Ultra includes both; Composer 2.5 $0.50/$2.50; Composer 2.5 Fast 6×; Grok 4.6 Fast 2×; Fable Other Models $10/$50, some IDs NO ZDR; Max Mode +20% API (legacy request plans)

### X (retrieved 2026-09-16)

- [post:steipete-bash] https://x.com/steipete/status/1954594876743389444 — Peter Steinberger 2025-08-10: Cursor/Codex bash has no auto-timeout; `tail -f` hangs the agent
- [post:grok-cli-quota] https://x.com/grok/status/2100073210888819194 — Grok official: Cursor CLI draws the Cursor plan; SuperGrok/Grok Bot does not transfer quota to CLI
- [post:ultra-vs-grokbot] https://x.com/360Axe/status/2100139325228752986 — operator report: Ultra included vs Grok Bot weekly as separate meters
- [post:quota-drain] https://x.com/jintageal/status/2099399646238101711 — unbounded agent loop burned a month of included usage in a day

---

## Recommendations for beep-effect

Cursor Ultra is a **fourth volume pool**, not a new quota surface via SDK/API/worker. Same two dashboard buckets (Cursor Models / Other Models). Use it only after the Codex pool is ≤5% remaining (operator policy). Host owns git.

1. **Ship recipe v2 as the volume lane.** `timeout 15m cursor-agent -p --trust --force --sandbox enabled --workspace /abs/beep-effect --model composer-2.5 --output-format stream-json -- "<prompt>" </dev/null`. Keep D13's flags; default format is **text**. [web:params] [web:outfmt] [web:headless]
2. **Auth:** `CURSOR_API_KEY` from 1Password (`op run`). Do not put `--api-key` on argv (ps leakage). [web:auth] [web:gha]
3. **Research-only lanes:** `--mode=ask` and **drop `--force`**. Do not use `--mode=plan` as a filesystem lock. [web:using] [web:params]
4. **No-git is dual:** prompt-level "Do not run git" **and** `<repo>/.cursor/cli.json` `permissions.deny`: `Shell(git)`, `Shell(sudo)`, `Shell(pkexec)`. Sandbox does **not** block the git binary. Deny wins over `--force`. Project file is permissions-only. [web:sandbox] [web:perms] [web:cliconfig]
5. **Network:** `--sandbox enabled` defaults to deny. If the lane needs npm/GH, add `<repo>/.cursor/sandbox.json` allowlist. Never `allow_all` without a reason. Private/loopback/link-local/cloud-metadata stay blocked. [web:sandbox]
6. **Pin Cursor Models, not Auto.** Default volume: `composer-2.5` ($0.50/$2.50). Next: `cursor-grok-4.6-high` / `xhigh` (not `-fast`, 2×). Avoid Composer 2.5 Fast (6×). Avoid `--model auto` on personal Ultra — Cursor Router (`auto-smart`) is Teams/Enterprise only. Confirm IDs with `cursor-agent --list-models` at freeze. [web:pricing] [web:router]
7. **Do not spend Cursor Other Models on Fable or Sol.** Fable on Cursor is $10/$50 and some IDs are NO ZDR; Anthropic-direct already has Fable. If Cursor Models is empty: `kimi-k2.7-code` then `kimi-k3-high`, then `glm-5.2-high`. [web:pricing]
8. **Success = exit 0 AND** a stream-json line `type=="result" && subtype=="success" && is_error==false`. Missing result → fail and dump stderr. Do **not** bill from CLI events (no usage fields on the 2026-09-16 output-format schema; changelog Feb 2026 claimed them — parse unknown fields defensively, do not depend). [web:outfmt] [web:changelog]
9. **Do not pass `--stream-partial-output`** unless the consumer implements the `timestamp_ms` / `model_call_id` three-way filter. Prefer the terminal `result` text. [web:outfmt]
10. **Host timeout + closed stdin are mandatory.** No CLI timeout; bash watches hang; single-turn `-p` waits for subagents. `timeout 15m` + `</dev/null>`. [post:steipete-bash] [web:changelog]
11. **Do not use `--worktree`, `agent persist`, `cursor-agent worker`, or Cloud Agents HTTP API as the D13 replacement.** Worktrees fork under `~/.cursor/worktrees/` (max 25/machine). Persist is a different lifetime. Worker/API are remote Cloud Agent jobs on the **same** model pools plus infra. [web:worktrees] [web:selfhost] [web:api-ep]
12. **SDK is optional in-process glue**, not a new pool. Dashboard tag `SDK`. If used: enable `sandboxOptions.enabled` (SDK local sandbox defaults **off**); pin `model: { id: "composer-2.5" }`. Prefer CLI `-p` for the volume lane. [web:sdk-ts] [web:sdk-py]
13. **`.cursor/environment.json` is Cloud-Agent-only.** Local `-p` will not run `install`. CLI hooks are `.cursor/hooks.json` — beep-effect `.claude/settings.json` hooks do not fire here. [web:ca-setup] [web:env-schema]
14. **Grok Bot weekly is a third meter.** Linking SuperGrok does not feed Cursor CLI. Operator on-demand is **disabled** → included-pool exhaustion is a hard stop. Unbounded `-p --force` loops can burn a month in a day — retry budget lives on the host. [post:grok-cli-quota] [post:ultra-vs-grokbot] [post:quota-drain] [web:pricing]
15. **Linux sandbox remaps UID to 0.** Tests that assert `id -u` must use `CURSOR_ORIG_UID` / `CURSOR_ORIG_GID`. [web:runmodes]
16. **CI copy-paste trap:** the official GHA example omits `--trust`/`--force`/`--sandbox`. Do not ship that as the beep-effect lane. [web:gha]
17. **Resume only a crashed one-shot** via `--resume <session_id>` from the init/result events. `--continue` is `--resume=-1` (last chat, wrong for parallel lanes). [web:params]
18. **Quota errors:** no published exit-code table or frozen quota string. Changelog: rate limits print the **actual server message**. Wrapper treats any nonzero / missing `result` as lane failure. [web:changelog] [web:auth] [web:outfmt]
