# identity-as-iri prototype (first principles)

Shape-stage prototype for
[`explorations/identity-as-iri`](../../explorations/identity-as-iri/README.md):
prove the types, schemas, and authoring ergonomics of the IRI-bearing
`IdentityComposer` rewrite before any `foundation/modeling` package is touched.

Design authority: the packet's
[handoff](../../explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md)
(D1–D9). Spec grounding: `explorations/identity-as-iri/research/specs/`.

## Rules

- **Imports: `effect` only.** No `@beep/*` packages — not even `@beep/identity`
  or `@beep/types`. This is a clean-room rebuild to break the old
  identity↔ontology chicken-and-egg problem; working assumption is a full
  rewrite of `@beep/identity` / `@beep/ontology`.
  Enforced by [`../test/identity-first-principles.test.ts`](../test/identity-first-principles.test.ts).
- Every identity and CURIE stays a static literal (the interpolation ban is
  load-bearing).
- Type-level assertions accompany every literal transform
  (`IriFromIdentity`, `CurieFromIdentity`, `Expand`, `Predicate`).
- This folder is disposable provenance: the winning design graduates into the
  goal packets; nothing here ships.
