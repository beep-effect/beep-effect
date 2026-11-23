---
title: Glob property tests pass it.effect.prop its arbitraries in array form
date: 2026-11-23
reversal: Switch the compliance property tests to the named-record form of it.effect.prop and confirm each property still receives decoded Schema values.
governs:
  - test/compliance.test.ts#printableAsciiMinusSlashAndBackslashSpelledAsTheFourSpansAroundThemArb
  - test/compliance.test.ts#braceSegArb
enforcedBy: []
---

Every `it.effect.prop` in the glob compliance suite takes its schemas and arbitraries as an array, never as a named record.

Reason: the named-record form silently discarded the Schema conversion (observed in @effect/vitest 4.0.0-beta.94), so the property body receives values that skipped the codec and the property still passes.

Rejected: the named-record form, which reads better and is what a new property test would reach for first.
