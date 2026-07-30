# Examples

These examples are the best starting points for matching repo style.

## 1. Protocol Payloads and Literal Domains

File:

- `packages/tooling/tool/cli/src/commands/CreatePackage/FileGenerationPlanService.ts`

Use this file when you need:

- `LiteralKit` for a public literal domain
- `S.Class` payloads with strong annotations
- schemas fed directly into CLI and file-generation boundaries

What to copy:

- `RelativePlanPath` for annotated schema filters
- `PlannedFile` for a clean `S.Class` object model
- `GenerationActionKind` for annotated literal-kit usage

Why it matters:

- it keeps the schema value reusable across runtime validation and command
  declarations
- it demonstrates that even small protocol payloads stay schema-first

## 2. Defaults and Normalization in the Schema

Files:

- `packages/foundation/modeling/schema/src/SchemaUtils/withConstructorDefaults.ts`
- `packages/foundation/ui-system/dock/src/Minima.ts`

Use these files when you need:

- default behavior encoded directly in the schema
- constructor defaults and decoding defaults kept next to the field definition
- defaults on branded or refined fields

What to copy:

- `SchemaUtils.withConstantDefault`
- `SchemaUtils.withNoneDefault`
- the `Minima.ts` field pattern:
  `PixelAllowance.pipe(SchemaUtils.withConstantDefault<number>(0))` — note the
  explicit type parameter, required when the field is branded

Why it matters:

- normalization and defaults live in schema combinators, not in ad-hoc runtime
  branches
- the final class schema becomes the single source of truth for field behavior

## 3. Optional Data and Typed Errors at a Boundary

File:

- `packages/tooling/tool/cli/src/commands/Docgen/internal/Operations.ts`

Use this file when you need:

- `OptionFromOptionalKey`
- boundary decoding with typed errors
- report-oriented schema classes

What to copy:

- `DocgenConfigDocument` for optional config fields
- `DocgenWorkspacePackage` for boundary data decoded from package metadata
- `DomainError` mapping around filesystem/process boundaries

Why it matters:

- optional transport fields become `Option` immediately
- typed errors remain explicit at the command boundary
- decode functions are passed directly into the boundary helper instead of
  creating a parallel shape model

## 4. Tagged Unions and Schema-Derived Helpers

File:

- `packages/tooling/tool/cli/src/commands/CreatePackage/FileGenerationPlanService.ts`

Use this file when you need:

- a discriminator field such as `kind`
- `S.toTaggedUnion(...)`
- schema-derived equivalence
- array defaults on class fields

What to copy:

- `GenerationActionKind` for an annotated literal domain
- `GenerationAction` for tagged-union assembly with `S.toTaggedUnion("kind")`
- `FileGenerationPlanInput` for defaulted collection fields
- `stringEquivalence` for `S.toEquivalence(...)`

Why it matters:

- it shows the repo preference for tagged unions over manual branching on
  free-form string fields
- it keeps helper logic derived from the schema instead of restating the rules

## 5. Transport-Style Tagged Unions Without `_tag`

File:

- `packages/tooling/tool/cli/src/commands/VersionSync/internal/Models.ts`
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

## 6. Scratch Proofs for Underused Schema Capabilities

Files:

- `scratchpad/index.ts`
- `scratchpad/test/schema-arbitrary-fastcheck.test.ts`
- `scratchpad/test/schema-static-apis.test.ts`

Use these files when you need:

- concrete default-combinator semantics;
- schema-derived property tests with FastCheck and Faker;
- `TaggedUnion`, `LiteralKit`, and `MappedLiteralKit` static API examples.

Why it matters:

- these files are runnable teaching examples for packet agents;
- they demonstrate source-schema-owned behavior instead of weaker test-only
  shapes.

## Quick Selection Map

- Need a `S.Class` domain payload:
  Start with `packages/tooling/tool/cli/src/commands/CreatePackage/FileGenerationPlanService.ts`
- Need schema-driven defaults and transforms:
  Start with `packages/foundation/modeling/schema/src/SchemaUtils/withConstructorDefaults.ts`
  and the field usage in `packages/foundation/ui-system/dock/src/Minima.ts`
- Need `Option` boundary fields or schema-backed errors:
  Start with `packages/tooling/tool/cli/src/commands/Docgen/internal/Operations.ts`
- Need a `kind` or `type` tagged union:
  Start with `packages/tooling/tool/cli/src/commands/CreatePackage/FileGenerationPlanService.ts`
  or `packages/tooling/tool/cli/src/commands/VersionSync/internal/Models.ts`
- Need a static API refresher:
  Start with `scratchpad/test/schema-static-apis.test.ts`
- Need schema-derived property test scaffolding:
  Start with `scratchpad/test/schema-arbitrary-fastcheck.test.ts`
