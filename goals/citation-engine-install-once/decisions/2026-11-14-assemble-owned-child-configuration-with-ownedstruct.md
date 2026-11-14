---
title: "Assemble owned child configuration with ownedStruct and derive it with ownedDerive"
date: 2026-11-14
lane: "perf/citation-owned-configuration"
reversal: "Remove ownedStruct and give OccurrenceProjection its own owned field instead."
---

The design sketch has ownedField and ownedItems. VerifiedExtraction builds OccurrenceProjection's configuration ({ engineArtifact }) from its own owned configuration, so ConfigurationOwnership also exports `ownedStruct(schema, fields)`. `schema` is the `S.Struct` or `S.Opaque` class itself (typed `{ fields; make } & S.Top`, `make` called as a method); the types require every field to be `CitationOwned` and the field record to be non-empty. Review round 4 replaced the first version, which took a free `make` function and accepted an empty record.

Owner ruling, round 3: `ownedDerive(owned, derive)` brands the result of an engine computation over an owned input. The brand constructor stays private.

Both are a discipline, not a proof. Each result is sound only if the constructor or `derive` builds it from the owned inputs and from values the engine itself creates or reads (sealed asset files, the clock), and keeps nothing a caller holds. The types do not enforce that. Production call sites: one each, VerifiedExtraction's OccurrenceProjection configuration for `ownedStruct` and the default engine's installed configuration for `ownedDerive` (decision "Own the default engine configuration by derivation from the owned caller configuration").
