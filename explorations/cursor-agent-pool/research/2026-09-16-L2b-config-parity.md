# L2b — Cursor agent-config parity (rules, hooks, skills, subagents, MCP, plugins)

Lane: L2 (agent-config parity)
Date: 2026-09-16
Repo: beep-effect
Status: RESEARCH STOPPED (turn 28). Sections 1–8 filled from official docs; Sources / Recommendations / sidecar written.

Scope (narrowed after first-run abort):
- (a) Official hooks doc: `stop` in headless vs interactive; Cloud Agent hook behaviour; hook output schema per event.
- (b) AGENTS.md support and precedence vs `.cursor/rules`.
- (c) Skills auto-discovery (`.claude/skills`, `.agents/skills`) and the skills doc.
- (d) Subagent frontmatter fields (`model`/`tools`/`readonly`?) and headless support.
- (e) `.cursor/mcp.json` env interpolation and Claude `.mcp.json` import.
- (f) Plugin manifest format and Claude-plugin compatibility.
- (g) Telemetry / OTel / usage export.

Locally proven (DO NOT re-derive): under `cursor-agent -p`, these fire: `sessionStart`, `preToolUse`, `postToolUse`, `postToolUseFailure`, `beforeShellExecution`, `afterShellExecution`, `afterFileEdit`, `sessionEnd`. These did NOT fire: `stop`, `beforeSubmitPrompt`.

## Parity matrix (Claude Code / Codex CLI / Cursor)

| Surface | Claude Code | Codex CLI | Cursor | Notes / GAP |
|---|---|---|---|---|
| Instructions | `AGENTS.md` + `CLAUDE.md` (beep-effect: `CLAUDE.md` → `AGENTS.md`) | `AGENTS.md` native | Native `AGENTS.md` **and** `CLAUDE.md` **and** `.cursor/rules/*.mdc`; Team → Project → User; `.cursorrules` deprecated | GAP: AGENTS.md vs `.mdc` conflict order undocumented; symlink pair may inject twice |
| Hooks | `.claude/settings.json` PascalCase events | `.codex/hooks.json` same names | Native `.cursor/hooks.json` camelCase; **also loads Claude settings** if third-party configs enabled; exit 2 = deny | Official GAP: `Notification`, `PermissionRequest`. Headless `-p` GAP: `stop`, `beforeSubmitPrompt`. Cloud GAP: `sessionStart`/`sessionEnd`/MCP/Tab |
| Skills | `.claude/skills/*/SKILL.md` | `.agents/skills` (here: symlink → `.claude/skills`) | Auto-discovers `.cursor/skills`, `.agents/skills`, `.claude/skills`, `.codex/skills` (+ `~/` variants) | GAP: `.grok/skills` not discovered; possible duplicate listing of the symlink pair |
| Subagents | `.claude/agents/*.md` (`name`, `description`, `tools`) | `.codex/agents/*.toml` (+ some `.md`) | `.cursor/agents/*.md` + auto-load `.claude/agents/*.md` + `.codex/agents/*.md`; fields `name`, `description`, `model`, `readonly`, `is_background` | GAP: no documented `tools:`; Codex `.toml` **not** loaded; `exploreSubagentModel` is CLI-config, not this doc |
| MCP | repo `.mcp.json` | Codex MCP in config.toml | `.cursor/mcp.json` ∪ `~/.cursor/mcp.json` (project name wins); `${env:VAR}` interpolation | GAP: Claude `.mcp.json` **not** documented as imported |
| Plugins | Claude plugin marketplaces (`enabledPlugins` in settings) | n/a | Cursor Plugin (`.cursor-plugin/plugin.json`: rules+skills+agents+commands+hooks+MCP) or Agent Plugin (root `plugin.json`: skills+MCP only) | GAP: Claude plugin layout (`.claude-plugin/`) is **not** claimed compatible; use `--plugin-dir` or a Cursor/Agent-Plugins manifest |
| Commands | slash commands / skills | skills | Plugin `commands/*.md`; `/migrate-to-skills`; CLI `/` menu. Editor commands URL **redirects to skills help** | GAP: no first-class project `.cursor/commands` doc outside plugins |
| Telemetry | `hook-pulse.sh` / `law-pulse.sh` → local Grafana | same | Hook scripts still the OSS path; Enterprise OTel export (`cursor.token.usage`, `cursor.hook.execution_complete`, …) | GAP: OTel is Enterprise + public HTTPS collector only; no local OTLP |

## 1. Instructions (AGENTS.md vs `.cursor/rules`)

**Cursor reads `AGENTS.md` natively.** Official rules doc (fetched 2026-09-16 from `https://cursor.com/docs/rules`): Cursor supports `AGENTS.md` as an alternative to project rules. It is plain Markdown (no frontmatter). Nested placement is supported:

```
project/AGENTS.md
project/frontend/AGENTS.md
project/frontend/components/AGENTS.md
```

Nested files apply to that directory and descendants. Parent + nested instructions combine; more specific wins.

**Project rules** live in `.cursor/rules/` and **must** use `.mdc`. A plain `.md` in that directory is ignored (unless it is `AGENTS.md` at a directory root — the doc distinguishes these). Nested `.mdc` paths work (e.g. `.cursor/rules/frontend/components.mdc`).

Frontmatter fields (only these three documented):

```yaml
---
description: "..."
globs: "..."
alwaysApply: false
---
```

| `alwaysApply` | `description` | `globs` | Result |
|---|---|---|---|
| `true` | ignored | ignored | Always included |
| `false` | omitted | provided | Auto-attached for matching files |
| `false` | provided | omitted | Agent-selected when relevant |
| `false` | omitted | omitted | Applied only when manually mentioned |

**Precedence among Cursor-native rule categories** (doc): `Team Rules → Project Rules → User Rules` (earlier wins on conflict). **GAP: the rules page does not say where `AGENTS.md` sits relative to `.cursor/rules/*.mdc`.** INFERENCE: treat them as two instruction channels that both get injected; do not assume one always overrides the other without a local experiment.

**User Rules:** Cursor Settings → Customize → Rules. Global. Apply to Agent (Chat). Explicitly **do not** apply to Inline Edit (`Cmd/Ctrl+K`) or Cursor Tab.

**Team/Enterprise Rules:** dashboard-managed; can be enforced (members cannot disable) and glob-scoped.

**Creating rules:** `/create-rule` in Agent, or Customize → Rules → Add Rule. The CLI ships a built-in skill `generate-rule` (from the research brief's `~/.cursor/skills-cursor/` listing) but the **rules doc names `/create-rule`, not `/generate-rule`**. INFERENCE: `generate-rule` is the built-in skill implementation of create-rule.

**CLI confirmation** (`https://cursor.com/docs/cli/using`, fetched 2026-09-16): the CLI **supports `.cursor/rules` and also reads root-level `AGENTS.md` and `CLAUDE.md`**. So beep-effect's `AGENTS.md` (symlinked as `CLAUDE.md`) is consumed twice by name — INFERENCE: if they are the same inode, Cursor still may inject two copies unless it de-dupes. **GAP: de-dupe of AGENTS.md vs CLAUDE.md when they are a symlink pair is not documented.** Prefer keeping the symlink (Claude needs CLAUDE.md; Cursor reads both).

**Help-center confirmation** (`https://cursor.com/help/customization/rules`, fetched 2026-09-16):

- Project-root `AGENTS.md` is **automatically recognized** (plain Markdown).
- Project-root `CLAUDE.md` is **also recognized**; "its instructions apply to every conversation, regardless of any `alwaysApply` setting."
- **Legacy `.cursorrules` is deprecated.** Move contents into `.cursor/rules/` as always-apply, then delete `.cursorrules`.
- User rules: Customize → Rules **or** machine-local `~/.cursor/rules` (does not sync).
- Precedence restated: **Team → Project → User**.
- Rules affect **Agent chat**, not Tab, Inline Edit, or Bugbot reviews.

**CLI confirmation** (`https://cursor.com/docs/cli/using`): CLI supports `.cursor/rules` and reads root `AGENTS.md` and `CLAUDE.md`.

**Creating rules:** `/create-rule` in Agent; CLI `cursor-agent generate-rule` / `rule` (interactive) per parameters page.

**Claude Code:** `AGENTS.md` / `CLAUDE.md` (repo symlink). **Codex CLI:** `AGENTS.md` native. **Cursor:** `AGENTS.md` **and** `CLAUDE.md` **plus** `.cursor/rules/*.mdc`. If beep-effect keeps the symlink pair, Cursor will see both names; **GAP: de-dupe undocumented**.

Cloud Agents: overview (`https://cursor.com/docs/cloud-agent`) confirms repo `.cursor/hooks.json` + `.cursor/environment.json` + team MCP; **does not mention AGENTS.md/rules/skills** on that page. INFERENCE: Cloud clones the repo, so root `AGENTS.md` / `.cursor/rules` / project skills should be on disk; user-level `~/.cursor/*` will not. Skills page already said project skills are **not** copied as a special Cloud sync (they're in the clone if committed).

## 2. Hooks (events, schemas, headless, Cloud Agents)

Official source: `https://cursor.com/docs/hooks` (fetched 2026-09-16). Cursor **explicitly loads Claude Code hooks**; exit status `2` = block, equivalent to permission `deny`.

### Files

| Layer | Path | Notes |
|---|---|---|
| Project | `<root>/.cursor/hooks.json` | cwd = project root; requires trusted workspace; VCS-ok |
| User | `~/.cursor/hooks.json` | cwd = `~/.cursor/` |
| Enterprise-managed | macOS `/Library/Application Support/Cursor/hooks.json`; Linux/WSL `/etc/cursor/hooks.json`; Windows `C:\ProgramData\Cursor\hooks.json` | |
| Team | Enterprise dashboard | |

Priority: **Enterprise → Team → Project → User**. For permission decisions: `deny` > `ask` > `allow`.

Schema version example:

```json
{ "version": 1, "hooks": { "afterFileEdit": [{ "command": ".cursor/hooks/format.sh" }] } }
```

Per-hook fields: `command` (required), `type` (`command` \| `prompt`, default `command`), `timeout` (seconds), `loop_limit` (default `5` for Cursor; Claude Code hooks default `null`), `failClosed` (default `false`), `matcher` (regex).

Exit: `0` = parse stdout JSON; `2` = deny; other failures fail-open unless `failClosed: true`. Permission hooks with malformed JSON **block even if fail-open** (`beforeShellExecution`, `beforeMCPExecution`, `beforeReadFile`, `beforeTabFileRead`, `subagentStart`, `preToolUse`).

Permission enum: `allow` | `deny` | `ask`. `ask` is accepted for `preToolUse` but **not currently enforced**. `ask` on `subagentStart` is treated as denial.

### Common stdin (most agent hooks)

`conversation_id`, `generation_id`, `model`, `model_id`, `model_params[]`, `hook_event_name`, `cursor_version`, `workspace_roots[]`, `user_email`, `transcript_path`.

Env: `CURSOR_PROJECT_DIR`, `CURSOR_VERSION`, `CURSOR_USER_EMAIL`, `CURSOR_TRANSCRIPT_PATH`, `CURSOR_CODE_REMOTE`, `CLAUDE_PROJECT_DIR` (alias). `sessionStart.env` is injected into later hooks of that session.

### Event catalog + output schema

| Event | Input extras | Output | Blocking? |
|---|---|---|---|
| `sessionStart` | `session_id`, `is_background_agent`, `composer_mode` | `{env, additional_context}` | No (fire-and-forget) |
| `sessionEnd` | `session_id`, `reason`, `duration_ms`, `is_background_agent`, `final_status`, `error_message` | none | No |
| `preToolUse` | `tool_name`, `tool_input`, `tool_use_id`, `cwd`, `agent_message` | `{permission, user_message, agent_message, updated_input}` | Yes |
| `postToolUse` | `tool_name`, `tool_input`, `tool_output`, `tool_use_id`, `cwd`, `duration` | `{updated_mcp_tool_output, additional_context}` | No |
| `postToolUseFailure` | `tool_name`, `tool_input`, `tool_use_id`, `cwd`, `error_message`, `failure_type` (`error`\|`timeout`\|`permission_denied`), `duration`, `is_interrupt` | `{additional_context}` | No |
| `subagentStart` | `subagent_id`, `subagent_type`, `task`, `parent_conversation_id`, `tool_call_id`, `subagent_model`, `is_parallel_worker`, `git_branch` | `{permission, user_message}` | Yes |
| `subagentStop` | `subagent_type`, `status`, `task`, `description`, `summary`, `duration_ms`, `message_count`, `tool_call_count`, `loop_count`, `modified_files`, `agent_transcript_path` | `{followup_message}` | loop_limit |
| `beforeShellExecution` | `command`, `cwd`, `sandbox` | `{permission, user_message, agent_message}` | Yes |
| `afterShellExecution` | `command`, `output`, `duration`, `sandbox` | none | No |
| `beforeMCPExecution` | `tool_name`, `tool_input`, `mcp_server_name` (+ `url`/`mcp_server_url` for HTTP/SSE, `command` for stdio) | `{permission, user_message, agent_message}` | Yes |
| `afterMCPExecution` | + `result_json`, `duration` | none | No |
| `beforeReadFile` | `file_path`, `content`, `attachments[]` (`file`\|`rule`) | `{permission, user_message}` | Yes |
| `afterFileEdit` | `file_path`, `edits[{old_string,new_string}]` | none | No |
| `beforeSubmitPrompt` | `prompt`, `attachments[]` | `{continue: bool, user_message}` | Yes (`continue`) |
| `preCompact` | `trigger`, `context_usage_percent`, `context_tokens`, `context_window_size`, `message_count`, `messages_to_compact`, `is_first_compaction` | `{user_message}` | **Cannot block** |
| `stop` | `status`, `loop_count` | `{followup_message}` | loop_limit follow-up |
| `afterAgentResponse` | `text` | none | No |
| `afterAgentThought` | `text`, `duration_ms` | none | No |
| `beforeTabFileRead` / `afterTabFileEdit` | Tab-only | permission / none | Tab |
| `workspaceOpen` | no conversation fields | `{pluginPaths[]}` | N/A |

**`stop` vs `sessionEnd` (official):** `stop` is the agent-loop end and **can auto-submit a follow-up** (`followup_message`, capped by `loop_limit`). `sessionEnd` is the IDE composer-session end and **cannot** continue the loop. Cloud Agents generally lack an editor-lifetime session boundary, so **`sessionEnd` is unavailable there**.

**Headless `-p` (local, already proven — not re-derived):** fires `sessionStart`, `preToolUse`, `postToolUse`, `postToolUseFailure`, `beforeShellExecution`, `afterShellExecution`, `afterFileEdit`, `sessionEnd`. Does **not** fire `stop` or `beforeSubmitPrompt`. Official hooks page **does not document CLI `-p` behaviour**. INFERENCE: `stop` is interactive/agent-loop; print-mode ends via `sessionEnd` without the `stop` follow-up channel. `beforeSubmitPrompt` is user-submit-gated, so headless `-p` skips it (prompt is CLI argv, not a composer submit).

### Cloud Agent hook behaviour (official)

Cloud loads **command** hooks from repo `.cursor/hooks.json` + Enterprise team/managed hooks. **User `~/.cursor/` hooks are unavailable** (cloud VM has no home). Prompt-type hooks do **not** run in cloud.

Cloud **supported:** `beforeShellExecution`, `afterShellExecution`, `beforeReadFile`, `afterFileEdit`, `preToolUse`, `postToolUse`, `postToolUseFailure`, `subagentStart`, `subagentStop`, `beforeSubmitPrompt`, `preCompact`, `afterAgentResponse`, `afterAgentThought`, `stop`.

Cloud **unavailable:** `sessionStart`, `sessionEnd`, `beforeMCPExecution`, `afterMCPExecution`, `beforeTabFileRead`, `afterTabFileEdit`, `workspaceOpen`.

Cloud hooks start only after a potentially read-only exploratory phase becomes writable. Self-hosted workers: project + (Enterprise) team/enterprise hooks; on those workers `sessionStart`/`sessionEnd` run when a worker claim begins/ends.

### Claude/Codex event → Cursor map

| Claude/Codex event | Nearest Cursor event | Gap? |
|---|---|---|
| `SessionStart` | `sessionStart` (env + additional_context) | Cloud GAP: no `sessionStart` on hosted Cloud Agents |
| `UserPromptSubmit` | `beforeSubmitPrompt` (`continue` not `permission`) | Headless `-p` GAP: did not fire locally |
| `PreToolUse` | `preToolUse` (+ `updated_input`) | Closest match. Also `beforeShellExecution` / `beforeMCPExecution` / `beforeReadFile` as specialized gates |
| `PermissionRequest` | `preToolUse` / `beforeShellExecution` / `beforeMCPExecution` returning `ask` | **GAP:** `ask` not enforced on `preToolUse`; no dedicated PermissionRequest event |
| `PermissionDenied` | `postToolUseFailure` with `failure_type: "permission_denied"` | Observability only, not a decision event |
| `PostToolUse` | `postToolUse` | OK |
| `PostToolUseFailure` | `postToolUseFailure` | OK |
| `Notification` | **GAP — no Cursor Notification hook** | Need `afterAgentResponse` / `afterAgentThought` or pulse scripts from other events |
| `Stop` | `stop` (followup_message) | Headless `-p` GAP: did not fire locally; Cloud **does** list `stop` as supported |
| `SessionEnd` | `sessionEnd` | Cloud hosted GAP: unavailable; self-hosted workers get it on claim end |

Matcher aliases worth noting: `beforeSubmitPrompt` matcher context `UserPromptSubmit`; `stop` matcher `Stop` — Cursor is explicitly bridging Claude Code names.

### Third-party / Claude Code hook import (official)

Source: `https://cursor.com/docs/reference/third-party-hooks` (fetched 2026-09-16).

**Prerequisite:** Settings → Rules, Skills, Subagents → **Include third-party Plugins, Skills, and other configs** must be enabled (account feature-flagged).

Claude Code hooks are loaded from (lowest in merge stack):

1. Enterprise hooks
2. Team hooks
3. Project `.cursor/hooks.json`
4. User `~/.cursor/hooks.json`
5. `.claude/settings.local.json`
6. `.claude/settings.json`
7. `~/.claude/settings.json`

All matching hooks from every source **run**; on conflict, higher-priority source wins.

Cursor **maps Claude event names** automatically:

| Claude Code | Cursor | Supported? |
|---|---|---|
| `PreToolUse` | `preToolUse` | Yes |
| `PostToolUse` | `postToolUse` | Yes |
| `UserPromptSubmit` | `beforeSubmitPrompt` | Yes (interactive; local `-p` did not fire) |
| `Stop` | `stop` | Yes (interactive; local `-p` did not fire) |
| `SubagentStop` | `subagentStop` | Yes |
| `SessionStart` | `sessionStart` | Yes |
| `SessionEnd` | `sessionEnd` | Yes |
| `PreCompact` | `preCompact` | Yes |
| **`Notification`** | — | **No (official GAP)** |
| **`PermissionRequest`** | — | **No (official GAP)** |

Also **not in the mapping table** (so not imported from Claude settings): `PermissionDenied`, `PostToolUseFailure`. Native Cursor still has `postToolUseFailure` if you write `.cursor/hooks.json`.

Tool-name mapping when using Claude matchers: `Bash`→`Shell`, `Edit`→`Write`; `Read`/`Write`/`Grep`/`Task` same; **`Glob`, `WebFetch`, `WebSearch` matchers = not supported**.

Response compatibility: Claude nested `hookSpecificOutput.permissionDecision` **and** Cursor flat `{permission, updated_input}` both work. For Stop/SubagentStop, Claude `{decision:"block", reason}` ≡ Cursor `{followup_message}`.

Native-only (not in Claude format): `subagentStart`, `loop_limit`, team/enterprise dashboard distribution.

**beep-effect implication:** existing `.claude/settings.json` hooks can fire in Cursor **if** third-party configs are enabled — but `Notification` and `PermissionRequest` (and Codex-parity `PermissionDenied`) **will never fire**. Map those pulses onto `postToolUseFailure` / `afterAgentResponse` / `sessionEnd` instead. For Cloud Agents, **Claude user/project-local `~/.claude` is irrelevant**; only repo `.cursor/hooks.json` (and enterprise/team) load. **Do not rely on `.claude/settings.json` for Cloud or for the missing events — commit a native `.cursor/hooks.json`.**

## 3. Skills (Agent Skills standard, discovery paths)

Official source: `https://cursor.com/docs/skills` (fetched 2026-09-16). Skills are the Agent Skills standard: a directory with `SKILL.md`, optional `scripts/`, `references/`, `assets/`. Progressive load.

### Discovery — Cursor **does** auto-discover Claude and Codex skill dirs

Project/user:

```
.agents/skills/
.cursor/skills/
~/.agents/skills/
~/.cursor/skills/
```

Claude/Codex-compatible (auto-discovered):

```
.claude/skills/
.codex/skills/
~/.claude/skills/
~/.codex/skills/
```

**GAP vs beep-effect:** repo uses `.agents/skills` (Codex) and `.claude/skills` (Claude). Cursor will see **both**. It will **not** automatically see `.grok/skills` (not listed). Nested `apps/web/.cursor/skills/` is scoped to that subtree.

### Frontmatter

Required: `name` (lowercase / digits / hyphens; **must match folder name**), `description`. Optional: `paths` (globs; comma-separated string also OK), `disable-model-invocation` (true → slash-only), `icon`, `color`, `metadata`. Legacy `globs` still accepted; new skills should use `paths`.

### Cloud

- Personal skills in `~/.cursor/skills/` **can be synced** to Cloud Agents (settings: Agents and Context and Tools). Team admins can forbid this.
- Project skills, `~/.agents/skills/`, and unsynced local skills are **not** copied to Cloud Agents.
- Self-hosted workers: put skills in the repo or bake into the worker image.

CLI/headless skill discovery is **not specified** on this page. INFERENCE: `-p` in a trusted workspace with repo skills present should see `.cursor/skills` / `.agents/skills` / `.claude/skills` because discovery is workspace-relative.

### Built-ins (from the skills page)

`/automate` `/autopilot` `/canvas` `/create-hook` `/create-rule` `/create-skill` `/create-subagent` `/cursor-blame` `/loop` `/migrate-to-skills` `/review` `/review-bugbot` `/review-security` `/sdk` `/shell` `/split-to-prs` `/statusline` `/update-cli-config` `/update-cursor-settings`

`/migrate-to-skills` converts (a) dynamic rules with no globs and `alwaysApply` false/unspecified, and (b) slash commands → skills with `disable-model-invocation: true`. Does **not** migrate `alwaysApply: true` or globbed rules, nor user rules (not on disk).

**Claude Code:** `.claude/skills/*/SKILL.md`. **Codex:** `.agents/skills`. **Cursor:** both of those **plus** `.cursor/skills/` and `~/.cursor/skills/`.

## 4. Subagents (frontmatter, model pin, headless)

Official source: `https://cursor.com/docs/subagents` (fetched 2026-09-16). Supported in **editor, CLI, and Cloud Agents**.

### Discovery (Claude/Codex dirs auto-loaded)

| Layer | Paths | Precedence |
|---|---|---|
| Project | `.cursor/agents/*.md`, `.claude/agents/*.md`, `.codex/agents/*.md` | project > user; **`.cursor/` > `.claude/` > `.codex/`** on name conflict |
| User | `~/.cursor/agents/*.md`, `~/.claude/agents/*.md`, `~/.codex/agents/*.md` | |

**GAP vs beep-effect:** Codex subagents are `.codex/agents/*.toml` (architecture-guardian, code-patterns-strategist, crispener, effect-first-developer, jsdoc-annotation-specialist, modularization-analyst, schema-first-developer). Cursor auto-loads **`.codex/agents/*.md`**, not `.toml`. Claude format `.claude/agents/*.md` **is** loaded. So the 7 Codex TOML agents will **not** appear in Cursor unless ported to Markdown.

### Frontmatter (documented)

```yaml
---
name: security-auditor
description: Security specialist.
model: inherit
readonly: true
---
```

| Field | Type | Default | Meaning |
|---|---|---|---|
| `name` | string | filename | id / display |
| `description` | string | — | delegation hint ("use proactively" / "always use for" encouraged) |
| `model` | string | `inherit` | **can pin a different model**, e.g. `gpt-5.6-sol` or `claude-opus-5[effort=high,context=300k]` |
| `readonly` | boolean | `false` | blocks writes and state-changing shell |
| `is_background` | boolean | `false` | non-blocking; state under `~/.cursor/subagents/` |

**GAP: no documented `tools` frontmatter field.** The page talks about tool access / Task-tool spawning but does not give a `tools:` schema. Claude Code agents often have `tools:` — do not assume Cursor honors it without a local probe.

`exploreSubagentModel` is **not mentioned** on this page. It **is** a key in `~/.cursor/cli-config.json` per the research brief. INFERENCE: CLI-config override for the built-in Explore subagent, independent of custom `.md` `model:` pins.

### Built-ins

FAQ names: `explore`, `bash`, `browser`. Hooks `subagentStart` examples used `generalPurpose` — that type is from the hooks page, not the subagents FAQ. INFERENCE: Task-tool generic workers may be `generalPurpose` even if the product FAQ only markets explore/bash/browser.

### Parallelism / nesting

No numeric parallelism cap documented. Recommends parallel independent workstreams. Child subagents allowed within a nesting limit; a subagent launched by a subagent **cannot** launch further ones. Task tool access required; hooks/policies can block spawn (`subagentStart` permission).

Foreground = blocking. Background = immediate return + resume by agent ID. Isolation default = shared checkout (racey); optional worktree/branch/cloud VM.

Cloud: subagents on **separate VMs and branches**; MCP from **team config**, not the local session.

**Headless:** page says "CLI" support, no distinct `-p` caveats. INFERENCE: custom agents in `.cursor/agents` are available to `cursor-agent -p` in a trusted workspace.

**Claude Code:** `.claude/agents/*.md` (name, description, model, tools). **Codex:** `.codex/agents/*.toml`. **Cursor:** Markdown in `.cursor/agents` **and** Claude `.md` **and** Codex `.md` (not toml). Model pin: **yes**. Readonly: **yes**. Tools list: **GAP**.

## 5. MCP (project vs user, env interpolation, Claude `.mcp.json`)

Official source: `https://cursor.com/docs/mcp` (fetched 2026-09-16).

### Config paths

| Layer | Path | Documented? |
|---|---|---|
| Project | `.cursor/mcp.json` | Yes |
| User | `~/.cursor/mcp.json` | Yes |
| Team | Dashboard → Integrations & MCP / team marketplace | Yes |
| Enterprise | admin allowlists, network restrictions, user-MCP policy | Yes |
| Claude-format repo-root `.mcp.json` | **not documented as imported or auto-discovered** | **GAP** |

beep-effect already has `.mcp.json` (Claude). **Do not assume Cursor reads it.** Need a project `.cursor/mcp.json` (symlink or generated copy) for Cursor CLI/Cloud.

### Transports

- **stdio:** `command`, optional `args`, `env`, `envFile` (`envFile` is stdio-only)
- **SSE:** `url`
- **Streamable HTTP:** `url`

OAuth: `auth` object with `CLIENT_ID` (required), `CLIENT_SECRET` (optional), `scopes` (optional). Callbacks: `https://www.cursor.com/agents/mcp/oauth/callback` (web/agent) and `http://localhost:8787/callback` (desktop).

### Env interpolation (official, works in `command`/`args`/`env`/`url`/`headers`)

- `${env:NAME}`
- `${userHome}`
- `${workspaceFolder}` — directory containing the project's `.cursor/mcp.json`
- `${workspaceFolderBasename}`
- `${pathSeparator}` / `${/}`

Example: `"API_KEY": "${env:API_KEY}"`. Credentials should be env vars, not literals.

### Permissions / `--approve-mcps`

MCP tools prompt like terminal run-modes. Enterprise can set approved local command patterns, approved remote URL patterns, and **per-server tool allowlists** (empty allowlist = all tools of an approved server). No per-tool syntax inside `mcp.json` itself.

**`--approve-mcps` is in `cursor-agent --help` (research brief) but is NOT mentioned on the MCP doc page.** INFERENCE: CLI flag to skip the MCP approval prompt for a print-mode run (pairs with `--trust --force`). Confirm against `https://cursor.com/docs/cli/using` / parameters page.

Cloud Agents: **team MCP servers** from Dashboard > Integrations & MCP. Local `~/.cursor/mcp.json` will not follow the agent to the cloud VM.

Logs: Output panel → "MCP Logs". Failed server is isolated.

**Merge / precedence (help):** `https://cursor.com/help/customization/mcp` — project `.cursor/mcp.json` and user `~/.cursor/mcp.json` **are merged**. Same server name → **project wins**. Cloud Agents: team servers from Dashboard → Integrations & MCP / `cursor.com/agents`; "Add to Team Marketplace" also exposes them to Agent Window, IDE, and CLI.

**`--approve-mcps`:** official CLI flag (`https://cursor.com/docs/cli/reference/parameters`) — "Automatically approve all MCP servers." Pair with `--trust --force` for headless.

**Per-tool allow (two layers):**

1. CLI tokens in `~/.cursor/cli-config.json` or `<project>/.cursor/cli.json` (`https://cursor.com/docs/cli/reference/permissions`): `Mcp(server:tool)` with wildcards (`Mcp(datadog:*)`, `Mcp(*:search)`, `Mcp(*:*)`). Also `Shell(cmd)`, `Read(glob)`, `Write(glob)`, `WebFetch(domain)`. Deny > allow. Project `cli.json` supports **only `permissions`**.
2. IDE Auto-review allowlists via `permissions.json` (`https://cursor.com/docs/reference/permissions.md`): `~/.cursor/permissions.json` ∪ `<workspace>/.cursor/permissions.json` (arrays concatenated; JSONC ok). Fields: `mcpAllowlist` (`server:tool`), `terminalAllowlist`, `autoRun.{allow,block}_instructions`. Precedence: **team admin dashboard > permissions.json > IDE settings UI**. Defining a key **replaces** that IDE allowlist (empty array = empty, no fallback).

**Claude Code:** repo `.mcp.json`. **Codex:** MCP in config.toml. **Cursor:** `.cursor/mcp.json` + user file; **Claude `.mcp.json` import = GAP**. beep-effect already has `.mcp.json` with servers `shadcn`, `next-devtools`, `serena`, `nlp`, `fallow`, `chrome-devtools`, `webstorm`, `phoenix-docs`, `phoenix` — Cursor will **not** see them until copied/generated into `.cursor/mcp.json` with `${env:…}` (do not commit raw keys).

## 6. Plugins & marketplaces (manifest, Claude-plugin compatibility)

Official source: `https://cursor.com/docs/plugins` (fetched 2026-09-16). Two formats:

| | Agent Plugin (vendor-neutral) | Cursor Plugin |
|---|---|---|
| Manifest | root `plugin.json` with `$schema: https://agent-plugins.org/schemas/1.0.0/plugin.schema.json` | `.cursor-plugin/plugin.json` (`name` required) |
| Skills | Yes | Yes |
| MCP (`mcp.json`) | Yes | Yes |
| Rules `.mdc` | **No** | Yes (`rules/`) |
| Agents | **No** | Yes (`agents/`) |
| Commands | **No** | Yes (`commands/`) |
| Hooks | **No** | Yes (`hooks/`) |
| Variables | **No** | Yes |

A **Cursor Plugin can carry hooks + skills + agents + MCP + rules + commands together.**

Agent Plugin tree:

```
my-plugin/plugin.json
         /skills/.../SKILL.md
         /mcp.json
```

Cursor Plugin tree:

```
my-plugin/.cursor-plugin/plugin.json
         /.cursor-plugin/marketplace.json   # multi-plugin repos
         /rules/*.mdc
         /skills/*/SKILL.md
         /agents/
         /commands/
         /hooks/
         /mcp.json
```

`${CURSOR_PLUGIN_ROOT}` is the plugin root. Cursor **does not** expand `${PLUGIN_ROOT}` / `${PLUGIN_DATA}` in an Agent Plugin `mcp.json`.

Local dev: `~/.cursor/plugins/local/my-plugin`. Symlinks only if target is inside that dir. Marketplace plugin of the same name wins over local.

Marketplaces: official Cursor Marketplace (reviewed OSS); `cursor.directory` for community; Team = 1 private marketplace; Enterprise = unlimited. Dashboard → Plugins. Install modes: Default Off / Default On / Required. GitHub import + Cursor GitHub App auto-refresh.

`workspaceOpen` hook can return `pluginPaths[]` for dynamic plugin load.

**Claude Code plugin layout compatibility: NOT claimed.** Claude Code plugins typically use `.claude-plugin/plugin.json` (or marketplace.json) with skills/agents/hooks/mcp. Cursor looks for **root `plugin.json` (Agent Plugins standard)** or **`.cursor-plugin/plugin.json`**. INFERENCE: a Claude plugin directory will **not** load as a Cursor plugin unless you add a Cursor/Agent-Plugins manifest. `--plugin-dir` is in `cursor-agent --help` (research brief) but **not documented on this plugins page**.

**GAP:** `cursor-agent plugin` subcommand behaviour (persist, mcp, plugin, worker listed in CLI help) not covered here — see CLI pages.

Skills page also said: skills are **not** imported from a raw GitHub repo; the repo needs `.cursor-plugin/marketplace.json` to be importable as a plugin.

## 7. Commands (`.cursor/commands` vs skills)

Cursor is **migrating slash commands → skills**. Evidence:

- `https://cursor.com/docs/agent/chat/commands` and `https://cursor.com/docs/agent/commands` **308-redirect to** `https://cursor.com/help/customization/skills#how-do-i-migrate-commands-to-skills` (probed 2026-09-16).
- Help/skills (`https://cursor.com/help/customization/skills`): `/migrate-to-skills` (Cursor 2.4+) converts **workspace- and user-level slash commands** into skills with `disable-model-invocation: true` (keeps explicit `/name` invocation). Dynamic rules (no globs, `alwaysApply` false/unset) also convert; always-apply / globbed rules and User Rules do not.

**Plugin commands** (the only fully documented on-disk command format) — `https://cursor.com/docs/reference/plugins.md`:

```
commands/deploy-staging.md   # also .mdc / .markdown / .txt
```

```yaml
---
name: deploy-staging
description: Deploy the current branch to the staging environment
---
```

Discovered automatically from a Cursor Plugin's `commands/` dir (or manifest `commands` path). Template: `https://github.com/cursor/plugin-template` → `plugins/starter-advanced/commands/deploy-staging.md`.

**CLI in-session slash commands** (`https://cursor.com/docs/cli/reference/slash-commands`): `/model`, `/plan`, `/ask`, `/debug`, `/goal`, `/shell`, `/mcp`, `/plugin`, `/sandbox`, `/bedrock`, `/help`, `/clear`, `/resume`, `/fork`, `/quit` — these are **CLI verbs**, not project markdown.

**CLI `generate-rule` / `rule`:** interactive rule creator (`https://cursor.com/docs/cli/reference/parameters`), not a `.md` command.

**Headless `-p`:** no documented way to invoke a project command file as a slash command. INFERENCE: encode the workflow as a **skill** (auto-discovered from `.claude/skills` / `.agents/skills`) and mention it in the `-p` prompt, or pass `--plugin-dir` with a plugin that contains `commands/`.

**Claude Code:** slash commands + skills. **Codex:** skills. **Cursor:** skills are the portable layer; plugin `commands/` still exist; dedicated project `.cursor/commands` **outside a plugin is a doc GAP** (do not invent that path).

### Ignore files (related context surface)

`https://cursor.com/help/customization/ignore-files` (fetched 2026-09-16):

- Project-root `.cursorignore` — gitignore-style patterns excluded from **AI context**. Examples: `node_modules/`, `dist/`, `*.min.js`, `.env*`.
- Built-in exclusions: `.env` files, `.git/`, lock files.
- `.gitignore` patterns **also** omitted from AI context.
- Caveat: **terminal commands and MCP tools may still access files** excluded from Cursor’s file-access controls.
- **GAP:** `.cursorindexingignore` is **not mentioned** on this help page (filename appears in the research brief / salvage list). Distinctions among indexing vs Agent Read vs Tab vs Cloud/CLI are **not documented here**.

## 8. Telemetry / metrics / privacy / ZDR

Official source: `https://cursor.com/docs/enterprise/opentelemetry-export` (fetched 2026-09-16). **Enterprise-plan only.** Admin: Team Settings → OpenTelemetry Export. Server-side; starts ~1 minute after enable. **IDE and CLI activity represented; Cloud Agent lifecycle events exported.** Headless not named separately — INFERENCE: CLI coverage includes `cursor-agent -p`.

### Transport

Public HTTPS OTLP/HTTP **binary protobuf only**. Cursor POSTs `/v1/metrics` and `/v1/logs` (you enter the **base URL**, no `/v1`). No traces (`trace_id`/`span_id` absent). Prompt content is **not** exported. Historical data is **not** backfilled. Auth: gateway or static header (`Authorization: Bearer …`). Egress allowlist IPs documented on that page (AWS us-east-1-looking).

Families (separate toggles; `auto_enable_new_families` unless disabled):

| Family | Contents |
|---|---|
| `model_usage` | metrics `cursor.token.usage` (`input`/`output`/`cache_read`/`cache_creation`), `cursor.cost.usage` (best-effort USD, **not an invoice**); logs `cursor.api.request`, `cursor.api.error`, `cursor.api.correction` |
| `tool_calls` | metric `cursor.tool.calls` (`cursor.tool.kind` classifies builtin vs MCP) |
| `skills_hooks_plugins` | logs `cursor.skill.activated`, `cursor.hook.execution_complete`, `cursor.plugin.installed` |
| `cloud_agents` | `cursor.cloud_agent.setup`, `.artifact`, `.pull_request`, `.mcp_auth_error` |
| `grok_bot_agent_actions` | `cursor.grok_bot.mcp_tool_call`, `.shell_command`, `.browser_navigation`, `.computer_use_session` — **only if** team admin enables Action Recording; shells secret-scrubbed; URLs strip query/fragment |

Metrics = delta temporality, aggregate-only, **at-most-once**, no conversation IDs. Logs = **at-least-once**; dedupe on `cursor.event.id`. Join keys: `cursor.conversation.id` (session), `cursor.usage_event.id` (billing grain), `cursor.request.id`. **Subagents have separate conversation IDs; parent rollups not exported.** Tool-call and cost metrics **cannot currently be attributed to individual conversations**.

Scope: `cursor.telemetry` `0.1.0`. Resource: `service.name=cursor`, `cursor.team.id`, optional `cursor.user.id`. Wire details: `https://cursor.com/docs/enterprise/opentelemetry-export/wire.md`.

**ZDR:** this page does **not** claim OTel export preserves or breaks ZDR. It does say prompts are not in the export. Research brief: some Claude Fable SKUs on Cursor catalog are marked "NO ZDR" — that is a **model-routing** property, not a hook/log property. **GAP:** no first-party hook-to-OTel bridge for the repo's `hook-pulse.sh` / `law-pulse.sh` / `ai-metrics` Grafana LGTM path. Cursor's OTel is **enterprise-cloud-side**, not a local collector you point at Grafana unless you expose a public HTTPS collector.

**CLI `about`:** listed in `cursor-agent --help` (research brief); not covered on this OTel page.

**Claude/Codex:** repo already emits pulses from hooks to local Grafana. **Cursor:** can duplicate that via **the same hook scripts** on Cursor events (`sessionStart`/`preToolUse`/… — they fire in `-p`) **plus** optional Enterprise OTel. For a public OSS repo, **hook-script parity is the realistic path**; OTel export is an org-admin add-on.

### Analytics API (index only — bodies not fetched this lane)

`https://cursor.com/docs/account/teams/analytics-api.md` — team analytics (commands adoption, MCP adoption, Bugbot, conversation insights). `https://cursor.com/docs/account/teams/admin-api.md` — daily usage / spending. `https://cursor.com/docs/account/organizations/organization-admin-api.md#get-usage-events`.

### Privacy Mode / ZDR (hooks & logs implications)

Sources: `https://cursor.com/docs/enterprise/privacy-and-data-governance.md`, `https://cursor.com/help/security-and-privacy/privacy.md` (fetched 2026-09-16).

- **Privacy Mode** (Settings → General, or team-enforced): code is never used for training. Default-on for Enterprise.
- **ZDR:** "Most models run under Cursor's ZDR agreements." **Exceptions:** (1) **BYOK / own API keys** — ZDR does not apply; provider policy wins. (2) **Models with provider retention**, currently **Claude Fable 5.1 and Claude Fable 5** — Anthropic stores I/O for harm-prevention reviews, **not** training; off until admin approves at `cursor.com/dashboard/restricted_models/claude-fable-5-1`. Matches the catalog's "NO ZDR" mark on those SKUs (L3 lane). Guardrail trips auto-route to Claude Opus.
- **Cloud Agents** are the only feature that **stores code** (encrypted repo copies for the run, deleted after). Optional; disable if policy forbids storage.
- **OTel export does not include prompt content or traces** (see above). Hook stdout is still a **local** process — scripts can log secrets if you print stdin; keep pulse scripts as they are (event names / hashes, not prompt bodies).
- **`privacyMode` in `~/.cursor/cli-config.json`:** present in the research brief's local file; **not documented** on `https://cursor.com/docs/cli/reference/configuration`. INFERENCE: IDE/account Privacy Mode is the supported control; do not rely on an undocumented CLI key.
- **Memories:** `https://cursor.com/docs/context/memories` **308-redirects to `/docs/rules`**. No separate memories config for this parity surface.
- **Ignore files:** `.cursorignore` + `.gitignore` drop files from **AI context**; shell/MCP can still read them (`https://cursor.com/help/customization/ignore-files`). `.cursorindexingignore` **not documented** on that help page (GAP).

## Proposed `.cursor/` layout for beep-effect

Mirror `.codex/` / `.claude/` **without duplicating skill bodies**. Today the repo already has:

| Existing | Cursor consumption |
|---|---|
| `AGENTS.md` + `CLAUDE.md` → `AGENTS.md` | Both names auto-read (CLI + help/rules) |
| `.claude/skills/` (36) and `.agents/skills` → `../.claude/skills` | **Both auto-discovered** |
| `.claude/agents/*.md` (7 specialists) | **Auto-discovered**; `.cursor/` wins on name clash |
| `.codex/agents/*.toml` | **Not loaded** |
| `.claude/settings.json` hooks (10 events) + `.codex/hooks.json` | Claude format loadable **only if** third-party configs enabled; Cloud **ignores** `~/.claude` and does not map `Notification`/`PermissionRequest` |
| `.mcp.json` | **Not imported** |
| `.cursor/environment.json` + `install.sh` | Already the Cloud Agent env (name `beep-effect`, `install: bash .cursor/install.sh`) |
| `.grok/skills/graft` | **Not discovered** |

Proposed additions (commit these; do not replace Claude/Codex trees):

```
.cursor/
  environment.json          # KEEP
  install.sh                # KEEP
  hooks.json                # NEW native Cursor hooks (version 1)
  hooks/                    # thin wrappers → existing pulse scripts
    pulse.sh                # calls .codex/hooks/hook-pulse.sh
    law.sh                  # calls .codex/hooks/law-pulse.sh
    yeet-inbox.sh           # calls .claude/hooks/yeet-inbox.sh cursor
    session-start.sh        # packet-projections + yeet-inbox
  mcp.json                  # generated/copied from .mcp.json with ${env:VAR} only
  cli.json                  # project permissions.allow/deny (CLI tokens)
  permissions.json          # mcpAllowlist + terminalAllowlist (JSONC ok)
  agents/                   # OPTIONAL overrides only (add readonly: true, model pin)
                            # otherwise rely on .claude/agents/*.md
  rules/                    # OPTIONAL alwaysApply .mdc; do not fork AGENTS.md
  skills/                   # DO NOT copy; discovery already hits .claude/skills
  commands/                 # SKIP; skills are the portable layer
```

Suggested `.cursor/hooks.json` event wiring (native, so Cloud + `-p` both work where supported):

| Cursor event | Script | Why |
|---|---|---|
| `sessionStart` | `session-start.sh` | Claude/Codex `SessionStart` (packet projections + yeet). **Will not fire on hosted Cloud Agents** — accept that or run the same steps from `install.sh` |
| `preToolUse` | `pulse.sh` | Claude/Codex `PreToolUse` (fires under `-p`) |
| `beforeShellExecution` | optional extra deny policy | specialized gate; `failClosed` only if the script is trusted |
| `postToolUse` matcher `Write` | `law.sh` + impeccable hook.mjs | Codex `PostToolUse` Edit\|Write\|apply_patch |
| `postToolUseFailure` | `pulse.sh` | stand-in for `PermissionDenied` (`failure_type: permission_denied`) |
| `afterFileEdit` | `law.sh` | belt-and-suspenders; fires under `-p` |
| `afterAgentResponse` | `pulse.sh` (light) | **Notification GAP** analogue |
| `sessionEnd` | `pulse.sh` | Claude/Codex `SessionEnd` (fires under `-p`; **not** on hosted Cloud) |
| `stop` | omit for headless; optional follow-up in IDE | does **not** fire under `-p` |
| `beforeSubmitPrompt` | omit for headless | does **not** fire under `-p`; Cloud **does** list it |

Do **not** depend on Claude-settings import for the volume lane: Cloud VMs have no `~/.claude`, and `Notification`/`PermissionRequest` are official nos.

Headless invocation (already decided D13; flags now officially documented):

```
cursor-agent -p --trust --force --sandbox enabled --approve-mcps \
  --model <id> --output-format stream-json "<prompt>" </dev/null
```

Optional: `--plugin-dir <path>` if packaging the 7 agents + hooks as a Cursor Plugin (template: `https://github.com/cursor/plugin-template` `starter-advanced`).

## Gaps named

1. **`Notification` and `PermissionRequest` have no Cursor mapping** (`https://cursor.com/docs/reference/third-party-hooks`). `PermissionDenied` is also unmapped from Claude settings (native `postToolUseFailure` + `failure_type: permission_denied` is the observer).
2. **Headless `-p` does not fire `stop` or `beforeSubmitPrompt`** (local, not re-derived). Official hooks page does not document print-mode. Cloud **does** list `stop` + `beforeSubmitPrompt`.
3. **Hosted Cloud Agents drop `sessionStart`, `sessionEnd`, MCP hooks, Tab hooks, `workspaceOpen`, user `~/.cursor/` hooks, and prompt-type hooks.**
4. **Claude repo-root `.mcp.json` is not documented as imported.** Need `.cursor/mcp.json`.
5. **Codex `.codex/agents/*.toml` is not loaded.** Markdown `.claude/agents/*.md` is. `tools:` frontmatter is **undocumented** in Cursor (Claude agents in this repo use it; Cursor documents `readonly` instead).
6. **`exploreSubagentModel`** lives in local `cli-config.json` (research brief) but is **absent** from `https://cursor.com/docs/cli/reference/configuration` and the subagents page.
7. **AGENTS.md vs `.cursor/rules/*.mdc` conflict order undocumented.** Team → Project → User is documented; AGENTS.md slot is not. Symlink `CLAUDE.md` → `AGENTS.md` may double-inject (de-dupe undocumented).
8. **`.grok/skills` not in the discovery list.** Graft skill is Cursor-invisible unless copied/symlinked into a discovered dir.
9. **`.agents/skills` symlink to `.claude/skills` may surface each skill twice.** Discovery lists both roots. De-dupe undocumented.
10. **Claude plugin layout (`.claude-plugin/` / `enabledPlugins`) is not claimed compatible.** Cursor wants root `plugin.json` (Agent Plugins) or `.cursor-plugin/plugin.json`.
11. **Project `.cursor/commands/` outside a plugin is undocumented.** Commands URLs redirect to skills migration.
12. **`.cursorindexingignore` not on the ignore-files help page.**
13. **Enterprise OTel is not a substitute for hook-pulse → Grafana** (public HTTPS collector, Enterprise plan, no prompts, no per-conversation tool-cost attribution, subagent IDs isolated).
14. **`ask` permission on `preToolUse` is not enforced.** `ask` on `subagentStart` is treated as deny.
15. **Memories: no standalone doc** (`/docs/context/memories` → `/docs/rules`).
16. **`privacyMode` CLI key undocumented.** Fable 5/5.1 are the documented ZDR exceptions (admin-gated).

## Sources

- https://cursor.com/llms.txt — accessed 2026-09-16 — docs index (rules, skills, hooks, subagents, MCP, plugins, CLI, cloud, OTel, privacy URLs)
- https://cursor.com/docs/hooks — accessed 2026-09-16 — native hook events, stdin/stdout schemas, Cloud vs local, env vars, Claude exit-2, failClosed, loop_limit
- https://cursor.com/docs/rules — accessed 2026-09-16 — `.cursor/rules/*.mdc` frontmatter, AGENTS.md nested, Team→Project→User
- https://cursor.com/help/customization/rules — accessed 2026-09-16 — CLAUDE.md always-on, `.cursorrules` deprecated, `~/.cursor/rules`
- https://cursor.com/docs/cli/using — accessed 2026-09-16 — CLI reads `.cursor/rules`, `AGENTS.md`, `CLAUDE.md`; `-p`; MCP auto-detect wording
- https://cursor.com/docs/skills — accessed 2026-09-16 — SKILL.md frontmatter, discovery paths including Claude/Codex dirs, Cloud sync limits, `/migrate-to-skills`
- https://cursor.com/help/customization/skills — accessed 2026-09-16 — same discovery list; commands→skills migration; `/` and `@` invocation
- https://cursor.com/docs/subagents — accessed 2026-09-16 — `.cursor/agents` + `.claude/agents` + `.codex/agents` markdown, `model`/`readonly`/`is_background`, CLI+Cloud support
- https://cursor.com/docs/mcp — accessed 2026-09-16 — `.cursor/mcp.json`, `${env:VAR}` interpolation, stdio/SSE/HTTP, OAuth callbacks
- https://cursor.com/help/customization/mcp — accessed 2026-09-16 — project∪user merge (project name wins); Cloud team MCP
- https://cursor.com/docs/plugins — accessed 2026-09-16 — Agent Plugin vs Cursor Plugin component matrix, marketplace modes
- https://cursor.com/docs/reference/plugins.md — accessed 2026-09-16 — manifest fields, folder discovery, commands/agents/hooks formats, marketplace.json
- https://cursor.com/docs/reference/third-party-hooks — accessed 2026-09-16 — Claude settings.json import, event map, Notification/PermissionRequest unsupported, tool-name map
- https://cursor.com/docs/cli/reference/parameters — accessed 2026-09-16 — `--approve-mcps`, `--trust`, `--force`/`--yolo`, `--plugin-dir`, `--sandbox`, `generate-rule`, `about`, `mcp` subcommands
- https://cursor.com/docs/cli/headless — accessed 2026-09-16 — `-p --force` required to apply writes
- https://cursor.com/docs/cli/reference/configuration — accessed 2026-09-16 — `cli-config.json` / `.cursor/cli.json` keys, approvalMode, sandbox
- https://cursor.com/docs/cli/reference/permissions — accessed 2026-09-16 — `Shell`/`Read`/`Write`/`WebFetch`/`Mcp(server:tool)` tokens
- https://cursor.com/docs/cli/reference/slash-commands — accessed 2026-09-16 — in-session `/` verbs
- https://cursor.com/docs/reference/permissions.md — accessed 2026-09-16 — `permissions.json` mcpAllowlist / terminalAllowlist / autoRun
- https://cursor.com/docs/enterprise/opentelemetry-export — accessed 2026-09-16 — Enterprise OTLP metrics/logs, hook/skill events, no prompts/traces
- https://cursor.com/docs/enterprise/privacy-and-data-governance.md — accessed 2026-09-16 — Privacy Mode, ZDR, Fable retention exception, Cloud Agent storage
- https://cursor.com/help/security-and-privacy/privacy.md — accessed 2026-09-16 — Privacy Mode how-to, BYOK ZDR exception, Grok Bot caveats
- https://cursor.com/docs/cloud-agent — accessed 2026-09-16 — Cloud hooks from `.cursor/hooks.json`, environment.json, team MCP
- https://cursor.com/docs/cloud-agent/setup.md — accessed 2026-09-16 — environment.json `install` / Dockerfile `build`, resolution order
- https://cursor.com/docs/cloud-agent/best-practices.md — accessed 2026-09-16 — Cloud reads committed `.cursor/rules/*.mdc`; skills + agents.md recommended
- https://cursor.com/docs/cloud-agent/capabilities — accessed 2026-09-16 — team MCP; no extra repo-file loading claims
- https://cursor.com/help/customization/ignore-files — accessed 2026-09-16 — `.cursorignore` + `.gitignore`; shell/MCP still reach ignored files
- https://github.com/cursor/plugin-template — accessed 2026-09-16 — starter-simple / starter-advanced trees (rules, skills, agents, commands, hooks, MCP)
- https://raw.githubusercontent.com/cursor/plugin-template/main/README.md — accessed 2026-09-16 — template usage, marketplace.json
- https://raw.githubusercontent.com/cursor/plugin-template/main/plugins/starter-advanced/.cursor-plugin/plugin.json — accessed 2026-09-16 — example Cursor Plugin manifest
- https://raw.githubusercontent.com/cursor/plugin-template/main/plugins/starter-advanced/hooks/hooks.json — accessed 2026-09-16 — example plugin hooks
- https://agent-plugins.org/plugin-authors/manifest.md — accessed 2026-09-16 — portable `plugin.json` closed schema (`$schema`, `name`, …)

## Recommendations for beep-effect

1. **Keep `AGENTS.md` as the single instruction source.** Do not add a parallel always-apply `.cursor/rules/*.mdc` that restates it (conflict order vs AGENTS.md is undocumented). Leave `CLAUDE.md` → `AGENTS.md`. Optionally add *small* globbed `.mdc` files later for path-scoped conventions only.

2. **Commit `.cursor/hooks.json` (native)** wrapping existing `.codex/hooks/hook-pulse.sh`, `.codex/hooks/law-pulse.sh`, `.claude/hooks/yeet-inbox.sh`, `.claude/hooks/packet-projections.sh`. Do not rely on `.claude/settings.json` import for the Cursor volume lane (Cloud + missing `Notification`/`PermissionRequest`). Wire `sessionStart`, `preToolUse`, `postToolUse` (Write matcher), `postToolUseFailure`, `afterFileEdit`, `afterAgentResponse`, `sessionEnd`. Skip `stop` / `beforeSubmitPrompt` for `-p`.

3. **Do not copy skills into `.cursor/skills/`.** Cursor already loads `.claude/skills/` and `.agents/skills/` (symlink pair). If duplicate listings show up in Customize, that is GAP #9 — then drop one discovery root via a Cursor-only ignore, not a third copy. Symlink `.grok/skills/graft` into `.claude/skills/graft` if that skill should be on the Cursor lane.

4. **Do not port Codex `.toml` agents.** Cursor already loads `.claude/agents/*.md`. Add Cursor-only overrides under `.cursor/agents/` **only** when you need `readonly: true` or a `model:` pin (e.g. explore on a cheap model). Treat Claude `tools:` as ignored until proven; set `readonly: true` on architecture-guardian / modularization-analyst / jsdoc-annotation-specialist if those must stay read-only.

5. **Add `.cursor/mcp.json`** generated from `.mcp.json` with `${env:NAME}` (and `${workspaceFolder}` if needed). Do not commit secrets. Headless: `--approve-mcps`. Constrain with `.cursor/cli.json` `permissions.allow` (`Mcp(server:tool)`, `Shell(ls)`, …) and/or `.cursor/permissions.json` `mcpAllowlist`.

6. **Headless flags (official):** `cursor-agent -p --trust --force --sandbox enabled --approve-mcps --model <id> --output-format stream-json`. `--force`/`--yolo` is required or writes are not applied (`https://cursor.com/docs/cli/headless`). `--plugin-dir` only if you ship a Cursor Plugin.

7. **Cloud Agents:** keep `.cursor/environment.json` + `install.sh`. Commit project skills and `.cursor/hooks.json`. Expect **no** `sessionStart`/`sessionEnd`/user MCP on hosted VMs; put bootstrap that those hooks would have done into `install.sh` if Cloud must match. Team MCP belongs in the dashboard, not `~/.cursor/mcp.json`. Cloud **does** read committed `.cursor/rules/*.mdc` and (INFERENCE, clone-based) `AGENTS.md`.

8. **Plugins:** skip a repo marketplace unless you want to publish internally. If you package, use Cursor Plugin format (`.cursor-plugin/plugin.json`) from `github.com/cursor/plugin-template` `starter-advanced` so hooks+skills+agents+MCP travel together. Claude `enabledPlugins` will not load as Cursor plugins.

9. **Commands:** do not create `.cursor/commands/`. Keep workflows as Agent Skills (`disable-model-invocation: true` if they must stay slash-only). `/migrate-to-skills` is IDE-side, not required in CI.

10. **Telemetry:** keep hook-pulse → `ai-metrics` → local Grafana as the OSS path. Do not wait on Enterprise OTel (`cursor.hook.execution_complete` is useful later if the org enables a public collector). `cursor-agent about --format json` is the CLI account/version dump, not a metrics export.

11. **Privacy / model pick:** Privacy Mode on (team default). Do not send Fable 5/5.1 on the Cursor volume lane unless the dashboard restricted-model opt-in is accepted — those SKUs are documented ZDR exceptions. Astra-class Cursor catalog models are a separate L3 concern; this lane only notes the config implication.

12. **Enable "Include third-party Plugins, Skills, and other configs"** on developer workstations so Claude skills/agents/hooks still appear in the IDE — but treat it as a convenience, not the Cloud/headless contract (that contract is the native `.cursor/` files in recs 2–7).

13. **Project CLI allowlist:** add `.cursor/cli.json` with the same spirit as `.claude/settings.json` permissions (`Shell(ls)`, `Read(...)`, deny `.env*` / `Write(**/.env*)`). `approvalMode` stays in user `cli-config.json` (`allowlist` today per the brief).

14. **Ignore files:** if secrets or generated corpora must stay out of Cursor context, add `.cursorignore` **in addition to** `.gitignore`. Do not assume `.cursorignore` blocks `Shell` or MCP (official caveat).

15. **Verify once locally (out of this lane):** (a) whether `CLAUDE.md` symlink double-injects, (b) whether `.claude/skills` + `.agents/skills` symlink double-lists, (c) whether `tools:` on `.claude/agents/*.md` is honored, (d) whether `.mcp.json` is ever picked up despite the docs. Those four are the only experiments that would change recs 1, 3, 4, 5.
