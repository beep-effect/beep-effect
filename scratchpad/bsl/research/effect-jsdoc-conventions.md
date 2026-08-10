# Effect v4 JSDoc conventions for `@beep/effect-drizzle`

- Date: 2026-08-10
- Task: research only; no implementation
- Primary corpus: `.repos/effect/packages/effect/src`
- Cross-check corpus: `node_modules/effect/src`

## Executive conclusion

Effect v4's current documentation grammar is small and unusually consistent:

1. one purpose-first lead;
2. optional `**When to use**`;
3. optional `**Details**`;
4. optional `**Gotchas**`;
5. one or more titled `**Example** (Title)` sections, last;
6. relationship and lifecycle tags, normally `@see`, `@category`, then `@since`.

The exact spelling is `**When to use**`, not `**When to Use**`. `**Syntax**` does
not occur in the primary or installed corpus. The only additional standalone
bold section in either corpus is one security-specific `**Security**` section.

For the BSL pass, copy the grammar and the decision-oriented writing, but do not
copy every upstream mechanical detail. In particular, keep this repository's
canonical category slugs, `@since 0.0.0`, plain `ts` fences, and the package's
locked named subpath imports. Those are deliberate beep adaptations to an Effect
style, not accidental divergences.

## 1. Corpus and method

### 1.1 Snapshots

| Corpus | Snapshot | Files scanned recursively | Role |
| --- | --- | ---: | --- |
| `.repos/effect/packages/effect/src` | Effect commit `8bfd7f5ed0aee7fe0ca73ee5ee303788325c2ffc`; package `4.0.0-beta.105` | 437 | canonical result |
| `node_modules/effect/src` | installed package `4.0.0-beta.104` | 437 | drift cross-check only |

Of the 437 paired source files, 291 are byte-identical and 146 differ. Counts in
this document therefore do not merge the two versions.

### 1.2 Counting rules

- Section counts are occurrences of strict standalone JSDoc lines matching
  `* **Name**` with an optional parenthesized title. Bold prose on a line with
  other text is not a section.
- `Example` counts are header occurrences, not doc-block counts. A block with two
  examples contributes two.
- Symbol-kind attribution associates a JSDoc block with the declaration that
  immediately follows it through the TypeScript AST. Variable statements cover
  the many `export const` APIs.
- Category and since counts include only actual JSDoc tag lines. This avoids
  counting strings embedded in generated source.
- The AST census found 8,663 primary JSDoc blocks carrying at least one counted
  section or documentation tag. Header counts themselves are complete across all
  437 files.
- The BSL delta census was captured from the round-6/6.5 baseline after an
  initial worktree check showed only the pre-existing untracked round-7 brief.
  Concurrent round-7 source edits appeared later and are intentionally excluded
  from the baseline counts and conflict list.

Useful reproduction searches:

```sh
rg --glob '*.ts' --glob '*.tsx' \
  '^\s*\*\s+\*\*[^*]+\*\*(?:\s+\([^)]*\))?\s*$' \
  .repos/effect/packages/effect/src

rg --glob '*.ts' --glob '*.tsx' \
  '^\s*\*\s+@(category|since|see|deprecated)(?:\s|$)' \
  .repos/effect/packages/effect/src
```

## 2. Quantified section census

### 2.1 Strict standalone headers

| Header | Primary beta.105 | Installed beta.104 | Primary minus installed | Primary declaration kinds |
| --- | ---: | ---: | ---: | --- |
| `**Example** (Title)` | 3,357 | 5,862 | -2,505 | const 2,616; function 268; interface 190; type 157; class 62; namespace 17; members 43; re-export 3; unattached 1 |
| `**Details**` | 3,075 | 4,715 | -1,640 | const 1,884; function 347; interface 311; type 238; class 181; namespace 12; members 102 |
| `**When to use**` | 2,463 | 3,789 | -1,326 | const 1,709; function 265; interface 159; type 132; class 106; namespace 17; members 74; unattached 1 |
| `**Gotchas**` | 458 | 655 | -197 | const 322; function 72; members 28; interface 16; class 14; type 5; module header 1 |
| `**Security**` | 1 | 1 | 0 | one exported const |
| `**Syntax**` | 0 | 0 | 0 | none |

The one `Security` section belongs to HTTP response compression and documents a
BREACH-style information leak. It is a justified domain-risk section, not a
general fifth slot to add mechanically
(`.repos/effect/packages/effect/src/unstable/http/HttpMiddleware.ts:410`).

Other bold-leading phrases found by a looser grep are inline callouts such as
`**Important:**`, `**Warning**`, and `**Note**`; they carry prose on the same line
and are not section headers. The strongest example is the placement warning for
`Match.withReturnType` (`.repos/effect/packages/effect/src/Match.ts:444`).

### 2.2 Ordering and title discipline

Across the primary corpus:

- all 3,357 `Example` headers have a non-empty parenthesized title;
- all 2,463 `When to use` bodies begin with `Use to`, `Use when`, `Use as`, or
  `Use with`;
- no block violates `When to use -> Details -> Gotchas -> Example(s)` ordering;
- 104 blocks use all four canonical sections; most blocks intentionally use a
  subset;
- repeated Examples are allowed and remain last;
- `@example` and `@remarks` occur zero times as JSDoc tags in both corpora.

There are five loose fenced snippets outside titled Examples in the primary
tree: three public `HttpApiSchema` blocks and two internal/module explanations.
They are exceptions, not a pattern for BSL. Every actual titled Example has one
code fence.

### 2.3 Installed-copy drift

The installed beta.104 copy uses exactly the same five standalone header names
and the same order, title, opener, and fence conventions. It is simply much more
heavily documented:

| Measure | Primary beta.105 | Installed beta.104 |
| --- | ---: | ---: |
| Counted JSDoc blocks | 8,663 | 11,895 |
| `@category` tags | 7,325 | 10,558 |
| `@since` tags | 8,404 | 11,635 |
| `@see` tags | 3,241 | 5,233 |
| Distinct category values | 128 | 128 |
| `@example` / `@remarks` | 0 / 0 | 0 / 0 |

The largest section-count reductions in beta.105 are in `Effect.ts` (-672),
`Stream.ts` (-536), `Array.ts` (-532), `Channel.ts` (-233), `Graph.ts` (-178),
and `Option.ts` (-177). Nothing in this mechanical comparison establishes why
those blocks changed. The safe conclusion is only that the grammar is stable
while coverage is version-sensitive; beta.105 remains the authority requested
for this task.

## 3. Per-symbol-kind anatomy

Percentages below are descriptive, not upstream enforcement rules. Effect's
best blocks are richer than its corpus minimum, so the BSL rubric later in this
document deliberately selects the stronger pattern.

### 3.1 Module header

There are 383 files whose first token is a JSDoc module header. Of those, 362
(94.5%) carry `@since`; none carries `@category`; none carries an Example; one
internal module header carries a `Gotchas` section.

Anatomy:

1. a direct statement of the module's purpose;
2. one short scope paragraph naming the kinds of work the module owns;
3. important global semantics, if any;
4. `@since` only.

The header documents the module, not its filesystem location and not every
export. It does not use `@packageDocumentation` in this corpus. BSL should still
follow beep's package-doc rule where the future package entrypoint requires that
tag; this is a local tooling adaptation.

### 3.2 Constructors and factories

The upstream `constructors` category has 1,051 blocks: 920 consts, 113 function
declarations, eight interfaces, four classes, four types, and two unattached
blocks.

| Section | Constructor blocks containing it | Share |
| --- | ---: | ---: |
| When to use | 357 | 34.0% |
| Details | 462 | 44.0% |
| Gotchas | 77 | 7.3% |
| at least one Example | 584 | 55.6% |

Strong constructor docs explain the resulting runtime shape, validation or
allocation semantics, and adjacent alternatives. `Data.taggedEnum` is the model:
it says what is returned, states that values are plain objects, warns that `$is`
checks only `_tag`, then demonstrates construction and matching.

Use `Gotchas` when construction can skip checks, capture mutable state, return a
plain object rather than a class, perform only shallow validation, or rely on a
generic that TypeScript cannot infer.

### 3.3 Combinators

The generic `combinators` category has 434 blocks: 411 consts, 22 functions, and
one type. More specific action categories such as `mapping`, `filtering`,
`sequencing`, `zipping`, and `error handling` are also common, so `combinators`
is not the automatic label for every pipeable function.

| Section | Combinator blocks containing it | Share |
| --- | ---: | ---: |
| When to use | 153 | 35.3% |
| Details | 231 | 53.2% |
| Gotchas | 39 | 9.0% |
| at least one Example | 251 | 57.8% |

Anatomy:

1. lead states the transformation and what remains unchanged;
2. `When to use` distinguishes it from its nearest alternatives;
3. `Details` gives branch behavior, evaluation, or channel preservation;
4. `Gotchas` records arity, ordering, laziness, unsafe, or short-circuit traps;
5. Example shows the public call form and an observable result;
6. `@see` points to neighboring combinators before category and since.

Dual APIs are documented once. An Example may show data-first, data-last, and
`.pipe(...)` forms when that choice is material, as `Effect.map` does
(`.repos/effect/packages/effect/src/Effect.ts:2304`).

### 3.4 Type-level utilities

The `utility types` category has 466 AST-associated blocks: 416 type aliases, 35
interfaces, 13 runtime values, and two functions.

| Section | Utility-type blocks containing it | Share |
| --- | ---: | ---: |
| When to use | 89 | 19.1% |
| Details | 127 | 27.3% |
| Gotchas | 3 | 0.6% |
| at least one Example | 119 | 25.5% |

Anatomy:

1. lead states the type-level transformation or test;
2. `When to use` names the generic-programming decision;
3. `Details` explains distribution, inference control, or the true/false result;
4. an optional Example imports with `import type`, declares representative
   aliases, and makes inferred results legible in comments;
5. category and historical since.

For types with no runtime, Effect does not force fake execution. `Types.Equals`
uses `type Yes`, `type No`, and `type AnyCheck`; other blocks add a typed
`witness` only when assignability itself is the lesson. BSL should never log a
type or invent a runtime proxy for it.

### 3.5 Guards and predicates

The `guards` category has 263 blocks: 222 consts and 41 functions. It is distinct
from `predicates` (126 tags): guards narrow an input type, while predicates need
only return a boolean.

| Section | Guard blocks containing it | Share |
| --- | ---: | ---: |
| When to use | 132 | 50.2% |
| Details | 86 | 32.7% |
| Gotchas | 17 | 6.5% |
| at least one Example | 145 | 55.1% |

Anatomy:

1. lead states both the runtime check and narrowing result;
2. `When to use` names the boundary or narrowing need;
3. `Details` says whether the check is nominal, structural, shallow, or
   recursive;
4. `Gotchas` is earned when only a tag/property/length is checked;
5. Example begins with `unknown` when narrowing is the point and observes both
   the boolean and/or narrowed access.

### 3.6 Error classes

There are 161 `errors` category tags. The syntactic class subset contains 130
blocks: 15 have When to use, 47 Details, three Gotchas, and 29 an Example. Of
those classes, 129 are marked `@since 4.0.0` and one `@since 3.18.0`.

Coverage is uneven, but the exemplary error blocks share this anatomy:

1. lead states when the error is produced, not merely that it is an error;
2. `Details` interprets fields and deliberately collapsed cases;
3. optional `When to use` describes caller-facing choice or recovery boundary;
4. Example constructs, catches, narrows, yields, or handles the error;
5. `@category errors`, then historical `@since`.

The `Schema.TaggedError` *factory* is categorized as `constructors`; each class
created with it is categorized as `errors`. That distinction maps directly to
BSL.

## 4. Category and `@since` discipline

### 4.1 Category rules observed

Effect categories describe semantic roles, not directories. They are lowercase
human phrases, sometimes with spaces or punctuation. Module headers omit them.
The primary corpus contains 7,325 category tags across 128 exact values.

Full census, grouped only to make the list readable:

- **100+**: models (1,189); constructors (1,051); utility types (466);
  combinators (434); schemas (411); guards (263); services (211); getters (191);
  layers (184); transforming (164); errors (161); converting (142); mutations
  (140); filtering (130); predicates (126); validation (109); type IDs (108).
- **50-99**: error handling (99); mapping (97); sequencing (92); math (82);
  decoding (81); encoding (70); accessors (67); protocols (67); options (64);
  combining (54).
- **20-49**: destructors (49); instances (40); constants (38); running (38);
  folding (36); providing services (36); completion (33); configuration (33);
  resource management (31); references (29); zipping (29); annotations (28);
  symbols (26); formatting (24); logging (24); tracing (24); splitting (23);
  pattern matching (22); serialization (22); handlers (21); unsafe (21);
  searching (20).
- **10-19**: testing (17); comparisons (16); grouping (16); interruption (16);
  repetition (16); set operations (15); delays & timeouts (14); generators (14);
  ordering (14); defining patterns (12); iterators (11); setters (11); metrics
  (10); sizes (10); taking (10).
- **2-9**: hashing (9); merging (9); metadata (9); algorithms (8);
  deduplication (8); racing (8); subscriptions (8); caching (7); middleware (7);
  wrapping (7); compression (6); lifting (6); rate limiting (6); sorting (6);
  routes (5); traversing (5); accumulation (4); buffering (4); forking (4);
  loaders (4); offering (4); parsing (4); prototypes (4); resolvers (4);
  aggregation (3); attributes (3); branding (3); broadcasting (3); context (3);
  hooks (3); publishing (3); transactions (3); verification (3); alternatives
  (2); compaction (2); cookies (2); defaults (2); equality (2); keep alive (2);
  lifecycle (2); optionality (2); parameters (2); reactivity (2); scaling (2);
  scripting (2); security (2); signing (2); snapshotting (2); text generation
  (2); transposing (2); utilities (2); workers (2).
- **Singletons**: aliasing; batching; compensation; dehydration; encryption;
  headers; hydration; idempotency; proxying; re-exports; redirects; reflection.

This taxonomy is evidence, not the BSL allowlist. The future package must use
the repository's canonical values from
`packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts`. Relevant
normalizations include `utility types -> type-level`, `type IDs -> type-ids`,
`error handling -> error-handling`, and `resource management ->
resource-management`. Upstream-only labels such as `converting` are not a reason
to introduce a new beep category.

### 4.2 `@since`

The primary corpus contains 8,404 `@since` tags and 37 exact semantic versions.
The largest cohorts are:

| Version | Count | Share |
| --- | ---: | ---: |
| `4.0.0` | 5,819 | 69.2% |
| `2.0.0` | 1,975 | 23.5% |
| `3.10.0` | 225 | 2.7% |
| `3.6.0` | 103 | 1.2% |
| `3.18.0` | 80 | 1.0% |
| all other 32 versions | 202 | 2.4% |

Effect records the symbol's actual introduction version; it does not stamp the
current package version and it has no `@since 0.0.0` in this snapshot. BSL's
correct adaptation is nevertheless `@since 0.0.0` for every current owning
export until the package establishes release history. Changing those tags to
Effect's versions would be false provenance.

## 5. Example-code style

### 5.1 Fences and imports

Of the 3,357 titled primary Examples, 3,355 use
```` ```ts import.meta.vitest ```` and two use plain ```` ```ts ````. The marker
turns the example into executable source for Effect's own documentation tests.

There are 3,603 JSDoc import statements. The import forms are:

- 3,084 value imports like `import { Effect, Schema } from "effect"`;
- 104 type-only root imports like `import type { Types } from "effect"`;
- 414 imports from public unstable/testing entrypoints such as
  `effect/unstable/sql` or `effect/testing`;
- one namespace import from `fast-check`;
- zero relative imports;
- zero `import * as X from "effect"` examples.

Stable examples therefore present the consumer root namespace API, not the
source file that owns the declaration. BSL's round-6.5 publishing law chooses a
different public style: named imports from `effect/Schema`, `effect/Effect`, and
other owning subpaths. Keep that law, but retain Effect's more important rule:
examples import only public package entrypoints, never `./source.ts`,
`../internal/...`, or test fixtures.

Use plain `ts` fences in BSL because beep docgen owns compilation. Do not add
`import.meta.vitest` unless beep's documentation toolchain explicitly adopts
that marker.

### 5.2 Observable results

Effect overwhelmingly uses executable expression/result comments:

```ts
Option.map(Option.some(2), (n) => n * 2) // => Option.some(4)
```

There are 4,723 `// =>` result lines in the primary corpus. By contrast, only
three JSDoc lines execute or mention `console.log(...)`, and no Example uses
`expect(...)`. The three `assert.deepStrictEqual` mentions are prose about test
helpers, not the dominant Example style.

Rules for BSL:

- prefer a direct expression plus `// => expected`;
- for Effects, run the program with `runSync`/`runPromise` and show the result;
- use a small collected output array only when observing multiple effects or
  callbacks;
- use `console.log` only when console behavior is the API being taught;
- do not log a function, repository Effect, schema object, or namespace merely
  to prove it exists;
- do not use test-framework assertions in consumer documentation.

### 5.3 Type-only examples

The primary corpus contains 286 JSDoc `type` declarations, 91 `interface`
declarations, and 35 `const witness` declarations. The recurring type-level
styles are:

1. import the namespace with `import type`;
2. declare input and output aliases;
3. annotate the inferred result in a comment;
4. add a typed witness only when assignment or narrowing is the point;
5. include `@ts-expect-error` only when a rejected call is the lesson.

For BSL validators, show both the accepted reduction and the readable
`~effect-drizzle.error` result. Do not invent runtime code for a type alias, and
do not use `console.log` to stand in for compile-time behavior.

## 6. Exemplary verbatim excerpts

These are selected as the bar, not as a claim that every upstream block reaches
the same quality.

### 6.1 Module header

Source: `.repos/effect/packages/effect/src/Data.ts:1-10`

````ts
/**
 * Defines helpers for small immutable data models.
 *
 * This module helps create plain classes, tagged classes, tagged unions, and
 * typed errors with readonly fields. Tagged values carry a `_tag` field, which
 * makes them easy to narrow with pattern matching or simple checks. These
 * helpers are commonly used for domain values and errors in Effect programs.
 *
 * @since 2.0.0
 */
````

Why it is exemplary: it states the owned problem space and shared semantics
without enumerating exports.

### 6.2 `Data.TaggedEnum` descriptor type

Source: `.repos/effect/packages/effect/src/Data.ts:100-141`

````ts
/**
 * Transforms a record of variant definitions into a discriminated union type.
 *
 * **When to use**
 *
 * Use when you have two or more variants that share a common `_tag` discriminator.
 *
 * **Details**
 *
 * Each key in the record becomes a variant with `readonly _tag` set to that
 * key. Use with {@link taggedEnum} to get constructors and matchers.
 *
 * **Gotchas**
 *
 * Variant records must **not** include a `_tag` property; it is added automatically.
 *
 * **Example** (Defining a tagged enum)
 *
 * ```ts import.meta.vitest
 * import { Data } from "effect"
 *
 * type HttpError = Data.TaggedEnum<{
 *   BadRequest: { readonly status: 400; readonly message: string }
 *   NotFound: { readonly status: 404 }
 * }>
 *
 * // Equivalent to:
 * // | { readonly _tag: "BadRequest"; readonly status: 400; readonly message: string }
 * // | { readonly _tag: "NotFound"; readonly status: 404 }
 *
 * const { BadRequest, NotFound } = Data.taggedEnum<HttpError>()
 *
 * BadRequest({ status: 400, message: "missing id" })._tag // => "BadRequest"
 * ```
 *
 * @see {@link taggedEnum} — constructors and matchers for a `TaggedEnum`
 * @see {@link TaggedEnum.WithGenerics} — generic tagged enums
 * @see {@link TaggedEnum.Constructor} — the constructor object type
 *
 * @category models
 * @since 2.0.0
 */
````

Why it is exemplary: it connects type shape, runtime companion, invalid author
input, and concrete expansion.

### 6.3 `Data.taggedEnum` constructor kit

Source: `.repos/effect/packages/effect/src/Data.ts:510-552`

````ts
/**
 * Creates constructors and matchers for a `TaggedEnum` type.
 *
 * **When to use**
 *
 * Use when you model a closed union with plain data objects and want
 * construction, tag checks, and exhaustive matching from the same definition.
 *
 * **Details**
 *
 * Returns an object with:
 * - One constructor per variant (keyed by tag name)
 * - `$is(tag)` — returns a type-guard function that checks only the `_tag` field
 * - `$match` — exhaustive pattern matching (data-first or data-last)
 *
 * **Gotchas**
 *
 * - Constructors produce **plain objects**, not class instances.
 * - `$is(tag)` only checks the `_tag` field, not the full structure. It relies
 *   on the tag being globally unique and the value being produced by your
 *   constructors. For untrusted input, validate with the `Schema` module first.
 *
 * **Example** (Creating and matching tagged enum values)
 *
 * ```ts import.meta.vitest
 * import { Data } from "effect"
 *
 * type HttpError = Data.TaggedEnum<{
 *   BadRequest: { readonly message: string }
 *   NotFound: { readonly url: string }
 * }>
 *
 * const { BadRequest, NotFound, $is, $match } = Data.taggedEnum<HttpError>()
 *
 * const err = NotFound({ url: "/missing" })
 *
 * $is("NotFound")(err) // => true
 *
 * $match(err, {
 *   BadRequest: (e) => e.message,
 *   NotFound: (e) => `${e.url} not found`
 * }) // => "/missing not found"
 * ```
````

Why it is exemplary: it is the closest upstream analogue for BSL's descriptor
modules and makes the shallow-guard boundary explicit.

### 6.4 Pipeable combinator

Source: `.repos/effect/packages/effect/src/Option.ts:1061-1089`

````ts
/**
 * Transforms the value inside a `Some` using the provided function, leaving
 * `None` unchanged.
 *
 * **When to use**
 *
 * Use to apply a pure transformation to an `Option`'s present value, especially
 * when chaining transformations in a pipeline.
 *
 * **Details**
 *
 * - `Some` → applies `f` and wraps the result in a new `Some`
 * - `None` → returns `None` unchanged
 *
 * **Example** (Mapping over an Option)
 *
 * ```ts import.meta.vitest
 * import { Option } from "effect"
 *
 * Option.map(Option.some(2), (n) => n * 2) // => Option.some(4)
 * Option.map(Option.none(), (n: number) => n * 2) // => Option.none()
 * ```
 *
 * @see {@link flatMap} when `f` returns an `Option`
 * @see {@link as} to replace the value with a constant
 *
 * @category mapping
 * @since 2.0.0
 */
````

Why it is exemplary: the lead states preserved behavior, Details gives a branch
table, and links help the caller choose.

### 6.5 Type-level utility

Source: `.repos/effect/packages/effect/src/Types.ts:264-291`

````ts
/**
 * Determines if two types are exactly equal at the type level.
 *
 * **When to use**
 *
 * Use to assert type equality in conditional types or type-level tests.
 *
 * **Details**
 *
 * - Uses the `<T>() => T extends X ? 1 : 2` trick for exact equality,
 *   distinguishing between `any`, `unknown`, `never`, and other types.
 * - Resolves to `true` if `X` and `Y` are identical, `false` otherwise.
 *
 * **Example** (Checking type equality)
 *
 * ```ts import.meta.vitest
 * import type { Types } from "effect"
 *
 * type Yes = Types.Equals<{ a: number }, { a: number }> // true
 * type No = Types.Equals<{ a: number }, { a: string }> // false
 * type AnyCheck = Types.Equals<any, string> // false
 * ```
 *
 * @see {@link EqualsWith}
 *
 * @category utility types
 * @since 2.0.0
 */
````

Why it is exemplary: it teaches a non-runtime API without fake execution. BSL
must adapt away from the upstream `any` example because beep's local example law
forbids `any`.

### 6.6 Guard

Source: `.repos/effect/packages/effect/src/Predicate.ts:365-392`

````ts
/**
 * Checks whether a readonly array has exactly `n` elements.
 *
 * **When to use**
 *
 * Use when you need a `Predicate` guard for exact tuple length that narrows
 * `ReadonlyArray<T>` to `TupleOf<N, T>`.
 *
 * **Details**
 *
 * This only checks length, not element types, and returns a refinement on the
 * array type.
 *
 * **Example** (Checking exact length)
 *
 * ```ts import.meta.vitest
 * import { Predicate } from "effect"
 *
 * const isPair = Predicate.isTupleOf(2)
 *
 * isPair([1, 2]) // => true
 * ```
 *
 * @see {@link isTupleOfAtLeast}
 * @see {@link Tuple}
 * @category guards
 * @since 3.3.0
 */
````

Why it is exemplary: it states exactly what is and is not checked.

### 6.7 Error class

Source: `.repos/effect/packages/effect/src/SchemaError.ts:10-41`

````ts
/**
 * Error thrown (or returned as the error channel value) when schema decoding
 * or encoding fails.
 *
 * **Details**
 *
 * The `issue` field contains a structured {@link SchemaIssue.Issue} tree describing
 * every validation failure, including the path to the problematic value and
 * the expected type or constraint. The `message` field renders the issue tree
 * with the default formatter. When input reporting is enabled, the message may
 * include reported input. Other Issue fields and custom annotations or messages
 * are not sanitized.
 *
 * Use {@link isSchemaError} to narrow an unknown value to `SchemaError`.
 *
 * **Example** (Catching a SchemaError)
 *
 * ```ts import.meta.vitest
 * import { Schema } from "effect"
 *
 * try {
 *   Schema.decodeUnknownSync(Schema.Number)("not a number")
 * } catch (err) {
 *   if (Schema.isSchemaError(err)) {
 *     err.message // => "Expected number"
 *   }
 * }
 * ```
 *
 * @category errors
 * @since 4.0.0
 */
````

Why it is exemplary: it interprets fields and demonstrates the caller's
recovery boundary rather than merely constructing an instance.

### 6.8 `Schema.TaggedError` class factory

Source: `.repos/effect/packages/effect/src/Schema.ts:14437-14465`

````ts
/**
 * Defines a schema-backed yieldable error class with an automatically populated
 * `_tag` field.
 *
 * **When to use**
 *
 * Use to define typed errors that are schema validated, yielded in `Effect.gen`,
 * and matched as tagged union members.
 *
 * **Example** (Defining a tagged error class)
 *
 * ```ts import.meta.vitest
 * import { Effect, Schema } from "effect"
 *
 * class NotFound extends Schema.TaggedError<NotFound>()("NotFound", {
 *   id: Schema.Number
 * }) {}
 *
 * const program = Effect.gen(function*() {
 *   yield* new NotFound({ id: 42 })
 * })
 * const error = await Effect.runPromise(Effect.flip(program))
 * error._tag // => "NotFound"
 * error.id // => 42
 * ```
 *
 * @category constructors
 * @since 3.10.0
 */
````

Why it is exemplary: it demonstrates the runtime behavior that makes the class
factory worth choosing: validation, yieldability, and tag access.

## 7. Concrete rubric for the BSL export surface

### 7.1 Mandatory common shape

Every owning public export in the future package should receive:

- one purpose-first lead paragraph;
- one canonical beep `@category`;
- `@since 0.0.0`;
- a titled, public-import-only, compiling Example for runtime values;
- precise prose for pure types, with an Example only when it teaches inference,
  validation, narrowing, or composition;
- described `@see` links when callers must choose among siblings;
- body sections in `When to use -> Details -> Gotchas -> Example(s)` order.

Barrel re-exports are graph edges. Document the owning declaration, while root
and subpath files receive real module headers.

### 7.2 Kind mapping

| BSL export kind | Canonical beep category | Required anatomy | When to use is earned when | Gotchas is earned when |
| --- | --- | --- | --- | --- |
| Pipeable column/meta combinator | the most specific of `mapping`, `filtering`, `constructors`, or `combinators`; default to `combinators` only when no narrower role fits | lead states metadata change and preserved schema; Details gives resulting meta/policy state; Example uses public `@beep/effect-drizzle/pg` or future dialect subpath and shows exact result | callers choose among adjacent forms such as literal vs expression vs explicitly unsafe SQL, serial vs identity, or model vs storage defaults | raw SQL bypasses safety, order matters, prior metadata is overwritten, a guard is shallow, or a type/runtime invariant is not obvious |
| `Data.TaggedEnum` descriptor type | `models` | explain union shape, discriminator, and relation to runtime constructor module; optional type Example | direct descriptor use is a supported authoring or extension seam | variant payload must omit `_tag`, objects are plain, or generated `$is` is tag-only |
| Descriptor constructor/namespace value | `constructors` | enumerate returned constructors/guards/emitters in Details; Example constructs and compiles one descriptor | callers need a descriptor directly rather than a higher-level pipeable combinator | construction validates correlated fields, guard coverage is shallow, or the object is internal/compiler-facing |
| Dialect kit `make` | `factories` | lead states returned vocabulary; Details enumerates Model/Entity/Table/Repository/schema/projector; Example builds a real kit and consumes one returned capability | shared defaults, extras, and dialect binding should be fixed once | default-field collisions, dialect-family isolation, or absent capabilities are represented by missing exports |
| Model factory (`Model`, kit `Entity`) | `factories` | explain schema-backed class result, static `.sql`, validation, and annotation/extras argument; Example defines a small public model and observes statics | caller must choose raw `Model` vs defaults-injected `Entity` | missing `Self` generic, constructor validation, default-field collision, or overloaded annotations/extras can surprise |
| Repository type | `repositories` | explain CRUD surface, required Effect services, error channel, and optimistic update semantics; type Example is optional | the type is named directly in service or port signatures | update semantics differ from ordinary CRUD or version/stale behavior is intentionally collapsed |
| `makeRepository` | `factories` | Example acquires/provides `SqlClient`, runs one operation, and shows a result; link to `Repository` and `VersionConflictError` | a model has the required key/version metadata and callers want generated optimistic CRUD | the return value is an Effect rather than a repository, version is discovered from metadata, or missing and stale rows share an error |
| General type-level projection | `type-level` | precise input/output prose; optional type alias/witness Example | generic library authors consume it directly | distribution, variance, inference, recursion, or performance is non-obvious |
| Type-level validator producing `~effect-drizzle.error` | `validation` | show an accepted reduction and one rejected diagnostic; explain per-key vs whole-model placement | callers or maintainers need to understand where a diagnostic appears | it does not perform runtime validation, errors collapse to `unknown`/`never` in some context, or suppression changes the demonstrated type |
| Runtime guard | `guards` | state narrowing and exact runtime depth; Example starts from `unknown` and shows true/false or narrowed access | values cross a hand-built, external, or suppressed-type boundary | it checks only tag/property/family membership rather than the full descriptor |
| `Schema.TaggedError` class | `errors` | lead names production condition; Details interprets fields; Example constructs with `.make` or `new` and catches/narrows via Effect | callers can receive the error and need to choose recovery behavior | fields deliberately merge cases, messages can contain unsafe input, or construction form/encoding differs from an ordinary class |

### 7.3 Specific editorial decisions

- `When to use` is not a slogan. Add it only where the reader must choose a
  boundary or sibling API. It must begin with `Use to`, `Use when`, `Use as`, or
  `Use with`.
- `Gotchas` is not a second Details section. Add it only for a credible wrong
  mental model or operational hazard.
- Unsafe exports deserve both `When to use` and `Gotchas`; their name alone does
  not explain the trust boundary.
- Public descriptor modules must say whether their guards are full structural
  validation or discriminator-only checks.
- Examples should show decoded values, metadata fields, generated statics,
  executed Effects, or readable inferred types. `console.log(repository)` and
  similar existence proofs do not meet the bar.
- Use described links to connect safe/unsafe pairs, type/runtime companions,
  factory/result pairs, and error/guard pairs.

## 8. Delta from the current round-6/6.5 BSL documentation

The current tree already aligns on titled `Example` sections, canonical section
order where sections exist, zero legacy `@example`/`@remarks`, and uniform
`@since 0.0.0` on its 105 fully tagged blocks. The following items conflict with
the observed bar or with the beep adaptation required to apply it.

1. **Module headers are labels, not module documentation.** All 20 source files
   begin with JSDoc, but the headers are generally one-line summaries and omit
   `@since`. Effect module headers explain scope and shared semantics; 362 of 383
   carry since metadata. The root and `pg` entrypoints are especially thin
   (`scratchpad/bsl/src/index.ts:1`, `scratchpad/bsl/src/pg/index.ts:1`).

2. **Owning-export metadata is incomplete.** The source has 278 syntactic
   exported declarations and 195 JSDoc starts, but only 105 blocks currently
   carry both the category/since discipline counted by the audit. Descriptor
   families in `pg/Column.ts` and dialect-neutral exports in `core/model.ts` are
   representative terse or untagged areas. Overloads and private exports mean
   these raw numbers are not a final public-API denominator, but they prove the
   pass is not complete.

3. **There is no `When to use` section anywhere in BSL.** This is a coverage gap,
   not a grammar violation, because the section is optional upstream. It becomes
   a real quality conflict for choice-heavy APIs such as safe vs unsafe SQL,
   `Model` vs kit `Entity`, identity modes, and repository construction.

4. **Examples expose source topology.** Among 144 Example import statements, 49
   are relative imports, including `../internal/statics.ts`, local source files,
   and `./fixtures.ts`. Effect has zero relative JSDoc imports. Published examples
   must import only `@beep/effect-drizzle`, its public subpaths, Effect public
   entrypoints, Drizzle public entrypoints, and intentionally named test-only
   packages where appropriate.

5. **One Example import is syntactically empty.** `ModelRecord` contains
   `import {  } from "effect/Record"`
   (`scratchpad/bsl/src/pg/schema.ts:95`). This is neither compilable consumer
   guidance nor a useful import.

6. **The observable-result style is inverted.** BSL has 60 `console.log(...)`
   lines and zero `// =>` markers; Effect has 4,723 result markers and only three
   JSDoc `console.log(...)` lines. Console output is not inherently invalid, but
   current examples such as `console.log(repository)`, `console.log(kit.pg.integer)`,
   and `console.log(names)` demonstrate existence rather than behavior.

7. **The fence carrier differs.** All 77 BSL examples use plain `ts`; 3,355 of
   3,357 Effect Examples use `ts import.meta.vitest`. This is an intentional local
   override, not something to “fix” during the documentation pass: beep docgen,
   not Effect's Vitest-in-source harness, is the compiler of record.

8. **Effect import form differs.** BSL examples use 57 named Effect subpath
   imports; stable upstream examples overwhelmingly use named namespaces from
   the root `effect` entrypoint. Round 6.5 explicitly locked the BSL subpath form,
   so this is another intentional override. What must change is private relative
   imports, not the named public Effect subpaths.

9. **One category is outside both useful taxonomies.** `toPgTable` uses
   `@category conversions` (`scratchpad/bsl/src/pg/table.ts:390`). Effect uses
   `converting`, while beep accepts neither spelling. The BSL pass should select
   the semantic beep role, most plausibly `tables`, `projections`, or `mappers`,
   after deciding what callers use the symbol as.

10. **Several current categories describe too generic a role.** `Repository` is
    `models` and `makeRepository` is `constructors`; the beep taxonomy has
    `repositories` and `factories`. `Dialect` is labeled `schemas` even though it
    is a plain guard-bearing object, not an Effect Schema. The pass should classify
    by caller-facing role, not preserve round-6 labels mechanically.

11. **Related APIs have no described `@see` tags.** BSL has zero `@see` tags,
    while Effect uses 3,241. Not every symbol needs one, but safe/unsafe pairs,
    type/value companions, factory/result types, model/kit alternatives, and
    errors/guards do. The existing `@deprecated` on `defaultSql` is correctly
    ordered and links its replacement; it is not a conflict.

12. **Some value Examples do not prove the advertised contract.** Error Examples
    generally print only `_tag`; repository and kit examples print functions or
    Effects without running them; several type examples print a function rather
    than showing its inferred type. The Effect bar is an observable semantic
    result or a legible inferred type, not mere reachability.

## 9. Acceptance checklist for the upcoming pass

- [ ] Every public owning declaration is inventoried by kind; barrels are not
      double-counted.
- [ ] Every module header explains scope and carries the appropriate local
      package metadata.
- [ ] Every block has one useful lead, one canonical beep category, and
      `@since 0.0.0`.
- [ ] Sections are non-empty and ordered `When to use -> Details -> Gotchas ->
      Example(s)`.
- [ ] Every present When-to-use body begins with an observed canonical opener.
- [ ] Every runtime export has a titled, single-fence, compiling, observable
      Example.
- [ ] Pure type exports use type aliases, inferred comments, or typed witnesses;
      they do not fake runtime output.
- [ ] Examples import only public package entrypoints and contain no empty,
      private-relative, fixture-relative, deprecated, assertion-based, `any`, or
      type-assertion shortcuts.
- [ ] Safe/unsafe pairs, type/value companions, factory/result pairs, and
      error/guard pairs have described `@see` links where they improve choice.
- [ ] `When to use` and `Gotchas` are earned by a real decision or hazard, not
      filled mechanically.
- [ ] The pass preserves the package's named Effect subpath style and plain `ts`
      fences while using Effect's section semantics.
- [ ] Bounded docgen and the package's type/test proofs compile every example
      after implementation begins; this research task itself makes no code or
      documentation-source changes.
