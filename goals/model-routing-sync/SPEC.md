# Model Routing Sync Spec

## Objective

Make one operator-owned manifest the truth for which model and effort each agent role uses on each
surface, and project it into every repo and `$HOME` file that hardcodes a model id today. Grilled
2026-09-22 (`research/2026-09-22-00-aligned-design.md`, rulings R1–R12); there is no source
exploration packet — the four evidence reports in `research/` are the primary corpus.

## Non-Goals

- Auto-binding a newly published model. The tool proposes; the operator edits the manifest (R2).
- A committed repo snapshot of the upstream catalog, or a `data-sync`-style PR bot (R6).
- A new workspace package. `beep models` lives in `@beep/repo-cli` (R5).
- Writing agent memory files, gold fixtures, `packages/**/test/**` parsing fixtures, or packet prose
  (R11).
- Product inference defaults (`claude-haiku-4-5` in the Anthropic driver and `FilingDecisionLlm`).
  Those are a different pool and stay out of the manifest (R11).

## Source Hierarchy

1. `AGENTS.md` (repo laws) and `standards/ARCHITECTURE.md`.
2. `research/2026-09-22-00-aligned-design.md` — the 12 rulings, roles, and non-negotiables. Cite as
   `(Rn)`.
3. `research/2026-09-22-0{1,2,3,4}-*.md` — catalog facts, existing `repo-cli` sync machinery, the
   repo/user surface census, and the `$HOME` sweep.
4. `packages/tooling/tool/cli/src/commands/SyncDataToTs/`,
   `packages/tooling/tool/cli/src/commands/VersionSync/`, and
   `packages/tooling/tool/cli/src/internal/systemd/SystemdUnit.ts` — the RunMode, updater, and
   home-as-parameter idioms the implementation reuses.

## Domain Model

**Roles** (15 census concepts collapsed to manifest roles): `orchestrator`, `codex.heavy`,
`child.lightweight`, `research.web`, `cursor.volume`, `cursor.review`, `cursor.mechanical`,
`cursor.never` (deny list), `qa.judge`, `graft.deep`, `research.routine`, `jsdoc.migrate-titles`,
`deprecated.routable` (aliases such as `gpt-daybreak-blue-latest` kept routable by local
`oauth-model-alias` config and invisible to the upstream catalog).

**Surfaces**: `codex-cli`, `codex-plugin`, `proxy-workflow`, `cursor-seat`, `grok-cli`,
`claude-code`, `jetbrains-codex` (R10 plus the home sweep).

**Effort domains** are per surface: catalog `thinking.levels` for `proxy-workflow` (no `ultra`); the
`~/.codex/models_cache.json` ladder for `codex-cli` and `codex-plugin`; baked into the id for
`cursor-seat`; display labels ("Extra High") for `jetbrains-codex`, which needs an effort label map.

**Layered catalog** (R1): existence and `thinking.levels` come from the upstream manifest; three
availability overlays narrow it — the Codex cache, `cursor-agent models`, and the proxy
`GET /v1/models` admitted-auth filter. A binding is **valid** only when the id exists in the catalog
**and** is routable on this box for its surface. Never gate on `/v1/models` alone: it omitted
`gpt-6-astra` on 2026-09-22.

**Propose-only diff** (R2): each run diffs the catalog against the last snapshot (added / removed /
levels-changed) and flags bindings whose id vanished. The catalog has no deprecation field and
removals are hard deletes, so the tool keeps its own **superseded ledger** of retired ids.

## Target Surfaces

Locator strategy is per format; every rewrite is line-anchored and idempotent.

### Repo targets

| Target | Locator | Binding |
| --- | --- | --- |
| `AGENTS.md` volume-pools section | md generated block | `codex.heavy`, `cursor.*`, `child.lightweight` |
| `docs/runbooks/agent-pools.md` seat table | md generated block | `cursor.volume/review/mechanical/never` |
| `docs/runbooks/graft-local-recovery.md` | md generated block | `graft.deep` |
| `.claude/skills/browser-qa-loop/SKILL.md`, `resources/judge-prompt.md` | md generated block | `qa.judge` |
| `.claude/skills/oracle/SKILL.md` | md generated block | `codex.heavy` |
| `.claude/skills/impeccable/agents/*.toml` | toml top-level key (`model`, `model_reasoning_effort`) | `codex.heavy` x `codex-plugin` |
| `.../Quality/internal/JSDocMigrateTitles.ts:108` | ts-literal | `jsdoc.migrate-titles` |
| `.../Qa/JudgePack.ts:935` | ts-literal | `qa.judge` |
| 19 JSDoc examples (Qa, Yeet, Docgen) | ts-literal | cosmetic; docgen ratchet is the risk |

### Home targets

| Target | Locator | Binding |
| --- | --- | --- |
| `$HOME/.claude/CLAUDE.md`, `$HOME/.claude/rules/working-style.md`, `$HOME/.codex/AGENTS.md` | md generated block | doctrine |
| `$HOME/YeeBois/workstation-apps/CLIProxyAPI/DANKSTATION.md` | md generated block (+ curl body) | `deprecated.routable` |
| `$HOME/.codex/config.toml`, `$HOME/.config/JetBrains/Air/.codex/config.toml` | toml top-level key | `codex.heavy` x `codex-cli` |
| `$HOME/.grok/config.toml` `[models]` | toml table key | `research.web` x `grok-cli` |
| `$HOME/.cli-proxy-api/config.yaml` | yaml path | proxy posture (read-mostly) |
| `$HOME/.claude/settings.json` `model`, `$HOME/.claude-mem/settings.json` (opt-in) | json key | `orchestrator` |
| `$HOME/.config/beep-graft/env` `GRAFT_MODEL` | env key | `graft.deep` |
| `$HOME/.zshrc` claudex/claudeg/claudep args | shell-assign (`--model`, `effortLevel`, `ANTHROPIC_DEFAULT_HAIKU_MODEL`) | several |
| `$HOME/.config/JetBrains/WebStorm2026.{2,3}/options/CodexLauncher.xml` | xml attribute | `codex.heavy` x `jetbrains-codex` |
| `$HOME/.config/JetBrains/RustRover2026.{1,2}/options/DefaultAgentRollout.xml` | xml-escaped-json attribute | `codex.heavy`, `child.lightweight` |
| `$HOME/.agents/skills/impeccable/agents/*.toml` (4) | toml top-level key | `codex.heavy` x `codex-plugin` |

Never touch `[tui]` / `[notice]` in any Codex config, the machine-appended `[projects.*]` tail of the
JetBrains Air config, or any CLI-managed cache.

## Manifest, Ledger, Modes

- Manifest: `$HOME/.config/beep/models.yaml` — the operator truth. Repo files are projection targets
  reached via `--repo <path>` (R3). Manifest paths are written `$HOME/…`, never an absolute home.
- Ledger and dated catalog snapshots: `$HOME/.local/state/beep/models/` (R6).
- Modes: `check` (default), `dry-run`, `write`. `write` copies each touched home file into
  `$HOME/.config-backups/` first, is idempotent, and returns `changed`. Repo targets refuse to write
  on a dirty checkout of the touched files.
- `home` is always a parameter, never `os.homedir()` at a call site.
- `beep lint model-ids` flags superseded ids **outside** generated blocks; it excludes `research/`,
  `explorations/`, `goals/`, `**/test/**`, and `$HOME/.claude/memory` (R4, R11).
- Alerting: a daily `systemd --user` timer rendered by `beep models install-timer` runs
  `beep models check`; drift fires a critical Plasma notification and writes the report file
  (GraftDeep idiom; runbook `docs/runbooks/systemd-timers.md`) (R8).
- A `$HOME/.local/bin/beep-models` shim runs the command from the main clone with `--repo`
  defaulted (R5).
- Schema-first: schemas -> `Context.Service` contract -> implementation. `LiteralKit` for roles,
  surfaces, providers, and effort levels. `HashMap`/`HashSet` only.
- The matcher suppresses `--model-root` / `--model_pose` (Omoide ONNX weights) and skips
  `$HOME/YeeBois/dev/**` third-party clones.

## Acceptance Criteria

**Slice 1 (the only slice this packet's `GOAL.md` launches):**

- The schemas decode the live upstream `models.json`, `$HOME/.codex/models_cache.json`, and
  `cursor-agent models` output without loss.
- `beep models check` prints drift for every declared target, including the four known conflicts
  below, and exits non-zero on drift.
- No projection write: no `--write` path exists yet, so no declared target is ever mutated
  (R12). The slice's only writes are the R6 catalog ledger under
  `$HOME/.local/state/beep/models/`, the optional `--report-dir` output
  (`models-report.json` / `models-report.md`), and the `init` seed manifest, which refuses to
  overwrite an existing one.

**Slice 2:** `--write` lands with `$HOME/.config-backups/` backups, idempotent rewrites, the
dirty-checkout refusal, and the one-time prose rewrite that adopts generated blocks. It requires
operator ratification of **one** Codex effort value first.

**Slice 3:** `beep lint model-ids` is registered, the daily timer installs, and the shim lands.

## Known live conflicts the first `check` must surface

- Codex heavy effort: repo `AGENTS.md` `medium` vs `$HOME/.claude/rules/working-style.md` and
  `$HOME/.zshrc` claudex `xhigh`.
- `defaultJSDocMigrateTitlesModel = "grok-4.5"` (stale; grok-4.6 / 4.7 exist).
- JSDoc examples still show `gpt-daybreak-blue-latest` for `QaJudgeRef`.
- `gpt-5.6-terra` present in the Codex cache, absent from all doctrine (candidate, not a binding).
- Codex effort has three answers across four sources: `medium` (repo `AGENTS.md`,
  `$HOME/.codex/config.toml`), `xhigh` (`$HOME/.codex/AGENTS.md`, `working-style.md`, `$HOME/.zshrc`
  claudex, the `$HOME/.agents` impeccable seats), `high` (JetBrains Air Codex config).
- Codex model: `gpt-6-astra` in `$HOME/.codex/config.toml` vs `gpt-5.6-sol` in both
  `CodexLauncher.xml` files and the JetBrains Air config.
- `$HOME/.grok/config.toml` pins grok effort `xhigh`; doctrine has no grok effort pin at all.

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires unnamed credentials, cost, destructive side effects, or policy approval.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

None yet.
