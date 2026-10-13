# glob — round-2 merged inventory

Seats read: `grok.md` (2 findings), `sol.md` (1), and `fable.md` (4), plus `BRIEF.md` and the third-seat `BRIEF.grok3.md`. No part-N directories exist. The `fable` report identifies its fallback route as a separate Grok 4.7 medium session. Review head: `60fcfb5ebcdc26765a66cc1f13afc88adcb05d11`. Oracle: the brief-pinned cached checkout at `af7566a9da2eff169cb74955efcc5ede1e5de9f8`.

Counts after deduplication: **Required 1 · Backlog 2 · Handled by the deviation codemod 1 · Rejected 0 · Write groups 1**. All seven seat findings are represented below.

The complete operator revision block, including the 2026-10-09 rulings and later grilling, takes precedence over the older ladder and the briefs' green S2/S3 claim. D1–D20, section 12.5 and section 14 govern disposition. Docs/JSDoc, coverage and vitest-canon findings remain backlog under this merge assignment. Law/diagnostic-forced deviation bookkeeping belongs to the central codemod; neither the ledger nor README Port notes is assigned to a fix group.

Live provenance: this checkout is on `@lab/effected-2`, rather than the requested `@lab/effected`; no branch or source changes were made. `standards/effect-laws.allowlist.jsonc` contains **zero** entries for `scratchpad/effected/glob/**`, so there are no `allow-<n>` findings to add. Green gates are a claim in the briefs, not a new gate run. This merge used only report, source, test, oracle and commit-history reads; no diagnostic, test or coverage run was performed.

## Required

### sol-2-1 — Numeric brace ranges can fail to advance indefinitely

- file: scratchpad/effected/glob/internal/braceExpansion.ts:265; scratchpad/effected/glob/internal/braceExpansion.ts:272
- class: bug
- severity: required
- standard: D11; D9 and section 14 (`upstream-bug`); the compileResult totality contract; scratchpad/test/glob/hostility.test.ts:1–4 requires hostile input to finish without a hang or OOM.
- evidence: Sol reports separate watchdog-bounded, read-only lab and pinned-oracle subprocess probes of `expand("{9007199254740992..9007199254740992}", { max: 1 })`: both remained in expansion and were killed after 50 ms. Source inspection confirms `total = floor(abs(y - x) / abs(incr)) + 1` is 1, so the budget check passes, while IEEE-754 arithmetic makes `9007199254740992 + 1 === 9007199254740992`. The endpoint-controlled loop therefore never advances and appends indefinitely. The pinned oracle contains the same loop. This is distinct from the round-1 overflow finding, which concerned retaining `actual: Infinity` in the typed failure channel.
- failure: A short numeric-range pattern bypasses the expansion budget and consumes unbounded CPU and memory; direct expansion, facade compilation and schema validation can hang. A green finite-input suite does not enforce numeric-loop progress or catch this case.
- fix: Bound sequence generation by the validated member count rather than relying only on repeated floating-point addition and an endpoint comparison. Reject non-finite computed member counts before entering the loop through the existing typed expansion-budget guard, preserving the intentional positive-Infinity measurement domain and avoiding a NaN schema defect. Preserve ordinary ascending/descending order, increments and padding. Add regressions for the large singleton, non-advancing numeric endpoints, and overflowing endpoint/count arithmetic in braceExpansion.test.ts and hostility.test.ts; retain typed termination tests through both GlobPattern and GlobSet in their existing test files. The central deviation codemod records the verified upstream-bug change and adjusted tests; no ledger/Port-notes edit belongs to this source fix group.
- seats: sol-2-1

## Backlog

### grok-2-1 — Stale root-only throw documentation

- file: scratchpad/effected/glob/internal/ast.ts:643
- class: docs
- severity: backlog
- standard: D4; section 10.1; D11; this assignment defers docs/JSDoc work to S2.
- evidence: `#fillNegs` Details still says a child call throws `ASTError`, but its body at line 658 no longer checks `this !== this.#root`. The pinned oracle has the root-only throw, and PORT_LEDGER.json:3203–3205 records its removal as an unreachable-branch simplification under section 11.3. Both seats independently identify the same stale sentence.
- failure: The documentation promises a throw that the current method does not perform.
- fix: During S2 delete the throw clause and explain that the sole caller invokes the method on the root inside `toRegExpSource`; retain the completion-once explanation.
- seats: grok-2-1, fable-2-4

### grok-2-2 — Zero is incorrectly documented as an admissible recursion cap

- file: scratchpad/effected/glob/internal/ast.ts:1249
- class: docs
- severity: backlog
- standard: Section 10.1; .patterns/jsdoc-documentation.md; D11; this assignment defers docs/JSDoc work to S2.
- evidence: `AST.fromGlob` Gotchas calls `maxExtglobRecursion` a non-negative integer cap. `assertCap` at internal/limits.ts:314 rejects `value < 1`, and GlobPatternOptions uses a greater-than-zero refinement. The oracle also rejects caps below 1. Zero satisfies the documented non-negative condition but fails the actual contract.
- failure: Following the documentation with a zero cap produces `InvalidCap`, rather than the described degrade-to-literal behavior.
- fix: During S2 replace "non-negative" with "positive" while retaining the integer requirement and the explanation of exceeding the cap.
- seats: grok-2-2

## Handled by the deviation codemod

### codemod-1 — Record D15-forced checked-read behavior for sparse segment arrays

- file: scratchpad/effected/glob/internal/minimatch.ts:1083; scratchpad/effected/glob/internal/minimatch.ts:1400; scratchpad/effected/glob/internal/minimatch.ts:1470
- class: type-safety
- severity: backlog (centrally handled bookkeeping; not a required fix)
- standard: D15; D9 and section 14; operator ruling on per-module, per-class deviation bookkeeping; this assignment's commit-provenance rule for forced changes.
- evidence: `git log --all --format=%h:%s -- scratchpad/effected/glob/internal/minimatch.ts` exposes `ebdade507b` (`drop casts and directives in glob (effected-port step 2)`). Its diff replaces `a[ai] as string` / `b[bi] as string` with checked reads and the `partsMatch` undefined guard; replaces `file[i] as string` with the globstar-tail undefined guard; and replaces `pattern[pi] as ParseReturn` / `file[fi] as string` with the `#matchOne` undefined guard. Thus all three are directly tied to D15 assertion removal, rather than an unforced S3 shape change. Fable's concrete examples show the resulting sparse-input differences: the globstar body-tail scan returns false instead of throwing on an undefined file slot; `#matchOne` returns false instead of throwing on an undefined pattern slot or coercing an undefined file slot for a regexp; and `partsMatch` returns false instead of returning `[undefined]` for two equal holes. The later coverage test at internal/minimatch.coverage.test.ts:52–56 exercises the checked-read results. The module's existing type-safety deviation at PORT_LEDGER.json:3172–3175 names checked reads but does not enumerate these observable sparse-input results.
- failure: The central type-safety deviation inventory is incomplete for three sites sharing the same root cause. The evidence does not establish an unforced change to valid dense matching behavior.
- fix: Extend the central per-module type-safety deviation entry with these three sites and their upstream/lab sparse-input results, citing internal/minimatch.coverage.test.ts:52–56 and the uncovered equal-hole example. Keep the D15-forced guards. Do not dispatch fable-2-3's deletion as an upstream restore: its proposed equality-first merge would push undefined into the declared `Array<string>` result after removing the assertion, and the step-2 diff establishes the forced cause. Ledger and README Port-notes bookkeeping stays with the deviation codemod; no source/test write group is assigned for this item.
- seats: fable-2-1, fable-2-2, fable-2-3

## Rejected

None. Duplicate records were merged, documentation was deferred, and the sparse-array findings were reclassified using the verified D15 commit provenance. No unsupported or gate-enforced finding remains to reject.
