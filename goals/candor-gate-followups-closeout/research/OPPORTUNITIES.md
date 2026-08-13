# Opportunities Ledger

## CGF-001 — Architecture package creation omitted workspace registration

- **Doing:** creating the first `shared/use-cases` package through the required
  `bun run beep architecture create package shared use-cases` path.
- **Evidence:** the command reported `written=12`, but the next `bun install`
  failed with `Workspace dependency "@beep/shared-use-cases" not found` because
  root `package.json` still listed only `packages/shared/domain` and
  `packages/shared/tables`; root TypeScript aliases were likewise absent.
- **Would prevent it:** make the architecture package operation plan include
  root workspace registration and the config-sync step (or fail its own
  idempotence check when the created package is not discoverable).
- **Disposition:** this packet registers the workspace explicitly and runs the
  canonical config sync; generator repair is tooling scope outside this PR.

## CGF-002 — New-package config sync omitted the fallow boundary artifact

- **Doing:** running the required repository quality baseline after the new
  shared package passed its focused checks.
- **Evidence:** `bun run audit:github quality` stopped at
  `repo-sanity:fallow-boundaries-config` because
  `standards/fallow.boundaries.generated.jsonc` was stale, even though
  `tsconfig-sync --write` had already reported success for the new workspace.
- **Would prevent it:** make package creation or the canonical config-sync path
  refresh every generated package-membership artifact, including fallow
  boundaries, and verify the generated set before reporting completion.
- **Disposition:** refreshed through `bun run fallow:boundaries:write`; the
  follow-up check passes. Tooling consolidation remains outside this PR.

## CGF-003 — Concurrent full builds produced moving no-location TypeScript failures

- **Doing:** proving the repository-wide build after all focused package checks
  were green while several sibling checkouts were also running full quality
  gates on the same host.
- **Evidence:** repeated `bun run build` attempts reported `TS2589` without a
  source location in different, untouched packages (`@beep/box`, `@beep/ui`,
  then `@beep/xai`); each affected package passed immediately when built alone,
  and the later aggregate build completed `132 successful, 132 total`.
- **Would prevent it:** isolate compiler memory and scheduling per worktree, or
  serialize host-wide full builds so a resource-pressure failure cannot appear
  as a source-attributable TypeScript diagnostic.
- **Disposition:** no source was changed for the moving errors; the successful
  aggregate build is the terminal proof for this branch.

## CGF-004 — A corrupted generated Turbopack cache obscured build attribution

- **Doing:** rerunning the full build after the moving TypeScript failures had
  been disproved with package-local builds.
- **Evidence:** the build then identified
  `apps/oip-web/.next/cache/turbopack/.../CURRENT is corrupt (4 bytes)`; moving
  only the generated `.next/cache` aside made the targeted `@beep/oip-web`
  build and the subsequent aggregate build pass.
- **Would prevent it:** make the application build detect and recover from a
  corrupt generated Turbopack cache, or give each concurrent build an isolated
  cache directory.
- **Disposition:** quarantined only the generated cache, preserved it until the
  successful rebuild, and made no application-source change.

## CGF-005 — Bun's documented dry run mutated the lockfile

- **Doing:** testing whether the newly published `nanoid` security patch could
  be applied as a transitive, lock-only update without expanding this PR.
- **Evidence:** `bun update nanoid@3.3.18 --lockfile-only --dry-run` printed
  `Saved bun.lock`, added a root lockfile dependency, and retained the
  vulnerable version as `postcss/nanoid`; `--dry-run` therefore changed state
  without producing the requested safe update.
- **Would prevent it:** make `bun update --dry-run` strictly non-mutating and
  expose an explicit transitive-resolution update command whose proposed
  lockfile diff can be inspected before it is written.
- **Disposition:** reversed only the command's three lockfile mutations with an
  explicit patch; the packet's pre-existing lockfile changes were preserved.

## CGF-006 — A refreshed advisory database diverged from hosted Repo Sanity

- **Doing:** running the final full-scope quality baseline after all packet work
  and focused gates passed.
- **Evidence:** GitHub updated `GHSA-2v37-7h3g-55p8` at 15:43 UTC; local
  `bun audit` then rejected inherited `nanoid@3.3.17`, while hosted Repo Sanity
  passed on exact `origin/main` SHA `32b31f7f74`, whose workflow started at
  15:44 UTC with the same lockfile.
- **Would prevent it:** pin and receipt the advisory snapshot used by local and
  hosted audit lanes, then report database freshness separately from source
  attribution so identical lockfiles cannot disagree silently.
- **Disposition:** because the lock graph had one deduplicated v3 resolution,
  advanced only that entry to 3.3.18 with its registry integrity while leaving
  manifests, PostCSS, and the independent `docx` v5 line unchanged. A frozen
  install and the canonical `bun-audit` lane both pass; no advisory ignore was
  added.

## CGF-007 — Frozen install validation removed a trusted dependency artifact

- **Doing:** validating the lock-only security update with a frozen install
  while avoiding unrelated lifecycle scripts.
- **Evidence:** `bun install --frozen-lockfile --ignore-scripts` relinked the
  trusted local `@pulumi/gharunners` dependency without its generated
  `bin/index.js`; the next aggregate check resolved its raw CommonJS TypeScript
  sources and failed in `infra`, although the packet had not changed them.
- **Would prevent it:** package the executable in the dependency artifact, or
  make frozen lock validation preserve already-generated trusted file-package
  outputs when lifecycle scripts are explicitly disabled.
- **Disposition:** reran the frozen install without `--ignore-scripts`, which
  restored the declared executable; the standalone `infra` check and the
  subsequent aggregate check both pass. No infrastructure source was changed.

## CGF-008 — Package-local guidance drifted from the binding architecture

- **Doing:** closing the reviewer loop after promoting the first
  `@beep/shared-use-cases` contract.
- **Evidence:** the architecture standard and package promotion record described
  the new active package, but `packages/shared/AGENTS.md` still said the package
  did not exist. The reuse review also found a local kebab-case validator that
  duplicated the exported `@beep/schema` `KebabCaseStr`.
- **Would prevent it:** include scoped `AGENTS.md` temporal claims and live
  source helper discovery in package-creation/promotion proof, not only the
  binding architecture documents and generated workspace metadata.
- **Disposition:** updated the package guide and derived the refusal-code schema
  from `KebabCaseStr`; focused shared checks and the reviewer recheck pass.

## CGF-009 — Persisted schema evolution lacked a legacy-row gate

- **Doing:** reviewing the change from office-local ST.13 JSON to a globally
  scoped identity requiring a known office code.
- **Evidence:** the first implementation changed exact JSONB equality without a
  deployment check for legacy `{ kind, applicationNumber }` rows, which could
  have made existing evidence appear absent. Review also exposed PostgreSQL
  `CHECK` three-valued logic for JSON `null` and the difference between a
  two-uppercase-letter shape and the finite ST.3 domain.
- **Would prevent it:** require every persisted schema change to state its
  pre-existing-row strategy and run the actual new migration against a database
  stopped at the immediately preceding migration.
- **Disposition:** added an actual migration preflight, finite known-office
  constraints on all three tables, desktop bundle sync, and pre-upgrade
  missing/null/unknown-code regression tests. The focused migration suite passes.

## CGF-010 — Architecture proof manifest drift surfaced only in the aggregate suite

- **Doing:** running the canonical full-repository repair after the new ST.13
  migration and its focused migration tests were green.
- **Evidence:** the repo-cli aggregate test failed with `ENOENT` for the new
  migration under its generated temporary tree because db-admin migrations are
  copied through a separate static `AcceptedProofManifest`, and the new
  migration and snapshot descriptors had not been added there.
- **Would prevent it:** make migration creation update the architecture proof
  manifest atomically, or add a focused db-admin check that rejects manifest
  drift before the full 1,484-test repository lane.
- **Disposition:** registered both accepted proof files and reran the focused
  architecture operation-plan test before resuming canonical proof.

## CGF-011 — Focused typechecks did not enforce direct test dependencies

- **Doing:** running the canonical Yeet pre-push proof after the migration and
  architecture-generator suites passed.
- **Evidence:** Knip reported the migration test's direct
  `drizzle-orm/migrator` import as unlisted even though TypeScript and Vitest
  resolved it transitively through another workspace package.
- **Would prevent it:** run the unlisted-dependency check in focused package
  proof, or have package-local test configuration reject transitive-only module
  resolution.
- **Disposition:** declared `drizzle-orm` as a db-admin development dependency;
  no regression-baseline exception was added.
