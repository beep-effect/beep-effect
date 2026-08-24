# Adversarial-review reconciliation — 2026-08-24

*Provenance: A1-A9 were ratified 2026-08-24. Current law: DECISIONS "Current law" table + rubric v2.0.*

Inputs: [`2026-08-24-grok-4-6-rubric-review.md`](./2026-08-24-grok-4-6-rubric-review.md)
(RATIFY-WITH-EDITS, 8 mandatory) and [`2026-08-24-sol-rubric-review.md`](./2026-08-24-sol-rubric-review.md)
(REWORK). Reconciled by Fable. Output: rubric **v2** + DECISIONS amendments **A1–A9**
(PROPOSED, pending Benjamin's ratification per D11).

## Accepted (convergent — both reviewers)

1. **Storage de-unification.** Vector / property-graph / triplet / provenance-log have different
   truth models. v2: choose a system of record, score projections separately, bundle verdicts
   allowed. pgvector-on-PGlite demoted from convergence-prior to ordinary candidate (it is NOT
   in `@beep/pglite` today; repo pgvector evidence is Docker-compose comments). → A1
2. **Quality ×3 split.** Family-specific task-quality measurements on a named workload replace
   the single 1–5 "best-in-class" judgment; evidence required for EVERY score (not just 4+);
   unknowns marked; sensitivity check on winners. → rubric §2
3. **Envelope double-count dropped.** Envelope is gate-only; the scored axis is operational fit
   (RSS, cold start, model bytes, spawn). "In-process" defined: the Bun sidecar process is the
   default engine home (webview = UI only; Rust crate = exception with recorded rationale). → A2
4. **License gate rebuilt.** Permissive in-process; MPL-2.0-class file-level weak copyleft
   admissible with notes; any copyleft sidecar requires a written distribution analysis
   (conveyance ≠ linking); model-weight licenses count as dependencies. → rubric §1
5. **Maintenance floor rebuilt.** Releasable-or-vendorable-with-priced-fork replaces
   commit-in-12-months. → rubric §1
6. **New hard gates:** no success-shaped degradation (silent fallback ⇒ park); resource
   ceilings per workload contract; hostile-input/SSRF posture; determinism/replayability for
   evals; target matrix with mobile declared no-go. → rubric §1
7. **Reasoning family constrained.** Semantic suites named before engines ranked; sheet frozen
   only after /adhd (D15); NET-NEW = dated spike with kill criteria + ablation; the wrap is the
   pick-one. v3 `rete` oracle stays salvage input. → A6
8. **Input stack cardinality.** A stack, not a single winner: format-by-stage capability matrix
   bounded to D14 corpus formats; per-stage verdicts. Omitted beep bricks (`@beep/tika`,
   `@beep/langextract`, `@beep/nlp`, `@beep/nlp-processing`, `@beep/pandoc-ast`, `@beep/rdf`,
   `@beep/provenance`, `@beep/duckdb`) added to SOURCES §4 and seed lists. → A3
9. **Extraction is family 5.** `semantic_extract` is the KG-producing step; scored
   already-have/gap sheet with gold-label eval, not skipped. → A4
10. **Shared schema is bake-off INPUT.** One-pager (Document / Chunk / RDF Term / Entity /
    ProvenanceEvent / InferenceEvent, spans + model identity) drafted before bake-offs launch;
    end-to-end compatibility round over winning bundles before final verdicts. → A7
11. **Workload contract required.** Named corpus subset + gold labels + machine targets +
    resource budgets + expected entailments + the falsifiable two-week Document→KG→eval loop.
    → A8
12. **D12 amended:** milestone 1 is window-optional — Tauri scaffold cannot block the headless
    proof; Cargo checks stay local. → A5
13. **D2/D5 single-writer refinement:** decision-evidence facts live in repo (IR/packet);
    Notion is a render/annotation surface for them; verdict vocabularies unified with an
    explicit mapping (row-level adopt/adapt/already-have/park/drop ↔ family-level
    already-have/pick-one/park/bundle). → A9
14. **Parked-SOTA appendix** per family: the winner's score sits next to the parked
    state-of-the-art so envelope-parking is honest. → rubric §4
15. **Missing candidates seeded:** Kuzu, DuckDB-VSS, LanceDB, USearch, CozoDB, SurrealDB,
    RDF/JS + Comunica, Ascent/Datafrog (Rust Datalog), Trealla/SWI WASM.

## Adapted (accepted in spirit, lighter machinery)

- Sol's two-independent-scorers + reconciliation record → reuse D17: every bake-off output gets
  the Sol+Grok adversarial pass; disagreements logged in the family sheet, not a new process.
- Sol's amendment process → rubric is versioned (v2, v3…); evidence-driven corrections are
  dated DECISIONS entries, not frozen-forever text.
- Sol's D16 concern (append-only vs deletion/compaction/desktop storage) → D16 keeps the
  provenance-first *intent*; the goal packet must include a storage-inversion spike with
  delete/compaction semantics before it is binding architecture.

## Rejected / noted

- Grok's tone about the envelope "ghetto": the envelope stands (D9 was deliberate; offline/
  local-first IS a named acceptance criterion — now written into the workload contract rather
  than implied).
- Sol's REWORK verdict as a whole: v2 adopts its substance; a third full rewrite cycle before
  any research runs is process for its own sake. v2 + A1–A9 is the ratification target.
