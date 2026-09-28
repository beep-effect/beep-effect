# USPTO response byte-budget repair

This production repair follows the standing authorization recorded in DECISIONS.md.
The saved L-PROP-02 finding reproduced against current source with 200 valid
documents and the original 8,000-byte budget. Twenty-character Unicode identifiers
produced a minimal inline response of 13,779 UTF-8 bytes: its envelope alone was
13,733 bytes, while the estimator reported 5,733 JavaScript string units.

A separate ASCII control isolated the wrapper error. An envelope of exactly
5,733 bytes was accepted at that limit, although the complete inline response
was 5,779 bytes. Thus fixing Unicode alone would still violate the response
budget at a boundary.

The shared estimator now encodes compact JSON through the existing schema codec
and measures its UTF-8 bytes. The synchronous number-returning API remains;
non-serializable inputs throw a schema error at this boundary. Its ASCII example
is corrected from eight bytes to seven for `{ a: 1 }`. USPTO measures each complete
inline candidate before choosing its tier, and records the complete minimal
inline size in the fetchable handle's size metadata.

The original 200-document ASCII test, 8,000-byte limit, named-tier assertions,
credential-gate behavior and schema laws remain. New fixtures alter only document
identifiers, preserving 200 rows, metadata and download URLs. A short Unicode case
fits a named inline tier; a larger Unicode case must produce a fetchable handle.
Both tool responses have an independent TextEncoder byte oracle. An exact ASCII
boundary test accepts the complete minimal response at its byte length and
rejects inline output one byte below it. Shared estimator cases include ASCII,
BMP text, astral characters, combining marks, escaped lone surrogates and an object.

Three independent original-source controls fail with assertion errors: the
shared estimator vectors, the large Unicode outcome and the ASCII wrapper
boundary. All repaired files are restored after each control. Full MCP-kit
package audit/docgen pass (10.0/3.1 seconds), and full USPTO package audit/docgen
pass at the 400-case floor with seed 20260708. Root policy checks pass after
hoisting the new known JSON codec compilation out of the test body.

All 15 native law inversions fail with seed replay and shrinking. The seven
decode-to-self laws preserve their 50-case floors and schema-equivalence
predicates; eight encode/decode laws preserve their 20-case floors and exact
Equal predicates. Final timing and inventory reconciliation remain pending;
this package proof is not consolidated PR or goal acceptance.
