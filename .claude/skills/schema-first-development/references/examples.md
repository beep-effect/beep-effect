# Examples

These examples are the best starting points for matching repo style.

## 1. Protocol Payloads and Literal Domains

File:

- `packages/tooling/tool/cli/src/commands/CreatePackage/FileGenerationPlanService.ts`

Use this file when you need:

- `LiteralKit` for a public literal domain
- branded `S.Opaque` payloads with strong annotations
- schemas fed directly into CLI and file-generation boundaries

What to copy:

- `RelativePlanPath` for annotated schema filters
- `PlannedFile` for a clean branded `S.Opaque` object model
- `GenerationActionKind` for annotated literal-kit usage

Why it matters:

- it keeps the schema value reusable across runtime validation and command
  declarations
- it demonstrates that even small protocol payloads stay schema-first

## 2. Defaults and Normalization in the Schema

Files:

- `packages/foundation/ui-system/dock/src/Minima.ts`
- `packages/foundation/modeling/lexical/src/Lexical.model.ts`

Use these files when you need:

- default behavior encoded directly in the schema
- constructor defaults and decoding defaults kept next to the field definition
- defaults on branded or refined fields

What to copy:

- upstream `S.withConstructorDefault(Effect.succeed(value))` for a constant
  constructor default, and `S.withConstructorDefault(Effect.succeedNone)` for an
  `Option` field
- `S.withConstructorDefault` plus `S.withDecodingDefaultTypeKey` with the same
  value when a missing key should also default on decode (bind a constructed
  value to one const first)
- the `Minima.ts` field pattern:
  `PixelAllowance.pipe(S.withConstructorDefault(Effect.succeed<number>(0)))` —
  the explicit type parameter is part of this refined-number example;
  `PixelAllowance` is not branded

Why it matters:

- normalization and defaults live in schema combinators, not in ad-hoc runtime
  branches
- the final class schema becomes the single source of truth for field behavior

## 3. Optional Data and Typed Errors at a Boundary

File:

- `packages/tooling/tool/cli/src/commands/Docgen/Docgen.schemas.ts`

Use this file when you need:

- exact optional transport keys with `S.optionalKey`
- boundary decoding with typed errors
- report-oriented schema classes

What to copy:

- `DocgenConfigDocument` for optional config fields
- `DocgenWorkspacePackage` for boundary data decoded from package metadata
- inspect the consuming Docgen services separately for filesystem/process
  error mapping

Why it matters:

- optional transport keys retain their wire shape; use `S.OptionFromOptionalKey`
  when the owning internal model requires `Option`
- payload schemas and effectful boundary handling have separate source homes
- decode the exported schema at the boundary rather than creating a parallel
  shape model

## 4. Tagged Unions and Schema-Derived Helpers

File:

- `packages/tooling/tool/cli/src/commands/CreatePackage/FileGenerationPlanService.ts`

Use this file when you need:

- a discriminator field such as `kind`
- `S.toTaggedUnion(...)`
- array defaults on class fields

What to copy:

- `GenerationActionKind` for an annotated literal domain
- `GenerationAction` for tagged-union assembly with `S.toTaggedUnion("kind")`
- `FileGenerationPlanInput` for defaulted collection fields

Why it matters:

- it shows the repo preference for tagged unions over manual branching on
  free-form string fields
- it keeps helper logic derived from the schema instead of restating the rules

## 5. Transport-Style Tagged Unions Without `_tag`

File:

- `packages/tooling/tool/cli/src/commands/VersionSync/VersionSync.schemas.ts`
- `packages/tooling/tool/cli/src/commands/CreatePackage/TsMorphIntegrationService.ts`

Use this file when you need:

- a discriminator such as `category`, `mode`, `section`, or `kind`
- `LiteralKit + mapMembers + Tuple.evolve + S.toTaggedUnion(...)`
- schema-derived `.match` helpers for branch sites

What to copy:

- `VersionCategoryReport`
- `TsMorphMutation`

Why it matters:

- it demonstrates the repo's preferred construction for reusable literal
  domains that become tagged unions
- it keeps the case set anchored to the literal domain instead of a raw union

## 6. Test Proofs for Underused Schema Capabilities

Files:

- `packages/foundation/modeling/md/test/Md.test.ts`
- `packages/foundation/modeling/schema/test/LiteralKit.test.ts`
- `packages/foundation/modeling/schema/test/MappedLiteralKit.test.ts`

Use these files when you need:

- schema-derived property tests with `Arbitrary.schema` and `it.prop`;
- `TaggedUnion`, `LiteralKit`, and `MappedLiteralKit` static API examples.

Why it matters:

- these files are runnable teaching examples for packet agents;
- they demonstrate source-schema-owned behavior instead of weaker test-only
  shapes.

## Quick Selection Map

- Need a plain-data domain payload (branded `S.Opaque`):
  Start with `packages/tooling/tool/cli/src/commands/CreatePackage/FileGenerationPlanService.ts`
- Need schema-driven defaults and transforms:
  Start with the field usage in `packages/foundation/ui-system/dock/src/Minima.ts`
  (upstream `S.withConstructorDefault` / `S.withDecodingDefaultTypeKey`)
- Need exact optional config fields or package-metadata schemas:
  Start with `packages/tooling/tool/cli/src/commands/Docgen/Docgen.schemas.ts`
- Need a `kind` or `type` tagged union:
  Start with `packages/tooling/tool/cli/src/commands/CreatePackage/FileGenerationPlanService.ts`
  or `packages/tooling/tool/cli/src/commands/VersionSync/VersionSync.schemas.ts`
- Need a static API refresher:
  Start with `packages/foundation/modeling/schema/test/LiteralKit.test.ts`
- Need schema-derived property test scaffolding:
  Start with `packages/foundation/modeling/md/test/Md.test.ts`
