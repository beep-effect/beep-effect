# P0 Registration-Surface Census Ratification

Date: 2026-08-13

Tree: dedicated P0 worktree after PRs #705, #706, and #690

Authority: `SPEC.md` D1-D14, especially D5-D8

## Method and boundary

This report rechecks every row in research report 02 section 19 and the
derived-versus-committed table in research report 05 section 7 against the
current files. The census is package-lifecycle geometry, not a promise that
every text hit should be mutated. Historical records are observable but are
preserved; local caches are doctor probes but are not committed registrations.

The ratification distinguishes three operations:

- **forward-writer**: creates or registers the surface;
- **inverse-action**: removes, rewrites, regenerates, or deliberately preserves
  it;
- **doctor-probe**: proves that the live state agrees with the declared
  geometry.

## Tree movement since the six-lane census

1. The package roots for the retired courtlistener, DOL, and federal-register
   drivers no longer exist. Their stale entries are also absent from both
   committed JSDoc inventory artifacts, and the local `.beep/ci` mirror is
   absent in this worktree. This supersedes research/05 Appendix A's live
   residue snapshot; the P1 doctor fixture must remain synthetic as SPEC now
   requires.
2. The three dedicated empty changesets still exist, and the three retired-name
   records remain at `standards/changesets.retired-packages.json:16-27`. Those
   are intentional policy records, not filesystem residue.
3. `@beep/ontology` is live again but remains in the retired-name list at
   `standards/changesets.retired-packages.json:8-11`. The geometry must detect
   this live-name/retired-name collision; create must refuse reuse until the
   record is reconciled.
4. PR #690 removed the unused `@beep/protobuf` workspace. There is no exact
   package-name hit in the workspace, TypeScript, syncpack, identity, or
   standards registration surfaces. Research/05 section 11 and Appendix C are
   stale where they call it a remaining deletion candidate. Third-party
   protobuf strings in the lockfile and schema descriptions are unrelated.
5. Line numbers moved. The current high-signal anchors are root workspaces at
   `package.json:433-535`, app project references at
   `tsconfig.packages.json:10-22`, identity composition at
   `packages/foundation/modeling/identity/src/packages.ts:48-193`, and the
   reconstructive planners at
   `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.plan.ts:447-988`.

## Master-table row ratification

Legend: **F** forward-writer, **I** inverse-action, **D** doctor-probe. “Generic”
means the surface has no per-package registration unless a package is named
explicitly.

| Research/02 section 19 row | Current evidence | Ratification and delta | Roles |
| --- | --- | --- | --- |
| Workspace membership | `package.json:433-535`; apps remain explicit at `:450-452,500-501`; drivers at `:474-535` | Confirmed. A covering glob produces no per-lab row; an exact literal must be removed for other targets. | F/I/D |
| Lockfile | representative workspace records `bun.lock:1052-1053,3274`; create refresh is in `CreatePackage.command.ts:856-870` | Confirmed reconstructive snapshot. Exact workspace-name/path checks must distinguish package records from similarly named third-party packages. | F/I/D |
| Root catalog | `package.json:2` | Confirmed non-registration. Report only last-consumer candidates; never prune automatically. | D |
| tsconfig solution refs | `tsconfig.packages.json:10-22`; writer `TsconfigSync.plan.ts:447-474` | Confirmed committed derived surface. Labs are the D5 holdout because TypeScript references have no glob. | F/I/D |
| Root path aliases | current examples `tsconfig.json:1692-1693,1800-1801,1924-1933`; writer `TsconfigSync.plan.ts:606-661` | Confirmed committed derived surface. Non-exporting apps have no alias and labs must preserve that rule. | F/I/D |
| Base tsconfig | `tsconfig.base.json:4` | Confirmed generic; no per-package mutation. | D |
| Package tsconfig refs | writer `TsconfigSync.plan.ts:814-928` | Confirmed derived inside surviving packages; target-local config disappears with the tree. | F/I/D |
| Test/stories tsconfig | template selection `CreatePackage.command.ts:349-390,515-617` | Confirmed owned-tree surface; no shared registration. | F/I/D |
| Syncpack sources | live app rows `syncpack.config.ts:22-24,72-73`; examples at `:104,107`; writer `TsconfigSync.plan.ts:680-700` | Confirmed committed derived surface. A labs workspace glob should yield one glob source, not one source per lab. | F/I/D |
| Turbo tasks | `turbo.json:34-272` | Confirmed generic except named Storybook inputs. Doctor scans explicit target names and paths only. | D |
| App-local turbo config | `apps/professional-desktop/turbo.json:4`, `apps/storybook/turbo.json:4` | Confirmed owned-tree surface. | F/I/D |
| Identity compose plus accessor export | `packages.ts:48-193`; examples `:463-477`; add-only writer `IdentityRegistration.ts:144-164` | Confirmed and still flat. Missing-only lint cannot prove absence of orphans. Labs need a generated, contiguous segment. | F/I/D |
| Identity barrel | `packages/foundation/modeling/identity/src/index.ts:81` | Confirmed generic star export; no per-package edit. | D |
| Biome | `biome.jsonc:13-47` | Confirmed generic. Labs stay included; no exemption row. | D |
| ESLint | `eslint.config.mjs:1-27` | Confirmed generic selection plus global ignores; no package registry. | D |
| Deprecated-API shards | `Lint.command.ts:50-75` | Confirmed explicit prefix registry. It names three apps but not the labs root. One-time labs prefix required. | F/I/D |
| Oxlint and typos | `Quality/Tasks.ts:1682-1699` | Confirmed generic law gates; labs remain included. | D |
| Lefthook, commitlint, CODEOWNERS | `lefthook.yml:6-31`; `commitlint.config.ts`; `.github/CODEOWNERS` | Confirmed generic. Scratchpad exclusions must not be copied to labs. | D |
| Knip config | `knip.jsonc:6-73,185-186` | Confirmed optional explicit override/ignore surface. Labs should remain discovered through workspace membership; no one-time ignore is ratified. | F/I/D |
| Knip baseline | writer anchor `KnipRatchet.ts:26` | Confirmed committed generated inventory. Regenerate only when target-owned findings exist. | I/D |
| Fallow entry config | `.fallowrc.jsonc:11-37,71-73` | Confirmed generic plus explicit globs. Delta: current `apps/*` entry globs do not reach two-level lab apps; P2 must add labs-depth entries without adding labs to `ignorePatterns`. | F/I/D |
| Fallow boundaries | path anchor `Fallow.command.ts:23`; drift check `:444-483` | Confirmed committed generated zone/rule surface. Regenerate, never hand-prune. | F/I/D |
| Fallow health baseline | `standards/fallow.health.regression-baseline.jsonc:1` | Confirmed committed file-keyed inventory. Replacement/tightening writer owns pruning. | I/D |
| Fallow dead-code baseline | `standards/fallow.dead-code.regression-baseline.jsonc:1` | Confirmed committed aggregate inventory. Regenerate only when the measured result changes. | I/D |
| Package docgen config | scanner `Docgen/internal/Workspace.ts:24-38`; tsconfig-sync writer `TsconfigSync.plan.ts:946-988` | Confirmed owned-tree plus derived managed fields. Labs neither scaffold nor admit this file. | F/I/D |
| Package docs | package template `CreatePackage.command.ts:349-377`; docgen discovery `Docgen/internal/Workspace.ts:137-166` | Confirmed owned-tree surface, including ignored artifacts. | F/I/D |
| Aggregate docs | clean/aggregate writer `Docs.aggregate.ts:29,49-67` | Confirmed generated copy surface. Clean rebuild owns removal. | I/D |
| JSDoc inventory | paths `JSDocDocumentationInventory.ts:199-200`; universe filter `:1478-1497` | Confirmed committed pair. Delta: retired-driver stale rows are now absent. Both JSONC and Markdown remain one writer-owned surface. | F/I/D |
| JSDoc totals | `JSDocRatchet.ts:113` | Confirmed aggregate ratchet. Shrink is allowed; snapshot only through its writer. | I/D |
| Schema-first inventory | path `Lint.schemas.ts:34`; write flag `SchemaFirst.ts:383` | Confirmed committed file/symbol inventory. Deleted live findings become stale entries and must be regenerated. | F/I/D |
| Schema catalog | path `SchemaCatalog.ts:33` | Confirmed committed generated catalog. Regenerate when target-owned schemas existed. | F/I/D |
| Schema-crispening policy | path `Lint.schemas.ts:50` | Confirmed authored family/owner policy. Remove only an exact owner override; labs inherit the existing apps policy. | F/I/D |
| Effect-laws allowlist | `Laws/AllowlistCheck.ts:38` | Confirmed authored exception inventory. Remove target-file rows; never rewrite historical rationale unrelated to the target. | F/I/D |
| Test-typecheck baseline | `PackageTestTypecheck.ts:54-56` | Confirmed committed membership ratchet. Labs must typecheck tests and must not enter this baseline. | F/I/D |
| Coverage baseline | `CoverageRegression.ts:32,383-395,509-525` | Confirmed committed replacement surface. PR #690 added tiered coverage policy work, but the deletion rule is unchanged: unscoped replacement prunes dead packages; merge preserves them. | F/I/D |
| Coverage weights | `CoverageScope.ts:21` and the current scope planner | Confirmed optional authored tuning. Remove an exact target key; absence falls back to default. | F/I/D |
| CI lane matrix | descriptors `CiLane.ts:330-451`; lane builders `:590-683,806-944` | Confirmed lane-shaped, not package-shaped. Labs require one-time negative filters on required turbo lanes plus a non-required labs lane. | F/I/D |
| Docgen lane gate | `.github/workflows/check.yml:154-170`; descriptor `CiLane.ts:397-405` | Confirmed tree-prefix gate. The scan ignore, not a per-lab row, enforces ceremony exemption. | F/I/D |
| Desktop-IPC filter | `.github/workflows/check.yml:298-311` | Confirmed named app filter. It is generic deletion residue only for that app and is not a labs registration. | F/I/D |
| Data-sync filters | `.github/workflows/data-sync.yml:48,57` | Confirmed optional named-package workflow surface. Scan exact target names and paths. | F/I/D |
| Storybook workflow | `.github/workflows/storybook.yml:67-70` | Confirmed host-package filter, not a general package registry. | D |
| Release/changesets action | `.github/workflows/release.yml:35-84` | Confirmed changeset-driven generic workflow. Target-specific state lives in pending changeset files. | D |
| Changeset graph | pending `.changeset/*.md`; retired registry `standards/changesets.retired-packages.json` | Confirmed authored lifecycle surface. Delta: three retired-driver empty changesets remain intentionally; live ontology still collides with a retired record. | F/I/D |
| Changeset ignore | `.changeset/config.json:13` | Confirmed name-only list. It cannot satisfy lab zero-root-churn and must not grow per-lab entries. | F/I/D |
| Portless | app manifest scripts; QA helper `Qa.session.ts:65-81` | Confirmed convention surface. Current helper only produces the one-segment app hostname; labs need a path-aware/name-aware variant. | F/I/D |
| Storybook host | `apps/storybook/.storybook/main.ts:50-56` | Confirmed optional authored story glob. Labs must never be auto-registered. | F/I/D |
| Storybook test roots | `apps/storybook/scripts/run-storybook-tests.mjs` | Confirmed optional authored roots. Doctor scans exact target references. | F/I/D |
| Root Vitest projects | `vitest.config.ts:10-14` | Confirmed generic globs. Delta: `apps/*/vitest.config.ts` does not reach two-level labs; P2 needs an explicit labs-depth project glob if root Vitest remains a supported aggregate runner. | F/I/D |
| Cargo/Rust | app-local `apps/*/src-tauri/**`; desktop cache at `.github/workflows/check.yml:311` | Confirmed owned-tree surface plus optional named workflow references. | F/I/D |
| Architecture proof manifest | `AcceptedProofManifest.ts:50-61,641-647` | Confirmed architecture-lab-only authored surface. Generic deletion scans it; lab creation never writes it. | F/I/D |
| Architecture standard | app law `standards/ARCHITECTURE.md:61-71`; retirement doctrine `standards/architecture/11-evolution-and-deprecation.md:1-31` | Confirmed authored exception/contract surface. Edit only when a named architectural promise changes. This P0 drafts the labs doctrine separately. | F/I/D |
| Family AGENTS tables | example `packages/shared/AGENTS.md:29` | Confirmed optional authored membership table. Exact target scan; no labs family table. | F/I/D |
| Yeet packets and CI mirrors | `.beep/yeet/**`, `.beep/ci/**` | Confirmed ignored local/runtime state. Delta: `.beep/ci` is absent here. Purge or invalidate, never treat as tracked truth. | I/D |
| CodeGraph index | ignore rule `.gitignore:136` | Confirmed ignored local index. Reindex out of band; doctor may warn but must not edit surgically. | D |
| Version-sync | `VersionSync.command.ts:1` | Confirmed non-registration. It may validate surviving versions after graph changes. | D |
| Manifest family metadata | example `packages/drivers/openclaw/package.json:14`; create writer `CreatePackage.command.ts:1601-1607` | Confirmed target-local. Apps, including labs, remain apps and do not acquire a fifth package family. | F/I/D |

## Research/05 section 7 derived-versus-committed ratification

| Artifact class | Current judgment | Geometry consequence |
| --- | --- | --- |
| Root aliases, root references, syncpack, survivor references, managed docgen | Still committed output of `syncTsconfigAtRoot`; planners remain at `TsconfigSync.plan.ts:447-988`. | One `derived-rebuild` declaration invokes the existing reconstructive writer and declares all outputs it owns. |
| Lockfile | Still committed and reconstructed by install. | Separate derived rebuild because install has different failure and consent semantics. |
| Coverage baseline | Still replacement-owned; `CoverageRegression.ts:509-525` explicitly distinguishes legitimate deletion pruning from scoped merge. | Inverse must select replacement mode. Doctor rejects a dead package key. |
| JSDoc inventories | Still a committed JSONC/Markdown pair at `JSDocDocumentationInventory.ts:199-200`. | One declaration owns both outputs; partial regeneration is residue. |
| Fallow boundaries and provenance | Still committed generated output and checkable drift. | One writer declaration owns both files. |
| Fallow health, schema-first, schema catalog, test-typecheck, clone, and effect-law inventories | Still committed policy/inventory documents with package/file ownership. | Declare writer plus target-membership probe; run only when the target intersects the inventory. |
| Changeset retired registry and knip config | Still authored, not generator-owned. | Use explicit authored-reference/pending-changeset actions, never generic regeneration. |
| Target-local `.beep`, `.turbo`, build, coverage, docs, and dependency directories | Still ignored runtime artifacts. The named retired-driver artifacts are gone in this tree. | Owned-tree/runtime-artifact inverse removes them; doctor proves absence. |
| Fleet timing and research reports | Still historical evidence. | Declare preserve-only historical records so an exact-name doctor hit is classified, not blindly removed. |
| Goal and exploration claims | Still authored current-state claims. | Warn/refuse according to packet lifecycle; never silently rewrite without an explicit flag. |

## Ratified geometry surface list

This is the closed list the `RegistrationSurface` model must express. Tags are
the required interpreter roles, not implementation names.

| Surface kind | Includes | Required tags |
| --- | --- | --- |
| Owned tree | Package files, local configs, Cargo tree, local docs, generated build artifacts | forward-writer, inverse-action, doctor-probe |
| Workspace literal | Exact root workspace rows for non-glob members | forward-writer, inverse-action, doctor-probe |
| Identity segment | Composer segment, accessor export, and shape-stability row when present | forward-writer, inverse-action, doctor-probe |
| Derived rebuild | TypeScript graph, syncpack, lockfile, Fallow boundaries, generated catalogs and baselines | forward-writer, inverse-action, doctor-probe |
| Generated inventory | JSDoc pair, schema-first/catalog, coverage, test-typecheck, knip/Fallow ratchets | forward-writer when admitted, inverse-action, doctor-probe |
| Authored reference | CI shards, workflow filters, Storybook roots, architecture prose, family guides, policy overrides | forward-writer when explicitly admitted, inverse-action, doctor-probe |
| Pending changeset | Dedicated and multi-package pending changesets plus retired-name registry | forward-writer, inverse-action, doctor-probe |
| Runtime artifact | Ignored local caches, install links, build output, CI mirrors, CodeGraph warning | inverse-action, doctor-probe |
| Data resource | Manifest-owned local Postgres schema or other explicitly owned destructive state | forward-writer, consent-gated inverse-action, doctor-probe |
| Historical record | Research, fleet timings, shipped changesets, retained decisions | preserve-only inverse classification, doctor-probe |

Generic surfaces with no package-specific state remain doctor inputs, not
registration rows. That boundary keeps D6 closed and testable without teaching
delete-package to rewrite every repository configuration file.
