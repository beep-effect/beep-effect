# Unchanged owned cleaner input uses its existing parent reservation

Review on PR #2737 identified a second parent reservation when an already-issued
source traversed an empty cleaner generator. Raw extraction reserves its source
before issuance. The generator is truthy but yields no steps; no replacement
text is allocated. Charging that source again could incorrectly refuse an
otherwise admitted operation at the producedTextUtf16 ceiling.

CleanerPipeline now distinguishes the top-level already-owned input from a raw
text run when settling a zero-step plan. Both paths retain local cleaner
accounting and its ceiling. The owned path issues and consumes a local ticket
without another parent reserve; the raw path retains its parent reservation.
Actual callback/builtin output and nested work retain their existing parent
capacity/reservation behavior. The flag is private composition state supplied
by the two methods, never request data. Work closure, sanitization, deadlines,
owned-value validation and source-size preflight remain shared.

The parent-budget regression uses the actual named-generator adapter. Four
source units fill a four-unit parent budget, then an empty truthy generator
returns the identical source handle with four local units and four total parent
units. The generator reaches GEN_CLOSED. A subsequent raw-text invocation with
the same exhausted parent still refuses producedTextUtf16. Existing callback
and native-output controls continue to prove parent enforcement, pre-allocation
refusal and acknowledged native retirement.

The review's separate evidence-command correction uses the actual
packages/law-practice/use-cases path. Both package law commands have been rerun.

## Verification

Twenty-five tests across parent-budget, owned-input and cleaner-pipeline files
pass in 2.76 seconds. Four connected raw-entry/input-Document tests on Bun and
Node pass in 34.00 seconds. Server quick lint/type checks and declaration emission
pass. Both packages' blocking laws pass; unrelated terse-effect findings remain
advisory. The scoped Fallow audit passes with zero introduced findings and nine
inherited nonblocking clone groups. No thresholds, baselines or suppressions
change. New-head hosted qualification remains pending.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run --cwd packages/law-practice/server beep:build
bun run beep lint laws --package packages/law-practice/server
bun run beep lint laws --package packages/law-practice/use-cases
cd packages/law-practice/server
bunx --bun vitest run test/CitationCleanerParentBudget.test.ts \
  test/CitationCleanerOwnedInput.test.ts test/CitationCleanerPipeline.test.ts
bunx --bun vitest run test/CitationExtractionEntry.test.ts \
  test/CitationInputDocument.test.ts
```

This fixes resource accounting without changing source-derived citation
expectations or promoting parity rows. Full engine integration and every
outstanding exhaustive acceptance obligation remain open.
