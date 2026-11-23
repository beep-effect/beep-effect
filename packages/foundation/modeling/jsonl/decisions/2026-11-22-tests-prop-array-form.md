---
title: Property tests pass it.effect.prop its arbitraries in array form
date: 2026-11-22
reversal: Switch the property tests to the named-record form of it.effect.prop and confirm each property still receives decoded Schema values.
governs:
  - test/Properties.test.ts#runs
  - test/LineProperty.test.ts#minimum100RunsRaisedByEnvironment
enforcedBy: []
---

Every `it.effect.prop` in the jsonl property suites takes its schemas and arbitraries as an array, never as a named record.

Reason: the named-record form silently discards the Schema conversion, so the property body receives values that skipped the codec it is meant to exercise and the property still passes.

Rejected: the named-record form, which reads better and is what a new property test would reach for first.
