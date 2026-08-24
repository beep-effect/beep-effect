# Opportunities

## 2026-08-13 — Post-merge coverage baseline generation stopped on a locationless UI compiler diagnostic

- **What was happening:** regenerating the coverage regression baseline on the
  merged `origin/main` tree with `bun run coverage:baseline:write`.
- **Evidence:** separate attempts stopped first in `@beep/ui#build` and then in
  `@beep/box#build`, each emitting `TS2589: Type instantiation is excessively
  deep and possibly infinite.` without a source location. The UI package
  passed immediately in isolation, and the repository already classifies this
  exact package-attributed signature as an environment-only flake. Neither
  failed attempt updated the committed artifact.
- **What would have prevented it:** a deterministic source location or a
  package-level diagnostic receipt for locationless native-compiler failures
  would make attribution possible without rerunning the full 133-package
  coverage graph.

## 2026-08-13 — Baseline retry stopped in an explicitly out-of-scope compiler-routing test

- **What was happening:** retrying `bun run coverage:baseline:write` after the
  isolated UI build passed.
- **Evidence:** `@beep/repo-configs#coverage` failed because its compiler-routing
  subprocess exited 0 but captured an empty TypeScript-version stdout. The
  security branch keeps this test byte-identical to `origin/main`, per the
  operator's instruction to evict its earlier edit from security scope.
- **What would have prevented it:** make the compiler-routing assertion stable
  under the repository's concurrent coverage runner, or give baseline
  generation a supported way to consume already-proven package coverage
  artifacts after an unrelated package test flakes.

## 2026-08-13 — Focused Vitest worker startup timeout

- Work: current-HEAD validation for the candor, coverage, and CI Turbo cache
  findings, plus the AI-sync doctrine-fix verification pass.
- Evidence: parallel focused Vitest invocations timed out after 60 seconds while
  starting fork workers; no test body executed. A later Bun-focused CSF-012 run
  repeated the no-test worker timeout. The later AI-sync Bun/Vitest attempt
  likewise timed out before importing tests; bounded Node Vitest commands are
  the successful fallback.
- Prevention: provide a documented low-concurrency focused-test lane for resource-contended validation runs, or make the test runner fail fast with an explicit worker-start attribution.

## 2026-08-13 — Coverage baseline blocked by unreliable subprocess capture

- Work: regenerate the committed coverage baseline after adding per-file provenance.
- Evidence: `bun run coverage:baseline:write` stopped after 83 successful tasks because the compiler-routing test captured an empty TypeScript API version even though the child exited zero; the direct command emitted `6.0.3`.
- Prevention: inspect an already imported dependency's API version in-process; reserve subprocess capture for the compiler binaries whose routing behavior is actually under test.

## 2026-08-13 — Coverage baseline sandbox denied a loopback proof server

- Work: regenerate the committed coverage baseline after adding per-file provenance.
- Evidence: the sandboxed generator reached 188 tasks, then the existing AI-metrics OTLP test failed with `listen EPERM` on `127.0.0.1`; the failure occurred before the test server could start.
- Prevention: expose a quality-run profile that permits loopback listeners while retaining filesystem and external-network isolation, and classify bind failures as environment-only before retrying the full baseline.

## 2026-08-13 — Local docgen found an introduced annotation gap

- Work: complete documentation proof for the semantic archive oracle change.
- Evidence: the first `bun run docgen:local` attributed one introduced issue:
  `makeKnowledgeArchiveOracle` lacked `@category` and `@since`; after the narrow
  JSDoc repair, the rerun passed 34/34 Turbo tasks and left no generated docs
  dirty.
- Prevention: include required export annotations while introducing the symbol,
  before the documentation proof pass.

## 2026-08-13 — Mixed ignored/publishable changeset stopped quality preflight

- Work: run the full local GitHub-quality baseline for the reviewed security
  changes.
- Evidence: `changeset:status:since-main` rejected one changeset containing
  ignored `@beep/repo-cli` together with publishable `@beep/ai-sync` and
  `@beep/infra`; no heavy quality lane ran.
- Prevention: derive release entries from `.changeset/config.json` before
  authoring a batch changeset, and keep ignored packages out of mixed release
  records.

## 2026-08-13 — Full lint lane was opaque during a long-running subcheck

- Work: run the full local GitHub-quality baseline after the changeset fix.
- Evidence: the audit emitted completion for most lint sublanes, then stayed
  quiet long enough that the PTY was interrupted; the terminal reported
  `All fibers interrupted without error` rather than a code diagnostic.
- Prevention: have the aggregate lint operator emit periodic active-step
  heartbeats with elapsed time so a slow sequential subcheck is distinguishable
  from a stalled worker without inspecting process arguments.

## 2026-08-13 — Restaging an indexed deletion produced a pathspec error

- Work: refresh the exact staged baseline candidate after reviewer-driven
  fixes.
- Evidence: an exact `git add -u -- <deleted-file>` retry reported `pathspec did
  not match any files` because the deletion was already present in the index;
  the preceding existing-file staging succeeded and the candidate remained
  correct.
- Prevention: inspect the cached name-status first and avoid re-adding an
  already-indexed deletion, or stage the owning directory when the deletion is
  not yet indexed.

## 2026-08-13 — Focused proof missed aggregate documentation and Effect diagnostics

- Work: establish the green quality-review baseline for the security findings
  changeset after all focused implementation proofs passed.
- Evidence: `bun run audit:github quality` found one JSDoc tag-order warning in
  the Knowledge oracle and seven Effect diagnostics in the changed infra and
  coverage tests; the focused package checks and Vitest runs had passed without
  running those aggregate policy lanes.
- Prevention: add targeted changed-file entry points for the repository JSDoc
  tag-order and test Effect-diagnostic policies, and include them in focused
  fixer proof before the full GitHub-quality aggregate.

## 2026-08-13 — Local docgen passed before the repository JSDoc ratchet failed

- Work: prove the quality-review baseline after repairing the focused
  documentation and Effect diagnostics.
- Evidence: scoped docgen passed 34/34 tasks, but the later repository JSDoc
  inventory reported `missingExportExamples: 5 > 4` for the internal Knowledge
  oracle because its documentation had no titled example. The first repair put
  the example before `Details` and `Gotchas`, and the next ratchet correctly
  rejected two `section-after-example` findings.
- Prevention: include the repository JSDoc inventory/ratchet in focused proof
  whenever a changed source file adds or newly exports a documented symbol;
  successful doc generation alone does not enforce the totals ratchet. Keep
  titled examples after every prose section and immediately before JSDoc tags.

## 2026-08-13 — Bun lock refresh could not discover a sandbox temp root

- Work: refresh `bun.lock` after declaring the test dependencies used by the
  reviewed infra and repo-configs packages.
- Evidence: `bun install` exited before dependency resolution with `Unexpected
  accessing temporary directory. Please set $BUN_TMPDIR or $BUN_INSTALL`.
- Prevention: have repository package-install wrappers select a writable
  workspace or `/tmp` temp root when Bun runs in a restricted agent sandbox.

## 2026-08-13 — Cross-surface docgen found invalid Knowledge examples

- Work: prove the AI-sync review fixes with the repository's scoped docgen lane.
- Evidence: AI-sync documentation passed, then docgen stopped after 119 of 123
  tasks because in-progress Knowledge examples referenced unavailable
  `Str.equivalence` and `Str.truncate` APIs.
- Prevention: typecheck new JSDoc examples with the owning package's focused
  docgen task before a parallel fixer hands its surface back for aggregate proof.

## 2026-08-13 — Canonical audit could not refresh Git state in the sandbox

- Work: run the exact-head aggregate GitHub-quality audit after the Round 1
  reviewer fixes converged.
- Evidence: the audit stopped before quality lanes because `git fetch` could
  not open `.git/FETCH_HEAD` on the read-only sandbox Git mount.
- Prevention: grant the canonical audit command repository Git metadata access
  when its preflight must refresh `origin/main`; keep read-only focused checks
  available for iterations that do not require remote freshness.

## 2026-08-13 — Tooling schema-first check has no changed-scope mode

- Work: run focused schema proof after adding a Git-branch refinement and
  coverage-summary invariants during the review/fix loop.
- Evidence: `bun run beep lint tooling-schema-first` reported 173 repository-
  wide findings, dominated by existing file-name and exported-interface rules,
  while the baselined `bun run beep lint schema-first` check completed with
  zero missing, stale, enforced, or advisory entries.
- Prevention: add a base/diff or explicit-file mode to the tooling schema-first
  command so a focused fixer can distinguish introduced violations from the
  unbaselined repository inventory without parsing the aggregate output.

## 2026-08-13 — Serialized coverage baseline generation reached a sandboxed OTLP bind

- Work: regenerate the schema-v2 coverage regression baseline from the merged
  tree while avoiding the native compiler's parallel resource failures.
- Evidence: the serialized generator completed 172 of 205 tasks, then the
  `@beep/repo-ai-metrics` coverage lane reported 204 passing tests and one
  failure because its real OTLP endpoint could not bind a loopback address:
  `listen EPERM ... 127.0.0.1:<redacted>`. The generator therefore wrote no
  baseline.
- Prevention: provide the coverage lane a supported loopback capability in
  restricted environments, or add an explicit environment-gated transport
  seam that preserves the real-endpoint test in capable CI environments.

## 2026-08-13 — Aggregate build encountered a corrupt generated Next cache

- Work: establish the exact post-merge GitHub-quality baseline after the
  security review fixes and coverage baseline regeneration.
- Evidence: `@beep/oip-web` stopped its production build because the generated
  `.next/cache/turbopack/.../CURRENT` file was four invalid bytes; the build
  reported `Failed to handle database versioning` before application source
  compilation could complete.
- Prevention: make the app build detect and discard an unreadable generated
  Turbopack database, or isolate per-run Next caches so interrupted builds
  cannot poison a later quality run.

## 2026-08-13 — Scoped docgen emitted a retired Turbo daemon flag

- Work: compile the corrected JSDoc examples for the changed repo-cli package
  before rerunning the aggregate quality baseline.
- Evidence: `bun run docgen:local -- --package @beep/repo-cli` stopped in the
  planner because the current Turbo CLI rejected `--daemon=false` and expects
  `--no-daemon`; no package docgen task executed.
- Prevention: update the scoped docgen planner to emit the current Turbo flag
  spelling, and keep a contract test that executes the generated command
  against the repository-pinned Turbo version.

## 2026-08-13 — Yeet install preflight exhausted the shared temp filesystem

- Work: rerun exact-head Yeet verification for the isolated semantic-delta
  remediation after attributing an unrelated unit-test failure.
- Evidence: the detached clean-HEAD install stopped with `ENOSPC` while copying
  a generated dependency artifact. A subsequent external temp cleanup removed
  several disposable worktree directories, although their committed branches
  remained recoverable from repository metadata.
- Prevention: check required free space before creating the detached install
  worktree, place large verification worktrees on the repository filesystem
  when `/tmp` is capacity-constrained, and never clean active uncommitted temp
  worktrees without first preserving their scoped diffs.

## 2026-08-13 — Review threads arrived after the first hosted closeout snapshot

- Work: close every review comment on the semantic-delta security pull request
  after pushing the first requested repair.
- Evidence: the first hosted snapshot contained one OpenClaw thread, which was
  repaired, replied to, and resolved. A later paginated GraphQL refresh found
  three newer Codex threads, including two P1 findings, even though the flat
  check summary already showed the automated review checks as successful.
- Prevention: after every review-fix push, repeat the paginated GraphQL thread
  inventory after automated reviewers finish, then run it again immediately
  before declaring merge readiness; never infer zero comments from check
  conclusions or a prior thread snapshot.

## 2026-08-13 — Focused semantic-delta proof omitted the Fallow complexity gate

- Work: prove the review-thread repairs for the semantic-delta security pull
  request before pushing its refreshed head.
- Evidence: 64 focused tests plus package check, lint, ESLint, Biome, and an
  independent zero-finding review were green, but full Yeet stopped in its
  pre-push wave because Fallow attributed five complexity findings to the new
  non-executing command-surface parser. Security, SAST, Nix, and the remaining
  preflight checks passed; heavy lanes correctly did not start.
- Prevention: when a review repair introduces a parser or evaluator, run the
  changed-scope Fallow audit during the focused loop and decompose reported
  hotspots before the authoritative Yeet proof.

## 2026-08-13 — Package checks omitted Effect diagnostics in changed tests

- Work: rerun full Yeet after simplifying the semantic-delta provenance
  parser and clearing its Fallow findings.
- Evidence: the focused Knowledge tests, repo-cli check, lint, ESLint, Biome,
  and Fallow audit passed, then the global test TypeScript lane rejected two
  native JSON fixture encoders with `preferSchemaOverJson`. Build and all
  preceding full-proof lanes were green; later test and documentation lanes
  did not start after the hard check failure.
- Prevention: include `bun run beep quality test-tsgo` in focused proof when a
  repair changes package test files, because the owning package check does not
  cover every repository Effect diagnostic applied to tests.

## 2026-08-24 — Packet sanitation misclassified reflection frontmatter

- Work: run the packet's public-repository sanitation check after adding the
  required closeout reflections.
- Evidence: `scanSensitiveText` reported `spreadsheet-formula` once for each
  reflection because the whole-document input began with the required `---`
  YAML delimiter. The reflection lint separately accepted both artifacts with
  zero blocking findings.
- Prevention: give packet-level sanitation a frontmatter-aware document mode
  that scans frontmatter values and Markdown body content without treating the
  YAML delimiter as an exported spreadsheet value.
