# Opportunities

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
