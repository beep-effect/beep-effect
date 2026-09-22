# @beep/govinfo four-lens digest

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
