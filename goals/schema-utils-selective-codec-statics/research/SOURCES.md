# Selective Schema Codec Statics — Sources and Provenance

## Origin

- Direct operator design discussion and `/grilling` session, 2026-08-30.
- Initial design review:
  `scratchpad/schema-utils-codec-statics-design.md`.

The packet is self-contained. The scratchpad remains background evidence, not
the normative contract.

## In-Repo Sources

| Source | Relevance | Disposition |
| --- | --- | --- |
| `packages/foundation/modeling/schema/src/SchemaUtils/withCodecStatics.ts` | Current small bare helper | Replace with explicit typed selection |
| `packages/foundation/modeling/schema/src/SchemaUtils/codecStatics.ts` | Current Sync, Promise, Effect, Exit, Option, and Result bundles | Inventory, migrate, then delete |
| `packages/foundation/modeling/schema/src/SchemaUtils/withStatics.ts` | Current property-attachment and collision behavior | Reuse only if it satisfies the grilled safety contract |
| `packages/tooling/policy-pack/lint-rules/src/rules/no-inline-schema-compile.ts` | Inline compiler detection and diagnostic | Promote to error after cleanup |
| `packages/foundation/modeling/rdf/src/ProvRdf.ts` | Known inline `S.decodeResult` finding | Hoist or replace through the approved API |
| `.repos/effect` | Machine-local Effect reference checkout required by repo law | Validate public API and v4 behavior here |
| Installed `effect` package | Exact dependency behavior exercised by tests | Runtime/type evidence for the pinned version |

## Verified Design Facts

- Direct schema runners such as `S.decodeEffect(schema)` are created when the
  factory is called. Storing the result on a selected static at module-level
  schema declaration has the same per-business-call hoisting benefit as a
  sibling module-level `const`.
- The current direct statics are bound once, while current JSON convenience
  variants construct a transformed schema and runner inside each invocation.
- `S.fromJsonString` changes the encoded boundary to a JSON string. Applying it
  implicitly to an already transformed schema can create a second JSON layer.
- A key-only `classStatics(keys)` call cannot discover its declaring class from
  JavaScript evaluation semantics. Safe binding needs the class value or a
  different explicit owner mechanism.
- Existing attachment mutates the supplied schema object, so singleton-schema
  ownership and collision policy are part of the remaining design tree.

## Migration Census

The 2026-08-30 syntax-AST census excludes comments, imports, declarations, and
documentation examples:

| Helper | Production attachments |
| --- | ---: |
| `withCodecStatics` | 658 |
| `withEffectCodecStatics` | 20 |
| `withResultCodecStatics` | 5 |
| `withOptionCodecStatics` | 5 |
| `withExitCodecStatics` | 3 |
| `withSyncCodecStatics` | 1 |
| `withPromiseCodecStatics` | 1 |

There are 660 code attachments of `withCodecStatics` across 171 files when two
test attachments are included. The total divides into 291 generated outputs,
367 authored production attachments, and two test attachments.

Generated concentration:

| Generated file | Attachments |
| --- | ---: |
| `packages/drivers/acp/src/_generated/schema.gen.ts` | 171 |
| `packages/drivers/box/src/_generated/Box.models.gen.ts` | 108 |
| `packages/drivers/runpod/src/_generated/Runpod.models.gen.ts` | 10 |
| `packages/drivers/runpod/src/_generated/Runpod.operations.gen.ts` | 2 |

The implementation phase must identify and change the owning generators before
regenerating these 291 declarations.

### JSON census

- 229 `*FromJsonString` code accesses across 131 files.
- 80 production accesses across 68 files; 71 of those are on `Unknown`.
- The remaining nine production accesses cover AI-metrics archive/retention
  models, `PromptExampleEnvelope`, and semantica's `GoldFileEncoded`.
- `GoldRefJson` in
  `apps/labs/semantica/src/layers/CanaryC0Live.ts` already demonstrates the
  preferred named-boundary form.
- `Unknown` requires a named JSON boundary rather than a mechanical rename that
  could create `S.fromJsonString(S.fromJsonString(...))`.

### Broad-helper minimal-use samples

Direct observed reads include:

- `JsonRecord`: `decodeUnknownEffect`;
- `TSConfigSemantic`: `decodeUnknownResult`, `decodeUnknownExit`, and
  `decodeUnknownEffect`;
- `AiMetricsAbsoluteDataRoot`: `decodeEffect`;
- `CitingApplicationIdentity`: `equivalence` and `encodeEffect`;
- `CodeFenceLanguage`: `decodeOption` and `decodeUnknownOption`;
- `UnitInterval`: `is`;
- `JsoncTextToUnknown`: `decodeUnknownExit`;
- `GoldFileEncoded`: `decodeEffectFromJsonString`, which should move to an
  explicit named JSON boundary and ordinary `decodeEffect`.

No direct reads were found for several attached production schemas. That is not
evidence that their public surface is unused: exported and indirect consumers
must be checked with a typechecker-backed inventory before selecting an empty
tuple or removing attachment.

### Collision and ownership cases

- `URLStr` intentionally replaces the broad group's `is` with `isURLStr`.
- `EntityId.factory` stacks canonical and Effect bundles, publishes an explicit
  `EntityIdCodecStatics` contract, and replaces `equivalence` with a custom
  two-argument helper. Its contract and factory form one atomic migration.
- `Unknown = S.Unknown.pipe(...)` currently mutates Effect's shared singleton.
  The owned-schema policy must be locked before migrating it.

### Class census

There are 310 manually compiled static properties across 257 classes and 105
files. The schema-class heuristic identifies 306 properties across 253 classes:
209 are simple self-bound candidates, while 97 target derived/other schemas and
cannot be migrated mechanically. This evidence supports keeping wholesale
class migration outside this goal unless the operator explicitly expands it.

## External Sources

None required. The implementation must be validated against the repo's pinned
Effect reference checkout and installed package rather than general web or
training-data recollection.

## Closing Evidence

- `research/closing-attachment-inventory.json` records 213 explicit selective
  attachments across 3,968 scanned source files, with zero unresolved owners,
  empty tuples, JSON-boundary aliases, broad helpers, or risky augmented roots.
- `research/closing-census.json` records zero broad-helper and JSON-suffixed
  static matches, no finding on a touched line, and removal of the named
  `ProvRdf.ts` compiler. The inline-warning count shrank from 2,935 to 2,931.
- `goals/inline-schema-compile-hard-error` is the required successor packet for
  the remaining 2,931 warnings and later hard-error promotion.
- The runtime/type suite at
  `packages/foundation/modeling/schema/test/codecStatics.test.ts` passes eight
  focused tests covering both invocation forms, exact types, descriptor
  ownership, rebuilds, schema-derived properties, collision rejection, JSON
  option ownership, native runner identity, and `S.Class` / `S.TaggedClass`
  bags.
