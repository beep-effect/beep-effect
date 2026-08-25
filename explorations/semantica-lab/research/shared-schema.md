# Shared Schema One-Pager — v1.4 (R1 report/telemetry split, PR #802 review 2026-08-24; v1.3 M1 compose-not-build; v1.2 S6 effect-ontology fold-in;
v1.1 post-bake-off-review additions; v1.0 RATIFIED 2026-08-24) (A7)

The distinctions every bake-off winner must preserve. Fat-marker contract, not final code: names
and shapes indicate the schema-first families the lab will define (Effect v4 `S.Class` / tagged
unions / `LiteralKit` domains, branded ids, decode at boundaries). A candidate that cannot
round-trip these without loss fails the semantic floor (rubric gate 8); the end-to-end
compatibility round checks composition.

## Families

- **SourceDocument** — content-addressed identity (`sha256` brand), media type (LiteralKit),
  tagged origin (`LocalFile | Url | Fixture`), byte length; acquisition ProvenanceEvent ref.
- **CanonicalText** *(added v1.1; re-scoped v1.3 by M1 — compose, do not build)* — the single
  named text every downstream span is against. It IS the live `ResolvedSourceText`
  (`@beep/file-processing` `SourceText`): `@beep/provenance` `SourceTextIdentity` (content-addressed
  `textDigest`, source ref/locator/digest, producing `SourceTextExtractor { name, version }`)
  + the exact extracted text. Raw extracted text is canonical; normalization is locator-only,
  never evidence text (`goals/citation-verified-span-substrate` constraint 4); there is **no**
  raw→canonical loss map — a second normalized text would make spans unprovable by
  `verifyTextAnchor`. One per document per parse; exactly one owner of span meaning.
- **Chunk / TextUnit** — CanonicalText ref + **span** as a `@beep/provenance` `TextAnchor`
  (UTF-16 code-unit half-open offsets against that text, width-checked) + producing-stage
  ProvenanceEvent ref. Text is NEVER divorced from its
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
- **EmbeddingVector** — vector + **ModelIdentity** `{ provider, name, revision, artifactHash, dim,
  taskType }` (branded; `taskType` added v1.2 because it changes the vector and therefore the
  cache key — effect-ontology's `EmbeddingTaskType` is the borrowed shape). A vector without
  model identity is unrepresentable. Degradation is a tagged `DegradedEmbedding` state — the
  semantica random-vector fallback AND effect-ontology's silent voyage→nomic provider fallback
  (which swaps ModelIdentity under callers) are both impossible by construction. Provider
  results are cached under `sha256(ModelIdentity ⊕ chunkId)` immutably (no TTL) so replay-offline
  reproduces EvalReports (G7).
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
- **EvalReport** *(re-scoped v1.4, R1)* — the replay-stable, content-addressed payload: corpus
  hash, gold version, per-call `ModelIdentity` + provider-cache keys, per-metric results;
  `reportDigest` = sha256 over the canonical JSON of the report body with the `reportDigest`
  field itself omitted; schema-validated (qa-inventory pattern). Replay
  identity (G7) is `reportDigest` equality — nothing time-dependent may live in it.
- **EvalRunTelemetry** *(added v1.4, R1)* — the per-run sidecar referencing a `reportDigest`:
  run id, mode (`live | replay`), wall-clock, cold start, p95, RSS, disk growth, dependency and
  model bytes. Tier-L bars are read from the live run's sidecar; Tier-D numbers are recorded;
  the sidecar is never part of the digest and never compared for identity.

## Anchors already alive in `@beep/*` (S6, verified by the deep read's skeptics)

| Family need | Live symbol | Package |
| --- | --- | --- |
| span anchor decoded at boundaries | `TextAnchor` | `@beep/provenance` |
| canonical text identity + producing extractor (M1) | `SourceTextIdentity`, `SourceTextExtractor` | `@beep/provenance` |
| resolved canonical text + resolver service (M1) | `ResolvedSourceText`, `SourceTextResolver` | `@beep/file-processing` `SourceText` |
| verified span + receipt = the C0 tripwire (M1) | `VerifiedTextAnchor`, `verifyTextAnchor`, `TextAnchorVerificationReceipt` | `@beep/provenance` |
| conflict-witness precedent (M1) | `ContradictionCandidate` (candidateKey/digest, matchBasis, bitemporal) | `@beep/epistemic-domain` |
| provenance write-model precedent (M1) | `Activity`, `UsageRecord` (provider/model + activityId) | `@beep/epistemic-domain` |
| branded confidence | `Confidence` | `@beep/epistemic-domain` |
| RDF object position, PROV refs/bundles/activities | `ObjectTerm`, Prov `ObjectRef`/`ProvBundle`/`Activity`/`Entity` | `@beep/rdf` |
| SHACL outcomes | `ShaclValidationResult` family | `@beep/semantic-web` |
| unit/non-negative numerics | `UnitInterval`, `NonNegativeInt`, `NodeIndex` | `@beep/schema` |

Borrow-shape only (effect-ontology is non-importable): `ProviderMetadata` (dimension invariant),
`toReifiedTriples` (claim → CLAIMS-vocabulary quads = the Statement projection shape), `ClaimData`
deterministic ids, `Timeline` bitemporal values + tagged claim conflicts (ConflictWitness seed),
`QuadDelta` (the witness type for C1 rebuild identity, NOT an InferenceEvent: it has no rule id,
premises, or engine), `ProvenanceUri` ("named graph = provenance partition"),
`RequestResolver.makeGrouped` batching keyed by taskType. Full table:
[`effect-ontology-map.md`](./effect-ontology-map.md).

**Hazards the schema forbids by construction (seen live in effect-ontology):** ids truncated to
12 hex chars of a SHA-256 (brands are the full digest); `vector(768)` hardwired in DDL and codec
(tables are dimension-keyed, B4); claim deprecate/promote as in-place `UPDATE` statements (`Invalidated` /
`ConflictResolved` events instead); a whole-chunk `{0, length}` evidence span invented when no
mention span exists (typed lossy declaration instead); per-chunk batches folded by lexical-min
winner (batches keep identity; conflicts become `ConflictWitness`).

## Cross-family laws

1. Branded ids everywhere (`DocumentId`, `EntityId`, `ActivityId`, `Confidence`, `Sha256`…);
   typed errors per boundary; effect helper modules (`HashSet`/`HashMap`, never native).
2. Spans + model identity + provenance refs are the three threads that must survive every
   stage; a family sheet's task-quality section must measure their preservation.
3. Storage candidates are scored on representing `RdfTerm` distinctions, span-bearing chunks,
   and append-only events; reasoning candidates on emitting `InferenceEvent` proofs; embeddings
   candidates on `ModelIdentity` + typed degradation; input candidates on span fidelity.
