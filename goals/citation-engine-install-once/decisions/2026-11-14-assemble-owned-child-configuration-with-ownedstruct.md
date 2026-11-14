---
title: "Assemble owned child configuration with ownedStruct"
date: 2026-11-14
lane: "perf/citation-owned-configuration"
reversal: "Remove ownedStruct and give OccurrenceProjection its own owned field instead."
---

The design sketch has ownedField and ownedItems. VerifiedExtraction builds OccurrenceProjection's configuration ({ engineArtifact }) from its own owned configuration, so ConfigurationOwnership also exports ownedStruct(make, fields): every field must already be CitationOwned and the schema constructor builds a fresh container around them, so the result is owned without a detach. It cannot mint a value from non-owned parts, which is why it does not resolve the default engine stop.
