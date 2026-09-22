# @beep/doc-text four-lens digest

The service test generates real PDF/DOCX bytes and exercises unpdf/mammoth parsing in memory. DocText.service.ts115-175 validates bytes/limits, copies the PDF view before parsing and maps failures. Preserve the independent caller-byte copy witness, corrupt input, over-cap precedence and empty-text outcome. No filesystem or Java/Tika service is launched by these tests. Parser-internal cleanup is not proved by this audit, and no leak is inferred from an absent test-layer finalizer. The historical comment about Error equivalence is not a new exception; preserve encoded error round trips and the separate declared-field equivalence control. Costs visible in source are document generation and parser work, not independently timed setup.

| Lens | Rows |
| --- | ---: |
| resource | 2 |
| flake | 2 |
| property | 2 |
| observability | 2 |

Severity: 8 info. 0 review items and 8 coverage-only rows.

Retained accepted configured Node baseline: 9 cases, reporter span 5255.553466796875 ms, whole command 5.616683487000046 seconds. Node22.22.3/Bun1.4.2/Vitest4.1.11; no load adjustment. Passing runs are not race absence, coverage, browser QA or full package proof.

## Top ten files by retained reporter duration

- packages/drivers/doc-text/test/DocText.service.test.ts: 153.553466796875 ms, 8 tests.
- packages/drivers/doc-text/test/DocText.equivalence.test.ts: 1.059326171875 ms, 1 tests.

Hosted history: 0 observations across 0 jobs; categories {}. Zero mappings does not prove no failures; coverage-ratchet observations are not unique flakes or test failures. Exact provenance/config/host context is retained in the public timing context and hosted history summary.

Proposed P2 order: scope, assertions, property, flake, observability. Preserve all assertions, operands, run minima, negative controls and native subjects. P2 remains gated; Root-reviewed P1 inventory; P2 remains gated.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
