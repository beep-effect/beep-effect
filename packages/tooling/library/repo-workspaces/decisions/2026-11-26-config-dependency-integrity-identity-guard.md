---
title: ConfigDependencySpec.integrity reuses SriIntegrityHash, guarded by an identity assertion
date: 2026-11-26
reversal: Replace the identity assertion in test/ConfigDependencySpec.test.ts with a type-level or behavioural check, or let ConfigDependencySpec declare its own SRI restriction and delete the guard.
governs:
  - src/ConfigDependencySpec.ts#ConfigDependencySpec
enforcedBy: []
---

`ConfigDependencySpec.integrity` is `S.Option(SriIntegrityHash)` from `@beep/npm-spec`, the one shared SRI restriction of the `IntegrityHash` brand.
The consolidation is guarded by asserting that the field's `.value` IS `SriIntegrityHash` (`Schema.Option(X)` keeps `X` on `.value`), with the unrestricted `IntegrityHash` as the control.
A `Schema.check` is erased from the built type, and a faithful private copy of the restriction behaves identically, so only identity can see a re-fork.
Rejected: a type-level assertion, because tsc sees the same type for the shared schema and a private copy.
Rejected: relying on the parse rejection matrix, because a faithful copy passes every row of it.
