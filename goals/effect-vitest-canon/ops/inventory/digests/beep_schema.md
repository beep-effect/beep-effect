# @beep/schema — P1 inventory digest

All 82 census files were reviewed in full through all four lenses: 78 tests and
four support files, including two generated declarations. Five disjoint source
chunks were reviewed and hash-verified before assembly. The 332 human rows
contain 57 proposed findings and 275 coverage-only rows; all remain open.
The package's 454 detector candidates remain separate and unchanged.

## Lens and severity totals

| Lens | Rows | Proposed findings | Coverage | Major | Minor | Info |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| resource | 82 | 4 | 78 | 2 | 2 | 78 |
| flake | 82 | 1 | 81 | 0 | 1 | 81 |
| property | 82 | 6 | 76 | 6 | 0 | 76 |
| observability | 86 | 46 | 40 | 37 | 9 | 40 |

Total: 45 major, 12 minor and 275 info rows; no blocker was recorded.
Severity is an audit judgment, not a reproduced failure count.

## Top ten files by total row count

- `packages/foundation/modeling/schema/test/Conformance.test.ts`: 5 rows, 2 proposed findings.
- `packages/foundation/modeling/schema/test/FileTypeChecker.test.ts`: 5 rows, 2 proposed findings.
- `packages/foundation/modeling/schema/test/HttpHeaders.test.ts`: 5 rows, 2 proposed findings.
- `packages/foundation/modeling/schema/test/ProtobufScalars.test.ts`: 5 rows, 3 proposed findings.
- Generated declaration `Markdown.test-kit.d.ts` (captured build output): 4 rows, 0 proposed findings.
- Generated declaration `Yaml.test-kit.d.ts` (captured build output): 4 rows, 0 proposed findings.
- `packages/foundation/modeling/schema/src/internal/test/Markdown.test-kit.ts`: 4 rows, 0 proposed findings.
- `packages/foundation/modeling/schema/src/internal/test/Yaml.test-kit.ts`: 4 rows, 0 proposed findings.
- `packages/foundation/modeling/schema/test/Address.test.ts`: 4 rows, 0 proposed findings.
- `packages/foundation/modeling/schema/test/ArrayBuffer.test.ts`: 4 rows, 1 proposed findings.

Ties are alphabetical; row count is not a risk score. Full file-specific
evidence and replacement sketches are retained in the four lens JSONL files.

## Resource ownership and native subjects

Most tests operate on schema values, strings, local arrays and buffers. Cuid's
helper builds its state layer inside a scope; that state depends on real crypto,
a captured clock and mutable generation state. Preserve crypto conformance
separately when deciding whether state may be shared. Sha256's helper scopes
real BunCrypto on four test paths. Neither wrapper establishes a resource leak
or measured startup penalty by itself.

The resource findings concern ambient DOM fallback constructors, Markdown
renderer replacement, the Protobuf global BigInt spy, and an empty parser layer
hidden behind type erasure. Renderer mutation needs both restoration and
exclusive ownership among concurrent consumers. BigInt restoration currently
occurs only after successful assertions. DOM fallbacks need their original
descriptors or absence restored at the correct lifecycle boundary. Layer.empty
behind a cast is not a timed resource acquisition.

The Float16 unsupported-runtime fixture already restores its descriptor and
module cache through ensuring; no overlapping same-file consumer was shown.
No additional resource finding was added there. Markdown/YAML support source
and declarations remain in the census; declarations are not executed tests.

## MemoryFileSystem candidates

No demonstrated filesystem resource in this package calls for substitution.
Actual parser selection, platform crypto, buffer transfer, ambient constructor
checks and Bun.Glob parser compatibility retain their native subjects. FilePath,
FileInfo, URL, port and database examples are data, not filesystem or network
operations. Node's Glob shim does not independently prove native Bun parity.

## Proposed findings and retained contracts

The JSONSchema oracle rejects the literal extensions key even though an existing
fixture and production codec preserve it as a legal unknown wire key. Review
that counterexample without banning production keys or dropping losslessness.
Additional oracle gaps concern encoded payloads in SchemaUtils, supplied causes
and messages in StatusCauseError, complete typed-array values and lengths, and
a declaration-parameter traversal fixture that currently creates no parameters.
Keep every original assertion and add the actual known expectations.

Csp's bare native run count bypasses the established floor/seed helper. Other
manual properties need the pinned adapter's failure normalization and replay
formatting while preserving every law, native arbitrary option and run floor.
Boolean false already fails the native property engine. Effect-returning
properties and nested codec execution must remain executed Effects; they cannot
be moved into a synchronous callback that leaves an Effect unexecuted.

LocalDate compares separately sampled live instants and can cross UTC midnight.
Preserve live-clock conformance alongside deterministic TestClock cases. The
remaining diagnostic findings retain invalid input, schema, descriptor or sample
identity and precise typed failure versus defect evidence. These are static
risks and gaps, not newly reproduced failures.

Lossy codecs remain lossy; forbidden reverse encodings remain forbidden. Opaque
Defect equivalence intentionally ignores causes, unlike constructor tests that
must verify their supplied cause. CSV NUL normalization, canonical DateTime
encoding, native Promise identity, shared-default semantics and unsupported
Semver grammar remain unchanged. Mechanical candidates are navigation; no
candidate is closed or granted an exception by this inventory.

## Baseline timing and hosted history

The retained first Node/Vitest attempt passed 717 registered tests across all
78 source test files. The command took 6.317243595 seconds; the reporter interval
was 5,965.516357 ms. These have different boundaries, and per-file durations
cannot be summed as wall time. The four support files remain source-audited.
No repeat or fastest-run selection was made for this audit.

Runtime was Node 22.22.3, Bun 1.4.2 and Vitest 4.1.11 with Effect/adapter rc.113.
Vitest 4.1.11 remains outside the adapter’s declared Vitest 5 peer range;
the exercised cohort does not establish declared peer support.
The retained settings use forks, per-file isolation, concurrent tests and
maxConcurrency 5; worker capacity is not observed simultaneous utilization.
Three context samples record maximum CPU PSI avg10 of 5.25, minimum available
memory of 75.760 GiB and maximum load1 of 21.593. Timings are unadjusted for
workstation load. See the package baseline and context receipts; a passing
baseline is not coverage, compiler or full package proof.

The frozen 30-day history has 100 schema observations across nine jobs: 99
coverage records and one Toml assertion failure. On August 23, that job expected
one parser diagnostic while receiving another. Current Toml accepts two known
diagnostics and passed its three baseline tests. No historical source comparison
proves when or why the earlier incident was repaired. The
[dated hosted job](https://github.com/beep-effect/beep-effect/actions/runs/32658775563/job/97241626102)
is retained as history, not evidence of current flakiness. Global history gaps
include unavailable logs and metadata-only jobs; production coverage paths are
not automatically attributed to tests. The public hosted summary preserves
those limitations.

## Recommended P2 order

Scope → assertions → property → flake → observability. Establish exclusive,
failure-safe global ownership while retaining native subjects. Preserve full
assertion operands, polarity and typed failure context. Correct source-backed
oracle gaps while migrating property execution with unchanged floors and laws.
Review the live-date boundary without retries or shared clock resets, then
retain named failure, shrink, replay and input diagnostics. All proposed changes
remain gated on the completed P1 review and Benjamin's acknowledgement.

Exact historical coverage paths and generated-output names are preserved in the
[reference evidence receipt](../../../history/2026-09-21-p1-reference-evidence/README.md).
They identify captured observations, not current tracked source files.
