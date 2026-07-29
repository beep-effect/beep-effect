# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-06-15 - leave patent semantics out

**Question:** Should this exploration focus on patent-document semantics or on
generic DOCX round-tripping?

**Answer:** Leave patent semantics out for now. Focus on DOCX round-trip
interop.

**Rationale:** Patent-specific nodes and USPTO profiles remain valuable later,
but they would hide the more basic risk: whether the repo has a credible
AST-level path between DOCX/Pandoc and the existing portable document model.

## 2026-06-15 - ast mapping before product surfaces

**Question:** Should the first work be UI/import/export behavior or pure AST
mapping?

**Answer:** Pure AST-to-AST mapping first.

**Rationale:** The current `@beep/md` and `@beep/lexical-schema` profiles were
not built for full DOCX round-tripping. Before UI or sidecar work, the repo
needs a compatibility proof that says what maps, what degrades, and what is not
representable.

## 2026-06-15 - pandoc mirror first

**Question:** What should be the first AST artifact this exploration plans
around?

**Answer:** Create a schema-first Pandoc JSON AST mirror first.

**Rationale:** Rejected designing a new Beep document AST now because that would
pre-judge the gap matrix. Rejected extending `@beep/md` immediately because it
may turn a markdown AST into a DOCX superset prematurely. The Pandoc mirror is
an external interchange AST, not the canonical product/editor model.

## 2026-06-15 - docx-core plus gaps

**Question:** How broad should the first Pandoc AST mirror be?

**Answer:** Model DOCX-core plus explicit gaps.

**Rationale:** Full Pandoc AST coverage is too broad for the first proof.
Fixture-only minimal coverage would learn too little. The mirror should model
the document envelope and common DOCX block/inline nodes, while unsupported
nodes become mapping issues.

## 2026-06-15 - json fixtures first

**Question:** What should the first implementation proof use for Pandoc data?

**Answer:** Use checked-in Pandoc JSON AST fixtures first.

**Rationale:** The local system does not have `pandoc` installed. More
importantly, the first proof is about schema and mapping laws, not process
management or sidecar packaging. A binary runner becomes a later driver goal.

## 2026-06-15 - map to beep-md first

**Question:** Which Beep-side target should Pandoc map to first?

**Answer:** Map to `@beep/md` only.

**Rationale:** `@beep/md` is the existing portable document AST. Mapping to
Lexical now would entangle editor-state limitations with document-interchange
limitations. Lexical remains downstream evidence for later.

## 2026-06-15 - bidirectional profile

**Question:** Should the first mapping proof be one-way or bidirectional?

**Answer:** Make it bidirectional for the supported profile.

**Rationale:** `@beep/md -> Pandoc -> @beep/md` should be identity for the
supported profile. `Pandoc -> @beep/md -> Pandoc` should be normalized identity
only for supported Pandoc constructs. That gives the package a real round-trip
claim without pretending unsupported Word constructs are lossless.

## 2026-06-15 - issues plus partial output

**Question:** How should unsupported or lossy Pandoc constructs behave?

**Answer:** Return mapped content plus path-located issues.

**Rationale:** Fail-closed is strict but poor for discovery. Raw passthrough is
powerful but invasive for `@beep/md`. Issues plus partial output lets the
compatibility matrix show exactly where fidelity breaks while requiring
issue-free mappings for identity-law tests.

## 2026-06-15 - package name

**Question:** What package name should the pure Pandoc AST mirror use?

**Answer:** Use `@beep/pandoc-ast`.

**Rationale:** The pure mirror belongs under `packages/foundation/modeling`.
The short `@beep/pandoc` name should remain available for a future driver that
wraps the Pandoc executable, Tauri sidecar, or process boundary.

## 2026-06-15 - green plus gap fixtures

**Question:** What fixture profile should drive the first compatibility matrix?

**Answer:** Use a green plus gap pack.

**Rationale:** Green fixtures prove the supported profile. Gap fixtures for
styles, tables, notes, math, and richer Word constructs prove that unsupported
content is surfaced explicitly rather than silently erased.

## 2026-06-15 - generated-once fixture provenance

**Question:** How should the first goal source Pandoc JSON fixtures?

**Answer:** Generate fixtures once from real DOCX or Markdown inputs with a
pinned Pandoc version outside the normal test loop, then commit the JSON plus
provenance notes.

**Rationale:** Rejected hand-authored fixtures because they can mirror an
imagined AST rather than real Pandoc output. Rejected relying only on upstream
examples because they may not exercise Beep-specific DOCX gaps.
Generated-once fixtures keep normal tests deterministic while grounding the
schema in real Pandoc output. The first goal may document the generator command
and provenance without requiring Pandoc in every test run.

## 2026-06-15 - tables-and-custom-styles-gap-only

**Question:** For the first `@beep/pandoc-ast` goal, should tables and custom
styles be supported or gap-only?

**Answer:** Treat tables and custom styles as gap evidence only in v1: decode
enough to produce stable path-located issues, but do not map them losslessly to
`@beep/md`.

**Rationale:** Supporting `custom-style` would likely force an immediate
`@beep/md` extension decision. `@beep/md` now has a Markdown table model, but
Pandoc's richer table payload still has no truthful lossless mapping into that
profile. Keeping Pandoc tables as an explicit mapping gap preserves the signal
needed for the compatibility matrix without overstating interoperability.
