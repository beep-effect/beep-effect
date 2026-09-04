# Instance

- id: `html-dl-child-grammar`
- file:line: `packages/foundation/modeling/html/src/Html.conformance.ts:1787`
- symbol: `inspectElementOrder.description-list`
- members: `direct`, `wrapped`
- evidence: E1 at `Html.conformance.ts:1787-1814` — both values are derived
  from one child sequence; direct requires top-level dt/dd groups while wrapped
  requires every non-script element child to be a grouping div, so combined
  true is never written.

# Current shape

The description-list branch derives two mutually exclusive grammar booleans
and separately checks the empty sequence. The valid cases are an empty list,
complete top-level dt+/dd+ groups, or complete groups inside div wrappers;
everything else is invalid.

# Cardinality gap

Four boolean pairs are representable but only three pairs are reachable:
direct-only, wrapped-only, and neither. The neither pair currently collapses
the semantically distinct empty and invalid cases and needs the separate length
guard.

# Target schema

Define a private named `DescriptionListChildGrammar` LiteralKit with `empty`,
`direct`, `wrapped`, and `invalid`. Derive it once from `sequenceTags`,
`elementChildren`, and the existing nested-child checks, then match the literal
to accept the first three cases while preserving the independent
`significantText` rejection. Do not introduce stored state.

# Migration inventory

- `Html.conformance.ts` imports and the description-sequence constants — add
  the private LiteralKit owner adjacent to the existing regular expressions.
- `Html.conformance.ts:1786-1817` — move the current wrapped predicate into the
  classifier, absorb the separate empty-sequence branch, and replace the two
  booleans plus OR with one exhaustive literal decision.
- Preserve `isDescriptionGroup`, `isDescriptionGroups`, script-supporting
  filtering, nested foreign/text/element rejection, and the separate
  significant-text check without changing their order or messages.
- `Html.conformance-hardening.test.ts:495-510` and
  `Html.coverage-matrix.test.ts:119-150` — migrate/extend exact empty, direct,
  wrapped, and invalid fixtures, including multiple groups and invalid nested
  children.
- Whole-source and package-barrel search found no consumer of these private
  locals; no public export or compatibility layer is required.

# Guard-deletion accounting

Delete `direct`, `wrapped`, their correlated OR, and the separate
`sequenceTags.length === 0` grammar guard. One derived literal names all four
semantic cases; `significantText` remains an independent content fact.

# Encoded-side impact

None. This is private pure conformance logic. Public AST schemas, generated
HTML models, issue encodings, accepted grammar, issue path/rule/message, and
serialization behavior remain unchanged.

# Test impact

Table-test empty lists, one and multiple direct dt+/dd+ groups, one and multiple
wrapped div groups, script-supporting nodes, inter-element whitespace/comments,
significant text, foreign nodes, non-div wrappers, and incomplete/mixed groups.
Keep tests importing through `@beep/html`. Run focused conformance suites and
full `@beep/html` package verification; add a patch changeset unless explicitly
ignored.

# Risk and sequencing

Land in Tier 1C atomically with the select classifier because both touch
`inspectElementOrder`. The principal risk is conflating empty with invalid or
allowing mixed direct/wrapped children; the literal classifier and table tests
must preserve those distinctions exactly. The table-reference traversal
refactor earlier in this file is orthogonal and must remain unchanged.
