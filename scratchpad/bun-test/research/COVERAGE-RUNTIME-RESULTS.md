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

## Shared configuration and one-worker follow-up

The follow-up used a four-CPU quota, 4 GiB memory cap, and zero swap. Its
receipts form a separate resource configuration from the earlier 16 GiB runs.
The shared-config fixture selected V8 under Node and Istanbul under Bun without
a provider override. Worker witnesses identified Node 22.22.3 and Bun 1.4.2.
Both single-test runs produced identical statement, branch, and function
counters: the unreachable break stayed uncovered, the guard recorded `[0,3]`,
the nullish expression recorded `[1,0]`, and the untouched executable source
retained zero statement and function counters.

Both negative threshold controls passed their test, then exited 1 because
branch coverage was 50% against the deliberately impossible 100% threshold.
The BigInt title control passed under both Bun-hosted Vitest and the native
adapter, one test each. The PR-lane adapter smoke run recorded 40 passing tests,
five skipped tests, and zero failures. Its logged property-failure diagnostics
belong to passing negative tests.

A separate one-worker schema coverage pair passed all 717 tests in both arms:

| Requested runtime/provider | Elapsed | Cgroup peak memory | Cgroup CPU time | Source files |
| --- | ---: | ---: | ---: | ---: |
| Node 22.22.3 / V8 | 66.003 s | 1,222,459,392 bytes | 80.635796 s | 271 |
| Bun 1.4.2 / Istanbul | 27.564 s | 1,123,852,288 bytes | 40.378048 s | 208 |

The canonical comparator again returned zero findings for Node/V8 and 260 for
Bun/Istanbul, with no minimum-coverage or missing-package findings in either.
The provider mismatch therefore persists under the canonical worker count.

These are single diagnostic observations on a shared workstation, not accepted
performance samples. Provider compatibility remains unqualified, and these
runs cannot establish CI cost savings or performance acceptance gates. The
full schema pair records explicit launcher/provider arguments but contains no
new worker-runtime witness; the witnesses above belong to the shared-config
fixture. None of these nine follow-up runs recorded an OOM event.

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

The sanitized [follow-up receipts](coverage-followup-attempts.json) preserve the
additional executed attempts separately from the original pilot ledger. Across
both ledgers, 65 attempts consumed 305,613 ms of the 3,600,000 ms execution
budget; queue waiting is excluded. No accepted performance samples exist.

No measured reduction in total CI cost per successful PR is established.
The agreed adoption threshold remains at least 10% savings supported by the
uncertainty range, with no new correctness failures or OOMs and at most 10%
regression in completion time or peak memory.
