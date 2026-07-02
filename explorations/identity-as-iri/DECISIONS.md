# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.

NOTE: this file was pre-seeded during the research stage (a decision landed
early); the manifest `stage` remains the authoritative resume point.
-->

## 2026-07-01 — prototype home + first-principles constraint

**Question:** Where does the shape-stage prototype live, and what may it
import?

**Answer:** [`scratchpad/identity/`](../../scratchpad/identity/README.md)
inside the existing `@beep/scratchpad` workspace package, so it runs under the
repo's real type-check/lint/test gates while we experiment. Imports are
restricted to `effect` only — no `@beep/*` packages, not even `@beep/identity`
or `@beep/types` — enforced by
[`scratchpad/test/identity-first-principles.test.ts`](../../scratchpad/test/identity-first-principles.test.ts).

**Rationale:** elpresidank: the old `@beep/identity` / `@beep/ontology` code
had a chicken-and-egg dependency problem; the rebuild starts from first
principles (official RFC/W3C specs) under the working assumption of a full
rewrite of those packages. Options rejected: prototyping inside the
exploration packet (no type-check gates); prototyping in the session
scratchpad (outside the repo's quality gates); importing `@beep/identity` for
comparison (would re-import the coupling the exercise is designed to break —
comparison happens in research audits instead). `@beep/types` was floated as a
possibly-acceptable dependency but the prototype starts stricter (effect-only)
and can relax later if a concrete need appears.
