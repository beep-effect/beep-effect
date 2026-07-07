# one-round-loop — Research fact base (2026-07-07 Explore briefs)

## CI bucket (explore-ci-2)

- check.yml: one workflow, ~885 lines; `verify` matrix job (9 lanes: lint,
  lint-policy, repo-sanity, check, test-unit, test-integration, coverage,
  docgen, codegen) + standalone jobs (pr-size, professional-desktop-ipc-stdio,
  fallow-advisory, knip, jsdoc-ratchet, build[push-only], commitlint, secrets,
  security, nix, sast). Blacksmith runners; `cancel-in-progress: true`.
- PR runs export `TURBO_SCM_BASE=origin/$GITHUB_BASE_REF` + `--affected
  --summarize`; turbo cache CSF-001: PR = `local:rw,remote:r`.
- Docgen lane has 3 modes (none/affected/full) computed by lane-gate.
- **`ciCommand` group already exists** (commands/Ci/Ci.command.ts) with one
  subcommand `append-turbo-summary`; `beep ci lane` / `beep ci local` slot in
  as siblings. Error type `CiCommandError` exists.
- Reusable runners: `QualityTaskStep` (S.Class, Tasks.ts:163), `runStep`
  (:806, live stdio), `runStepGroup` (:991, parallel + captured + bounded),
  `runQualityTaskStreamingStepGroup` (:897, serial + live — what
  github-checks uses), `GithubCheckLaneSpec` {id, stage, blockedBy, step}
  (Quality.command.ts:588) + `githubCheckLane`/`bunRunLane`/`bunxLane`/
  `repoCliLane` helpers + `githubCheckLanesForModeForTesting(repoRoot, mode)`.
  `blockedBy` exists on the schema but the runner ignores it (no DAG).
- bin-main.ts:184-202 has a quality-verb fast path worth mirroring for
  `beep ci lane`.
- **yeet verify (full tier) = fallowAdvisoryFeedbackStep + `bun run beep
  quality github-checks pre-push`**, which already covers: build, check,
  knip, jsdoc-ratchet, full lint+policy+typos, docgen, all test lanes,
  fallow dead-code, repo-sanity lanes (changeset-graph, tsconfig-sync,
  fallow-boundaries-config, version-sync, syncpack, sherif, bun-audit),
  changeset status, secrets/gitleaks, security/OSV, sast/Semgrep, nix.
- **CI-vs-verify delta (required checks): 5 whole lanes** — Coverage
  Regression, Codegen Drift, Commitlint, Professional Desktop IPC
  Stdio, Security/dependency-review (dep-graph API: permanent CI-only).
  ADVERSARIAL-REVIEW CAVEAT (2026-07-07): this understates the gap —
  pre-push also differs in SHAPE (full local build/check/test/docgen vs
  the PR matrix affected/summarized forms) and CI Security has
  sub-gates beyond OSV. P0 first deliverable is the authoritative
  lane-by-lane parity table; treat the 5-lane figure as a floor.
- Lint Policy is NOT a delta (CI splits it only because affected-mode lint
  suppresses repo-wide policy steps; unscoped `bun run lint` runs them).
- **Required checks frozen by ruleset 10240248**: 17 contexts (Lint,
  Lint Policy, Check, Test Unit, Test Integration, Docgen, Codegen Drift,
  Repo Sanity, Coverage Regression, Knip, JSDoc Ratchet, Commitlint,
  Secret Scanning, Security, SAST, Nix Shell, Professional Desktop IPC
  Stdio). NOT required: PR Size Label, Fallow Advisory Envelopes, Build.
  Managed via gh api (not declarative). ANY lane rename must ship a
  same-change ruleset update or PRs become unmergeable.
- No retry infrastructure anywhere in .github; `cancel-in-progress: true`
  is the source of "operation was canceled" on superseded runs (some
  cancellations are benign supersessions, not infra flakes).
- commitlint.config.ts = config-conventional only; CI computes commit range
  itself (`--from <base> --to HEAD`); not a beep command today.

## Test/coverage bucket (explore-test-2)

- fast-check imported as `import { FastCheck as fc } from "effect/testing"`
  (167 importing files). `numRuns:` on 287 lines across 161 files (live
  2026-07-07; regenerate at execution time); 264 `fc.assert` sites; 53
  `assertSchemaArbitraryDecodesToSelf` calls; PLUS it.prop/test.prop
  sites (drivers/pacer) whose fastCheck params also override globals.
  `fc.configureGlobal` used NOWHERE.
- **Inline `{ numRuns: N }` OVERRIDES configureGlobal** → a global config
  alone cannot raise the bulk. Mechanism: max()-aware shared wrapper
  reading BEEP_FC_NUM_RUNS (`numRuns = max(envFloor, inline ?? default)`)
  + codemod of ~278 fc.assert sites; PLUS configureGlobal in
  vitest.setup.ts (already wired via vitest.shared.ts:118 setupFiles) as a
  floor for options-less asserts.
- Precedent helper: packages/tooling/test-kit/test-utils/src/Schema.ts
  `assertSchemaArbitraryDecodesToSelf(schema, {numRuns})` with `?? 50`;
  barrel @beep/test-utils.
- Turbo gotcha: BEEP_FC_NUM_RUNS must be declared in the turbo task `env`
  or it gets stripped (mirrors VITEST_COVERAGE_* declarations).
- Coverage ratchet: all in commands/Quality/internal/CoverageRegression.ts.
  Baseline stores PERCENTAGES only (schema_version 1, S.Literal(1) at :91);
  **VitestCoverageMetric (:103) already parses {total, covered, skipped,
  pct} — raw counts are decoded then DISCARDED at toCoveragePackageBaseline
  (:223)**. v2 = field-add + `S.Literal(2)` + regenerate via
  `coverage:baseline:write` (= `beep-cli coverage -- --write-baseline
  --concurrency=3`). Comparator exported for testing
  (compareCoverageRegressionSnapshotsForTesting :504); renderers
  renderCoverageFailures :506 / renderNewPackageWarnings :513; new-package
  path is warning-only (the @beep/pacer gap).
- Coverage lane runs plain-node vitest (NOT --bun) for v8 instrumentation;
  vitest.setup.ts Bun-shim exists for that. v8 provider honors
  `/* istanbul ignore */` comments via AST remap (9 comments, 5 files).
- 8 packages keep local 100% thresholds via `vitestCoverageReportOnly ? {} :
  {thresholds:...}`; global floors retired — baseline compare is sole judge.
- Versions: vitest ^4.1.9, @effect/vitest 4.0.0-beta.93, coverage-v8 ^4.1.9.

## CLI/tooling bucket (direct probes, 2026-07-07)

- `process.cwd()`: 38 sites across ~12 CLI command files (SchemaFirst x7,
  RepoRun.executor x5 — comment examples, not runtime —, DualArity x4, Yeet Handler x3, Lint.command x3,
  Quality/Tasks x2, Laws/TerseEffect x2, Laws/EffectImports x2, Worktree
  x1, Research x1, PackageVerify x1, ChangesetGraph x1). Nearly all
  assume repo root; Worktree (and possibly Research) legitimately mean
  the invocation directory.
- SchemaUtils is a directory module:
  `packages/foundation/modeling/schema/src/SchemaUtils/` (barrel
  re-export at src/index.ts:325) -- `withNormalizedCheck` lands there as
  a sibling module.
- Fallow envelope: schema at `packages/tooling/tool/cli/src/commands/
  Quality/internal/FallowEnvelope.schema.ts`, builder in
  `FallowQuality.command.ts`. The raw report already carries
  path/name/line (complexity) and file/start_line/end_line/fragment
  (duplication instances); the envelope discards them.
- Yeet staged gate: `commands/Yeet/internal/Handler.ts:1188` -- errors
  "yeet publish requires reviewed staged changes" when
  `git diff --cached --name-only` is empty.
- Worktree command EXISTS: `beep worktree new/remove/doctor`
  (commands/Worktree/Worktree.command.ts:779/809/831/863) and `new`
  ALREADY runs `bun install` in the target worktree (:716). The
  crispening's worktree pain came from bypassing it with manual
  `git worktree add` + node_modules symlinks. Stretch item S3 is
  adoption/measurement/tuning, not new construction.
- Generated standards files (regen-generated scope):
  coverage.regression-baseline.jsonc, dual-arity.inventory.jsonc,
  fallow.boundaries.generated.jsonc,
  fallow.dead-code.regression-baseline.jsonc,
  jsdoc-documentation.inventory.{jsonc,md},
  jsdoc-totals.regression-baseline.jsonc,
  knip.regression-baseline.jsonc, schema-catalog.generated.jsonc,
  schema-first.inventory.jsonc (ledger portions are hand-curated --
  regen must preserve exception entries, like `lint schema-first
  --write` already does).
  Note: effect-laws.allowlist.jsonc is NOT in this list — validation
  input with no writer (hand-maintained, adversarial-review corrected).
- `.gitattributes` exists but contains only LF normalization; git merge
  drivers require local (non-versionable) git config -- basis for R3's
  regen-command-over-merge-driver ruling.

## CLI/tooling bucket — full Explore brief deltas (2026-07-07)

- `bun run beep` failure from subpackages is a SCRIPT-RESOLUTION failure
  (bun does not walk up past the nearest package.json; per-package
  "beep" keys are `{family, kind}` config objects, not scripts). Two
  failure layers: script resolution AND command-level cwd==root
  assumptions — a shim without the chdir makes the second layer worse.
- Invocation-cwd consumers: NONE found. Worktree re-derives its context
  from `git worktree list --porcelain` (resolveWorktreeContext:432);
  Yeet runs git with explicit cwd; Files uses path.dirname. The
  BEEP_INVOCATION_CWD stash is defensive only.
- findRepoRoot is worktree-safe (fs.exists matches the `.git` FILE in
  linked worktrees — no teleport to the main checkout).
- Fixed-point migration targets (corrected): venice-ai
  VeniceAI.service.ts:75-95; phoenix Phoenix.config.ts:16-36; m365
  M365.config.ts:139-159 (byte-identical hand-rolls); uspto
  Uspto.config.ts:30-41 lacks the check (migration = behavior
  tightening). TSConfigJsonKey is a __proto__ guard, NOT a fixed-point
  check — excluded.
- SchemaUtils style: one file per combinator, alphabetized barrel,
  `const $I = $SchemaId.create("SchemaUtils/<name>")` per file; no
  existing combinator uses S.makeFilter (withNormalizedCheck is the
  first check-based one); withKeyDefaults is dual, withConstantDefault
  curried — mirror the curried shape.
- Fallow envelope findings are materialized from integer COUNTS via
  A.unfold (findingsForCount:639, auditFindingsForCount:523), not from
  the raw objects — the raw per-item schemas (FallowHealthFinding:118
  with path/name/line, etc.) are decoded for shape-validation then
  DISCARDED. Lifting file/line/name = optional schema fields (cheap) +
  rewriting the normalize* builders to map over the decoded raw arrays
  (the real work). The AUDIT lane is counts-only at the top level —
  only duplication instances[].file (+ currently-unparsed start_line)
  is liftable there. sourceRef is a hardcoded constant
  (fallbackSourceRef:70).
- Yeet committed-branch mode mechanics: the skipCommit fork already
  exists (Handler.ts:2314 via shouldSkipCommitForReusablePublish:2237);
  runPostCommitPhases(:2337) does proof->push->PR->monitor regardless;
  ensurePullRequest(:719) is idempotent. Today the only no-commit route
  is `--push-only --reuse-verified` which ALSO skips proof. New mode =
  reuse the fork, drop the reuseVerified durable-state requirement,
  keep proofStep+pushStep+ensurePullRequest+monitorSteps, and relax the
  pre-dispatch --message requirement (Handler.ts:2135; message is only
  consumed in the commit block).
- Worktree: `beep worktree new/remove/doctor`; new = addWorktree ->
  submodule update -> bun install (:716) -> copyLocalFiles
  (WORKTREE_LOCAL_FILE_ENTRIES:45 = .env, .claude/settings.local.json,
  CLAUDE.local.md, .idea). Canonical doc: standards/git-worktrees.md
  (279 lines); explorations/agent-pipeline-velocity drives worktree
  strategy (SEAM — coordinate S3 with it). Gaps: no `list`, no
  branch-from-base (always HEAD), no --no-install, remove only PRINTS
  `git branch -D`, local-files list diverges from the standard.
- Generated-file regen commands (see decisions-locked R3 for the
  authoritative scope list); effect-laws.allowlist.jsonc is
  hand-maintained/validate-only and stays OUT of regen-generated.

## P0 design refinement (from the delta finding)

`beep ci local` ≈ `quality github-checks pre-push` + the 4 locally-runnable
delta lanes (coverage, codegen-drift, commitlint, desktop-IPC) —
dependency-review documented as permanent CI-only. So P0 has two halves:
(a) NEW: `beep ci lane <id>` mapping every check.yml lane id to its exact
    command via GithubCheckLaneSpec-style definitions; check.yml case-block
    and standalone jobs become thin `bun run beep ci lane <id>` calls
    (keeping CI-only setup like caches/typos-install/docker in the
    workflow, parameterized via flags: --base, --mode, --affected).
(b) `beep ci local` = full battery locally (reuses the same lane defs),
    with --lanes selection, --fast preset (skip slow: coverage,
    test-integration, nix), --affected passthrough.
Fences: required-check names frozen (ruleset update ships in the same
change if renamed); behavior parity proven by a pre/post full CI run diff.
