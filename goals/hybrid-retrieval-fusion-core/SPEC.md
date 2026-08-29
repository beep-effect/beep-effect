# Hybrid Retrieval Fusion Core Spec

## Objective

Deliver the deterministic fixture-driven fusion core:

```text
query
  -> semantic ranked fixture channel
  -> lexical FTS ranked fixture channel
  -> exact-literal ranked fixture channel
  -> optional graph ranked fixture channel
  -> weighted RRF with empty-channel renormalization
  -> deterministic literal tier/floor and stable tie-breaking
  -> unique span-bearing ranked candidates with per-channel contributions
  -> candidate/evidence packet (ClaimGate remains mandatory)
```

Migrate and behaviorally preserve the prior-generation scorer at
`../beep-effect4/packages/knowledge/server/src/GraphRAG/RrfScorer.ts` and its
test, then extend it in `@beep/nlp-processing` with schema-first ranked-channel
and result contracts, explicit weights, diagnostics, span preservation, literal
policy, and contribution exposure. An empty whole channel contributes no
weight; remaining non-empty channel weights are renormalized deterministically.

## Non-Goals

- Storage or projection extensions, including pgvector/HNSW, generated
  `tsvector`/GIN, `pg_textsearch`, migrations, or query adapters; those belong
  to queued `retrieval-vector-projection`.
- Live encoders, model packaging, renderer work, ingestion orchestration, or
  durable workers; those belong to queued `retrieval-local-encoder` or later
  ingestion work.
- Semantic/near-duplicate evidence deduplication. Merging the same candidate ID
  across ranked channels is fusion accounting, not the queued clean-room dedup
  policy.
- Citation acquisition or BFS. An optional graph-ranked input may use the common
  contract, but its producer belongs to queued `citation-graph-retrieval-channel`.
- Model mixing, relevance calibration, reranking, MMR, source-authority policy,
  or direct score-magnitude fusion.
- Calling `ts_rank_cd` BM25 or introducing lexical projection behavior here.
- Any raw chunk, retrieval result, or evidence path that bypasses `ClaimGate`.

## Source Hierarchy

1. The ratified 2026-07-14 graduation objective and
   [`BRIEF.md`](../../explorations/rag-retrieval-projection/BRIEF.md).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`, then `GOAL.md`.
6. Exploration [`DECISIONS.md`](../../explorations/rag-retrieval-projection/DECISIONS.md),
   [`MAP.md`](../../explorations/rag-retrieval-projection/MAP.md), and research.

## Target Surfaces

- `packages/foundation/capability/nlp-processing/src/Tools/` and its barrels for
  ranked-channel/result schemas, weighted RRF, literal ordering, and diagnostics.
- `packages/foundation/capability/nlp-processing/test/` for migrated parity tests
  and the ratified fixture matrix.
- `packages/foundation/capability/nlp-processing/package.json` only for required
  existing-workspace dependencies/exports; no new external dependency.
- Existing `@beep/provenance` `TextAnchor` and epistemic `ClaimGate` contracts as
  reuse/proof surfaces, not new storage or admission implementations.
- Goal packet evidence under `goals/hybrid-retrieval-fusion-core/history/`.

## Constraints

1. P0 must search live source and barrels, record the topology/symbol audit, and
   establish the prior scorer's behavioral test baseline before any new
   implementation file, export, or package surface is scaffolded. Do not use
   retired repo-export catalogs.
2. `@beep/nlp-processing` is the default home for the fusion implementation,
   ranked-channel/result contracts, and diagnostics. Reuse generic modeling and
   provenance symbols where coherent; do not create `@beep/retrieval` unless a
   separately reviewed promotion record passes the negative gate.
3. Preserve the published RRF basis `1 / (k + rank)`, one-based ranks, and
   default `k = 60`. Weights are explicit, non-negative, and associated with
   named channels.
4. Renormalize over non-empty channels only when an entire channel is empty.
   Missing candidates within a non-empty channel do not trigger reweighting.
5. The literal rule is deterministic and test-visible: an exact-phrase candidate
   occupies the ratified literal tier/floor and cannot be outscored by fuzzy
   multi-channel consensus. Within tiers, weighted RRF applies; remaining ties
   use one documented stable comparator independent of map iteration order.
6. Duplicate candidate IDs across channels yield one result. Contributions name
   their channel and expose rank, configured/effective weight, RRF component,
   and weighted contribution; their deterministic sum equals the fused score.
7. Every result preserves its pre-verified `TextAnchor`. Fusion neither invents
   nor repairs spans.
8. The output contract is a ranked candidate/evidence packet, never an admitted
   claim, `ClaimGateResult`, or direct LLM context. Proof must demonstrate that
   admission still requires the existing `ClaimGate` boundary.
9. The projection follow-on retains normalized `vector(768)` with provisional
   `nomic-embed-text-v1.5`, exact model identity, no mixed vector spaces, and a
   full rebuild on model change. None of that adds encoder/projection code here.
10. The encoder port remains runtime-neutral and outside the renderer; durable
    encoding is server/sidecar work selected by the queued benchmark.
11. Keep graph input optional and rank-only. No graph producer, BFS, driver, or
    authority behavior enters this goal.
12. Follow schema-first and Effect-first repo laws, package-alias test imports,
    deterministic fixtures, and focused changes without unrelated churn.

## Acceptance Criteria

- [ ] P0 records live symbol/barrel/package topology and a passing behavioral
      parity baseline for every migrated scorer test: component/aggregate math,
      embedding-plus-graph combination, multi-list fusion, graph-hop ranks,
      empty input, and single-list order.
- [ ] One query plus semantic, lexical FTS, and literal ranked fixture channels
      produces unique, stable, span-bearing results; the common contract also
      accepts an optional graph channel without implementing its producer.
- [ ] An empty channel proves effective-weight renormalization, including exposed
      configured/effective weights and exact contribution totals.
- [ ] The exact-phrase fixture remains in the literal tier/floor above fuzzy
      multi-channel consensus.
- [ ] Duplicate IDs merge into one candidate with every contributing channel
      exposed; contribution sums equal the fused score.
- [ ] Equal totals use the documented stable tie-break independent of insertion
      or hash-map iteration order.
- [ ] A pre-verified `TextAnchor` remains byte-for-byte equivalent and internally
      consistent after fusion.
- [ ] Type/schema and boundary tests prove the output is only a candidate/evidence
      packet and cannot represent admission or bypass `ClaimGate`.
- [ ] Focused checks, repo quality, reflection lint, and Yeet PR-to-mergeable
      proof pass with no unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher | `test "$(wc -m < goals/hybrid-retrieval-fusion-core/GOAL.md)" -le 4000` | Pass |
| Manifest | `jq . goals/hybrid-retrieval-fusion-core/ops/manifest.json` | Pass |
| Migration parity | Focused migrated `RrfScorer` test matrix | Every prior behavior passes |
| Ratified fixtures | Focused `@beep/nlp-processing` tests | Empty, literal, duplicate, tie, and anchor fixtures pass |
| Contribution diagnostics | Exact fixture assertions | Named components sum to each fused score |
| ClaimGate boundary | Type/schema and boundary proof | Output cannot encode admission; gate remains required |
| Package quality | `bun run --filter=@beep/nlp-processing check && bun run --filter=@beep/nlp-processing test && bun run --filter=@beep/nlp-processing lint` | Green |
| Repo quality | `bun run beep yeet verify` | Green |

## Stop Conditions

- P0 finds a canonical current-generation scorer or contract that materially
  changes ownership/placement, or cannot establish migration parity.
- Literal tier/floor, tie-breaking, or contribution arithmetic cannot be made
  deterministic from the ratified fixtures without a new product decision.
- Implementation requires storage, a live encoder, ingestion, dedup policy,
  citation BFS, a new package, external dependencies, or weakened admission.
- Required sources conflict materially or verification requires unnamed authority.

## Decision Log

- RRF ownership, first slice, gated satellites, lexical naming, projection/model
  contract, encoder runtime, package placement, and standalone fan-out were
  ratified in the exploration
  [`DECISIONS.md`](../../explorations/rag-retrieval-projection/DECISIONS.md).
- The approved decomposition and fixture set are in
  [`MAP.md`](../../explorations/rag-retrieval-projection/MAP.md); this goal alone
  graduates now, while all four satellites remain queued.
- Migration and license-of-record details are in
  [`research/SOURCES.md`](./research/SOURCES.md).

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
