# Sweep D: changesets and private release-note accumulation

## Provenance

- Checkout: lane `rsc-packet`, head `e62411d63f` (= `main`), read 2026-10-09. Read-only; no installs, tasks, or writes in the checkout.
- Commands: `rg`, `sed -n`, `jq`, `git ls-files`, `git log --diff-filter=A|D`, `git log -L`, `git show <sha>:<path>`, `git rev-parse e62411d63f:.changeset`, `git ls-remote --tags origin`, `gh release list`, `gh api repos/<o>/<r>/rules/branches/main`, `curl -o /dev/null -w %{http_code} https://registry.npmjs.org/<name>` for all 152 workspace names, `npm view` (2 names).
- Paths are repo-relative unless written with `~`.

## 1. How the changeset requirement is enforced today

There are two checks. Both are custom in-process `beep quality` commands; neither runs the stock changesets CLI.

### 1a. `beep quality changeset-status` (the per-package requirement)

- Source: `packages/tooling/tool/cli/src/commands/Quality/ChangesetStatus.ts`. The command is `changesetStatusCommand` (l.655) and the entry point is `runChangesetStatus` (l.609). The default base is `origin/main`.
- Changed files: `collectChangedFilesSince` (l.440) runs `git diff --name-only -z --no-renames --diff-filter=ACMRTUXBD <since>...HEAD`. This diff covers committed changes only, so staged and unstaged edits are invisible to it, which agrees with the memory note. The check reads the contents of the added notes from the working tree (`collectAddedChangesetReferences`, l.476).
- Partition (`partitionChangedFilesForStatus`, `partitionImpl` l.273). Paths are classified in this order:
  1. Lab paths (`isLabsWorkspacePath`, `internal/cli/Labs/LabsWorkspace.ts:101`).
  2. Neutral paths: the prefixes `docs/ goals/ research/ explorations/ .changeset/` (`CHANGESET_STATUS_NEUTRAL_PATH_PREFIXES` l.69), the companion files `identity/src/packages.ts`, `bun.lock` and `standards/fallow.boundaries.generated.jsonc` (`LAB_EXEMPT_COMPANION_PATHS` l.98), and the basename `turbo.json` (l.134).
  3. Paths owned by a workspace.
  4. Everything else is "blocking".
- Verdict (`ChangesetStatusVerdict` l.183, `changesetStatusVerdict` l.352): `lab-exempt` when the change set is lab-only, otherwise `enforced`.
- Requirement (`uncoveredImpl` l.359, `runEnforcedCheck` l.553): every changed workspace that has a `version`, is not listed in `.changeset/config.json` `ignore`, and is not named in the frontmatter of a `.changeset/*.md` file *added* (`--diff-filter=A`) in `<since>...HEAD` makes the check fail with exit 1. Notes with `{}` frontmatter name no package and therefore satisfy nothing.
- The check never reads `private`. `ChangesetStatusPackageJson` (l.230) decodes only `name` and `version`. All 152 workspaces carry a version, so every changed non-lab workspace except the 3 ignored ones needs a note.
- Gap: `blockingPaths` (root-level files no workspace owns) feed only the verdict and the log line. They never require a note.
- Wiring:
  - Hosted CI: `.github/workflows/check.yml:307-311`. The Repo Sanity matrix arm passes `--changeset-status` only on `pull_request`. `CiLane.ts:1666-1683` (the `repo-sanity` steps) runs `beep quality changeset-status --since origin/main` after `changeset-graph`, and `CiLane.ts:2537` adds the flag when not on main.
  - Local: `GithubChecks.ts:492` `githubCheckChangesetStatusLane` (lane `quality:changeset-status`). The lane is appended by `Quality.command.ts:970-992` `githubCheckChangesetStatusLanes` (skipped on main and on main pushes) and by the Yeet planner `Planner.ts:410-416` `changesetStatusLanesForProof` in the `full` and `cheap-gates` tiers. `WaveOrder.ts:234` records the lane's cost.
  - Required check: `Repo Sanity` is in the main-branch ruleset's required status checks (`gh api .../rules/branches/main`), so this gate blocks merges.
  - Failure routing: `Yeet/internal/IssueClassification.ts:333-337` (`changeset-policy` / `changeset-status`). Its remediation text says "Write a changeset listing each changed package with `patch`".
  - Turbo: `turbo.json:1160` `//#changeset:status` takes inputs `.changeset/**` and `**/package.json`.

### 1b. `beep quality changeset-graph` (reference validity)

- Source: `commands/Quality/ChangesetGraph.ts`. The command is `runChangesetGraphCheck` (l.585), registered as `changesetGraphCommand` at `Quality.command.ts:3884`.
- It lists tracked notes with `git ls-files ':(glob).changeset/*.md'` minus README, then filters to files that exist on disk (`collectChangesetFiles` l.336). It fails if any frontmatter key names a package outside the live workspace graph, unless the name appears in `standards/changesets.retired-packages.json` (`readRetiredChangesetPackageNames` l.222).
- It runs unconditionally in Repo Sanity (`CiLane.ts:1667`). The lane is `repo-sanity:changeset-graph` (`GithubChecks.ts:517-523`) with inputs at `turbo.json:1272-1280`.

### 1c. Other writers and readers of `.changeset/`

- `delete-package`: `DeletePackage.command.ts:384` `rewritePendingChangesets` prunes the deleted package's keys from every pending note and writes a `{}` `delete-<slug>.md` note (`DeletionChangeset.ts`, `renderCanonicalDeletionChangeset`). The note policy is `DeletionNotePolicy` with values `emit-empty-note` and `labs-exempt` (`RegistrationGeometry.schemas.ts:134`).
- Registration geometry: `RegistrationGeometry.plan.ts:166-169` defines the `PendingChangesetSurface` (glob `.changeset/*.md` plus the retired registry), with plan text at l.220-226 and l.289-297. `RegistrationGeometry.probes.ts:187-200` probes for pending notes naming a package.
- Retired-name guard: `create-package` refuses retired names (`CreatePackage.command.ts:1019`, flag l.1148) and clears the entry on sanctioned reuse (l.1619-1624). The registry reader is `internal/cli/Labs/RetiredPackages.ts:26` and `CreatePackage/internal/RetiredNameRegistry.ts`.
- Path filters only, with no content reads: `CoverageScope.ts:69` (no-op for coverage), `GateStaleness.ts:566` (not code-relevant), `HeavyAdmission.ts:284` (docs-only), `Laws/EffectImports.ts:482`, `Worktree.schemas.ts:777` (`.changeset/config.json`).
- `beep version-sync` (`commands/VersionSync/**`) never touches changesets: 0 `changeset` matches. It syncs toolchain pins only (resolvers for Bun, Node, Docker, Biome, the Effect catalog, and Turbo). It is not a package-versioning tool.
- Root `package.json` scripts: `changeset`, `changeset:status`, `changeset:status:since-main`, `repo-sanity:changeset-graph`. Dev dependencies `@changesets/cli` and `@changesets/changelog-github` come from the catalog (`^3.0.3`, `^1.0.1`). `changeset:version` and `release` were removed in #775.
- Tests: `packages/tooling/tool/cli/test/changeset-status.test.ts`, `changeset-graph.test.ts`.

## 2. The `.changeset/` tree at `e62411d63f`

- 941 tracked files: `README.md`, `config.json`, and **939 pending notes**. The `.changeset` tree oid is `d839776128c29c6c4cc7c2937329942d873b973c`.
- By content:
  - 784 notes name at least one package (4,566 frontmatter refs: 4,277 patch, 279 minor, 10 major).
  - 148 have `{}` frontmatter ("No release" or deletion notes).
  - 7 have empty frontmatter.
- Fan-out: 506 notes name one package. 40 notes name 20 or more packages; the largest name 123 to 139 packages.
- Major bumps appear in 5 notes: `practice-kg-working-files`, `remove-retired-beep-packages`, `shadcn-lint-strict-design-system`, `practice-kg-bundle-04`, `schema-first-v4-capabilities`. A stock version run would therefore move some 0.x packages to 1.0.0, so "preserve versions" means delete the notes, not run a version step.
- By month the note was added (first add commit):

| Month | Notes |
| --- | --- |
| 2026-05 | 1 |
| 2026-06 | 59 |
| 2026-07 | 222 |
| 2026-08 | 255 |
| 2026-09 | 299 |
| 2026-10 | 103 |

- By package: 151 distinct packages are referenced, and every one is a live workspace. Only `@beep/trustgraph-workbench` has no pending note. The top counts are `@beep/repo-cli` 171 (even though it is in `ignore`), `@beep/professional-desktop` 90, `@beep/schema` 86, `@beep/law-practice-server` 72, `@beep/repo-ai-metrics` 66, `@beep/identity` 66, `@beep/law-practice-use-cases` 60, and `@beep/repo-configs` 56. The other ignored packages have notes too: `@beep/repo-utils` 13 and `@beep/scratchpad` 3.
- `config.json` contract:
  - `changelog: ["../scripts/changeset-changelog.cjs", {repo: "beep-effect/beep-effect"}]`
  - `commit: false`, `fixed: []`, `linked: []`
  - `access: "restricted"`, `baseBranch: "main"`, `updateInternalDependencies: "patch"`
  - `ignore: [@beep/repo-cli, @beep/repo-utils, @beep/scratchpad]`
  - No `privatePackages` key. `$schema` pins `@changesets/config@3.1.2`, but the installed version is 4.0.1.
- Stock default: in the installed `@changesets/config` 4.0.1, `privatePackages` defaults to `{version: false, tag: false}` (`node_modules/@changesets/config/dist/index.mjs:779-785`). Stock `changeset version` therefore already skips every private package. The 939 notes are inert for stock tooling, and only the in-process wrapper in 1a demands them.
- `scripts/changeset-changelog.cjs` (48 lines) wraps `@changesets/changelog-github` with a plain fallback for transient GitHub errors. Its only caller is `.changeset/config.json` `changelog`, and stock changesets invokes it only during `changeset version`, which no workflow or script runs today.
- `standards/changesets.retired-packages.json` holds 6 entries. Every rationale says notes are "retained until release cleanup drains them". None of the 6 names is referenced by a pending note today. `@beep/ontology` is listed as retired but is a live workspace (`packages/foundation/modeling/ontology`), which looks like a stale entry.

## 3. Private versus publishable

- 152 workspace manifests, derived from the root `workspaces` globs with `git ls-files`. **All 152 have `private: true`.** The root manifest is also `private: true`.
- 127 of them also carry `publishConfig: {access: "public", provenance: true, exports}`. This is template residue: `create-package` emits `private: true` (`CreatePackage.command.ts:1761`, `baseManifestFor`) together with `publishConfig` (l.1728, l.2070). `standards/architecture/14-ecosystem-packages.md:118-129` (Release Lane) documents the intent: members stay `private: true` until an operator flips them, and `publishConfig.access: public` exists so the restricted repo default does not apply on release day.
- Versions: 0.0.0 ×90, 0.0.1 ×6, 0.0.2 ×41, 0.0.3 ×8, 0.0.4 ×1, 0.1.0 ×1, 0.1.1 ×2, 0.1.2 ×2, 0.1.4 ×1.
- External consumption evidence:
  - npm: all 152 names return HTTP 404 on `registry.npmjs.org`. `npm view @beep/schema` and `npm view @beep/repo-cli` return E404.
  - Remote tags (`git ls-remote --tags origin`): 6, all `evidence/beep-ci-ops/*`. There are no `@beep/*@x.y.z` tags and no `professional-desktop-v*` tags.
  - `gh release list`: empty.
  - `.npmrc` and `bunfig.toml` configure only the `@buf` scope registry. There is no `npm.pkg.github.com` or `NPM_TOKEN` reference in tracked config.
  - GitHub Packages could not be listed because the token lacks `read:packages` (see Open questions).
  - No `github:`/`git+` dependency on this repository was found in `~/YeeBois/projects/*` manifests at depth 4 or less.
- History:
  - `chore(release): version packages` bot commits ran 2026-05-16..2026-06-04. Examples: `97ecaa9c5d`, `2744320a04`; `eba8ceed42` bumped `apps/professional-desktop`. Around 100 notes were consumed this way.
  - #775 (`55ecfe6782`, 2026-08-23) deleted `.github/workflows/release.yml` as "mechanically unreachable". That workflow opened a release PR via `changesets/action` and had a manual `PUBLISH`-gated `changeset publish` job using `NPM_TOKEN`. #775 also removed the `changeset:version` and `release` scripts and revived the in-process gate.
  - `standards/architecture/DECISIONS.md` § "2026-09-02: In-Repo Deprecations Are Removed on Discovery" (around l.1771) already records that every workspace is private, no workflow publishes, and "no version has ever reached a consumer outside this repository".
- 60 tracked `CHANGELOG.md` files exist, for example `apps/professional-desktop/CHANGELOG.md` and `infra/CHANGELOG.md`. They are leftovers of the version-packages era and are not read by any gate found.
- Conclusion: no published or externally consumed package contract is demonstrated. Nothing is publish-enabled today.

## 4. Desktop release and versioning (keep separate)

- `.github/workflows/release-desktop.yml` triggers on tag `professional-desktop-v*` or on `workflow_dispatch` with an existing tag (preflight l.66-76). The header says the tag is "kept distinct from the npm/changeset release tags" (l.10-11), but those tags no longer exist. The workflow builds Tauri natively per OS, stages a draft GitHub Release, and writes `latest.json` with `version` read from `apps/professional-desktop/package.json` (l.493-497). The updater endpoint is in `src-tauri/tauri.conf.json`.
- Version sources:
  - `apps/professional-desktop/package.json` `version` 0.0.3, `private: true`.
  - `src-tauri/tauri.conf.json` `version` 0.0.3.
  - `src-tauri/Cargo.toml` `version = "0.0.0"`, which has drifted from the other two.
- History: the package.json version was last moved by changesets `version packages` commits (`eba8ceed42`, `927b429d48`, `4c820de953`, all in May 2026). The tauri.conf.json version was last moved by hand (`a2dec1a6e8`, 2026-06-18).
- Since #775, nothing bumps the desktop version automatically. Its 90 pending notes have no effect on any desktop release.
- The workflow never reads `.changeset/`. Retiring notes does not change desktop behavior. The only coupling is that a desktop version bump is now manual (package.json and tauri.conf.json together).

## Proposed plan (implementing lane)

Design order: schema, then service contract, then implementation. Every change stays inside the existing `Quality/ChangesetStatus` and `ChangesetGraph` modules.

1. **Schema.**
   - Extend `ChangesetStatusPackageJson` with `private: S.optionalKey(S.Boolean)`.
   - Extend `ChangesetStatusWorkspacePackage` with a derived `publishEnabled: S.Boolean` (`private !== true`).
   - Extend `ChangesetStatusVerdict` (LiteralKit) to `["lab-exempt", "private-exempt", "enforced"]`: `private-exempt` applies when every changed product workspace is private and no blocking path needs a note. Alternatively keep two verdicts and log `private_skipped=N`. Either way the decision goes in the SPEC Decision Log.
2. **Mechanism.**
   - `uncoveredImpl` adds `A.filter((w) => w.publishEnabled)` before the ignore and reference filters.
   - Publish-enabled paths stay valid: the moment a workspace flips `private: false`, its changes need an in-range note again, with no config edit. Turbo inputs already include `**/package.json` (`turbo.json:1160`).
   - Changeset graph gains one rule that blocks re-accumulation: a note that names a **private** workspace fails ("changesets are accepted only for publish-enabled packages"). `{}` notes are also rejected, or simply not emitted (see step 3). Decision for the orchestrator: fail versus warn. Failing is the only mechanical way to stop agents writing notes out of habit.
3. **Delete-package.** Add `DeletionNotePolicy` value `private-exempt` (or make `emit-empty-note` conditional on a publish-enabled package), so deleting a private package emits no `{}` note. Update the `RegistrationGeometry.plan.ts:220-226,289-297` texts and `rewritePendingChangesets`.
4. **Config (dormant machinery).**
   - Keep `.changeset/config.json`, `README.md`, `scripts/changeset-changelog.cjs`, and the `@changesets/*` dev dependencies.
   - Add an explicit `"privatePackages": {"version": false, "tag": false}`. It equals the 4.0.1 default and documents intent.
   - Optionally bump `$schema` to the installed config version.
   - `ignore` becomes redundant for private packages but is harmless; keep it to avoid churn.
5. **Reset commit (one commit).** `git rm` every `.changeset/*.md` except `README.md`, enumerated at the implementation parent commit. The count will exceed 939 if new notes land first. Versions are untouched, and no `changeset version` is run.
6. **Baseline record.** One concise file, for example `standards/changesets.reset-baseline.json`, schema-decoded if any tool reads it; otherwise a DECISIONS entry plus the JSON. Contents:
   - `retiredAtParent`: the parent commit SHA of the reset.
   - `changesetTreeOid`: `git rev-parse <parent>:.changeset`.
   - `retiredCount`, plus counts by kind (package-naming, `{}`, empty) and by month.
   - `recovery`:
     - `git ls-tree --name-only <tree-oid>` lists every retired file.
     - `git show <parent>:.changeset/<name>.md` reads one note.
     - `git checkout <parent> -- .changeset` restores all of them.
   - Store the tree oid and commit rather than 939 filenames: the list is exactly reproducible from the oid and the file stays concise. If the brief's "list of retired files" must be literal, add a `files` basename array (about 25 KB).
7. **Retired registry.** Rewrite the six rationales, which currently say "retained until release cleanup drains them", to say the entries now only guard against name reuse. Resolve the stale `@beep/ontology` entry, which names a live package. Keep the `ChangesetGraph` allowance for retired names, or drop it after the reset, since no note will remain.
8. **Policy text to update in the same PR.**
   - `AGENTS.md:177-180`: the "major changeset" for a breaking public API/schema applies only to publish-enabled packages. Private packages record breaking changes in the PR and the packet Decision Log.
   - `.claude/skills/yeet/SKILL.md:1008-1013` and l.443.
   - `IssueClassification.ts:337` remediation text.
   - `standards/architecture/15-lab-apps.md:54`.
   - `standards/architecture/14-ecosystem-packages.md:118-129`: the "release lane" no longer exists. Activation requires deliberately re-establishing a release workflow, version policy, and the changeset requirement, all of which the `private: false` flip triggers.
   - `docs/runbooks/lab-promotion.md:39,55,76`.
   - A new `standards/architecture/DECISIONS.md` entry.
   - Also correct the `release-desktop.yml:10-11` comment about npm/changeset tags.
9. **Desktop.** No workflow change. Document that the desktop version is bumped by hand in `apps/professional-desktop/package.json` and `src-tauri/tauri.conf.json` before tagging `professional-desktop-v*`. Optionally align `Cargo.toml` or record the drift as known.
10. **Tests.**
    - `changeset-status.test.ts`: private workspace exempt; public workspace still enforced; mixed set enforced only for the public workspace.
    - `changeset-graph.test.ts`: a note naming a private package fails.
    - Delete-package and registration-geometry fixtures.
    - Run `bun run beep quality package-verify @beep/repo-cli`.
11. **Recovery and activation path.** To restore history, use the baseline commands. To activate publishing for a package: flip `private: false` (an operator decision per 14-ecosystem-packages), add a release workflow, and write notes for that package from then on. The gate re-engages for it automatically.

## Open questions

- GitHub Packages: `gh api orgs/beep-effect/packages?package_type=npm` needs `read:packages`, which the token lacks, so publication there is unverified. Indirect evidence (no publish workflow, no registry config, no tags) says none.
- Whether any consumer outside the inspected `~/YeeBois/projects` clones (for example a private mirror or a deploy) pins a `@beep/*` version or a git ref. Not established.
- Whether the "blocking paths never require a note" gap in 1a is intended. It becomes moot if the gate only covers publish-enabled packages.
- Whether `@beep/ontology` in the retired registry is an intended state (reuse without clearing) or a stale entry from a recreation before the clearing code existed.
- Whether the 60 `CHANGELOG.md` files should be retired with the notes or kept as history. No gate reads them. This belongs to Workstream A or D scope.
- The exact note count at the implementation head (939 at `e62411d63f`; notes are still being added at about 100 per week in October).
