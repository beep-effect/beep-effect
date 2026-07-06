# JSDoc Conventions: Block Structure, Quality, Aliases, Categories, Forbidden Patterns

## Contents

- [JSDoc Block Structure](#jsdoc-block-structure)
- [Quality Rubric](#quality-rubric)
- [Import Aliases in Examples](#import-aliases-in-examples)
- [Category Conventions](#category-conventions)
- [Forbidden Patterns in Examples](#forbidden-patterns-in-examples)

## JSDoc Block Structure

Every exported symbol MUST have this minimum structure:

````
/**
 * Brief one-line description.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const result = MyModule.myFunction(args)
 * console.log(result)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
````

Tag order within the block:

1. Description
2. `@remarks` (when semantics are non-obvious)
3. `@example` (one or more)
4. `@typeParam` (when constrained or non-obvious)
5. `@param` (when prose adds beyond name + type)
6. `@returns` (when prose adds beyond type)
7. `@throws` (synchronous throws / defects only)
8. `@effects` (custom — side effects)
9. `@precondition` / `@postcondition` / `@invariant` (custom — contracts)
10. `@see`
11. `@deprecated` (with `{@link}` migration target)
12. `@public` / `@beta` / `@alpha` / `@internal` / `@experimental`
13. `@category` (required, canonical kebab-case slug)
14. `@since` (required, `0.0.0`)

## Quality Rubric

The report-only `beep docgen quality` command scores the whole JSDoc block, not
just whether tags exist. Treat `@example` as universal for exported symbols; for
error classes, type-only helpers, constants, and schemas, choose a handling,
narrowing, construction, or import example that fits the symbol.

Re-export declarations are graph edges, not symbol-quality subjects. Document
the exported symbol at its owning declaration instead of inventing a fake barrel
example.

A useful example is fenced TypeScript and shows an observable result:
assertion, returned value, decoded value, Effect execution, visible output, or
type-level evidence. For type-only exports, useful evidence includes named
aliases, assignability or `satisfies` checks, `Equal`/`Expect`-style assertions,
or comments that show inferred types. `const result = ...; void result` is a
compile trick, not documentation.

## Import Aliases in Examples

Mandatory aliases inside every `@example` code fence:

| Module | Alias | Correct | Forbidden |
|--------|-------|---------|-----------|
| `effect/Schema` | `S` | `import * as S from "effect/Schema"` | `import { Schema }` |
| `effect/Array` | `A` | `import * as A from "effect/Array"` | `import { Array }` |
| `effect/Option` | `O` | `import * as O from "effect/Option"` | `import { Option }` |
| `effect/Predicate` | `P` | `import * as P from "effect/Predicate"` | `import { Predicate }` |
| `effect/Record` | `R` | `import * as R from "effect/Record"` | `import { Record }` |

Core combinators use named imports: `import { Effect, Console, Layer } from "effect"`.

Never import from the deprecated `@effect/schema` package.

## Category Conventions

Use canonical kebab-case slugs. Choose the exported symbol's semantic role, not
its package location. The code source of truth is
`packages/tooling/tool/cli/src/commands/Shared/JSDocCategories.ts`.

Canonical groups:

- Core API roles: `models`, `schemas`, `type-level`, `constructors`,
  `factories`, `destructors`, `combinators`, `predicates`, `guards`,
  `refinements`, `assertions`, `getters`, `setters`, `mapping`, `filtering`,
  `folding`, `sequencing`, `concurrency`, `resource-management`,
  `error-handling`, `utilities`, `layers`
- Domain roles: `aggregates`, `entities`, `value-objects`, `domain-events`,
  `policies`, `specifications`, `identifiers`, `entity-ids`, `type-ids`,
  `symbols`, `errors`
- Application and ports: `use-cases`, `commands`, `queries`, `events`,
  `workflows`, `processes`, `schedulers`, `protocols`, `ports`, `services`,
  `handlers`, `endpoints`, `clients`, `adapters`, `repositories`,
  `projections`, `read-models`, `tables`
- Data boundaries: `validation`, `parsing`, `encoding`, `decoding`,
  `serialization`, `codecs`, `formatting`, `normalization`, `dtos`, `mappers`
- UI and client state: `components`, `hooks`, `providers`, `themes`, `tokens`,
  `forms`, `atoms`
- Tooling and cross-cutting: `tools`, `tool-schemas`, `cli-commands`,
  `configuration`, `constants`, `observability`, `diagnostics`, `fixtures`,
  `testing`, `streams`, `resources`, `interop`

Legacy values such as `DomainModel`, `Utility`, `UseCase`, `PortContract`, and
`ToolSchemas` are migration aliases only. New or touched JSDoc should use the
canonical slug.

## Forbidden Patterns in Examples

1. `any` types — never.
2. Type assertions (`as`, `as unknown as`) — never.
3. `declare` statements — never.
4. Non-compiling code — every example must pass `bun run docgen`.
5. `import { Schema } from "effect/Schema"` — use the `S` alias.
6. `from "@effect/schema"` — the package is deprecated.
7. Removing examples to fix compilation — always fix the example instead.
8. `import { Array }` / `import { Option }` etc. — use namespace aliases.
9. **Empty `Effect.gen` bodies** — examples must be complete and demonstrate
   real usage. `Effect.gen(function* () {})` with no body is forbidden.
10. **`@template` instead of `@typeParam`** — replace.
11. **`{type}` blobs in tags** — drop the braces.
12. **`@module` instead of `@packageDocumentation`** — replace.
