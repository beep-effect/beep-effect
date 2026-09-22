# Model routing sync — aligned design (grill 2026-09-22)

Problem: model ids and effort levels are hardcoded across repo doctrine, skills, code
defaults, JSDoc, and user-level dotfiles; every provider release means a manual sweep.
Existing `version-sync` (hardcoded resolvers, repo-root only, no Markdown updater) and
`config-sync` (= `beep tsconfig-sync`, workspace-derived, no upstream) do not fit.
`sync-data-to-ts` is the manifest-shaped precedent but is repo-rooted and dataset-scoped.

Evidence reports: `01-cliproxyapi-catalog.md`, `02-repo-cli-sync-surface.md`,
`03-surface-census.md`, `04-home-sweep.md` (same directory).

## Locked decisions

| # | Decision | Ruling |
| --- | --- | --- |
| 1 | Catalog source of truth | **Layered.** Existence + `thinking.levels` from `https://models.router-for.me/models.json` (fallback raw.githubusercontent `router-for-me/models`). Availability overlays: `~/.codex/models_cache.json` (Codex slugs + effort ladders), `cursor-agent models` (Cursor ids), proxy `GET /v1/models` at 127.0.0.1:8317 (admitted-auth filter). A binding is valid only if it exists in the catalog AND is routable on this box for its surface. Never gate on `/v1/models` alone (it omitted `gpt-6-astra` on 2026-09-22). |
| 2 | New model handling | **Propose only.** Tool diffs snapshots (added / removed / levels-changed), flags bindings whose id vanished. Operator edits one manifest; projection rewrites every surface. Catalog has no deprecation field; removals are hard-deletes, so the tool keeps its own retired ledger. |
| 3 | Bindings manifest home | **`$HOME/.config/beep/models.yaml`** is the operator truth. Repo files are projection targets reached via `--repo <path>`. Manifest paths are written `$HOME/…`, never absolute home. |
| 4 | Prose strategy | **Generated block + lint outside it.** Tool-owned fenced regions (`<!-- beep-models:begin -->` … `<!-- beep-models:end -->`) carry the routing table and a `superseded:` list; prose refers to roles, not ids. `beep lint model-ids` flags superseded ids outside blocks. One-time prose rewrite to adopt. |
| 5 | Placement | **`commands/Models/` group in `@beep/repo-cli`** (`beep models`), plus `~/.local/bin/beep-models` shim that runs it from the main clone with `--repo` defaulted. No new package. Reuses RunMode (check / dry-run / write), PolicyFindingLogger, `internal/systemd/SystemdUnit.ts` home-as-parameter idiom, YAML/JSONC/plain-text updaters. |
| 6 | Catalog snapshot | **Home ledger only.** Dated snapshots under `$HOME/.local/state/beep/models/`; no committed repo snapshot, no data-sync PR bot. CI lint is self-contained via the `superseded:` list inside each generated block. |
| 7 | Writable home surfaces | `~/.claude/CLAUDE.md` + `~/.claude/rules/working-style.md` blocks; `~/.zshrc` claudex/claudeg/claudep wrapper args (line-anchored: `--model`, `effortLevel`, `ANTHROPIC_DEFAULT_HAIKU_MODEL`); `~/.codex/config.toml` top-level `model`, `model_reasoning_effort`, `plan_mode_reasoning_effort` (line-anchored; `toml` dep is parse-only; never touch `[tui]`/`[notice]`); `~/.config/beep-graft/env` `GRAFT_MODEL`; `~/.claude/settings.json` `model`. Plus any (W) targets from `04-home-sweep.md`. |
| 8 | Alerting | **Daily `systemd --user` timer** rendered by `beep models install-timer` running `beep models check`; drift fires a critical Plasma notification (GraftDeep idiom) and writes the report file. Runbook: `docs/runbooks/systemd-timers.md`. |
| 9 | Repo projection targets | AGENTS.md volume-pools section, `docs/runbooks/agent-pools.md` seat table, `docs/runbooks/graft-local-recovery.md` GRAFT_MODEL guidance (generated blocks); skill files (`browser-qa-loop/SKILL.md`, `resources/judge-prompt.md`, `oracle/SKILL.md`, impeccable agent TOML `model =`); code defaults (`JSDocMigrateTitles.ts:108` stale `grok-4.5`, `Qa/JudgePack.ts:935`) and the 19 JSDoc examples (`ts-literal` locator; docgen ratchet is the risk). Everything else lint-only. |
| 10 | Effort model | **Binding = role × surface, effort per binding.** Surfaces: `codex-cli`, `codex-plugin`, `proxy-workflow`, `cursor-seat`, `grok-cli`, `claude-code`. Validation: effort ∈ that surface's domain (catalog `thinking.levels` for proxy — no `ultra`; codex cache ladder for codex-cli; Cursor id list for seats, where effort is baked into the id). |
| 11 | Frozen files + memory | Freeze fixtures, gold records, packet prose, `packages/**/test/**`, dated memory records, cursor caches. Lint excludes `research/`, `explorations/`, `goals/`, `**/test/**`, `~/.claude/memory`. MEMORY.md gets one pointer line to the manifest + CLAUDE.md block; routing-purpose memory files stay as history. Product inference defaults (`claude-haiku-4-5` in anthropic driver / FilingDecisionLlm) are a different pool and out of scope. |
| 12 | First slice | **Schema + catalog fetch + `check` report.** ModelCatalog / ModelBinding / ModelSyncTarget schemas; fetch manifest, read codex cache, run `cursor-agent models`; decode; diff against ledger; print drift per target in check mode. No writes. |

## Roles (from the census, 15 concepts → manifest roles)

`orchestrator` (claude-fable-5-1[1m]), `codex.heavy` (+ plan effort), `child.lightweight`
(ANTHROPIC_DEFAULT_HAIKU_MODEL), `research.web` (grok lane), `cursor.volume`,
`cursor.review`, `cursor.mechanical`, `cursor.never` (deny list), `qa.judge`, `graft.deep`,
`research.routine`, `jsdoc.migrate-titles`, `deprecated.routable` (explicit keep-routable
aliases such as `gpt-daybreak-blue-latest`, a local `oauth-model-alias` concern invisible to
the upstream catalog).

## Non-negotiables

- `home` is a parameter, never `os.homedir()` at a call site.
- Default mode is `--check`; `--write` copies each touched home file to `~/.config-backups/` first; rewrites are idempotent and return `changed`.
- Repo targets refuse to write on a dirty checkout of the touched files.
- Schema-first: schemas → `Context.Service` contract → implementation. LiteralKit for roles, surfaces, providers, effort levels. HashMap/HashSet only.
- Never edit the user's global files unprompted (memory `astra-default-effort-medium`).

## Home sweep additions (04-home-sweep.md, 2026-09-22)

In scope as writable targets (extends ruling 7):

| Target | Format / locator | Role |
| --- | --- | --- |
| `~/.grok/config.toml` `[models] default`, `default_reasoning_effort` | toml table-key (line-anchored inside `[models]`) | `research.web` × `grok-cli` |
| `~/.config/JetBrains/Air/.codex/config.toml` top-level `model` / effort keys | toml top-of-file keys; never whole-file (machine-appended `[projects.*]` tail) | `codex.heavy` × `codex-cli` (SECOND live Codex config) |
| `~/.config/JetBrains/WebStorm2026.{2,3}/options/CodexLauncher.xml` | xml attribute (`model`, `modelReasoningEffort` uses display labels like "Extra High" — needs an effort label map) | `codex.heavy` × `jetbrains-codex` (new surface) |
| `~/.config/JetBrains/RustRover2026.{1,2}/options/DefaultAgentRollout.xml` | xml attribute holding `&quot;`-escaped JSON array | `codex.heavy` / `child.lightweight` × `jetbrains-codex` |
| `~/.agents/skills/impeccable/agents/*.toml` (4) `model`, `model_reasoning_effort` | toml top-level keys | `codex.heavy` × `codex-plugin` (live seats; repo `.claude/skills/impeccable/agents/*.toml` are the repo twins) |
| `~/.codex/AGENTS.md` L5-10 | md generated block | doctrine, sibling of `~/.claude/CLAUDE.md` |
| `~/YeeBois/workstation-apps/CLIProxyAPI/DANKSTATION.md` | md generated block (smoke-test curl body) | `deprecated.routable` |

Opt-in, decided per role later (other products' configs, not agent routing):
`~/.config/semantica/runtime.env` (lab LLM lanes), `~/.config/muse/settings.json`,
`~/.claude-mem/settings.json`. Frozen: `~/.codex/memories/**`, `~/data-home/beep-handoffs/**`,
JetBrains scratches, `*.bak*`, `~/.local/state/**`, `~/agent-tools/*.txt`, plugin state dirs.
Matcher must suppress `--model-root`/`--model_pose` (Omoide ONNX weights) and skip
`~/YeeBois/dev/**` third-party clones.

New surface implied: `jetbrains-codex` (effort expressed as display labels). Surfaces list
becomes: `codex-cli`, `codex-plugin`, `proxy-workflow`, `cursor-seat`, `grok-cli`,
`claude-code`, `jetbrains-codex`.

## Known live conflicts the first `check` must surface

- Codex heavy effort: repo AGENTS.md `medium` vs `~/.claude/rules/working-style.md` and `~/.zshrc` claudex `xhigh`.
- `defaultJSDocMigrateTitlesModel = "grok-4.5"` (stale; grok-4.6 / 4.7 exist).
- JSDoc examples still show `gpt-daybreak-blue-latest` for QaJudgeRef.
- `gpt-5.6-terra` present in codex cache, absent from all doctrine (candidate, not a binding).
- Codex effort has THREE answers across four sources: `medium` (repo AGENTS.md, `~/.codex/config.toml`), `xhigh` (`~/.codex/AGENTS.md`, working-style.md, zshrc claudex, `~/.agents` impeccable seats), `high` (JetBrains Air codex config).
- Codex model: `gpt-6-astra` in `~/.codex/config.toml` vs `gpt-5.6-sol` in both CodexLauncher.xml files and JetBrains Air config.
- `~/.grok/config.toml` pins grok effort `xhigh`; doctrine has no grok effort pin at all.
