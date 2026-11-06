---
title: "Patch alchemy beta.85 types for exactOptionalPropertyTypes"
date: 2026-11-06
lane: "goals/alchemy-vault-sync-slice"
reversal: "Delete patches/@alchemy.run%2Fdomain@2.0.0-beta.85.patch and its patchedDependencies entry at the next lockstep bump, where upstream HEAD already restructured Aggregate.Resolved"
---

Under the repo's `exactOptionalPropertyTypes: true`, `Domain.Model` rejects every aggregate without a `read` contract because beta.85 types `Aggregate.Resolved.read` as `R` (possibly undefined) while `AnyDefinition.read?` is optional. A one-line bun patch (`patches/@alchemy.run%2Fdomain@2.0.0-beta.85.patch`, precedent `patches/effect@4.1.2.patch`) makes the field optional in `lib/Aggregate.d.ts` and `src/Aggregate.ts`. Alternatives rejected: relaxing the compiler option for alchemy consumers; a `read` contract on every test aggregate.
