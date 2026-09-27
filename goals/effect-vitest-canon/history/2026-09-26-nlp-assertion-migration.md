# NLP assertion migration

Sixteen current assertion findings are replaced across CoreModels, the Handoff
contract, PatternCore and TextVariants. No production source, test registration,
generator domain, property floor, discard budget or timeout changes here.

Three missing-value predicates now use `assertNone`. The retained-token lookup
uses `assertSome` with the existing Ada token; the sentence lookup asserts its
complete retained-token payload `[grace]`. These preserve presence checks and
add meaningful payload checks against fixtures already in the test.

The three mention/entity/chunk linkage comparisons use `assertEquals` on the
same complete Option operands. Their identifier, chunk identifier and span-cut
text relationships remain unchanged.

Eight decoder failures now use `assertExitFailure` against a complete projected
`SchemaError` Cause. Every reason is retained in order; typed errors are mapped
to tags without carrying diagnostic annotations into the comparison. Defect,
interruption and additional typed-failure reasons cannot disappear, and success
remains success. This uses the Cause-preserving projection already checked by
the RDF mixed-cause controls, not the lossy installed `Exit.mapError` behavior.

An inverse AST comparison reverses all sixteen replacements and recovers the
original four test bodies, excluding imports and formatting. Full package
verification passes: audit 7.0 seconds and docgen 3.6 seconds. Formatting and
the staged whitespace check also pass. Private evidence is retained in
`nlp-assertions-receipt.json`, `nlp-assertions-verify.cjs` and
`nlp-assertion-package.log` under the goal evidence directory.

The detector rescan reports zero NLP EV006 findings. Its remaining 86 rows
are 64 EV001, 21 EV007 and one EV011; none of the historical rows or ratchet
baseline entries has been removed at this intermediate step.

The property and runner phases, after timings, historical ledger/baseline
reconciliation and hosted PR gates remain outstanding. Passing this package
check does not establish global goal or inventory completion.
