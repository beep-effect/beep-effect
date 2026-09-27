# Ontology domain session oracle proof

The two saved test files use pure session values, RDF terms and error equivalence.
They own no external resource or clock. No property generator or run floor is
changed. Seven Boolean assertions use public Effect utilities; AST conservation
retains all 19 original assertions and eight registrations.

The saved L-PROP-04 finding identified count-only delta checks. The original
added, removed and remaining counts remain. New serialized-quad comparisons
require the added knows quad, removed name quad and remaining knows quad.

The removal test now seeds all four unrelated partitions with distinct quads
and asserts they are nonempty before removal. It compares their full serialized
quad lists after removing the asserted knows quad, and verifies the remaining
asserted quad is the original name quad.

Three independent controls establish sensitivity: swapping added/removed deltas,
ignoring the requested session changes, and clearing other partitions during an
asserted update each pass all seven original session tests but fail one strengthened
test. Production source and test bytes are restored after every control. The
normal suite passes all eight cases. No production repair is retained.

Both files use instrumented runner registrations. The runner workspace dependency,
generated references and owned cache edges are reviewed without promoting cache
qualification. Error-equivalence true and false expectations remain unchanged.
