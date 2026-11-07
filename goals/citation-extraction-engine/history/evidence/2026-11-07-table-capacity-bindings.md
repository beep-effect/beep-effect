# Attribute table capacities to their installed engine budgets

The existing private dictionary/set limits now accept optional closed entry and
iteration budget names. They reuse CitationSafetyBudget and do not add public
policy fields, counters or a second work ledger. An unbound private table still
refuses without inventing an engine category.

Resolution runtime dictionaries and candidate sets bind entries to authorities
and work to resolutionIterations. The cleaner registry binds the same ceilings
and preserves the actual table failure category instead of relabeling every
refusal as authorities. Extractor ordering binds entries to patterns and work to
patternEvaluations. Frozen edition deduplication binds work to patternEvaluations;
its immutable binding population remains a structural set-size bound, not an
invented engine policy field.

Dictionary construction captures numeric ceilings and optional labels. Set
construction owns a copy of the trusted scalar configuration; copied sets retain
that configuration while owning independent roots/work. Caller edits cannot
change installed labels. Error construction uses Effect Record/Option helpers
and existing schema-owned failures. The separate hard safe-integer entry-identity
guard remains unbound rather than falsely reporting a configured entry ceiling.
No source algorithm, hash/equality order, insertion identity or growth rule is
replaced or normalized.

## Verification

Fifty-one tests across direct capacities, original dictionary/set histories,
cleaner registry, callback sessions and original default resolution pass in
4.74 seconds. Seven final capacity/extractor/edition tests pass in 2.86 seconds
after strengthening label-capture assertions. They verify:

- Dictionary and set entry exhaustion report their installed authority limit.
- Probe exhaustion reports iterations and preserves prior contents.
- Editing caller entry/work labels after construction has no effect.
- A copied set retains the original entry binding.
- Unbound dictionary failures keep the limit field absent.
- Existing exact source table/set ordering, retained callback mutation, registry
  behavior and default resolution/receipt assertions remain passing.

The initial probe test used an invalid zero iteration budget. It was corrected
to the existing positive minimum and verifies exhaustion after allowed work;
no policy minimum or source result changed. The final package lint/types,
declaration emission and blocking laws pass. Scoped Fallow reports zero
introduced findings and nine inherited clone groups under unchanged policy.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run --cwd packages/law-practice/server beep:build
bun run beep lint laws --package packages/law-practice/server
bunx fallow audit --config .fallowrc.jsonc --format json --quiet \
  --base origin/main --gate new-only
cd packages/law-practice/server
bunx --bun vitest run test/CitationTableCapacity.test.ts \
  test/CitationRuntimeDictionary.test.ts test/CitationRuntimeSet.test.ts \
  test/CitationCleanerRegistry.test.ts test/CitationCallbackSession.test.ts \
  test/CitationDefaultCallbacks.test.ts
bunx --bun vitest run test/CitationTableCapacity.test.ts \
  test/CitationExtractorOrdering.test.ts test/CitationTokenEditions.test.ts
```

Complete extraction/cleaning/resolution failure surfaces, public Engine/Layer,
full host protocols, whole-engine safety/scaling and identity-bound proof,
lawful transforms and exhaustive source/donor reconciliation remain required.
All eleven laws, four fidelity questions and fifteen unfinished proof rows stay
open without semantic waiver or accounting promotion. Hosted new-head proof is
separate from these local regressions.
