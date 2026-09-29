# Instance

- id: `r2-foundation-unique-match-search`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/foundation/capability/langextract/src/Alignment/Alignment.behavior.ts:32`
- symbol: `UniqueMatchSearch` / `MinimalFoldMatchSearch`
- members: `ambiguous`, `match`, `exhausted`
- evidence classes:
  - E1 at `Alignment.behavior.ts:50-55` — exact/lesser search writes none,
    unique, or ambiguous and never ambiguous-with-match.
  - E1 at `Alignment.behavior.ts:354-360` — the bounded minimal-fold search
    writes exhausted, ambiguous, unique, or none and never combines them.
  - E2 at `Alignment.behavior.ts:463-483` — the reader short-circuits
    exhaustion and ambiguity before consuming a unique payload.

# Current shape

A private interface combines `ambiguous: boolean` with `Option<MatchedText>`.
`findUniqueMatch`, `findExact`, and `findLesser` construct it. Moving `main`
added `MinimalFoldMatchSearch`, which extends the same shape with an
`exhausted: boolean`; `findMinimalFold` and `bestAlignedMatch` now probe all
three fields separately.

# Cardinality gap

The base pair has four structural combinations for three search outcomes. The
minimal-fold extension has eight combinations for four legal outcomes: no
match, exactly one match, ambiguity, or transition-budget exhaustion.
`ambiguous + Some(match)` and every combination of `exhausted` with ambiguity
or a present match are never written and have no reader meaning.

# Target schema

First run `bun run beep architecture` because the cycle-free implementation
adds a schema role file. Create an unbarrelled schema leaf
`Alignment.search.model.ts`. Move the existing public `MatchedText` schema/type
owner from `Alignment.model.ts` into that leaf. Define shared named `none`,
`unique({ match })`, `ambiguous`, and `exhausted` schema classes beside it.
One named four-value `LiteralKit` owns the kinds; derive the three-value base
kind with `omitOptions(["exhausted"])`. `UniqueMatchSearch` unions the first
three shared cases, while `MinimalFoldMatchSearch` adds exhausted. Both use
`S.toTaggedUnion("kind")`; only unique carries canonical `MatchedText`. Do not
duplicate the three common cases or their literals.

`Alignment.model.ts` imports `MatchedText` from the leaf for its own schema
definitions and explicitly re-exports only `MatchedText`, preserving the
supported public API. `Alignment.behavior.ts` value-imports `MatchedText` and
the two search unions directly from the leaf. `Alignment/index.ts` continues
to export `Alignment.model.ts` but does not export the leaf, so the search
unions are module-internal exports needed by behavior and their decoded tags do
not enter the package barrel. This removes the existing model -> behavior
cycle from the search schema path: the leaf imports neither module.

The mid-scan merge helper does not return either final search domain. Keep only
the distinct file-local payload-free `MinimalFoldMergeControl` domain in
`Alignment.behavior.ts`, with `continue`, `ambiguous`, and `exhausted`. Add the
file's `$LangExtractId` composer and annotated `LiteralKit` owner rather than an
untyped string union. `continue` means the accumulator may currently contain
zero or one match and scanning must proceed. `ambiguous` wins as soon as a
second match is accumulated; otherwise a start-search budget failure returns
`exhausted`. This keeps provisional control flow separate from the final
semantic result.

Both search models and the merge control are internal and derived, so no
compatibility codec or package-barrel alias is needed. `MatchedText` alone
retains its current public schema/type export.

# Migration inventory

- `Alignment.search.model.ts` (new; architecture-approved role) — own the
  existing `MatchedText` schema/type and the module-internal exported
  shared cases plus `UniqueMatchSearch` and `MinimalFoldMatchSearch` tagged unions. Create an
  identity composer for this leaf, annotate every schema, and import neither
  `Alignment.model.ts` nor `Alignment.behavior.ts`.
- `Alignment.model.ts:8-20,55-94` — import `MatchedText` from the new leaf,
  remove the old local owner, and explicitly re-export only `MatchedText` so
  the current package API remains stable while search tags stay unbarrelled.
- `Alignment.behavior.ts:8-20,32-37` — value-import `MatchedText` and both
  search unions from the new leaf; replace the base interface and `noMatch`
  object with `UniqueMatchSearch.cases.none.make()`.
- `Alignment.behavior.ts:39-56` — return `none`, `unique({ match })`, or
  `ambiguous` from `findUniqueMatch`.
- `Alignment.behavior.ts:79-80` and `:237-242` — keep exact/lesser delegation
  but update their constructors and return subset.
- `Alignment.behavior.ts:114-116` — delete the extending boolean interface and
  use the leaf-owned four-case `MinimalFoldMatchSearch` tagged union.
- `Alignment.behavior.ts:327-336` — make `mergeMinimalFoldStartMatches` return
  only the behavior-local annotated `MinimalFoldMergeControl`: `ambiguous` after a second accumulated
  match, otherwise `exhausted` when the start search exhausted its budget, and
  `continue` when the outer scan must proceed.
- `Alignment.behavior.ts:338-360` — exhaustively match the merge-control value;
  keep scanning on `continue`, return final `ambiguous` or `exhausted` on
  those controls, and after the loop return final `unique` or `none` from the
  accumulator.
- `Alignment.behavior.ts:458-489` — implement the following exhaustive
  precedence table without treating exact/lesser ambiguity as terminal:
  1. minimal-fold `exhausted` or `ambiguous` returns no aligned match;
  2. otherwise exact `unique` wins;
  3. otherwise lesser `unique` wins, whether exact was `none` or `ambiguous`;
  4. otherwise minimal-fold `unique` wins;
  5. otherwise fall through to fuzzy matching.
  Exact or lesser `ambiguous` drops only that tier. Minimal-fold ambiguity and
  exhaustion retain the current fail-closed behavior for the candidate.
- `Alignment/index.ts:21` — continue exporting `Alignment.model.ts`; do not add
  an export for `Alignment.search.model.ts` or the internal search domains.
- `packages/foundation/capability/langextract/test/Alignment.test.ts` — retain observable alignment coverage and add cases for none, unique, and ambiguous behavior through the public alignment entrypoint.
- `Alignment.test.ts:88-203,239-268,296-330` — preserve Unicode UTF-16 span
  recovery, optional-hyphen ambiguity, shared transition-budget exhaustion,
  fuzzy suppression, code-point scoring, and schema-derived span bounds.

# Guard-deletion accounting

Delete the `minimalFold.exhausted` and `minimalFold.ambiguous` guards and all
`O.isSome(search.match)`/`.value` reads. Exhaustive matching owns payload
access, so no branch can read a match from none, ambiguous, or exhausted.
Delete the two-boolean `Pick<MinimalFoldMatchSearch, ...>` merge-helper return;
its three-case control value cannot be confused with a completed search.

# Encoded-side impact

None. The search unions are not exported by the package barrel and are never
persisted or encoded. Moving `MatchedText` to the cycle-free leaf preserves its
existing public export through `Alignment.model.ts`.

# Test impact

Retain current exact, case-folded, minimal-fold, fuzzy, duplicate-match, and
transition-ceiling tests. Add or strengthen public-behavior cases proving all
rows of the precedence table: exact unique wins; exact ambiguity permits a
lesser unique; exact and lesser ambiguity permit a minimal-fold unique;
minimal-fold ambiguity suppresses fallback to an arbitrary match;
minimal-fold exhaustion suppresses exact/lesser/fuzzy fallback for the current
candidate and remaining batch; a unique match preserves its span; and final
none reaches fuzzy fallback. Add focused helper-level coverage for
`continue`, `ambiguous`, and `exhausted` if the helper is exposed through the
package's supported test surface.

# Risk & sequencing

Tier 1C. The old `Alignment.model.ts` -> `Alignment.behavior.ts` value import
means behavior must not import a runtime `MatchedText` schema back from model.
The unbarrelled leaf is the sole owner that both modules may import. Preserve
the existing precedence rules: exact and lesser ambiguity
drop only their own tier, while minimal-fold ambiguity and transition-budget
exhaustion suppress the candidate before exact/lesser/fuzzy selection. One
budget remains shared across a batch. Run full `@beep/langextract` package
verification.
