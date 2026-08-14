# Lane 1: `create-package` anatomy and extension points

**Scope.** Deep-read of `packages/tooling/tool/cli/src/commands/CreatePackage/` plus the command's registration, test kit, and the post-scaffold config surfaces it actually drives. The live command is 1637 lines. Companion modules exist that the command does *not* call; those are called out as unused extension points rather than as the current pipeline.

**Headline.** `beep create-package` already scaffolds Next.js and Tauri apps into `apps/<name>`, already has a package-like `runtime-proof` app kind, and already accepts `--parent-dir apps/experiments`. There is no standalone Vite app kind (Tauri's web shell is Vite). There is no `delete-package` command and almost no inverse helpers. The family/role/slice model the *command* understands is the non-slice `beep.family`/`beep.kind` grammar, not the architecture-lab slice roles. Architecture slices are a sibling factory (`beep architecture create …`) that reuses only identity registration.

---

## 0. Module map and what is actually wired

| Module | Role in the live command | Lines |
| --- | --- | --- |
| `CreatePackage.command.ts` | Entire CLI surface, validation, path derivation, template selection, `package.json` generation, workspace append, identity register, tsconfig-sync, lockfile | 1637 |
| `TemplateService.ts` | Handlebars render of `TemplateSpec[]` against `TemplateContext` | 212 |
| `FileGenerationPlanService.ts` | Deterministic mkdir/write/symlink plan + execute | 819 |
| `internal/IdentityRegistration.ts` | `@beep/identity` composer slug + `$XxxId` export via `TSMorphService` | 348 |
| `ConfigUpdater.ts` | Idempotent add/check for `tsconfig.packages.json` refs and `tsconfig.json` aliases | 606 |
| `TsMorphIntegrationService.ts` | Unused AST-mutation *contract* (identity/entity/persistence/data-access) | 327 |
| `index.ts` | Re-exports only `CreatePackage.command.ts` | 14 |
| `templates/*.hbs` | 35 Handlebars files, selected by `AppKind` / stories flag | — |

**Wired.** The handler constructs `createTemplateService()` and `createFileGenerationPlanService()` as module-level constants (`CreatePackage.command.ts:630-631`) and calls `CreatePackageIdentityRegistration` plus `syncTsconfigAtRoot` after execute (`CreatePackage.command.ts:1303-1314`).

**Not wired into the live handler.**

- `ConfigUpdater.ts` is never imported by `CreatePackage.command.ts`. Post-scaffold root tsconfig/syncpack/docgen work is delegated to `syncTsconfigAtRoot` (`CreatePackage.command.ts:33`, `1307-1311`). ConfigUpdater is a tested, exported sibling used by `create-package-security.test.ts` via the test kit.
- `TsMorphIntegrationService.ts` is never imported by the command. Identity registration uses `@beep/repo-utils` `TSMorphService` directly (`IdentityRegistration.ts:8`, `144-164`). The default adapter in `createTsMorphIntegrationService` always skips (`TsMorphIntegrationService.ts:294-327`).

**Registration.**

- Barrel: `export * from "./CreatePackage.command.ts"` (`CreatePackage/index.ts:14`).
- Root CLI: `import { createPackageCommand } from "./CreatePackage/index.ts"` (`Root.ts:17`) and listed in `Command.withSubcommands` (`Root.ts:84`).
- Public package export: `createPackageCommand` from `packages/tooling/tool/cli/src/index.ts:103`.
- Invocation: root `"beep": "bun run packages/tooling/tool/cli/src/bin.ts --"` (`package.json:361`) and `"create-package": "bun run beep create-package"` (`package.json:375`). The bin defers to `bin-main.js` after a lint-fix fast path (`bin.ts:46-47`).
- There is no `delete-package` (or any `delete*` package command) under `commands/` or `Root.ts`.

**Test kit.** `packages/tooling/tool/cli/src/test/CreatePackage.test-kit.ts` re-exports ConfigUpdater, FileGenerationPlanService, and the command barrel through `@beep/repo-cli/commands/CreatePackage/…` (`CreatePackage.test-kit.ts:8-10`). TsconfigSync maps `@beep/repo-cli/test/CreatePackage` → `src/test/CreatePackage.test-kit.ts` (`TsconfigSync.schemas.ts:273`). Tests must import via that alias, not relatives into `src/`.

---

## 1. End-to-end pipeline

### 1.1 Inputs: flags only, no prompts

There is no `Prompt` / `Flag.prompt` / interactive flow in `CreatePackage/` (search is empty). Everything is Effect CLI `Argument` + `Flag` (`CreatePackage.command.ts:893-934`).

| Input | Kind | Default | Meaning |
| --- | --- | --- | --- |
| `name` | positional argument | required | Unscoped package segment, e.g. `my-utils` (`CreatePackage.command.ts:896`) |
| `--type` | string flag | `"library"` | `library` \| `tool` \| `app` (`897-899`, literals `119`) |
| `--app-kind` | string flag | `""` | Required when `--type app`: `nextjs` \| `tauri` \| `runtime-proof` (`901-903`, literals `120`) |
| `--parent-dir` | string flag | `""` | Repo-relative parent; forbidden when `--family` is set (`905-907`, `1110-1114`) |
| `--family` | string flag | `""` | `drivers` \| `ecosystem` \| `foundation` \| `tooling`; forbidden with `--type app` (`909-911`, `121`, `994-997`) |
| `--kind` | string flag | `""` | Required for foundation and tooling families (`913-917`) |
| `--dir-name` | string flag | `""` | Folder name override; same charset as `name` (`919-923`, `1102-1107`) |
| `--description` | string flag | `""` | `package.json` description and README body (`925`) |
| `--dry-run` | boolean | false | Preview; no writes (`926`) |
| `--skip-lockfile` | boolean | false | Skip `bun install --lockfile-only` (`927-928`) |
| `--with-stories-tsconfig` | boolean | false | Only legal for `--family foundation --kind ui-system` (`930-933`, `1079-1091`) |

`name` / `--dir-name` must match `PACKAGE_NAME_PATTERN = /^[a-z_][a-z0-9._-]*$/` (`124`, `335-341`, `1095-1107`). `--parent-dir` must match `PARENT_DIR_PATTERN` (`125`, `327-333`, `1135-1138`): lowercase repo-relative path, no `//`, no trailing `/`, no `.` / `..` segments. `apps/experiments` is a legal parent.

### 1.2 The family / role / slice model *this command* understands

Create-package is the **non-slice family factory**. It does **not** understand architecture slice roles.

**Package type** (`VALID_TYPES`, `119`; `PackageType` LiteralKit `244-248`):

- `library` — default; Effect library manifest with exports + docgen.
- `tool` — same scaffold as library, plus `@effect/platform-node` (`1552-1554`).
- `app` — requires `--app-kind`; defaults parent to `apps`; forbids `--family`.

**App kind** (`VALID_APP_KINDS`, `120`; `AppKind` `253-266`):

- `nextjs` — real app; Next.js App Router templates; no package exports / no root `@beep/*` aliases.
- `tauri` — real app; Vite + React + `src-tauri`; no package exports / no root aliases.
- `runtime-proof` — **not** a real app: falls through to the *package* template set and package-like `package.json` (`493-507`, `619-622`, `1461-1546` fall-through). Still lives under `apps/`.

**Canonical package family** (`VALID_FAMILIES`, `121`; `PackageFamily` `268-281`): `drivers`, `ecosystem`, `foundation`, `tooling`.

**Kinds** (only for some families):

- Foundation (`VALID_FOUNDATION_KINDS`, `122`; `283-297`): `primitive`, `modeling`, `capability`, `ui-system`. `--kind` is **required** when `--family foundation` (`1006-1014`).
- Tooling (`VALID_TOOLING_KINDS`, `123`; `300-312`): `library`, `tool`, `policy-pack`, `test-kit`. `--kind` is **required** when `--family tooling` (`1019-1027`).
- Drivers and ecosystem **reject** `--kind` (`1032-1048`).

`BeepPackageMetadata` is `{ family, kind? }` written into generated `package.json` as `beep` (`317-325`, `1237-1242`, `1601-1607`). Apps never get this metadata because `--family` is illegal with `--type app`.

**Inference when family/parent are omitted** (`1050-1077`):

- If `--type` is not `app` and `--parent-dir` is empty and `--family` is empty, the command infers `family=tooling` and `kind=tool` (when `--type tool`) or `kind=library` (otherwise).
- That is why a bare `beep create-package foo` lands in `packages/tooling/library/foo` (`1117-1133`).

**What it does *not* model.**

Architecture slice roles (`domain`, `use-cases`, `config`, `server`, `tables`, `client`, `ui`, plus `proof-app` / `db-admin`) live in `Architecture/internal/RoleTopology.ts` (`53-64`, `180-214`). Paths there are `packages/<slice>/<role>` and `apps/<slice>-proof`. Create-package never reads those schemas. ConfigUpdater's "slice flows creating multiple packages" comment (`ConfigUpdater.ts:435`) means *batch targets*, not architecture slices.

The architecture command is a **sibling factory**: `beep architecture create slice|package`, `add concept|role`, `plan`, `apply`, `check` (`Architecture.command.ts:199-297`). After apply it calls `CreatePackageIdentityRegistration.registerMissingWorkspaceIdentityPackages` (`Architecture.command.ts:152`). It does not call create-package templates.

### 1.3 Validation order (handler)

The handler is one `Effect.fn` (`CreatePackage.command.ts:939-1359`) with a fallow complexity waiver (`935-937`). Order:

1. `--type` must be a `PackageType` (`955-959`).
2. `--app-kind` only with `--type app` (`962-966`); `--type app` requires a non-empty `--app-kind` (`968-972`); value must be in `VALID_APP_KINDS` (`974-978`).
3. `--family` must be a `PackageFamily` if set (`985-992`); illegal with `--type app` (`994-997`).
4. `--kind` requires `--family foundation|tooling` (`1000-1004`); foundation/tooling validate their kind sets; drivers/ecosystem reject kind (`1006-1048`).
5. Infer tooling family/kind if neither family nor parent-dir was given (`1050-1077`).
6. `--with-stories-tsconfig` only for foundation/ui-system (`1079-1091`).
7. `name` / `--dir-name` charset (`1095-1107`).
8. `--family` + `--parent-dir` is illegal (`1110-1114`).
9. Derive `defaultParentDir`, then `parentDir`, then `packagePath = ${parentDir}/${dirName}` (`1117-1140`).
10. `findRepoRoot()`, resolve identity file, `outputDir = repoRoot/packagePath` (`1147-1151`).
11. Unless dry-run, fail if `outputDir` already exists (`1154-1161`).

### 1.4 Default parent directories (the path model)

`defaultParentDir` is the first defined of (`1117-1133`):

| Condition | Parent |
| --- | --- |
| foundation kind set | `packages/foundation/${kind}` |
| tooling kind set (explicit or inferred) | `packages/tooling/${kind}` |
| family `drivers` | `packages/drivers` |
| family `ecosystem` | `packages/ecosystem` |
| `--type app` | `apps` |
| otherwise | `packages/tooling/library` |

Then `packagePath = ${parentDir}/${dirName}` (`1140`). So:

- `beep create-package schema-kit --family foundation --kind modeling` → `packages/foundation/modeling/schema-kit` (tested, `create-package.test.ts:738-746`).
- `beep create-package repo-utils --family tooling --kind library` → `packages/tooling/library/repo-utils` (tested, `922-937`).
- `beep create-package runpod --family drivers` → `packages/drivers/runpod` (tested, `991-1000`).
- `beep create-package portable-effect --family ecosystem` → `packages/ecosystem/portable-effect` (tested, `1050-1059`).
- `beep create-package marketing-web --type app --app-kind nextjs` → `apps/marketing-web` (tested, `572-582`).
- `beep create-package desktop-shell --type app --app-kind tauri` → `apps/desktop-shell` (tested, `629-639`).
- `beep create-package runtime-proof-lab --type app --app-kind runtime-proof` → `apps/runtime-proof-lab` (tested, `689-699`).
- `beep create-package example-domain --parent-dir packages` → `packages/example-domain` (tested, `499-508`).
- `beep create-package foo --type app --app-kind nextjs --parent-dir apps/experiments` → `apps/experiments/foo` **today**, untested but allowed by `ParentDir` + the app/family exclusion.

`toRootRelative` is `../` repeated once per path segment (`696`, `1444`). Depth is not hard-coded to `packages/`; `apps/experiments/foo` would get `../../../`.

### 1.5 Every file the command generates

Selection is `templateSpecsFor(appKind, withStoriesTsconfig)` / `filesFor` / `directoriesFor` (`488-617`). `package.json` is **not** a Handlebars template; it is built in `generatePackageJson` (`1424-1637`) and injected as a `PlannedFile` (`1277-1281`). `CLAUDE.md` is always a symlink to `AGENTS.md` (`1293-1298`). `test/.gitkeep` is emitted only for package-like / runtime-proof scaffolds (`619-622`).

#### A. Package / runtime-proof (no real app kind)

**Directories** (`PACKAGE_DIRECTORIES`, `595`): `src`, `test`, `docs`. Plus `stories` if `--with-stories-tsconfig` (`596`, `600-601`).

**Template specs** (`PACKAGE_TEMPLATE_SPECS`, `349-377`):

| Template | Output |
| --- | --- |
| `tsconfig.json.hbs` | `tsconfig.json` |
| `tsconfig.test.json.hbs` | `tsconfig.test.json` |
| `src-index.ts.hbs` | `src/index.ts` |
| `LICENSE.hbs` | `LICENSE` |
| `README.md.hbs` | `README.md` |
| `AGENTS.md.hbs` | `AGENTS.md` |
| `docgen.json.hbs` | `docgen.json` |
| `vitest.config.ts.hbs` | `vitest.config.ts` |
| `docs-index.md.hbs` | `docs/index.md` |

Stories extras (`379-390`): `tsconfig.stories.json.hbs` → `tsconfig.stories.json`; `stories-tsconfig.json.hbs` → `stories/tsconfig.json`.

**Plus** generated `package.json`, `test/.gitkeep` (empty), `CLAUDE.md → AGENTS.md`.

`PACKAGE_FILES` listing used by dry-run/summary (`515-528`) matches that set, including the symlink line.

#### B. Next.js (`--type app --app-kind nextjs`)

**Directories** (`597`): `src`, `src/app`, `test`.

**Template specs** (`NEXTJS_APP_TEMPLATE_SPECS`, `392-428`):

| Template | Output |
| --- | --- |
| `app-next-tsconfig.json.hbs` | `tsconfig.json` |
| `app-next-next-env.d.ts.hbs` | `next-env.d.ts` |
| `app-next-next.config.ts.hbs` | `next.config.ts` |
| `app-next-src-app-globals.css.hbs` | `src/app/globals.css` |
| `app-next-src-app-layout.tsx.hbs` | `src/app/layout.tsx` |
| `app-next-src-app-page.tsx.hbs` | `src/app/page.tsx` |
| `LICENSE.hbs` | `LICENSE` |
| `app-real-README.md.hbs` | `README.md` |
| `app-real-AGENTS.md.hbs` | `AGENTS.md` |
| `app-next-vitest.config.ts.hbs` | `vitest.config.ts` |
| `app-next-test-app.test.tsx.hbs` | `test/app.test.tsx` |

No `src/index.ts`, no `docgen.json`, no `tsconfig.test.json`, no `docs/`. Tests assert those absences (`create-package.test.ts:588-600`).

`package.json` scripts use `portless ${name}.beep next dev --turbopack`, `next build --turbopack`, `next start`, `tsgo -b tsconfig.json`, biome, vitest (`1461-1500`). Dependencies: `next`, `react`, `react-dom` from catalog; testing-library / jsdom / typescript as devDeps. **No `exports` / `files` / `publishConfig` / `docgen`.**

#### C. Tauri (`--type app --app-kind tauri`)

**Directories** (`598`): `src`, `test`, `src-tauri`, `src-tauri/capabilities`, `src-tauri/src`.

**Template specs** (`TAURI_APP_TEMPLATE_SPECS`, `430-486`):

| Template | Output |
| --- | --- |
| `app-tauri-tsconfig.json.hbs` | `tsconfig.json` |
| `app-tauri-index.html.hbs` | `index.html` |
| `app-tauri-src-App.tsx.hbs` | `src/App.tsx` |
| `app-tauri-src-main.tsx.hbs` | `src/main.tsx` |
| `app-tauri-vite.config.ts.hbs` | `vite.config.ts` |
| `app-tauri-vitest.config.ts.hbs` | `vitest.config.ts` |
| `app-tauri-test-App.test.tsx.hbs` | `test/App.test.tsx` |
| `app-tauri-src-tauri-Cargo.toml.hbs` | `src-tauri/Cargo.toml` |
| `app-tauri-src-tauri-build.rs.hbs` | `src-tauri/build.rs` |
| `app-tauri-src-tauri-tauri.conf.json.hbs` | `src-tauri/tauri.conf.json` |
| `app-tauri-src-tauri-capabilities-default.json.hbs` | `src-tauri/capabilities/default.json` |
| `app-tauri-src-tauri-src-main.rs.hbs` | `src-tauri/src/main.rs` |
| `app-tauri-src-tauri-src-lib.rs.hbs` | `src-tauri/src/lib.rs` |
| `LICENSE.hbs` | `LICENSE` |
| `app-real-README.md.hbs` | `README.md` |
| `app-real-AGENTS.md.hbs` | `AGENTS.md` |

`package.json` scripts: portless-wrapped Vite `dev`, `dev:tauri`, `vite build` (`1503-1545`). Dependencies: `@tauri-apps/api`, `react`, `react-dom`; dev: `@tauri-apps/cli`, `@vitejs/plugin-react`, `vite`, testing-library, jsdom. Same "no package API" rule as Next.

Tauri `tauri.conf.json` already points `devUrl` at `http://{{kebabCase name}}.beep.localhost:1355` (`app-tauri-src-tauri-tauri.conf.json.hbs:8`) — the portless convention is baked in.

#### D. Manifest variants for packages

Shared `baseManifest` (`1446-1458`): `name: @beep/${name}`, `version: 0.0.0`, `type: module`, `private: true`, `license: MIT`, `description`, GitHub homepage/repository with `directory: packagePath`.

**Ordinary library/tool/runtime-proof** (`1601-1635`): `beep` metadata if family known; `sideEffects: []`; source exports (`"."`, `"./*"`, `"./internal/*": null`); `files` includes `src/**/*.ts` + dist; publishConfig remaps to `dist`; scripts include babel, `beep:check:tests`, integration test, `docgen` via `toRootRelative` path to `packages/tooling/tool/docgen/src/bin.ts`; deps `effect: catalog:` plus optional `@effect/platform-node`.

**Ecosystem** (`1364-1404`, selected at `1588-1598`): requires root `package.json` catalog `effect` exact version (`1248-1258`). `sideEffects: false`; narrower exports (no `./*`); `files` dist-only; `peerDependencies.effect` pinned to catalog version; `devDependencies.effect: catalog:`. Tsconfigs inject `@effect/language-service` plugin JSON (`ECOSYSTEM_EFFECT_LANGUAGE_SERVICE_PLUGINS`, `126-242`, `1224`) and `stripInternal` (`tsconfig.json.hbs:8-10`).

**Stories** (`1556-1563`): `beep:check` also runs `beep:check:stories` = `tsc -p tsconfig.stories.json --noEmit`.

### 1.6 Every config / registration the command updates

After `executePlan` (`1303`) the write path does four things (`1305-1314`):

1. **`ensureRootWorkspaceEntry(repoRoot, packagePath)`** (`828-849`). Reads root `package.json`, extracts workspaces as either a string array or `{ packages: string[] }` (`730-757`). Coverage test is **exact segment-count glob match** (`761-781`): `*` matches one segment; there is no `**`. If uncovered, appends a literal `"<packagePath>"` entry (array or `workspaces.packages`). Live repo workspaces list apps **individually** (`package.json:450-452`, `500-501`) and use family globs like `packages/foundation/*/*`, `packages/drivers/*`, `packages/ecosystem/*`, `packages/tooling/library/*` (`437-449`). There is no `apps/*` and no `apps/experiments/*`.

2. **`ensureIdentityPackageRegistration(identityPackagesFilePath, name)`** (`IdentityRegistration.ts:144-164`). Resolves `@beep/identity` via `getWorkspaceDir` to `src/packages.ts` (`111-121`, `IDENTITY_PACKAGES_EXPORT_PATH = ["src", "packages.ts"]`). ts-morph finds `generatedComposers` or `composers`, adds `"<name>"` to `$I.compose(...)` if missing, and appends a typed `export const $PascalNameId: Identity.IdentityComposer<"@beep/<name>"> = composers.$PascalNameId` (`73-93`, `160-163`). This is a **package-level identity composer**, not per-entity IDs. Apps are included (lint comment: "apps included", `IdentityRegistry.ts:5`; live file already has `"oip-web"`, `"professional-desktop"`, `"architecture-lab-proof"` at `packages.ts:84`, `103`, `125`).

3. **`syncTsconfigAtRoot(repoRoot, { mode: "sync", filter: undefined, verbose: false })`** (`1307-1311`). This is the real root-config writer. It:

   - Discovers every workspace via `resolveWorkspaceDirs` (`TsconfigSync.plan.ts:285`).
   - Derives alias targets **only if `package.json.exports` has a resolvable root export** (`311-315`). Next/Tauri manifests have no `exports`, so they get **no** `@beep/<app>` / `@beep/<app>/*` aliases. Tests lock that (`create-package.test.ts:607-609`, `670-672`). Runtime-proof *does* get aliases (`714-717`) because it has package exports.
   - Rewrites `tsconfig.packages.json` `references` to the sorted set of workspaces that have a project `tsconfig.json` (`447-474`). This is reconstructive: extras are removed, missing are added.
   - Rewrites root `tsconfig.json` `compilerOptions.paths` for canonical `@beep/*` keys (`606-661`). Keys present but no longer expected are **deleted** (`625-641`).
   - Rewrites `syncpack.config.ts` `source: [...]` from workspace globs (`680-699`, `240-241`).
   - Per-package: topological tsconfig project references from the dependency index (`814-928`); preserves extra existing refs that still resolve (`889-890`).
   - Per-package: if `docgen.json` exists, merge managed fields (`946-988`). Next/Tauri have no docgen file, so this is a no-op for those apps.

   `ConfigUpdater.updateTsconfigPackages` / `updateTsconfigPaths` do a *subset* of (3) (add-only, never remove, always assume `./src/index.ts` aliases via `buildCanonicalAliasTargets`, `ConfigUpdater.ts:209-217`, `283-372`). The live command does not call them.

4. **`refreshBunLockfile`** unless `--skip-lockfile` (`856-871`, `1312-1315`): `bun install --lockfile-only` in repo root; non-zero exit is a `DomainError`. Tests default to appending `--skip-lockfile` (`create-package.test.ts:27-30`) and have one dedicated lockfile test (`465-486`).

**Not written by create-package (but relevant to "every config surface" for delete):**

- `turbo.json` — task graph is global; turbo discovers workspaces from `package.json`. No per-app turbo registration in the scaffold. Existing apps `professional-desktop` and `storybook` have local `turbo.json` files the generator does not emit.
- `knip.jsonc` — workspace overrides are hand-authored (`knip.jsonc:5-63`). Default `packages/**` entry heuristic would not automatically cover `apps/experiments/*`.
- Root catalog — create-package *consumes* `catalog:` keys (`next`, `react`, `vite`, `@tauri-apps/api`, …). It never adds catalog entries. Those keys already exist (`package.json` catalog includes `next` `218`, `vite` `264`, `@tauri-apps/api` `132`).
- Portless host table — scripts invoke `portless <name>.beep …` (`1467`, `1509`). No separate portless config file is written; hostname is derived from the unscoped name.
- Biome / CI matrices / GitHub workflows — untouched.
- Architecture operation plans — untouched.
- `TsMorphIntegrationService` kinds `add-entity-id-export`, `wire-persistence`, `wire-data-access` (`TsMorphIntegrationService.ts:33-37`) — unused. Entity-id registration is **not** part of create-package today.

### 1.7 Dry-run and check modes

**Create-package `--dry-run`** (`1164-1201`):

- Does **not** refuse an existing directory (existence check is skipped, `1154`).
- Prints type / app-kind / family / kind / dir-name override.
- Prints `filesFor(...)` (the summary list, not a rendered plan).
- Checks `rootWorkspaceEntryNeeded` and `identityPackageRegistrationNeeded` (read-only).
- Does **not** render templates, does **not** call `previewPlan`, does **not** run tsconfig-sync in `dry-run` mode. The dry-run text literally says derived configs "run after scaffolding" (`1197`).
- Does **not** preview lockfile contents; only prints whether lockfile would run (`1198`).

There is **no** `--check` flag on create-package itself.

**Adjacent check/diff surfaces the command does not invoke on dry-run:**

- `checkConfigNeedsUpdate` / `checkConfigNeedsUpdateForTargets` (`ConfigUpdater.ts:395-431`, `503-529`, `592-605`) — read-only drift vs expected *additions*. Add-only; cannot express "this entry should be removed".
- `beep tsconfig-sync --check` / `--dry-run` (`TsconfigSync.command.ts:52-56`, `TsconfigSync.service.ts:135-169`). Check mode fails with `TsconfigSyncDriftError` if any planned change exists (`144-148`). This *is* a reconstructive diff: after deleting a workspace member from disk + `package.json`, a sync/check pass would drop its reference, alias, and syncpack source.
- `beep architecture check --file <plan>` (`Architecture.command.ts:185-197`) diffs an operation plan (missing / differing / unexpected) without writing (`OperationPlanExecution.ts:184-256`).
- `beep lint identity-registry` / `--fix` (`IdentityRegistry.ts:175-246`, `260-272`). Completeness-only: missing slugs. `--fix` calls `registerMissingWorkspaceIdentityPackages`. **No orphan-composer detection.** Deleting a package leaves `$XxxId` and the compose argument in place unless something else removes them.

`FileGenerationPlanService.previewPlan` exists (`618-619`) but the command never calls it.

---

## 2. Template abstraction

### 2.1 Storage

All templates are **flat files** in `commands/CreatePackage/templates/`, named by convention rather than nested by variant:

- Shared package: `tsconfig.json.hbs`, `tsconfig.test.json.hbs`, `src-index.ts.hbs`, `LICENSE.hbs`, `README.md.hbs`, `AGENTS.md.hbs`, `docgen.json.hbs`, `vitest.config.ts.hbs`, `docs-index.md.hbs`, `tsconfig.stories.json.hbs`, `stories-tsconfig.json.hbs`.
- Next prefix `app-next-*` (8 files).
- Tauri prefix `app-tauri-*` (13 files).
- Shared real-app docs: `app-real-README.md.hbs`, `app-real-AGENTS.md.hbs`.

Resolution (`templateDirCandidates`, `63-66`; `resolveCreatePackageTemplateDir`, `92-111`):

1. `<moduleDir>/../../../src/commands/CreatePackage/templates` (source tree when running from `dist/`).
2. `<moduleDir>/templates` (legacy dist-copied fallback).

First existing directory wins; else `DomainError` listing both candidates.

### 2.2 Parameterization

`TemplateSpec` is `{ templateName, outputPath }` (`TemplateService.ts:34-42`). `TemplateRenderRequest` is `{ templateDir, templates, context }` (`86-98`). `createTemplateService` (`181-212`):

- Isolated `Handlebars.create()` environment (`154-163`).
- Helpers: `camelCase`, `pascalCase`, `kebabCase`, `snakeCase` via `@beep/utils/Str`, with unknown args coerced through `UnknownToTemplateHelperString` (`138-160`).
- Compile with `{ noEscape: true }` (`200`) — templates emit raw TS/JSON/Rust.
- One file read + compile per spec; no partials, no layout inheritance, no on-disk template inheritance beyond Handlebars `{{#if}}`.

`TemplateContext` (`CreatePackage.command.ts:650-676`) is the entire parameter bag:

```
name, scopedName, type, description, year, parentDir, packagePath, rootRelative,
family?, kind?, appKind?,
isTool, isApp, isLibrary,
isNextjsApp, isTauriApp, isRuntimeProofApp, isRealApp,
isEcosystem, effectLanguageServicePlugins
```

Built once (`1206-1225`) and spread into `TemplateRenderRequest.context`. Templates that care about variant use `{{#if isEcosystem}}`, `{{#if isNextjsApp}}`, `{{#if isTauriApp}}` (e.g. `tsconfig.json.hbs:8-10`, `app-real-AGENTS.md.hbs:6-12`). Most variant branching is **which `TemplateSpec[]` is selected**, not conditionals inside one mega-template.

### 2.3 "Variant" / app-type today

There **is** an app-type notion: `AppKind` + `templateSpecsFor` / `filesFor` / `directoriesFor` / `generatePackageJson` branches / `nextSteps` (`1344-1356`).

There is **no** generic variant plugin. Adding a kind means editing those four tables plus `VALID_APP_KINDS` plus tests. `runtime-proof` is the escape hatch that reuses package templates under `apps/`.

There is **no standalone `vite` AppKind**. Tauri already ships a Vite + React web shell (`app-tauri-vite.config.ts.hbs`, `vite.config.ts` output, `beep:build: vite build`). A browser-only Vite app would be a new kind (or a stripped tauri kind without `src-tauri`).

### 2.4 What it would take to add nextjs / vite / tauri

**Next.js and Tauri already exist** and are tested. Do not re-add them. Gaps vs production apps (`apps/oip-web`, `apps/professional-desktop`):

- Next scaffold is a *starter*: empty `next.config.ts`, no `postcss.config.mjs`, no `components.json`, no `public/`, no `src/runtime/`, no `tsconfig.next.json`, no PWA/serwist, no catalog-wired `@beep/ui`.
- Tauri scaffold is a *starter*: no icons, no `Cargo.lock`, no sidecar/scripts, no `turbo.json`, Vite config has no HMR/portless extras beyond a comment, `bundle.icon: []`.
- Neither scaffold writes a local `turbo.json`.
- Neither adds knip workspace overrides.

**Standalone Vite** (the missing variant) would require, localized to this command:

1. Add `"vite"` to `VALID_APP_KINDS` (`120`) and `AppKind` LiteralKit.
2. New `VITE_APP_TEMPLATE_SPECS` / `VITE_APP_FILES` / `VITE_APP_DIRECTORIES`. Practical reuse: copy the tauri *web* subset (`index.html`, `src/App.tsx`, `src/main.tsx`, `vite.config.ts`, `vitest.config.ts`, `test/App.test.tsx`, `app-tauri-tsconfig.json.hbs`, `app-real-*`, `LICENSE`) and drop all `src-tauri/*`.
3. New `generatePackageJson` branch: portless `vite` `dev`/`build` without `dev:tauri` / `@tauri-apps/*`. Catalog already has `vite`.
4. Extend `templateSpecsFor` / `filesFor` / `directoriesFor` / `isRealAppKind` / `nextSteps` / `TemplateContext` (`isViteApp`).
5. Tests mirroring the Next/Tauri cases (no exports, no root aliases, files exist, identity registered).
6. Optional: `--parent-dir` default for experiments (see §3) rather than `apps/`.

Invasiveness: **medium, localized**. No change to TemplateService, FileGenerationPlanService, ConfigUpdater, or IdentityRegistration. The abstraction is "add another `AppKind` arm", not a new template engine.

**Enforcing repo laws on experimental apps** is already mostly free if they go through this command:

- `private: true`, MIT, `@beep/<name>`, portless `dev`, `beep:check`/`beep:test`/`beep:lint`, vitest via shared `vitest.shared.ts`, biome scripts, identity composer, workspace entry, tsconfig-sync.
- Real apps keep internals behind `@/*` and do not publish `@beep/<app>` (locked by ARCHITECTURE.md `61-66` and tests).
- Runtime-proof is the explicit exception that *does* publish a package API.

Laws the scaffold does **not** auto-enforce: schema-first lint, Effect v4 import style inside the generated `page.tsx`/`App.tsx` (those files are plain React), catalog completeness for new deps, knip entries, browser-qa-loop wiring.

---

## 3. Where the target directory is decided

**Decision site:** `CreatePackage.command.ts:1101-1151`.

```
dirName = --dir-name || name
parentDir = --parent-dir || defaultParentDir(family, kind, type)
packagePath = `${parentDir}/${dirName}`
outputDir = path.join(repoRoot, packagePath)
```

`FileGenerationPlan.outputDir` is that absolute path (`1271-1274`). All planned paths are relative to it and traversal-checked (`FileGenerationPlanService.ts:20-74`, `418-518`).

### 3.1 Can it emit into `apps/experiments/<name>` today?

**Yes, for apps, via `--parent-dir apps/experiments`.**

- `--type app` forbids `--family` (`994-997`), so the `--family`/`--parent-dir` mutex (`1110-1114`) does not fire.
- `ParentDir` accepts `apps/experiments` (`125`, `327-333`).
- `packagePath` becomes `apps/experiments/<dirName>`.
- Workspace matcher will **not** treat that as covered by `apps/oip-web` or any current glob (segment counts differ; there is no `apps/*` or `apps/experiments/*`). `ensureRootWorkspaceEntry` will append the literal `"apps/experiments/<name>"` (`828-848`).
- `toRootRelative("apps/experiments/foo")` is `../../../`, which is correct for `extends` / docgen / vitest.shared imports.
- Identity and tsconfig-sync are path-agnostic once the workspace exists.
- Next/Tauri still get no root aliases (no exports). Runtime-proof would get `./apps/experiments/<name>/src/index.ts` aliases.

**Not first-class.** Default app parent is still `apps` (`1129`). There is no `--experiment` flag, no `apps/experiments/*` workspace glob, no knip/turbo special case, and no test covering a nested app parent.

**Not available via `--family`.** Families always derive `packages/…` parents and reject `--parent-dir`.

### 3.2 Hard-coded `packages/` assumptions

| Site | Assumption | Blocks `apps/experiments`? |
| --- | --- | --- |
| `defaultParentDir` family arms (`1120-1128`) | All non-app families live under `packages/<family>[/<kind>]` | No — apps skip this |
| Fallback `packages/tooling/library` (`1132`) | Bare create-package is a tooling library | No — apps don't hit fallback |
| `--family` + `--type app` illegal (`994-997`) | Apps are not a family | Forces `--parent-dir` for nested app roots |
| `matchesWorkspacePattern` (`761-777`) | One `*` per segment; no `**` | Nested `apps/experiments/*` needs its own glob or a literal entry |
| Live `package.json` workspaces (`433-501`) | Apps listed one-by-one; packages use family globs | New experiment apps always append a literal until a glob is added |
| `ConfigUpdater` JSDoc / defaults (`66`, `209-217`) | Examples and default aliases assume `packages/…/src/index.ts` | Unused by live command; would mis-alias a Next app if someone called it |
| `docgen` script (`1581`) | `packages/tooling/tool/docgen/src/bin.ts` via `rootRelative` | Fine at any depth |
| `docgen.json.hbs` schema path (`docgen.json.hbs:2`) | `{{rootRelative}}packages/tooling/tool/docgen/schema.json` | Fine at any depth |
| Architecture `pathForRole` (`RoleTopology.ts:210-213`) | Slices → `packages/<ctx>/<role>`; proof → `apps/<ctx>-proof` | Separate command; would not place experiments |
| Knip `packages/**` (`knip.jsonc:6`) | Library entry heuristic is packages-only | New apps need an `apps/**` or per-app knip block if knip should analyze them |
| Ecosystem polarity (`EcosystemPolarity.ts:22`) | Hard `packages/ecosystem` root | Irrelevant to apps |

Nothing in FileGenerationPlanService, TemplateService, or IdentityRegistration assumes `packages/`. Path safety is "relative to `outputDir`", not "must be under `packages/`".

---

## 4. Extension-point assessment

### 4.a New target root `apps/experiments`

**Goal.** First-class `apps/experiments/<name>` for experimental end-to-end apps.

| Module / schema | Change | Invasiveness |
| --- | --- | --- |
| `CreatePackage.command.ts` `defaultParentDir` (`1117-1133`) | Optionally default real apps (or a new `--experiment` / `--app-kind` subset) to `apps/experiments` instead of `apps` | **Low** — one arm in the `O.firstSomeOf` list |
| `ParentDir` / `PARENT_DIR_PATTERN` (`125`, `327-333`) | Already accepts `apps/experiments`. No change | **None** |
| `package.json` `workspaces` | Add `"apps/experiments/*"` so create-package stops appending literals and delete-package can rely on the glob | **Low**, but it is a root-manifest policy change |
| `syncpack.config.ts` | Auto-follows workspaces via tsconfig-sync (`240-241`, `680-687`). No hand edit if the glob is added | **None** after workspace glob |
| `tsconfig.packages.json` / root aliases | Auto via tsconfig-sync after the workspace exists | **None** |
| `knip.jsonc` | Add `apps/experiments/**` (or inherit a future `apps/**`) if experiments should be analyzed; otherwise add `apps/experiments/**` to `ignore` | **Low–medium** (policy choice) |
| `turbo.json` | No registration needed; turbo sees bun workspaces | **None** |
| `CreatePackage.command.ts` tests | New case: `--type app --app-kind nextjs --parent-dir apps/experiments` (or the new default) asserts path, workspace glob vs literal, no root aliases | **Low** |
| Architecture `pathForRole` (`RoleTopology.ts:211`) | Do **not** conflate experiments with `apps/<slice>-proof` | **None** if kept separate |
| Identity | No change; slug is the unscoped name regardless of path | **None** |
| TemplateService / FileGenerationPlanService / ConfigUpdater | No change | **None** |

**Recommended shape.** Keep `--parent-dir apps/experiments` working (it already does). For a first-class system, add a workspace glob `apps/experiments/*` and either (i) a boolean `--experiment` that overrides the app default parent, or (ii) change the app default parent and migrate durable apps (`oip-web`, `professional-desktop`, …) as explicit exceptions. Changing the default without a glob will litter `package.json` workspaces with one line per experiment — which is actually *better* for delete (literal to remove) and *worse* for create (noise). A glob is better for create and requires delete to *not* remove the glob.

**Could you do it with zero code?** Yes: `bun run beep create-package my-spike --type app --app-kind nextjs --parent-dir apps/experiments`. That is the smallest path to the exploration mission's (1).

### 4.b Variant templates (nextjs / vite / tauri)

| Module / schema | Change | Invasiveness |
| --- | --- | --- |
| `VALID_APP_KINDS` / `AppKind` (`120`, `253-266`) | Add `"vite"` only. `nextjs` and `tauri` already exist | **Low** |
| `NEXTJS_APP_TEMPLATE_SPECS` / `TAURI_APP_TEMPLATE_SPECS` (`392-486`) | Pattern to copy for `VITE_APP_TEMPLATE_SPECS` | **Low** |
| `filesFor` / `directoriesFor` / `gitkeepFilesFor` / `isRealAppKind` (`533-628`) | One more arm each | **Low** |
| `generatePackageJson` (`1461-1546`) | One more `appKindIs(..., "vite")` branch; drop Tauri deps/scripts | **Low** |
| `TemplateContext` (`650-676`) | Optional `isViteApp` if templates need it; otherwise unused | **Low** |
| `templates/` | New `app-vite-*.hbs` **or** reuse `app-tauri-*` web files via extra `TemplateSpec` rows pointing at existing filenames | **Low** if reused; **medium** if forked |
| `templateSpecsFor` (`493-507`) | Third `if` (or a `LiteralKit` map). Current if-chain is the extension seam | **Low**, but a `Record<AppKind, TemplateSpec[]>` would scale better |
| `create-package.test.ts` | Clone the Next/Tauri test (`564-679`) | **Low** |
| `TemplateService.ts` | No change unless you want template inheritance / variant directories | **None** (keep flat files) |
| Catalog / `package.json` | `vite` already catalogued | **None** unless new deps |
| ARCHITECTURE.md `61-66` | Already states Next/Tauri are non-exporting apps | **None** for Vite if it follows the same rule |

**Invasiveness overall: low–medium, confined to `CreatePackage.command.ts` + `templates/` + tests.** Do not invent a new template engine. The missing piece is Vite-only, not Next/Tauri.

**If variants should live under `apps/experiments` by default,** combine 4.a + 4.b: `appKind` selects files; an experiment flag/parent selects path. Keep those axes independent — a durable Next app in `apps/oip-web` and an experimental Next app in `apps/experiments/foo` share templates.

### 4.c Sibling `delete-package` reusing services in reverse

There is no delete command and no reverse API on the create-package services. A sibling command is the right shape (register next to `createPackageCommand` in `Root.ts:84` and `src/index.ts:103`).

**What can be reused as-is**

| Capability | Module | How to reuse |
| --- | --- | --- |
| Discover workspaces | `resolveWorkspaceDirs` / `CreatePackageIdentityRegistration.collectWorkspaceIdentityEntries` (`IdentityRegistration.ts:266-281`) | Resolve `@beep/<name>` → directory |
| Reconstruct root tsconfig + syncpack after the member is gone | `syncTsconfigAtRoot(..., { mode: "sync" })` (`TsconfigSync.service.ts:79-172`) | **This is the inverse of create-package's step 3.** After the directory and workspace entry are removed, sync drops references, aliases, and syncpack sources |
| Preview that reconstruction | `syncTsconfigAtRoot(..., { mode: "dry-run" \| "check" })` | Check mode already diffs rather than writes |
| Safe path joins / repo root | `findRepoRoot`, `Path` | Same as create |
| JSONC edit primitive | `internal/cli/Jsonc.ts` (`applyJsoncModification`) | Workspace-array deletion needs a new helper next to `appendWorkspaceEntry` (`796-826`) |
| Identity file path + accessor name | `resolveIdentityPackagesFilePath`, `toIdentityAccessorName`, `accessorExportPattern` | Locate what to delete |
| Architecture file delete primitive | `ensure-absent-path` (`OperationPlanExecution.ts:143-160`) | Pattern for "remove this path if present"; not package-aware |
| Dry-run printing | `printLines` | Mirror create-package dry-run |

**What must be written (no inverse exists)**

| Surface | Today | Required for delete | Invasiveness |
| --- | --- | --- | --- |
| Package directory | `FileGenerationPlanService` only mkdir/write/symlink (`172`, `234-237`). Execute can `remove` a path only to *replace* a non-symlink with a symlink (`690-699`) | Recursive delete of `outputDir` (and refuse to delete outside repo / refuse `packages/foundation/modeling/identity`) | **New action kind or a dedicated Effect.** Medium if added to FileGenerationPlanService; lower if delete-package uses `FileSystem.remove` directly |
| Root `workspaces` entry | `ensureRootWorkspaceEntry` / `rootWorkspaceEntryNeeded` are add/check-only (`828-854`) | Remove a literal entry. **Do not** remove a covering glob (`packages/drivers/*` must stay when deleting one driver) | **Medium.** New `removeRootWorkspaceEntry` next to `appendWorkspaceEntry`. Must distinguish glob-covered vs literal |
| Identity compose arg + `$XxxId` export | `ensureIdentityPackageRegistration` only adds (`144-164`). Lint only reports missing (`196-204`, `IdentityRegistry.ts:196-204`) | ts-morph: remove the string literal argument; remove the `export const $XxxId` statement (and its JSDoc). Handle `generatedComposers` vs `composers` | **Medium.** Natural home: `IdentityRegistration.ts` as `removeIdentityPackageRegistration`. Also extend identity-registry lint with an `orphan-registration` kind so extras fail CI |
| `ConfigUpdater` | Add-only refs/aliases (`283-372`). Check is "needs add?" (`395-431`) | Either unused (prefer tsconfig-sync reconstruct) or add `removeTsconfigPackages` / `removeTsconfigPaths` | **Low if unused;** do not grow ConfigUpdater unless you abandon tsconfig-sync |
| `TsMorphIntegrationService` | Stub, skip-only (`294-327`) | Do not build delete on this | **Avoid** |
| `bun.lock` | `refreshBunLockfile` (`856-871`) | Same `bun install --lockfile-only` after workspace removal | **Reuse as-is** |
| Dependent packages' tsconfig refs | tsconfig-sync `planPackageReferenceSync` drops refs whose target no longer exists (`754-766`, `869-890`) | Reuse sync | **None** |
| Dependent `package.json` deps on `@beep/<name>` | **Not handled by create or sync** | Delete should either fail if workspace dependents remain, or strip `workspace:^` deps | **Medium–high.** New policy. Create never wrote reverse deps, but humans will have added them |
| Knip / local turbo.json / catalog leftovers | Not written by create | Optional sweep; catalog keys must **not** be removed just because one app used them | **Low** (document as out of scope) or **medium** if in scope |
| CLI registration | `Root.ts` / `src/index.ts` | New `deletePackageCommand` | **Low** |
| Schemas | `PackageName`, `ParentDir`, `AppKind` stay | New `DeletePackageTarget` / `DeletePlan` if you want a typed plan (mirror `FileGenerationPlan` with `rmdir` / `edit-jsonc` / `edit-ts`) | **Medium** if you want plan/preview parity |

**Suggested delete pipeline (mirrors create, inverted):**

1. Resolve target by unscoped name **or** repo-relative path (both needed: two packages cannot share a name today because identity slugs are the name, but path is what workspaces use).
2. Dry-run: print directory, whether workspace entry is literal vs glob-covered, whether identity export exists, `tsconfig-sync --dry-run` after a simulated workspace removal (or just list the files sync would touch).
3. Guard: refuse identity itself; refuse non-empty dependents unless `--force`; refuse paths outside repo.
4. `FileSystem.remove(outputDir, { recursive: true })`.
5. Remove literal workspace entry if present.
6. `removeIdentityPackageRegistration`.
7. `syncTsconfigAtRoot(mode: "sync")`.
8. `bun install --lockfile-only` unless `--skip-lockfile`.

**Invasiveness overall: medium.** The expensive new work is (workspace literal vs glob), (identity unregister + orphan lint), and (dependent-edge policy). Tsconfig/syncpack/docgen inverse is already `tsconfig-sync`. Do not reverse ConfigUpdater; it is not on the write path.

**Modules that must change for a complete delete:**

- New: `commands/DeletePackage/DeletePackage.command.ts` (+ maybe `WorkspaceEntry.ts` extracted from create-package's `ensureRootWorkspaceEntry` so both commands share match/append/remove).
- Edit: `CreatePackage/internal/IdentityRegistration.ts` (add remove + orphan listing).
- Edit: `Lint/IdentityRegistry.ts` (orphan-registration violations).
- Edit: `Root.ts`, `src/index.ts`.
- Extract (optional but high leverage): hoist `readRootPackageJsonDocument` / `workspacePatternsFromPackageJson` / `matchesWorkspacePattern` out of `CreatePackage.command.ts` — they are duplicated with `TsconfigSync.plan.ts:187-209` (both carry a fallow `code-duplication` ignore). Delete-package would be the third copy if not extracted.
- Tests: new `delete-package.test.ts` using the same temp-repo harness as `create-package.test.ts`.

---

## 5. Existing inverse / check / diff paths a delete command can reuse

### 5.1 Reuse with high confidence

1. **`syncTsconfigAtRoot` reconstructive sync** (`TsconfigSync.service.ts:99-171`, planners `447-699`). After the workspace member is gone, `planRootReferenceSync` rebuilds `tsconfig.packages.json` from remaining workspaces with a project tsconfig (`454-459`). `planRootAliasSync` **deletes** canonical `@beep/*` keys that no longer have a workspace (`625-641`). `planRootSyncpackSync` rebuilds sources from remaining workspace globs (`686-687`). `planPackageReferenceSync` drops refs whose target path no longer exists (`766-769`). This is the closest thing the repo has to "undo create-package's derived configs".

2. **`tsconfig-sync --check` / `--dry-run`** (`TsconfigSync.command.ts:52-56`). Check fails closed on drift (`TsconfigSync.service.ts:144-148`). Delete-package `--dry-run` can compose this after a planned workspace edit, or instruct the operator to run it.

3. **`identityPackageRegistrationNeeded`** (`IdentityRegistration.ts:182-196`) and **`missingIdentityRegistrations`** (`240-247`). Read-only "is this slug present?". Useful for dry-run ("would unregister $FooId") but they do not implement removal.

4. **`rootWorkspaceEntryNeeded`** (`851-854`). Read-only "is this path covered?". Delete needs the inverse question: "is there a *literal* entry equal to this path?" — same matcher, new predicate.

5. **`refreshBunLockfile`** (`856-871`). Symmetric.

6. **Architecture `ensure-absent-path` + check `unexpected`/`absent`** (`OperationPlanExecution.ts:143-160`, `234-241`). Proven recursive delete with repo-escape guards (`39-50`). Could be called as a one-off operation, or the delete command can copy the guard. Architecture apply will **not** unregister workspaces or identity.

7. **FileGenerationPlanService path containment** (`418-518`, `766-775`). Reuse the "resolved path must stay inside root" logic if delete accepts a relative path.

8. **`lint identity-registry --fix`** (`IdentityRegistry.ts:187-193`). Only the *add* direction. After delete, running `--fix` would **re-add** the slug if the workspace directory still exists. Order matters: delete directory + workspace first, then unregister, then lint.

### 5.2 Do not treat as inverses

1. **`ConfigUpdater.update*` / `checkConfigNeedsUpdate*`.** Add-only, unused by create's write path, default aliases assume `src/index.ts` (wrong for Next/Tauri). `checkConfigNeedsUpdate` returning `{ tsconfigPackages: false, tsconfigPaths: false }` means "already added", not "safe to delete".

2. **`TsMorphIntegrationService`. ** No adapter; all mutations skip. Kinds include `add-entity-id-export` but create-package never emits entity IDs.

3. **`FileGenerationPlanService.executePlan`.** Idempotent write/skip; not a delete planner. The only `fs.remove` is symlink replacement (`690-699`).

4. **Create-package `--dry-run`.** Does not preview tsconfig-sync or rendered file contents. Copying its shape for delete would miss the reconstructive sync unless you add it.

5. **`registerMissingWorkspaceIdentityPackages`** (`301-322`). Bulk *add*. The inverse would be "remove composers whose slug is not in `collectWorkspaceIdentityEntries`" — that function does not exist. It would be the right orphan cleaner after a manual `rm -rf`.

6. **Purge command** (`Purge.command.ts`). Removes build artifacts (`node_modules`, `.turbo`, `dist`), not packages.

### 5.3 Check-mode inventory (diff rather than write)

| Command | Diff? | Writes? | Useful to delete? |
| --- | --- | --- | --- |
| `beep create-package --dry-run` | Lists intended files + workspace/identity add | No | Template for delete dry-run text |
| `beep tsconfig-sync --check` | Full reconstructive drift | No; non-zero on drift | **Yes** — post-delete gate |
| `beep tsconfig-sync --dry-run` | Same plan, no fail | No | **Yes** — preview |
| `ConfigUpdater.checkConfigNeedsUpdate` | Add-needed? | No | No |
| `beep architecture check` | Plan vs disk | No | Only if delete is expressed as an architecture plan (not recommended) |
| `beep lint identity-registry` | Missing slugs + local `make(` | `--fix` writes adds | After delete, should be green *if* unregister happened; today leftovers are invisible |

---

## 6. Command registration and test surface (for implementers)

**CLI tree.** `create-package` is a top-level `beep-cli` subcommand, not a group (`Root.ts:63-95`). Description: "Create a new package or app workspace following Effect v4 conventions" (`CreatePackage.command.ts:1360`). Adding `delete-package` is the same one-line `withSubcommands` insert.

**Tests that lock today's contract** (`packages/tooling/tool/cli/test/create-package.test.ts`, 1119 lines):

- Lockfile default (`465-486`).
- Parent-dir package + workspace literal + aliases + syncpack + identity (`491-538`).
- `--type app` without `--app-kind` fails (`544-560`).
- Next.js under `apps/`, no exports, no root aliases, identity yes (`564-618`).
- Tauri under `apps/`, Vite alias `@`, `src-tauri`, no root aliases (`622-679`).
- Runtime-proof under `apps/`, package-like exports + aliases + docgen (`681-723`).
- Foundation family path + glob-covered workspace (no literal append) (`726-779`).
- Stories tsconfig opt-in + dry-run lists those files (`782-847`).
- Stories rejected outside ui-system (`850-876`).
- Tooling family path + literal workspace (no `packages/tooling/*/*` glob in the fixture, and the live repo uses per-kind globs) (`879-967`).
- Drivers flat family + glob-covered (`969-1026`).
- Ecosystem polarity-shaped manifest + language-service plugin (`1028-1118`).

Security tests (`create-package-security.test.ts`) cover ConfigUpdater idempotency/check and FileGenerationPlanService traversal/symlink containment — i.e. the unused ConfigUpdater and the used planner.

Identity template test (`create-package-identity-template.test.ts:11-29`) pins the ts-morph target (`generatedComposers` ?? `composers`) and the export-block shape so `packages.ts` refactors cannot silently break create-package again.

**There is no test for `--parent-dir apps/experiments`.** That is the cheapest proof to add before treating experiments as a product.

---

## 7. Implications for the two-part exploration mission

### (1) `apps/experiments/*` via `create-package` with nextjs / vite / tauri, still enforcing repo laws

- **Next and Tauri are done** as `--app-kind`s landing in `apps/<name>`. Point them at `apps/experiments/<name>` with `--parent-dir` today.
- **Vite is a new AppKind** cloned from Tauri-minus-Rust. Do not invent a second template system.
- **Repo laws already applied:** identity composer, workspace membership, tsconfig project reference (because they have `tsconfig.json`), syncpack source, portless `dev`, `beep:*` scripts, biome, vitest, no public `@beep/<app>` API for real apps, `private: true`.
- **Repo laws not applied automatically:** knip workspace entries, turbo local config, catalog additions, schema-first / Effect style inside the generated React files, browser-qa-loop.
- **Do not use `--family` for experiments.** Family is the non-slice `packages/` grammar and is illegal on apps. Experiments are apps (or runtime-proof apps), not a fifth family.
- **Do not route experiments through `beep architecture create`. ** That factory emits `packages/<slice>/<role>` + `apps/<slice>-proof` and a different file set (accepted proof templates). Mixing the two will produce slice topology debt the north star is trying to avoid (`standards/ARCHITECTURE.md:32-37`).

### (2) `beep delete-package` that fully prunes every config surface

Create-package's write set is smaller than "every config surface in the repo", and one of its writers is already reconstructive:

| Surface | Create writes? | Delete strategy |
| --- | --- | --- |
| Package / app directory | Yes (plan execute) | New recursive remove |
| `package.json` workspaces | Yes if not glob-covered | New literal-entry remove; leave globs |
| `@beep/identity` `src/packages.ts` | Yes (add slug + export) | New ts-morph remove + orphan lint |
| `tsconfig.packages.json` | Via tsconfig-sync | Re-run tsconfig-sync |
| `tsconfig.json` paths | Via tsconfig-sync (packages / runtime-proof only) | Re-run tsconfig-sync |
| `syncpack.config.ts` | Via tsconfig-sync | Re-run tsconfig-sync |
| Dependent tsconfig refs | Via tsconfig-sync | Re-run tsconfig-sync |
| `docgen.json` | Generated in-package; sync only if present | Goes away with the directory |
| `bun.lock` | `bun install --lockfile-only` | Same |
| Dependent `package.json` deps | No | New policy (fail or strip) |
| knip / turbo / catalog / CI | No | Out of scope unless explicitly added |

**The inverse of create-package is not ConfigUpdater-in-reverse.** It is: delete tree → delete literal workspace → delete identity composer → `tsconfig-sync` → lockfile.

---

## 8. Unused / misleading seams (do not overfit the design to them)

1. **`ConfigUpdater` looks like the config writer in the folder name and test kit. It is not on the live path.** Growing remove-APIs there would fork from tsconfig-sync, which already removes. If anything, ConfigUpdater is a candidate to delete or to become a thin wrapper around tsconfig-sync planners.

2. **`TsMorphIntegrationService` looks like the identity/entity/persistence integration point. It is a skip-stub.** Real identity edits go through `TSMorphService.updateSourceFile` in `IdentityRegistration.ts`. Entity IDs are not created here; do not plan delete-package around `add-entity-id-export`.

3. **`FileGenerationPlanService.previewPlan` is unused.** Dry-run prints the static `filesFor` list, which can drift from the plan (e.g. `package.json` is in the list but is not a template; CLAUDE.md is listed as prose). A delete plan should not copy that drift.

4. **`TemplateService` is not variant-aware.** Variants are arrays of `TemplateSpec` in the command file. Keep it that way.

5. **Architecture `create package` is not create-package.** Same English words, different factory, different path grammar, different files. A `delete-package` that walked architecture plans would miss everything create-package writes and vice versa.

6. **Create-package has no prompts.** A future interactive "which variant? experiments or durable?" layer would be new UX, not an extension of existing Prompt code.

---

## 9. File-level citation index

| Claim | Citation |
| --- | --- |
| Command name + flags | `CreatePackage.command.ts:893-934` |
| App kinds nextjs/tauri/runtime-proof | `CreatePackage.command.ts:120`, `253-266`, `968-972` |
| Families + kinds | `CreatePackage.command.ts:121-123`, `268-315`, `1006-1048` |
| App default parent `apps` | `CreatePackage.command.ts:1129` |
| Family parents under `packages/` | `CreatePackage.command.ts:1117-1128` |
| `--family` illegal with apps | `CreatePackage.command.ts:994-997` |
| `--parent-dir` illegal with `--family` | `CreatePackage.command.ts:1110-1114` |
| ParentDir allows `apps/experiments` | `CreatePackage.command.ts:125`, `327-333`, `1135-1138` |
| Workspace glob = same-length segments | `CreatePackage.command.ts:761-781` |
| Template spec tables | `CreatePackage.command.ts:349-507` |
| File/dir tables | `CreatePackage.command.ts:515-617` |
| Dry-run body | `CreatePackage.command.ts:1164-1201` |
| Write path: plan → workspace → identity → sync → lockfile | `CreatePackage.command.ts:1302-1315` |
| Next/Tauri package.json | `CreatePackage.command.ts:1461-1545` |
| Ecosystem package.json | `CreatePackage.command.ts:1364-1404` |
| Template helpers | `TemplateService.ts:154-204` |
| Plan actions mkdir/write/symlink only | `FileGenerationPlanService.ts:172`, `234-237` |
| ConfigUpdater add-only + check | `ConfigUpdater.ts:283-372`, `395-431` |
| Identity add via ts-morph | `IdentityRegistration.ts:144-164` |
| Identity no remove / lint missing-only | `IdentityRegistration.ts:240-247`; `IdentityRegistry.ts:196-204` |
| TsMorphIntegrationService unused stub | `TsMorphIntegrationService.ts:294-327` |
| Barrel / Root / test kit | `CreatePackage/index.ts:14`; `Root.ts:17`, `84`; `CreatePackage.test-kit.ts:8-10` |
| tsconfig-sync reconstruct + alias delete | `TsconfigSync.plan.ts:447-474`, `606-661`, `680-699` |
| Architecture proof-app path | `RoleTopology.ts:210-213` |
| Architecture delete op | `OperationPlanExecution.ts:143-160` |
| Live workspaces / apps listed individually | `package.json:433-501` |
| Apps are non-exporting | `standards/ARCHITECTURE.md:61-66` |
| Next/Tauri tests (path + no aliases) | `create-package.test.ts:564-679` |
| Runtime-proof aliases | `create-package.test.ts:681-723` |

---

## 10. Bottom line for the other lanes

- Treat **create-package as already variant-capable** (nextjs, tauri, runtime-proof) and **already able to emit under `apps/experiments/<name>`** via `--parent-dir`. The design work is first-class defaults + a Vite kind + a workspace glob, not a new scaffolder.
- Treat **family/kind as the `packages/` grammar** and **architecture roles as a different factory**. Experiments should not grow a new family.
- Treat **tsconfig-sync as the inverse of derived config**, and **identity + workspace literals as the two writers that still need explicit reverse operations**. That is the spine of `delete-package`.
- Do not build delete on ConfigUpdater or TsMorphIntegrationService.
