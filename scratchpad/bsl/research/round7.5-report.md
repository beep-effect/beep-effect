# BSL Round 7.5 Report — Public Documentation Grammar

Date: 2026-08-10  
Scope: `scratchpad/bsl/**` only  
Commit: none

## Outcome

Round 7.5 documents every exported symbol reachable from `src/index.ts`,
`src/pg/index.ts`, and `src/sqlite/index.ts` using the measured Effect grammar.
The pass changes documentation comments and the README only. It does not change
runtime tokens, type signatures, tests, or fixture directives.

The three entrypoint headers and every `src/core/*.ts` header now state the
problem space instead of enumerating exports. Public symbol documentation uses
precise leads, earned `When to use`, `Details`, and `Gotchas` sections, titled
Examples last, canonical categories, genuine navigation links, and
`@since 0.0.0`.

## Coverage census

The census follows aliases from all three entrypoints to their owning
declarations and recursively expands the two public `Table` namespaces. A
merged type/value declaration is counted once at its owner.

| Measure | Count |
|---|---:|
| Unique public owning declarations | 145 |
| Owners with runtime declarations | 94 |
| Pure-type owners | 51 |
| Shared/root-owned | 19 |
| PostgreSQL-owned | 71 |
| SQLite-owned | 55 |
| Non-empty leads | 145 |
| `@category` | 145 |
| `@since` | 145 |
| Titled Examples | 145 |
| `// =>` result markers | 158 |

All 94 runtime-owning symbols have an Example. Type-level symbols also retain an
Example where an alias result, inference result, or readable rejection teaches
the contract. The final consumer-example compilation covered all 145 Examples
and produced zero diagnostics.

### Earned sections

| Section | Public owners | Inclusion rule |
|---|---:|---|
| `When to use` | 64 | Added only when the caller chooses between adjacent APIs, modes, dialect postures, or safety levels. |
| `Details` | 75 | Added when derivation, validation, assembly ordering, variant membership, metadata, or repository mechanics affect the result. |
| `Gotchas` | 46 | Added only for demonstrated misuse boundaries such as raw SQL, version locators, dual clocks, enum duplication, array absence, descriptor-family smuggling, or identity posture. |

The source-wide grammar audit also includes internal documentation and reports
64 `When to use`, 78 `Details`, and 47 `Gotchas` sections across 306 JSDoc
blocks. Internals kept the lighter bar: terse correct leads remained, while 19
internal-only Examples that exposed source topology were removed instead of
being padded into public documentation.

## Example conversion and import topology

The conventions report measured 60 public `console.log(...)` lines and zero
`// =>` markers. The complete pre-pass source contained another 26 console
calls in the 19 internal-only Examples. The pass therefore:

- rewrote all 60 public console examples as expressions with observable
  `// =>` results;
- removed the 19 internal-only Examples, including their 26 console calls;
- converted the README's three console calls to the same result style;
- finishes with zero JSDoc `console.log`, 158 JSDoc result markers, and no
  Example without a result marker.

All Example imports now use future public package entrypoints, named Effect
subpath imports, Drizzle public entrypoints, or the public PGlite test layer.
There are zero relative JSDoc imports, empty imports, internal imports,
namespace Effect imports, or declarations used as stand-ins for results.

Core JSDoc formats future `@beep/*` module specifiers on the line after `from`.
After JSDoc extraction this is ordinary valid TypeScript and compiled as such;
in raw source it also prevents the intentionally simple import-boundary regex
from mistaking documentation text for a core runtime dependency. The focused
boundary suite passes without changing its implementation.

## Line-leading `@` sweep

The bare line-leading `@beep/effect-drizzle` prose in `src/pg/model.ts` was
reworded. The final `^\s*\* @` sweep across source and tests contains only the
real-tag whitelist:

| Tag | Count |
|---|---:|
| `@category` | 194 |
| `@deprecated` | 2 |
| `@packageDocumentation` | 3 |
| `@see` | 35 |
| `@since` | 217 |

No other line-leading `@` prose remains. Legacy `@example`, `@remarks`,
`@module`, and `@template` tags are absent.

## README cross-check

The README still matches the documented surface. Its example now uses named
`effect/Schema` imports and expression/result comments, while preserving the
same root, PostgreSQL subpath, kit, model, table, schema, and repository claims.

## Ambiguities resolved

1. “Each core file” was applied literally to every `src/core/*.ts` module
   header. Public dialect-owning modules received the same problem-space header
   treatment where their existing header was only a label.
2. Re-export aliases were documented at the owning declaration rather than
   duplicating JSDoc on barrel re-exports. Merged type/value companions share
   one public grammar.
3. `Dialect` and `Variant` have internal value companions but are type-only at
   the root entrypoint. Their public Examples therefore use type-only imports
   and inferred aliases rather than advertising unreachable runtime values.
4. The lighter internal-symbol rule won over mechanically preserving Examples:
   internal Examples with relative/source imports were removed, while their
   already-correct terse leads and tags were retained.
5. The core documentation/import-boundary interaction was resolved with valid
   multiline public imports, as described above, rather than changing code or
   weakening the boundary proof.

## Zero-behavior-change invariant

TypeScript's parser and comment-free printer normalized each changed source
file at `HEAD` and in the working tree. All 25 changed `.ts` files were
identical after comments were removed:

```text
TS_FILES_CHECKED=25
NON_COMMENT_DIFF_FILES=0
```

The round implementation consists of 25 tracked TypeScript documentation
files, `scratchpad/bsl/README.md`, and this new report. The pre-existing
untracked `round7.5-brief.md` remains untouched. No test file or path outside
`scratchpad/bsl/**` changed. `git diff --check -- scratchpad/bsl` is clean.

## Proofs

Required proof commands ran with unmasked exit codes:

```text
./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false
exit 0

bun test scratchpad/bsl/
56 pass, 0 fail, 241 expect() calls
exit 0
```

Additional proof receipts:

- focused import boundary: 2 pass, 0 fail, exit 0;
- negative fixtures: 74 in `test/fixtures.ts` plus 4 in
  `test/sqlite-fixtures.ts`, total 78 unchanged;
- AST assertion census across source and tests: 0 `as`, angle-bracket type
  assertions, `satisfies`, and non-null assertions;
- public export audit: 145 owners, zero missing lead/category/since/value
  Example requirements;
- source grammar audit: 145 Examples, 158 result markers, zero console calls,
  relative imports, declarations, missing results, syntax errors, or grammar
  errors;
- future-entrypoint consumer compile: 145 Examples, 0 diagnostics;
- no commit was created.

`bun run docgen:local` was also attempted. Its planner exited before running
docgen because the branch's global `bun.lock` delta requires the full repo-wide
`--full` lane. That broader generated-doc mutation is outside this round's
`scratchpad/bsl/**` scope; it is not one of the brief's required proofs.

## Post-review notes (Fable)

Independent re-verification: tsgo exit 0, 56/56 tests / 241 assertions unchanged,
78 negatives unchanged, census clean. The comments-only invariant was verified
mechanically — every changed src/test line in the diff is comment-shaped; the
non-comment diff is empty. Line-leading `@beep` occurrences: zero. Section
census confirmed (64 When-to-use / 47 Gotchas / 158 `// =>` / zero console.log
in src). The varchar block was sampled against the conventions rubric and meets
the bar. The example consumer-compile (145/145, zero diagnostics) exceeds the
brief and pre-answers a graduation-agenda item. No reviewer changes were needed.
