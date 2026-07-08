---
"@beep/schema": patch
"@beep/box": patch
---

Tagged errors now derive a round-trip-safe equivalence from their declared
fields. `TaggedErrorClass` (and its `StatusCauseTaggedErrorClass` /
`CauseTaggedError` delegates) override `S.toEquivalence` to compare declared
fields only, ignoring the transient `Error` stack metadata
(`stack`/`line`/`column`/`sourceURL`) that effect's `Data.Error` machinery
captures as enumerable own properties. Previously two tagged errors with
identical schema fields were never equivalent across construction sites (e.g.
`make` vs `decode`), breaking schema round-trip property tests for every error
schema. `Equal.equals`/`Hash` (identity and HashMap/HashSet keying) are
unchanged. `@beep/box` drops its encoded-shape-only test workaround now that
`BoxError` round-trips under full value equivalence.
