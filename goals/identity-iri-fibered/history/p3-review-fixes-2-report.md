# P3 review fixes 2 report

Date: 2026-08-25  
PR: #821  
Branch: `feat/identity-iri-fibered`  
Starting HEAD: `c2fa3dfee6c9554a5ef7156cd57a5d8fadafc5b8`

## E1: separate address cardinality from value checks

Mechanism: `IdentityShaclProjection.ts` now emits two property shapes for each identifier and CURIE
address. The first has `minCount: 1` and `maxCount: 1` without `hasValue`; the second has
`minCount: 1` and the expected literal in `hasValue` without `maxCount`. This makes the bounded
validator count every quad on the address path for cardinality while checking the required value in
a separate shape. Required-fiber shapes remain one `minCount: 1` shape each, and projection order is
identifier cardinality/value, CURIE cardinality/value, then required fibers.

Tests:

- The semantic-web projection test asserts four address property shapes, two cardinality-only and two
  value-only, with six total properties for a two-fiber policy.
- The epistemic-server e2e test adds a second, different identifier literal and asserts a violation on
  the identifier path. The conforming dataset and removed-required-fiber cases remain covered.

## E2: fail invalid entry IRIs in the typed channel

Mechanism: `IdentityEntryIriError` is a new annotated `S.TaggedError` with `identity` and `iri`
fields. Both `entriesToDataset` and `projectShapes` decode the entry subject with the existing
`@beep/rdf` `NamedNode` schema before minting RDF values. They map the schema failure to
`IdentityEntryIriError`, so a schema-valid `IdentityEntry` containing `"not an iri"` fails rather than
dying through `makeNamedNode` and `Result.getOrThrow`. The public adapter call forms are unchanged.

Effect v4 API validation:

- `.repos/effect/packages/effect/src/Schema.ts:1557-1563` defines typed `S.decodeEffect` and its
  `SchemaError` failure channel.
- `.repos/effect/packages/effect/src/Schema.ts:14528-14544` defines schema-backed `S.TaggedError`.
- `.repos/effect/packages/effect/src/Effect.ts:3580-3583` confirms `Effect.mapError` changes only the
  error channel.

Tests: one schema-valid entry with `iri: "not an iri"` now fails both `entriesToDataset` and
`projectShapes` with `IdentityEntryIriError`; both assertions check the original identity and bad IRI.
Existing exact round trips and registry lookups still pass.

## E3: reject duplicate required fibers in the policy schema

Mechanism: `IdentityShapePolicy.requiredFibers` remains an ordered `S.Array(S.String)`, now checked by
a metadata-rich `S.makeFilter`. The check uses `effect/HashSet`, reports the first duplicate by name,
and preserves declaration order for deterministic projection output.

Effect v4 API validation:

- `.repos/effect/packages/effect/src/Schema.ts:5133-5136` defines `S.check` composition.
- `.repos/effect/packages/effect/src/Schema.ts:6669-6673` defines `S.makeFilter` and its filter output.

Tests: construction and decoding of `{ requiredFibers: ["label", "label"] }` both fail with a schema
issue naming `label`. A 40-run schema-derived arbitrary property asserts that generated policy arrays
have the same length as their `HashSet`, proving uniqueness.

## Verification

The default semantic-web Vitest forks pool timed out before loading tests, so the requested
`--pool=threads` fallback was used. No Vitest configuration changed.

| Command | Exit | Result |
| --- | ---: | --- |
| `cd packages/foundation/capability/semantic-web && bun run test` | 1 | Environment-only forks worker startup timeout; no tests loaded |
| `cd packages/foundation/capability/semantic-web && bun run test -- --pool=threads` | 0 | 4 files, 30 tests passed |
| `cd packages/foundation/capability/semantic-web && bun run check` | 0 | `tsgo` passed |
| `cd packages/foundation/capability/semantic-web && bun run lint` | 0 | 17 files clean |
| `cd packages/epistemic/server && bun run test -- --pool=threads` | 0 | 6 files, 32 tests passed |
| `cd packages/epistemic/server && bun run check` | 0 | source and test `tsgo` passed |
| `cd packages/epistemic/server && bun run lint` | 0 | 42 files clean |
| `bun run coverage -- --filter=@beep/semantic-web` | 0 | 100% statements, branches, functions, and lines; no ratchet rows |
| `bun run beep lint schema-first` | 0 | 89/89 tracked; zero missing, stale, candidates, or advisories |
| `bun run docgen:local` | 1 | Unrelated existing `packages/tooling/tool/docgen/src/index.ts:53` `Version` export lacks `@category`; the file is unchanged from local `origin/main` and from starting HEAD |
| `bun run docgen:local -- --package @beep/semantic-web` | 0 | 17 expanded tasks passed; 48 semantic-web examples typechecked |

Final ratchet line:

```text
[coverage-ratchet] ok: compared 1 package(s) with epsilon 0.001
```
