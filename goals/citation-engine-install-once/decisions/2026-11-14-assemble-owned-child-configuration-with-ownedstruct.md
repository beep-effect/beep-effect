---
title: "Assemble owned child configuration with ownedStruct and derive it with ownedDerive"
date: 2026-11-14
lane: "perf/citation-owned-configuration"
reversal: "Remove ownedStruct and give OccurrenceProjection its own owned field instead."
---

The design sketch has ownedField and ownedItems. VerifiedExtraction builds OccurrenceProjection's configuration ({ engineArtifact }) from its own owned configuration, so ConfigurationOwnership also exports ownedStruct(schema, fields): every field must already be CitationOwned and the schema's constructor builds a fresh container around them, so the result is owned without a detach. Review round 4: the first version took a free `make` function and accepted an empty field record, so it could mint from anything. It now takes the `S.Struct` or `S.Opaque` class itself (an object with `fields` and `make`, called as a method) and rejects an empty field record at the type level. It cannot mint a value from non-owned parts, which is why it does not resolve the default engine stop.

Owner ruling, round 3: `ownedDerive(owned, derive)` is the second projection of this kind. Its result is owned because the engine computes it from an already owned input and from values the engine itself creates or reads (sealed asset files, the clock); its soundness rests entirely on `derive` not closing over a caller-held value, which the types cannot check. It needs an owned witness, so it cannot mint from caller input, and the brand constructor stays private. It has exactly one production site: the default engine's installed configuration (decision "Own the default engine configuration by derivation from the owned caller configuration").
