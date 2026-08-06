# RAPTOR → beep-effect mapping — searches and raw evidence

Repo: `/home/elpresidank/YeeBois/projects/beep-effect15` (branch `main`, clean at start).
Source mining note: `scratchpad/graphnosis/paper-raptor.md`.
Landing packets named by the capture: `goals/hybrid-retrieval-fusion-core`,
`explorations/rag-retrieval-projection` (`explorations/graphnosis-prior-art/CAPTURE.md:123-128`).

---

## 0. Orientation

```sh
ls explorations goals
```

- `explorations/graphnosis-prior-art/` is stage `capture` — `BRIEF.md`, `README.md`,
  `MAP.md`, `RESEARCH.md`, `DECISIONS.md` are still unmodified templates. `CAPTURE.md` is the
  only authored file. So this paper has **no landing surface yet inside its own packet** beyond
  the pointer line.
- `explorations/graphnosis-prior-art/CAPTURE.md:123-128` (verbatim):
  > `assets/raptor-tree-organized-retrieval.pdf` — 23 pages … Hierarchical retrieval: recursively
  > cluster + summarize chunks into a tree, retrieve across levels instead of over a flat chunk
  > index. A direct alternative *and* possible complement to both flat vector RAG and graph walk —
  > lands on `goals/hybrid-retrieval-fusion-core` and `explorations/rag-retrieval-projection`.
- `CAPTURE.md:152-155`: Benjamin asked the packet to produce **two** recommendation kinds — new
  goal packets, **and** SPEC/PLAN amendments against already-open goals. That shapes the
  `landingPacket` choices below: most RAPTOR findings are amendments, not new packets.

---

## 1. Is RAPTOR already anywhere?

```sh
rg -li "raptor" --glob '!node_modules' --glob '!.git' .
```

```
./explorations/graphnosis-prior-art/CAPTURE.md          <- the pointer line above
./packages/foundation/primitive/data/src/generated/iana-media-types.ts   <- false positive
./packages/foundation/primitive/data/src/generated/iana-media-types.data.json
./explorations/agent-chat-interface/RESEARCH.md          <- "DocRaptor" (HTML→PDF vendor)
./explorations/legal-patent-kg-deepening/research/mined/R06.md  <- "Raptor/Rasqal" RDF parser
```

Conclusion: **only the capture pointer.** No design, no decision, no code.

(First run of this used `rg -ril` — `-r` is `--replace` in ripgrep, which silently turned the
pattern into `.` and matched everything. Friction receipt, noted below.)

---

## 2. Does the fusion seam exist in code? (No.)

```sh
rg -li -e "\brrf\b" -e "reciprocalRank" -e "fuseRanked" -e "RankedChannel" --glob 'packages/**/src/**'
# -> (no output)
```

`goals/hybrid-retrieval-fusion-core/ops/manifest.json` → `status: active`. The packet is
**specced but unimplemented**. `packages/foundation/capability/nlp-processing/src/Tools/` contains
BM25/corpus/similarity tools (`CreateCorpus.ts`, `QueryCorpus.ts`, `TextSimilarity.ts`,
`RankByRelevance.ts`, `ChunkBySentences.ts`) but no fusion module.

RRF is nonetheless **fully designed**:

- `explorations/rag-retrieval-projection/DECISIONS.md` — "LOCKED — RRF ownership": beep owns
  weighted RRF; "Candidate engines emit ranked channels; none owns fusion policy."
- `goals/hybrid-retrieval-fusion-core/SPEC.md:83-88` — constraint 3 (RRF basis `1/(k+rank)`,
  `k=60`, explicit per-channel weights) and constraint 6 (contributions expose rank, configured/
  effective weight, RRF component, weighted contribution; they sum to the fused score).
- `SPEC.md:90-93` — constraint 7: "Every result preserves its pre-verified `TextAnchor`. Fusion
  neither invents nor repairs spans." Constraint 8: output is candidate/evidence only; `ClaimGate`
  is still required.

**Constraint 7 is load-bearing for this paper**: a RAPTOR summary node has no pre-verified
`TextAnchor` because it is not a contiguous slice of any source. As the SPEC is written today,
summary nodes are structurally inadmissible to the fusion candidate pool.

---

## 3. Is there a vector index / embedder to put summary nodes in? (No.)

```sh
rg -li -e "embedding" -e "pgvector" -e "vector\(768\)" -e "hnsw" --glob 'packages/**/src/**' -g '!*generated*'
```

```
packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournal.ts     <- unrelated
packages/tooling/tool/cli/src/commands/VersionSync/internal/resolvers/DockerResolver.ts <- unrelated
packages/drivers/venice-ai/src/VeniceAI.service.ts        <- hosted POST /embeddings operation
packages/foundation/ui-system/editor/src/youtube-embed.tsx <- unrelated
packages/foundation/modeling/rdf/src/Iri.ts                <- "embedding" in prose
packages/foundation/modeling/nlp/src/Ontology/Kind.ts      <- prose
packages/foundation/modeling/nlp/src/Algebra/Monoid.ts     <- prose
```

```sh
rg -n -i -e "vector" -e "textsearch" packages/drivers/pglite/src/
# -> (no output)
```

Only live embedding surface is `packages/drivers/venice-ai/src/VeniceAI.service.ts:1117-1123`
(`createEmbedding`, `POST /embeddings`) — a **hosted** path, which the locked encoder decision
rules out for privileged text ("zero external egress",
`explorations/rag-retrieval-projection/DECISIONS.md` — LOCKED — encoder runtime).

Corroborated by the packet's own live audit,
`explorations/rag-retrieval-projection/MAP.md:59,61-64`:
> Local encoder | **No text-embedding driver found in `packages/**/src`** … The live 2026-07-14
> audit found no RRF, `tsvector`, or HNSW implementation in `packages/**/src`.

So the *entire* substrate RAPTOR needs at query time (dense index over an augmented node pool)
is gated behind two queued satellites: `retrieval-vector-projection` and
`retrieval-local-encoder` (`MAP.md:8-9`).

---

## 4. Is the clustering pipeline anywhere? (No.)

```sh
rg -li -e "\bumap\b" -e "gaussian mixture" -e "\bgmm\b" -e "bayesian information criterion" \
   --glob '!node_modules' --glob '!.git' .
```

```
./explorations/legal-patent-kg-deepening/research/mined/P095.md   <- "visualized through UMAP", a
                                                                     mined paper's own method
./packages/foundation/modeling/html/src/internal/Html.language-tag-registry.generated.ts <- false pos
./packages/foundation/modeling/html/data/iana/language-subtag-registry.txt               <- false pos
```

```sh
rg -li -e "soft clustering" -e "childIds" -e "parentIds" \
   --glob 'packages/**/src/**' --glob 'goals/**/*.md' --glob 'explorations/**/*.md'
# -> explorations/court-vocabulary-resolver/research/span-gated-resolver-algorithm-in-effect.md:47
#    ("parentIds HashSet" for courts-db parent filtering — unrelated)
```

```sh
rg -li -e "corpus augmentation" -e "synthetic document" -e "index growth" \
   --glob '!node_modules' --glob '!.git' .
# -> explorations/full-document-editor/MAP.md (unrelated)
```

No UMAP, no GMM, no BIC, no soft clustering, no multi-parent node model anywhere in the repo.
**Clean gap** — and per Table 9 (56.6 vs 55.8), it is a gap worth leaving open.

---

## 5. Is hierarchical / summary-node retrieval captured in any packet?

```sh
rg -n -i -e "hierarchic" -e "abstraction level" -e "multi-level retriev" -e "summary node" \
   -e "parent chunk" -e "small.to.big" -e "auto.merging" explorations/ goals/ --glob '*.md'
```

Relevant hits (everything else is CPC/IPC taxonomy hierarchy, `$I` identity hierarchy, or
ontology abstraction levels — not retrieval):

- `explorations/legal-patent-kg-deepening/research/mined/P048.md:13` — "Flat RAG retrieves
  independent text segments by semantic similarity and does not respect the different abstraction
  levels of cases, statutes, and interpretations."
- `P048.md:25-26` — LegalGraphRAG: "uses Leiden communities. Each community receives a **summary
  node**, enabling broad-to-specific retrieval from a legal theme to member cases."
- `P048.md:73` — "Community summaries risk lossy aggregation."
- `P048.md:83` — "use hierarchical communities for recall, but retain atomic evidence nodes and
  **prohibit community summaries from becoming unsupported claims**."
- `explorations/legal-patent-kg-deepening/research/mined/P099.md:28,32` — label-propagation
  community detection with incremental summary updates + periodic full refresh; community
  summaries in the generation context.
- `explorations/legal-ontology-landscape/research/04-ontology-informed-extraction.md:49` —
  > Generic GraphRAG community summaries as legal fact authority — **verdict: reject.** Microsoft
  > GraphRAG-style community summaries can help exploration and retrieval, but they should not be
  > the authority for patent/email facts. Repo already has a narrower validate-before-admit loop.
- `explorations/atlas-synthesis/synthesis/21-external-memory-kg-donors.md:152-167` — GraphRAG's
  Leiden + community summarization described as "ahead-of-time" synthesis.
- `explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md:71-78` —
  pattern #3 "Hierarchical, fielded, layout-aware retrieval": "Score retrieval at exact span,
  enclosing region, and document levels." Target stream: hybrid retrieval +
  `goals/law-doc-structure-oa-slice`.

**Read:** the *graph* form of index-time summarization (community summaries) is captured and
already carries a locked "not an authority" verdict. The *tree/abstraction-hierarchy over text
spans* form — RAPTOR's actual contribution — is **not** captured anywhere. Multi-level scoring
(span / region / document) is captured once, at `t3-retrieval-citation-grounding.md:71`, but as
*structural* levels of the source, not derived abstraction levels.

---

## 6. The chunk contract — can it even hold a summary node?

`packages/foundation/modeling/nlp/src/Handoff/Contract.ts:321-332`:

```ts
export class TextChunk extends S.Class<TextChunk>($I`TextChunk`)(
  {
    id: ChunkId,
    kind: ChunkKind,
    provenance: Provenance,
    span: Span,
    text: S.String,
  },
  ...
```

`Contract.ts:183-185`:

```ts
export const ChunkKind = LiteralKit(["document", "paragraph", "sentence", "token"]).annotate(
  $I.annote("ChunkKind", { description: "Granularity of a text chunk (document/paragraph/sentence/token)." })
);
```

Also live: `packages/foundation/capability/langextract/src/VerifiedSpan/index.ts:231`
(`RawTextChunk { startChar, text }` + `reconstructSourceText` at :668, which **fails closed on
gaps/overlaps**), and `packages/foundation/capability/nlp-processing/src/Tools/ChunkBySentences.ts`
(sentence-safe chunking at a `maxChunkChars` budget — the char-based analogue of RAPTOR's
100-token sentence-safe splitter).

**Findings:**

1. `ChunkKind` is a **structural** granularity vocabulary (source-derived), with no member for a
   derived/abstractive node. RAPTOR's `layer` is an orthogonal axis.
2. `span` is **mandatory and non-optional** on `TextChunk`. A RAPTOR summary node is not a
   contiguous source slice, so it cannot be a `TextChunk`. Neither `children`/`childIds` nor
   `token_size` exists anywhere.
3. `ChunkBySentences` is the closest reusable brick to RAPTOR step (1) — but it is char-budgeted,
   not token-budgeted, and is exposed only as an agent-facing `Tool.make` contract.

---

## 7. Provenance / hallucination guard — beep is already stricter than the paper

- `docs/product/citation-grounding.md:34-53` — "**§2 The verbatim firewall**":
  > Normalization may locate; it may not speak for the source. … A quote crosses only when
  > `source.slice(start, end) === quote`. … Derived display and grouping views are recomputed
  > rather than treated as source truth.
- `packages/foundation/modeling/provenance/src/VerifiedTextAnchor.ts` (+ `TextAnchor.ts`,
  `SourceTextIdentity.ts`) — the anchor carries source identity and digest/version.
- `packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts`,
  `packages/epistemic/domain/src/values/ClaimGate/ClaimGateResult.model.ts` — the admission gate.
- `goals/citation-verified-span-substrate/SPEC.md:15-19` — non-goals explicitly exclude "Fuzzy,
  case-folded, or lesser-match authorization passes" and "Emitting normalized locator text instead
  of the exact raw source slice."
- Epistemic entity set (`packages/epistemic/domain/src/entities/`): `Activity`, `CandidateClaim`,
  `ClaimDisposition`, `Contradiction`, `EdgeVersion`, `Evidence`, `EvidenceVerification`,
  `UsageRecord`.

**Read:** RAPTOR's 4% summary-hallucination rate (a fabricated *relation*, "Ajor, Co-Tan's
sister") is exactly the failure the verbatim firewall was written against. beep's guard already
dominates the paper's — the paper never even evaluates provenance. The open question is not
"do we need a guard" but "does a derived summary node get a lane in the candidate pool at all",
and `hybrid-retrieval-fusion-core/SPEC.md` constraint 7 currently answers *no*.

---

## 8. Benchmark hygiene — already doctrine

`explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md:60-66`,
pattern #2 ("No-evidence/retrieved/oracle evaluation with contamination controls"), concrete first
step, targeting `goals/hybrid-retrieval-fusion-core`:

> Add a benchmark specification that reports exact-span and parent-region recall,
> retrieved-to-oracle gap, unsupported-context rejection, latency, and abstention.
> **Do not use KF1, perplexity, or overlap as an acceptance gate.**

That rule pre-empts RAPTOR's Appendix-H problem (winning only on a metric they redefined) without
any new work. Corroboration, not a gap.

```sh
rg -li -e "ndcg" -e "recall@" -e "mrr\b" -e "precision@" --glob '!node_modules' --glob '!.git' .
```
→ only research/mined notes plus `goals/legal-document-intake/research/embedding-bakeoff.md`; no
retrieval-eval harness in `packages/**/src`.

---

## 9. Incremental update

```sh
rg -li -e "index.time" -e "build.time summar" -e "offline summar" explorations/ goals/ packages/ \
   --glob '*.md' --glob '*.ts'
```
→ two unrelated hits. No index-time-synthesis concept in the repo.

Closest live rule, `explorations/rag-retrieval-projection/DECISIONS.md` — LOCKED — embedding
contract:
> Store model identity on every projection, never mix same-dimension vectors from different
> models, and **rebuild the full projection on a model change.**

So beep already accepts full-rebuild semantics for one trigger (model change). RAPTOR's global
UMAP/GMM/BIC fits would make *every document insert* a rebuild trigger — a different and much
worse regime, never discussed in the paper. `explorations/local-first-projection-sync` owns the
sync/fan-out boundary (`MAP.md:43`) and would inherit the pain.

Also relevant: `explorations/agent-memory-tiers-bitemporal-edges/research/memory-tier-decay-and-eviction.md:72`
already models MemGPT-style **recursive compressed summary on eviction** (working → episodic tier).
That is index-time recursive summarization in the *memory* strand, structurally the same operation
RAPTOR performs, captured on a different packet.

---

## 10. LLM substrate for the build-time summarization pass

Live: `packages/drivers/anthropic/`, `packages/drivers/xai/` (`XAiLanguageModel.service.ts`),
`packages/drivers/openai-compat/` (`OpenAiCompatLanguageModel.service.ts`),
`packages/drivers/venice-ai/` (`VeniceAiLanguageModel.service.ts`), and a shipped
provider-neutral extraction capability, `packages/foundation/capability/langextract/src/Service/`
(`goals/langextract-capability` → `completed-retained`; landed on main 2026-06-07/08).

So the *summarizer* half of a RAPTOR build is cheap here — the pattern for "LLM pass over a
document producing schema-decoded output" already exists and is in production (office-action
extraction rung, PR #265). The *embedder* half does not exist at all (§3).

---

## Friction receipts (for the packet ledger)

1. **`rg -r` is `--replace`, not `--regexp`.** `rg -ril "raptor" .` silently replaced the pattern
   with `.` and returned every file in the repo, including 40 lines of
   `iana-media-types.ts`. A near-miss false-positive on the very first search of a
   proof-is-the-point task. Prevention: always `rg -li` / `rg -l -i`, never fold `-r` into a
   flag cluster.
2. **`goals/hybrid-retrieval-fusion-core` reads as shipped and is not.** `MAP.md:7` says
   "**GRADUATED 2026-07-14**", `ops/manifest.json` says `status: active`, and
   `rg "\brrf\b" packages/**/src` is empty. "Graduated" means *an exploration produced a goal
   packet*, not *the goal packet shipped*. Anyone mapping prior art onto this seam will
   over-credit the repo unless they run the source search. Prevention: treat exploration
   `MAP.md` status words as pointers to a manifest, never as implementation state.
