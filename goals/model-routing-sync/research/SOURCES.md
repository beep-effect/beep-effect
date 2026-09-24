# Sources

Primary corpus for this packet. There is no source exploration packet: the four evidence reports
below were produced by three Opus 5 exploration lanes plus a `$HOME` sweep on 2026-09-22, and the
grill the same day locked the 12 rulings in `2026-09-22-00-aligned-design.md`. Home paths are
written `$HOME/…`.

## Packet reports

| Report | Covers |
| --- | --- |
| [`2026-09-22-00-aligned-design.md`](./2026-09-22-00-aligned-design.md) | The 12 grilled rulings (R1-R12), roles, surfaces, non-negotiables, home-sweep additions, known live conflicts |
| [`2026-09-22-01-cliproxyapi-catalog.md`](./2026-09-22-01-cliproxyapi-catalog.md) | Catalog location, entry fields, `model(effort)` suffix grammar, proxy HTTP surfaces, change velocity, the consumable manifest |
| [`2026-09-22-02-repo-cli-sync-surface.md`](./2026-09-22-02-repo-cli-sync-surface.md) | `version-sync`, `tsconfig-sync`, `sync-data-to-ts`, `@beep/ai-sync`, the `$HOME` idiom, the recommendation matrix and proposed target schema |
| [`2026-09-22-03-surface-census.md`](./2026-09-22-03-surface-census.md) | Every repo and user surface carrying a model id, classified rewrite / prose / freeze; the 15 routing concepts |
| [`2026-09-22-04-home-sweep.md`](./2026-09-22-04-home-sweep.md) | New writable home targets, doctrine prose candidates, tool-managed and frozen paths, matcher false positives |

## Upstream catalog (R1)

| Source | Access | Disposition |
| --- | --- | --- |
| `https://models.router-for.me/models.json` | public HTTP, verified 200 on 2026-09-22 | primary: existence + `thinking.levels` |
| `https://raw.githubusercontent.com/router-for-me/models/refs/heads/main/models.json` | public raw | fallback for the same manifest |
| `github.com/router-for-me/CLIProxyAPI` `internal/registry/models/models.json` | local clone at `$HOME/YeeBois/dev/CLIProxyAPI` (v7.3.12) | embedded copy, verified identical by id — reference only, never parsed from Go |
| `github.com/router-for-me/CLIProxyAPI` `internal/registry/models/codex_client_models.json` | same clone | Codex CLI per-slug runtime knobs; reference |
| Vendored fork `$HOME/YeeBois/workstation-apps/CLIProxyAPI` (branch `dankstation/daybreak`) | local | carries the Daybreak builtin absent upstream; source of the `deprecated.routable` role |

## Availability overlays (R1)

| Source | Access | Disposition |
| --- | --- | --- |
| `$HOME/.codex/models_cache.json` | local cache, `client_version 0.153.4` | Codex slugs with `default_reasoning_level` / `supported_reasoning_levels` — the effort ladder for `codex-cli` and `codex-plugin` |
| `cursor-agent models` | existing Cursor login | ~230 seat ids with effort baked into the suffix — the `cursor-seat` domain |
| `GET /v1/models` on `http://127.0.0.1:8317` | local proxy | admitted-auth filter only; **never** the sole gate (it omitted `gpt-6-astra` on 2026-09-22) |
| `GET /v0/management/model-definitions/:channel` | local proxy, management auth | richest shape but 404 on this instance; reference only |
| `$HOME/.cli-proxy-api/config.yaml` | local | proxy posture (`routing.strategy`, `xai.inject-x-search`, `claude-header-defaults`); no alias/model table — routing is by model-id prefix |

## Repo files censused (R9)

| Path | Why it is in the ledger |
| --- | --- |
| `AGENTS.md` (== the `CLAUDE.md` symlink) | volume-pools doctrine; 10 ids |
| `docs/runbooks/agent-pools.md` | seat tables and never-list; 13 ids |
| `docs/runbooks/graft-local-recovery.md` | `GRAFT_MODEL` guidance; 11 ids |
| `docs/runbooks/codex-security.md` | one `gpt-6-astra` reference |
| `docs/runbooks/systemd-timers.md` | the timer install/refresh contract the alerting slice follows |
| `.claude/skills/browser-qa-loop/SKILL.md`, `.claude/skills/browser-qa-loop/resources/judge-prompt.md` | QA judge model + effort |
| `.claude/skills/oracle/SKILL.md` | Codex heavy model |
| `.claude/skills/impeccable/agents/*.toml` | `model` / `model_reasoning_effort` seats (repo twins of the `$HOME/.agents` copies) |
| `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocMigrateTitles.ts` (`:108`) | `defaultJSDocMigrateTitlesModel` — stale `grok-4.5` |
| `packages/tooling/tool/cli/src/commands/Qa/JudgePack.ts` (`:935`) | emitted next-step command pinning model + effort |
| `packages/tooling/tool/cli/src/commands/SyncDataToTs/`, `.../VersionSync/`, `packages/tooling/tool/cli/src/internal/systemd/SystemdUnit.ts` | the reused RunMode, updater, and home-as-parameter machinery |
| `apps/labs/semantica/fixtures/gold/**`, `packages/tooling/tool/cli/test/**`, `packages/drivers/**` | FROZEN (R11): gold provenance, parsing fixtures, vendor specs, product inference defaults |

## Home files censused (R7, home sweep)

| Path | Format | Role |
| --- | --- | --- |
| `$HOME/.claude/CLAUDE.md` | md generated block | the routing doctrine |
| `$HOME/.claude/rules/working-style.md` | md generated block | Codex delegation defaults (conflicts with repo `AGENTS.md`) |
| `$HOME/.codex/AGENTS.md` | md generated block | Codex-lane doctrine, sibling of `CLAUDE.md` |
| `$HOME/YeeBois/workstation-apps/CLIProxyAPI/DANKSTATION.md` | md generated block | vendor-build runbook + smoke-test curl body |
| `$HOME/.claude/settings.json` | json key | orchestrator model |
| `$HOME/.zshrc` (claudex / claudeg / claudep) | shell-assign | `--model`, `effortLevel`, `ANTHROPIC_DEFAULT_HAIKU_MODEL` |
| `$HOME/.codex/config.toml` | toml top-level key | `model`, `model_reasoning_effort`, `plan_mode_reasoning_effort` |
| `$HOME/.config/JetBrains/Air/.codex/config.toml` | toml top-level key | the SECOND live Codex config |
| `$HOME/.grok/config.toml` `[models]` | toml table key | grok default + effort |
| `$HOME/.config/beep-graft/env` | env key | `GRAFT_MODEL` |
| `$HOME/.config/JetBrains/WebStorm2026.{2,3}/options/CodexLauncher.xml` | xml attribute | display-label effort |
| `$HOME/.config/JetBrains/RustRover2026.{1,2}/options/DefaultAgentRollout.xml` | xml-escaped-json attribute | rollout model list |
| `$HOME/.agents/skills/impeccable/agents/*.toml` (4) | toml top-level key | live shared-skill seats |
| `$HOME/.config/semantica/runtime.env`, `$HOME/.config/muse/settings.json`, `$HOME/.claude-mem/settings.json` | env / json | OPT-IN later; other products, not agent routing |
| `$HOME/.codex/models_cache.json`, `$HOME/.cursor/cli-config.json`, `$HOME/.claude.json`, `[tui]`/`[notice]` blocks | — | tool-managed; never hand-edit |
| `$HOME/.codex/memories/**`, `$HOME/data-home/beep-handoffs/**`, `$HOME/.claude/memory/**`, `$HOME/.local/state/**`, `*.bak*`, JetBrains scratches | — | FROZEN (R11) |
