# Model-id / routing surface census (2026-09-22)

Scope: repo `$HOME/YeeBois/projects/beep-effect` (excl. node_modules, .git, graft/, locks,
research/ explorations/ goals/ packet prose) + user-level dotfiles. Roles: **(a)** governance doctrine,
**(b)** code default, **(c)** JSDoc example, **(d)** CI/automation config, **(e)** historical record (frozen).

## Part A — Repo surfaces

### (a) Governance doctrine — prose, human edit required
| File | matches | ids |
| --- | --- | --- |
| `AGENTS.md` (== `CLAUDE.md` symlink) | 10 | gpt-6-astra, gpt-5.6-sol, gpt-5.6-luna, grok-4.6, composer-2.5, cursor-grok, claude-opus-5, claude-fable-5, kimi-k3 |
| `docs/runbooks/agent-pools.md` | 13 | same 9 ids (seat tables: volume / review / mechanical, never-list) |
| `docs/runbooks/graft-local-recovery.md` | 11 | claude-opus-5, gpt-6-astra, grok-4.6 (GRAFT_MODEL guidance) |
| `docs/runbooks/codex-security.md` | 1 | gpt-6-astra |
| `.claude/skills/browser-qa-loop/SKILL.md` | 1 | gpt-6-astra (judge model) |
| `.claude/skills/browser-qa-loop/resources/judge-prompt.md` | 1 | gpt-6-astra + `"effort":"medium"` |
| `.claude/skills/oracle/SKILL.md` | 1 | gpt-6-astra |
| `.claude/skills/impeccable/agents/impeccable_finish_reviewer.toml` | 1 | gpt-6-astra (`model = `) |
| `.claude/skills/impeccable/agents/impeccable_documenter.toml` | 1 | gpt-6-astra (`model = `) |

Note: `.codex/**`, `.cursor/**`, `.agents/**`, `.github/workflows/**`, `scripts/**` carry **zero** model ids.
`.claude/settings*.json` in-repo carry none. No systemd unit renderer in-repo hardcodes a model.

### (b) Code defaults — mechanically rewritable
| File:line | id | concept |
| --- | --- | --- |
| `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocMigrateTitles.ts:108` | `grok-4.5` | `defaultJSDocMigrateTitlesModel` — **stale**, only surviving 4.5 reference |
| `packages/tooling/tool/cli/src/commands/Qa/JudgePack.ts:935` | `gpt-6-astra` + `--effort medium` | emitted next-step command for the QA judge (codex-companion) |
| `packages/tooling/library/ai-metrics/test/hook-pulse-writer.test.ts` | `composer-2.5` | fixture for Cursor transcript parsing |

Open-typed (no enumeration — nothing to sync): `XAiModelName` = `S.NonEmptyString` (`packages/drivers/xai/src/XAiLanguageModel.service.ts:53`);
`QaJudgeRef.model`/`.effort` = `S.String` (`.../Qa/Inventory.schemas.ts:295-306`);
`GraftDeepRefreshOptions.model` / `GraftDeepStatus.model` = `S.optional(S.String)` / `S.String`
(`.../Graft/Graft.schemas.ts:401,480`, default sentinel `"(env default)"`).
`packages/tooling/library/ai-sync/src/models.ts` enumerates **agents/domains**, not model ids —
the harness-routing abstraction already exists there (`AiSyncAgentId`, `AiSyncDomainId`, `AiSyncSourceId`).
No `LiteralKit` anywhere enumerates AI model ids.

### (c) JSDoc examples — mechanically rewritable, but cosmetic
| File | matches | id |
| --- | --- | --- |
| `.../Qa/Inventory.schemas.ts` (3), `.../Qa/JudgeCheck.ts` (5), `.../Qa/Qa.render.ts` (1) | 9 | `gpt-daybreak-blue-latest` (QaJudgeRef examples) |
| `.../Yeet/internal/Provenance.ts` (6), `.../Yeet/internal/Resume.ts` (1) | 7 | `gpt-5.4`, `claude-sonnet-4.5` (PR provenance examples) |
| `.../Docgen/internal/QualityWorkerEval.ts` | 3 | `gpt-5.4` |

### (d) CI/automation config
None. `.github/workflows/**` has no model ids; Heavy/Tier lanes are model-free.

### (e) Historical record / fixtures — FREEZE
| File(s) | matches | id |
| --- | --- | --- |
| `apps/labs/semantica/fixtures/gold/v1/*.json` (21 files) | 21 | `grok-4.6` (recorded provider+model per gold record) |
| `apps/labs/semantica/src/runtime/Config.ts`, `test/Canary.test.ts`, `test/ProviderCache.test.ts` | 4 | `grok-4.6` (must match the gold fixtures) |
| `packages/tooling/tool/cli/test/*` (qa-*, docgen, yeet-pr-provenance*, codex-security-dispatch, graft-deep-refresh) | 28 | gpt-daybreak-blue, gpt-5.4, gpt-6-astra, grok-4.6 — parsing fixtures |
| `packages/drivers/anthropic/src/Anthropic.{config,repair}.ts`, `packages/documents/server/.../FilingDecisionLlm.config.ts` | 5 | `claude-haiku-4-5` — product runtime defaults (different concept: product inference, not agent routing) |
| `packages/drivers/venice-ai/swagger.yaml` | 1 | `gemini-3` (vendor spec) |
| `A_LETTER_FROM_THE_OTHER_SIDE_OF_THE_LOOP.md`, `.claude/skills/ontology-foundational-auditor/REVIEW-HISTORY.md` | 3 | provenance prose |
| `scratchpad/**` (11 files) | 18 | claude-haiku-4-5, claude-sonnet-5 — untracked scratch, out of scope |

## Part B — User-level surfaces

| Surface | matches | role | notes |
| --- | --- | --- | --- |
| `~/.claude/CLAUDE.md` | 25 | (a) | THE routing doctrine: session types, Workflow child model IDs, headless recipes, quota pools |
| `~/.claude/rules/working-style.md` | 4 | (a) | Codex delegation defaults (`gpt-6-astra`, `xhigh`) — conflicts with repo AGENTS.md `medium` |
| `~/.claude/rules/{machine,effect-coding-standards,oip-confidentiality}.md` | 0 | — | no model ids |
| `~/.claude/settings.json` | 2 | (b/d) | `"model": "claude-fable-5-1[1m]"` (L35); `"claude-fable-5-1"` key in a per-model block (L160) |
| `~/.claude/settings.local.json`, `~/.claude/agents`, `~/.claude/skills`, `~/.claude/commands` | 0 | — | clean |
| `~/.claude/memory/beep-effect/*.md` | 170 across 455 files | (e) mostly | routing-PURPOSE files: `MEMORY.md`, `workflow-proxy-routing-needs-proxy-session.md`, `codex-default-model-daybreak-blue.md`, `astra-default-effort-medium.md`, `codex-effort-config-pin.md`, `feedback-workflow-children-route-to-proxy-models.md`, `feedback-workflow-children-never-fable.md`, `feedback-only-opus-grok-cursor-subagents.md`, `cursor-agent-headless-lane.md`, `cursor-agent-pool-packet-state.md`, `grok-native-workflows-headless.md`, `grok-x-search-headless-primitives.md`, `graft-wiring-state.md`. All others are dated incident/packet records → FREEZE |
| `~/.zshrc` L124-167 | 8 | (a/d) | `claudex` → `gpt-6-astra(xhigh)` + `--settings '{"effortLevel":"xhigh"}'`; `claudeg` → `grok-4.6`; `claudep` → `claude-fable-5-1`; all three set `ANTHROPIC_DEFAULT_HAIKU_MODEL=gpt-5.6-luna` |
| `~/.codex/config.toml` | 5 | (b/d) | L2 `model_reasoning_effort = "medium"`, L3 `plan_mode_reasoning_effort = "xhigh"`, L4 `model = "gpt-6-astra"`; `[notice.model_migrations]` L1805; `[tui.model_availability_nux]` L1821 (`gpt-5.5`, `gpt-5.6-sol`, `gpt-6-astra`) — the last two are Codex-CLI-managed state, do not hand-edit |
| `~/.cursor/cli-config.json` | — | (b) | `model.modelId = "grok-4.6"`, plus `modelSelectionHistory[]` — CLI-managed |
| `~/.cursor/*` other 223 matches | — | (e) | plugin marketplace caches + agent transcripts; NOT routing surfaces |
| `~/.config/beep-graft/env` | 1 | (d) | `GRAFT_MODEL=claude-opus-5` (+ `GRAFT_BASE_URL=http://127.0.0.1:8317/v1`) — the graft deep-refresh routing knob |
| `~/.config/systemd/user/beep-graft-deep-refresh.service` | 0 (model via EnvironmentFile) | (d) | `ExecStart=… beep graft deep refresh --owner …/beep-effect0 --jobs 16` |
| `~/.config/systemd/user/beep-research-{daily,repo-card}.service` | 0 | (d) | model comes from `~/.config/beep-research/env` (absent/optional: `EnvironmentFile=-`) |
| `~/.config/systemd/user/cli-proxy-api.service.d/override.conf` | 1 | (e) | comment naming the vendored Daybreak build |
| `~/.local/bin/*` | 0 | — | clean |
| `~/.cli-proxy-api/config.yaml` | structure only | (d) | `routing.strategy: fill-first`, `xai.inject-x-search: true`, `claude-header-defaults.user-agent: claude-cli/2.1.259`, `auth-dir`, port 8317. **No alias/model table** — routing is by model-id prefix |

## Part C — Ground-truth "list models" sources

| Source | Auth | Verified | Returns |
| --- | --- | --- | --- |
| `~/.codex/models_cache.json` | none (local cache, `client_version 0.153.4`, fetched 2026-09-22) | **VERIFIED** | 7 slugs with `default_reasoning_level`, `supported_reasoning_levels`, `visibility`: `gpt-5.6-sol` (low; low..ultra), `gpt-6-astra` (medium; low..ultra), `gpt-5.6-terra` (medium; low..ultra), `gpt-5.6-luna` (medium; low..max), `gpt-5.5` (medium; low..xhigh), `gpt-reserve` (hide), `codex-auto-review` (hide). **Best machine-readable OpenAI/Codex truth.** |
| `~/.codex/config.toml` `[tui.model_availability_nux]` | none | VERIFIED | `gpt-5.5`, `gpt-5.6-sol`, `gpt-6-astra` — nudge counters, a lagging subset of the cache |
| `cursor-agent models` | uses existing login | **VERIFIED** | 231 lines / ~230 ids incl. `composer-2.5`, `claude-opus-5-thinking-high(-fast)`, `claude-sonnet-5-thinking-{high,xhigh}`, `claude-fable-5-thinking-{high,xhigh}`, `gpt-5.6-sol-{high,xhigh}(-fast)`, `gpt-5.6-luna-high`, `cursor-grok-4.{5,6}-{low..xhigh}(-fast)`, `grok-4.7-{low..xhigh}(-fast)`, `gemini-3.7-flash-high`, `kimi-k3-{low,high,max}`, `gpt-5.3-codex-*`, `auto`. Effort is baked into the id suffix. **Best Cursor truth; confirms every AGENTS.md seat id exists.** |
| `claude --help` | none | VERIFIED | `--model` text only names aliases (`fable`, `opus`, `sonnet`) + example `claude-fable-5`; no enumerable list. No models JSON found in the install. |
| OpenAI `GET /v1/models` | API key | UNVERIFIED | `{data:[{id,object,created,owned_by}]}` — API-tier ids, not ChatGPT-OAuth Codex slugs; wrong namespace for this routing |
| Anthropic `GET /v1/models` | `x-api-key` + `anthropic-version` | UNVERIFIED | `{data:[{type,id,display_name,created_at}]}` paginated — API ids, not the Claude Code subscription aliases |
| xAI `GET /v1/models` | bearer | UNVERIFIED | OpenAI-shaped `{data:[{id,...}]}`; xAI also has `/v1/language-models` with richer metadata |
| CLIProxyAPI `GET /v1/models` on `127.0.0.1:8317` | client token | not called (token) | proxy's merged catalog across codex/xai/claude legs — the natural union source for proxy-routed ids |
| cursor.com/docs/models | none | UNVERIFIED (not fetched) | human-readable table; `cursor-agent models` supersedes it |

## Part D — Summary

### D1. Surfaces × role × id count
| Role | Surfaces | id occurrences |
| --- | --- | --- |
| (a) governance doctrine (repo) | 9 files | 40 |
| (a) governance doctrine (user) | `~/.claude/CLAUDE.md`, `working-style.md`, `~/.zshrc` | 37 |
| (b) code default | 3 repo files + `~/.codex/config.toml` + `~/.cursor/cli-config.json` + `~/.claude/settings.json` + `~/.config/beep-graft/env` | ~12 |
| (c) JSDoc example | 6 repo files | 19 |
| (d) CI/automation | systemd units + env files + proxy config | ~4 (+ structural) |
| (e) historical / fixture (repo) | ~40 files | ~80 |
| (e) historical (user memory + cursor caches) | ~470 files | ~390 |

### D2. Rewrite policy
- **Mechanical (safe, sed-able):** JSDoc examples (19), `defaultJSDocMigrateTitlesModel`, `JudgePack.ts` next-step string, `~/.config/beep-graft/env` `GRAFT_MODEL`, `~/.zshrc` wrapper model args, `~/.claude/settings.json` `model`.
- **Human prose edit:** `AGENTS.md`, `docs/runbooks/agent-pools.md`, `docs/runbooks/graft-local-recovery.md`, `~/.claude/CLAUDE.md`, `~/.claude/rules/working-style.md`, skill SKILL.md/judge-prompt/impeccable TOMLs. Each id sits inside an argued rule with dates, supersession notes and never-lists; a blind swap breaks the argument. Known live conflict: repo says Codex effort `medium`, `~/.claude/rules/working-style.md` still says `xhigh`.
- **Freeze:** all `apps/labs/semantica/fixtures/gold/**` + their Config/tests (gold provenance), all `packages/tooling/tool/cli/test/**` parsing fixtures, `packages/drivers/**` vendor specs and product runtime defaults, dated `~/.claude/memory/beep-effect/*.md` incident records, `~/.cursor/**` caches/transcripts, `A_LETTER…`/REVIEW-HISTORY provenance.
- **CLI-managed, never hand-edit:** `~/.codex/models_cache.json`, `[tui.model_availability_nux]`, `[notice.model_migrations]`, `~/.cursor/cli-config.json` `modelSelectionHistory`.

### D3. Routing concepts (the abstraction a sync tool should key on)
1. `codex.heavy.model` + `codex.heavy.effort` — default token-heavy Codex work (`gpt-6-astra` / `medium` repo, `xhigh` user rules). Appears in AGENTS.md, agent-pools.md, working-style.md, `~/.codex/config.toml`, `~/.zshrc` claudex, Codex-plugin/CLI/Workflow forms.
2. `codex.plan.effort` — `plan_mode_reasoning_effort` (`xhigh`).
3. `child.lightweight` — `ANTHROPIC_DEFAULT_HAIKU_MODEL` = `gpt-5.6-luna`.
4. `research.web` — Grok lane (`grok-4.6`, `claudeg`, x_search injection).
5. `orchestrator.fable` — `claude-fable-5-1[1m]` (`~/.claude/settings.json`, `claudep`).
6. `cursor.seat.volume` — `composer-2.5` → `cursor-grok-4.6-xhigh`.
7. `cursor.seat.review` — `claude-opus-5-thinking-high` → `gpt-5.6-sol-xhigh`.
8. `cursor.seat.mechanical` — `composer-2.5` → `gpt-5.6-luna-high`.
9. `cursor.seat.never` — `*-fast`, `auto`, `kimi-k3-*`, `claude-fable-5-1-*`.
10. `qa.judge.model` + `qa.judge.effort` — `gpt-6-astra` / `medium` (skill + JudgePack; JSDoc examples still say `gpt-daybreak-blue-latest`).
11. `graft.deep.model` — `GRAFT_MODEL` in `~/.config/beep-graft/env` (`claude-opus-5` via proxy).
12. `research.routine.model` — nominally `~/.config/beep-research/env`; that file is optional and currently supplies no model.
13. `jsdoc.migrate-titles.model` — `grok-4.5` (stale).
14. `product.inference.model` — `claude-haiku-4-5` in anthropic driver / FilingDecisionLlm; a *different* pool from agent routing and should not be swept with it.
15. `deprecated.routable` — `gpt-daybreak-blue-latest`, `gpt-5.6-sol(medium)` kept explicitly routable.

Sync design implication: the tool should own concepts 1-13 + 15 keyed by name, resolve each to a live id via
`~/.codex/models_cache.json` (OpenAI) and `cursor-agent models` (Cursor), and treat category (e) plus
concept 14 as out-of-scope by path allowlist.
