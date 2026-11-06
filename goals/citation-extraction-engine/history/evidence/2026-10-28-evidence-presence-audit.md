# Evidence field-presence audit — 2026-10-28

Scope: P0 decoder/validator rejection behavior. This closes the suspected
constructor-default issue; it does not close target parity, terminal
accounting or the other remaining P0 gates.

## Finding and correction

The earlier safety-contract checkpoint raised a concern that `S.tag` might
insert omitted evidence during decoding. That concern was incorrect for the
installed Effect 4.0.6 API. The owning `effect/Schema` implementation defines
`tag` as a Literal plus `withConstructorDefault`. It supplies a value to
`.make`, while decoding still requires the field. `tagDefaultOmit` is the
separate operation that explicitly fills a tag during decoding.

A direct dependency probe confirms that both `Struct({ x: tag("observed") })`
and its Literal counterpart reject decoding `{}`. The citation evidence
modules use no `withDecodingDefault` or `tagDefaultOmit`. Their existing tagged
schemas are preserved; replacing them would create unnecessary code churn.

## End-to-end missing-field controls

`ops/verify-evidence-presence.py` runs the actual portable validators against
isolated temporary copies. Each component's unmodified baseline must pass
before its controls run. The committed inputs, upstream sources, dependency
locks and payload artifacts remain unchanged.

| Validator | Missing-field controls |
| --- | ---: |
| Discovery | 10 |
| Public operations | 13 |
| Assertion operands/context | 14 |
| Source/case/regex ledgers | 36 |
| TypeScript donors | 25 |
| Vocabulary mapping | 15 |
| Safety policy/isolation proof | 10 |
| Total | 123 |

The controls remove explicit pins, versions, license IDs/hashes, scopes,
zero-failure attestations, source-family tags, projection declarations, empty-
branch attestations and cleanup observations. Operation/assertion controls also
remove observed success and relation/outcome discriminators inside the encoded
payload. Those payloads receive freshly computed SHA-256 values before the
validator runs, so rejection cannot be attributed to a stale payload hash.

All seven baselines pass, and all 123 altered inputs fail through their
respective validator with exit code 1 and its expected bounded failure message.
No missing fixed observation was accepted. `check-discovery.ts` now accepts an
optional fixture path, matching the other validators and enabling this lane
without touching the committed discovery artifact.

This is coverage of the listed fixed-field families, not a claim that deleting
every possible key in every row was tested. Legitimate optional fields remain
optional. Whole case/source-row coverage, artifact references, dispositions,
proof and target-test requirements still use their separate accounting gates.

## Regression tests and commands

Two focused regressions extend `CitationOracleAssertions.test.ts`:

- removing any of eleven fixed metadata fields fails both decode and encode;
- omitting the observed `passed` value or relation discriminator fails decoding
  inside the byte-preserving payload codec.

The full package audit/docgen passes with these tests. Existing fixture codecs,
generators and committed corpus bytes are unchanged; no regeneration was needed.

```sh
python goals/citation-extraction-engine/ops/verify-evidence-presence.py \
  --scratch-root "$CACHE_ROOT"
bun run beep quality package-verify @beep/law-practice-use-cases
```

The retained logs record all 123 results. This lane is ready for integration
into the final parity gate alongside the other corruption controls. It does
not turn an audit-state row into terminal proof.
