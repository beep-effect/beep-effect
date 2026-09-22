# @beep/nlp-mcp — four-lens P1 digest

Pure schema/equivalence files do not acquire resources. Shared Wink/MCP layers test local handler dispatch and named-key tracing; they do not start external MCP transport. Streaming tests use native FS/Path and a temporary-root allowlist with recursive cleanup.orDie. PathSafety follows realPath: processing-only MemoryFS candidates require separate retained native containment coverage. An outer Fetch client is present, but local-file handlers do not prove network behavior. The IPv4-mapped private-host test only checks generic failure; a removed guard plus failed HTTP request can still satisfy it. Add a zero-executions client witness and public refusal reason/location before HTTP. Sampling uses Random.shuffle distinct indices then sorts source order; count-only checks should additionally require fixture membership, distinctness and order, without fixing one random subset. No hosted observations mapped to this package is an evidence limit, not proof of no failures.

6 files; 25 rows: 3 review items and 22 coverage-only rows.

| Lens | Rows |
| --- | ---: |
| resource | 6 |
| flake | 6 |
| property | 7 |
| observability | 6 |

Severity: 22 info, 2 minor, 1 major.


## Review items

- L-RES-05 / minor: packages/drivers/nlp-mcp/test/integration/Streaming.test.ts:20-44. The native outer FS/Path/HTTP layer is already shared, but withTempFixture owns a shorter acquireUseRelease lifetime with allowed-root context and recursive remove.orDie. Flatten only after these exact boundaries are retained in test scope. PathSafety.service.ts104-180 uses realPath, so retain native guard coverage while considering MemoryFS for pure processing fixtures. Do not drop cleanup failure propagation, pretend HTTP is exercised by local files, or automatically delete every EV003 wrapper.
- L-PROP-04 / major: packages/drivers/nlp-mcp/test/integration/Streaming.test.ts:178-193. Both IPv4-mapped URLs assert only isFailure=true with the real Fetch client. Removing the guard can still pass on a network failure. DatasetLoader.ts467-503 has a specific refusal before HttpClient.get. Preserve both URLs and existing assertions, add an injected recording HTTP client proving zero request execution and the public encoded refusal reason/location. This tests the actual SSRF guard without issuing requests; no production vulnerability is claimed.
- L-PROP-04 / minor: packages/drivers/nlp-mcp/test/integration/Streaming.test.ts:211-223. The sample-lines case checks only count/length; three fabricated or duplicate strings pass. TextStream.ts521-537 samples distinct indices then sorts original order. Preserve count3/length3 and add membership in l1-l5, unique length3 and ascending source order. Keep Effect Random, no exact random subset or distribution/timing assertion. This is a missing result witness, not an observed probabilistic flake.

## Retained timing and history

accepted-node-command-baseline: 37 cases across 6 files. Reporter span 4232.700439453125ms; whole command 4.571536837000167s. Raw reporter SHA256 b9b9d2356e7c0f3b53f7a77fc409226a43a128376cfc725a7f034a265b8efc24. Node22.22.3/Bun1.4.2/Vitest4.1.11. Complete configured file representation is retained; this is neither compiler nor coverage nor full package proof. Exact source/runtime identities and worker configuration are retained in the public package timing context. Durations overlap under concurrency and cannot be summed as rebuild cost.

0 mapped historical observations across 0 jobs. Historical observations only; no current-source or flaky classification. Zero mapped observations does not establish absence of failures.


P2 sequence, only after Benjamin authorization: scope/layer/native-boundary review, exact assertion-family migration, property-law/floor witnesses, evidence-driven flake review, public instrumentation. Keep every operand, polarity, invalid boundary, seed/floor, native subject and inner cleanup; no timeout increase, retry, skip or baseline exception proposed. Confidence covers cited source observations, not unexecuted runtime correctness. All rows remain open P1 judgments; P2 remains gated.

Root accepted these P1 rows after full report/digest review, source and artifact hash checks, and fresh combined strict validation. Original failed validation remains preserved. Full P1 completeness, Grok review and Benjamin acknowledgement remain required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
