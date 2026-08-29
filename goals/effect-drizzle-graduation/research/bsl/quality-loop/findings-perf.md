### performance-1: Remove per-merge evolver and closure allocation

- `label`: suggestion
- `blockingStatus`: non-blocking
- `severity`: P3-low
- `sourceRefs`: `round6-report.md` §D; `round6.5-report.md` §D; `round7-report.md` §Performance fixture rerun; nine-sample 500,000-call alternating microbenchmark
- `affectedFiles`: `scratchpad/bsl/src/core/Meta.ts:172`
- `evidence`: `Meta.merge` constructs an evolver object and 11 closures per invocation. The path is reached by 52 `Field.patch` call sites plus direct model-resolution merges. The current implementation’s median was 289.68 ms/500,000 calls (579.4 ns/call); an equivalent direct object construction was 10.41 ms (20.8 ns/call), approximately 28× faster. Both implementations produced identical records for representative partial patches. Type-level attribution measured 47,960 instantiations for `perf.consumer.ts`; aliasing `ValidateFields` intersections worsened the graph by 88, while caching `SchemaFailures` saved only 108, so neither type rewrite merits a finding. Repeated encoded-AST traversal measured only 64–71 µs per ten-field model and does not justify caching.
- `impact`: Avoidable allocation occurs once per metadata combinator and again during model resolution. It affects model-definition startup rather than repository query hot paths, so it is worthwhile but not graduation-blocking.
- `suggestedFix`: Keep the public `Merge<M, P>` type and `merge` signature unchanged, but return a direct 11-property object using the existing undefined-preserving semantics. Remove the resulting unused `effect/Option` and `effect/Struct` imports. This leaves call-site diagnostics untouched.
- `acceptanceCommands`: `./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false`; `bun test scratchpad/bsl/`; rerun the alternating nine-sample 500,000-call merge benchmark and verify record equivalence
- `status`: open

Summary: 1 total finding, 0 blocking; 0 required findings.
