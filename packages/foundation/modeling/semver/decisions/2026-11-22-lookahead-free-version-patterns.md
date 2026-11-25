---
title: Version-string and prerelease patterns are written without lookahead
date: 2026-11-22
reversal: Express the SemVer grammar with lookahead (for example a negative lookahead for leading zeros or all-digit identifiers), or drop the patterns and rely on the predicates alone.
governs:
  - src/SemVer.ts#versionCore
  - src/SemVer.ts#exactVersionPattern
  - src/SemVer.ts#pinnableVersionPattern
  - src/SemVer.ts#prereleaseIdentifier
enforcedBy: []
---

The SemVer 2.0.0 grammar is spelled as lookahead-free patterns. `Arbitrary`
compiles a schema's pattern into a generator and rejects lookahead, so these
patterns let `Arbitrary.schema` produce well-formed version strings and
`SemVer` values instead of discarding random strings against a predicate.
The predicates (`SemVer.isValid`, `SemVer.isPinnable`) stay the authority; they
also bound components to safe integers, which a pattern cannot. A string
prerelease identifier needs one non-digit because the grammar parses all-digit
identifiers as numbers, which keeps decode/encode round-trips canonical.

Rejected: lookahead patterns, which read closer to the spec but break generator
derivation; predicate-only schemas, which make property tests discard nearly
every sample.
