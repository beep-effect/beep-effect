# Shared coverage runtime selector review

Reviewed 2026-09-15 against the `bun-coverage-runtime` PR worktree. This is a
read-only review of `vitest.shared.ts` and the comment-only change in
`vitest.setup.ts`; no tests, builds, benchmarks, or package writer ran during
this review. Other worktree changes are outside this verdict.

## Findings

No blocking implementation defect found in the two-file change. The selector
at `vitest.shared.ts:25` chooses Istanbul when the configuration process reports
`process.versions.bun`, otherwise V8. Its value reaches the shared coverage
configuration at `vitest.shared.ts:253`. This matches the pre-existing root
selector (`vitest.config.ts:3-8`) and Storybook selector
(`apps/storybook/vitest.config.ts:3-8`). Both provider packages are already root
catalog/dependency entries (`package.json:136-137`, `package.json:276-277`).
The setup change modifies only explanatory comments; it does not change the
Node shim or its guard.

The runtime predicate observes the configuration host, not an independent
worker witness. The supported verification should use the standard inherited
runtime pool and record the worker runtime. Do not advertise support for a
custom pool that runs workers under a different executable based on this
selector alone.

A live manifest scan found **134 coverage scripts**, all beginning with
`bunx vitest `, and none containing `--bun` or starting with `bun `. A targeted
search of CI workflows, root scripts, and the Quality command implementation
found no explicit Bun coverage launcher. Thus the reviewed change does not
migrate the canonical coverage lane to Bun. This is launch-configuration
evidence, not a new executed worker witness. An exhaustive source-test search
under `packages/` and `apps/` found no tests asserting an unconditional V8
provider that need updating.

## Required interpretation

The controlled fixture already recorded in
`coverage-provider-adjudication.md` rejects Bun/V8 false-positive coverage and
supports Bun/Istanbul counter accuracy for that fixture. It does not establish
ratchet compatibility. The parent agent's actual comparator result is zero
findings for Node/V8 and 260 for Bun/Istanbul: 252 from 63 omitted zero-unit
files, plus eight executable-metric findings. Those comparator results were
reported to this reviewer, not rerun here. Keep canonical Node/V8 launchers and
existing baselines; this patch enables an explicit experimental runtime with a
suitable provider, not an accepted global provider migration or cost saving.

## Minimal meaningful verification

1. Run the existing root configuration typecheck through its canonical quality
   entry point. This validates the shared provider union and configuration
   surface; setup behavior itself has no code diff.
2. Resolve a temporary fixture config that inherits the real shared config
   under the pinned Node runtime and under Bun. Do not override `coverage.provider`
   in this fixture. Assert the resolved provider is respectively V8 and Istanbul.
   This catches a selector or merge regression that the earlier explicit-provider
   four-cell fixture cannot detect.
3. Execute only the existing small branch/untouched-source contract through
   those two inherited configurations, with one worker and the normal runtime
   pool. Capture actual worker runtime and assert the unreachable break and
   nullish fallback remain uncovered, and the untouched executable source has
   zero counters. Compare semantic counters rather than requiring cross-provider
   source-map identity. These two bounded runs are sufficient for the selector;
   repeating full schema benchmarks would not add selector-specific assurance.

Discovery used one graft query (`coverageProvider`), followed by targeted live
config, diff, test, and manifest inspection. Graft reported approximately 3,163
tokens saved.
