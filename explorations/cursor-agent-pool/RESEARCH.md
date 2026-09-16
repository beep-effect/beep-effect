# Research

## 2026-09-16 — In-repo capability inventory

Facts verified on the workstation and in this checkout; paths are repo-relative unless noted.

### What already exists

- **Cursor lane admitted.** `goals/tsgo-045-effect-idiom-sweep/DECISIONS.md` D13 (2026-09-12) admits
  `cursor-agent` as a headless Bash lane, second volume pool beside Codex. Recipe:
  `goals/tsgo-045-effect-idiom-sweep/ops/prompts/50-cursor-lane.md`
  (`cursor-agent -p --trust --force --sandbox enabled --model <id> --output-format stream-json
  "<prompt>" </dev/null`, no-git rule verified from transcript `"command":` values). Smoke test passed
  in 25.9 s: `goals/tsgo-045-effect-idiom-sweep/history/2026-09-12-cursor-smoke.md`.
- **CLI state.** `cursor-agent` 2026.09.10-fd3934a at `~/.local/bin` (alias `agent`), logged in.
  `~/.cursor/cli-config.json`: `approvalMode: allowlist`, `permissions.allow: ["Shell(ls)"]`,
  `sandbox.mode: disabled` globally (lanes override with `--sandbox enabled`), default model
  `gpt-5.6-sol` at context 272k / reasoning xhigh, `exploreSubagentModel: default`. `~/.cursor/mcp.json`
  holds `sourcegraph` and `open-knowledge`. `~/.cursor/agents/` is empty. `~/.cursor/skills-cursor/`
  ships built-in skills (`create-hook`, `create-rule`, `create-skill`, `create-subagent`, `sdk`,
  `loop`, `autopilot`, ...). One self-hosted worker id is registered for `~/YeeBois/projects/beep-effect5`.
- **Cursor catalog** (`cursor-agent --list-models`, 227 lines): `claude-fable-5-1-{low..max}` and
  `-thinking-*` (all "NO ZDR"), `claude-fable-5-*`, `claude-opus-5-*`, `claude-sonnet-5-*`,
  `gpt-5.6-sol-{high,xhigh}(-fast)` "1M", `gpt-5.6-luna-high`, `gpt-5.3-codex-*`, `gpt-5.2`,
  `composer-2.5(-fast)`, `cursor-grok-4.6-{low,medium,high,xhigh}(-fast)`, `cursor-grok-4.5-*`,
  `kimi-k3-{low,high,max}`, `kimi-k2.7-code`, `glm-5.2-{high,max}`, `gemini-3.7-flash-high`, `auto`.
  **NOT FOUND:** `gpt-6-astra`.
- **Repo Cursor surface.** `.cursor/environment.json` + `.cursor/install.sh` (Cloud Agent bootstrap).
  **NOT FOUND:** `.cursor/rules`, `.cursor/hooks.json`, `.cursor/agents`, `.cursor/mcp.json`.
- **Parity targets.** `.claude/settings.json` hooks on SessionStart, UserPromptSubmit, PreToolUse,
  PermissionRequest, PermissionDenied, PostToolUse, PostToolUseFailure, Notification, Stop,
  SessionEnd (`hook-pulse.sh`, `law-pulse.sh`, `yeet-inbox.sh`, `graft-hooks.cjs`). `.codex/hooks.json`
  mirrors them for Codex; `.codex/agents/*.toml` holds seven subagents (architecture-guardian,
  code-patterns-strategist, crispener, effect-first-developer, jsdoc-annotation-specialist,
  modularization-analyst, schema-first-developer). `.grok/skills`, `.agents/skills`.
  `packages/tooling/tool/cli/src/commands/AIMetrics/` is the OpenTelemetry forwarder.
- **Codex meter.** `codex app-server generate-json-schema` emits `account/rateLimits/read`,
  `account/rateLimits/updated`, `account/rateLimitResetCredit/consume`, `rateLimitExceeded`.
  A machine-readable Codex meter exists (D3).
- **Proxy.** CLIProxyAPI at 127.0.0.1:8317 lists `grok-4.6`, `gpt-6-astra`, `gpt-5.6-luna`,
  `claude-fable-5-1`; no Cursor provider (D6).
- **Doctrine surfaces to amend.** `AGENTS.md` "Token-heavy Codex work" (the only pool-selection
  rule today); `standards/architecture/DECISIONS.md` line ~1787 already names the proxy lane as the
  checkout-fact verifier. **NOT FOUND:** any runbook for pool selection under `docs/runbooks/`.

### External research (in flight)

Four grok-4.6 lanes (CLIProxyAPI, env-scrubbed `claude -p` harness, xhigh, 60 turns) launched
2026-09-16 02:28 from the session scratchpad; reports land here as
`research/2026-09-16-L1-cli-surface.md`, `-L2-config-parity.md`, `-L3-quota-models.md`,
`-L4-field-reports.md`, each with a `.sources.jsonl` sidecar merged into `research/SOURCES.md`.

### 2026-09-16 — Codex meter, proven live

`codex app-server` over stdio answers `account/rateLimits/read` after `initialize` +
`initialized` (stdin must stay open; the reply took under 40 s). Verified shape on this workstation:

- `result.ordinaryUsageAllowed` (boolean; null means unavailable, do not infer from percentages),
- `result.rateLimits.primary.{usedPercent, resetsAt, windowDurationMins}` and `.secondary`,
- `result.rateLimitsByLimitId` keyed `codex` and `codex_bengalfox` (two quota aliases),
- `result.rateLimits.planType`, `rateLimitReachedType`, `rateLimitResetCredits`.

Reading at 02:40 CDT: primary window `usedPercent: 100`, `windowDurationMins: 10080` (weekly),
`resetsAt` = 2026-09-19 09:22Z. That is the CLI-login account only (D8 wants the union over the proxy
accounts too; CLIProxyAPI's quota surface is still NOT FOUND). Probe recipe:

```sh
( printf '%s\n' '{"id":1,"method":"initialize","params":{"clientInfo":{"name":"beep-probe","version":"0.0.1"}}}'
  sleep 1; printf '%s\n' '{"method":"initialized"}'
  sleep 1; printf '%s\n' '{"id":2,"method":"account/rateLimits/read","params":null}'
  sleep 40 ) | timeout 50 codex app-server 2>/dev/null \
  | jq -c 'select(.id==2) | .result | {ordinaryUsageAllowed, used: .rateLimits.primary.usedPercent, resetsAt: .rateLimits.primary.resetsAt}'
```

### 2026-09-16 — Cursor hooks fire in headless mode (smoke test)

Project hooks (`.cursor/hooks.json`, schema `version: 1`, per Cursor's built-in `create-hook` skill at
`~/.cursor/skills-cursor/create-hook/SKILL.md`) registered a logging probe on 16 events, then a
headless run (`cursor-agent -p --trust --force --sandbox enabled --model cursor-grok-4.6-low
--output-format stream-json`, 65 s wall, exit 0) ran one shell command and wrote one file.

Fired: afterFileEdit×1, afterShellExecution×1, beforeShellExecution×1, postToolUse×2, postToolUseFailure×1, preToolUse×3, sessionEnd×1, sessionStart×1.
Did NOT fire under `-p`: `beforeSubmitPrompt`, `stop`, `afterAgentResponse`, `preCompact`,
`beforeReadFile`, `beforeMCPExecution`, `subagentStart`, `subagentStop` (no subagent or MCP was
used, so the last four are untested rather than absent; the first four are headless GAPs to confirm
against L2).

Hook stdin (JSON): `hook_event_name`, `conversation_id`, `generation_id`, `session_id`,
`cursor_version`, `model`, `workspace_roots`, `transcript_path`, `user_email`,
`is_background_agent` (sessionStart); tool events add `cwd`, `tool_name` (`Shell`, `Read`, `Write`),
`tool_input`, `tool_use_id`. Hooks run host-side (the probe wrote outside the sandboxed workspace) and
reply `{"permission":"allow"}`; exit 2 blocks; `failClosed` opts into fail-closed.

Mapping to the repo's Claude/Codex hook events: SessionStart→`sessionStart`, PreToolUse→`preToolUse`,
PostToolUse→`postToolUse`, PostToolUseFailure→`postToolUseFailure`, SessionEnd→`sessionEnd`,
Stop→`sessionEnd` (stand-in; `stop` did not fire headless), UserPromptSubmit→`beforeSubmitPrompt`
(GAP headless), Notification→GAP, PermissionRequest/PermissionDenied→`beforeShellExecution` /
`preToolUse` permission replies (different semantics: the hook *is* the permission decision).
Artifacts: `ops/hooks-smoke/hooks.json`, `ops/hooks-smoke/beep-probe.sh`,
`ops/hooks-smoke/events-summary.ndjson` (event, tool, stdin keys; ids and email redacted).

Also local: Cursor subagents are `.cursor/agents/<name>.md` with YAML `name`/`description` frontmatter
and the body as system prompt (project beats `~/.cursor/agents`); skills are `.cursor/skills/<name>/SKILL.md`
(Agent Skills layout, `disable-model-invocation` supported); the Cursor SDK (`@cursor/sdk`, public beta)
runs agents programmatically with local or cloud runtime and `CURSOR_API_KEY` (billing bucket: L3).

### 2026-09-16 — What a Cursor pulse adapter must change

`.claude/hooks/hook-pulse.sh` and `.codex/hooks/hook-pulse.sh` are one script; the diff is the
`--arg agentKind` literal (`claude-code` / `codex-cli`) and a Codex notification-URI guard. It reads
`hook_event_name`, `session_id`, `cwd`, `transcript_path`, `tool_name` from stdin, which are exactly the
snake_case keys Cursor delivers (smoke test above). Two closed literal domains in
`packages/tooling/library/ai-metrics/src/hook-pulse.ts` block a drop-in copy: `HookPulseAgentKind`
(`["claude-code", "codex-cli"]`) and `HookPulseEvent` (Claude's PascalCase names, `PreToolUse` ...).
Cursor emits camelCase (`preToolUse`). A `.cursor/hooks/hook-pulse.sh` therefore needs (a) an
event-name map camelCase→PascalCase before the shared jq body, (b) `agentKind cursor-cli`, and
(c) the `HookPulseAgentKind` LiteralKit extended with `"cursor-cli"` plus the conformance test
`packages/tooling/library/ai-metrics/test/hook-pulse-writer.test.ts`. `law-pulse.sh`
(PostToolUse on Edit|Write) maps to `afterFileEdit`; `yeet-inbox.sh`'s P0 denial maps to a
`preToolUse` hook returning `{"permission":"deny"}` (Cursor's hook *is* the permission decision).

## 2026-09-16 — External landscape (synthesis of lanes L1b, L2b, L3b, L4)

Reports: `research/2026-09-16-L1b-cli-surface.md` (72 KB), `-L2b-config-parity.md` (55 KB),
`-L3b-quota-models.md` (52 KB), `-L4-field-reports.md` (58 KB); orchestrator briefs distilled by a
sandboxed `composer-2.5` lane: `research/2026-09-16-L{1,2,3,4}-brief.md`. Evidence tags below are the
lanes' (CONFIRMED = official cursor.com/docs or 2+ sources).

### Quota mechanics (L3, L4)
- Metering is API-list-price dollars from tokens. Two buckets: **Cursor Models** (`composer-2.5`,
  `cursor-grok-4.6-*`, `cursor-grok-4.5-*`, incl. `-fast`) and **Other Models** (every third-party seat)
  — CONFIRMED. Ultra's Other Models allowance is about **$400/month** of list price; the Cursor Models
  grant is unpublished and doubled ("2x") for first-party seats — SINGLE-SOURCE (staff forum posts).
- Spill order: Cursor Models drains first, then **spills into Other Models**; Other never drains Cursor
  Models — SINGLE-SOURCE (staff). Consequence: stop Cursor-bucket lanes before that bar hits 100% or the
  review pool disappears too.
- At 100% with on-demand disabled: hard stop, error text `Total usage limit reached`, no quality
  downgrade — CONFIRMED. Resets monthly with the billing cycle (Oct 11 here). Grok Bot is a third,
  weekly meter that does not touch the CLI pools.
- Fast variants are a latency SKU at 2–6x price (`composer-2.5-fast` = 6x input) and Composer Fast is
  the product default: **always pin the non-fast id** — CONFIRMED.
- Per-1M list prices (in/out): Composer 2.5 $0.50/$2.50; Cursor Grok 4.6 $2/$6; Luna $0.20/$1.20;
  GLM 5.2 $1.40/$4.40; Kimi K3 $3/$15; Sol $4/$20; Opus 5 $5/$25; Fable 5.1 $10/$50 — CONFIRMED.

### Programmatic usage (L3, L4)
- No official per-account usage API. Team Admin API endpoints (`/teams/spend`, `/teams/daily-usage-data`)
  are team-scoped; `cursor-agent about/status` carries no usage; stream-json has no usage or
  rate-limit events — CONFIRMED. Community meters (cursor-pulse, openusage) call private
  `api2.cursor.sh` ConnectRPC endpoints or reuse dashboard cookies; Cursor staff (2026-08-10) classed
  that with unofficial proxies, "up to and including an account ban" — CONFIRMED. Hence D17.
- Codex: `codex app-server` → `account/rateLimits/read` is the published meter (also used by
  community quota scripts) — CONFIRMED, and proven live above.

### Model quality (L3, L4)
- Astra is absent. Artificial Analysis: Astra Index 53 / Terminal-Bench v4 59%; Fable 5.1 Index 53 /
  TB 52%; Sol xhigh Index ~47 / TB 40%; Cursor Grok 4.6 xhigh matches Sol on the Index; Opus 5 CA 60;
  Composer 2.5 is a harness-trained implementer (CursorBench 27.7% at $0.68/task, TB 2.0 69%) — CONFIRMED
  by the cited pages. Field reports: Composer retains objectives on long work but drifts scope and
  misses files; Grok 4.6 is slow and over-engineers; **Kimi K3 on Cursor loops and burned ~$20 in 5 min**
  — CONFIRMED (forum, 2+ threads). Hence D16.
- L3's seat map: Tier 1 volume `composer-2.5` → escalate `cursor-grok-4.6-xhigh`; Tier 2 review
  `claude-opus-5-*` (ZDR, CA 60) or `gpt-5.6-sol-xhigh`; Tier 3 lightweight `composer-2.5` /
  `gpt-5.6-luna-high`; never `-fast`, `auto`, Kimi, or Fable on Cursor for volume.

### ZDR / privacy (L3)
- Most Cursor seats are ZDR. Fable 5 / 5.1 are NO ZDR: Anthropic retains I/O ~30 days for harm
  prevention regardless of Privacy Mode; guardrail hits auto-route to Opus — CONFIRMED. Privacy Mode
  stops training use but does not keep inference local. `cli-config.json` shows `privacyMode: 4`
  (meaning to confirm in the runbook).

### CLI surface (L1, L4)
- D13's flag set is validated by docs and four independent integrations — CONFIRMED. `--force` is
  required with `--sandbox enabled` or non-sandboxable commands are **silently denied**; without
  `--force` print mode only proposes changes — CONFIRMED.
- Recipe v2 deltas: wrap in host `timeout` (no CLI wall clock; watch scripts and stuck subagents hang
  `-p`), pass `--workspace <abs>`, pin `--model composer-2.5`, fail when exit != 0 **or** no
  `type=="result" && subtype=="success"` line, keep `</dev/null`. Do not add `--stream-partial-output`
  (double-counted text), `--worktree` (25-per-machine GC under `~/.cursor/worktrees`), `--approve-mcps`
  (slow stdio servers hang), `--mode plan` in CI (5–6 min, exit 0, no output).
- Sandbox: `workspace_readwrite` default, network `deny` by default (allowlist domains in
  `.cursor/sandbox.json`; private ranges always blocked), protected paths include `.cursor/*.json`,
  `.claude/*.json`, `.git/hooks/**`, `.git/config`; **the git binary is not blocked** — CONFIRMED.
  Permissions: project `.cursor/cli.json` `permissions.deny: ["Shell(git)", "Shell(sudo)", "Shell(pkexec)"]`
  — deny wins over `--force`, making the no-git rule structural — CONFIRMED.
- stream-json: `system/init` (session_id, model, permissionMode, cwd), `assistant`, `tool_call`
  started/completed (`writeToolCall.args.path/fileText`, generic `function.name/arguments`),
  `result/success` (`duration_ms`, `result`). jq cookbook in the L1 brief.
- SDK (`@cursor/sdk`, `cursor-sdk`), `cursor-agent worker`, and the Cloud Agents API all bill the same
  two pools; Cloud Agents API had a run of stuck/failed runs Aug–Sep 2026. Volume lane stays local `-p`.

### Config parity (L2, L4)
- Instructions: `AGENTS.md` and `CLAUDE.md` read natively; `.cursor/rules/*.mdc` optional; order between
  AGENTS.md and `.mdc` undocumented; the CLAUDE.md→AGENTS.md symlink may double-inject — CONFIRMED/GAP.
- Hooks: `.cursor/hooks.json` v1, camelCase events, exit 2 = deny, `failClosed`; Cursor can also load
  `.claude/settings.json` hooks when the account-flagged "Include third-party Plugins, Skills, and other
  configs" setting is on, mapping PreToolUse/PostToolUse/UserPromptSubmit/Stop/SubagentStop/SessionStart/
  SessionEnd/PreCompact but **not** Notification, PermissionRequest, PermissionDenied, or
  PostToolUseFailure — CONFIRMED. Cloud Agents load only repo command hooks and drop sessionStart/End.
  A forum thread (staff, "known gap") said only sessionStart fires headless on an older build; the local
  smoke on 2026.09.10 proved eight events fire, so the runbook cites the smoke, not the thread.
- Skills: `.claude/skills`, `.codex/skills`, `.agents/skills`, `.cursor/skills` all auto-discovered
  (`.grok/skills` is not) — CONFIRMED. No copying needed.
- Subagents: `.cursor/agents/*.md`, `.claude/agents/*.md`, `.codex/agents/*.md` discovered
  (`.codex/agents/*.toml` is not); frontmatter `name`, `description`, `model` (pinnable), `readonly`,
  `is_background`; no `tools:` — CONFIRMED. The repo's `.claude/agents/*.md` are therefore already
  visible to Cursor.
- MCP: `.cursor/mcp.json` ∪ `~/.cursor/mcp.json`, `${env:VAR}` / `${workspaceFolder}` interpolation;
  Claude's root `.mcp.json` is not imported — CONFIRMED.
- Plugins: Cursor Plugin (`.cursor-plugin/plugin.json`) or Agent Plugin (`plugin.json`); Claude's
  `.claude-plugin/` layout is not compatible — CONFIRMED.
- Telemetry: OTel export is Enterprise-only, cloud-side OTLP/HTTP, no local endpoint — CONFIRMED. The
  hook scripts remain the metrics path (D9/D14).
- Terms: no public OpenAI-compatible endpoint; CLIProxyAPI issue #573 closed without a Cursor provider;
  staff verdict on unofficial proxies as above — CONFIRMED. Hence D6 stands.
