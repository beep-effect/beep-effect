# Graphnosis whitepaper → beep-effect mapping — searches and raw evidence

Source note: `scratchpad/graphnosis/paper-whitepaper.md` (read in full, 1071 lines, two pages).
Graphnosis checkout: `/home/elpresidank/YeeBois/dev/Graphnosis` (v0.11.0, HEAD `7a19c4b8`).
beep-effect: `/home/elpresidank/YeeBois/projects/beep-effect15` @ `d1dfc4b3c1`, branch `main`, clean.

Date: 2026-08-06.

---

## 0. Graphnosis-side spot verification (the note's claims, re-checked)

Everything I re-checked in the note held. Commands and output:

```
$ rg -n "DECAY_FACTOR|nodeScores.set|scoreRule|additive" src/core/query/traverser.ts
29:  scoreRule?: 'max-wins' | 'additive';
202:  // With GNOSIS_SCORE_RULE=additive the three update sites accumulate path
208:  const additiveScoring = opts.scoreRule !== undefined
209:    ? opts.scoreRule === 'additive'
210:    : process.env.GNOSIS_SCORE_RULE === 'additive';
251:  const bestFirst = (opts.traversalOrder ?? 'best-first') === 'best-first' && !additiveScoring;
356:    const decayedScore = score * DECAY_FACTOR;
365:      if (additiveScoring) { nodeScores.set(edge.to, existing + neighborScore); }
369:      else { if (neighborScore > existing) nodeScores.set(edge.to, neighborScore); }
   ... (same guarded-max shape at the backward-directed site :385-389 and the undirected site :402-406)
467:    nodeScores.set(nodeId, baseScore * multiplier);
```
→ guarded max write CONFIRMED shipped; ablation is a typed option with an env fallback CONFIRMED;
`traversalOrder` default is `'best-first'` CONFIRMED (the note's §5.6 divergence).

```
$ rg -n "0.4|similar-to|shares-entity|WeakMap" src/core/query/synonym-expander.ts
19:const synonymCache = new WeakMap<KnowledgeGraph, { sig: string; map: SynonymMap }>();
41:    if (edge.type !== 'similar-to' && edge.type !== 'shares-entity') continue;
42:    if (edge.weight < 0.4) continue;
```
→ graph-derived query expansion CONFIRMED shipped.

```
$ rg -ni "deterministic|determinism" src/mcp/*.ts        # (no output)
$ rg -rni "negation_artifact|temporal_supersession|severity" src/   # (no output)
```
→ determinism-tier tool labels NOT in the OSS SDK; §8.2 triage NOT in the OSS SDK. Both CONFIRMED
absent, matching the note's §5.10 table. Anything matching SPEC.md §8 is a PROPOSAL.

```
$ rg -n "directedEdges|undirectedEdges" src/core/types.ts
182:  directedEdges: Map<EdgeId, DirectedEdge>;
183:  undirectedEdges: Map<EdgeId, UndirectedEdge>;
```
→ two edge maps over one node map CONFIRMED.

```
$ wc -l src/core/query/subgraph-serializer.ts    → 116
$ rg -n "token|truncat|2000|2_000" src/core/query/subgraph-serializer.ts
3:// Serialize a subgraph into a token-efficient format for LLM prompts
```
→ no token counter, no truncation. The "≤2,000 token" bound is NOT enforced. CONFIRMED.

```
$ rg -n "pctOverlap|medianReach" benchmarks/dual-graph-and-recall.json
32: "pctOverlap": 8.4      36: "medianReachDirected": 3
37: "medianReachUndirected": 90.5    38: "medianReachUnion": 107
```
→ the committed measurement is the 45k end only. CONFIRMED (the 13% end is not reproducible here).

---

## 1. beep-effect search log (every command that produced a verdict)

### Package topology
```
$ ls packages/
agents architecture-lab documents drivers epistemic foundation _internal law-practice ontology
shared tooling workspace
$ ls packages/epistemic/
client config domain server tables ui use-cases
$ ls packages/epistemic/domain/src/entities/  →  Activity CandidateClaim ClaimDisposition
   Contradiction EdgeVersion Evidence EvidenceVerification UsageRecord
$ ls packages/epistemic/domain/src/values/    →  ClaimDispositionStatus ClaimGate ClaimLifecycle
   ClaimProjection Contradiction EdgeEndpoint EdgeRelation EpistemicFixtureKey EvidenceSpan
   EvidenceVerification ExecutionGrant ExecutionRecord ExecutionVerdict GrantSet LogicalEdgeIdentity
```

### Adjudication contract (wp-01, wp-16)
```
$ rg -l -i "contradict" --glob '!node_modules' -g '!dist' .
   → packages/epistemic/{domain,tables,server,use-cases,client,ui}/... + goals/epistemic-contradiction-triage
```
`packages/epistemic/domain/src/entities/Contradiction/Contradiction.model.ts` ships three entities:
- `ContradictionCandidate` — immutable, digest-sealed (`candidateKey`, `candidateDigest`,
  `hasValidSeals()` recomputes evidence digest + candidate key + every proposal digest), bitemporal
  (`recordedAt`, `validFrom`, `validTo`).
- `ContradictionReceipt` — durable receipt even for duplicate-suppressed submissions, with `Principal`.
- `ContradictionDisposition` — append-only human review, `resolvedBy: Principal`, unique index on
  `candidateId`, decision is a tagged union `rejected | superseded`.

`packages/epistemic/domain/src/values/Contradiction/Contradiction.model.ts:562-566`:
```ts
detector: ContradictionDetectorIdentity.annotateKey({
  description: "Stable detector or caller name; it identifies provenance, not authority.",
}),
```
That single line is beep-effect's adjudication contract stated in a schema annotation.

`goals/epistemic-contradiction-triage/SPEC.md` "Non-Goals", verbatim:
> No automatic supersession from detection — the core's constraint stands
> (`goals/epistemic-bitemporal-edge-core/SPEC.md`); detection output is data, never an authority write.

Lifecycle: `goals/INDEX.md:21` → `epistemic-contradiction-triage` 2/5 phases, active, 2026-07-29.
`goals/INDEX.md:78` → `epistemic-bitemporal-edge-core` 4/4, done 2026-07-25.

### Dual graph (wp-02)
```
$ rg -ni "undirected" --glob '!node_modules' -g '!dist' -l
   → packages/foundation/modeling/schema/src/Graph/{Graph.transforms.ts,Graph.shared.ts,Graph.rebuild.ts,
     Graph.from-self.ts} + docs/exploration prose only. Zero hits under packages/epistemic|ontology|law-practice.
```
`packages/foundation/modeling/schema/src/Graph/Graph.shared.ts:48`:
```ts
export const GraphKindValue = LiteralKit(["directed", "undirected"]).pipe(...)
```
`Graph.rebuild.ts:100-110` — `if (encoded.type === "directed") { ...Graph_.directed() } return ...Graph_.undirected()`.
→ a graph value is directed XOR undirected. There is no value in the repo carrying both classes over
one node set. This is precisely the shape Graphnosis's Observation 1 is about.

Epistemic edges: `packages/epistemic/domain/src/values/EdgeRelation/EdgeRelation.model.ts:13`
```ts
const EdgeRelationBase = LiteralKit(["supports", "refutes", "contradicts"]);
const SymmetricEdgeRelationBase = LiteralKit(EdgeRelationBase.pickOptions(["contradicts"]));
```
Symmetry is handled by collapsing both endpoint orderings onto one `LogicalEdgeKey`, not by a second
edge class. One relation vocabulary, all authority-bearing, all directed-with-a-symmetric-subset.

Law-practice KG: `packages/law-practice/server/src/PracticeKg.queries.ts` — `kg_edge (subject_iri,
predicate, object_iri)`, directed SPO triples only. No associative class.

### Traversal scoring (wp-03, wp-13)
```
$ rg -n "betweenness|pagerank|centrality|shortestPath|dijkstra" --glob 'packages/**/src/**' -l
   → packages/ontology/client/src/aggregates/Session/Session.atoms.ts     (only hit; it is a viewer)
$ rg -ni "rrf|reciprocalRank|rankFusion" --glob 'packages/**/src/**' -l
   → (no output)
$ rg -ni "tie.?break" --glob 'packages/**/src/**' -l
   → packages/tooling/library/repo-utils/.../TSCategory.model.ts
     packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts
```
→ **no graph traversal scorer exists in beep-effect at all.** `goals/hybrid-retrieval-fusion-core`
is 0/4 phases (`goals/INDEX.md:24`), and its SPEC constraint 11 says "Keep graph input optional and
rank-only. No graph producer, BFS, driver, or authority behavior enters this goal."
`explorations/rag-retrieval-projection/MAP.md` lists `citation-graph-retrieval-channel` as a **gated
follow-on** ("bounded BFS ... NET-NEW", gate = "live ODP edge-availability spike").

Fusion-core SPEC constraint 5 (already ratified) is the closest live analogue of the determinism idea:
> "Within tiers, weighted RRF applies; remaining ties use one documented stable comparator
> independent of map iteration order."
It does **not** state ranking purity (no wall clock, no access-metadata mutation) as a constraint.

### Ambient-env impurity (wp-04)
```
$ rg -n "process.env" --glob 'packages/{epistemic,ontology,law-practice,documents,agents}/**/src/**'
   → 3 hits, all JSDoc prose about *child-process* env injection for provider CLIs
     (packages/agents/domain/src/entities/ProviderInstance/*). Zero ambient reads.
```
→ beep-effect already routes options through `Config`/`Context.Service`. The exact failure Graphnosis
fixed in v0.10.0 cannot occur in beep-effect's domain slices.

### Query expansion (wp-05)
```
$ rg -ni "synonym|queryExpansion|expandQuery" --glob 'packages/**/src/**' -l
   → packages/tooling/library/repo-utils/src/JSDoc/*  (JSDoc tag synonyms — unrelated)
```
→ no corpus-derived synonym expansion anywhere. Bricks that exist:
```
$ rg -ni "tf-?idf|bm25|cosineSimilarity|jaccard" --glob 'packages/**/src/**' -l
   packages/drivers/wink/src/internal/bm25.ts, WinkVectorizer.service.ts, WinkCorpus.service.ts
   packages/foundation/modeling/nlp/src/Core/Vectorization.ts
   packages/foundation/capability/nlp-processing/src/Tools/{TextSimilarity,BowCosineSimilarity,
     TverskySimilarity,ExtractKeywords,CreateCorpus}.ts
   packages/law-practice/server/src/PracticeKg.fts.ts   (BM25 over the offline bundle)
```

### Prompt wire format + enforced result cap (wp-06, wp-22)
```
$ rg -n "budget|maxBytes|truncat" packages/law-practice/server/src/PracticeKg.tool-handlers.ts
58:  budgetBytes: number,
71:    return estimateJsonSize(data) <= budgetBytes ? O.some({ data, tier }) : O.none();
78:      (count) => estimateJsonSize(toColumnarEnvelope(A.take(minimalRows, count))) <= budgetBytes
84:      truncated: fitting < A.length(rows),
```
`packages/foundation/capability/mcp-kit/src/FieldTier.ts` — three progressive tiers
(`minimal`/`balanced`/`complete`) as real `Schema.Struct` variants, null-stripping, columnar reshape,
plus `FetchableHandle` (UUID+TTL) as the escape valve when even `minimal` will not fit.
→ beep-effect **enforces** its result cap. Graphnosis does not (see §0). beep-effect is ahead here.
What beep-effect does **not** have: an edge-bearing, id-compressed graph rendering
(`n1 -[summarizes:0.9]-> n5` / `n5 ~[shares-entity:0.4]~ n9`). Its envelope is row/columnar JSON.

### Determinism tier in the tool contract (wp-07)
```
$ ls packages/foundation/capability/mcp-kit/src/
ApiKeyRequired.ts FieldTier.ts index.ts McpCaller.ts SanitizedSpan.ts SourceAuth.ts TierGate.ts
ToolAnnotations.ts ToolkitComposition.ts
$ rg -n "readOnlyHint|destructive|idempotent" packages/foundation/capability/mcp-kit/src/
ToolAnnotations.ts:43,46,53  destructive / idempotent / readOnly  → four MCP hints
SanitizedSpan.ts:246-249     readOnlyHint / destructiveHint / idempotentHint / openWorldHint
```
→ four MCP hints yes; **no determinism/replayability tier**. `idempotentHint` means "repeat calls add
no effect", which is not "identical input → identical result".
`TierGate.ts` / `packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts` are an
*authority* gate (write-ahead `ExecutionDecisionRecord`, session-frozen grants, reason-free refusal),
a different axis entirely. `FieldTier` is a *size/disclosure* axis. Neither is determinism.
`goals/mcp-kit` exists as a packet.

### Indelibility + as-of (wp-10, wp-12)
```
$ rg -n "validFrom|validTo|recordedAt|relation" packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts
6: * (`[validFrom, validTo)`, `[recordedAt, expiredAt)`) BIGINT epoch millis
$ rg -n "asOf|knownAt|validAt" --glob 'packages/**/src/**' -l
   packages/epistemic/use-cases/src/EdgeAuthority/EdgeAuthority.commands.ts
   packages/epistemic/use-cases/src/ContradictionTriage/{rpc,ports,commands}.ts
   packages/epistemic/server/src/{EdgeAuthority,ContradictionTriage}/*.repo.ts
   packages/epistemic/client/src/ContradictionTriage/ContradictionTriage.atoms.ts
   packages/epistemic/ui/src/ContradictionTriage/*.tsx
```
→ two-axis (valid-time × transaction-time) as-of queries ship end to end, domain → repo → RPC → atoms
→ UI. Graphnosis's Theorem-1 corollary (`recall_as_of`) is NOT implemented in its OSS SDK
(note §5.10: "zero hits for `recall_as_of`, `recallAsOf`"). beep-effect is a full axis ahead.

### CRDT / op-log / LWW (wp-11) and encryption (wp-23)
```
$ rg -ni "last-writer|lastWriter|lww|crdt|opLog|op-log|deviceId" --glob 'packages/**/src/**' -l
   packages/foundation/ui-system/ui/src/hooks/use-scribe.ts        (speech, unrelated)
   packages/foundation/ui-system/ui/src/components/{speech-input,live-waveform}.tsx  (unrelated)
   packages/foundation/modeling/html/src/internal/Html.language-tag-registry.generated.ts (unrelated)
   → zero real hits.
$ rg -ni "xchacha|argon2|aes-256|libsodium|@noble/ciphers" --glob 'packages/**/src/**' -l
   packages/tooling/library/ai-metrics/src/{derived-storage,archive}.ts   (telemetry archive only)
   → no at-rest encryption in any product slice.
$ rg -ni "encrypt|aes|argon|chacha|nonce" packages/workspace/server/src/aggregates/Workspace/WorkspaceVault.repo.ts
   → (no output)
```
`explorations/local-first-projection-sync/BRIEF.md`, verbatim:
> "Buying a synchronization platform would import replication, write-back, and protocol scope far
> beyond accepted-record projection dispatch."
and its solution sketch is a durable-queue projection cycle with idempotency key
`{ authorityRecordId, authorityVersion, projectionTarget }` — one Postgres authority, no multi-device
merge. Multi-writer merge is an explicitly rejected scope, not an unnoticed gap.

### Confidence / decay / saturation (wp-14, wp-15)
```
$ rg -n "Confidence" packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts
46: export const Confidence = UnitInterval.pipe(...)
105: confidence: Confidence.annotateKey({ description: "Extraction confidence in the unit interval [0, 1]." })
$ rg -ni "saturat|reinforce|decay" --glob 'packages/**/src/**' -l
   → tooling/cli FallowQuality + AgentEffectiveness scoring, ui orb-background, nlp-processing
     _schemas/CreateCorpus. Zero hits in packages/epistemic|ontology|law-practice.
```
→ confidence is a detector-supplied unit interval, never reinforced by access and never decayed.
That is the *opposite* design from Graphnosis, and deliberate: beep-effect confidence is a property
of the evidence, not of usage history. Graphnosis's own `ReflectOptions.decay` doc-comment
(note §5.9) is the bug report for having done it the other way.

### Promotion gate (wp-16)
```
$ ls packages/epistemic/domain/src/values/ClaimGate/  →  ClaimGateResult.model.ts index.ts
$ rg -n "LiteralKit" packages/epistemic/domain/src/values/ClaimGate/ClaimGateResult.model.ts
12: const ClaimGateSeverityBase = LiteralKit(["info", "warning", "violation"]);
90: const ClaimGateVerdict = LiteralKit(["admitted", "rejected"]).annotate(...)
$ rg -n "LiteralKit" packages/epistemic/domain/src/values/ClaimDispositionStatus/ClaimDispositionStatus.model.ts
12: const ClaimDispositionStatusBase = LiteralKit(["active", "rejected", "superseded"]);
```
Predicted→attested crossing: `CandidateClaim` entity → `ClaimGate` verdict → admitted claim;
`ContradictionCandidate` → `ContradictionDisposition` → atomic `SUPERSEDES`. Two distinct tables and a
typed gate per crossing, plus `GovernedTierGate`'s write-ahead ledger. The invariant is enforced by
table separation + a typed verdict, which is a strictly stronger expression than a file boundary.

### Evidence bundles (wp-17, wp-18, wp-25)
```
$ head -50 goals/epistemic-contradiction-triage/ops/manifest.json
{"schemaVersion": "initiative-manifest/v2", ... "completionGate": {"operator":"yeet",
 "requiresPullRequest":true,"requiresMergeable":true, ...}, "currentSourceOfTruth":[...],
 "researchReports":[...], "agentLaunchers":[{"kind":"codex-goal","targetChars":3500,...}], "phases":[...]}
$ ls goals/epistemic-bitemporal-edge-core/history/
2026-07-25-p0-verdict.md  2026-07-25-p1-implementation.md  p0  reflections
$ rg -n "qa-inventory/v1" --glob '!node_modules' -l
   AGENTS.md, goals/recorded-qa-acceptance/history/rounds/*/inventory.json,
   goals/desktop-chat-surface/history/e2e-2026-07-31/round-5/inventory.json
$ rg -n "beepQA|Provenance" packages/drivers/exiftool/src/*.ts | head
   index.ts:30  "Public XMP-beepQA namespace config and provenance codec exports."
   Exiftool.models.ts:636 "Capture provenance embedded into QA artifacts under the `XMP-beepQA` namespace."
$ rg -ln "sha256|checksums" goals/*/ops/*.json
   goals/{file-processing-capability,uspto-prosecution-read,schema-first-v4-capabilities}/ops/manifest.json
```
→ beep-effect has schema-versioned manifests, per-round schema-validated QA inventories, and EXIF
capture provenance stamped into artifacts. What it does **not** have is Graphnosis's
`command_provenance` field: an explicit statement of *how confident the author is that the recorded
command is the one that actually ran* (`exact — confirmed by author` / `confirmed — author-attested`
/ a named gap). That field exists because Graphnosis's +6.0 Theorem-3 arm records argv but not the
`GNOSIS_SCORE_RULE` env var, so the arm is identified by its outcome (56.20%), not by provenance.
beep-effect has the same class of pain on record — auto-memory `yeet-verdict-misattribution`
("verdict.json step attribution untrustworthy") and `stale-artifact-false-greens`.

Seeded/deterministic test discipline:
```
$ rg -n "fcRuns|seed:" --glob 'packages/**/test/**' -l | head
   packages/epistemic/use-cases/test/{ContradictionTriage.rpc,ContradictionTriage.commands,
     EdgeAuthorityCommands,EpistemicUseCases}.test.ts, packages/workspace/**/test/*.ts, ...
$ rg -ni "golden" --glob 'packages/**/{src,test}/**' -l | head
   packages/drivers/openclaw/test/fixtures/golden-intent.expected.ts + acceptance tests
   packages/drivers/graph-3d/src/Graph3D.projection.ts
   packages/tooling/tool/cli/test/knowledge-semantic-delta.test.ts
```
→ seeded property tests and golden vectors are a live pattern. No *retrieval-quality* benchmark
harness exists (there is no retrieval engine to benchmark yet).

Source-audit discipline (`explorations/graphnosis-prior-art/research/SOURCES.md` template, verbatim
RULES block):
> "Never fabricate a URL/DOI/repo link... Licenses are load-bearing: copyleft (AGPL/GPL/MPL) upstream
> is CLEAN-ROOM reimplement only (pattern, not vendored code); permissive (MIT/Apache/BSD) may be
> ported WITH attribution; missing/unverified LICENSE ⇒ treat as reference only."
with a mined-corpus table keyed on `Upstream (repo)` + `Location (file:line)` + `Disposition`.
→ strictly stronger than the paper's Appendix C, which pins versions and quotes but carries no
license-disposition column.

### Model-free detection (wp-08, wp-09, wp-21)
`goals/epistemic-contradiction-triage/SPEC.md` Non-Goals, verbatim:
> "No semantic-graph or NLP contradiction *detection engine* in this packet: candidates arrive from
> callers (agents, pipelines); this packet owns their storage, lifecycle, matching identity, and
> approval transition — not natural-language inference."
→ the detector is an acknowledged, deliberate hole. Graphnosis ships one
(`src/core/optimization/reflection.ts:104-191`, entity-Jaccard > 0.6 ∧ tfidf cosine < 0.15 ∧ a
9-pattern lexical conflict-signal bank, both sides ≥ 80 chars) and it is model-free.

Lane taxonomy seed already in beep-effect:
`packages/epistemic/domain/src/values/Contradiction/Contradiction.model.ts:435`
```ts
const ContradictionMatchBasisKindBase = LiteralKit(["same-source-overlap", "independent-evidence"]);
```
`:927` `const ContradictionDispositionStatusBase = LiteralKit(["rejected", "superseded"]);`
→ two kinds and two dispositions; nothing that separates *genuine conflict* from *temporal
supersession* from *negation artifact* from *suppress* at detection time.

Typed abstention with a named reason already exists as a ratified shape in
`explorations/deterministic-doc-structure-extraction/BRIEF.md`:
> "reproduced against the exact source artifact, independently verified, and rejected with a typed
> reason when evidence is absent, ambiguous, stale, malformed, unsupported, low quality, or outside
> a rule's coverage."
```
$ rg -ni "abstain|abstention" --glob 'packages/**/src/**' -l   → (no output)
```
→ the *shape* is ratified in an exploration; no code yet.

### Declared vocabulary vs emitted census (wp-19)
```
$ rg -ni "unusedLiteral|literal.*coverage|optionsUsed" packages/tooling/ -l
   packages/tooling/library/repo-utils/src/schemas/TSConfig.ts
   packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts     (both false positives)
```
→ no repo check proves that every `LiteralKit` option is ever *constructed*. `$match` exhaustiveness
proves consumption coverage, not production coverage. Same class of overstatement the note found in
Graphnosis Appendix B (16 declared directed types, 11 emitted; 7 undirected, 3 emitted).

### Retrieval ablation methodology (wp-20)
`explorations/rag-retrieval-projection/MAP.md` "Inherited Risks", verbatim:
> "Fusion weights need representative-corpus calibration after the core seam lands."
and the Capability Check row: "The live 2026-07-14 audit found no RRF, `tsvector`, or HNSW
implementation in `packages/**/src`." → confirmed still true today (rrf rg above: no output).
→ beep-effect has a named, dated, unsolved need for exactly the ablation method the paper used.

### Tension worth recording
`explorations/rag-retrieval-projection/MAP.md` + `goals/hybrid-retrieval-fusion-core/SPEC.md` commit
beep-effect to **weighted RRF fusion of ranked channels**, with an optional graph channel that
"emits ranks and never owns fusion". Graphnosis's §5.2 taxonomy files exactly that under
"Multi-relational but fused" (MAGMA/HAGE) and argues against it in favour of co-equal
independently-queryable classes joined in one recall. beep-effect has already ratified the fused
design. The paper is a *dissent* against a ratified beep-effect decision, not a confirmation of it —
and the paper's own evidence for its side is Observation 1 (measured, but on LongMemEval haystacks,
not legal corpora) plus a +6.0 scoring-rule ablation that is about max-vs-additive *within* a
traversal, not about fusion-vs-co-equal. Do not reopen the fusion decision on this evidence.
