<!-- seat: grok-4.7 medium (third seat; Fable and cursor Opus quota exhausted, 2026-10-09) -->
I'll review the github-references port as a separate read-only seat, starting from the round-2 inventory, the port ledger, and the binding decisions so I don't re-raise closed items.The round-2 numeric and property fixes are in the tree. Next I’ll check the keyword types and run a read-only differential against the pinned oracle.### fable-3-1
- file: scratchpad/effected/github-references/ClosingList.ts:183
- class: schema   severity: required
- standard: effect-laws-v1.md law 20 and law 17; schema-first-development-prompt.md "Precision carries invariants" and "Finite variants are discriminated"; effect-first-development.md EF-13 and EF-35; D5/D11. Section 14 allows this because the cause is `law:20`, the same class of law-forced tightening as the recorded natural-number deviation.
- evidence: `ReferenceList` is a struct of `keyword: ListKeyword`, `closing: S.Boolean`, and `issueNumbers: S.NonEmptyArray(S.Natural)` (ClosingList.ts:179–186). `HarvestedReferenceList` copies those fields (ClosingList.ts:530–536). Nothing relates the flag to the keyword. `parseReferenceList` sets `closing` only from `R.has(CLOSING_KEYWORD_BY_NAME, keyword.value)` (ClosingList.ts:343), and `harvestReferenceLists` does the same (ClosingList.ts:659). `S.is(ReferenceList)` therefore accepts `{ keyword: "refs", closing: true, issueNumbers: [1] }` and `{ keyword: "fixes", closing: false, issueNumbers: [1] }`. `Arbitrary.schema(ReferenceList)` in scratchpad/test/github-references/ClosingList.property.test.ts:69 round-trips those pairs. ClosingList.test.ts:174–190 checks a consistent pair and a string flag, and does not reject the crossed pairs.
- failure: The public list schemas and their derived types accept closing flags the parsers never produce, so schema checks and the property floor certify impossible results. `closing: true` does not narrow `keyword` to `ClosingKeyword`.
- fix: Constrain both schemas with one shared check (or a two-member union, if `HarvestedReferenceList.fields` can still share the keyword, closing, and issueNumbers schemas) so `closing` is true exactly when `keyword` is a `ClosingKeyword`. Reject the two crossed pairs in ClosingList.test.ts beside the existing schema cases. Leave parser output, order, and offsets unchanged, and record the tightening through the central deviation codemod.

### fable-3-2
- file: scratchpad/test/github-references/KeywordFamily.property.test.ts:25
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md §11.4. The property claims to preserve the keyword stem. `KeywordFamily.test.ts:24–47` already pins the twelve-row table, so this does not hide a wrong projection in the suite.
- evidence: The property asserts `keyword.startsWith(family)` after `keywordFamily`. Every `resolve` / `resolves` / `resolved` string also starts with `ref`. A table that mapped that whole conjugation to `"ref"` would keep `keywordFamily(family) === family` and `startsWith`, and this property would stay green.
- failure: The stem property does not separate the `resolve` family from the `ref` family.
- fix: Assert each generated keyword against the explicit twelve-row family table, or assert that `family` is the longest of `close`, `fix`, `resolve`, and `ref` that is a prefix of the keyword.

REQUIRED: 1
BACKLOG: 1
