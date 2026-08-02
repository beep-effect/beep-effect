# JSDoc Authoring Conventions

## Authoring posture

Start from the reader's decision: what does this symbol help them do, and what
would the TypeScript signature fail to tell them? Write one lead paragraph, add
only useful sections, then add tags. Do not turn the block into a signature echo.

The section grammar is:

1. `**When to use**`
2. `**Details**`
3. `**Gotchas**`
4. `**Example** (Title)` blocks last

Sections are optional except for Examples required by the kind split. Each present
section is non-empty and unique, apart from multiple Examples. When-to-use text
opens with `Use to`, `Use when`, `Use as`, or `Use with`. Every Example title is
non-empty and unique, contains exactly one `ts` fence, and no loose `ts` fence
appears outside an Example.

## Carrier and kind split

Use titled Example sections for all new and touched code. A legacy `@example` tag
is grandfathered in untouched files. When a file's documentation is touched,
migrate its legacy carriers without mass-editing untouched files. Move `@remarks`
content into Details or Gotchas. New `@remarks` is forbidden.

Examples are required for value-level exports: functions, constants, classes,
schemas, services, layers, and other runtime values. Pure type-level exports need
good prose but not an Example: aliases, interfaces, namespaces, `.Encoded`
companions, and same-name schema type companions.

## Worked upgrade

Before:

````ts
/**
 * Decodes a user name.
 *
 * @remarks Returns `None` instead of throwing.
 *
 * @example
 * ```ts
 * const value = decodeUserName("Ada")
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
````

After:

````ts
/**
 * Decodes an unknown value as a non-empty user name without throwing.
 *
 * **When to use**
 *
 * Use when invalid boundary input should become `O.none()`.
 *
 * **Details**
 *
 * Successful decoding returns the normalized schema value.
 *
 * **Example** (Inspect both outcomes)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decodeUserName = S.decodeUnknownOption(S.NonEmptyTrimmedString)
 *
 * console.log(O.isSome(decodeUserName("Ada"))) // true
 * console.log(O.isNone(decodeUserName(""))) // true
 * ```
 *
 * @see {@link S.decodeUnknownOption} for the underlying decoding operation.
 * @category decoding
 * @since 0.0.0
 */
````

The After block follows the Option/none teaching style: it shows the meaningful
success and absence cases and makes the result observable.

## Tag order

After body sections, order applicable tags as follows:

1. `@typeParam`
2. `@param`
3. `@returns`
4. `@throws`
5. `@effects`
6. `@precondition`, `@postcondition`, `@invariant`
7. `@deprecated`
8. `@defaultValue`
9. `@see`
10. `@public`, `@beta`, `@alpha`, `@internal`, `@experimental`
11. `@category`
12. `@since`

Omit conditional tags that restate the signature. Every `@see` has a purpose
phrase, for example:

```text
@see {@link UserName} for the runtime schema and decoded representation.
```

Every deprecation includes a linked replacement and migration instruction.
`@since` stays exactly `0.0.0` until v1.0; tooling checks its format, not inferred
history.

## Example quality and imports

Examples must compile and show an observable result, assertion, decoded value,
Effect execution, or meaningful inferred type. Never use `void result` merely to
satisfy compilation.

Use namespace imports for helper modules:

| Module | Required form |
| --- | --- |
| `effect/Schema` | `import * as S from "effect/Schema"` |
| `effect/Array` | `import * as A from "effect/Array"` |
| `effect/Option` | `import * as O from "effect/Option"` |
| `effect/Predicate` | `import * as P from "effect/Predicate"` |
| `effect/Record` | `import * as R from "effect/Record"` |

Named imports remain appropriate for core combinators from `effect`. Never import
from `@effect/schema`.

## Categories

The source of truth is
`packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts`. Choose the
most specific canonical kebab-case semantic role, not a file or layer name.

Canonical groups:

- Core: `models`, `schemas`, `type-level`, `constructors`, `factories`,
  `destructors`, `combinators`, `predicates`, `guards`, `refinements`,
  `assertions`, `getters`, `setters`, `mapping`, `filtering`, `folding`,
  `sequencing`, `concurrency`, `resource-management`, `error-handling`,
  `utilities`, `layers`.
- Domain: `aggregates`, `entities`, `value-objects`, `domain-events`, `policies`,
  `specifications`, `identifiers`, `entity-ids`, `type-ids`, `symbols`, `errors`.
- Application and ports: `use-cases`, `commands`, `queries`, `events`,
  `workflows`, `processes`, `schedulers`, `protocols`, `ports`, `services`,
  `handlers`, `endpoints`, `clients`, `adapters`, `repositories`, `projections`,
  `read-models`, `tables`.
- Data boundaries: `validation`, `parsing`, `encoding`, `decoding`,
  `serialization`, `codecs`, `formatting`, `normalization`, `dtos`, `mappers`.
- UI and client: `components`, `hooks`, `providers`, `themes`, `tokens`, `forms`,
  `atoms`.
- Tooling: `tools`, `tool-schemas`, `cli-commands`, `configuration`, `constants`,
  `observability`, `diagnostics`, `fixtures`, `testing`, `streams`, `resources`,
  `interop`.

Legacy aliases are for untouched docs only. New and touched blocks use canonical
slugs.

## Forbidden patterns

- `@remarks`, `@module`, or `@template` in new or touched blocks.
- `{type}` blobs in tags or a hyphen after `@returns`/`@throws`.
- Bare `@see` links without a purpose phrase.
- Empty, duplicate, or out-of-order sections; a section after an Example.
- Untitled or duplicate Example titles, multiple fences per Example, or loose
  `ts` fences.
- `any`, type assertions, `declare`, empty generators, or non-compiling Examples.
- Named Schema/Array/Option/Predicate/Record imports or `@effect/schema`.
- Removing an Example to hide a compilation failure.
