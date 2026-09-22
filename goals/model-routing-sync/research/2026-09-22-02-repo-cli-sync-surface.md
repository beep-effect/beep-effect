# repo-cli sync surface — grounding a model-id sync mechanism
Read-only exploration, 2026-09-22, beep-effect @ `18b5c64175`. Paths repo-relative.

## 0. Headline findings

1. **There is no `config-sync` command.** The command tree registers `tsconfig-sync`,
   `version-sync`, and `sync-data-to-ts` — `packages/tooling/tool/cli/src/commands/Root.ts:38-41`.
   `config-sync` appears nowhere in the repo.
2. **`version-sync` has no manifest.** Sources of truth and targets are hardcoded in
   per-category TypeScript resolver modules. It is not extensible by data.
3. **`sync-data-to-ts` IS the manifest-shaped command** — a target registry
   (`targets/index.ts`), a schema-backed `SyncDataTargetMetadata`, an `acquire` effect
   per target, canonical-JSON diffing, and `check`/`dry-run`/`write` modes. It is the
   closest existing architecture to what a model-id sync wants.
4. **Every one of the three resolves targets against `repoRoot`.** No sync command can
   write outside the repo today. The only CLI code that writes under `$HOME` is the
   systemd unit installer (`src/internal/systemd/`) and `@beep/ai-metrics` state.
5. **The "watch upstream → open a PR" pattern already exists and is proven**:
   `.github/workflows/data-sync.yml` (cron + `sync-data-to-ts --all --report-dir` +
   `peter-evans/create-pull-request`). No renovate/dependabot config exists in the repo.
6. **`@beep/ai-sync` is an agent-harness config *schema* synchronizer, not a model-id
   synchronizer.** It tracks upstream JSON Schemas for Codex/Claude Code/MCP/ACP by URL +
   version pin + sha256, and never touches `$HOME`.

---

## 1. `version-sync` — architecture

Entry: `packages/tooling/tool/cli/src/commands/VersionSync/VersionSync.command.ts:50`
(`Command.make("version-sync", …)`), delegating to
`internal/Handler.ts:29` `handleVersionSyncProgram`.

**Sources of truth / targets: hardcoded modules, not config.**
Seven resolvers under `internal/resolvers/` (`BiomeResolver.ts`, `BunResolver.ts`,
`DockerResolver.ts`, `EffectResolver.ts`, `NodeResolver.ts`, `RootCatalog.ts`,
`TurboResolver.ts`, 3267 LOC total incl. services/updaters). Categories are a
`LiteralKit` union (`VersionSync.schemas.ts:80` `VersionCategory`) with one tagged
report class per category (`VersionCategoryReportBun` … `…Turbo`,
`VersionSync.schemas.ts:205-317`, unioned at `:317-330` via `S.toTaggedUnion("category")`).
Adding a category = adding a resolver module + a schema class + a CLI `--x-only` flag
(`VersionSync.command.ts:67-84`) + a `CategorySelectionService` entry. **Not data-driven.**

**Target file paths are literals inside resolvers:**
- `internal/resolvers/BunResolver.ts:372` `.bun-version`, `:378` `package.json`,
  `:388` `apps/oip-web/vercel.json`, `:408` `.bun-linux-x64.sha256`
- `internal/resolvers/NodeResolver.ts:141` `.nvmrc`, `:147` `.github/workflows`
- `internal/resolvers/BiomeResolver.ts:131` `biome.jsonc`
- `internal/resolvers/DockerResolver.ts:335` `docker-compose.yml`
- `internal/resolvers/RootCatalog.ts:121` `package.json`, `:175` `bun.lock`

All join against `repoRoot` from `findRepoRoot()` (`internal/Handler.ts:30`).
**Targets cannot be outside the repo root.**

**Upstream sources CAN be HTTP.** The handler's requirement set includes
`HttpClient.HttpClient` (`internal/Handler.ts:69-73`). Live upstreams:
`BunResolver.ts:83` `https://api.github.com/repos/oven-sh/bun/releases/latest`,
`:483` `SHASUMS256.txt`; `DockerResolver.ts:228` Docker Hub tags API;
`EffectResolver.ts:91` `pkg.pr.new`. `--skip-network` (`VersionSync.command.ts:62`)
disables upstream resolution. **No external-git-repo source.**

**Rewrite strategy: structured, format-aware, comment-preserving** —
`internal/updaters/`: `YamlFileUpdater.ts` (eemeli/yaml `parseDocument` + `doc.setIn` +
`toString`, path-addressed via `yamlPath: S.Array(S.Union([S.String, S.Finite]))`,
`VersionSync.schemas.ts:532-535`), `PackageJsonUpdater.ts`, `JsoncSchemaUpdater.ts`,
`VercelJsonUpdater.ts`, `PlainTextUpdater.ts` (whole-file replace; returns `false` when
already correct — `PlainTextUpdater.ts:33-42`). **No Markdown updater. No regex rewriting.**

**Drift vs write.** `resolveMode` (`VersionSync.command.ts:26-32`) maps flags to a
`RunMode` union; `check` is the default and fails with `VersionSyncDriftError`
(`internal/Handler.ts:41-48`), `write` applies, `dry-run` reports only
(`internal/Handler.ts:50-54`). **No baseline file** (unlike the jsdoc/coverage ratchets).

**Tests:** `packages/tooling/tool/cli/test/version-sync-effect.test.ts` (991 lines).

---

## 2. `config-sync` — does not exist

Nearest neighbours:
- `commands/TsconfigSync/` — `TsconfigSync.plan.ts` plans managed tsconfig, alias,
  docgen and syncpack files across the workspace. Repo-internal derivation; no upstream.
- `commands/Skills/Skills.command.ts:32-34` — `.claude/skills` and `.codex/config.toml`
  are **repo-relative** constants; the skills updater edits the repo's own `.codex/config.toml`
  skills table, not `~/.codex/config.toml`.

So "extend config-sync" is not an option; the question is really "extend `tsconfig-sync`
or `sync-data-to-ts`".

---

## 3. `sync-data-to-ts` — the manifest-shaped precedent

Entry: `commands/SyncDataToTs/SyncDataToTs.command.ts` (588 lines).
Registry: `commands/SyncDataToTs/targets/index.ts` — `syncDataTargets = [iso4217Target,
iso3166Target, ianaMediaTypesTarget, ianaTimezonesTarget, cldrTerritoriesTarget,
reportersDbTarget, courtsDbTarget, vocabTermsTarget] as const`.

**Declared target contract** (`SyncDataToTs.schemas.ts`):
```
SyncDataTargetMetadata  (:161)  { access, description, id, sourceUrls }
SyncDataTarget          (:292)  extends metadata + { acquire: Effect<SyncDataTargetProjection, …, SyncDataTargetServices> }
SyncDataTargetProjection(:244)  { files: SyncDataOutputFile[], canonicalPath, canonical: S.Json,
                                  recordCount, summary, sources: SyncDataSourceMetadata[] }
SyncDataSourceMetadata  (:195)  { id, url, sha256, version?, published? }
SyncDataTargetServices  (:273)  HttpClient | Crypto | FileSystem | Path
```
A target is a **code module that returns rendered file contents** — `outputPath`/
`canonicalPath` are per-target `as const` literals (e.g. `targets/Iso4217.ts:31-32`,
source URL at `:40`). Shared helpers in `internal/Source.ts`: `fetchSource` (`:226`,
HTTP GET + sha256), `sourceMetadata` (`:182`), `outputFile` (`:161`), `parseXmlSource`,
`normalizeJson`, `formatTsLiteral`, `formatTsDocCommentValue`.

**Diff/write mechanics** (`SyncDataToTs.command.ts`):
- `diffCanonical` (`:219`) produces a `JsonPatch` against the checked-in canonical JSON
  sidecar via `S.toDifferJsonPatch(S.Json)` (`:57`) — structural drift, not text diff.
- `syncOutputFile` (`:238`) resolves `path.resolve(repoRoot, file.path)` — **repo-rooted**,
  compares whole-file content, writes only in `write` mode.
- Modes: `--check` / `--dry-run` / default write (`:73-83`), mutually exclusive (`:67`).
- `--report-dir` (`:53`) emits `data-sync-report.md` + `.json` — consumed by CI to build
  the PR body.
- `--include-authenticated` (`:35`) gates targets whose `access` is not `public`.

**Tests:** `packages/tooling/tool/cli/test/sync-data-to-ts.test.ts` (949 lines), with
`syncTargetForTesting` exported at `SyncDataToTs.command.ts:~300` as the seam.

---

## 4. `@beep/ai-sync` (`packages/tooling/library/ai-sync`)

**What it is:** a schema-first drift tracker for *agent-harness configuration schemas*.
- `src/models.ts:29` `AiSyncAgentId = LiteralKit(["claude-code","codex","grok-build",
  "jetbrains-ai-assistant","junie","mcp","acp","rulesync"])`;
  `:71` `AiSyncDomainId = ["skills","rules","commands","hooks","plugins","mcp-servers",
  "config","settings","plugin-manifest","marketplace","protocol","unified-config"]`.
- `src/source-map.ts:36+` `TIER_ONE_SOURCES` — a **declarative array** of
  `AiSyncSourceMetadata.make({ id, agent, domain, tier, url, versionPin, isOfficial,
  driftMechanism })`, e.g. `codex-config` pinned to
  `https://raw.githubusercontent.com/openai/codex/rust-v0.133.0/…/config.schema.json`
  (`:41-44`), `mcp-schema` (`:60-66`), `claude-code-settings` from schemastore
  (`:83-89`, `driftMechanism: "hash"`).
- `src/generator.ts` fetches + renders `src/_generated/schemas.gen.ts` and
  `src/_generated/source-metadata.gen.ts`; `src/drift.ts` compares committed generated
  artifacts against live upstreams (`drift.ts:23-32` resolves the **package** root, not `$HOME`).
- `scripts/ai-sync.ts` — `generate|refresh|check|drift|validate`, wired into the package's
  `beep:check` script (`package.json` `"beep:check": "… && bun run ai-sync check"`).
- `src/validation.ts:406` `validateRepoConfig`, `:449` `validateRepoSafetyPolicy`,
  `:490` `validateDogfoodConfig` — validates **the repo's** `.codex/config.toml`.

**Answers:** yes, it is a multi-agent-harness config synchronizer — but for *schemas*,
keyed by agent × domain. It carries **no model-id catalog**, and `grep -rn 'homedir|HOME'
src/ scripts/` returns **nothing**: it never touches user-level files. Its `source-map.ts`
array is nonetheless the best existing template for a declarative model-id source manifest.

---

## 5. "Watch upstream → open a PR" — existing mechanisms

| Mechanism | Entry point | Shape |
| --- | --- | --- |
| Monthly dataset sync PR | `.github/workflows/data-sync.yml` — cron `0 6 15 * *` + `workflow_dispatch`; runs `bun run beep sync-data-to-ts --all --include-authenticated --report-dir "$RUNNER_TEMP/data-sync-report"`, builds the PR body from `data-sync-report.md`, then `peter-evans/create-pull-request@v8.1.1` onto branch `automation/data-sync` | **The canonical pattern.** Copy this. |
| AI schema drift | `packages/tooling/library/ai-sync/scripts/ai-sync.ts` `drift --strict` | check-only, wired into `beep:check`; no PR automation |
| Nightly research | `bun run beep research install-timers` → `beep-research-daily.{service,timer}` (daily 21:00) rendered into `$HOME/.config/systemd/user/`; runbook `docs/runbooks/systemd-timers.md` | local systemd, machine-side scheduling |
| Graft deep refresh | `bun run beep graft deep install-timer --refresh` → `beep-graft-deep-refresh` nightly 02:30; model passed as `GRAFT_MODEL` env (`commands/Graft/GraftDeep.service.ts:145-146`) | local systemd, spends model quota |
| **renovate / dependabot** | **absent** — no `renovate.json`, no `.github/dependabot.yml` | n/a |

---

## 6. Out-of-repo paths and `$HOME` today

- **No `HomeDir` service exists.** `$HOME` is read ad hoc through `Config.String("HOME")`:
  `commands/Research/Research.command.ts:154,332`; `commands/Research/internal/Timers.ts:123`;
  `commands/Graft/Graft.command.ts:454`; `commands/Codex/Security.runtime.ts:47`;
  `commands/Yeet/internal/PrSessionRegistry.ts:193`; `commands/Qa/Doctor.ts:249`;
  `commands/Worktree/Fleet.service.ts:1239-1279` (`homeDirectory()` + `options.homeDir` override).
- **The one reusable home-path abstraction** is `src/internal/systemd/SystemdUnit.ts`:
  `:45` `resolveOperatorPath(input, home, resolve)` expands a leading `~/`;
  `:78` `resolveSystemdBunPath(home)` probes `SystemdBunCandidate` options under `home`;
  `:153` `systemdUserUnitDir(path, home)` → `<home>/.config/systemd/user`.
  `home` is always an explicit parameter, which makes it testable — the right shape to copy.
- `@beep/ai-metrics` resolves `${XDG_STATE_HOME:-$HOME/.local/state}/beep/…`
  (`src/data-root.ts:304,374`; `src/hook-pulse.ts:28`) and injects `HOME` in tests
  (`test/hook-pulse-writer.test.ts:234`) — the XDG precedent.
- Everything else (`Skills.command.ts:32-34` `.claude/skills`, `.codex/config.toml`;
  `Laws/EffectImports.ts:469`; `Quality/internal/CoverageScope.ts:79-95`) is **repo-relative**.
- The knowledge-refs gate classifies `host-path` refs (`Knowledge.refs.ts:71`
  `KnowledgeRefKind = ["repo-path","host-path","goal-uri","upstream"]`, `:125`
  `KnowledgeHostAnchor`) and `--check` fails on live host-path observations
  (`Knowledge.command.ts:378`) — i.e. the repo *discourages* absolute host paths in docs,
  which a model-sync manifest must respect (write `$HOME/…`, never `$HOME/…`).

---

## 7. A model-id lint/ratchet — reusable machinery

Today **zero** model-id validation exists. Model ids in repo source are bare string
literals with no shared catalog:
- `commands/Codex/Security.command.ts:181` `"gpt-6-astra"` (default model)
- `commands/Qa/JudgePack.ts:935` `--model gpt-6-astra --effort medium` (rendered into a prompt)
- `commands/Graft/GraftDeep.service.ts:145` `GRAFT_MODEL` env passthrough (no validation)
- tests: `test/graft-deep-refresh.test.ts:332,944,953,1433`;
  `test/codex-security-dispatch.test.ts:171`; `test/yeet-pr-provenance.test.ts:165`
  (`gpt-5.6-codex`); `ai-metrics/test/hook-pulse-writer.test.ts:578` (`composer-2.5`)
- `@beep/ai-metrics` stores `model` as a free-form string — **no `ModelId` schema, no
  normalizer, no catalog** (`grep 'ModelId|normalizeModel|MODEL' src/` → empty).

Docs surfaces: `AGENTS.md:18,21,25-28,40-43`; `docs/runbooks/agent-pools.md:14,20,22,
86-91,102,122,315,332,352` — plus ~30 packet files under `explorations/` and `goals/`
that AGENTS.md declares **immutable provenance** (AGENTS.md: "Historical reports,
captured user requests, completed-run provenance, and model-parsing fixtures retain the
models and effort levels they actually recorded"). **A model-id ratchet must scope to
AGENTS.md + docs/runbooks + src, and exclude research/goals/explorations history.**

Reusable pieces for such a lint:
- `commands/Lint/RoadmapRefs.ts:40-85` — the template for a docs-literal policy lint:
  a path constant, regex patterns, an `S.Class` finding (`RoadmapPolicyFinding`),
  and `makePolicyFindingLogger` from `src/internal/cli/PolicyFindingLogger.ts`.
- `Knowledge.refs.ts` exports `knowledgeDocumentLines` / `knowledgeLinkDestinations`
  (imported by `RoadmapRefs.ts:35`) — a shared Markdown line scanner over the
  `KNOWLEDGE_SCANNER_SCOPE` roots (`Knowledge.refs.ts:1168`).
- `@beep/md` (`packages/foundation/modeling/md`) — the AST-level Markdown model/renderer
  (`Md.model.ts`, `Md.render.ts`, `Md.safe.ts`), already used by
  `SyncDataToTs.command.ts:9`. This is the Markdown analogue of the YAML `setIn` updater.
- `bun run beep lint <name>` registration at `Lint.command.ts:1148-1170`.

---

## 8. Recommendation matrix

| Option | Pros (grounded) | Cons (grounded) | Verdict |
| --- | --- | --- | --- |
| **Extend `version-sync`** | Same problem shape (upstream truth → many pinned files); mature updaters for YAML/JSONC/package.json; `check`/`write`/`dry-run` already there | Zero declarative extensibility — each category is a bespoke resolver module + schema class + CLI flag (`VersionSync.command.ts:67-84`, `schemas.ts:205-330`); every path is `path.join(repoRoot, …)`; **no Markdown updater**, and model ids live mostly in Markdown; semantically it is "dependency pins", not "agent routing" | **No** |
| **Extend `tsconfig-sync`** | — | Purely repo-internal derivation from workspace layout; no upstream, no manifest | **No** |
| **Extend `sync-data-to-ts` with a `model-catalog` target** | Reuses the *entire* target registry + canonical-sidecar diff + report + the proven `data-sync.yml` PR workflow at near-zero cost; targets already carry `sourceUrls`/`access`/sha256 provenance | `syncOutputFile` hard-resolves `path.resolve(repoRoot, …)` (`:238`) — **cannot write `~/.zshrc`**; the command's identity is "official public datasets → generated TS", and model ids are operator policy, not an official dataset | **Partly** — use it for the *upstream catalog ingest* leg only |
| **New `beep models sync` subcommand** | Sits with `Knowledge`/`Skills`/`Research`, all of which already read `$HOME` via `Config.String("HOME")`; reuses `@beep/md`, `PolicyFindingLogger`, `RunMode`, the systemd `resolveOperatorPath`/home-as-parameter idiom | Only runnable via `bun run beep` from a checkout — the user explicitly wants a CLI usable anytime, not repo-scoped; and writing `~/.claude/CLAUDE.md` from a repo CLI couples operator config to a repo checkout | **Good, but only half the ask** |
| **New package `packages/tooling/tool/model-sync`** (own bin, installable, `beep-cli models` thin wrapper) | Matches the stated requirement (run anytime, touch user-level files); can take `--home` as an explicit parameter exactly like `SystemdUnit.ts` does, keeping it testable; keeps repo law (AGENTS.md drift) and operator dotfiles under one manifest with different *target roots*; `bun run beep create-package` is the mandated scaffold path | New package = new CI gates (`new-package-first-ci-governance-gates` memory), docgen, coverage baselines; duplicates some `sync-data-to-ts` machinery unless it imports a shared library | **Recommended** |

### Recommended shape

Split by leg, mirroring what already works:

1. **Ingest leg (repo, CI-owned).** A `sync-data-to-ts` target `model-catalog` whose
   `acquire` fetches the provider catalogs (the CLIProxyAPI model list, Cursor's models
   doc, the Codex/Anthropic model endpoints) and emits a generated TS module + canonical
   JSON sidecar. Reuse `fetchSource`/`sourceMetadata` (`internal/Source.ts:226,182`) for
   URL + sha256 provenance, and let `.github/workflows/data-sync.yml` open the PR — no
   new automation needed.
2. **Projection leg (new tool, operator-owned).** A standalone `model-sync` binary that
   reads the generated catalog + an alias/routing manifest and rewrites *targets*, with
   `--home` explicit, `--check`/`--dry-run`/`--write` mirroring `RunMode`.

### Minimal proposed schema (manifest → targets)

```ts
// source manifest — modelled on ai-sync's TIER_ONE_SOURCES (source-map.ts:36)
ModelSyncSource   { id, provider: LiteralKit(["anthropic","openai","xai","cursor","proxy"]),
                    url, versionPin: S.Option(S.String), sha256: Sha256Hex,
                    driftMechanism: LiteralKit(["hash","version_and_hash"]) }

// the routing fact being propagated — the ONE source of truth
ModelRole         LiteralKit(["orchestrator","volume","review","lightweight","research"])
ModelBinding      { role: ModelRole, surface: LiteralKit(["codex-cli","codex-plugin",
                    "workflow-child","cursor-seat","proxy-model","grok-cli"]),
                    modelId: ModelId, effort: S.Option(EffortLevel),
                    supersedes: S.Array(ModelId) }   // drives the stale-id lint

// target = root + file + locator strategy
ModelSyncRoot     LiteralKit(["repo","home"])        // home resolved via an explicit `home` param
ModelSyncLocator  TaggedUnion("strategy") {
  "md-inline-code": { bindingRef, // rewrite `…` spans whose old value ∈ supersedes
                      scope: S.Option(S.String) }     // heading/section anchor, via @beep/md AST
  "md-table-cell":  { bindingRef, table: String, row: String, column: String }
  "toml-key":       { pointer: S.Array(S.String) }    // ~/.codex/config.toml `model`
  "yaml-path":      { yamlPath: S.Array(S.Union([S.String, S.Finite])) }  // reuse YamlFileUpdater
  "shell-assign":   { variable: String }              // ~/.zshrc `--model '…'`
  "ts-literal":     { symbol: String }                // src defaults, e.g. Security.command.ts:181
}
ModelSyncTarget   { id, root: ModelSyncRoot, path: String,   // "$HOME/.zshrc" never "/home/<user>/…"
                    optional: Boolean,                        // a dotfile may not exist on a host
                    locators: S.Array(ModelSyncLocator) }
ModelSyncReport   { targets: [{ targetId, path, findings: [{ locator, current, expected }],
                    changed }], hasDrift }   // same $match(check|dry-run|write) as RunMode
```

Then a `beep lint model-ids` (registered at `Lint.command.ts:1148`) that scans
`AGENTS.md` + `docs/runbooks/**` for any `modelId ∈ supersedes` using
`knowledgeDocumentLines` and emits `PolicyFindingLogger` findings — **excluding**
`research/`, `goals/`, `explorations/`, and `**/test/**` fixtures, per AGENTS.md's
provenance-immutability rule.

### Non-negotiables the code already implies

- `home` is a **parameter**, never `os.homedir()` at a call site (`SystemdUnit.ts:45,78,153`).
- Manifest paths written as `$HOME/…` so `beep knowledge refs --check` stays green
  (`Knowledge.command.ts:378`; memory `knowledge-refs-gate-home-relative-paths`).
- Dotfile rewrites must be **idempotent and return `changed: boolean`**, the
  `PlainTextUpdater.ts:33` contract — never blind-write.
- A `--backup`/`~/.config-backups` step for user files: the repo already parks reverted
  user config there (memory `claude-desktop-3p-gateway-mode-reverted`).
- Never edit the user's global files unprompted (memory `astra-default-effort-medium`):
  default the new tool to `--check`, like `version-sync`.
