# JSDoc Documentation Patterns

## Purpose

This document is the binding JSDoc/TSDoc law for the beep-effect workspace.
Documentation must render clearly in IDE hovers, teach callers how to use the API,
and keep every published example compilable.

The section grammar below ports documentation semantics from Effect v4's JSDoc
tooling under the MIT license. This is a semantic port only; beep has no code
dependency on `@effect/jsdocs`.

## Hard requirements

- Every public export has a useful lead description, canonical `@category`, and
  `@since 0.0.0`.
- Value-level exports require at least one Example. Pure type-level exports require
  useful prose; their Example is optional.
- Examples compile through the docgen TypeScript gate. Never remove an Example to
  hide a compilation error.
- New and touched documentation uses titled `**Example** (Title)` sections.
- `@remarks` is forbidden. `@module` and `@template` are forbidden in new work.
- Example code uses Effect patterns and contains no `any`, type assertions,
  `declare` statements, empty generator bodies, or deprecated `@effect/schema`
  imports.

## Description and section grammar

A doc block begins with exactly one lead paragraph. The lead explains the symbol's
purpose or the problem it solves instead of restating its name or signature. Do not
put a Markdown heading or a blank-padded fragment in the lead.

After the lead, the following body sections are optional. When present, they appear
in this exact order:

1. `**When to use**`
2. `**Details**`
3. `**Gotchas**`
4. one or more `**Example** (Title)` sections

Rules for all sections:

- A section is non-empty and appears at most once, except Example sections.
- `**When to use**` opens with `Use to`, `Use when`, `Use as`, or `Use with`.
- Details and Gotchas contain only information not obvious from the signature.
- Every Example has a non-empty title, and titles are unique within the doc block.
- Every Example contains exactly one fenced `ts` block.
- No fenced `ts` block may appear outside an Example section.
- Example sections are last in the body. TSDoc tags follow the body.

Sections are opt-in except where an Example is required by symbol kind. Do not add
empty or formulaic sections merely to fill out the shape.

## Carrier policy

`**Example** (Title)` is the canonical carrier. `@example` and `@remarks` are
forbidden; `AGENTS.md` states that rule without qualification and the quality gate
enforces it.

Enforcement is repo-wide and is not advisory. The zero-legacy check in
`bun run beep quality jsdoc-ratchet` fails when any non-generated
`{packages,apps}/**/src/**/*.{ts,tsx}` file contains `@example` or `@remarks`.
Pass `--include-generated` to scan generator outputs in the same workspace
corpus as well (needed when proving a codegen emitter; the default non-generated
scope cannot prove generated compliance). The gate inspects whole files, not
diff hunks.

For inventory presence the totals ratchet still counts either a valid Example
section or a legacy tag. That is a scoring detail of the fail-on-growth comparison,
not permission to author a legacy carrier.

## Kind-split Example law

An Example is required for value-level exports:

- functions and exported constants;
- classes, including error and schema-backed classes;
- runtime schemas and schema helpers;
- services and layers;
- other runtime values callable or consumable by application code.

An Example is optional for pure type-level exports:

- type aliases and interfaces;
- namespaces;
- `.Encoded` companions;
- same-name type companions for runtime schemas.

Pure type-level exports still require precise prose, `@category`, and `@since`.
When a type-level Example genuinely teaches narrowing, inference, or composition,
it may be included and must obey the full Example grammar.

Re-export declarations are graph edges, not separate documentation subjects.
Document the owning declaration rather than inventing a barrel Example.

## Canonical templates

### Value-level export

````ts
/**
 * Decodes an unknown value as a non-empty user name without throwing.
 *
 * **When to use**
 *
 * Use when invalid input should be represented by `O.none()` at a boundary.
 *
 * **Details**
 *
 * The returned `Option` contains the schema-decoded value, not the raw input.
 *
 * **Example** (Decode a user name)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = decodeUserName("Ada")
 *
 * console.log(O.isSome(decoded)) // true
 * console.log(O.isNone(decodeUserName(""))) // true
 * ```
 *
 * @see {@link S.decodeUnknownOption} for the underlying decoding operation.
 * @category decoding
 * @since 0.0.0
 */
export const decodeUserName = S.decodeUnknownOption(S.NonEmptyTrimmedString)
````

### Pure type-level export

````ts
/**
 * Encoded input accepted by {@link UserName} before schema decoding.
 *
 * @see {@link UserName} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export type UserNameEncoded = typeof UserName.Encoded
````

### Before and after

Before, the legacy block hides semantics under `@remarks` and uses the degraded
tag carrier:

````ts
/**
 * Decodes a user name.
 *
 * @remarks Returns `None` rather than throwing for invalid input.
 *
 * @example
 * ```ts
 * const result = decodeUserName("Ada")
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
````

After, the lead teaches purpose, semantics have a body section, and the Example is
titled and observable:

````ts
/**
 * Decodes an unknown value as a non-empty user name without throwing.
 *
 * **Details**
 *
 * Invalid input becomes `O.none()`.
 *
 * **Example** (Inspect success and failure)
 *
 * ```ts
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(decodeUserName("Ada"))) // true
 * console.log(O.isNone(decodeUserName(""))) // true
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
````

## Tag order

Body sections, including Examples, always precede tags. Within the tag area, use
this order while omitting tags that do not add information:

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

This preserves Effect's relative order for its shared trailing tags:
`@deprecated` -> `@defaultValue` -> `@see` -> `@category` -> `@since`.

### Conditional tags

The default is omission. Add a conditional tag only when it supplies information
the TypeScript signature and body sections do not communicate.

- `@typeParam`: a type parameter has a non-obvious constraint or semantic role.
- `@param`: a parameter has units, constraints, ordering, or interactions not
  visible in its type.
- `@returns`: the result has ordering, filtering, ownership, or interpretation
  not visible in its type.
- `@throws`: the symbol can throw synchronously or produce a defect outside an
  Effect error channel.
- `@effects`: the operation writes, publishes, invalidates, or performs another
  side effect not visible in its type.
- `@precondition`: the caller must establish a non-obvious condition.
- `@postcondition`: a non-obvious state guarantee holds after success.
- `@invariant`: the operation or class preserves a non-obvious property.
- `@deprecated`: the API has a replacement and migration path.
- `@see`: a related symbol helps the reader choose, compose, or understand the
  API.

`@remarks` is not a conditional tag. It is retired; use Details or Gotchas.

## Described links

Use `{@link Symbol}` inline where the reference supports the surrounding sentence.
Every `@see` must include a purpose phrase after its link:

```text
@see {@link UserName} for the runtime schema and decoded representation.
@see {@link S.decodeUnknownOption} for the underlying non-throwing decoder.
```

Bare links such as `@see {@link UserName}` are forbidden. Link-target resolution is
deferred to a follow-on goal; authors must still choose real, documented targets.

Every `@deprecated` includes a `{@link}` replacement and a concise migration
instruction.

## TSDoc grammar

1. Do not put `{type}` blobs in `@param`, `@returns`, or `@throws`; the TypeScript
   signature is authoritative.
2. Use `@typeParam`, never `@template`.
3. Write `@param name - description`; the hyphen belongs only to `@param`.
4. Write `@returns description` and `@throws description` without a hyphen.
5. Use `@packageDocumentation`, never `@module`, at package entry points.
6. Use `@defaultValue`, not the JSDoc-era `@default` spelling.

## Example quality and compilation

Every Example must compile via the docgen TypeScript gate and demonstrate a useful,
observable result: a returned or decoded value, assertion, Effect execution,
visible output, or meaningful inferred type. A void-discarded value is a compile
trick, not documentation.

Run a bounded edit-loop check with:

```bash
bun run docgen:local
```

`docgen:local` plans from `origin/main...HEAD` plus dirty worktree files, but it
refuses rather than narrows when a global input moved. Changing the root
`bun.lock`, `package.json`, `turbo.json`, `.bun-version`, `tsconfig.json`,
`tsconfig.base.json`, `tsconfig.packages.json`, or anything under
`packages/tooling/tool/docgen/` or `packages/tooling/tool/cli/src/commands/Docgen/`
marks the plan `full-required`, and the bare script then prints
`full docgen proof required` and exits non-zero. Only `--allow-full` (what the
hosted `quality:docgen` lane passes) or `--full` executes the repo-wide proof.
An explicit package selector remains a bounded edit loop even on such a branch:

```bash
bun run docgen:local -- --package <package>
```

Package selection bypasses changed-file planning and stays scoped unless `--full`
is explicit. The bare automatic loop is unavailable after a global input moves;
the package-scoped loop is still available when the operator can name the affected
package. The trigger list is a hand-maintained exact-path constant in
`packages/tooling/tool/cli/src/commands/Docgen/internal/Local.ts`, not a Turbo
`globalDependencies` declaration.

Use the full-repo `bun run docgen` only when full proof is required. The report-only
quality subject remains available as:

```bash
bun run beep docgen quality -p <package> --json --score codex
```

Never remove an Example to make compilation pass. Fix the imports, API usage, or
example itself.

### Runnable Example fences

Examples selected for runtime documentation testing use the canonical fence info
string `ts import.meta.vitest name="<Example title>"`. The name is derived from
the enclosing `**Example** (Title)` heading. A trailing `// => expected` comment
asserts the value of the expression on the same line using Effect equality. It
may trail an expression statement or one initialized `const` identifier. It may
appear inside control flow only when that control-flow body has an explicit
block.

Runnable fences complement the docgen TypeScript gate; they do not replace it.
Type-only fences still compile through docgen and are reported as vacuous by
`bun run beep docgen doctest verify`. Do not add a tautological runtime assertion
to make a type-only fence appear executable.

For pure new and touched Examples, run `bun run beep docgen doctest verify` and
use `bun run beep docgen doctest mark --write` to apply the canonical marker and
safe assertion rewrites. `console.log(expression) // expected` is cleanup-on-touch:
when the expected text is literal-like and the command can prove an equivalent
doctest assertion, rewrite it to `expression // => expected`. Keep console output
when the displayed value is prose, formatting, or otherwise not a valid expected
TypeScript expression. Never mark examples that use environment variables,
filesystem, network, child processes, Bun APIs, databases, external or relative
imports, JSX, or React.

## Imports inside Examples

Keep beep's namespace-import law; do not port Effect's named-import rule.

| Module | Required form |
| --- | --- |
| `effect/Schema` | `import * as S from "effect/Schema"` |
| `effect/Array` | `import * as A from "effect/Array"` |
| `effect/Option` | `import * as O from "effect/Option"` |
| `effect/Predicate` | `import * as P from "effect/Predicate"` |
| `effect/Record` | `import * as R from "effect/Record"` |

Core combinators may use named imports from the root `effect` module, for example
`import { Console, Effect, Layer } from "effect"`. Never import from the deprecated
`@effect/schema` package.

## Schema and Effect-specific guidance

- Schema values and schema-backed classes are value-level and require an Example.
- Same-name schema type aliases and `.Encoded` companions are pure type-level and
  require prose only.
- Error classes are value-level; show how a caller constructs, raises, or handles
  the error.
- Services and layers are value-level; show acquisition, provision, or a useful
  method call.
- For `Effect<A, E, R>` results, do not restate the channels in tags. Use prose for
  non-obvious failure or environment semantics.
- A `Fn` method takes its type from its `output` schema. When that output is
  `EffectSchema<A, E, R>()` with a non-`never` `R`, the requirement channel
  travels with the method, so `Effect.runPromise(shape.method(x))` fails to
  typecheck even when the fixture implementation needs nothing. Either provide
  the requirements first — `Effect.runPromise(Effect.provide(shape.method(x), deps))`
  — or compose the effect without running it. A `Fn` whose output declares
  `R = never` runs normally.
- Document a `dual` operation once on the outer declaration unless its call forms
  have meaningfully different semantics.

## Category annotation

Use the most specific canonical kebab-case role from
`packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts`. Choose the
symbol's semantic role rather than its file or architectural layer.

- Core API roles: `models`, `schemas`, `type-level`, `constructors`, `factories`,
  `destructors`, `combinators`, `predicates`, `guards`, `refinements`,
  `assertions`, `getters`, `setters`, `mapping`, `filtering`, `folding`,
  `sequencing`, `concurrency`, `resource-management`, `error-handling`,
  `utilities`, `layers`.
- Domain roles: `aggregates`, `entities`, `value-objects`, `domain-events`,
  `policies`, `specifications`, `identifiers`, `entity-ids`, `type-ids`, `symbols`,
  `errors`.
- Application and ports: `use-cases`, `commands`, `queries`, `events`,
  `workflows`, `processes`, `schedulers`, `protocols`, `ports`, `services`,
  `handlers`, `endpoints`, `clients`, `adapters`, `repositories`, `projections`,
  `read-models`, `tables`.
- Data boundaries: `validation`, `parsing`, `encoding`, `decoding`,
  `serialization`, `codecs`, `formatting`, `normalization`, `dtos`, `mappers`.
- UI and client state: `components`, `hooks`, `providers`, `themes`, `tokens`,
  `forms`, `atoms`.
- Tooling and cross-cutting: `tools`, `tool-schemas`, `cli-commands`,
  `configuration`, `constants`, `observability`, `diagnostics`, `fixtures`,
  `testing`, `streams`, `resources`, `interop`.

Legacy aliases are accepted only for untouched documentation. New and touched blocks
use canonical slugs. Values such as `exports`, `re-exports`, `modules`, `core`,
`generated`, and `presentation` are rejected because they describe topology rather
than a symbol's role.

## Custom agent-context tags

The registered `@effects`, `@precondition`, `@postcondition`, and `@invariant`
tags capture call-site contracts that a signature cannot express. Keep them concise;
use Details or Gotchas for general semantics.

```text
@effects Writes the decoded record and invalidates its lookup cache key.
@precondition The supplied revision must equal the stored revision.
@postcondition The returned entity carries the next revision.
@invariant The entity identifier never changes.
```

## Forbidden patterns

- `@remarks`, or `@module` / `@template` in new or touched documentation.
- An undescribed `@see`.
- Duplicate, empty, out-of-order, or post-Example body sections.
- An untitled Example, duplicate Example title, multiple fences in one Example,
  or a loose `ts` fence outside an Example.
- Type braces in tags or a hyphen after `@returns`/`@throws`.
- Named imports from `effect/Schema`, `effect/Array`, `effect/Option`,
  `effect/Predicate`, or `effect/Record`.
- `any`, type assertions, `declare`, empty `Effect.gen`, or non-compiling code in
  Examples.
- Removing an Example to avoid fixing it.

## Review checklist

- [ ] Lead description is one useful paragraph.
- [ ] Optional sections are non-empty, unique, and in canonical order.
- [ ] When-to-use text begins with an allowed opener.
- [ ] Every required value-level Example is titled, unique, last, single-fence,
      observable, and compilable.
- [ ] Pure type-level exports have useful prose; Examples are included only when
      pedagogically valuable.
- [ ] No loose `ts` fences exist in touched documentation, and no legacy carriers
      remain anywhere under `{packages,apps}/**/src`.
- [ ] Every `@see` has a purpose phrase; every deprecation links a replacement.
- [ ] Conditional tags add information beyond the signature and follow tag order.
- [ ] Imports use canonical namespace aliases.
- [ ] `@category` is canonical and `@since` is exactly `0.0.0`.
- [ ] TSDoc grammar is clean: no `{type}`, `@template`, `@module`, or misplaced
      hyphen.
- [ ] Schema annotations remain aligned with runtime schemas.
- [ ] `bun run docgen:local` passes for the changed documentation.
