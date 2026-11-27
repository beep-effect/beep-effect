---
title: Codec round-trip arbitraries sample integrity and specifier leaves from real literals, dictionaries from optional keys
date: 2026-11-26
reversal: Derive ResolvedPackage and ImporterDependency arbitraries with Arbitrary.schema, and dictionaries with Schema.Record over a literal key union.
governs:
  - test/roundtrip.property.test.ts#dictionary
  - test/roundtrip.property.test.ts#Integrity
  - test/roundtrip.property.test.ts#importerDependencyArb
enforcedBy: []
---

The round-trip suite samples `integrity` and `specifier` from `Schema.Literals` of real values decoded through their codecs, builds small-key dictionaries as a struct of optional keys, and generates a `peerSuffix` only inside a concrete version.

`IntegrityHash` is a filter with no arbitrary constraint, so native derivation discards every random string and leaves the optional `integrity` key unpopulated. A derived `DependencySpecifier` pairs a tag with an unrelated `raw`, which the codec reclassifies, so it does not round-trip. `Schema.Record` over a literal key union always emits every key, and `isUniqueKey` over tuples collapses to the empty array, so neither samples the partial maps a lockfile carries. No parser emits a `peerSuffix` without a version.

Rejected: schema-derived arbitraries for these leaves (the suite stays green while never exercising integrity), `Schema.Record` or `isUniqueKey` dictionaries, and a `peerSuffix` sampled beside the version.
