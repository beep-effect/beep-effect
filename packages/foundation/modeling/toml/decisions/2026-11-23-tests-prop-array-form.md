---
title: Property tests pass it.effect.prop their arbitraries in array form
date: 2026-11-23
reversal: Switch the oracle property tests to the named-record form of it.effect.prop and confirm each property still receives decoded Schema values.
governs:
  - test/oracle.property.test.ts#documentArb
enforcedBy: []
---

Every `it.effect.prop` in the toml property suites takes its arbitraries as an array, never as a named record.
Reason: the named-record form silently discards the Schema conversion, so the property body receives values that skipped the codec it is meant to exercise and the property still passes.
Rejected: the named-record form, which reads better and is what a new property test would reach for first.
