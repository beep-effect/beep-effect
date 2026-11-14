---
title: "Assemble owned child configuration with ownedStruct and derive it with ownedDerive"
date: 2026-11-14
lane: "perf/citation-owned-configuration"
reversal: "Remove ownedStruct and give OccurrenceProjection its own owned field instead."
---

The design sketch has ownedField and ownedItems. VerifiedExtraction builds OccurrenceProjection's configuration ({ engineArtifact }) from its own owned configuration, so ConfigurationOwnership also exports ownedStruct(make, fields): every field must already be CitationOwned and the schema constructor builds a fresh container around them, so the result is owned without a detach. It cannot mint a value from non-owned parts, which is why it does not resolve the default engine stop.

Owner ruling, round 3: `ownedDerive(owned, derive)` is the second projection of this kind. Its result is owned because the engine computes it from an already owned input and from values the engine itself creates or reads (sealed asset files, the clock); `derive` must not close over a caller-held value. It needs an owned witness, so it cannot mint from caller input, and the brand constructor stays private. It has exactly one production site: the default engine's installed configuration (decision "Own the default engine configuration by derivation from the owned caller configuration").
