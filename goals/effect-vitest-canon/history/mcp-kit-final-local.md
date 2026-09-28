# MCP kit original-cohort local reconciliation

This wave covers the seven files in the existing inventory. It does not claim
complete current package coverage. Nine property registrations were already
migrated by PR #1200 with 50-case floors; their nine historical detector and
observability rows credit that actual landed commit.

The detector ledger retains the union of 14 historical rows and 27 current-main
baseline rows: 37 distinct identifiers. Historical evidence is preserved and
line anchors are mapped to current source. Four human lens files retain 28 rows.
The shorter scope around a failed strict dynamic registration build is a
reasoned exception: it closes the build before asserting the complete Cause.

Removed 14 resolved baseline rows. All 8009 unrelated rows are preserved byte
for byte. Thirteen MCP kit candidates remain: the scope exception and twelve
candidates in Client and McpCaller, whose full lens inventory is deferred.
The root ratchet passes with introduced=0 and resolved=0.

Full package verification passed (audit 6.7 seconds, docgen 3.3 seconds). Final
Node and Bun runs each passed all 95 tests with no failures or pending tests;
whole-command times were 3.726536 and 1.555843 seconds. Source hashes were stable.
Timing context includes runtime versions, limits, system load and pressure;
these are measured runs under that load, not isolated benchmark claims.

The authoritative D9 census emitted 14 paths: the original seven, five added
files under test, src/test/Conformance.test-kit.ts, and its generated declaration
under dist/test. Partial validation is valid with 28 missing lens entries across
those seven additional paths. The declaration scope needs reconciliation in the
later census pass; it has not been silently excluded or counted as reviewed.
The broad generated census refresh is retained privately, not included here.

The local repairs are committed as 6348511a4f17a60971462a27fe98378965c8b738.
The ledger credits that commit for 21 resolved detector/property rows.
Publication and full local/hosted proof remain outstanding. No production code changed.
