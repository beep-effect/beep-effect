# @beep/lejeune-bolt-workbench — four-lens P1 digest

App is a jsdom heading smoke test. Bundle/BundleBuilder use actual Bun crypto/platform resources and PGlite/DuckDB/Oxigraph projections (Projections.ts555-564). Repeated acquisition is observable in source but its isolated cost is not measured. TWO fresh stores are essential to deterministic rebuild comparison; a separate SAME-store retry deliberately verifies ProjectionError. Native staging/symlink publication and durable binary/readback assertions must not be replaced by MemoryFS. The interrupt handshake synchronizes on a committed operation, then joins interruption and expects successful publication; preserve it and all cleanup/error outcomes. Disposition-clock cases need test-local ownership if outer layer sharing changes. Recording replay is offline synthetic provider evidence, not a cloud call or a network-blocking guarantee. Eight retained observations in two older jobs include six assertion/property and two timeout observations; they do not establish eight unique flakes or present failing source.

3 files; 12 rows: 2 review items and 10 coverage-only rows.

| Lens | Rows |
| --- | ---: |
| resource | 3 |
| flake | 3 |
| property | 3 |
| observability | 3 |

Severity: 10 info, 2 major.


## Review items

- L-RES-05 / major: apps/labs/lejeune-bolt-workbench/test/Bundle.test.ts:290-449. Private provideScopedLayer builds actual PGlite/DuckDB/Oxigraph resources. Projections.ts555-564 confirms the merged constructors. In P2 expose ownership through public layer registration while preserving TWO fresh builds at290-337 and the intentional SAME-store second-build failure at432-449. Do not share one database across corruption cases or erase this distinction. Native SQL adapters are the subject; MemoryFS cannot replace them. Coordinate existing EV002; retain all scopes/errors and investigate real close hooks before deleting the wrapper.
- L-RES-05 / major: apps/labs/lejeune-bolt-workbench/test/BundleBuilder.test.ts:47-249. provideTestRuntime repeatedly supplies BunServices/Crypto. Public outer layer ownership must retain test-local temp roots, native symlink/atomic publication, acquired projection stores and cleanup on invalid recording. Keep the claimed/release Deferred handshake, joined interrupt and successful committed Exit at217-249. Fresh build isolation and TestClock disposition ownership must survive the migration; no shared global clock reset or MemoryFS substitution for native publication. This is lifecycle detail beyond EV002/EV010.

## Retained timing and history

accepted-node-command-baseline: 28 cases across 3 files. Reporter span 10621.55126953125ms; whole command 11.017379601000357s. Raw reporter SHA256 b1b0a475866b159b1f94692f5e6ba1d99bd308a6062d34f06e641bb69c498497. Node22.22.3/Bun1.4.2/Vitest4.1.11. Complete configured file representation is retained; this is neither compiler nor coverage nor full package proof. Exact source/runtime identities and worker configuration are retained in the public package timing context. Durations overlap under concurrency and cannot be summed as rebuild cost.

8 mapped historical observations across 2 jobs. Historical observations only; no current-source or flaky classification. Zero mapped observations does not establish absence of failures.

- [Historical job](https://github.com/beep-effect/beep-effect/actions/runs/33138943530/job/98745268280), 2026-08-28T03:27:32Z, head `26b5b8763adda9c78464445b4dfe71db75bf179e`.

- [Historical job](https://github.com/beep-effect/beep-effect/actions/runs/33750700199/job/100633337711), 2026-09-03T11:37:30Z, head `d3c508aecab800e924ced081cdc57f2f7ae9481b`.


P2 sequence, only after Benjamin authorization: scope/layer/native-boundary review, exact assertion-family migration, property-law/floor witnesses, evidence-driven flake review, public instrumentation. Keep every operand, polarity, invalid boundary, seed/floor, native subject and inner cleanup; no timeout increase, retry, skip or baseline exception proposed. Confidence covers cited source observations, not unexecuted runtime correctness. All rows remain open P1 judgments; P2 remains gated.

Root accepted these P1 rows after full report/digest review, source and artifact hash checks, and fresh combined strict validation. Original failed validation remains preserved. Full P1 completeness, Grok review and Benjamin acknowledgement remain required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
