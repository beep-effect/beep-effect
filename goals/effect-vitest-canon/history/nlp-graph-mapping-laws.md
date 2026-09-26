# NLP graph payload and topology laws

The existing mapEdges fixture now checks every endpoint and doubled payload
(2, 4, 6). The bimap fixture checks all four mapped nodes plus the exact
endpoint/string-payload records. All previous assertions remain.

A new public property runs 100 generated cases. It constructs a chain from
schema-derived string/integer pairs, including empty arrays and up to twenty
nodes, then verifies mapEdges and bimap preserve every endpoint and transform
every payload. Expected node values derive from the input entries; expected
edge records derive from the original graph. This complements the existing
branching fixture without claiming arbitrary graph-topology coverage.

The first package audit found the new nested graph walker expression violated
the compiler's missedPipeableOpportunity check. Using the equivalent pipe form
repaired it. Full package verification then passed: audit 7.4 seconds and
docgen 3.7 seconds. No production source or test budget was changed.
