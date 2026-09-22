# Slice 1 — service contracts (`beep models`)

Design order: schemas (done: `commands/Models/Models.{catalog,manifest,report}.schemas.ts`) →
these `Context.Service` contracts → implementation. Rulings cited as (Rn) from
`research/2026-09-22-00-aligned-design.md`. Slice 1 is read-only: `check`, `catalog`, and
`init` (which only creates a manifest that does not yet exist). No `--write` path (R12).

## Files (role topology, `07-non-slice-families.md`)

| File | Role |
| --- | --- |
| `Models.command.ts` | `beep models` group: `check` (default), `catalog`, `init`; flags `--home <dir>` (default `$HOME` via `Config`), `--repo <dir>` (default: cwd checkout root), `--manifest <path>` (default `$HOME/.config/beep/models.yaml`), `--json`, `--report-dir <dir>`, `--offline` (skip the upstream fetch and assemble from the local overlays alone). |
| `Models.errors.ts` | one `ModelsCommandError` at the boundary; internal tagged errors `ModelsCatalogError`, `ModelsManifestError`, `ModelsLocatorError`, `ModelsLedgerError` (S.TaggedError). |
| `Models.service.ts` | the contracts below + default live layers. Split into `Models.catalog.service.ts` / `Models.locator.service.ts` only if `Models.service.ts` passes ~500 lines. |
| `Models.render.ts` | pure: expected value for a (binding, field, render): `model` → id; `effort` → effort (or display label via `effort-display-label`); `model-effort-suffix` → `id(effort)`. Also the md generated-block renderer (table of bindings + `superseded:` list between `<!-- beep-models:begin blockId -->` / `<!-- beep-models:end blockId -->`). |
| `Models.diff.ts` | pure: `diffSnapshots(previous, next): CatalogDiff`; `mergeLayers(...)` → `Array<CatalogModel>`. |
| `Models.seed.ts` | the seed manifest `init` writes: the census bindings (R7, R9, home-sweep table) and targets with locators, paths written `$HOME/…`. |
| `index.ts` | facade: command, public schemas, `ModelsCommandError`, service contracts. |

## Contracts

```ts
// I/O seam — everything that touches the network, a subprocess, or a file outside the manifest.
export class ModelsCatalogSources extends Context.Service<ModelsCatalogSources, {
  readonly fetchUpstream: Effect.Effect<UpstreamCatalog, ModelsCatalogError>           // GET models.router-for.me, fallback raw.githubusercontent (R1)
  readonly readCodexCache:  (home: string) => Effect.Effect<Option.Option<CodexModelsCache>, ModelsCatalogError>
  readonly readGrokCache:   (home: string) => Effect.Effect<Option.Option<GrokModelsCache>, ModelsCatalogError>
  readonly listCursorModels: Effect.Effect<Option.Option<CursorModelList>, ModelsCatalogError>   // `cursor-agent models`; None when the binary is absent
  readonly listProxyModels: (baseUrl: string, tokenPath: string) => Effect.Effect<Option.Option<ProxyModelsResponse>, ModelsCatalogError> // None when the proxy is down or the token file is missing; never log the token
}>()("@beep/repo-cli/Models/CatalogSources") {}

// Layered catalog (R1). Upstream required unless `offline`; overlays degrade to "source absent".
export class ModelsCatalog extends Context.Service<ModelsCatalog, {
  readonly snapshot: (options: { home: string; offline: boolean }) => Effect.Effect<CatalogSnapshot, ModelsCatalogError, ModelsCatalogSources | ModelsLedger>
}>()("@beep/repo-cli/Models/Catalog") {}

// Dated snapshots under `$HOME/.local/state/beep/models/` (R6): `<ISO>-<sha8>.json`, plus `latest.json`.
export class ModelsLedger extends Context.Service<ModelsLedger, {
  readonly latest: (home: string) => Effect.Effect<Option.Option<CatalogSnapshot>, ModelsLedgerError>
  readonly record: (home: string, snapshot: CatalogSnapshot) => Effect.Effect<string, ModelsLedgerError>   // returns written path; no-op when sha matches latest
}>()("@beep/repo-cli/Models/Ledger") {}

// Operator manifest (R3). YAML via the `yaml` dependency; decode with S.decodeUnknownEffect(ModelsManifest).
export class ModelsManifestStore extends Context.Service<ModelsManifestStore, {
  readonly load: (path: string) => Effect.Effect<ModelsManifest, ModelsManifestError>
  readonly init: (path: string, manifest: ModelsManifest) => Effect.Effect<string, ModelsManifestError>   // fails ManifestExists if present
}>()("@beep/repo-cli/Models/ManifestStore") {}

// Read the CURRENT value a locator points at. One reader per Locator tag; slice 1 is read-only.
export class ModelsLocatorReader extends Context.Service<ModelsLocatorReader, {
  readonly read: (file: { root: TargetRoot; absolutePath: string; content: string }, locator: Locator) => Effect.Effect<Option.Option<string>, ModelsLocatorError>
}>()("@beep/repo-cli/Models/LocatorReader") {}

// Orchestration: manifest + catalog + diff + drift → report.
export class ModelsCheck extends Context.Service<ModelsCheck, {
  readonly run: (options: { home: string; repo: string; manifestPath: string; offline: boolean }) => Effect.Effect<ModelsCheckReport, ModelsCommandError, ModelsCatalog | ModelsLedger | ModelsManifestStore | ModelsLocatorReader | ModelsCatalogSources | FileSystem | Path>
}>()("@beep/repo-cli/Models/Check") {}
```

## Reader rules per locator tag (read-only)

- `md-generated-block`: content between the begin/end markers for `blockId`; `None` when markers absent → finding `missing-locator`. Expected = rendered block body (`Models.render.ts`).
- `toml-top-level-key`: first `^key\s*=` line before the first `[table]` header; value unquoted. `toml-table-key`: same inside `[table]` until the next header. (The `toml` dependency is parse-only; readers work on lines so a future writer can be line-anchored.)
- `yaml-path`: `yaml` lib `parseDocument` + `getIn(path)`. `json-key`: JSON pointer walk. `env-key`: `^KEY=` line. `shell-assign`: `variable` assignment (`--model 'x'` counts: treat `variable` as the flag/var name and match `name[= ]['"]?value`) optionally scoped to the function whose name is `within` (`name() {` … matching `}` at column 0).
- `xml-attribute`: `fast-xml-parser` with attributes on; `elementSelector` = `tag[name="…"]` minimal form. `xml-escaped-json-attribute`: same, then JSON.parse the attribute, then pointer.
- `ts-literal`: `export const <symbol> = "…"`.

## Drift rules

For every target × locator: resolve binding by (role, surface) → `unknown-model` when the binding's model is not in the catalog for that surface (cursor-seat: cursor list; codex-cli/codex-plugin/jetbrains-codex: codex cache; grok-cli: grok cache; proxy-workflow: upstream ∧ proxy availability; claude-code: upstream `claude` section) — availability absent (overlay `None`) is NOT drift, report it in the catalog summary instead; `invalid-effort` when effort ∉ `SurfaceEffortDomain[surface]` or field needs an effort the binding lacks; `missing-file` when the target file is absent and `optional=false`; `missing-locator`; `stale` when current ≠ expected. `hasDrift` = any finding. Exit code 1 on drift in `check`, 0 otherwise; `--json` prints the encoded `ModelsCheckReport`.

## Seed manifest (R7, R9, home sweep)

Bindings (surface → model / effort): codex.heavy × codex-cli gpt-6-astra/medium; codex.heavy × codex-plugin gpt-6-astra/medium; codex.heavy × proxy-workflow gpt-6-astra/medium; codex.heavy × jetbrains-codex gpt-6-astra/medium; codex.plan × codex-cli gpt-6-astra/xhigh; child.lightweight × proxy-workflow gpt-5.6-luna; research.web × grok-cli grok-4.6/xhigh; research.web × proxy-workflow grok-4.6; orchestrator × claude-code claude-fable-5-1; cursor.volume × cursor-seat composer-2.5; cursor.review × cursor-seat claude-opus-5-thinking-high; cursor.mechanical × cursor-seat composer-2.5; qa.judge × codex-plugin gpt-6-astra/medium; graft.deep × proxy-workflow claude-opus-5; jsdoc.migrate-titles × grok-cli grok-4.6; deprecated.routable × proxy-workflow gpt-daybreak-blue-latest. Superseded: gpt-5.6-sol (replacedBy gpt-6-astra), gpt-daybreak-blue-latest kept routable (not superseded), grok-4.5 (replacedBy grok-4.6), gpt-5.4, gpt-5.4-mini.

Targets: the home rows of R7 + the sweep table, and the repo rows of R9, each with the locator strategy named there. The seed encodes the effort the OPERATOR ratified as `medium` for codex-cli; `check` will therefore surface every `xhigh`/`high` copy as `stale` — that is the intended first run (design file "Known live conflicts").

## Tests (`packages/tooling/tool/cli/test/models-*.test.ts`, `@beep/repo-cli` aliases)

- Fixtures under `test/fixtures/models/`: 20-entry `models.json` excerpt (3 sections incl. `thinking.levels`), codex cache excerpt (`slug`, ladder incl. `ultra`), grok cache excerpt (object keyed by id), cursor list text, proxy `/v1/models` JSON, a manifest YAML, and one sample file per locator tag.
- `ModelsCatalogSources` test layer serving fixtures; assert merge (origin/provider/availability), diff (added/removed/levelsChanged), ledger round-trip in a temp dir under the scratchpad (never `/tmp`), every reader tag, drift kinds, and the report JSON encode/decode round-trip.
- No network, no subprocess, no `$HOME` in tests: `home` is always a parameter.

## Registration and gates

Register `modelsCommand` in `commands/Root.ts` and `src/index.ts` next to `syncDataToTsCommand`; run `bun run beep tsconfig-sync`, `bun run beep lint package-scripts --write`, `bun run beep lint policy`, `bun run beep lint schema-first`, `bun run beep lint schema-catalog --write` (fold only the Models rows — if the regenerated catalog carries unrelated churn, report it and leave it), `bun run docgen:local`, then `bun run beep quality package-verify @beep/repo-cli --quick`. Attribute any red as introduced / inherited before fixing.
