---
"@beep/identity": patch
"@beep/m365": patch
---

Add the declaration-typed `annoteClass` helper to `IdentityComposer` so class
constructors receive correctly typed declaration-only annotation hooks.

`annote` cannot type `toArbitrary`/`toEquivalence` hooks because it lacks a
schema-value generic and a `TypeParameters` tuple. `annoteClass<Schema, TP>`
returns a raw `S.Annotations.Declaration<Schema["Type"], TP>` through the same
runtime merge path. Export `DeclarationAnnotationExtras`, turn
`HttpApiEncoding` into a deprecated pass-through of Effect's
`PayloadEncoding`, and migrate `M365Error` class annotations to the new
helper.
