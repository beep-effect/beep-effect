# Shared Schema One-Pager — v1.1 (post-bake-off-review additions 2026-08-24; v1.0 RATIFIED
2026-08-24) (A7)

The distinctions every bake-off winner must preserve. Fat-marker contract, not final code: names
and shapes indicate the schema-first families the lab will define (Effect v4 `S.Class` / tagged
unions / `LiteralKit` domains, branded ids, decode at boundaries). A candidate that cannot
round-trip these without loss fails the semantic floor (rubric gate 8); the end-to-end
compatibility round checks composition.

## Families

- **SourceDocument** — content-addressed identity (`sha256` brand), media type (LiteralKit),
  tagged origin (`LocalFile | Url | Fixture`), byte length; acquisition ProvenanceEvent ref.
- **CanonicalText** *(added v1.1 — both bake-off reviews found no sheet named the thing spans
  address)* — the single named canonicalization every downstream span is against: content-
  addressed id, source document ref, producing parser + version, **UTF-16 code-unit offsets**
  (matching live `VerifiedSpan` semantics), and a monotone raw→canonical loss map (or a typed
  lossy-segment declaration). One per document per parse; there is exactly one owner of span
  meaning.
- **Chunk / TextUnit** — CanonicalText ref + **span** (`{start, end}` UTF-16 offsets against
  that CanonicalText) + producing-stage ProvenanceEvent ref. Text is NEVER divorced from its
  span; every stage (parse, normalize, split) maps spans, or declares itself lossy in the type.
- **EvidenceBatch / EvidenceClaim** *(added v1.1 — the extraction sheet depended on it; it now
  lives here, not in a family sheet)* — the ONLY write model for observed knowledge: a batch of
  claims (entity/relation assertions) each carrying CanonicalText spans, branded confidence,
  method tag + rule-or-model identity (revision + artifact hash, prompt/config hash where
  applicable), input chunk refs, and transformation lineage; appended atomically with its
  ProvenanceEvents. Conflicting claims stay separate nodes joined by typed ConflictWitness.
- **RdfTerm** (via `@beep/rdf`) — tagged union `Iri | Literal { lexical, datatype: Iri, lang? }
  | BlankNode`. Plain strings never carry RDF meaning. IRIs minted `https` per the schema.org
  IRI doctrine.
- **Entity** — branded id, type set (`HashSet<Iri>`), surface forms with spans, branded
  `Confidence`. One entity family — not the semantica dataclass/Pydantic/dict trifecta.
- **Statement** — subject/predicate/object as RdfTerm/Entity refs, plus qualifiers: confidence,
  temporal validity interval, ProvenanceEvent ref. Quad-projectable (named graph = provenance
  partition), reified as data.
- **EmbeddingVector** — vector + **ModelIdentity** `{ name, revision, artifactHash, dim }`
  (branded). A vector without model identity is unrepresentable. Degradation is a tagged
  `DegradedEmbedding` state — the semantica random-vector fallback is made impossible by
  construction.
- **ProvenanceEvent** — append-only tagged union: `Ingested | Parsed | Chunked | Extracted |
  Asserted | Inferred | Deduplicated | ConflictResolved | Invalidated` — entity/activity/agent
  ids, input refs (with spans), timestamps, hash-chain link. PROV-O is a derived projection,
  not the storage shape. (Delete/compaction semantics: owed by the D16/A6 storage-inversion
  spike before this is binding.)
- **InferenceEvent** — conclusion (Statement ref) + rule id + premise refs + engine id +
  explanation tree (proof DAG as data; prose is a rendering). The v3 `rete` audit vocabulary is
  the seed; semantica's single-step "explanations" are the anti-pattern.
- **PipelineStep** — serializable tagged step algebra (D16): step kind (LiteralKit), config
  schema, dependency edges; interpreted by services. No raw callables in definitions.
- **EvalReport** — corpus hash, gold version, per-metric results, budgets observed;
  schema-validated (qa-inventory pattern).

## Cross-family laws

1. Branded ids everywhere (`DocumentId`, `EntityId`, `ActivityId`, `Confidence`, `Sha256`…);
   typed errors per boundary; effect helper modules (`HashSet`/`HashMap`, never native).
2. Spans + model identity + provenance refs are the three threads that must survive every
   stage; a family sheet's task-quality section must measure their preservation.
3. Storage candidates are scored on representing `RdfTerm` distinctions, span-bearing chunks,
   and append-only events; reasoning candidates on emitting `InferenceEvent` proofs; embeddings
   candidates on `ModelIdentity` + typed degradation; input candidates on span fidelity.
