# Instance

- id: `html-select-child-grammar`
- exact source SHA: `f137beedb270a071d4aa2ecc1dd52a9d233044d1`
- file:line: `packages/foundation/modeling/html/src/Html.conformance.ts:1923`
- symbol: `inspectElementOrder.select`
- members: `traditional`, `customizable`
- evidence: E1 at `Html.conformance.ts:1923-1929`; both predicates derive from the same sequence and cannot simultaneously hold.
- disposition: retain designed, derived/internal, LiteralKit target, Tier1. This is P2 owner work, not independent P3 or census credit.

# Current shape and full owner

This package validates already-constructed HTML ASTs; it does not tokenize or repair source like a browser parser (file header3-5). `inspectElementOrder` first keeps only HTML-tag children at1743-1753 and removes script/template via `isScriptSupporting` at1651 and1754. The select branch1922-1933 consumes only that `sequenceTags` projection.

`traditional` means every projected child is option, optgroup or hr. `customizable` means the first projected child is button and every later projected child is option, optgroup, hr or div. `traditional || customizable` accepts, otherwise one parent-level elementOrder issue is returned.

Do not substitute significantChildren or significantText. Those broader views are used by other grammar branches and would change select diagnostics. Text, comments and foreign nodes are absent from sequenceTags; script/template are also absent. Significant text and foreign content can separately fail inspectChildModel even when select order is traditional/customizable.

# Cardinality gap

Exactly4 boolean pairs are representable and3 are produced:

| Pair | Grammar | Witness projected sequence |
| --- | --- | --- |
| true,false | traditional | empty or option |
| false,true | customizable | button alone, or button then div |
| false,false | invalid | div alone, or option then button |
| true,true | impossible | customizable requires a leading button, forbidden by traditional |

This is a complete logical proof over arbitrary sequence lengths, not an inference from bounded enumeration. Payload-free grammar outcomes need a literal domain, not a tagged payload union. SequenceTags is already the complete input for these two predicates; surface diagnostics are outside this owner and remain unchanged.

# Target schema and derivation

Add a private `SelectChildGrammar = LiteralKit(["traditional", "customizable", "invalid"])` next to the private sequence grammar definitions around1732. Reuse the existing @beep/schema import (currently SchemaUtils at14); do not export a new public model, create a new role file, or introduce a generic grammar framework. No existing matching classifier was found: HtmlChildGrammar at Html.meta.ts343 names grammar profiles such as select, not the result of checking one child sequence.

Derive one literal locally inside the existing select branch. Check the traditional predicate first, then the unchanged customizable predicate, then invalid. Use Match.value(sequenceTags) with predicate arms or an equivalently concise Effect helper expression. Return SelectChildGrammar.Enum values; consume the result with SelectChildGrammar.$match. Both valid branches use A.emptyReadonly; invalid calls the existing issue closure with the unchanged message. Never persist state or retain the two named booleans alongside the literal.

Keep the private LiteralKit unannotated when using its helpers directly. If local schema annotation is required at apply time, retain the base and use the existing SchemaUtils.withLiteralKitStatics(base) after annotation for Enum/$match; do not assume all custom methods survive a rebuilding annotation. No mapMembers or tagged-union construction is needed for this owner.

# Migration inventory

- Html.conformance.ts14: add LiteralKit to the existing @beep/schema import. Coordinate this shared import with the description-list and datalist owners.
- Html.conformance.ts1732-1733: place the named private literal near the grammar owners; retain existing regexes and all neighboring predicates.
- Html.conformance.ts1922-1933: replace the pair and OR with the derived literal and exhaustive literal match.
- Html.conformance.ts1743-1768: preserve element/sequence projection and issue closure exactly.
- Html.conformance.ts1682-1730 and2174-2175: no changes to content checks or their order before select order diagnostics.
- Html.conformance.ts2177-2181: retain descendant traversal after all local issues, including contextual button checks.
- Html.coverage-matrix.test.ts179-189: preserve existing legal customizable-follower and invalid span fixtures; expand with explicit matrix below.
- Html.form-control.test.ts105-118: preserve nested button submit-attribute behavior under select.
- Html.conformance.ts2201-2243, src/index.ts69,90-91 and package.json50: existing public inspectConformance entry/export routes remain unchanged. Locals have no public consumer; callers closure leads through inspectChild to inspectConformance and broader conformance/serialization tests, with no separate writer of these flags.

# Guard-deletion accounting

Delete both sibling boolean declarations and the correlated `traditional || customizable` check. The single literal becomes the only state consumed by the order decision; combined true is no longer representable. Retain the actual two grammar predicates as classification rules. There is no pre-existing contradictory-state rejection guard or legacy normalizer to claim as deleted. The invalid-case diagnostic remains required validation, not redundant defensive code.

# Encoded-side impact

None. This state is private derived computation, with no codec, persistence, public input or output field. Preserve AST schemas, generated metadata, accepted/rejected ASTs, encoded attributes, public conformance behavior and issue path/rule/message arrays. The select issue remains exactly:

`<select> must use either the traditional or customizable-select child grammar`

Its rule is elementOrder and its path is the parent path. Do not move it into child-content validation. For button/span, the child contentModel issue precedes the parent elementOrder issue. For significant text/foreign-only children, emit the contentModel issue without introducing a select elementOrder issue. Nested selects must retain their full parent path, not a hard-coded empty path.

# Test impact and bounded evidence

Keep tests importing @beep/html aliases. Add a focused table covering empty, option/optgroup/hr-only, button-alone, each valid customizable follower, div-first, second button, misplaced button, unsupported span, script/template before and between grammar elements, whitespace/comments, significant text and foreign nodes. Assert full ordered issue arrays for invalid children, not only hasRule booleans. Include a nested select to prove path preservation and retain existing contextual-button fixture.

Private probe.ts ran against the actual public inspectConformance with21 AST cases. It also compared old-predicate acceptance with the proposed literal derivation across all9,331 sequences of length0..5 over option/optgroup/hr/button/div/span. Three pair states occurred and acceptance agreed in every bounded case. The public fixtures captured diagnostic rule/path/message order in probe.stdout.json. Both checks exited0; this is bounded pre-implementation evidence, not exhaustive arbitrary-tree validation, compiled implementation proof or package verification. The unbounded cardinality argument is above.

At implementation run the focused conformance/coverage/form-control suites, then full `bun run beep quality package-verify @beep/html`. Determine changeset requirements from the applicable implementation/release policy; absence from the ignore list alone does not establish a patch requirement for this private package. No gesture UI changes occur and browser interaction evidence is not needed for this pure AST-state migration.

# Risk and sequencing

Coordinate select, description-list and datalist changes in Tier1C; they share one source file but retain separate domain classifiers. Preserve all existing metadata/content rules and the table/reference traversal. This proposal does not change WHATWG grammar interpretation or fold unrelated helpers together. GATE2 still precedes implementation.
