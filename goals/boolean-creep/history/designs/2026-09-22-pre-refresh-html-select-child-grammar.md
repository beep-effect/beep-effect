# Instance

- id: `html-select-child-grammar`
- exact source SHA: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source SHA: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/foundation/modeling/html/src/Html.conformance.ts:1916`
- symbol: `inspectElementOrder.select`
- members: `traditional`, `customizable`
- evidence: E1 at `Html.conformance.ts:1916-1922` — both values are derived
  from one `sequenceTags` input; the traditional predicate admits only
  option/optgroup/hr while customizable requires a leading button, so the
  writer cannot produce combined true.

# Current shape

The select child-grammar branch independently derives `traditional` and
`customizable`, then accepts their disjunction. Both false means an invalid
mix; both true is structurally impossible because the leading button required
by the customizable grammar is forbidden by the traditional grammar.

# Cardinality gap

Four boolean pairs are representable and three grammar classifications are
legal: `traditional`, `customizable`, and `invalid`.

# Target schema

Define a private named `SelectChildGrammar` LiteralKit with `traditional`,
`customizable`, and `invalid`. Derive it locally from `sequenceTags`, checking
traditional first so empty and script-supporting-only sequences remain
traditional, then customizable, then invalid. Match the literal to accept the
two valid cases. Invalid retains the parent path, `elementOrder`, and exact
message `<select> must use either the traditional or customizable-select child grammar`.
Do not store the classification or add a generic grammar classifier.

# Migration inventory

- `Html.conformance.ts` imports — reuse the package's existing `@beep/schema`
  dependency and add the narrow named LiteralKit beside other conformance
  classifiers.
- `Html.conformance.ts:1725-1726` — place the private grammar owner next to the
  sequence grammar definitions used by `inspectElementOrder`.
- `Html.conformance.ts:1915-1926` — replace both booleans and their OR with one
  exhaustive classification and literal match; retain the exact issue path,
  rule, and message.
- `Html.conformance.ts:2153-2169` — no edit; content-model diagnostics remain
  earlier than element-order diagnostics in the global issue sequence.
- `Html.coverage-matrix.test.ts:154-192` and all select-order fixtures — retain
  traditional, customizable, and invalid coverage and add an explicit empty
  and mixed-grammar table if not already direct.
- Whole-source and package-barrel search found no consumer of these private
  locals; no public export or compatibility owner is required.

# Guard-deletion accounting

Delete the sibling `traditional` and `customizable` booleans, their correlated
OR, and the unnameable combined-true representation. One literal classifier
becomes the only source consumed by the validity branch.

# Encoded-side impact

None. The state is private and derived during pure HTML AST conformance. Public
AST schemas, WHATWG attribute encodings, issue paths/rules/messages, and
accepted/rejected trees remain unchanged.

# Test impact

Table-test empty and ordinary traditional select children, each legal
customizable follower, invalid leading/mixed children, script-supporting
children, significant text, and foreign nodes. Keep tests importing through
`@beep/html`. Run focused conformance suites and full `@beep/html` package
verification; add a patch changeset unless the package is explicitly ignored.

# Risk and sequencing

Land in Tier 1C with the description-list classifier because both edit the
same private order-inspection branch. Preserve current conformance precedence,
especially that an empty sequence is traditional rather than invalid, and do
not expand the campaign into generated HTML model or WHATWG grammar changes.
The table-reference traversal refactor earlier in this file is orthogonal and
must remain unchanged.
