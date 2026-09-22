# @beep/epistemic-config — four-lens audit

1 files; 4 rows; 1 review items; 3 coverage-only rows. Severity: 3 info, 1 major. All rows are open P1 judgments; P2 remains gated.

## Topology and evidence

The four effectful configuration cases resolve the actual EpistemicConfigLive with explicit ConfigProvider.fromUnknown values. This is configuration parsing, not an external service allocation or a secret lookup. Separate configurations are essential for default, explicit allowlist, empty allowlist and malformed-input behavior; blindly sharing one configured layer would erase those inputs. The layer reads two config values and constructs a schema value, so no expensive resource rebuilding is established. MemoryFileSystem has no role.

The remaining six cases classify synthetic destinations and verify fixed grant fixtures. They do not dispatch egress or resolve credentials. Grant reconstruction retains its fixed epoch, explicit principal/sink and byte-stable digest contract. Typed config failures distinguish Cause failures from defects. The malformed URL case misses a concrete fallback collision: bare localhost is a nonempty SinkDestination, URL parsing fails without a base, and the fallback string equals an allowed loopback host. Production comments and the test intend unparseable input to classify external. This is a source-derived mismatch and coverage gap, not a demonstrated egress exploit; no request was sent. Preserve the existing valid URL controls and strengthen the malformed boundary only in authorized P2.

## Findings

- **L-PROP-01 malformed-loopback-boundary-gap**, `packages/epistemic/config/test/Config.test.ts:112-114`: The malformed-input test checks only not a url; bare localhost is a valid SinkDestination and matches the fallback loopback list. Preserve all existing local/external classifications and the malformed-input assertion. Add bare localhost and trimmed/case variants as unparseable-destination negative controls. Audience.ts25-30 returns trimmed input after URL parsing fails, and lines58-61 classify that value as local; ExecutionGrant.model.ts130-136 accepts any nonempty string. This contradicts the stated fail-closed contract. Repair only after P2 authorization; do not weaken SinkDestination or turn the expected external result into local. Source-derived mismatch only: no network operation or runtime probe was executed.

## Retained timing/history

Node22.22.3, Bun1.4.2, Vitest4.1.11 at frozen head 662823dd960367046ba7d73dd8fd25d15782865a: 10 passed registrations; reporter 4011.235596ms; whole command 4.421912s. Full executable-file representation is retained, not compiler, coverage or package acceptance. No timing rerun or adjustment occurred.

0 mapped historical observations across 0 jobs. Zero mapped observations does not mean no historical failures. Historical evidence is retained in the [hosted history summary](../hosted-history-summary.json). No historical/current source comparison or causal classification was performed.

## Top files

- `packages/epistemic/config/test/Config.test.ts`: 4 rows, 1 review items.

## P2 ordering and uncertainty

Only after explicit authorization: Preserve each independent configuration input and fixed grant fixture. Add malformed loopback collision controls and repair only the supported fail-closed mismatch while retaining valid URL classifications and schema strictness. Preserve every existing assertion, operand and replay seed. No timeout increase, retry or provider acquisition is justified by this audit.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
