# glob round-3 merged inventory

Seats read: `grok.md` (1 finding), `sol.md` (3 findings), and `fable.md` (0 findings), with both adjacent briefs, `BRIEF.md` and `BRIEF.grok3.md`. No part-N directories exist. The fable seat identifies its route as a separate Grok 4.7 medium session. Review head: `3ad7b305790c7f0903f6d55766c55186745ba2d1`. Oracle: the brief-pinned cached checkout at `af7566a9da2eff169cb74955efcc5ede1e5de9f8`.

Counts after deduplication: **Required 3; Backlog 0; Handled by the deviation codemod 0; Rejected 0; Groups 1.** All four reported findings are represented below. Fable's `NO FINDINGS` is a seat outcome, not a rejected finding.

The complete operator revision block, D1-D20, section 12.5, section 14, and this merge assignment govern disposition. Docs, JSDoc, coverage, and vitest-canon work remains deferred by this assignment even though the briefs claim green S2/S3 gates. The prior inventory's closed findings and existing backlog are not new round-3 findings. Green gates are reported evidence from the briefs, not fresh proof from this merge.

This checkout is on `@lab/effected-2`, rather than the named `@lab/effected`. Source and test files were read without changing branches. The current native-runtime allowlist contains zero entries matching `scratchpad/effected/glob/**`, so there are no `allow-<n>` findings. No scratch-copy diagnostic, tests, coverage, ledger, or closeout command was run. Only this file and `required.json` are written.

## Required

### sol-3-1: Rounded numeric increments truncate a progressing brace range

- file: scratchpad/effected/glob/internal/braceExpansion.ts:275
- class: bug
- severity: required
- standard: D9; D11; section 14; the round-2 upstream-bug correction authorizes bounded handling of non-advancing arithmetic, not truncation of terminating ranges.
- evidence: Sol reports read-only probes against the pinned oracle and lab for `expand("{18014398509481984..18014398509482004..5}")`. The oracle emits six members ending in `18014398509482004`; the lab emits five ending in `18014398509482000`. Public `GlobPattern.compileResult` succeeds in both, but matching the endpoint is true upstream and false in the lab. At `max: 5`, upstream throws `GuardExceeded { reason: "ExpansionBudgetExceeded", limit: 5, actual: 6 }`, whereas the lab returns five members. Grok independently explains the arithmetic: at 2^54 the spacing is 4, so adding 5 advances by 4 even though the count estimate is `floor(20 / 5) + 1 = 5`. Source inspection confirms the estimate caps the loop at line 275. The oracle loop at src/internal/braceExpansion.ts:244 is endpoint-driven. `git log --format=%h:%s -- <file>` and the `0b6c0c60b8` round-2 diff attribute the new `member < total` bound to the verified stall fix. This is a defect in that fix, not unforced step-2/law bookkeeping and not a request to reopen the already-fixed hang.
- failure: A terminating range loses a valid alternative and produces a false-negative public match. Near the budget, truncation changes a typed upstream failure into successful expansion. The existing finite-range and stalled-range tests do not exercise rounded but advancing increments, so the green gate claim does not enforce this behavior.
- fix: Keep progressing numeric generation driven by the endpoint condition and enforce the actual generated-output budget. Detect non-advancing addition separately and retain bounded handling for those cases, including the existing singleton, duplicate-member, and overflow regressions. Retain the non-finite-count and pre-loop over-budget rejection. Add exact oracle-parity regression assertions for the six-member range and `max: 5` failure in braceExpansion.test.ts, and endpoint matching and typed-failure checks through GlobPattern and GlobSet in their existing test files. Do not restore the unbounded upstream stall loop or weaken its round-2 regression tests.
- seats: grok-3-1, sol-3-1

### sol-3-2: Repeated overlapping extglob alternatives cause exponential matching

- file: scratchpad/effected/glob/internal/minimatch.ts:1488; scratchpad/effected/glob/internal/ast.ts:1316
- class: perf
- severity: required
- standard: D11's algorithmic-class criterion; D9 and section 14 for a verified upstream bug; scratchpad/test/glob/hostility.test.ts:1-4 requires hostile input to complete without a hang or OOM.
- evidence: Sol reports that the default-options pattern `*(a|aa)b` compiles to `/^(?:a|aa)*b$/`. Matching `"a".repeat(n) + "c"` takes approximately 2.343, 12.543, 85.944, and 367.659 ms in the lab at n = 26, 30, 34, and 38; oracle timings are 2.837, 14.516, 91.933, and 402.973 ms. Thus this is inherited, not a measured port regression. The independent algorithmic argument meets D11: overlapping alternatives enumerate Fibonacci-many decompositions of the a-prefix before the b-suffix fails. Memoizing segment AST states or evaluating an equivalent automaton removes that exponential exploration. Source inspection confirms AST.toMMPattern builds an anchored native regexp and #matchOne calls its test method; Minimatch.parse retains no non-backtracking matcher for this pattern.
- failure: A nine-character pattern passes compilation guards but makes synchronous matching exponential on a short nonmatching candidate. The nesting cap does not bound shallow ambiguous repetition. The hostile-input suite tests nesting, not this repeated-overlap case, so its green result does not rule out the demonstrated defect.
- fix: Route repeated extglobs with overlapping alternatives through a non-backtracking segment matcher using memoized AST states or an equivalent automaton. Preserve the accepted language, segment boundaries, dot handling, case options, and existing parse/regexp metadata contract. Keep matcher state with its owner, using Effect collections where needed. The group owns ast.ts, minimatch.ts, and types.ts for AST evaluation, dispatch, and any typed owner metadata. Add positive and negative oracle-parity cases in engine.test.ts and public facade checks in GlobPattern.test.ts and GlobSet.test.ts; add a watchdog-bounded subprocess regression in hostility.test.ts so exponential matching cannot block the test process. The verified upstream-bug evidence supports the change under section 14; associated deviation recording goes to the orchestrator, with no ledger or README Port-notes edits assigned here.
- seats: sol-3-2

### sol-3-3: Sibling brace expansions allocate beyond the output budget before rejection

- file: scratchpad/effected/glob/internal/braceExpansion.ts:298; scratchpad/effected/glob/internal/braceExpansion.ts:306
- class: perf
- severity: required
- standard: D11's algorithmic-class criterion; D9 and section 14 for a verified upstream bug; the expansion-budget and hostile-input guarantees.
- evidence: Sol reports an in-memory Array.prototype.push instrumentation probe, restored afterward, for `expand("{" + Array.from({ length: 32 }, () => "{1..1000}").join(",") + "}", { max: 1000 })`. Both lab and pinned oracle accumulate 32,000 temporary members from the 321-character pattern before throwing `ExpansionBudgetExceeded { limit: 1000, actual: 32000 }`. Source inspection confirms every sibling receives the full max, its complete array is appended to N at line 298, and the parent only checks at line 306. For k siblings each producing B members, temporary member storage is Theta(kB); budget-aware accumulation can bound it to O(B). This is an algorithmic-class win under D11, not a claimed port regression. The nesting-depth cap does not reduce flat sibling accumulation.
- failure: The output budget limits returned results but fails to bound intermediate member storage. A rejected pattern may exhaust memory before delivering its typed error. Existing expansion-bomb tests assert eventual rejection without checking this allocation bound, so a green suite misses the defect.
- fix: Make sibling expansion and accumulation budget-aware and reject before materializing all remaining siblings. Bound retained intermediate member storage by the effective budget; account for suffix multiplication and top-level empty-result filtering so every within-budget result retains its order and contents. Preserve typed ExpansionBudgetExceeded failures; if early rejection changes the actual measurement, document the verified upstream-bug deviation through the orchestrator's central bookkeeping. Add allocation-bounded rejection regressions and boundary, suffix-product, and empty-member parity cases in braceExpansion.test.ts, plus a bounded hostile-input regression in hostility.test.ts. No ledger or README Port-notes edits belong to this group.
- seats: sol-3-3

### Write group g1

All three findings belong to one group. The numeric correctness and sibling-allocation fixes share braceExpansion.ts. Both performance regressions need hostility.test.ts, and the public regression checks share facade test files. Splitting them would overlap write ownership.

Source ownership is limited to four files: internal/braceExpansion.ts, internal/minimatch.ts, internal/ast.ts, and internal/types.ts. Test ownership is braceExpansion.test.ts, engine.test.ts, hostility.test.ts, GlobPattern.test.ts, and GlobSet.test.ts, all under scratchpad/test/glob/. The exact paths and finding IDs are in required.json. No source/test file belongs to more than one group. Root manifests, lockfiles, repo configuration, PORT_LEDGER.json, and README Port notes are outside the group.

## Backlog

None newly reported in round 3. The prior round's documentation backlog remains with the orchestrator and is not counted again.

## Handled by the deviation codemod

None newly reported in round 3. No seat merely requests recording a law-forced change. The numeric finding challenges the changed behavior itself, and the two performance findings require source fixes. Any resulting deviation bookkeeping remains central and does not create another required finding or write group.

## Rejected

None. Every retained finding has concrete evidence and a fix. The duplicate numeric records are merged, not rejected. Both inherited performance findings meet D11 through an algorithmic-class improvement; their inherited status alone is not grounds for rejection. No report requests an operator-forbidden change or a fix already enforced by a green gate.
