# Law presence correction handoff — 2026-09-08

## Source baseline

- Exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- Corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- Correction receipt:
  `goals/boolean-creep/data/sweeps/refresh-2026-09-08-r25-main-9b7553/r25-law-domain-presence-correction1.jsonl`

## Corrected inventory metadata

### `ids-statement-presence-kind`

- Primary: `packages/law-practice/domain/src/entities/IdsSubmissionFact/IdsSubmissionFact.values.ts:331`
- Symbol/members: `IdsStatementFacts` /
  `[statementPresent, statementType]`
- Evidence: E4 at lines 297-307 and 331-336; E1 at lines 315-319 plus
  domain/tables/server fixtures.
- Cardinality: 4 representable presence-bit combinations, 3 legal. The target
  has 4 concrete members because the legal Some arm contains two
  `IdsStatementType` literals.
- Classification: stored, persisted, tagged-union, Tier 2.
- Design: `goals/boolean-creep/designs/ids-statement-presence-kind.md`.

The statement JSONB is encoded by
`tables/src/entities/IdsSubmissionFact/IdsSubmissionFact.converters.ts:47-109`
and read/written by the in-memory and Drizzle repositories. The design keeps
the old flat boolean/null-or-literal object and leaves
`sizeFeeAssertionPresent` independent.

### `citation-blank-page`

- Primary: `packages/law-practice/domain/src/values/Citation/Citation.models.ts:470`
- Symbol/members: `FullCaseCitation` / `[hasBlankPage, page]`
- Evidence: E3 at lines 470-474; E2 at lines 560-568; E1 at
  `LawPracticeDomain.test.ts:571-580,650-674`.
- Cardinality: 4 representable, 3 legal.
- Classification: stored, wire, tagged-union, Tier 2. The receipt's
  internal/Tier-1 classification is incorrect.
- Design: `goals/boolean-creep/designs/citation-blank-page.md`.

False/None is a legitimate default/absent-page case. True/Some violates the
field contract and currently causes the formatter to ignore the page. The
public `FullCaseCitation.Type` and `FullCaseCitation.Encoded` interfaces,
package barrels, and recursive `Citation` codec establish wire exposure even
though no repository persistence adapter was found.

### `pincite-range-endpoints`

- Primary: `packages/law-practice/domain/src/values/PinciteInfo/PinciteInfo.model.ts:187`
- Symbol/members: `PinciteInfo` /
  `[isRange, page, endPage, paragraph, endParagraph]`
- Evidence: E3 at lines 115-122 and 158-210; E1 at lines 134-151.
- Cardinality: 32 representable, 5 legal. The receipt's 8/3 cardinality and
  three-member cluster omit start-locator presence and documented
  page/paragraph exclusivity.
- Classification: stored, wire, tagged-union, Tier 2. The receipt's
  internal/Tier-1 classification is incorrect.
- Design: `goals/boolean-creep/designs/pincite-range-endpoints.md`.

The five legal shapes are no structured locator, page single, page range,
paragraph single, and paragraph range. `starPage`, `footnote`, `footnoteEnd`,
`raw`, and recursive `additionalPincites` remain independent. Public Type and
Encoded interfaces, value barrels, FullCaseCitation/NeutralCitation embeddings,
and the recursive Citation codec establish wire exposure.

## Schema and compatibility proof plan

Repository schema-first guidance requires optional/nullish case bags to decode
into tagged models at compatibility boundaries. Live Effect v4 source at
`.repos/effect/packages/effect/src/Schema.ts:5366-5374` confirms `S.decodeTo`
as the current transformation API. Each design therefore keeps the existing
flat encoded projection and moves only the decoded domain representation to a
LiteralKit-backed tagged union. Existing literals, defaults, optional keys,
numeric values, recursive arrays, database JSONB, and formatting behavior are
preserved.

## Verification

- Targeted whole-repository searches covered every declaration, constructor,
  reader, converter, repository adapter, recursive codec reference, explicit
  Type/Encoded interface, package barrel, and test fixture for the three
  clusters.
- `mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts` was
  run after the designs were written. It reached the global coverage check and
  reported three separately owned missing designs:
  `scheduler-protocol-eviction-mode.md`, `coverage-baseline-write-mode.md`, and
  `yeet-prepared-publish-commit.md`.
- Scoped `git diff --check` covers only the three designs and this handoff.
- No product source, tests, inventory, status, dependency, generated file, or
  git reference was changed.

## Remaining review

Parent inventory admission must use the corrected wire/Tier-2 classifications
and the expanded pincite member/cardinality metadata above. Formal P3 remains
separate.
