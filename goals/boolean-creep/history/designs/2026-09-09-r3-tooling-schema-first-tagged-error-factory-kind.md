# Instance

- id: `r3-tooling-schema-first-tagged-error-factory-kind`
- file:line: `packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstDetectors.ts:1071`
- symbol: `taggedErrorDeclarationCall.factoryKind`
- members: `isNamespacedTaggedErrorFactory`,
  `isNamedImportTaggedErrorFactory`
- evidence: E2 at `SchemaFirstDetectors.ts:1090-1094` — the detector ORs two
  factory recognizers and has no combined-true arm. One AST node cannot be both
  a property-access expression and an identifier.

# Current shape

After recognizing the nested TaggedError class-extension call, two private
predicates classify its factory expression as `S/Schema.TaggedError`, an
unaliased named `TaggedError` import, or neither. Their OR is one optional
factory spelling flattened into two booleans.

# Cardinality gap

Four boolean pairs are representable and three outcomes are legal: no supported
factory, namespaced factory, or named-import factory. Combined true is excluded
by the ts-morph node-kind split.

# Target schema

Define a private named `TaggedErrorFactorySpelling` LiteralKit with
`namespaced` and `named-import`, imported through
`@beep/schema/LiteralKit`. Replace both predicates with one classifier returning
`Option<TaggedErrorFactorySpelling>`. Keep `None` as the unsupported-factory
case, reuse the existing `sourceImportsNamedTaggedError` import check, and do
not export the classifier or duplicate the public schema-first entry-kind
taxonomy.

# Migration inventory

- `SchemaFirstDetectors.ts:7-13` — add the narrow LiteralKit import; the private
  spelling owner needs no new identity composer or barrel surface.
- `SchemaFirstDetectors.ts:1052-1069` — retain
  `sourceImportsNamedTaggedError` and `sourceHasTaggedErrorSignal`; they also
  protect named-import detection and the scan fast path.
- `SchemaFirstDetectors.ts:1071-1095` — replace both boolean factory helpers
  with the Option classifier and map a recognized spelling to the existing
  `outerCall`. Preserve nested-call validation before classification.
- `SchemaFirstDetectors.ts:1128-1165` — the tagged-error equivalence detector
  continues consuming the same optional call and emitting the same
  `SchemaFirstInventoryEntry` data.
- `SchemaFirst.ts:16,238-360` and `Lint/index.ts:42-113` expose higher-level
  detectors and schemas only; no public export or consumer changes.
- `test/lint-command.test.ts:844-931,934-1035` — retain namespaced,
  named-import, local-factory, annotation, and exception coverage and add the
  remaining spelling near-misses.

# Guard-deletion accounting

Delete `isNamespacedTaggedErrorFactory`,
`isNamedImportTaggedErrorFactory`, their impossible combined-true pair, and the
OR guard in `taggedErrorDeclarationCall`. One Option-of-literal classifier
becomes the sole supported-factory boundary.

# Encoded-side impact

None. The option/literal is private derived AST state. Schema-first inventory
records, rule ids, advisory counts, line/symbol attribution, console/structured
messages, write-mode behavior, and persisted inventory bytes remain unchanged.

# Test impact

Exercise `S.TaggedError`, `Schema.TaggedError`, the exact unaliased named import,
an aliased named import, a local `TaggedError`, another namespace's
`TaggedError`, unrelated identifiers/property access, and malformed one-level
or non-call `extends` expressions. Assert the exact existing advisory and no
false positive for every None case; retain annotation and exception behavior.
Run focused schema-first lint tests and full `@beep/repo-cli` package
verification with the required patch changeset.

# Risk and sequencing

Land in Tier 1E. Preserve the current import provenance rule: a bare identifier
is supported only when it is an unaliased named import from `effect/Schema`.
Do not broaden aliases, namespaces, or AST shapes during this refactor.
