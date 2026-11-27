---
title: ConfigFile layers pin their tag with a three-part intersection
date: 2026-11-26
reversal: Type `tag` as a single `Context.Key<Self, ConfigFileShape<A>>` in `layer` and `testLayer` and drop the `S` parameter and the `NoInfer` conditional.
governs:
  - src/ConfigFile.ts#layer
  - src/ConfigFile.ts#testLayer
enforcedBy: []
---

`layer` and `testLayer` type `tag` as `Context.Key<Self, S> & Context.Key<Self, ConfigFileShape<A>> & ([ConfigFileShape<NoInfer<A>>] extends [S] ? unknown : never)`.
Reason: `Context.Key<Self, S>` captures the key's real service shape; `Context.Key<Self, ConfigFileShape<A>>` keeps `A` inferable from the key, which a bare `MergeStrategy.firstMatch()` in the options needs; the `NoInfer` conditional only checks, rejecting a key whose shape is wider than `ConfigFileShape<A>`.
Rejected: a single `Context.Key<Self, S>`, which loses `A` inference for `firstMatch()`; a single `Context.Key<Self, ConfigFileShape<A>>`, which accepts a key declared with a wider shape.
Accepted limit: the conditional cannot see through method-syntax parameter bivariance, so a member redeclared as a method with a wider parameter still passes.
