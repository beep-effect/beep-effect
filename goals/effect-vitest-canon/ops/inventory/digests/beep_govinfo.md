# @beep/govinfo four-lens digest

## P2 reconciliation — 2026-09-27

The five admitted government-driver suites completed scope, assertions, property,
flake and instrumented-runner phases in order. The ledger retains all 23
historical detector IDs across 44 rows: 25 fixed records, one current native
platform exception and 18 bounded no-findings reviews. Fixed records include
one historical native-import anchor relocation only; the native generation
subject remains an exception. No-findings records represent completed bounded
review coverage, not unresolved actionable findings.

Nine existing isolated layer blocks now have explicit hook budgets. GovInfo's
Option helpers preserve presence and all rate-limit fields. One native property
registration checks the original 17 schema inputs on every trial, preserving all
custom mappings, filters, equivalence oracles, the run floor and case deadline.
The cache test independently decodes a nonempty expected response, checks both
first and cached outputs, and retains its exact one-request assertion. Separate
wrong-output controls fail for each response. Native property diagnostics expose
named shrunk inputs and replay information under a controlled oracle failure.

All five suites use the public instrumented runner. Token-level comparison proves
unchanged test bodies in that phase. Trace-enabled suites and trace-off/on failure
probes pass. Temporary probes are removed before the stable final detector scan.
Three properties pass 400 runs with seed 20260708 after runner adoption, and all
18 cases pass shuffled execution. No production source, retries, sleeps, weakened
schema, discarded assertion or increased case deadline is introduced.

The current eCFR detector set is empty. GovInfo retains exactly one current
exception: its native checked-in OpenAPI and generated-module drift oracle.
Memory fixtures would replace that subject. All 44 rows decode strictly with
excess fields rejected, unique historical IDs, valid line bounds and all 20
file/lens pairs. Reconciliation preserves 7,709 unrelated raw inventory objects,
unrelated census objects and 678 unrelated ledger hashes. Cache review updates
only 20 owned dependency lists across 30 reviewed nodes and preserves existing
qualification and unrelated settings.

| Package | Passed cases | Admission Node / Bun seconds | Final Node / Bun seconds |
| --- | ---: | ---: | ---: |
| `@beep/ecfr` | 10 | 4.923253 / 2.519543 | 5.825830 / 2.317902 |
| `@beep/govinfo` | 8 | 5.224680 / 3.822628 | 5.127128 / 2.518283 |

These are configured single-run observations with load, pressure, runtime and
source hashes retained; they do not establish a causal speedup. Both final
package audits and docgen pass. Hosted checks and review closure remain pending.
The original P1 digest below remains frozen admission evidence.


Three single-case service layer blocks own responder/capture state separately. Govinfo.service.ts113-137 builds the transport, HttpApi client and capacity256 payload-keyed cache. L-PROP-04 adds a concrete return-value witness gap: a wrong constant cached result may satisfy the current one-request assertion because both results are discarded. Preserve deduplication and add expected payloads for both calls plus a distinct-query witness; do not rewrite cache policy. The generated test has a different native boundary: CodegenKit.run(check) defaults refresh=false, reads the cached spec, formats generation and compares actual checked-in output. It does not refresh the remote URL. L-RES-04 preserves real-input provenance rather than treating the BunServices candidate as blanket MemoryFS permission. Native formatter costs are not measured independently. Exact operation IDs and text prohibitions remain. Error cause equivalence controls remain; arbitrary cause filtering alone is not declared a serialization defect without a supported codec witness.

| Lens | Rows |
| --- | ---: |
| resource | 3 |
| flake | 3 |
| property | 3 |
| observability | 3 |

Severity: 11 info, 1 minor. 2 review items and 10 coverage-only rows.

Retained Node baseline: 8 cases, reporter span 5172.794189453125 ms, whole command 5.515846045999751 seconds. This is configured Node execution evidence only, not coverage, race absence or package proof. Hosted mapped observations: 4; mapped observations do not establish distinct test failures or flakes.

## Top files by retained reporter duration (at most ten)

- packages/drivers/govinfo/test/Govinfo.generated.test.ts: 154.794189453125 ms, 1 tests.
- packages/drivers/govinfo/test/Govinfo.service.test.ts: 85.8388671875 ms, 5 tests.
- packages/drivers/govinfo/test/Govinfo.equivalence.test.ts: 1.462646484375 ms, 2 tests.

Support declarations/helpers remain in source coverage even without reporter registration. P2 ordering, still gated: scope, assertions, property, flake, observability. Preserve all original operands, polarities, negative fixtures, runs and actual native subjects. No failure was reproduced in this source audit.

Root-reviewed P1 inventory; P2 remains gated.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
