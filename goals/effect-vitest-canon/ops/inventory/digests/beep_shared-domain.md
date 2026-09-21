# @beep/shared-domain four-lens digest

Most files test pure schemas, namespace metadata and codec laws. toPgTable/getTableConfig only inspect metadata: no database is acquired. OnePasswordReference tests op:// syntax only and no credentials were inspected. EntityKernel is the resource exception: CuidState.Default acquires clock/crypto and allocates a mutable counter (Cuid.ts155-186); the local scoped provider is effectful even though its Crypto layer is a legal deterministic pure stub. L-RES-01 resolves that provenance for later explicit ownership while retaining per-case isolation. No real crypto quality is proved by the identity-digest stub. LocalDate uses a fresh test clock for fixed setTime/one-day advance; plain today only checks type, not a fragile date equality. StaticProbes is fully read support, using argument-local reflection and preserving invocation failures. Namespace matrices retain labels and fcRuns10; other generated laws retain25/50. Decode-to-self helper laws are distinguished from explicit serialization round-trips. TaggedError uses local per-call Proxy counters to provoke an invariant, not a service mock.

| Lens | Rows |
| --- | ---: |
| resource | 9 |
| flake | 9 |
| property | 9 |
| observability | 9 |

Severity: 1 minor, 35 info. 1 review items and 35 coverage-only rows.

Retained Node baseline: 62 cases, reporter span 4984.93359375 ms, whole command 5.316525707999972 seconds. This is configured Node execution evidence only, not coverage, race absence or package proof. Hosted mapped observations: 25; mapped observations do not establish distinct test failures or flakes.

## Top files by retained reporter duration (at most ten)

- packages/shared/domain/test/SchemaParity.test.ts: 38.504150390625 ms, 6 tests.
- packages/shared/domain/test/EntityKernel.test.ts: 22.001953125 ms, 16 tests.
- packages/shared/domain/test/IdentityNamespaces.test.ts: 21.530517578125 ms, 6 tests.
- packages/shared/domain/test/LocalDate.test.ts: 18.93017578125 ms, 21 tests.
- packages/shared/domain/test/Organization.test.ts: 11.93359375 ms, 7 tests.
- packages/shared/domain/test/UserMembership.test.ts: 7.602294921875 ms, 2 tests.
- packages/shared/domain/test/OnePasswordReference.test.ts: 4.401123046875 ms, 3 tests.
- packages/shared/domain/test/TaggedError.equivalence.test.ts: 1.39306640625 ms, 1 tests.

Support declarations/helpers remain in source coverage even without reporter registration. P2 ordering, still gated: scope, assertions, property, flake, observability. Preserve all original operands, polarities, negative fixtures, runs and actual native subjects. No failure was reproduced in this source audit.

Root-reviewed P1 inventory; P2 remains gated.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
