# Instance

- id: `r3-tooling-codegen-source-test-filename`
- file:line:
  `packages/tooling/tool/cli/src/commands/Codegen/Codegen.command.ts:92`
- symbol: `discoverModules.fileNameKind`
- members: `isTypeScriptSourceFileName`, `isTypeScriptTestFileName`
- evidence: E4 at `Codegen.command.ts:187-189` — discovery first requires the
  source-name guard and then rejects the test-name guard. Every `.test.ts[x]`
  or `.spec.ts[x]` name also satisfies the broader `.ts`/`.tsx` source
  pattern, so `test` implies `source`.

# Current shape

Two schema-derived guards classify the same directory entry. The traversal
first proves that an entry is a TypeScript source file and then asks whether it
is the test subset. This represents one filename kind as ordered booleans. The
source guard is also used independently by `toImportPath`; that independent
consumer is not boolean creep and must remain available.

# Cardinality gap

Four source/test pairs are representable, but three filename states are legal:
`non-typescript`, `typescript-module`, and `typescript-test`. The test-only
pair is impossible because the test pattern is a strict subset of the source
pattern.

# Target schema

Define a private named `TypeScriptFileNameKind` LiteralKit with
`non-typescript`, `typescript-module`, and `typescript-test`. Classify the test
pattern first, then the broader source pattern, so the implication is encoded
once. Use the literal only in `discoverModules`; preserve the named branded
schemas and the independent `isTypeScriptSourceFileName` guard used by
`toImportPath`.

# Migration inventory

- `Codegen.command.ts:10-20` — add the narrow
  `@beep/schema/LiteralKit` import; repo-CLI already declares `@beep/schema`.
- `Codegen.command.ts:33-93` — retain both regexes, branded schemas, and
  schema-derived guards. Add the private finite-domain classifier beside them
  and make its test-before-source order explicit.
- `Codegen.command.ts:117-122` — leave `toImportPath` on the independent
  `TypeScriptSourceFileName` guard and schema transformation. It accepts both
  module and test-shaped TypeScript paths by contract even though discovery
  excludes tests.
- `Codegen.command.ts:160-201` — after the filesystem entry-kind check,
  replace the nested source/test boolean guards with one exhaustive filename
  kind match. Only `typescript-module` proceeds to the existing root-index
  exclusion and output path construction.
- `Codegen.command.ts:214-277`, `commands/Codegen/index.ts`, and the root CLI
  barrel keep the same generated content and public `codegenCommand` export;
  the filename kind remains private.
- `test/codegen-command.test.ts:18-38` — expand the current filesystem fixture
  to cover every filename kind and the existing directory/root-index rules.

# Guard-deletion accounting

Delete the correlated
`isTypeScriptSourceFileName(entry)` outer condition and nested
`isTypeScriptTestFileName(entry)` early return from `discoverModules`. One
classifier and exhaustive literal match replace the impossible test-only pair.
Retain the independent source guard in `toImportPath`; deleting it would mix a
separate conversion precondition into discovery state.

# Encoded-side impact

None. The literal is private traversal state. Command flags, filesystem reads,
barrel header, export statement bytes, sort order, `.tsx` to `.ts` import
normalization, and public exports remain unchanged.

# Test impact

Add `.ts`, `.tsx`, `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`, `.js`,
extensionless, root `index.ts`, nested `index.ts`, and `internal/` directory
fixtures. Assert the exact generated barrel rather than only containment, so
excluded tests/non-TypeScript entries, recursive prefixes, ordering, and the
uniform `.ts` specifier are all locked. Run the focused Codegen test and full
`@beep/repo-cli` package verification with the required patch changeset.

# Risk and sequencing

Land in Tier 1E. The classifier must check the narrower test schema first;
reversing that order would classify every test as an exportable module. Do not
change the independent `toImportPath` behavior as part of this migration.
