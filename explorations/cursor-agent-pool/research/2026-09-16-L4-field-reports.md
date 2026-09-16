# L4 — Field reports and multi-CLI orchestration patterns (X-heavy)

**Lane:** L4 of four parallel Cursor-research lanes for beep-effect  
**Date:** 2026-09-16  
**Scope:** Headless `cursor-agent`/`agent -p` in CI and orchestrators; quota fallback routing; quality/token-burn reports on Composer 2.5, Cursor Grok 4.6, Kimi K3, GLM 5.2 vs Sol/Fable/Astra; hooks/skills/plugins; Cloud Agents + My Machines; OpenAI-compatible adapters and ToS.

**Method:** Official `cursor.com/docs` first, then forum.cursor.com, GitHub orchestrators, blogs, and X (Jul–Sep 2026). Claims are tagged **CONFIRMED (≥2 independent sources)** or **SINGLE-SOURCE**. Inferences are marked **INFERENCE**. Every factual claim cites a URL fetched on 2026-09-16. Generic X queries for `"agent -p"` are unusable (collides with "Agent P" accounts); software-specific queries and GitHub/forum carried this lane.

**Headline for beep-effect:** Keep D13's Bash lane (`cursor-agent -p --trust --force --sandbox enabled --output-format stream-json`). Do **not** expose Cursor as an OpenAI-compatible provider (staff ToS ban, Aug 2026). When Codex weekly remaining ≤5%, overflow onto **Composer 2.5 / cursor-grok-4.6** (Cursor Models pool), **not** Fable/Opus/Sol/Kimi K3 on Cursor (Other Models). Ultra is a large allowance, not unlimited; Opus/Fable eat Other Models in days. Kimi-is-good does **not** transfer to Cursor-served Kimi K3 (loops, $20/5 min, text-only vision).

---

## 1. Headless `cursor-agent -p` / `agent -p` in CI, cron, orchestrators

### Official flag set (fetched 2026-09-16)

Docs live at `https://cursor.com/docs/...` (`docs.cursor.com/en/...` 308-redirects to `https://cursor.com/docs`). Documented binary is `agent`; installed alias is `cursor-agent`.

**Headless** (`https://cursor.com/docs/cli/headless`):

- `-p` / `--print` is the non-interactive path.
- Default output is **text** (final answer only).
- File changes are **not applied** unless `--force` or `--yolo`.
- Scripts authenticate with `CURSOR_API_KEY` or `--api-key`.
- Formats: `text` | `json` | `stream-json`. `--stream-partial-output` adds incremental text deltas (only with `--print` + `stream-json`).

Quoted official examples:

```bash
export CURSOR_API_KEY=your_api_key_here
agent -p "Analyze this code"
agent -p --force "Refactor this code to use modern ES6+ syntax"
agent -p --force --output-format stream-json --stream-partial-output \
  "Analyze this project structure and create a summary report in analysis.txt"
find src/ -name "*.js" | while read file; do
  agent -p --force "Add comprehensive JSDoc comments to $file"
done
```

**Parameters** (`https://cursor.com/docs/cli/reference/parameters`):

| Flag | Meaning |
|---|---|
| `-p, --print` | Non-interactive; write + shell tools available |
| `--output-format text\|json\|stream-json` | Default **text** |
| `--stream-partial-output` | Partial deltas; print + stream-json only |
| `--api-key` / `CURSOR_API_KEY` | Auth |
| `--resume [chatId]` / `--continue` (`--resume=-1`) | Resume |
| `--model` / `--list-models` | Model pick |
| `--mode plan\|ask` / `--plan` | Default agent |
| `-f, --force` / `--yolo` | Permit commands unless explicitly denied |
| `--sandbox enabled\|disabled` | Sandbox |
| `--approve-mcps` | Auto-approve MCP servers |
| `--trust` | Trust workspace in headless, no prompt |
| `--workspace <path>` | Workspace dir |
| `--plugin-dir <path>` | Repeatable local plugin dirs |
| `-w, --worktree [name]` / `--worktree-base` / `--skip-worktree-setup` | Isolated git worktree |

Subcommands: `login`, `status`/`whoami`, `about`, `models`, `mcp`, `sandbox`, **`worker`**, `acp`, `ls`, `resume`, `create-chat`. `--add-dir` and `--auto-review` appear in Benjamin's `cursor-agent --help` (2026.09.10-fd3934a) but **not** on the parameters page — treat as version-skew.

**Using CLI** (`https://cursor.com/docs/cli/using`): MCP from `mcp.json`; rules from `.cursor/rules` plus root `AGENTS.md` and `CLAUDE.md`; Cloud Agent handoff via `&` prefix; worktrees via `--workspace` + `--worktree`.

### stream-json schema (official)

`https://cursor.com/docs/cli/reference/output-format` — NDJSON, one object per line:

- `system`/`init`: `apiKeySource` (`env`|`flag`|`login`), `cwd`, `session_id`, `model`, `permissionMode`
- `user` / `assistant`: `message.role`, `message.content[]`, `session_id`
- `tool_call` `started`|`completed`: `call_id`, typed `readToolCall`/`writeToolCall` or generic `function`
- terminal `result`/`success`: `duration_ms`, `duration_api_ms`, `is_error:false`, `result`, `session_id`, optional `request_id`

**No documented usage, rate-limit, or structured error events.** JSON-mode failures: nonzero exit, stderr, no valid JSON object. `session_id` is the resume handle.

Gotcha from the field: consolidated assistant messages **duplicate text** when `--stream-partial-output` is on (delta + pre-tool flush + final flush). Official docs say ignore flushes that have `model_call_id` or that lack `timestamp_ms`.

### Official GitHub Actions recipe

`https://cursor.com/docs/cli/github-actions`:

```yaml
env:
  CURSOR_API_KEY: ${{ secrets.CURSOR_API_KEY }}
# install
curl https://cursor.com/install -fsS | bash
# run
agent -p "Your prompt here" --model gpt-5
```

Docs recommend **restricted autonomy** in production: agent edits permitted files; CI does git/PR. Permissions allow/deny by path or command. Related: `https://cursor.com/docs/cli/reference/permissions.md`, `https://cursor.com/docs/cli/reference/authentication.md`. This page does **not** mention `--force`, `--trust`, sandbox, or rate limits.

### Exact flag sets in the wild

**CONFIRMED (≥2 independent GitHub + official docs):** headless volume lanes look like some subset of:

```bash
cursor-agent -p --trust --force --sandbox enabled \
  --output-format stream-json [--stream-partial-output] \
  [--workspace <path>] [--model <id>] [--resume <chatId>] \
  "<prompt>" </dev/null
```

| Source | Exact flags | Notes |
|---|---|---|
| Official headless | `agent -p --force --output-format stream-json --stream-partial-output` | No `--trust` on that page; `--trust` is on parameters |
| Official GHA | `agent -p --model gpt-5` | Relies on `CURSOR_API_KEY` |
| Forum CI workaround (2026-07-08) | `agent --print --plan --trust --output-format text --api-key "$KEY"` | Silent 5–6 min exit 0, no output; **avoid `--plan` in CI** |
| Forum hang repro (2026-07-05) | `cursor-agent -p --force --output-format text "Reply with just OK"` | Zero bytes, hang, macOS Intel `2026.07.01-41b2de7` |
| Forum sandbox headless (Colin, 2026-04-13) | `agent --print --trust --sandbox enabled "your prompt"` | Auto-runs sandboxable cmds; **silently denies** others without `--force` |
| `SinanTufekci/agent-intern` `cursor_bridge.py` | `-p --output-format <text\|stream-json> --trust --workspace W --resume ID` + optional `--mode ask` / `--force` / `--force --sandbox disabled` / `--model` | `create-chat` first; stdin disabled; scan `~/.cursor/chats/*/meta.json` after restart; timeout kills process tree |
| `moosl/cursor-auto-pilot` | `agent -p --output-format=stream-json` | Optional `sessionId`; stop at `maxTurns` |
| `StrawCoding/hermes-cursor-agent` | `cursor-agent -p --output-format stream-json --stream-partial-output` | OpenAI-style chunks for Hermes; **retry once with `auto`** if model exhausted |
| `taberoajorge/ralph` | `agent -p --force` + `--model` `--output-format stream-json` `--workspace` `--sandbox disabled` `--approve-mcps` | Ralph loop |
| `LarsCowe/bmalph` | `cursor-agent -p --force --output-format json` + `--resume <session_id>` | Persist session IDs across iterations |
| `raiyanyahya/loop` | `cursor-agent -p <prompt> --force` | `loop init ralph` |
| `danielsinewe/ralph-cursor` | `CLAUDE_CMD="agent --print --force"` | 20 min default timeout; circuit breaker after repeated failures |
| `lockstride/ralph-wiggum-plugin` | `--cli cursor-agent --force`; parse stream-json tokens; default model `composer-2` | Rate-limit → `DEFER` backoff; rotate context at 150k tokens |
| AWS CAO `docs/cursor-cli.md` | `cursor-agent --force [--model] [--plugin-dir --approve-mcps]` | **Deliberately omits `-p` and `--trust`** (interactive tmux REPL) |
| `yinguangyao/coding-agent-runner` | `cursor-agent acp` | ACP JSON-RPC, **not** `-p` |
| Conductor.build | `CURSOR_API_KEY`; model picker Composer 2.5 | Flags not published |
| Vibe Kanban (`BloopAI/vibe-kanban`) | Cursor listed among 10+ agents | **Sunsetting**; no flags in README |

**INFERENCE:** beep-effect D13 (`cursor-agent -p --trust --force --sandbox enabled --model <id> --output-format stream-json "<prompt>" </dev/null`) is the right Bash-lane shape. Closest public analogue is agent-intern (adds `create-chat`/`--resume` and a `--sandbox disabled` full-access variant). Do **not** copy CAO's no-`--print` recipe into the volume lane.

### Two integration dialects (not one)

**CONFIRMED:**

1. **One-shot NDJSON:** `cursor-agent -p --output-format stream-json` — CI, Ralph, Hermes shim, agent-intern.
2. **Persistent session:** either (a) interactive TUI in tmux (CAO; `--trust` "rejected" on current interactive builds) or (b) **ACP** `agent acp` over stdio JSON-RPC (`https://cursor.com/docs/cli/acp`; coding-agent-runner, Zed, avante.nvim). ACP flow: `initialize` → `authenticate` `cursor_login` → `session/new` → `session/prompt` → `session/update` stream; unanswered `session/request_permission` blocks.

X: [@nearygy](https://x.com/nearygy/status/2077603830645293062) 2026-07-16 — desktop SDK routes **codex → app-server; claude → native stream-json; cursor/pi/opencode → ACP**. [@codedibia](https://x.com/codedibia/status/2072358774757556499) 2026-07-01 — plugin wrapping `cursor-agent -p --output-format stream-json --stream-partial-output`; parses assistant deltas, `tool_call` `diffString`, `result`+`session_id`; warns consolidated messages duplicate text. [@GitTrend0x](https://x.com/GitTrend0x/status/2088436058602238084) 2026-08-15 — `StrawCoding/hermes-cursor-agent` (stream-json + OpenAI shim) and `fernandoabolafio/cursor-hermes-plugin` (Cloud Agents CRUD). [@grok](https://x.com/grok/status/2086484877860339853) 2026-08-09 — "Session resume via claude-stream-json dialect correctly preserves native session_id for Cursor and Grok backends."

### Failure modes (headless)

**CONFIRMED (≥2 forum threads + staff, Jan–Jul 2026):** `-p` has a recurring hang / no-exit / silent-zero-output class.

| Date | Thread | Version | Symptom | Flags |
|---|---|---|---|---|
| 2026-01-29 | [150246](https://forum.cursor.com/t/cursor-agent-p-print-headless-mode-hangs-indefinitely-and-never-returns/150246) | Agent `2026.01.28-fd13201`, Cursor 2.4.22, macOS arm64 | `-p` never returns; interactive works; `lsof` no TCP (IPC hang to `worker-server`) | `cursor agent -p --output-format text "Say hello"`; also stream-json |
| 2026-01-29 | [150296](https://forum.cursor.com/t/cursor-agent-print-doesnt-exit-after-completing/150296) | Linux | Answer printed, process never exits | `cursor-agent --print text "what is 2+2" --model grok` |
| 2026-02-24 | 150246 TerryZ Ubuntu | `2026.02.13-41ac335` | `SYN-SENT` retries; 10–15s delay then success | `agent -p --trust "Say hello"` ~13s |
| 2026-03-25 | staff Colin on 150246 | — | **"fixed in the latest versions of the CLI"** | — |
| 2026-05-05 | 150296 | `2026.05.05-84a231c` | Now exits; trivial prompts still 36–55s | `agent -p 'what is 2+2?' --model composer-2-fast` |
| 2026-07-05 | [164841](https://forum.cursor.com/t/cursor-agent-p-hangs-with-zero-output-on-2026-07-01-41b2de7-macos-intel-all-output-formats-even-trivial-prompts/164841) | `2026.07.01-41b2de7` macOS 15.6 Intel | Zero bytes stdout/stderr; `--trust`, stream-json, `</dev/null` all fail | `cursor-agent -p --force --output-format text "Reply with just OK"` |
| 2026-07-08 | 150296 CI | — | `--print --plan --trust` runs 5–6 min, **exit 0, no output** | big prompt that asked the agent to `git diff` |

Staff workarounds (Dean Rie / Colin): `--debug --output-format stream-json`; disable HTTP/2; drop VPN; set `HTTPS_PROXY`/`HTTP_PROXY`; wrap with `timeout`; **precompute `git diff` and inline it** (successful ~86 KB prompt, ~54s):

```bash
DIFF="$(git diff origin/main...HEAD)"
agent -p --plan --trust "Review this diff:\n$DIFF"
```

**INFERENCE:** keep `</dev/null`, `stream-json`, a hard `timeout` (Ralph default 20 min is a reasonable ceiling for volume jobs), and do not ask the agent to `git diff` itself. Avoid `--plan` in the volume Bash lane.

Parser recipe (agent-intern, **SINGLE-SOURCE** but matches official schema): JSONL, skip blanks/malformed; prefer `result` text; fallback last `assistant` text; ignore `--stream-partial-output` duplicate flushes.

---

## 2. Quota-based fallback routing between CLIs

### Codex meter — the ">5% remaining" gate

**CONFIRMED (≥2 independent implementations + official schema):**

- JSON-RPC `account/rateLimits/read` on `codex app-server` returns primary 5-hour + secondary weekly `usedPercent` / `resetsAt`. Schema: `https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md`
- ianlpaterson 2026-03-19 (`https://ianlpaterson.com/blog/tracking-claude-codex-gemini-quotas-from-one-script/`): spawn `codex app-server` → JSON-RPC init → `account/rateLimits/read`. History from `~/.codex/state_5.sqlite` table `threads`. Claude: OAuth `~/.claude/.credentials.json` → `api.anthropic.com/api/oauth/usage`. Gemini: **no quota API**; approximate from `~/.gemini/tmp/_/chats/session-*.json`. Their spend-slack heuristic: Codex weekly **<60%**. **No Cursor collector.**
- Also: `haenara-shin/codex-hud`, `yutat23/usagebat`, VS Code `statiolake.remaining-tokens` (Claude+Codex+Cursor), `steipete/codexbar`.

No published **Codex ↔ Cursor ↔ Claude** automatic failover script was found that catches a limit error and re-invokes another CLI. Closest are status-bar meters + "spend slack when Codex < N%" heuristics.

### Cursor meter — two included pools + Grok Bot weekly

**CONFIRMED (official docs + staff forum + community dashboards):**

Official usage-limits (`https://cursor.com/help/models-and-usage/usage-limits`):

- **Cursor Models:** Cursor Grok 4.6, Cursor Grok 4.5, Composer 2.5.
- **Other Models:** third-party (Claude/Fable, GPT/Sol, Kimi K3, GLM 5.2, Gemini, …) at the model's API price.
- Unused does **not** roll over. Exhausted included → on-demand if enabled (Benjamin has on-demand **disabled**).
- Reset: monthly billing cycle (Ultra shown as Oct 11 on the dashboard).

Staff **deanrie** 2026-08-23 on [169032](https://forum.cursor.com/t/possible-bug-in-cursor-token-statistics-other-models-disabled-after-grok-quota-exhausted/169032): **"This isn't a bug. It's expected behavior."** Cursor models consume Cursor Models **first**, then **spill into Other Models**, which can **disable third-party models** once both are exhausted.

Grok Bot: **separate weekly included pool** (staff, 2026-08-28, [169796](https://forum.cursor.com/t/grok-bot-spend-cursor-usage-i-cant-accept-it/169796)). Dashboard may mis-attribute it under Cursor/Other Models (display bug). After weekly included is gone, excess hits shared on-demand. Ultra = "Highest weekly usage" (`https://cursor.com/help/grok-bot/plans`); no numeric allowance published.

**Ultra is not unlimited. SINGLE-SOURCE numbers, consistent direction:**

| Claim | Source | Tag |
|---|---|---|
| Ultra Other Models ≈ **$400** API-agent value | Community (Naufaldi_Rafif 2026-01-27 [150012](https://forum.cursor.com/t/running-out-of-ultra-plan-credits-before-renewal/150012); learncursor.dev 2026-08-14 `https://www.learncursor.dev/learn/cursor-for-teams/cursor-usage-limits`; legacy docs snippet) | **SINGLE-SOURCE each; same $400 figure independently repeated** |
| Official pricing pages say only "Included" for both pools | `https://cursor.com/docs/models-and-pricing`, `https://cursor.com/docs/account/pricing` | CONFIRMED docs are **deliberately non-numeric** |
| Ultra exhausted in **5–6 days** (two accounts) on Composer-era mix | wcshds 2026-05-19 [160935](https://forum.cursor.com/t/share-your-thoughts-on-composer-2-5/160935) | SINGLE-SOURCE |
| Skipping GPT-5.5/Claude extends to ~**2 weeks** | Artemonim 2026-05-19 same thread | SINGLE-SOURCE |
| Ultra exhausted in ~**20 days** | huynh_ductrung 2026-01-27 [150012](https://forum.cursor.com/t/running-out-of-ultra-plan-credits-before-renewal/150012) | SINGLE-SOURCE |
| Opus lasts ~**1 week** on Ultra | [128509](https://forum.cursor.com/t/if-ultra-had-one-free-unlimited-model-which-would-you-choose/128509) | SINGLE-SOURCE |
| Auto+Composer+Grok stays cheap vs Opus | forum + learncursor positioning | CONFIRMED direction |

Official model list prices (`https://cursor.com/docs/models`, fetched 2026-09-16):

| Model | Pool | In / cache read / out ($/M) |
|---|---|---|
| Composer 2.5 | Cursor Models | 0.50 / 0.20 / 2.50 |
| Composer 2.5 Fast | Cursor Models | 3.00 / 0.50 / 15.00 |
| Grok 4.6 | Cursor Models | 2 / 0.50 / 6 |
| GLM 5.2 | Other Models | 1.40 / 0.26 / 4.40 |
| Kimi K3 | Other Models | 3 / 0.30 / 15 |
| GPT-5.6 Sol | Other Models | 4 / 0.40 / 20 |
| Claude Fable 5 | Other Models | 10 / 1 / 50 |

**INFERENCE:** Fable-on-Cursor is ~20× Composer input price and sits on the scarce Other Models bucket. One heavy Fable/Opus day can starve Kimi/GLM/Sol for the rest of the cycle **and**, after Cursor-Models spillover, disable Other Models entirely.

### Unofficial Cursor usage APIs (ToS-grey)

Community scrapers (**SINGLE-SOURCE each**, same private surface):

- `cnwinds/cursor-pulse` `docs/cursor-usage-api.md`: `POST https://api2.cursor.sh/auth/exchange_user_api_key` with `crsr_...` key → `accessToken`; then ConnectRPC `DashboardService/GetCurrentPeriodUsage` (`planUsage.remaining` **cents**), `GetPlanInfo`, `GetFilteredUsageEvents`. Cookie path: `WorkosCursorSessionToken` on `cursor.com/api/usage-summary`.
- `robinebers/openusage`: session tokens from Cursor local DB/keychain; tracks Cursor-model vs other-model vs Grok Bot. "Just be signed into the Cursor app."
- Also: `mmayasaurus/heddle-dashboard`, `clearmeasurelabs/cursor-usage-status`.

**INFERENCE:** These hit the same **private client endpoints** staff banned for OpenAI shims (§6). Fine for a personal meter on DankStation; **do not** ship a scraper in public beep-effect. Official public API is Cloud Agents `https://api.cursor.com` (no usage-summary endpoint documented).

### Recommended beep-effect router (INFERENCE from the above)

```
if Codex weekly remaining > 5%:
    codex exec --model gpt-6-astra -c 'model_reasoning_effort="xhigh"' ...
elif Cursor Models pool available (dashboard / fail-open):
    cursor-agent -p --trust --force --sandbox enabled \
      --model composer-2.5 \
      --output-format stream-json "<prompt>" </dev/null
    # escalate long-horizon / self-test to cursor-grok-4.6-xhigh
    # never default to claude-fable-5-1-* or gpt-5.6-sol-* on Cursor
else:
    hold and notify until a pool resets
```
Superseded: this research draft fell back to Claude Fable; D7 replaced that with hold and notify.

Catch Cursor limit errors as process failure + stderr (no usage event in stream-json). Hermes-cursor-agent's "retry once with `auto`" is the only public in-process fallback found.

Codex probe recipe (from ianlpaterson):

```text
codex app-server  →  JSON-RPC initialize  →  account/rateLimits/read
weekly remaining% = 100 - usedPercent
```

---

## 3. Quality and token-burn (Composer 2.5, Cursor Grok 4.6, Kimi K3, GLM 5.2 vs Sol / Fable / Astra)

### Composer 2.5 — default volume model

**Announcement** Kevin Neilson 2026-05-18 [160934](https://forum.cursor.com/t/composer-2-5-is-now-live/160934) + changelog `https://cursor.com/changelog/composer-2-5`: built on Moonshot **Kimi K2.5** + Cursor continued pretraining (forum); "smartest, most capable coding model yet"; $0.50/$2.50; Fast $3/$15 (Fast is the product default per `https://cursor.com/docs/models/cursor-composer-2-5`); 2× included first week; became Cursor default.

CursorBench 4.0 marketing page (`https://cursor.com/composer`): Composer 2.5 **27.7%**, **$0.68/task**, 17,347 tokens, 41 steps — "competitive scores at a fraction of the cost." (Grok 4.6 is on the chart; numeric Grok score not in the extracted text.)

**Quality consensus CONFIRMED (≥3 independent forum/blog sources):** Composer is a **worker, not a planner**.

- nerdimite 2026-05-25 [161218](https://forum.cursor.com/t/can-anyone-tell-me-how-good-composer-2-5-is/161218): "worker bees, not thinkers." Claude Opus/Sonnet plan; Composer implements; GPT-5.5 for risky implementation.
- tangjun 2026-06-05 [162448](https://forum.cursor.com/t/praise-for-cursor-composer-2-5/162448): less intellectually capable, **better at retaining objectives** on extended work. GPT/Claude think; Composer "do-work."
- Staff deanrie 2026-06-11/24 same thread: agrees frontier models plan, Composer executes on lengthy tasks; "harness-optimized execution model that maintains direction."
- Tovren 2026-05-24/29 `https://tovren.com/cursor-composer-2-5-daily-coding-default/`: "worth testing as your daily default inside Cursor" / "Do not delete Claude Code, Codex, or Gemini."
- DeepakNess 2026-07-10 `https://deepakness.com/raw/composer-2-5-worker/`: Grok 4.5 (sometimes GPT-5.5 Terra) orchestrates; Composer 2.5 does heavy work. Claude Code analogue: Fable 5 plans, Sonnet 5 works.
- Naufaldi_Rafif 2026-05-20 [160935](https://forum.cursor.com/t/share-your-thoughts-on-composer-2-5/160935): ~80% of tickets/Figma-to-code; GPT-5.5 Medium fixes failed plans, Composer re-executes.

**Failure modes (SINGLE-SOURCE each, same direction):** scope drift / beginner N+1 (liquefy); misses files / half-refactors; conversational amnesia; Fast ~5 tok/s; pie-chart fail anecdote. Serp 2026-05-25 prefers it over Opus 4.7 for coding speed.

**INFERENCE vs GPT-6 Astra / Fable 5.1:** Composer is the right **overflow implementer** when Codex is dry. It is **not** an Astra/Fable substitute for architecture, Effect/schema design, or adversarial review. Match beep-effect's existing split: Astra/Fable plan+review, Composer (or Cursor Grok) execute.

### Cursor Grok 4.6 — long-horizon, expensive context

**Announcement** 2026-08-12 [168189](https://forum.cursor.com/t/grok-4-6-is-now-live/168189): long-running agents + Extra High; 2× usage first week. Cursor Models pool.

Forum [168190](https://forum.cursor.com/t/share-your-thoughts-on-grok-4-6/168190) (Aug 12–22):

- Congzhi: XHigh "quite good"; **context fills fast** (staff: longer traces + more tool calls).
- Someguy: "dumber than 4.5"; 8 chats to fix bugs it introduced.
- yaireo: extremely slow vs 4.5; even Fast mode minutes of thinking/tool spam.
- joeybab3: refused a grouping query ("do it yourself").
- **jkpe (Jack) 2026-08-22 post #91:** **"I don't see Grok 4.6 as a noticeable upgrade to Composer 2.5"**; prefers Composer's concise solutions; Grok over-engineers; impressive on greenfield SwiftUI + Cloudflare Worker.

Staff Kevin: designed for complex multistep + self-testing; XHigh increases reasoning/tool-use.

**INFERENCE:** use `cursor-grok-4.6-xhigh` only for long-horizon self-testing jobs where Composer loses the plot; default volume to `composer-2.5` (standard, not Fast — Fast is 6× input price and is the product default, so **pass `--model composer-2.5` explicitly** if a non-fast id exists; if the catalog's `composer-2.5` *is* Fast, prefer `composer-2.5` over `composer-2.5-fast`). Confirm id against `cursor-agent --list-models` on this machine.

### Kimi K3 — do not use as the Ultra overflow

User heard "Kimi is good." That is **Kimi-the-lab-model**, not **Kimi-served-inside-Cursor**.

**CONFIRMED (≥2 forum threads + staff):**

- Josh Barnett 2026-08-18 [168699](https://forum.cursor.com/t/kimi-k3-disoriented-and-expensive-in-cursor/168699): **~$20 on-demand in ~5 minutes**, looping 40-line reads. Staff 2026-08-25: repetitive loop evaded auto-protection; "Nothing here is intentional." Follow-ups Sep 6/7/11: 31.5M tokens, failed implementations.
- Second user same thread: Cursor-served Kimi "very quantized" vs native Kimi CLIs.
- [167295](https://forum.cursor.com/t/kimi-k3-completely-broken-multimodal-capabilities/167295): staff — Kimi K3/K3 Max in Cursor are **text-only**; images go through a captioner and hallucinate. Native Kimi platform handles images.

Pool: **Other Models** at $3/$15 — same band as Composer Fast, **without** the Cursor-Models included cushion. A loop burns the scarce bucket.

Third-party benches (SINGLE-SOURCE aggregators): Kimi K3 ahead of Composer 2.5 on some suites (`https://www.benchlm.ai/compare/composer-2-5-vs-kimi-k3`, `https://aireleasetracker.com/compare/moonshot/kimi-k3/xai/composer-2.5`). Those do **not** measure Cursor's serving path.

**INFERENCE:** keep Kimi K3 off the default overflow list. If Benjamin wants a Kimi-class worker, that is **Composer 2.5** (K2.5-based, harness-trained, Cursor Models pool).

### GLM 5.2 — cheaper Other Models option, BYOK landmines

[163533](https://forum.cursor.com/t/glm-5-2-support/163533):

- deanrie 2026-06-18: BYOK via OpenAI-compatible; no first-party timeline then (later it appears in `--list-models` as `glm-5.2-{high,max}` — **INFERENCE** first-party landed after June).
- deanrie 2026-06-20: **OpenRouter unsupported** (request-format/tool failures); "Cursor CLI custom-model support is not yet available" (as of June).
- azhang 2026-06-23: GLM 5.5 review scores **better than Composer 2.5** in their workflow (**SINGLE-SOURCE**).
- Custom models show **200K** context even when the model is 1M (deanrie 2026-06-18); related [163360](https://forum.cursor.com/t/custom-openai-compatible-model-shows-200k-context-limit-for-glm-5-2-even-though-it-supports-1m-context/163360).
- BYOK bug: Cursor rewrote `glm-5.2` → `glm-5.2-high` and 401'd user keys.

Official first-party price now: $1.40 / $4.40 on Other Models — cheapest named third-party on the fetched models table. Still Other Models, still not the overflow default.

### vs Sol xhigh / Fable 5.1 / GPT-6 Astra

No head-to-head long-run study of Cursor-served Fable 5.1 or Sol xhigh vs Astra was found. Price table + Ultra-burn anecdotes are the evidence:

- Fable 5 on Cursor: **$10 / $50** Other Models — worst included-pool fit.
- Sol 5.6: **$4 / $20** Other Models.
- Astra stays on the ChatGPT Pro OAuth pool (separate). That is why policy (1) is "if Codex >5% remaining, use Astra."

**INFERENCE:** "as close to Astra/Fable as possible" on Cursor **cannot** mean Fable-on-Cursor for volume. Closest *included* quality is Composer 2.5 (implementation) and Grok 4.6 XHigh (long-horizon). Closest *quality* regardless of pool is Fable/Opus on Other Models until that $~400 is gone — then the account is stuck if on-demand is off.

---

## 4. Hooks, skills, subagents, plugins, OTel, sandbox gotchas

### Skills — already compatible

**CONFIRMED (docs `https://cursor.com/docs/skills`):** Cursor loads:

- `.cursor/skills/`, `.agents/skills/` (project)
- `~/.cursor/skills/`, `~/.agents/skills/` (user)
- **also** `.claude/skills/`, `.codex/skills/`, `~/.claude/skills/`, `~/.codex/skills/`

`SKILL.md` YAML `name`+`description`; name must match folder. Cloud Agents auto-sync only `~/.cursor/skills/`; repo skills need a plugin package for GitHub install. Headless `-p` skill loading is **not explicitly documented**.

**INFERENCE:** beep-effect `.claude/skills` + `.agents/skills` should already be visible. Add `.cursor/skills` only for Cursor-specific wrappers. Do not expect Cloud Agents to see Claude-only user skills.

### Hooks — names differ; headless is a known gap

Official `https://cursor.com/docs/hooks` — project `.cursor/hooks.json` v1; user `~/.cursor/hooks.json`. Command hooks: JSON stdin → JSON stdout; exit 2 blocks.

Cursor camelCase vs Claude PascalCase: `sessionStart`/`sessionEnd`/`preToolUse`/`postToolUse`/`postToolUseFailure`/`subagentStart`/`subagentStop`/`preCompact`/`stop`. Cursor-only: `beforeShellExecution`, `afterShellExecution`, `beforeMCPExecution`, `afterMCPExecution`, `beforeReadFile`, `afterFileEdit`, `beforeSubmitPrompt`, `afterAgentResponse`, `afterAgentThought`, Tab hooks, `workspaceOpen`.

**No native OpenTelemetry.** Cloud Agents: command-based **project** hooks only; no prompt hooks; no user-level hooks; `sessionStart`/`sessionEnd` generally unavailable except on self-hosted machines.

Third-party loader `https://cursor.com/docs/reference/third-party-hooks`: Cursor **can load `.claude/settings.json` hooks** (also `.local` and `~/.claude/settings.json`) if the feature is enabled. Map: `UserPromptSubmit` → `beforeSubmitPrompt`; `Bash` matcher → `Shell`; `Edit` → `Write`. **No Cursor equivalent** for `Notification` or `PermissionRequest` (beep-effect #1144 "identify agent notification origins" will not 1:1 port).

**CONFIRMED headless gaps (≥2 forum + staff):**

1. 2026-03-30 [156220](https://forum.cursor.com/t/hooks-afteragentresponse-afteragentthought-not-firing-in-headless-cli/156220) — CLI `2026.02.27-e7d2ef6`, Ubuntu. `agent --print`: **only `sessionStart` fires**; `afterAgentResponse` / `afterAgentThought` do not. Staff Colin: **"this is a known gap!"** Workarounds: `stop` per turn; `postToolUse` / `afterFileEdit` / `afterShellExecution`; or parse stream-json.
2. 2026-08-13 [168326](https://forum.cursor.com/t/cursor-agent-cli-never-invokes-hooks-json-on-linux-2026-08-11-same-version-works-on-macos/168326) — `2026.08.11-e8db854`, Ubuntu 26.04 arm64 Docker. Same hooks.json works on macOS. Staff Colin 2026-08-28: processes **are spawned** but fail **exit 127** (PATH) or silent success; failures not surfaced. Diagnose: `cursor-agent --debug`; write hostname/pwd/env to a probe file; do not assume `/tmp` is the host's.

**INFERENCE:** `hook-pulse.sh` / `law-pulse.sh` / `ai-metrics` need (a) `.cursor/hooks.json` mapping `sessionStart`/`stop`/`postToolUseFailure` with Linux PATH-safe shebangs; (b) stream-json `result` as the metrics source of truth; (c) never rely on `afterAgentThought` in `-p`. Dual-write rather than assuming the Claude third-party loader fires in headless.

### Subagents / plugins

Custom agents live in `.cursor/agents/*.md` (user `~/.cursor/agents`, `/create-subagent`). Forum [151046](https://forum.cursor.com/t/subagents-not-working-in-cursor-cli/151046): CLI lacked Task/delegation (2026-02-06, `2026.01.28-fd13201`); staff 2026-03-05 **"This should be working now."** Later threads still report Task-enum / `.cursor/agents` misses ([166135](https://forum.cursor.com/t/committed-project-custom-subagents-missing-from-task-enum-invalid-enum-on-cursor-3-12-17/166135) workaround: symlink `~/.cursor/agents` → project).

**INFERENCE:** do not assume beep-effect `.claude/agents/*.md` Codex-toml twins auto-load. If parity is required, add `.cursor/agents/` copies or a Cursor plugin bundle.

Plugins `https://cursor.com/docs/plugins`: Agent Plugin (`plugin.json` + skills/MCP) vs Cursor Plugin (`.cursor-plugin/plugin.json` + rules/skills/hooks/agents). CLI `--plugin-dir` is on the parameters page; CAO uses it to inject MCP manifests. Local dev: `~/.cursor/plugins/local`.

### Linux sandbox surprises — **CONFIRMED ≥2 threads**

| Thread | Symptom | Workaround |
|---|---|---|
| [160039](https://forum.cursor.com/t/agent-cli-linux-sandbox-preflight-fails-unshare-eperm-unless-run-under-strace-apparmor-restrict-unprivileged-userns-1/160039) 2026-05-07 | `Failed to unshare namespaces: EPERM` (AppArmor missing `userns,` rule; staff Dean Rie) | `sysctl kernel.apparmor_restrict_unprivileged_userns=0` |
| [152649](https://forum.cursor.com/t/cursor-cli-not-updating-sandboxing-doesnt-work/152649) | `uid_map` EPERM; `chmod 4755 cursorsandbox` is a bad idea | `agent --debug` |
| [147855](https://forum.cursor.com/t/gpt-5-2-sandbox-issues/147855) | sandbox cmds exit 0, empty output, files not saved | disable sandbox |
| [157243](https://forum.cursor.com/t/disable-permissions-ask-in-sandbox/157243) | TUI still prompts; headless `--print --trust --sandbox enabled` auto-runs sandboxable, **silently denies** others without `--force` | D13 already has `--force` |
| [150926](https://forum.cursor.com/t/linux-sandbox-error-failed-to-apply-sandbox-io-error-step-4-7-mount-denies-failed-mount-count-limit-reached-1000/150926) | mount-count limit 1000 | — |

**INFERENCE for CachyOS:** smoke-test `--sandbox enabled` on this workstation (unprivileged user namespaces / io_uring MEMLOCK history). If preflight EPERM or empty-success, `--sandbox disabled` is the documented escape (agent-intern "full access", several Ralph runners). Keep `--force` so denials are not silent.

---

## 5. Cursor Cloud Agents API + self-hosted worker ("My Machines")

### Official split

`https://cursor.com/docs/cloud-agent`: paid sub; GitHub/GitLab/Bitbucket Cloud/Azure DevOps; billed at selected model's API rates; spending cap on first enable. Dashboard `https://cursor.com/agents`.

**Self-hosted** `https://cursor.com/docs/cloud-agent/self-hosted` — **CONFIRMED by docs + 2026-09-02 product ship:**

- Cursor still runs **agent loop, inference, and planning**. Worker does file edits, terminal, computer-use, local MCP. **Not air-gap.**
- **My Machines:** personal; multiple agents per machine; `agent login` or personal API key.
- **Team Pools:** Enterprise; one agent per machine; **service-account** key only.
- Install: `curl https://cursor.com/install -fsS | bash`
- Start: `agent worker start` — long-lived **outbound HTTPS**; no inbound ports.
- Outbound: `api2.cursor.sh`, `api2direct.cursor.sh`, `cloud-agent-artifacts.s3.us-east-1.amazonaws.com`.
- Caps: 200 workers/user, 1000/team.
- Linux computer-use packages: `dbus-x11 ffmpeg tigervnc-standalone-server x11-utils x11-xserver-utils xdotool xfce4`.
- Privacy Mode applies. Blocking the S3 artifacts host hides PR/dashboard artifacts but does **not** stop the agent.
- K8s: `agent worker controller --spawn` / `--warm-idle`.
- Worker CLI extras (parameters page): `--auth-token-file`, `--worker-dir` (repeatable), `--management-addr`, `--label`, `--pool`, `--pool-name`, `--idle-release-timeout`, `--computer-use`, Linux `--display` / `--share-desktop`.

X on 2026-09-02 (product launch day; handles `@cursor_ai`, `@shaoruu`, `@trq212`; `@DigitalAssetBuzz` stating "Self-hosted is NOT air gap. Your hardware runs the tools. Inference still happens in Cursor's cloud.") matches the docs. Treat the DigitalAssetBuzz line as **CONFIRMED** by official self-hosted page.

Grok Bot can **delegate to Cloud Agents** (`https://cursor.com/docs/grok-bot/teams`; default on for teams; admin toggle). That spends Cloud Agent/model quota, not just the Grok Bot weekly pool.

### Public HTTP API

`https://cursor.com/docs/cloud-agent/api/endpoints` — base `https://api.cursor.com`, Basic (`-u "$CURSOR_API_KEY:"`) or Bearer (service account).

| Method | Path | Notes |
|---|---|---|
| POST | `/v1/agents` | create; `prompt.text` required; `model.id` e.g. `composer-2` + params `fast`; `repos[]`; `autoCreatePR`; `mode` agent\|plan; `env` targets cloud env / pool / machine |
| GET | `/v1/agents` | list; `limit`≤100 |
| POST | `/v1/agents/{id}/runs` | follow-up; **409 `agent_busy`** if a run is active |
| GET | `/v1/agents/{id}/runs/{runId}/stream` | SSE |
| POST | `/v1/agents/{id}/runs/{runId}/cancel` | cancel |
| GET/POST | `/v0/private-workers`… | list/claim/release pools; service-account; max 4 pending-request SSE streams |

v1 `status` is **agent lifecycle**, not execution. Run state lives on `latestRunId` (staff, Aug 2026 freeze thread).

### Field reliability (Aug–Sep 2026)

**CONFIRMED multiple independent Cloud Agent failure classes:**

- **2026-08-18–22** [168957](https://forum.cursor.com/t/cloud-agents-freeze-mid-run-and-never-reach-a-terminal-state-60-consecutive-account-wide-since-18-aug/168957): 60 consecutive v1 agents stuck `ACTIVE` after pushing commits. Staff: agents had finished; **"your agents aren't frozen"**; **"Execution state now lives on runs instead."** GitHub install lookup 429 during burst.
- **2026-09-07–11** [170833](https://forum.cursor.com/t/cloud-agents-api-sdk-stream-delivers-intermediate-messages-steps-20-40s-later-than-cursor-com-agents-ui-on-the-same-run/170833): API/SDK stream **20–40s (up to 60s) behind UI**. Staff Colin: stream init loads full history (25–35s+); UI reuses browser cache. Also initial `"stream_unavailable"` race — retry.
- **2026-09-12–15** [171407](https://forum.cursor.com/t/cloud-agent-runs-fail-immediately-with-stream-unavailable-run-stream-is-no-longer-available-agent-often-deleted-404-after-first-failed-bootstrap/171407): run → error in 1–10s, `stream_unavailable`, apparent 404. Staff Mohit Jain 2026-09-14: Docker Hub pulls for `node:24.12.0-bookworm-slim`; agents not deleted — ID not ready until `agent.send()`; reconnect + poll run endpoint.
- Follow-up runs accepted then `ERROR` with empty payload [165610](https://forum.cursor.com/t/cloud-agents-api-follow-up-runs-accepted-but-end-in-error-with-no-error-payload/165610).
- Idle time is **not** billed; tokens + env setup are (staff, [163040](https://forum.cursor.com/t/cloud-agent-time-to-live/163040)). Startup failures used no tokens ([165792](https://forum.cursor.com/t/api-error-we-encountered-an-unexpected-error-repeatedly-when-calling-cloud-agent/165792)).

**INFERENCE:** beep-effect volume lane should stay **local `cursor-agent -p`**, not Cloud Agents API. Use Cloud Agents for phone/Grok-Bot/async PR work. If My Machines is stood up on DankStation, it still burns Cursor **inference** quota; it only keeps the checkout/build cache local. Poll **runs**, not agent `ACTIVE`. Timeout + retry on `stream_unavailable` / 409.

Hermes plugin `fernandoabolafio/cursor-hermes-plugin`: create/list/send/wait/cancel/resume/archive/delete against this API (**SINGLE-SOURCE**).

---

## 6. OpenAI-compatible adapters (CLIProxyAPI / LiteLLM / OpenRouter) and ToS

### Staff verdict — **CONFIRMED (Cursor staff, 2026-08-10)**

[Does using Oh My Pi's cursor provider or an OpenAI-compatible proxy to the same endpoints violate Cursor's ToS?](https://forum.cursor.com/t/does-using-oh-my-pi-s-cursor-provider-or-an-openai-compatible-proxy-to-the-same-endpoints-violate-cursor-s-tos/167778)

Dean Rie 2026-08-10:

- Oh My Pi's `cursor` provider is **"same category as an unofficial proxy."**
- Calling Cursor's **private, non-public client endpoints** outside authorized clients **"goes against the Use Restrictions."**
- **"can trigger abuse enforcement, up to and including an account ban."**
- Local-only does **not** change that.
- Cursor has **no public** OpenAI-compatible `/v1/chat/completions`.

**Supported alternatives named by staff:** Cursor CLI (`cursor-agent`), Cursor Agent SDK / headless, public Cloud Agents API — these use Cursor's **agent harness**, not a raw model.

ToS last updated **2026-09-03** (`https://cursor.com/terms-of-service`): §1.5(i) reverse engineer / underlying structure; §1.5(vi) probe/scan; §1.5(viii) harvest/scrape; §1.5(v) model extraction; §1.5(xi)/§3 account holder liable; no clause named "proxy" but staff apply 1.5(i).

### CLIProxyAPI / LiteLLM / OpenRouter

- `router-for-me/CLIProxyAPI` [issue 573](https://github.com/router-for-me/CLIProxyAPI/issues/573) 2025-12-17 "Is it possible to use cliproxy with cursor" — **closed, no resolution, no Cursor provider**. Matches Benjamin's note: CLIProxyAPI has **no Cursor executor**.
- LiteLLM/OpenRouter in Cursor is the **opposite direction** (Cursor editor → your OpenAI-compatible base URL). Forum workaround, not native; Cursor validates model names against an internal list; OpenRouter often breaks tools ([163533](https://forum.cursor.com/t/glm-5-2-support/163533) deanrie 2026-06-20).
- Hermes `StrawCoding/hermes-cursor-agent` wraps **local CLI stream-json** into OpenAI chunks — harness path, closer to allowed. Still ToS-grey if it impersonates `/v1/chat/completions` using Cursor credentials toward third parties. Local Hermes-on-DankStation is lower risk than a networked proxy.

**Do not** add a CLIProxyAPI provider that authenticates with a Cursor access token and re-exposes Composer/Grok/Fable as chat completions. That is the banned pattern. Keep CLIProxyAPI for Codex/Grok/Claude as today; add Cursor as a **sibling Bash lane**.

---

## Confirmed by ≥2 independent sources

1. Headless volume recipe is `-p --force [--trust] [--sandbox] --output-format stream-json` (official docs + agent-intern + Ralph + Hermes + forum CI).
2. `--print` hang / no-exit / silent-zero-output is a recurring 2026 CLI class (three forum threads + staff "known issue" / later "fixed" / July regression).
3. Two Cursor included pools: Cursor Models (Composer, Cursor Grok) vs Other Models (everyone else); Cursor models **spill into** Other Models (staff + docs + dashboards).
4. Composer 2.5 is a harness-trained **implementer**, not a planner (staff + ≥3 users + two blogs).
5. Self-hosted My Machines run tools locally; **inference stays in Cursor cloud** (official self-hosted page + 2026-09-02 launch coverage).
6. Unofficial OpenAI shims against private Cursor endpoints are ToS violations with ban risk (staff thread + ToS §1.5).
7. Headless hooks are incomplete (`afterAgentResponse`/`afterAgentThought` don't fire; Linux PATH 127) — two staff-acked threads.
8. Linux sandbox preflight EPERM / empty-success is a real class (multiple forum threads + staff AppArmor `userns` note).
9. Cloud Agents v1 API: poll **runs** not agent `ACTIVE`; `stream_unavailable` is a live Sep 2026 race (staff on two threads).
10. Codex quota is `codex app-server` → `account/rateLimits/read` (official README + ianlpaterson + remaining-tokens/codexbar).
11. Grok Bot weekly allowance is a **third** meter, distinct from the two monthly pools (staff 2026-08-28 + dashboard).
12. Cursor loads `.claude/skills` and can load `.claude/settings.json` hooks (official skills + third-party-hooks pages).

## Single-source claims

1. agent-intern `create-chat` + `~/.cursor/chats/*/meta.json` resume scan.
2. Hermes retry-once-with-`auto` on exhausted model.
3. CAO omits `--trust` because "current interactive Cursor versions reject it"; omits `-p` because print is one-shot.
4. Ultra Other Models ≈ $400 (community/secondary docs; official pages say only "Included").
5. Ultra 5–6 day / 20 day / Opus-1-week exhaustion anecdotes.
6. jkpe: Grok 4.6 not a noticeable upgrade to Composer 2.5 (forum #91).
7. Kimi K3 $20/5 min loop; "quantized" suspicion.
8. azhang: GLM 5.2 review scores > Composer 2.5.
9. CursorBench 4.0 Composer 27.7% / $0.68/task (Cursor marketing).
10. lockstride Ralph: 150k token rotate threshold; `DEFER` on rate limit.
11. danielsinewe Ralph: 20 min timeout + circuit breaker.
12. Cloud Agent 20–40s SSE lag vs UI (one thread, staff-acked).
13. 60 frozen v1 agents (one account, staff said they had completed).
14. CLI `--add-dir` / `--auto-review` on 2026.09.10-fd3934a help but not on docs parameters page.
15. Vibe Kanban sunsetting; Conductor Cursor flags unpublished.

---

## Recommendations for beep-effect

1. **Keep D13 as the Cursor volume lane.** Canonical invocation:
   ```bash
   timeout 20m env CURSOR_API_KEY=... \
     cursor-agent -p --trust --force --sandbox enabled \
     --model composer-2.5 \
     --output-format stream-json \
     --workspace "$REPO" \
     "$PROMPT" </dev/null
   ```
   Parse NDJSON; take `result`; keep `session_id` for `--resume`. Ignore partial-output duplicate flushes. If `composer-2.5` resolves to Fast in `--list-models`, pick the cheap standard id explicitly.

2. **Codify the tier policy in a wrapper, not in Cursor:**
   - Probe Codex: `codex app-server` + `account/rateLimits/read`; if weekly remaining **>5%**, Astra xhigh (existing `claudex` path).
   - Else Cursor Composer 2.5 (Cursor Models). Escalate to `cursor-grok-4.6-xhigh` only for long-horizon self-test jobs.
   - Never default Cursor overflow to `claude-fable-5-1-*`, `gpt-5.6-sol-*`, or `kimi-k3-*` (Other Models; Fable $10/$50; Kimi loops).
   - If Cursor Models **and** Other Models are dry and on-demand is off: hold and notify until a pool resets (D7; the draft's Anthropic-direct Fable fallback is superseded).

3. **Do not build a CLIProxyAPI/LiteLLM Cursor provider.** Staff ToS ban 2026-08-10. Keep Cursor as a sibling CLI. Hermes-style local stream-json shim is optional and should stay on-box.

4. **Do not scrape `DashboardService` / `cursor.com/api/usage-summary` from the public repo.** Same private-endpoint class. Personal DankStation meter is operator-local. Fail-open on Cursor remaining (treat Ultra Cursor-Models as the overflow pool; watch the dashboard).

5. **CI/cron hardening:** wrap `timeout`; `</dev/null`; `--debug` on hang; precompute `git diff` into the prompt; **no `--plan`** in print; HTTP/1.1 / no-VPN / `HTTPS_PROXY` if zero-byte hangs return. Prefer `create-chat` + `--resume` (agent-intern) over naked one-shots when iterating.

6. **Hooks parity:** add `.cursor/hooks.json` mapping `sessionStart`, `stop`, `postToolUseFailure`, `afterFileEdit` to PATH-absolute `hook-pulse.sh` / `law-pulse.sh`. Do not rely on `afterAgentThought` or Claude `Notification`/`PermissionRequest`. Also parse stream-json `result.duration_ms` for ai-metrics. Enable third-party Claude hooks only as a bonus, not the source of truth.

7. **Skills:** no duplication required — Cursor already reads `.claude/skills` and `.agents/skills`. Add `.cursor/agents/*.md` only if Task-tool subagent parity is needed (CLI support claimed fixed 2026-03-05; still flaky per later threads).

8. **Sandbox on CachyOS:** smoke-test `--sandbox enabled` once. If `unshare EPERM` or empty-success, switch the wrapper to `--sandbox disabled` (Ralph/agent-intern full-access). Do not `chmod 4755 cursorsandbox`. Keep `--force`.

9. **Cloud Agents / My Machines:** not the volume Bash lane. Optional later: `agent worker start` on a spare VM for Grok-Bot/phone handoff — still burns Cursor inference quota. If used, poll `/v1/agents/{id}/runs/{runId}` (not agent `ACTIVE`); retry `stream_unavailable`; honor 409 `agent_busy`; don't burst GitHub App installs.

10. **Ralph/CAO/Conductor:** if a loop is wanted, copy **lockstride/ralph-wiggum-plugin** or **LarsCowe/bmalph** (`-p --force --output-format json|stream-json --resume`, token rotate, timeout, circuit breaker) — not AWS CAO's interactive tmux provider.

11. **Quality split to write into the wrapper prompt:** "You are the implementation worker. Do not redesign schemas. Follow the Effect/schema packet. If the plan is wrong, stop." Matches the Composer-as-worker consensus. Leave architecture to Astra/Fable.

12. **Kimi policy:** Composer 2.5 **is** the Kimi-class worker (K2.5 + harness). Cursor-served Kimi K3 is a trap (Other Models + loops + text-only vision). GLM 5.2 is a cheap Other Models experiment, not the overflow default.

---

## Sources

- https://cursor.com/docs/cli/headless — accessed 2026-09-16 — official `-p`/`--force`/`stream-json`/`CURSOR_API_KEY` examples
- https://cursor.com/docs/cli/overview — accessed 2026-09-16 — install, modes, sandbox, resume, `&` Cloud handoff
- https://cursor.com/docs/cli/using — accessed 2026-09-16 — MCP, AGENTS.md/CLAUDE.md, worktrees, print/CI
- https://cursor.com/docs/cli/reference/parameters — accessed 2026-09-16 — full flag/subcommand list including `worker`, `--trust`, `--plugin-dir`
- https://cursor.com/docs/cli/reference/output-format — accessed 2026-09-16 — stream-json event schema
- https://cursor.com/docs/cli/github-actions — accessed 2026-09-16 — GHA YAML, restricted autonomy
- https://cursor.com/docs/cli/acp — accessed 2026-09-16 — `agent acp` JSON-RPC dialect
- https://cursor.com/docs/cli/reference/authentication — accessed 2026-09-16 — `agent login` vs `CURSOR_API_KEY`
- https://cursor.com/docs/hooks — accessed 2026-09-16 — `.cursor/hooks.json` events
- https://cursor.com/docs/reference/third-party-hooks — accessed 2026-09-16 — Claude settings.json loader + event map
- https://cursor.com/docs/skills — accessed 2026-09-16 — skill paths including `.claude/skills`
- https://cursor.com/docs/plugins — accessed 2026-09-16 — Agent vs Cursor plugin formats
- https://cursor.com/docs/cloud-agent — accessed 2026-09-16 — Cloud Agents overview
- https://cursor.com/docs/cloud-agent/self-hosted — accessed 2026-09-16 — My Machines / Team Pools; inference stays in Cursor cloud
- https://cursor.com/docs/cloud-agent/api/endpoints — accessed 2026-09-16 — `api.cursor.com` v1 agents + v0 private-workers
- https://cursor.com/docs/models — accessed 2026-09-16 — pool membership + $/M prices (Composer, Grok 4.6, Kimi K3, GLM 5.2, Fable 5, Sol)
- https://cursor.com/docs/models-and-pricing — accessed 2026-09-16 — plan "Included" language; Composer vs Claude/GPT prices
- https://cursor.com/docs/account/pricing — accessed 2026-09-16 — Ultra $200, unlimited tab completions only
- https://cursor.com/help/models-and-usage/usage-limits — accessed 2026-09-16 — two pools, no rollover
- https://cursor.com/help/grok-bot/plans — accessed 2026-09-16 — Ultra "highest" Grok Bot weekly
- https://cursor.com/docs/grok-bot/teams — accessed 2026-09-16 — Grok Bot → Cloud Agents delegation
- https://cursor.com/docs/models/cursor-composer-2-5 — accessed 2026-09-16 — Composer positioning; Fast is default variant
- https://cursor.com/composer — accessed 2026-09-16 — CursorBench 4.0 27.7% / $0.68/task
- https://cursor.com/changelog/composer-2-5 — accessed 2026-09-16 — 2026-05-18 pricing/quality
- https://cursor.com/terms-of-service — accessed 2026-09-16 — ToS updated 2026-09-03; §1.5 reverse-engineer/scrape
- https://forum.cursor.com/t/cursor-agent-p-print-headless-mode-hangs-indefinitely-and-never-returns/150246 — accessed 2026-09-16 — Jan–Mar 2026 hang; staff "fixed"
- https://forum.cursor.com/t/cursor-agent-print-doesnt-exit-after-completing/150296 — accessed 2026-09-16 — no-exit; CI silent `--plan`; git-diff workaround
- https://forum.cursor.com/t/cursor-agent-p-hangs-with-zero-output-on-2026-07-01-41b2de7-macos-intel-all-output-formats-even-trivial-prompts/164841 — accessed 2026-09-16 — July 2026 zero-byte hang
- https://forum.cursor.com/t/hooks-afteragentresponse-afteragentthought-not-firing-in-headless-cli/156220 — accessed 2026-09-16 — staff "known gap"
- https://forum.cursor.com/t/cursor-agent-cli-never-invokes-hooks-json-on-linux-2026-08-11-same-version-works-on-macos/168326 — accessed 2026-09-16 — Linux hooks exit 127
- https://forum.cursor.com/t/disable-permissions-ask-in-sandbox/157243 — accessed 2026-09-16 — headless `--print --trust --sandbox enabled`
- https://forum.cursor.com/t/agent-cli-linux-sandbox-preflight-fails-unshare-eperm-unless-run-under-strace-apparmor-restrict-unprivileged-userns-1/160039 — accessed 2026-09-16 — AppArmor `userns` EPERM
- https://forum.cursor.com/t/cursor-cli-not-updating-sandboxing-doesnt-work/152649 — accessed 2026-09-16 — uid_map EPERM
- https://forum.cursor.com/t/gpt-5-2-sandbox-issues/147855 — accessed 2026-09-16 — sandbox empty-success
- https://forum.cursor.com/t/linux-sandbox-error-failed-to-apply-sandbox-io-error-step-4-7-mount-denies-failed-mount-count-limit-reached-1000/150926 — accessed 2026-09-16 — mount-count 1000
- https://forum.cursor.com/t/composer-2-5-is-now-live/160934 — accessed 2026-09-16 — Composer 2.5 = Kimi K2.5 + CPT
- https://forum.cursor.com/t/share-your-thoughts-on-composer-2-5/160935 — accessed 2026-09-16 — quality + Ultra 5–6 day burn
- https://forum.cursor.com/t/can-anyone-tell-me-how-good-composer-2-5-is/161218 — accessed 2026-09-16 — "worker bees, not thinkers"
- https://forum.cursor.com/t/praise-for-cursor-composer-2-5/162448 — accessed 2026-09-16 — plan-with-frontier, execute-with-Composer; staff agrees
- https://forum.cursor.com/t/grok-4-6-is-now-live/168189 — accessed 2026-09-16 — Grok 4.6 Extra High announcement
- https://forum.cursor.com/t/share-your-thoughts-on-grok-4-6/168190 — accessed 2026-09-16 — mixed quality; context fill; post #91 vs Composer
- https://forum.cursor.com/t/possible-bug-in-cursor-token-statistics-other-models-disabled-after-grok-quota-exhausted/169032 — accessed 2026-09-16 — staff: Cursor Models spill into Other Models
- https://forum.cursor.com/t/grok-bot-spend-cursor-usage-i-cant-accept-it/169796 — accessed 2026-09-16 — Grok Bot separate weekly pool
- https://forum.cursor.com/t/kimi-k3-disoriented-and-expensive-in-cursor/168699 — accessed 2026-09-16 — $20/5 min loop
- https://forum.cursor.com/t/kimi-k3-completely-broken-multimodal-capabilities/167295 — accessed 2026-09-16 — Cursor Kimi is text-only
- https://forum.cursor.com/t/glm-5-2-support/163533 — accessed 2026-09-16 — GLM BYOK/OpenRouter/200K context
- https://forum.cursor.com/t/custom-openai-compatible-model-shows-200k-context-limit-for-glm-5-2-even-though-it-supports-1m-context/163360 — accessed 2026-09-16 — custom-model 200K cap
- https://forum.cursor.com/t/does-using-oh-my-pi-s-cursor-provider-or-an-openai-compatible-proxy-to-the-same-endpoints-violate-cursor-s-tos/167778 — accessed 2026-09-16 — staff ToS ban on unofficial proxies
- https://forum.cursor.com/t/running-out-of-ultra-plan-credits-before-renewal/150012 — accessed 2026-09-16 — ~$400 Other Models; 20-day exhaustion
- https://forum.cursor.com/t/subagents-not-working-in-cursor-cli/151046 — accessed 2026-09-16 — CLI Task tool missing then "working now" 2026-03-05
- https://forum.cursor.com/t/cloud-agents-freeze-mid-run-and-never-reach-a-terminal-state-60-consecutive-account-wide-since-18-aug/168957 — accessed 2026-09-16 — v1 ACTIVE vs run state
- https://forum.cursor.com/t/cloud-agents-api-sdk-stream-delivers-intermediate-messages-steps-20-40s-later-than-cursor-com-agents-ui-on-the-same-run/170833 — accessed 2026-09-16 — 20–40s SSE lag
- https://forum.cursor.com/t/cloud-agent-runs-fail-immediately-with-stream-unavailable-run-stream-is-no-longer-available-agent-often-deleted-404-after-first-failed-bootstrap/171407 — accessed 2026-09-16 — Sep 2026 stream_unavailable
- https://forum.cursor.com/t/cloud-agents-api-follow-up-runs-accepted-but-end-in-error-with-no-error-payload/165610 — accessed 2026-09-16 — follow-up ERROR empty payload
- https://forum.cursor.com/t/cloud-agent-time-to-live/163040 — accessed 2026-09-16 — billed tokens+setup, not idle
- https://forum.cursor.com/t/api-error-we-encountered-an-unexpected-error-repeatedly-when-calling-cloud-agent/165792 — accessed 2026-09-16 — startup fail uses no tokens
- https://github.com/awslabs/cli-agent-orchestrator/blob/main/docs/cursor-cli.md — accessed 2026-09-16 — CAO interactive flags; no `-p`/`--trust`
- https://github.com/SinanTufekci/agent-intern/blob/main/cursor_bridge.py — accessed 2026-09-16 — create-chat/resume/stream-json parser
- https://github.com/moosl/cursor-auto-pilot — accessed 2026-09-16 — `agent -p --output-format=stream-json`
- https://github.com/StrawCoding/hermes-cursor-agent — accessed 2026-09-16 — stream-json OpenAI shim; retry `auto`
- https://github.com/yinguangyao/coding-agent-runner — accessed 2026-09-16 — Cursor via ACP
- https://github.com/taberoajorge/ralph — accessed 2026-09-16 — Ralph `agent -p --force` + stream-json
- https://github.com/LarsCowe/bmalph — accessed 2026-09-16 — `cursor-agent -p --force --output-format json --resume`
- https://github.com/raiyanyahya/loop — accessed 2026-09-16 — `cursor-agent -p --force`; ralph template
- https://github.com/danielsinewe/ralph-cursor — accessed 2026-09-16 — `agent --print --force`; 20 min timeout; circuit breaker
- https://github.com/lockstride/ralph-wiggum-plugin — accessed 2026-09-16 — stream-json token rotate 150k; DEFER on rate limit
- https://github.com/BloopAI/vibe-kanban — accessed 2026-09-16 — sunsetting; Cursor listed
- https://github.com/router-for-me/CLIProxyAPI/issues/573 — accessed 2026-09-16 — no Cursor provider
- https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md — accessed 2026-09-16 — `account/rateLimits/read`
- https://github.com/cnwinds/cursor-pulse/blob/master/docs/cursor-usage-api.md — accessed 2026-09-16 — unofficial DashboardService usage API
- https://github.com/robinebers/openusage/blob/main/docs/providers/cursor.md — accessed 2026-09-16 — session-token Cursor meter
- https://ianlpaterson.com/blog/tracking-claude-codex-gemini-quotas-from-one-script/ — accessed 2026-09-16 — unified Codex/Claude/Gemini quota script; no Cursor
- https://www.learncursor.dev/learn/cursor-for-teams/cursor-usage-limits — accessed 2026-09-16 — Ultra Other Models $400 (secondary)
- https://tovren.com/cursor-composer-2-5-daily-coding-default/ — accessed 2026-09-16 — Composer daily driver; keep Claude/Codex
- https://deepakness.com/raw/composer-2-5-worker/ — accessed 2026-09-16 — Composer-as-worker pattern (Jul 2026)
- https://www.conductor.build/docs/concepts/agent-modes — accessed 2026-09-16 — Conductor Cursor + `CURSOR_API_KEY`
- https://x.com/codedibia/status/2072358774757556499 — accessed 2026-09-16 — @codedibia 2026-07-01 stream-json plugin gotchas
- https://x.com/GitTrend0x/status/2088436058602238084 — accessed 2026-09-16 — @GitTrend0x 2026-08-15 Hermes Cursor plugins
- https://x.com/nearygy/status/2077603830645293062 — accessed 2026-09-16 — @nearygy 2026-07-16 Cursor via ACP
- https://x.com/grok/status/2086484877860339853 — accessed 2026-09-16 — @grok 2026-08-09 session_id resume dialect
