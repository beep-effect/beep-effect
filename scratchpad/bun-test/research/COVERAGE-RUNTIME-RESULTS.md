# Coverage runtime follow-up

Date: 2026-09-15. This extends the native-runner pilot; it is not a
production coverage migration or a CI cost estimate.

## Decision

Explicit Bun-hosted Vitest coverage uses Istanbul source instrumentation.
Node-hosted Vitest retains V8. Production coverage launch commands and the
committed regression baseline remain unchanged because the candidate does not
yet satisfy the existing per-file gate. The scratch adapter remains experimental.

Bun/V8 is rejected: successful report generation concealed false-positive
coverage for unexecuted code. See [provider adjudication](coverage-provider-adjudication.md)
for the four-cell control, exact counters, and upstream support boundary.

## Full schema qualification

Both Node/Istanbul and Bun/Istanbul completed all 717 tests. These diagnostic
passes used four Vitest workers, while canonical schema coverage uses one;
the timings are not accepted confirmation samples.

| Metric | Node/Istanbul | Bun/Istanbul |
| --- | ---: | ---: |
| Executable report files | 208 | 208 |
| Lines | 3616 / 3793 | 3617 / 3793 |
| Statements | 3754 / 3965 | 3758 / 3965 |
| Functions | 1174 / 1304 | 1177 / 1304 |
| Branches | 1087 / 1199 | 1090 / 1199 |

Only `Yaml.ts` and `internal/yaml.ts` differ between these two Istanbul
reports. Their runtime-specific parser paths need explicit qualification.
The earlier Node/V8 report includes another 63 files, each with zero
executable units in every metric. Their omission still matters to the
existing ratchet, whose baseline does not preserve executable denominators.

## Existing ratchet

The repository's `coveragePackageBaselineFromSummaryForTesting` and
`compareCoverageRegressionSnapshotsForExpectedPackagesForTesting` processed
the saved summaries against the unchanged committed baseline.

- Node/V8 (`coverage-node-vitest-05`): zero regression or minimum findings.
- Bun/Istanbul (`coverage-bun-istanbul-10`): 260 regression findings and zero
  minimum findings. There are 252 vanished-file findings from the 63 omitted
  zero-unit files and eight metric findings on executable sources.

| Executable source | Metrics rejected |
| --- | --- |
| `JSONSchema/JSONSchema.schema.ts` | branches |
| `SchemaUtils/withCodecStatics.ts` | lines, statements, branches, functions |
| `SchemaUtils/withStatics.ts` | branches |
| `SecureHeaderOptions/SecureHeaderOptions.schema.ts` | branches |
| `Yaml.ts` | lines |

The per-file rule combines a percentage drop with growth in uncovered units.
A denominator-only percentage difference is not itself a failure. Vanished
previously covered paths fail independently of package totals. No baseline
rows, source includes, branch requirements, or comparison rules were weakened.

A production transition needs an explicit, reviewed treatment of provider
identity, zero-unit files, newly instrumented constructs, and runtime-specific
paths. A bulk baseline reset cannot by itself establish preserved guarantees.

## Other runtime opportunities

[The runtime inventory](quality-runtime-inventory.md) records the current
launchers. Doctests and the identity package's ordinary tests remain concrete
Node-to-Bun candidates. Most ordinary, property, and integration tests already
run on Bun. Native quality engines such as tsgo and Biome are not equivalent
JavaScript-runtime migration targets. No other lane was switched here.

## Evidence and limits

Raw requests, counters, receipts, and logs live under the ignored
`.beep/bun-test-pilot/` and `.beep/bun-test-review/` directories. They preserve
failed attempts and machine-local provenance. The bounded contract fixture is
tracked under `pilot/coverage-contract/` and intentionally allows explicit
provider overrides to reproduce the rejected combination.

No measured reduction in total CI cost per successful PR is established.
The agreed adoption threshold remains at least 10% savings supported by the
uncertainty range, with no new correctness failures or OOMs and at most 10%
regression in completion time or peak memory.
