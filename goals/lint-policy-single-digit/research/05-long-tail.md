# Lint Policy long-tail reduction report

## 1. TL;DR

Recommended order:

1. **Remove `lint:docgen` from Lint Policy after making the required `Docgen` matrix lane the sole owner of the same metadata guarantee.** This removes **197 s** of work and the future long pole from Lint Policy. The current PR Docgen lane already selects affected packages and runs the same `analyzePackageDocumentation` check before generation when proof reuse misses; full generation also runs docgen's own module checker. Do a rule-parity test before deletion because the two checkers are not literally the same implementation.
2. **Make hosted PR Lint Policy use changed scope, with explicit full-scope invalidators.** Terse Effect and Native Runtime already accept changed-file includes; extend the same contract to JSDoc, Schema First, Identity Registry, Circular, and a sound Semantic Delta fast-path. Fix the empty-law-selection bug by omitting the step, not by passing `--include ""`.
3. **Amortize syntax construction in full runs.** One CLI process and one syntax project should feed Terse Effect + Native Runtime (and ideally the other syntax-only laws). Schema First should reuse one semantic project for its inventory and LiteralKit passes. This attacks parsing and also removes repeated ~1.8 s `beep` CLI boots.
4. **Replace Semantic Delta's two whole-repository archives with Git-object reads for Markdown/tree checks; materialize only the probe runtime, and cache the base result by merge-base SHA.** This is the largest remaining full-run architectural win.

Numeric model, using the hosted measurements in `BRIEF.md:10-45`:

- Current non-deprecated work is **564 s**. At concurrency 2, its ideal floor is `564 / 2 = 282 s`, plus ~66 s setup: **~5.8 min**.
- Removing in-policy Docgen gives `(564 - 197) / 2 + 66 = 249.5 s`: **~4.2 min**, before any other change.
- Conservative full-run targets for these seven remaining steps are Semantic 39, Schema 25, Terse+Native combined 20, JSDoc 29, Identity 10, Circular 9 = **132 s**, versus 258 s now. Then `(367 - 126) / 2 + 66 = 186.5 s`: **~3.1 min**. This is a work-conservation estimate, not a scheduler benchmark.
- On ordinary changed-scope PRs (few TS files, no knowledge documents/deletions, no policy/config changes), all eight steps should total **about 10-20 s**: Docgen 0 in this lane; Semantic 0; Circular 0; one shared law parse ~3-5 s; changed-file JSDoc/Schema/Identity ~7-15 s. The remaining policy steps then dominate.

## 2. Evidence

### Lane shape and changed-scope defect

- CI invokes `beep lint policy` without shape arguments (`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:887`), and `runRootLintPolicyTask` forces full scope whenever `isCi()` is true (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1560-1566`). The workflow likewise passes no shape arguments for `lint-policy` (`.github/workflows/check.yml:225-231`).
- The eight commands are registered independently at `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1470-1507` and run with concurrency 2 (`Tasks.ts:119-124,1573-1577`). Every repo-CLI command therefore pays a separate process/module-graph boot.
- Changed law arguments filter to app/package/infra TS/TSX, but an empty result becomes `--include ""` (`Tasks.ts:1455-1468`). The step builder must return no step when this filtered list is empty.

### Per-step findings

| Step | What it actually executes; why slow | Cheapest credible 2x+ lever | Changed-scope result |
|---|---|---|---|
| **`lint:docgen` 197 s** | Resolves every configured workspace package, verifies proof manifests, then creates one ts-morph `Project` per non-current package and walks exported declarations (`Docgen.command.ts:582-607`; `Docgen/internal/JsDocAnalysis.ts:528-557`). Verification itself globs, reads, and SHA-256 hashes every package input and generated-doc output (`tool/docgen/src/ProofManifest.ts:309-318,339-413,530-578`). Proof files live at `.beep/docgen/proof.json`, while `.gitignore:107` ignores `**/.beep/*`; a fresh CI checkout therefore cannot reuse them. | **Delete this step from Lint Policy after transferring/proving parity in the Docgen lane: 197 -> 0 s (>2x).** The separate required lane is affected on PRs (`check.yml:153-168,239-244`); affected mode checks package metadata before generation (`Docgen/internal/Local.ts:626-660,687-716`). Full mode runs root `docgen` (`CiLane.ts:670-683`), whose generator parses/checks modules and examples (`tool/docgen/src/Core.ts:768-801`). | **Trivial/removed.** Let the separately scheduled Docgen lane own affected/full selection. |
| **`knowledge:semantic-delta` 78 s** | Builds and extracts **two full Git archives**, reads both full trees, and only then scans the pair (`Knowledge.service.ts:1092-1153`). It scans live Markdown in 10 governed roots (`Knowledge.refs.ts:1157-1172`; `Knowledge.service.ts:244-247,488-505`) and boots archive-local Bun command/index probes for base then HEAD (`Knowledge.service.ts:521-595,855-969`). This is archive I/O + Markdown scanning + four runtime boots, not typecheck. | **Sound diff fast-path:** skip when the diff has no governed Markdown/goal-manifest/producer change and no deletion/rename of any tracked target; typical source-only PRs go 78 -> 0. For full runs, read trees/blobs with `git cat-file --batch`, cache base findings by SHA, and materialize only probe-required files. | **Trivial for additive/modified source-only PRs.** Deletions/renames, governed docs, goal manifests/index producer, command tree, or scanner changes force the real delta. |
| **`lint:schema-first` 51 s** | Loads all app/package/infra TS/TSX through a semantic ts-morph project (`Lint.schemas.ts:50-84`; `SchemaFirstProject.ts:57-63`). Inventory detectors request symbols/types (`SchemaFirstDetectors.ts:79-96,254-304`). Worse, the command constructs that repo-wide project once for inventory and again for the LiteralKit pass (`SchemaFirstScan.ts:54-96,461-464`). This is semantic parse/type resolution + AST walks; not process startup. | **Pass one `Project` into both passes** and fold the LiteralKit visitor into the main source loop. For PRs, add `--include` and reconcile only changed/deleted files against the committed inventory; policy/scanner/tsconfig changes force full. The incremental form is comfortably >2x. | **Near-trivial for a few changed files** once inventory reconciliation is file-keyed; currently it is always full (`Tasks.ts:1502`). |
| **`lint:terse-effect` 33 s** | Creates a ts-morph project, globs all app/package/infra TS/TSX, then performs multiple descendant collections/passes per file (`Laws/TerseEffect.ts:127-128,579-625,683-705`). No explicit checker diagnostics are requested; cost is parse + repeated syntax traversal. | It already supports `includePaths` (`TerseEffect.ts:33-48,592-594`): **use changed scope in hosted PRs and skip an empty set**. For full runs, run all syntax laws in one process/project. | **Already structurally trivial:** a one-file local probe was ~3.2 s versus 33 s hosted full. Empty selection should be 0, not a failed CLI invocation. |
| **`lint:jsdoc` 29 s** | `bunxStep` literally invokes `bunx eslint . --max-warnings=0` (`Tasks.ts:1200-1206,1504`). The default profile is docs (`eslint.config.mjs:5-17`): TypeScript parsing plus JSDoc/custom rules for tooling source and TSDoc syntax across app/package/infra production TS (`DocsESLintConfig.ts:65-102,130-212,248-280`). It is parse/file-scan work, not typed lint. | **Pass only changed applicable files to the installed binary**; config/plugin/tsconfig changes force full. `./node_modules/.bin/eslint` avoids ambiguity/network resolution, but is not itself the 2x lever: local `--version` probes were 0.06 s for both it and `bunx`. | **Near-trivial for a few TS files.** Currently `.` makes it full even in local changed mode. |
| **`lint:native-runtime` 27 s** | Independently creates another repo-wide ts-morph project over the same globs and walks every descendant, matching imports/new/calls/binary/switch nodes (`Laws/NoNativeRuntime.ts:40-43,502-523,565-600,665-699`). A local full probe reported 2,899 scanned files; this is syntax parse/traversal plus allowlist reconciliation, not typecheck. | **Use its existing `includePaths` in PRs** and share one project/process with Terse and other syntax laws for full runs. | **Already near-trivial:** a one-file local probe was ~3.2 s; empty selection should be skipped. |
| **`lint:identity-registry` 22 s** | Enumerates 133 workspaces, recursively `stat`/`readDirectory`s each tree, reads every TS/TSX sequentially, string-filters on `@beep/identity`, and ts-morph parses candidates (`Lint/IdentityRegistry.ts:56-110,175-229`). It is filesystem traversal/read + syntax parse; no typecheck. | Keep the cheap full registry-completeness check, but scope local-composer detection to changed files. For full runs replace recursive per-entry stats with one `FsUtils.globFiles` and bounded-concurrent reads (or an `rg -l -F` prefilter), then parse only matches. | **Near-trivial** after the split: completeness stays full; composer scan touches only changed TS. Currently always full (`Tasks.ts:1485`). |
| **`lint:circular` 18 s** | Lazily imports Madge, then runs **two serial Madge analyses**, each with root tsconfig resolution (`Lint/Lint.command.ts:411-452`). The source has 484 `.ts` files under the two named roots, but a local instrumented run resolved 900 files for CLI, 294 for repo-utils, and 931 combined: Madge follows reachable imports, so “two dirs” understates the graph. Local split was import 0.2 s + 4.35 s + 1.92 s; one combined call was 4.11 s, only ~1.5x. | **Skip on PRs with no relevant import-bearing TS changes** (>2x for most PRs). Immediate full-run cleanup: call Madge once with both roots. Longer-term, there is **no drop-in existing repo command** for file-import cycles: `TsconfigSync` checks workspace-package cycles (`TsconfigSync.service.ts:99-110`). Reuse `TSMorphService` for syntax/resolution and existing `detectCycles` SCC logic (`repo-utils/src/Graph.ts:132-174`) to replace Madge, but that needs a tested import-graph adapter. | **0 s for PRs outside the intended tooling graph.** Changes inside/reachable from those roots still need graph analysis; define the boundary explicitly because Madge currently follows external reachable files. |

### Local bounded probes (supporting diagnosis, not replacements for hosted timings)

- `bun run beep --help`: 1.76 s / ~658 MB peak RSS. Thus process boot matters for 3-5 s steps, but cannot explain 18-197 s steps.
- `./node_modules/.bin/eslint . --max-warnings=0`: 15.66 s locally; `eslint --version` was 0.06 s through both local binary and `bunx`.
- Full concurrent probes: Schema First 33.0 s / ~14.0 GB peak RSS, Terse 21.7 s / ~10.2 GB, Native 12.6 s / ~5.3 GB, Identity 7.5 s. Contention magnifies hosted wall time; repeated ts-morph projects are also a memory-concurrency problem.
- Semantic Delta: 34.3 s locally; forcing the safe “untrusted PR/no probes” policy still took 28.6 s. Therefore archive/materialization/tree/Markdown work dominates locally; probes were only ~5.7 s.
- Circular: exact command 8.62 s locally; the per-root/combined figures above show duplicated reachable-graph parsing, not lazy-import startup, as the main cost.

## 3. Implementation sketch

1. **Scope model in `Quality/Tasks.ts`**
   - Replace `files?: string[]` with a decoded `LintPolicyScope = Full | Changed { files, changes }` carrying status (`A/M/D/R`), not names alone.
   - Make each step factory return `ReadonlyArray<QualityTaskStep>` so an empty applicable set emits no process.
   - Add full invalidators: the step implementation/config, root `package.json`/lockfile/tsconfig, relevant inventory/allowlist, and shared scanner substrate.
   - Teach `ci lane lint-policy` to accept `--affected --base`; do not rely on `isCi()` to force full.

2. **Docgen ownership**
   - Add parity fixtures asserting that affected `docgen:local`/full generator catches every condition currently caught by `beep docgen check` (especially category and re-export metadata).
   - If parity is missing, fold the metadata visitor into repo-docgen's existing parse/check pass rather than running a second ts-morph analyzer.
   - Then remove `lint:docgen` from `rootRepoLintPolicySteps`; keep `Docgen` required.

3. **Shared syntax-law runner**
   - Add an internal `laws policy --include ...` composite. Build one syntax-mode `TSMorphService.inspectProject` request and run Terse/Native visitors (then Effect Imports/Fn/Frozen as feasible) over the same ordered `SourceFile[]`.
   - Preserve individual labels in structured output even though execution is one process.
   - Reconcile global allowlists separately so a changed-file scan does not report unrelated entries as unused.

4. **Schema First incremental/reuse**
   - Change both collectors to accept a supplied `Project`; construct it once.
   - Add include globs/files. Merge live results for changed files with baseline entries for unchanged files; remove entries for deleted files; detect new/stale findings only in the affected keys.

5. **Semantic Delta fast path**
   - Classify the name-status diff before archive work. Skip only when modifications cannot change scanner documents, command/index producers, or target existence.
   - Replace archive extraction for document scanning with `ls-tree` + `cat-file --batch`; run base/head reads concurrently.
   - Store/cache normalized base findings keyed by merge-base SHA + scanner version. Preserve fork safety and fail-closed behavior.

6. **JSDoc / Identity / Circular**
   - JSDoc: invoke `./node_modules/.bin/eslint --max-warnings=0 -- <applicable changed files>`; no files means no step.
   - Identity: always check workspace slugs; glob/prefilter only changed files for local composer use, full with bounded concurrency.
   - Circular: first combine roots in one Madge call; add a conservative changed-scope skip. Prototype the repo-native import graph separately and compare cycle fixtures before removing Madge.

## 4. Risks / correctness tradeoffs

- **Changed scope is only sound with invalidators and deletion/rename awareness.** Name-only diffs miss the most important Semantic Delta and inventory cases.
- **Semantic Delta cannot blindly skip all source-only changes:** deleting a source file can make an existing Markdown reference newly broken; changing the CLI command tree can invalidate documented commands.
- **Schema inventory is global state.** Incremental reconciliation must retain untouched baseline rows and handle deleted/renamed files deterministically.
- **Native Runtime allowlist accounting is global.** A scoped scan cannot call untouched allowlist rows “unused.” Split integrity from usage or preserve a cached full usage index.
- **Docgen's two checkers overlap but are not proven identical.** Do not delete the policy step merely because both say “docgen”; prove/fold category, re-export, description, example, and `@since` behavior first.
- **Madge replacement can silently change resolution semantics** (path aliases, extension/index resolution, dynamic imports, type-only imports). Golden graph fixtures are required.
- **One shared syntax process raises failure-blast-radius concerns.** Keep per-law result boundaries and ensure one collector error is attributed to its law.

## 5. Open questions

1. Is the `Docgen` matrix check required on every protected-branch path, including any merge queue path? If not, ownership cannot move until it is.
2. Which exact metadata rules are unique to `Docgen.command.ts` analysis versus `repo-docgen/Checker.ts`? A fixture matrix should answer this before removal.
3. What percentage of PRs contain deletes/renames or governed Markdown? That determines the real Semantic Delta fast-path hit rate.
4. Should Circular mean cycles strictly inside the two tooling roots, or any cycle reachable from them? Current Madge behavior is the latter; its label/comment imply the former.
5. Can the policy runner expose per-phase CPU/RSS and selected-file counts? That would validate the 132 s target and catch scope regressions in hosted runs.
