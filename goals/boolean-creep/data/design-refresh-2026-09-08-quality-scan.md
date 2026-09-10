# Boolean-creep quality/scanner design refresh — 2026-09-08

- Reviewed source: `05405bf322da0ca7eb88b8bb402145081e8fded6`.
- Packages/apps corpus baseline: `origin/main` at
  `be8995e66aeefedf0dabf131deaeaaf25c8e6fc8`.
- Scope: design-only refresh; no source, inventory, dependency, generated-file,
  or git-ref changes.

## `r3-tooling-quality-repo-wide-step-gates`

Refreshed `designs/r3-tooling-quality-repo-wide-step-gates.md` against current
`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`. Corrected shifted
citations and the migration graph. The former design incorrectly deleted
`isExplicitTurboScopeArg` and `isExplicitTurboAffectedOrScopeArg`; live search
shows they also own workspace-task, coverage, and integration-test behavior.
The refreshed design retains those shared recognizers, deletes only the two
`shouldRun*` boolean projections and their five repeated reads, classifies
caller-visible args before generated labs arguments, and covers both planner
and direct lint-runner paths.

## `r3-tooling-quality-root-audit-head-kind`

Refreshed `designs/r3-tooling-quality-root-audit-head-kind.md` against current
`Tasks.ts`, `Quality.schemas.ts`, and `internal/repo-run/RepoRun.proofs.ts`.
Corrected shifted citations, enumerated both canonical mode domains, specified
the repository-preferred LiteralKit + private member classes +
`S.toTaggedUnion("kind")` topology, and preserved the public selection output.
The former test plan treated a leading `--` as an ordinary head; live code
strips it before classification. The refreshed matrix covers `--` alone and
`--` followed by every head kind while preserving head strip/retain behavior.

## `scan-state-json-lexer-flags`

Refreshed `designs/scan-state-json-lexer-flags.md` against current
`packages/agents/server/src/AssistantTurn/ScanState.ts`, its AssistantTurn
barrels/runtime consumer, and both scanner tests. The design now distinguishes
the independent `inBlocksArray` latch from the three-state JSON string phase,
accounts for every old field read/write, and states the real internal encoded
shape change. It keeps the public wrapper's field-by-field plain-object copy;
the former design's direct `result.state` return could change runtime prototype
semantics. The test plan retains the property proof and adds explicit
backslash/escaped-quote/closing-quote chunk-boundary transitions.

## Verification

- `git diff --check` passed for all three refreshed design files.
- `git diff 05405bf322da0ca7eb88b8bb402145081e8fded6 -- <reviewed source
  files>` was empty, confirming the inspected source graph still matches the
  named source SHA.
- `bun goals/boolean-creep/ops/validate-designs.ts` passed:
  `design coverage OK: 105 qualified ids`.
