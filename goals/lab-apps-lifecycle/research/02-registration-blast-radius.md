# Lane 2: package registration blast-radius census

> **Historical (superseded 2026-08-29):** basic-memory + codegraph were removed from this
> repo and machine; see `standards/memory-architecture/04-decision-log.md`. Kept as a record.

Definitive prune list for a future `beep delete-package`. There is no
`delete-package` command today (repo-wide search of `*.ts` / `*.md` / `*.json`
returned zero hits).

This census treats **workspace membership** as the source of truth and then
lists every derived or authored surface that still names a package after
`create-package` / `beep architecture` / later quality syncs.

## Method

1. `git log --diff-filter=A --name-only -- '*/package.json'` to find recent
   workspace members.
2. Full file lists from:
   - `d9d647bd13` (`@beep/openclaw` scaffold)
   - `3dbf2d277b` (`@beep/openclaw` P1 land)
   - `16f22c079d` (`@beep/gov-legal-mcp`)
   - `343fc60735` (`@beep/shared-use-cases` plus candor closeout)
3. Cross-check every writer in
   `packages/tooling/tool/cli/src/commands/CreatePackage/` and the
   post-scaffold `syncTsconfigAtRoot` path.
4. Generalize by grepping `@beep/openclaw`, `@beep/gov-legal-mcp`,
   `@beep/shared-use-cases`, and a mature shared-kernel name
   (`@beep/schema` / `@beep/shared-domain`) through configs.

**ConfigUpdater.ts is not the whole create-package writer.** It only mutates
root tsconfig files. The live command also writes workspaces, identity,
lockfile, and then delegates derived config to `tsconfig-sync`.

---

## 0. What create-package actually writes

### 0.1 In-package scaffold (always)

`createPackageCommand` plans files from templates, writes `package.json`, and
symlinks `CLAUDE.md` → `AGENTS.md`
(`CreatePackage.command.ts:1271-1303`, `:1293-1298`).

Typical library files (`filesFor` / templates): `package.json`, `src/index.ts`,
`tsconfig.json`, `tsconfig.test.json`, `vitest.config.ts`, `docgen.json`,
`README.md`, `LICENSE`, `AGENTS.md`, `docs/index.md`, test gitkeep.

App variants (`VALID_APP_KINDS` at `CreatePackage.command.ts:120`):

| `--app-kind` | Extra surfaces |
| --- | --- |
| `nextjs` | `next.config.ts`, `src/app/*`, portless `dev` script |
| `tauri` | Vite + `src-tauri/**` (Cargo, capabilities, `tauri.conf.json`) |
| `runtime-proof` | library-like proof app (used by architecture-lab) |

`--type app` defaults `parentDir` to `apps`
(`CreatePackage.command.ts:1129`). There is **no** `apps/experiments` family,
glob, or `--family` value. `VALID_FAMILIES` is only
`drivers | ecosystem | foundation | tooling`
(`CreatePackage.command.ts:121`). Experiments would need
`--parent-dir apps/experiments` plus a new workspace glob, or an explicit
per-app workspace entry.

`package.json` `name` is always `@beep/${name}`
(`CreatePackage.command.ts:1447`). Slice packages use a **slug that is not
the directory name**: `@beep/shared-use-cases` lives at
`packages/shared/use-cases` (`packages/shared/use-cases/package.json:1-12`).
Architecture shells do the same via
`packageNameForRole` = `@beep/${boundedContext}-${role}` and
`pathForRole` = `packages/${boundedContext}/${role}`
(`RoleTopology.ts:183-214`). Identity registration uses the **package slug**,
not the folder name (`IdentityRegistration.ts:54`, `:156-163`).

Family metadata lands in `package.json#beep` only when `--family` is set
(`CreatePackage.command.ts:1603-1607`). Architecture shells do not write a
`beep` field (`OperationPlanPackageJson.ts:88-119`).

### 0.2 Root bootstrap (create-package, not ConfigUpdater)

After files exist (`CreatePackage.command.ts:1302-1315`):

1. `ensureRootWorkspaceEntry` — append to `package.json#workspaces` **only if
   no existing glob covers the path** (`:828-848`, `:833-835`).
2. `ensureIdentityPackageRegistration` — add compose segment + `$XxxId`
   export in `@beep/identity` (`:1306`,
   `IdentityRegistration.ts:144-164`).
3. `syncTsconfigAtRoot(repoRoot, { mode: "sync" })` — derived configs
   (`:1307-1311`).
4. `bun install --lockfile-only` unless `--skip-lockfile` (`:856-870`,
   `:1312-1315`).

Dry-run text is the contract: workspaces + identity are “root bootstrap”;
“shared sync” is “tsconfig references, aliases, syncpack, and docgen”
(`CreatePackage.command.ts:1190-1198`).

### 0.3 What ConfigUpdater.ts actually does

`ConfigUpdater.ts` is a **narrow, idempotent writer** used by tests and as
the documented “root tsconfig” helper. It does **not** run during the live
command’s post-scaffold path (the command calls `syncTsconfigAtRoot`
instead).

| Function | File | Write |
| --- | --- | --- |
| `updateTsconfigPackages` | `tsconfig.packages.json` | append `{ path: packagePath }` (`ConfigUpdater.ts:283-307`) |
| `updateTsconfigPaths` | `tsconfig.json` | `@beep/${name}` + `@beep/${name}/*` (`:334-372`) |

It does **not** remove stale entries. Removal lives in `tsconfig-sync`
(`TsconfigSync.plan.ts:625-641` for aliases; `:454-466` rewrites the whole
`references` array).

### 0.4 What tsconfig-sync writes (the real derived-config engine)

`syncTsconfigAtRoot` (`TsconfigSync.service.ts:99-131`) plans five sections
(`TsconfigSync.schemas.ts:574-579`):

| Section | File | Behavior |
| --- | --- | --- |
| `root-references` | `tsconfig.packages.json` | replace `references` with every workspace that has a project tsconfig (`TsconfigSync.plan.ts:447-474`) |
| `root-aliases` | `tsconfig.json` `compilerOptions.paths` | add/update **and delete** canonical `@beep/*` keys not owned by a live workspace (`:606-661`, `:625-641`) |
| `root-syncpack` | `syncpack.config.ts` `source: [...]` | rewrite from root workspace globs + `package.json` (`:680-700`, `:240-241`) |
| `package-references` | each package `tsconfig.json` | workspace dependency graph refs (`:814-928`) |
| `package-docgen` | each package `docgen.json` | managed fields only, if the file already exists (`:946-988`) |

**Implication for delete:** after the directory is gone and the workspace
entry is gone, `beep tsconfig-sync` is the correct cleaner for those five
surfaces. It will **not** clean identity, fallow, inventories, coverage
baselines, architecture prose, or CI hardcodes.

### 0.5 Architecture create is a second, thinner registrar

`beep architecture create slice|package` writes files via an operation plan
(`write-file` / `write-package-json` / `ensure-file` /
`ensure-absent-path` — `Architecture.schemas.ts:204-205`) then calls
`registerMissingWorkspaceIdentityPackages`
(`Architecture.command.ts:150-155`). It does **not** call
`ensureRootWorkspaceEntry`, `syncTsconfigAtRoot`, or lockfile refresh.
Slice packages under individually listed families (`packages/shared/*`,
`packages/agents/*`, …) therefore still need a manual or later-sync
workspace entry. `beep:preflight` is the human/yeet follow-up that
regenerates the rest (`package.json:362`).

---

## 1. Root `package.json` workspaces + `bun.lock`

### 1.1 Workspaces

`package.json:433-537` is a **mixed glob + explicit list**, not `apps/*` /
`packages/**`.

**Globs (create-package skips a new entry):**

- `infra`, `scratchpad`, `tools/tsgo-shim` (singletons)
- `packages/_internal/*`
- `packages/ecosystem/*`
- `packages/foundation/{capability,modeling,primitive,ui-system}/*`
- `packages/tooling/{library,policy-pack,test-kit,tool}/*`

**Explicit paths (create-package appends):**

- every `packages/drivers/<name>` (no `packages/drivers/*` glob)
- every slice role: `packages/{agents,epistemic,law-practice,documents,workspace,ontology,architecture-lab,shared}/<role>`
- every app: `apps/oip-web`, `apps/professional-desktop`, `apps/storybook`,
  `apps/architecture-lab-proof`, `apps/practice-kg-mcp`

`ensureRootWorkspaceEntry` matches globs by **equal segment count** with `*`
wildcards (`CreatePackage.command.ts:761-781`). `apps/experiments/foo` is
**not** covered by `apps/oip-web`. A new experiments tree either needs a
new glob `apps/experiments/*` or one explicit entry per app.

Traced writes:

- `@beep/openclaw` → `"packages/drivers/openclaw"` (`package.json:533`)
- `@beep/gov-legal-mcp` → `"packages/drivers/gov-legal-mcp"` (`:536`)
- `@beep/shared-use-cases` → `"packages/shared/use-cases"` (`:444`)

**Delete:** remove the explicit workspace string if present. Do **not**
invent a glob deletion. If the path was only covered by a glob, deleting
the directory is enough for bun; leftover derived configs are a separate
problem.

### 1.2 bun.lock

`refreshBunLockfile` runs `bun install --lockfile-only`
(`CreatePackage.command.ts:856-870`). The lockfile records:

- workspace path key: `"packages/drivers/openclaw": { "name": "@beep/openclaw", ... }`
  (`bun.lock:1049-1063`)
- alias: `"@beep/openclaw": ["@beep/openclaw@workspace:packages/drivers/openclaw"]`
  (`bun.lock:3277`)

**Delete:** delete the directory + workspace entry, then
`bun install --lockfile-only`. Do not hand-edit `bun.lock`.

### 1.3 Root catalog

`package.json:2` `catalog` is a **version catalog**, not a package
registry. Creating a package does not add a catalog key. Deleting a
package does not remove one unless that package was the last consumer of
a catalog-only dep (knip / fallow may then flag unused root deps).

### 1.4 Changesets ignore

`.changeset/config.json:13` ignores
`@beep/repo-cli`, `@beep/repo-utils`, `@beep/scratchpad`. Not
auto-updated. Only relevant if delete-package targets those names.

---

## 2. TypeScript project graph and aliases

### 2.1 Layering

| File | Role | Per-package write? |
| --- | --- | --- |
| `tsconfig.base.json` | compiler defaults + Effect language-service plugin (`:1-80`) | **No.** New packages `extends` it. |
| `tsconfig.packages.json` | solution-style `references` of every workspace with a project tsconfig (`:8-…`, e.g. `packages/drivers/gov-legal-mcp` at line 121, `openclaw` at 157, `shared/use-cases` at 352) | **Yes**, rewritten by tsconfig-sync. |
| `tsconfig.json` | root checker: `references: [{ path: "tsconfig.packages.json" }]` (`:4-7`) plus `compilerOptions.paths` (`:37-…`) | **Yes** for aliases. |
| per-package `tsconfig.json` | `extends` `tsconfig.base.json`; `references` to workspace deps | **Yes** (scaffold + tsconfig-sync). |
| `tsconfig.test.json` / `tsconfig.stories.json` / `tsconfig.scripts.json` | local only | scaffold / stories flag. |
| `apps/storybook/tsconfig.stories.json` | story host | **No** per new library unless stories are hosted. |

There is **no** per-family tsconfig (no `tsconfig.drivers.json`). Family
variance is path depth + `extends` relative path.

### 2.2 Alias shape

Canonical pair from exports:

```text
"@beep/openclaw": ["./packages/drivers/openclaw/src/index.ts"]
"@beep/openclaw/*": ["./packages/drivers/openclaw/src/*"]
```

(`tsconfig.json:1703-1704`; same for gov-legal-mcp at `:1811-1812`.)

Slice packages with extra `exports` get extra aliases. `@beep/shared-use-cases`
has root + `./public` + `./server` + `./PromotionGate`
(`tsconfig.json:1929-1937`, driven by
`packages/shared/use-cases/package.json:35-41` via
`buildPackageSubpathAliasTargets` in `TsconfigSync.plan.ts:517-529`).

`planRootAliasSync` **deletes** canonical keys whose workspace is gone
(`TsconfigSync.plan.ts:625-641`). After workspace + directory removal,
`beep tsconfig-sync` is sufficient for aliases.

### 2.3 Package-level references

tsconfig-sync writes `references` from the workspace dependency graph
(`TsconfigSync.plan.ts:844-910`). Delete-package must also strip
`workspace:^` deps from **survivors** (or run tsconfig-sync after editing
those manifests). Leaving a `@beep/deleted` `workspace:^` dep makes bun
install fail before sync can run.

**Create-package automates:** yes, via tsconfig-sync after scaffold.
**ConfigUpdater automates:** add-only, no removal, no per-package refs.

---

## 3. Turbo

`turbo.json` is **task-shaped, not package-shaped**. New workspaces are
discovered from bun workspaces; there is no package allowlist.

Relevant bits:

- `global.inputs` includes `package.json`, `tsconfig.json`,
  `tsconfig.base.json`, `tsconfig.packages.json` (`turbo.json:9-16`).
  Changing workspaces / aliases busts the whole graph.
- `global.passThroughEnv` includes `PORTLESS_*` (`:28`) — apps only.
- Tasks `build`, `lint`, `check`, `test`, `coverage`, `docgen`, `dev`
  (`:34-241`) use `$TURBO_DEFAULT$` + `!.beep/**`.
- `storybook*` / `test:storybook` hardcode
  `packages/foundation/ui-system/*/stories/**` (`:242-274`). A new
  story-bearing package is **not** a turbo cache input unless this glob
  is extended (graph-3d already is a storybook-main exception, not a
  turbo input).

Per-app `turbo.json` exists only for
`apps/professional-desktop/turbo.json` and `apps/storybook/turbo.json`
(local task overrides). Not created by create-package.

**Delete:** nothing in root `turbo.json` unless the package was a
hardcoded storybook input. Cache entries for the deleted filter die on
next prune; no committed turbo artifact names packages.

**Create-package automates:** no turbo edit (none needed).

---

## 4. `@beep/identity`

### 4.1 Where IDs live

Single registry file:

`packages/foundation/modeling/identity/src/packages.ts`

Re-exported from the package barrel (`identity/src/index.ts:81`
`export * from "./packages.ts"`).

There is no `packages/**/identity/**` per-workspace registry. Slice
`domain` packages may have an `identity/` **folder for entity IDs**, but
those consume `$<Slice>DomainId` from this file; they do not register
workspace composers.

### 4.2 What is written per package

1. A string segment in `$I.compose(...)` — the unscoped slug
   (`packages.ts:48-192`). Examples: `"openclaw"` (`:184`),
   `"gov-legal-mcp"` (`:188`), `"shared-use-cases"` (`:100`).
2. A typed export:
   `export const $OpenclawId: Identity.IdentityComposer<"@beep/openclaw"> = composers.$OpenclawId`
   (`:2321`); `$GovLegalMcpId` (`:2389`); `$SharedUseCasesId` (`:478`).

Accessor naming is `$${pascalCase(slug)}Id`
(`IdentityRegistration.ts:54`). Manual casing aliases exist only for
`$LangExtractId` → `$LangextractId` (`packages.ts:194-197`,
`IdentityRegistration.ts:201-202`).

Create-package writes **one package**. Architecture create and
`beep lint identity-registry --fix` call
`registerMissingWorkspaceIdentityPackages`, which walks **every**
`@beep/*` workspace (`IdentityRegistration.ts:301-321`,
`IdentityRegistry.ts:187-192`).

### 4.3 Who consumes them

Every package module that needs schema/service IDs imports
`$XxxId` from `@beep/identity/packages` (or the barrel) and does
`const $I = $XxxId.create("path/File")`. Examples: ontology/architecture
use-cases (`$OntologyUseCasesId`, `$ArchitectureLabUseCasesId`).
Create-package templates use `$RepoCliId` only inside the CLI itself
(`ConfigUpdater.ts:12`, `:24`).

### 4.4 Lint gate

`beep lint identity-registry` fails on **missing** compose segment or
missing `export const $XxxId` (`IdentityRegistry.ts:196-204`).
`--fix` only **adds** missing slugs (`:187-192`). It does **not**
remove leftover composers for deleted packages.

Local `make(...)` root composers outside `@beep/identity` are also
illegal (`IdentityRegistry.ts:101-134`).

**Delete:** remove the compose string **and** the `export const $XxxId`
block from `packages.ts`. Identity lint will **not** fail if you forget;
you get a dead public export and a compose segment that still typechecks.
Consumers that still import `$DeletedId` become the real compile failures.

**Create-package automates:** yes (add only).

---

## 5. Lint / policy / formatters / knip

### 5.1 Policy-pack (`packages/tooling/policy-pack/**`)

`lint-rules` and `repo-configs` are **rule implementations**, not package
registries. Biome plugins are listed by path in `biome.jsonc:13-16`.
No per-package entry.

**Exception:** `DEPRECATED_API_LINT_SHARDS` in
`Lint.command.ts:50-75` is a **hardcoded directory list** for
`beep lint deprecated-apis`. It includes specific apps
(`architecture-lab-proof`, `oip-web`, `professional-desktop`) and
family prefixes (`packages/drivers`, `packages/shared`, …). It does
**not** list `apps/storybook`, `apps/practice-kg-mcp`,
`packages/documents`, or `packages/ontology`. A new
`apps/experiments/*` tree is **invisible** to this shard list until
someone adds `apps/experiments` (or `apps`).

### 5.2 ESLint

`eslint.config.mjs:1-29` selects `DocsESLintConfig` or
`DeprecatedApisESLintConfig`. Includes are config-internal +
`globalIgnores`. No package allowlist. Lefthook runs eslint only on
`packages/tooling/*/*/src/**/*.ts` (`lefthook.yml:9-12`).

### 5.3 Biome

`biome.jsonc:18-48` includes `**` with ignores (`.beep`, generated
inventories, `scratchpad`, …). New packages are included automatically.
No per-package registration.

### 5.4 Oxlint / typos

Lint-policy runs `oxlint --quiet` and `typos` over the repo
(`Quality/Tasks.ts:1684`, `:1699`). No package registry.

### 5.5 Knip

`knip.jsonc:5-63` uses workspace discovery plus **optional per-path
overrides**:

- glob: `"packages/**"` entry patterns (`:6-10`)
- explicit: `packages/ecosystem/effect-drizzle`,
  `packages/law-practice/domain`, `infra`, `apps/oip-web`,
  `apps/storybook`

`ignore` / `ignoreDependencies` mention specific packages when knip
cannot see a use (`knip.jsonc:67-122`).

Baseline: `standards/knip.regression-baseline.jsonc`. Fail-on-growth.
New packages must be clean or the baseline is regenerated in-PR
(`:2-8`). Findings are file-keyed (`:27-40`), not package-keyed.

**Delete:** drop any `knip.jsonc` `workspaces["<path>"]` override and
any ignore that names the path. Rewrite the baseline only if it still
lists files under the deleted tree (shrink is allowed).

**Create-package automates:** no. Discovery covers default libraries.

### 5.6 `.fallowrc.jsonc`

Dead-code **entries** are globs, not package names
(`.fallowrc.jsonc:7-45`): `packages/**/src/*.ts`,
`apps/*/src/main.tsx`, Next app-router files, Storybook config,
`packages/foundation/ui-system/*/stories/**`,
`packages/drivers/graph-3d/stories/**`.

A new Next/Vite/Tauri experiment under `apps/experiments/foo` is
**already** covered by `apps/*/…` globs. A new story-bearing package
is **not** an entry unless a stories glob is added (same as knip /
storybook).

### 5.7 Fallow boundaries (generated, committed)

`standards/fallow.boundaries.generated.jsonc` is **one zone + one rule
per workspace**. Writer:
`beep fallow boundaries --write` →
`Fallow.command.ts:226-268`, `:460-495`.

Per workspace:

- zone `{ name: "@beep/openclaw", patterns: ["packages/drivers/openclaw/src/**"] }`
  (see generated file around the `@beep/gov-legal-mcp` / `@beep/openclaw`
  / `packages/shared/use-cases/src/**` hits)
- rule `{ from, allow, allowTypeOnly }` from the dependency graph +
  doctrine (domain ↛ server, ui ↛ server, … — `Fallow.command.ts:119-144`)

Create-package does **not** write this. `343fc60735` and `3dbf2d277b`
both updated it because later quality / preflight did.

`beep:preflight` includes `fallow:boundaries:write` (`package.json:362`).
`beep fallow boundaries --check` fails on drift
(`Fallow.command.ts:450-457`).

Provenance sidecar: `standards/fallow.boundaries.provenance.jsonc`
(rule-id → generated file). Not a package list.

**Delete:** regenerate with `bun run fallow:boundaries:write`. Do not
hand-edit the generated file.

### 5.8 Other fallow ratchets

- `standards/fallow.dead-code.regression-baseline.jsonc` — issue counts
  (currently zeroed totals at `:14-40`); regenerate with the fallow
  quality command if a deleted package was the last finding owner.
- `standards/fallow.health.regression-baseline.jsonc` — **file-keyed**
  complexity counts (`:3-40`). Delete-package must drop keys under the
  deleted tree or the next health compare will see stale paths.
- `standards/fallow.pilot.inventory.jsonc` — research note, not a
  registry.

`.beep/fallow/{audit,dead-code}.json` plus `raw/` are **local yeet
artifacts**, not source of truth.

---

## 6. Docgen and docs coverage

### 6.1 Per-package `docgen.json`

Scaffolded from `templates/docgen.json.hbs`. tsconfig-sync then
rewrites managed fields (`TsconfigSync.plan.ts:946-988`) via
`createCanonicalDocgenConfig` / `mergeManagedDocgenConfig`.

`packages/shared/use-cases/docgen.json:1-4` shows the managed
`$schema` + `srcLink` + `exclude`.

Apps may or may not have one (`apps/oip-web` listing has no
`docgen.json`; `apps/practice-kg-mcp` and `apps/professional-desktop`
do).

### 6.2 Discovery and orphans

Docgen scans `apps/**/docgen.json`, `packages/**/docgen.json`,
`infra/docgen.json` (`Docgen/internal/Workspace.ts:28`).
`discoverOrphanDocgenConfigPaths` **fails** if a `docgen.json` exists
outside current workspaces (`:60-61`, `:84-100`).

**Delete:** deleting the package directory removes its `docgen.json`.
If you leave a stray `docgen.json` after removing the workspace entry,
docgen refuses to run.

### 6.3 Generated docs trees

Each package may have `docs/` (`_config.yml`, `index.md`,
`modules/**`). Aggregation copies into `docs/generated/<normalized-path>`
(`Docs.aggregate.ts:67`, `Workspace.ts:192-198`).

`beep docs aggregate --clean` rebuilds `docs/generated`.
`beep docgen check --reuse-proof-manifest` is on the lint-policy battery
(`Quality/Tasks.ts:1660`).

**Delete:** remove package `docs/` with the directory; regenerate
`docs/generated` (or `--clean`) so the aggregate does not keep a ghost
tree.

### 6.4 JSDoc documentation inventory

`standards/jsdoc-documentation.inventory.jsonc` is a **full per-package
inventory** (`packageName` + `packagePath` + every public module/export).
`@beep/gov-legal-mcp` appears as a whole package record
(`:22942-22943`). Generator:
`bun run beep quality jsdoc-inventory`
(header `:7`).

Companion markdown: `standards/jsdoc-documentation.inventory.md`.
CI copy: `.beep/ci/jsdoc-documentation.inventory.{jsonc,md}`
(`CiLane.ts:34-35`) — generated, not authored.

Totals ratchet: `standards/jsdoc-totals.regression-baseline.jsonc`.
Fail-on-growth (`:4`, `:12-32`). Deleting a dirty package **lowers**
totals (allowed). Deleting a clean package is a no-op for the ratchet.
`analyzeMissingPackage` marks topo-listed names that lost workspace
metadata as `missing-workspace-metadata`
(`JSDocDocumentationInventory.ts:1238-1242`) — so a stale topo / leftover
reference can keep a ghost row until inventory is regenerated.

**Create-package automates:** no. `beep:preflight` / yeet generate it.

**Delete:** regenerate inventory. Do not hand-edit the 20k-line JSONC.

---

## 7. Schema-first inventory and related exception keys

### 7.1 Schema-first

Path constant: `SchemaFirstInventoryPath = "standards/schema-first.inventory.jsonc"`
(`Lint.schemas.ts:34`).

Scope globs (`schema-first.inventory.jsonc:7-10`):
`apps/**/*.{ts,tsx}`, `packages/**/*.{ts,tsx}`, `infra/{src,test}/**/*.ts`.

Entries are **file + symbol + kind + owner + optional ruleId/line**,
keyed by `file::symbol::kind::ruleId::line`
(`Lint.schemas.ts:583-584`). Owner is the workspace package name
(e.g. `"@beep/schema"`, `"@beep/oip-web"`).

`--write` merges **live** entries with existing exception metadata
(`SchemaFirstScan.ts:302-329`). Stale entries (in the file, not in the
live scan) fail lint (`:334`, `:369`, `:482-488`). Deleting a package
without rewriting the inventory **fails schema-first** until
`beep lint schema-first --write`.

`343fc60735` did update `standards/schema-first.inventory.jsonc` for
the shared-use-cases land (file list). create-package itself does not.

### 7.2 Schema catalog

`standards/schema-catalog.generated.jsonc` — generated by
`bun run beep lint schema-catalog --write` (`SchemaCatalog.ts:33-35`).
Entries include `owner: "@beep/gov-legal-mcp"` / `"@beep/openclaw"`
(catalog grep hits). Drift check fails if stale
(`schema-catalog.test.ts:162`).

**Delete:** regenerate. Same as fallow/jsdoc.

### 7.3 Schema-crispening policy

`standards/schema-crispening.policy.jsonc` is **family-level**
(`foundation`, `drivers`, `tooling`, `apps-slices` at `:8-15`) plus
`ownerOverrides: {}` (`:15`). No per-package key unless someone added
an override. Delete-package only touches this if the package had an
override.

### 7.4 Effect-laws allowlist

`standards/effect-laws.allowlist.jsonc` is **file + owner** exceptions
for `beep-laws/no-native-runtime` (`:5-11`). Stale file paths fail
allowlist-check (`Quality/Tasks.ts:1692`). Prune rows whose `file`
lives under the deleted package.

### 7.5 Test-typecheck blindspot baseline

`standards/test-typecheck.blindspot-baseline.jsonc`. Shrink-only.
`new_package_handling` says create-package / architecture already wire
`beep:check:tests` (`:10`). Findings are `{ package, directory, kind }`
(`:20-24`). **Delete:** drop the package’s finding rows if present;
do not add new packages here.

### 7.6 Retired / historical inventories

- `standards/dual-arity.inventory.jsonc` — **gone**. `Laws/DualArity.ts`
  is gone. Openclaw / gov-legal commits historically touched it; do not
  put it on the live prune list.
- Root `tstyche.json` — **gone** (quality-speedup). Only remaining
  tstyche is the ecosystem member
  `packages/ecosystem/effect-drizzle/tstyche.config.json`. Openclaw
  scaffold historically updated root `tstyche.json`.
- `.cspell/tech-terms.txt` — **gone**. Openclaw P1 historically added
  terms. Current spell gate is `typos` (`lefthook.yml:15-18`,
  `Quality/Tasks.ts:1699`).

---

## 8. CI workflows

### 8.1 `.github/workflows/check.yml` — no package matrix

The verify matrix is **lane IDs**, not packages
(`check.yml:56-117`): lint, lint-policy, repo-sanity, check, test-unit,
test-integration, ecosystem, coverage, docgen, codegen.

Lane bodies live in `beep ci lane` (`CiLane.ts:157-179`).

**Path filters that name packages / trees:**

| Gate | File | What it names |
| --- | --- | --- |
| Docgen PR skip | `check.yml:165-167` | runs if `apps/` / `packages/` / `infra/` / `docgen.json` / ts|md change; full if docgen CLI or root `package.json`/`turbo.json`/`tsconfig*.json` change |
| Desktop IPC | `check.yml:298` | `apps/professional-desktop/` plus `packages/foundation/`, `packages/{agents,workspace,shared,epistemic}`, `packages/drivers/{pglite,postgres}/`, plus root lock/manifest/turbo |
| Coverage turbo cache special-case | `check.yml:252` | lane id `coverage`, not a package |

A new `apps/experiments/foo` **does** trip the docgen lane-gate
(`^apps/`). It does **not** trip desktop-IPC unless the path regex is
widened.

### 8.2 Other workflows

| Workflow | Package coupling |
| --- | --- |
| `storybook.yml:67-70` | `--filter=@beep/storybook` only |
| `data-sync.yml:48,57` | hardcoded `--filter=@beep/{repo-cli,data,law-practice-domain,schema,md,file-processing,libpff}` |
| `release.yml` | changesets; no package list |
| `release-desktop.yml` | professional-desktop / Tauri (app-specific) |
| `property-laws-nightly.yml` | affected/seed; not a registry |
| `fleet-*.yml` | runners, not packages |

**Delete:** only edit a workflow if it **names** the package
(`data-sync.yml` filters, desktop-IPC regex, storybook filter). Ordinary
libraries need no workflow edit.

**Create-package automates:** no.

### 8.3 Coverage lane + ratchet

Baseline: `standards/coverage.regression-baseline.jsonc`.
Per-package record: `{ path, lines, statements, branches, functions, uncovered }`
(`CoverageRegression.ts:106-117`, baseline `@beep/acp` at
`coverage.regression-baseline.jsonc:11-22`).

Compare (`CoverageRegression.ts:727-764`):

- Unscoped run: **every baseline package must emit a summary**
  (`missingActuals` from baseline keys — `:749-752`).
- New packages without a baseline row are **warnings only**
  (`:753-757`, `:887-896`).
- Unscoped **write** refuses to drop a still-present workspace that
  produced no summary; “Packages that no longer exist are pruned
  normally” (`:643-644`).

**Delete without rewriting the baseline fails the coverage lane**
(missing summary for the deleted name).

Shard weights: `COVERAGE_TASK_WEIGHT_SECONDS` in
`CoverageScope.ts:71-…` is a **hardcoded package → seconds** map
(includes `@beep/gov-legal-mcp` at `:122`). Missing keys use a default
(`:67-70`). Leftover weights are harmless but should be pruned for
honesty.

Full-run trigger files include `package.json`, lockfile, and the three
root tsconfigs (`CoverageScope.ts:17-33`).

**Create-package automates:** no (warning until
`bun run coverage:baseline:write`).

---

## 9. Changesets

- Config: `.changeset/config.json` (ignore list only — `:13`).
- Pending files: `.changeset/*.md` frontmatter package names.
- Graph guard: `beep quality changeset-graph`
  (`ChangesetGraph.ts`, wired at `Quality.command.ts:2450-2466`).
- Missing workspace names fail unless listed in
  `standards/changesets.retired-packages.json`
  (`ChangesetGraph.ts:34`, `:57-74`; retired list `:1-27` includes
  `@beep/messages`, `@beep/ontology`, `@beep/sandbox`,
  `@beep/courtlistener`, `@beep/dol`, `@beep/federal-register`).

Openclaw / gov-legal lands added `.changeset/openclaw-p1-driver.md` and
`.changeset/gov-legal-mcp-host.md`. Shared-use-cases came in a docs/feat
PR without a dedicated changeset file in the truncated name list.

**Delete:**

1. Drop or rewrite pending changesets that name the package.
2. If historical pending changesets must survive, add
   `{ name, rationale }` to `changesets.retired-packages.json`
   (the honest-repo-signal pattern at `:16-26`).
3. Do not leave a live workspace name in `ignore` unless it is one of
   the three permanent ignores.

**Create-package automates:** no.

---

## 10. Portless / dev-server / Storybook / Tauri / Next

### 10.1 Portless

There is **no** `portless.json` / `.portless` registry. The hostname is
the script:

- Next: `portless ${name}.beep next dev --turbopack`
  (`CreatePackage.command.ts:1467`)
- Tauri/Vite: `portless ${name}.beep sh -c 'vite --host 127.0.0.1 --port "${PORT:-1420}" --strictPort'`
  (`:1509`)
- Live apps: `apps/professional-desktop/package.json:18`,
  `apps/storybook/package.json:27-29`

`turbo.json:28` passes `PORTLESS_*`. `knip.jsonc` ignoreBinaries includes
`portless`. README / AGENTS document
`http://<name>.beep.localhost:1355`.

Tauri `devUrl` / CSP hardcode the hostname
(`apps/professional-desktop/src-tauri/tauri.conf.json:9,26`).
Create-package’s tauri template writes the same pattern.

**Delete:** removing the app directory is enough. No global portless
map. Leftover docs mentioning the hostname are prose.

### 10.2 Storybook

Host app: `apps/storybook`. Stories globs
(`apps/storybook/.storybook/main.ts:50-56`):

```text
packages/foundation/ui-system/*/stories/**/*.stories.@(ts|tsx)
packages/drivers/graph-3d/stories/**/*.stories.@(ts|tsx)
```

Test runner roots (`run-storybook-tests.mjs:7-8`) only list
`ui` and `editor` stories.

Create-package can emit `tsconfig.stories.json` / `stories/tsconfig.json`
when `withStoriesTsconfig` is set (`CreatePackage.command.ts:384-385`,
`:1556-1563`). That does **not** register the package with the Storybook
host.

**Delete:** if the package was in `main.ts` or
`run-storybook-tests.mjs`, remove those globs. Otherwise nothing.

### 10.3 Vitest workspace

Root `vitest.config.ts:10-14` globs:

- `packages/*/vitest.config.ts`
- `packages/*/*/vitest.config.ts`
- `packages/tooling/*/*/vitest.config.ts`
- `apps/*/vitest.config.ts`

`apps/experiments/foo/vitest.config.ts` is covered by `apps/*`.
`packages/foo` (one-level) is covered; `packages/shared/use-cases` is
covered by `packages/*/*`. A four-level path outside tooling is **not**
(foundation is `packages/foundation/<kind>/<name>` — **three** segments
after `packages`, so `packages/*/*` does **not** match
`packages/foundation/modeling/schema/vitest.config.ts`). Those packages
still run via turbo `--filter` / package-local `vitest.config.ts` when
invoked as a workspace, and via the `packages/*/*` miss they may rely on
turbo rather than the root Vitest project glob. Delete-package does not
edit `vitest.config.ts` unless someone added an explicit exclude.

### 10.4 Cargo / Rust

No repo-root `Cargo.toml` workspace. Each Tauri app owns
`src-tauri/Cargo.toml`. Desktop-IPC CI caches
`apps/professional-desktop/src-tauri` (`check.yml:311`).
Delete-package for a Tauri experiment deletes `src-tauri/` with the app.

---

## 11. Architecture inventory and family prose

`beep architecture` does **not** maintain a generated package inventory
file. `AcceptedProofManifest.ts` is a **static list of architecture-lab
proof files** (`roleBasePath` hardcodes
`apps/architecture-lab-proof`, `packages/_internal/db-admin`,
`packages/architecture-lab/${role}` — `:50-54`). Not a registry of all
workspaces.

Authored surfaces that **named** `shared/use-cases` when it was
promoted (`343fc60735`):

- `standards/ARCHITECTURE.md` (reserved-role list + contract-only
  exception — `:1199-1224`, plus earlier hits at `:360-379`, `:1054`,
  `:1151-1215`)
- `standards/architecture/02-shared-kernel.md`
- `standards/architecture/DECISIONS.md`
- `packages/shared/AGENTS.md` (package table `:24-33`)

Driver adds (openclaw, gov-legal-mcp) did **not** edit ARCHITECTURE.md.
Family AGENTS files are **manual** and only when the family guide lists
members.

**Delete:** if the package was an architecture exception or a named
role, edit the standard and the family `AGENTS.md`. Proof-app deletion
would also require `AcceptedProofManifest` / RoleTopology edits — that
is architecture-lab specific, not generic delete-package.

**Create-package automates:** no.

---

## 12. `.beep/`, generated barrels, codegraph

### 12.1 `.beep/`

| Path | What | Delete action |
| --- | --- | --- |
| `.beep/yeet/packets/beep_<slug>.md` | Yeet quality-issue packets, one per package that had findings (`IssueArtifacts.ts:255-260`). `beep_openclaw.md` / `beep_gov-legal-mcp.md` exist; `beep_shared-use-cases.md` does not (never yeeted dirty). | Regenerated on next yeet. Safe to delete. Not a gate. |
| `.beep/yeet/quality-issue-index.json` | Index of the same | regenerate |
| `.beep/yeet/runs/**` | per-PR run state | leave; historical |
| `.beep/ci/jsdoc-documentation.inventory.*` | CI JSDoc copy | regenerate |
| `.beep/fallow/**` | local fallow envelopes | regenerate / ignore |
| `.beep/professional-desktop/**` | app-local ontology workspace | delete with that app |

Biome ignores `.beep` (`biome.jsonc:20-21`). Turbo inputs exclude it.

**Create-package automates:** no.

### 12.2 Generated barrels / index registries

No repo-wide package barrel. Identity `packages.ts` is the only
central export registry. Architecture-lab `entities/index.ts` files
are proof barrels read by path (knip ignore at `knip.jsonc:88-89`).

### 12.3 Codegraph

`.codegraph/` is **gitignored** (`.gitignore:135-136`). Local index.
`codegraph` MCP is configured in `.mcp.json`. Delete-package should
not commit index edits; operators re-index locally.

---

## 13. Syncpack (derived, committed)

`syncpack.config.ts:3-109` `source` array is **exactly**
`package.json` plus each workspace pattern + `/package.json`.
tsconfig-sync rewrites it from `package.json#workspaces`
(`TsconfigSync.plan.ts:240-241`, `:680-700`).

Traced entries: `packages/shared/use-cases/package.json` (`:16`),
`packages/drivers/openclaw/package.json` (`:105`),
`packages/drivers/gov-legal-mcp/package.json` (`:108`).

**Delete:** remove workspace entry, run `beep tsconfig-sync`.

**Create-package automates:** yes, via tsconfig-sync (not ConfigUpdater).

---

## 14. Version-sync

`beep version-sync` pins catalog / internal versions
(`VersionSync.command.ts`). It does not register packages. Lefthook
`post-merge` runs `--skip-network` (`lefthook.yml:28-31`). No prune
step unless the deleted package was a version source.

---

## 15. CODEOWNERS / commitlint / leftover CI-adjacent

- `.github/CODEOWNERS` is `* @kriegcloud` — no per-package owners.
- `commitlint.config.ts` is conventional-commits + subtree-squash
  ignores — no package list.
- `lefthook.yml` globs, not packages.

---

## 16. Hardcoded package-name maps (easy to miss)

These are **not** on the original surface list but they name packages:

| Surface | Path | Risk if missed |
| --- | --- | --- |
| Deprecated-API lint shards | `Lint.command.ts:50-75` | new `apps/experiments` never linted; deleted app shard is a no-op (empty glob) |
| Coverage shard weights | `CoverageScope.ts:71-…` | leftover weight only |
| Data-sync filters | `.github/workflows/data-sync.yml:48,57` | deleted named package makes the job `turbo --filter` empty/fail |
| Desktop-IPC path filter | `check.yml:298` | leftover path is harmless; new experiment app not covered |
| Storybook story globs | `apps/storybook/.storybook/main.ts:50-56` | leftover glob empty; new UI package invisible |
| Storybook test roots | `run-storybook-tests.mjs:7-8` | same |
| Turbo storybook inputs | `turbo.json:248-272` | stale cache inputs |
| Fallow story entries | `.fallowrc.jsonc:36-37` | leftover unused-file noise |
| Knip per-workspace overrides | `knip.jsonc:12-63` | knip error / stale ignore |
| Changeset retired list | `standards/changesets.retired-packages.json` | opposite problem: must **add** here if pending changesets remain |
| Effect-laws allowlist | `standards/effect-laws.allowlist.jsonc` | stale file path fails allowlist |
| Fallow health baseline | `standards/fallow.health.regression-baseline.jsonc` | stale file keys |
| JSDoc inventory | `standards/jsdoc-documentation.inventory.jsonc` | ghost package / `missing-workspace-metadata` |
| Schema-first inventory | `standards/schema-first.inventory.jsonc` | stale entries fail lint |
| Schema catalog | `standards/schema-catalog.generated.jsonc` | drift fail |
| Coverage baseline | `standards/coverage.regression-baseline.jsonc` | missing summary fails unscoped compare |
| Test-typecheck baseline | `standards/test-typecheck.blindspot-baseline.jsonc` | leftover finding for a gone package |
| Architecture prose | `standards/ARCHITECTURE.md`, `standards/architecture/*`, family `AGENTS.md` | docs lie |
| Identity leftover composers | `packages/foundation/modeling/identity/src/packages.ts` | dead public API; lint will **not** catch |
| Workspace survivors’ `workspace:^` deps | any still-living `package.json` | bun install fails |
| Aggregate docs | `docs/generated/**` | ghost docs site |
| Yeet packets | `.beep/yeet/packets/beep_*.md` | noise only |

---

## 17. Recommended delete-package algorithm

Order matters: bun must still resolve the graph until survivor deps
are stripped.

1. **Refuse** if other workspaces still depend on the target
   (or accept a `--force` that rewrites those manifests). Use
   `buildRepoDependencyIndex` (already used by tsconfig-sync /
   fallow).
2. Delete the package directory (and `CLAUDE.md` symlink).
3. Remove an **explicit** `package.json#workspaces` entry if present.
4. Remove identity compose segment + `$XxxId` export
   (`packages.ts`). Identity lint will not do this.
5. `bun install --lockfile-only`.
6. `bun run beep tsconfig-sync` — cleans
   `tsconfig.packages.json`, `tsconfig.json` aliases, `syncpack.config.ts`,
   survivor package `references`, leftover `docgen.json` managed fields
   (orphans should already be gone with the directory).
7. `bun run fallow:boundaries:write`.
8. `bun run beep lint schema-first --write` and
   `bun run beep lint schema-catalog --write`.
9. `bun run beep quality jsdoc-inventory` (then jsdoc-ratchet only if
   totals must be snapshotted — shrink is legal).
10. `bun run coverage:baseline:write` **unscoped** (or scoped merge
    after confirming the name is gone) so the coverage lane does not
    demand a missing summary.
11. Prune **authored** leftovers: knip overrides, deprecated-API shards,
    coverage weights, effect-laws allowlist rows, fallow health keys,
    test-typecheck findings, changeset files / retired list, storybook
    globs, data-sync filters, architecture / AGENTS prose.
12. `docs/generated` rebuild (`beep docs aggregate --clean`).
13. Do **not** treat `.beep/**` or `.codegraph/` as merge gates.

Create-package today stops at step 6 (and identity add, not remove).
`beep:preflight` (`package.json:362`) covers 6–9 plus extra gates; it
does **not** rewrite coverage baseline or identity leftovers.

---

## 18. Experiments implications (for the sibling lanes)

- `--type app` already supports `nextjs` / `tauri` / `runtime-proof`
  (`CreatePackage.command.ts:120`, `:901-903`, `:1129`).
- There is **no** `apps/*` or `apps/experiments/*` workspace glob.
  Every experiment app is an explicit workspace append unless a glob is
  added first.
- Portless is per-script; no extra registry.
- Storybook / turbo storybook inputs / fallow story entries are
  **manual** if the experiment hosts stories.
- Deprecated-API shards miss `apps/experiments` today
  (`Lint.command.ts:50-54`).
- Architecture family `VALID_FAMILIES` cannot express experiments
  (`CreatePackage.command.ts:121`). Use `--parent-dir`.
- Identity slug is `--name`, so `beep create-package my-exp --type app
  --app-kind nextjs --parent-dir apps/experiments` registers
  `$MyExpId` / `@beep/my-exp`, directory
  `apps/experiments/my-exp`.

---

## 19. Master table

Legend for **created-by**:

- `CP` = `create-package` command (including identity + lockfile)
- `CU` = `ConfigUpdater.ts` only (add, no remove; not on the live
  post-scaffold path)
- `TS` = `beep tsconfig-sync` (invoked by create-package)
- `ARCH` = `beep architecture create` (files + identity add)
- `PF` = `beep:preflight` / yeet prepare (not create-package)
- `MAN` = human / PR follow-up
- `GEN` = regenerate command (must be run on delete)
- `NONE` = no per-package write

| Surface | Paths | Per-package write | Created-by | Delete-action | Risk if missed |
| --- | --- | --- | --- | --- | --- |
| Workspace membership | `package.json:433-537` | explicit path **or** nothing if glob covers | CP (if uncovered); ARCH **no** | remove explicit entry | bun cannot see package; or ghost workspace if dir gone |
| Lockfile | `bun.lock` workspace + alias keys | full workspace snapshot | CP (`--lockfile-only`) | `bun install --lockfile-only` | install/resolution drift |
| Root catalog | `package.json:2` | none | NONE | none (unless last consumer) | unused root dep noise |
| tsconfig solution refs | `tsconfig.packages.json` | `{ path: "<rel>" }` | TS (CU add-only) | `beep tsconfig-sync` | `tsc -b` ghost project / missing project |
| Root path aliases | `tsconfig.json` `paths` | `@beep/<slug>` + `/*` + export subpaths | TS (CU add-only) | `beep tsconfig-sync` (removes) | stale aliases; or leftover after delete |
| Base tsconfig | `tsconfig.base.json` | none | NONE | none | — |
| Package tsconfig refs | `<pkg>/tsconfig.json` | dep `references` | TS + scaffold | rewrite survivors + TS | broken project graph |
| Test/stories tsconfig | `<pkg>/tsconfig.test.json`, `tsconfig.stories.json` | local files | CP optional | delete with dir | — |
| Syncpack sources | `syncpack.config.ts:3-109` | `<workspace>/package.json` | TS | TS after workspace edit | syncpack scans a missing file |
| Turbo tasks | `turbo.json` | none (discovery) | NONE | none unless storybook inputs | stale storybook cache inputs |
| App turbo.json | `apps/{professional-desktop,storybook}/turbo.json` | app-local | MAN | delete with app | — |
| Identity compose + `$XxxId` | `packages/foundation/modeling/identity/src/packages.ts` | slug + typed export | CP / ARCH / `lint identity-registry --fix` | **hand-remove both**; lint will not prune | dead public composer; consumers break only if imported |
| Identity barrel | `identity/src/index.ts:81` | star-export | NONE | none | — |
| Biome | `biome.jsonc` | none | NONE | none | — |
| ESLint | `eslint.config.mjs` | none | NONE | none | — |
| Deprecated-API shards | `Lint.command.ts:50-75` | hardcoded prefixes | MAN | add/remove prefix | new experiments never scanned |
| Oxlint / typos | lint-policy steps | none | NONE | none | — |
| Lefthook / commitlint / CODEOWNERS | `lefthook.yml`, `commitlint.config.ts`, `.github/CODEOWNERS` | none | NONE | none | — |
| Knip config | `knip.jsonc` | optional path override | MAN | drop override / ignore | knip error or stale ignore |
| Knip baseline | `standards/knip.regression-baseline.jsonc` | file findings | GEN | rewrite if findings remain | leftover file findings |
| Fallow rc entries | `.fallowrc.jsonc` | globs; some package stories | MAN | drop story glob if unique | unused-file false positives |
| Fallow boundaries | `standards/fallow.boundaries.generated.jsonc` | zone + allow rule per workspace | PF / `fallow:boundaries:write` | regenerate | `--check` drift fail |
| Fallow health | `standards/fallow.health.regression-baseline.jsonc` | file keys | GEN | drop keys | stale path compare |
| Fallow dead-code | `standards/fallow.dead-code.regression-baseline.jsonc` | totals | GEN | regenerate if needed | count drift |
| Package `docgen.json` | `<pkg>/docgen.json` | managed fields | CP template + TS | delete with dir; orphans fail docgen | `discoverOrphanDocgenConfigPaths` hard-fail |
| Package `docs/` | `<pkg>/docs/**` | generated modules | docgen | delete with dir | leftover local docs |
| Aggregate docs | `docs/generated/**` | copy of package docs | `beep docs aggregate` | `--clean` rebuild | ghost published docs |
| JSDoc inventory | `standards/jsdoc-documentation.inventory.jsonc` (+ `.md`, `.beep/ci/`) | whole package record | PF / `jsdoc-inventory` | regenerate | ghost package / missing-workspace-metadata |
| JSDoc totals | `standards/jsdoc-totals.regression-baseline.jsonc` | totals only | GEN | optional snapshot | none (shrink allowed) |
| Schema-first inventory | `standards/schema-first.inventory.jsonc` | file/symbol/owner rows | PF / `lint schema-first --write` | `--write` after delete | **lint fail on stale entries** |
| Schema catalog | `standards/schema-catalog.generated.jsonc` | owner-tagged schemas | GEN | `--write` | drift fail |
| Schema-crispening | `standards/schema-crispening.policy.jsonc` | family + optional ownerOverrides | MAN | drop override | leftover override |
| Effect-laws allowlist | `standards/effect-laws.allowlist.jsonc` | file + owner | MAN | drop rows | allowlist-check fail |
| Test-typecheck baseline | `standards/test-typecheck.blindspot-baseline.jsonc` | package findings | GEN | drop rows | leftover finding |
| Coverage baseline | `standards/coverage.regression-baseline.jsonc` | per-package pct + uncovered | GEN (`coverage:baseline:write`) | unscoped rewrite | **coverage lane missingActuals** |
| Coverage weights | `CoverageScope.ts:71-…` | seconds map | MAN | drop key | none (default weight) |
| CI lane matrix | `.github/workflows/check.yml:56-117` | lanes, not packages | NONE | none | — |
| Docgen lane-gate | `check.yml:165-167` | tree prefixes | NONE | none | — |
| Desktop-IPC filter | `check.yml:298` | named trees | MAN | edit if that app dies | leftover skip logic |
| Data-sync filters | `data-sync.yml:48,57` | named `--filter`s | MAN | edit if named | turbo filter fail |
| Storybook workflow | `storybook.yml:67-70` | `@beep/storybook` | NONE | none | — |
| Release / changesets action | `release.yml` | pending `.changeset/*.md` | MAN | drain changesets | release names a missing pkg |
| Changeset graph | `.changeset/*.md` + `changesets.retired-packages.json` | frontmatter names | MAN | rewrite / retire | `changeset-graph` fail |
| Changeset ignore | `.changeset/config.json:13` | 3 permanent names | MAN | only if targeting those | — |
| Portless | app `package.json` scripts; tauri `devUrl` | hostname = `--name` | CP (apps) | delete app | leftover docs hostname |
| Storybook host | `apps/storybook/.storybook/main.ts:50-56` | extra globs | MAN | drop glob | empty glob / missing stories |
| Storybook tests | `run-storybook-tests.mjs:7-8` | two UI roots | MAN | drop root | test fail / empty |
| Vitest root projects | `vitest.config.ts:10-14` | globs | NONE | none | — |
| Cargo | `apps/*/src-tauri/Cargo.toml` | per Tauri app | CP tauri template | delete with app | — |
| Architecture proof manifest | `AcceptedProofManifest.ts:50-54` | architecture-lab only | MAN | edit if deleting proof-app | architecture create drift |
| Architecture standard | `standards/ARCHITECTURE.md`, `standards/architecture/*` | named exceptions | MAN | edit named roles | binding docs lie |
| Family AGENTS | e.g. `packages/shared/AGENTS.md:24-33` | member table | MAN | edit table | agent guides lie |
| Yeet packets | `.beep/yeet/packets/beep_*.md` | one md per dirty package | yeet runtime | ignore / delete | none |
| Codegraph index | `.codegraph/` (gitignored) | local | local tool | reindex | stale local graph |
| Version-sync | version pins | none | NONE | none | — |
| `package.json#beep` metadata | family/kind | only `--family` packages | CP | delete with dir | — |

---

## 20. Trace appendix (what recent adds actually touched)

### `@beep/openclaw` scaffold `d9d647bd13`

`package.json`, `bun.lock`, `packages/foundation/modeling/identity/src/packages.ts`,
`syncpack.config.ts`, `tsconfig.packages.json`, historical `tstyche.json`,
plus in-tree scaffold. **No** `tsconfig.json` aliases in the scaffold
commit (later land / later tsconfig-sync added them).

### `@beep/openclaw` P1 `3dbf2d277b`

Above plus `tsconfig.json`, `standards/fallow.boundaries.generated.jsonc`,
historical `dual-arity.inventory.jsonc`,
`standards/jsdoc-documentation.inventory.{jsonc,md}`,
`.changeset/openclaw-p1-driver.md`, historical `.cspell/tech-terms.txt`.

### `@beep/gov-legal-mcp` `16f22c079d`

Same derived set as openclaw P1: workspaces, lockfile, identity,
syncpack, both tsconfigs, fallow, dual-arity (historical), changeset.

### `@beep/shared-use-cases` `343fc60735`

`package.json` workspace, identity (`shared-use-cases` / `$SharedUseCasesId`),
`syncpack.config.ts`, `tsconfig.packages.json`, `tsconfig.json` (including
export subpath aliases), `standards/fallow.boundaries.generated.jsonc`,
`standards/schema-first.inventory.jsonc`, `standards/ARCHITECTURE.md`,
`standards/architecture/02-shared-kernel.md`, `packages/shared/AGENTS.md`,
`bun.lock`. Architecture-promoted slice: **manual prose + derived
inventories**, not just create-package.

That split is the prune list: **CP/TS surfaces are mechanical;
inventories and prose are the ones delete-package will forget if it
only inverts create-package.**
