# Graphnosis -> beep-effect mapping — territory: dual-graph data model & mutation semantics

Mapped against the live checkout at `/home/elpresidank/YeeBois/projects/beep-effect15`
(branch `main`, HEAD `d1dfc4b3c1`). Source survey:
`scratchpad/graphnosis/survey-graph-model.md`. Graphnosis clone:
`/home/elpresidank/YeeBois/dev/Graphnosis` @ `7a19c4b`.

---

## 0. The one-paragraph verdict

beep-effect is **ahead** of Graphnosis on everything temporal and everything
identity-shaped, and **behind** on everything retrieval-shaped — which is exactly
the split you would predict from the two packet pipelines. The bitemporal edge
authority (`goals/epistemic-bitemporal-edge-core`, `completed-retained`) makes
Graphnosis' single most-praised idea (gai-02, the `validUntil` dual-meaning split)
structurally unrepresentable in beep: two half-open axes with `Option` open ends,
no sentinel dates, no `isLatest` flag, and no delete surface at all. Conversely
there is **no scored graph traversal anywhere in beep-effect** — no association
edge layer, no score propagation, no budget/selection policy, no chunk-level
re-ingest path. Six of the fourteen findings land in that hole, and the sharpest
one (gai-03) lands in a hole beep does not yet know it has: a durable rejection
vocabulary exists, but nothing on the ingest path reads it.

---

## 1. Repo topology relevant to this territory

What exists, verified:

| Concern | Where it lives | Shape |
|---|---|---|
| Bitemporal edge authority | `packages/epistemic/{domain,tables,use-cases,server}` | `EdgeVersion` rows, `RecordEdgeFact`/`SupersedeEdgeFact`/`EdgeAsOfQuery` commands, Postgres repo with row-locked supersession |
| Claim admission + disposition | `packages/epistemic/domain/src/values/{ClaimGate,ClaimLifecycle,ClaimDispositionStatus}`, `packages/epistemic/server/src/ClaimDisposition` | `candidate -> shape_valid -> consistency_checked -> admitted`; dispositions `active|rejected|superseded`, append-only |
| Practice knowledge graph | `packages/law-practice/{domain,tables,server}` — `KgNode`, `KgEdge`, `KgBuild`, `PracticeKg.projections.ts`, `PracticeKg.fts.ts` | Structural entity spine only (client -> docket_family -> docket -> application -> patent -> document) + a deterministic DuckDB BM25 projection. Rebuilt wholesale as a read-only bundle. |
| Graph schemas / traversal | `packages/foundation/modeling/schema/src/Graph/*`, `packages/foundation/modeling/nlp/src/Graph/*` | `GraphKind = directed|undirected`, `NodeIndex`/`EdgeIndex`, `TraversalOrder = dfs|bfs|topo`, map/fold/filter over `DirectedGraph`. **Unweighted.** |
| Source-text provenance | `packages/foundation/modeling/provenance/src/SourceTextIdentity.ts`, `packages/workspace/server/src/SourceText/WorkspaceSourceTextResolver.ts` | `SourceTextIdentity { sourceDigest, textDigest, extractor{name,version}, normalizationVersion }`, fails closed on extractor mismatch |
| Canonical digests | `packages/foundation/modeling/schema/src/Sha256.ts`, `packages/epistemic/domain/src/values/internal/CanonicalJson.ts` | SHA-256; one canonical-JSON encoder, stated as "one implementation on purpose" |
| File-sync engine | `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts` | Whole-file digest sync with move/rename detection; a documented duplicate-content tie-break |
| Planned retrieval fusion | `goals/hybrid-retrieval-fusion-core` (active, P0 not started), `explorations/rag-retrieval-projection` (active, stage `graduate`) | Weighted RRF over ranked channels; graph channel is explicitly **rank-only, no BFS producer** |

Landing-packet candidates used below:

- `explorations/graphnosis-prior-art` — this mining campaign's own packet (stage `research`).
- `explorations/epistemic-belief-view-revision` — active, stage `capture`. Owns
  "which assertion do we currently believe, under a named policy, for a named
  principal, at a named `(validAt, knownAt)`". The natural home for every
  retirement/visibility/clock finding.
- `explorations/rag-retrieval-projection` — active, stage `graduate`. Owns the
  queued `citation-graph-retrieval-channel`, dedup and encoder satellites.
- `goals/hybrid-retrieval-fusion-core` — active, P0. Owns RRF, weights,
  tie-breaks, contribution accounting.

---

## 2. Searches run (the proof ledger)

Commands run from the repo root. `NO MATCHES` means rg exited 1 with no output.

```
rg -c "similar-to|shares-entity|co-occurs|sharesTopic" packages -g '*.ts'
  -> NO MATCHES                      (no association edge vocabulary anywhere)

rg -c "decayFactor|decayedScore|scorePropagation|propagateScore|hopDecay" packages -g '*.ts'
  -> NO MATCHES                      (no score propagation / weighted walk)

rg -c "structuralExpansion|structural node|conductScore" packages -g '*.ts'
  -> packages/foundation/modeling/nlp/src/Graph/Schema.ts:1
     (a doc-comment distinguishing structural vs linguistic EDGE relations;
      not a budget policy)

rg -c "reingest|re-ingest|blocksReingest|consumedMatches|incremental append" packages -g '*.ts'
  -> NO MATCHES

rg -c "crossGeneration|cross-generation|generation edge" packages goals explorations -g '*.ts' -g '*.md'
  -> NO MATCHES

rg -li "chunk" packages -g '*.ts' -g '!*test*'
  -> only tooling (docgen, StepExec, Bytes), jsonld streaming, config schemas,
     and the stateless MCP tool
     packages/foundation/capability/nlp-processing/src/Tools/ChunkBySentences.ts.
     No document chunker, no chunk-keyed store.

rg -li "orphan|prune" packages -g '*.ts' -g '!*test*'
  -> only Yeet/Worktree/Docgen/Libpff/Box tooling. Nothing in product packages.

rg -i "tie-?break" packages -g '*.ts'
  -> packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:195
     packages/foundation/primitive/data/test/mime-types.test.ts:79
     packages/tooling/library/repo-utils/src/JSDoc/models/TSCategory.model.ts:461,626
     (i.e. exactly one product-side tie-break, and it is about file moves)

rg -ci "mutation test|stryker" packages standards docs goals explorations
  -> only inside research corpora (langextract report, a compiled paper).
     No mutation-testing practice in the repo.

rg -n "analyzerAdapterId|policyId|pipelineVersion|extractorVersion|modelIdentity|embeddingModel|encoderId" packages -g '*.ts'
  -> only packages/workspace/server/test/WorkspaceSourceTextResolver.test.ts
     (test-local naming) — the shipped field is `SourceTextExtractor{name,version}`

rg -n "deletedAt|deleted_at" packages -g '*.ts' -g '!*test*'
  -> packages/foundation/modeling/schema/src/DomainModel.ts:36 (legacy default field)
     plus Corpus/RecycleBin CLI code. No epistemic entity carries it.

rg -n "confidence" packages -g '*.ts' -i | grep -v test
  -> documents FilingDecision* (LLM classifier threshold), wink/libpff extraction
     confidence, OfficeActionReview:91. No confidence column on any persisted
     epistemic entity.

rg -n "bytesToHex\(sha256\(" packages -g '*.ts' -g '!*test*'
  -> 7 sites (LogicalEdgeIdentity:409, GrantSet:339, ExecutionRecord:447 & :806,
     EvidenceVerification:117, Contradiction:1108, VaultSyncEngine:102,
     DmsMirrorFixture:248)
```

Files read in full or in relevant part:

- `packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts`
- `packages/epistemic/use-cases/src/EdgeAuthority/EdgeAuthority.{commands,ports}.ts`
- `packages/epistemic/server/src/EdgeAuthority/EdgeAuthority.repo.ts` (readLatest)
- `packages/epistemic/server/src/ClaimDisposition/ClaimDisposition.repo.ts`
- `packages/epistemic/domain/src/values/ClaimDispositionStatus/ClaimDispositionStatus.model.ts`
- `packages/epistemic/domain/src/values/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts`
- `packages/epistemic/domain/src/values/internal/CanonicalJson.ts`
- `packages/foundation/modeling/provenance/src/SourceTextIdentity.ts`
- `packages/workspace/server/src/SourceText/WorkspaceSourceTextResolver.ts`
- `packages/foundation/modeling/nlp/src/Graph/Schema.ts`, `GraphOps.ts` (export list)
- `packages/foundation/modeling/schema/src/Graph/Graph.{primitives,edge}.ts`
- `packages/law-practice/domain/src/values/{KgNodeKind,KgEdgePredicate}/*.model.ts`
- `packages/law-practice/server/src/PracticeKg.{projections,schemas,host,claims}.ts`
- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts` (partial)
- `packages/documents/server/src/aggregates/Document/FilingDecisionLlm.ts`
- `packages/shared/domain/src/entity/BaseEntity.ts` (field list)
- `packages/foundation/modeling/schema/src/DomainModel.ts`
- `goals/hybrid-retrieval-fusion-core/{README,SPEC}.md`
- `explorations/rag-retrieval-projection/{MAP,DECISIONS,RESEARCH}.md` (greps)
- `explorations/epistemic-belief-view-revision/README.md`, `ops/manifest.json`
- `explorations/graphnosis-prior-art/{CAPTURE.md,ops/manifest.json}`
- `standards/memory-architecture/04-decision-log.md` (bitemporal port entry)

---

## 3. Finding-by-finding

### gai-01 — both edge layers in one frontier pop — **partial** (value 4)

beep has a *directed structural* graph (`KgEdgePredicate`, 9 predicates, all
hierarchical/lineage: `has_docket_family`, `files_as`, `continuation_of`, …) and a
*lexical* channel (`PracticeKg.fts.ts`, deterministic DuckDB BM25). It has
`GraphKind = ["directed","undirected"]` as a **schema-level kind**
(`Graph.primitives.ts:154`) and `TraversalOrder = ["dfs","bfs","topo"]`
(`nlp/Graph/GraphOps.ts:124`) — but no graph instance carries both layers over one
node set, and no traversal propagates a score.

The important part is not the missing code, it is the **planned shape**.
`goals/hybrid-retrieval-fusion-core/SPEC.md` constraint 11: *"Keep graph input
optional and rank-only. No graph producer, BFS, driver, or authority behavior
enters this goal."* That is precisely the cheap version Graphnosis argues against:
a graph channel that emits ranks and gets RRF'd against lexical ranks produces two
ranked lists merged, not one neighbourhood a walk can cross. The scoping is
*correct for that packet* (it is a fusion packet, not a graph packet), but the
consequence has never been written down: beep's queued
`citation-graph-retrieval-channel` will, as specified, never let a typed-logic
edge and an association edge compete under one budget.

Recommendation: record it as a decision in fusion-core / rag-retrieval-projection,
not as work. The choice is real (channel-fusion is cheaper, more debuggable, and
composes with non-graph channels); it just should be a choice.

### gai-02 — `validUntil` carries two facts — **already-have, structurally better** (value 2)

Graphnosis' strongest idea is a workaround for a data model beep does not have.
`EdgeVersion` (module header, lines 1–11) is explicit:

> Both axes are half-open (`[validFrom, validTo)`, `[recordedAt, expiredAt)`)
> BIGINT epoch millis with an absent upper bound modelled as `Option.none` — there
> are no magic sentinel dates and no persisted `isLatest` flag, because "latest" is
> a question you ask the axes, not a fact you store.

"The permit expired" is `validTo` reached. "The row stopped being the record" is
`expiredAt` set. "The user retracted it" is a `ClaimDisposition` row with status
`rejected`. Three different facts, three different columns, zero overloading. And
`EdgeAuthority.ports.ts:24-38`: *"There is no delete surface at all. History is
the product."*

The one importable line is the security argument, not the mechanism: Graphnosis
found that `supersedes` — a member of a *public, caller-supplied* edge-type union
— had become a markerless, clock-free liveness switch. beep's `EdgeRelation` is
also a public `LiteralKit`. The rule "no `EdgeRelation` member may be read as a
visibility predicate" is worth writing down before someone adds one.

### gai-03 — retirement reason decides whether re-ingest may resurrect — **partial** (value 5)

**This is the highest-value finding in the set for beep.**

The reason vocabulary already exists and is already typed:
`ClaimDispositionStatus = ["active", "rejected", "superseded"]`
(`ClaimDispositionStatus.model.ts:12-18`, with a deliberate three-member argument
in its doc comment), and the repository is append-only *because* "a disposition
exists to remember a decision: editing one would erase the very thing it was
written down for" (`ClaimDisposition.repo.ts:3-7`).

What does not exist is anything that **reads it on the way in**. Concretely:

- `packages/law-practice/server/src/PracticeKg.claims.ts:311-350` derives
  `artifact:${digestHex}`, `claim:${digest}`, `evidence:${digest}` from the file
  bytes and persists. It never consults prior dispositions for that digest.
- `VaultSyncEngine.service.ts:738-792` re-syncs on a same-path digest change and
  queues a push. Whole-file granularity, no epistemic consult.
- `rg -c "reingest|re-ingest|blocksReingest" packages -g '*.ts'` -> NO MATCHES.

beep is exactly the system Graphnosis describes: a file-synced knowledge store
whose sources keep the original text after a human corrects the derived fact. The
failure mode — attorney rejects an extracted claim, the corpus refresh re-reads the
unchanged office action, the rejected claim returns as a fresh candidate — is
available today and nothing prevents it. Graphnosis' answer is four lines:
live blocks (ordinary dedup), supersede-tombs block, delete-tombs do not,
expired-but-not-retired blocks. beep's equivalent is
`blocksReadmission(disposition)` living in the belief-view selection policy.

The secondary lesson matters too: Graphnosis' *previous* test keyed on a
confidence threshold and failed in **both** directions. Encode intent as a
first-class typed reason; never infer it from a ranking weight.

### gai-04 — confidence is a ranking weight, never liveness — **already-have** (value 3)

No persisted epistemic entity carries a confidence field. `BaseEntity`
(`packages/shared/domain/src/entity/BaseEntity.ts:81-88`) is
`createdAt / createdByPrincipal / rowVersion / schemaVersion / source / updatedAt /
updatedByPrincipal` — no confidence, no `deletedAt`. Visibility is decided by
typed status and the two time axes.

Where a confidence scalar does exist it routes rather than gates, and the routing
carries its reason: `FilingDecisionLlm.ts:70-91` maps below-threshold to
`FilingOutcome{ kind: "inboxed", reason: "low-confidence" }` — the document is
visible in an inbox with a stated reason, never silently absent. That is exactly
Graphnosis' invariant ("content that disappears with no marker is the one outcome
the retirement discipline exists to make impossible").

Two live notes:

1. `packages/foundation/modeling/schema/src/DomainModel.ts:36` still ships
   `deletedAt` / `deletedBy` in `defaultFields`. Nothing epistemic uses it; it is
   a legacy soft-delete side door worth confirming stays unused.
2. The transferable half beep has *not* banked is the receipt rule: an audit
   receipt's `applied` field must be **read back from state after assignment**,
   not echoed from the argument. Graphnosis documents a real consuming app with a
   permanent graph-vs-log split caused by logging an increment while the graph
   received something else. That is the right shape for belief-view revision
   receipts.

### gai-05 — validate at the one load funnel, using the proof's bound — **partial** (value 3)

The funnel half is repo law: decode at the boundary, and every persisted artifact
has exactly one decode site (`PracticeKg.host.ts:28-36` decodes
`PracticeKgBundleManifest`; `EntitySchema` converters are the only row->entity
path). `UnitInterval` (`packages/foundation/modeling/schema/src/UnitInterval.ts`)
is the bounded-scalar primitive.

The *bound-selection* half has no analog because nothing propagates a weight yet.
`hybrid-retrieval-fusion-core/SPEC.md` constraint 3 says only "Weights are
explicit, non-negative, and associated with named channels" — non-negative is the
writer's convention, not a downstream-correctness bound. When fusion-core lands,
the bound should come from what the renormalization + literal-tier + tie-break
math actually requires, and it should be a `S.check(...)` on the ranked-channel
schema with a named typed error, not a runtime assert.

The failure mode Graphnosis names is worth quoting into the SPEC because it is
silent: an out-of-range weight makes best-first pops stop arriving in
non-increasing order, the dominance test discards strictly better entries, and
retrieval returns a confidently wrong ranking with no error anywhere.

### gai-06 — ranking ties break on content provenance, never on node id — **partial** (value 4)

fusion-core already *requires* the property and does not *name the key*:

> Within tiers, weighted RRF applies; remaining ties use one documented stable
> comparator independent of map iteration order. (SPEC constraint 5)
> Equal totals use the documented stable tie-break independent of insertion or
> hash-map iteration order. (acceptance criterion)

beep's situation differs from Graphnosis' in one way that makes it look safer than
it is: beep candidate ids are database entity ids, stable within a database — so
an id tie-break is not *fresh* arbitrary per build. But evidence in beep is
re-derivable from spans, corpora get rebuilt (`oppold-corpus-refresh`,
`PracticeKg` bundle regeneration), and entity ids are not stable across a rebuild
either. The provenance the comparator needs already exists and is already
verified: `packages/foundation/modeling/provenance/src/{TextAnchor,VerifiedTextAnchor}.ts`
plus `SourceTextIdentity.textDigest`.

Three sub-rules worth porting verbatim into the SPEC:

1. Key on `(sourceTextDigest, anchor start, anchor end)` — persisted, and
   recomputed identically from the same input.
2. Compare **field by field**, never a concatenated composite string: "there is no
   separator that provably cannot occur in a file path, and a wrong separator
   silently makes two different nodes compare equal." (beep's
   `LogicalEdgeIdentity` solves the same hazard by escaping every component before
   joining on `|` — either discipline works; the failure mode is what must be
   named.)
3. Test the comparator **directly**. Graphnosis measured two successive
   integration fixtures that each passed 20/20 against a surgically reverted
   comparator. Exact score ties are hard to produce through a fusion fixture, so
   the same inertness risk applies here — and beep already has a documented
   vacuous-test failure class.

### gai-07 — one canonical content hash, and every merge verifies content — **already-have** (value 2)

beep states the identical argument, in code, verbatim:

> `packages/epistemic/domain/src/values/internal/CanonicalJson.ts:6-8`
> One implementation on purpose — `canonicalJson` feeds both the grant-set seal
> and the ledger record seals, so a second private copy could drift and silently
> split the digests those seals are supposed to share.

And the hash is SHA-256 (`packages/foundation/modeling/schema/src/Sha256.ts`,
`Sha256Hex` / `Sha256HexFromBytes`), so "a hash match is a hint, never a proof"
does not bind: there is no realistic collision to defend against, and the
"do not widen it, that is a format break" tension does not exist.

Residual worth a crispen pass, not a packet: seven private
`bytesToHex(sha256(utf8ToBytes(...)))` wrappers, and the version-prefix convention
is inconsistent across them — `GrantSet` (`epistemic-grant-set/v1`),
`ExecutionRecord` (`epistemic-execution-decision/v1` / `-outcome/v1`),
`EvidenceVerification` (`evidence-verification-manifestation/v1`),
`LogicalEdgeIdentity` (`v1`), and `Contradiction.model.ts:1108`
(`const sha256Hex = (value: string) => bytesToHex(sha256(utf8ToBytes(value)))`,
**no version prefix at all**). One `digestOf(version, canonical)` next to
`CanonicalJson.ts` closes it.

### gai-08 — re-ingest dedup key excludes chunk order — **gap** (value 4)

No document chunker exists. `rg -li "chunk" packages -g '*.ts' -g '!*test*'`
returns tooling, JSON-LD streaming, and config schemas; the only chunk-shaped
product surface is the stateless MCP tool
`packages/foundation/capability/nlp-processing/src/Tools/ChunkBySentences.ts`.
Dedup in beep is whole-file: `VaultSyncEngine` keys on
`(localRelPath, contentDigest)` and detects moves via `pickMoveCandidate`
(`VaultSyncEngine.service.ts:195-213`) — a documented v1 heuristic that sorts
candidates lexicographically by old path and prefers a basename match. That is the
right instinct at file granularity and says nothing about sub-document identity.

This is a design decision that must be made before beep's first chunked ingest,
and Graphnosis has already paid for the answer:

- key on `(content, type, source.file, source.section)`;
- **exclude positional chunk order** — it indexes the whole document, so inserting
  one paragraph shifts every chunk below it, and order-matching re-stores the
  entire tail of an edited source as second live copies, compounding per edit;
- **include** `source.section` — omitting it let occurrence-order pairing give a
  Beta passage a stored Alpha node and a later Beta continuation a mislabelled
  `precedes` predecessor ("that edge is not dangling, it is wrong");
- preserve multiplicity with a consumed-matches set so the Nth identical passage
  consumes the Nth stored node wherever the text moved to;
- accept the residual: renaming a heading re-stores that tail under the new
  heading. "Explicit additive history beats silently mislabelled nodes."

And the primitive Graphnosis names as missing — a source-replacement operation
that retires the previous generation — beep can express natively as a supersession
over a source-generation logical edge. That is the cheapest place beep's
bitemporal core pays for itself in ingest.

### gai-09 — cross-generation edges — **gap** (value 3)

`rg -c "crossGeneration|cross-generation" packages goals explorations` -> NO MATCHES,
and there is no incremental similarity-graph builder to have the bug in (see gai-01
proofs). Landing it now is banking a **metric**, not an algorithm.

The transferable content is the diagnosis: the bug is invisible to seed-level
recall (the lexical index is corpus-wide, so both generations are found) and shows
up only in **traversal reach** — "it reaches them SEPARATELY, as unrelated results,
rather than as one neighbourhood a walk can cross". Any incremental graph channel
beep builds needs a reach metric, not just a recall metric, or this class of bug
is unobservable. Secondary: seed the degree cap from existing edges so two passes
share one budget rather than each spending the whole thing.

### gai-10 — derived-but-persisted structures carry their generating policy id — **already-have** (value 2)

Convergent design, three independent instances in beep:

1. **Fails closed on analyzer mismatch.**
   `SourceTextIdentity { sourceDigest, textDigest, extractor: {name, version},
   normalizationVersion }`
   (`packages/foundation/modeling/provenance/src/SourceTextIdentity.ts:71-145`),
   and `WorkspaceSourceTextResolver.ts:81-90` refuses with
   `extractor-unavailable` when the live extractor identity does not equal the
   pinned one. That is `analyzerAdapterId` + `AnalyzerMismatchError` exactly.
2. **The `'mixed'` honesty analog.** `PracticeKgSourceRuns`
   (`PracticeKg.schemas.ts:326-334`) records an omitted source run as
   `"excluded"` rather than by absence, with the reason stated in the doc:
   *"Recording exclusion explicitly, rather than omitting the run, is what lets a
   reader tell 'the refresh was deliberately left out' from 'this bundle predates
   the refresh'."* Same move as `ingestPolicyId: 'mixed'`.
3. **Per-row generation stamp.** `BaseEntity.schemaVersion`
   (`BaseEntity.ts:85`) travels on every row, the per-node
   `metadata.ingestPolicyId` analog; and `LogicalEdgeIdentity`'s
   `canonicalEncodingVersion` is folded into the digest so old and new keys can
   never collide in a table holding both.

Nothing to build. Worth citing in the graphnosis packet as external confirmation.

### gai-11 — pruning removes edges, never nodes — **partial** (value 3)

The doctrine already exists at the **authority** layer and is stated more strongly
than Graphnosis states it: `EdgeAuthority.ports.ts:24-38` — no update surface for
`supersedesId`, none for `fact`, "There is no delete surface at all. History is the
product." `ClaimDisposition` is append-and-read only.

What has no rule is the **projection/tuning** layer, because it does not exist yet:
`rg -li "orphan|prune" packages -g '*.ts' -g '!*test*'` returns only Yeet, Worktree,
Docgen, Libpff and Box tooling. When a retrieval tuner lands (edge thresholds,
degree caps, candidate pruning) it will sit outside the authority's guarantees, and
the boundary Graphnosis draws is the one to pre-commit to: *a retrieval-quality
heuristic may reduce prominence but may never destroy stored content, and "has no
edges" is a statement about the current graph, not about the value of the memory.*
The measured 2.1% / 2.4% silent loss is the argument; without the numbers it reads
as taste.

### gai-12 — gates on one resolved instant; which redundant guards ship — **partial** (value 3)

**Half already-have.** `EdgeAuthority.repo.ts:432-435`:

```ts
readLatest: Effect.fn("Epistemic.EdgeAuthority.readLatest")(function* (logicalKey) {
  const now = DateTime.toEpochMillis(yield* DateTime.now);
  return yield* readAsOfAt("readLatest", logicalKey, now, now);
}),
```

One instant, resolved once, used for both axes — so the two axes cannot disagree
mid-read. Every other path takes its instants from the command, so the repository
never reads an ambient clock on a write.

**Half missing.** Graphnosis' paired ruling — keep a redundant guard exactly where
it is directly exported, directly tested, and sits on a boundary future stages will
cross; delete it where no test can fail on its removal ("shipping a guard no test
can fail buys false confidence, not safety") — has no analog. beep has no mutation
testing (`rg -ci "mutation test|stryker"` finds hits only inside research corpora)
and its known failure class is the opposite one: tests that pass for the wrong
reason. This is the most usable criterion I have seen for that class, and it costs
a paragraph in a standards doc.

### gai-13 — three named time inputs — **already-have, and stricter** (value 3)

`EdgeAsOfQuery { validAt, knownAt }` requires **both** instants, with the doc
stating why they are independent: *"Holding `validAt` fixed and moving `knownAt`
forward replays how belief about one moment changed; that is the question a
non-bitemporal store cannot answer at all."* No defaults, so Graphnosis' bug —
a caller passing a historical ranking instant that silently re-admits content
forgotten after it — cannot occur: there is nothing to inherit from. And
`SupersedeEdgeFact.validTo`'s doc is the same rule from the other side: *"carries
the valid time of the INVALIDATING fact — never the wall clock at which the
correction was made."*

What is genuinely unbanked is the **prominence-vs-visibility clock split**, because
beep has no ranking clock at all yet. The moment fusion-core (or a belief view)
adds a recency term, the rule needs to already exist: the ranking instant must
never supply the membership instant, and the membership instant must default to
the wall clock while the ranking instant defaults to unset. Graphnosis' companion
ruling is also worth banking as beep's deterministic default: delete wall-clock
recency boosts, keep standing computed from serialized state that travels in the
artifact ("a ×1.3 boost for accessed-within-24h makes the same file and the same
query rank differently on Tuesday than on Friday").

### gai-14 — structural nodes conduct but never occupy a slot — **gap** (value 3)

beep already has the **vocabulary**: `KgNodeKind`
(`packages/law-practice/domain/src/values/KgNodeKind/KgNodeKind.model.ts:38-50`)
splits a structural spine (`client`, `docket_family`, `docket`, `application`,
`patent`) from content (`document`, `email_archive`), and its own doc example
names `["docket_family","docket","application","patent"]` as "the prosecution
spine". `nlp/Graph/Schema.ts` likewise separates structural from linguistic edge
relations.

What is absent is any **budget or selection policy** that consumes the
distinction, because there is no scored retrieval to have a budget
(`rg -c "structuralExpansion|conductScore"` -> one doc-comment hit only). So the
whole cost of banking this is one documented rule, and it should be banked before
the graph channel exists, because the two obvious policies are both wrong and the
right one is not obvious: **conduct always, seed when directly matched, occupy a
final slot only when directly matched.** Graphnosis measured the naive-inclusive
version at 18 of 30 budget slots going to headings against 12 to content, on
exactly the multi-source questions that need breadth most.

---

## 4. Antipatterns — does beep risk them?

| Graphnosis antipattern | beep risk | Evidence |
|---|---|---|
| Module-global mutable graph/db singletons + `withSingleton` swap hack | **No.** Every service is `Context.Service` + `Layer`; `PracticeKgBundle` is a Context service carrying host-resolved bundle state (`PracticeKg.host.ts:39-52`), and repositories are constructed per layer. The non-reentrancy hazard is unrepresentable. | `packages/law-practice/server/src/PracticeKg.host.ts`, `packages/epistemic/server/src/Layer.ts` |
| `eval('require')` for optional native deps | **No.** Repo law bans static `node:*` imports in typechecked src and the CLI enforces it (`lint:native-runtime` in `rootRepoLintPolicySteps`). | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1460` |
| Delete-everything-then-reinsert persistence, no FK on edge endpoints | **Partly, but deliberately.** `PracticeKg` bundles are rebuilt wholesale — but as an immutable read-only delivery artifact with a manifest, not as the write path for an incremental API. The epistemic authority is insert-only with real FKs. Worth confirming any future KG-refresh path does not inherit whole-rebuild semantics for incremental updates. | `PracticeKg.projections.ts`, `EdgeVersion.table.ts` |
| Documented degree cap not enforced on the second pass | **N/A today** (no edge builder). Becomes live the moment `citation-graph-retrieval-channel` ships two candidate passes. Bank it: any documented cap must be enforced and accounted in **every** pass that adds edges, or later passes seed from wrong counters. | — |
| Load-bearing semantics in an untyped `metadata` bag | **Low.** The asymmetry Graphnosis has (typed fields validated, visibility fields untyped) is inverted in beep: visibility is decided by typed columns and typed statuses. Untyped bags exist (`EdgeVersion.fact: UnknownRecord`, `KgNode.payload: jsonb UnknownRecord`) but carry payload, not liveness. The one to watch is `EdgeQualifiers` — a free-form string map that **does** partition logical identity; it is escaped and canonically encoded (`escapeQualifierComponent` owns `=` and `,`), so the injection hazard is closed, but any new semantics added there would be untyped. | `EdgeVersion.model.ts`, `LogicalEdgeIdentity.model.ts:299-321`, `KgNode.read-model-table.ts:76` |
| Agent guide contradicts the shipped invariants it teaches | **Yes, structurally.** `AGENTS.md`/`CLAUDE.md` is the first file every agent reads and states repo laws in prose. The lint policy has 20+ gates (`rootRepoLintPolicySteps`) covering effect imports, schema-first, jsdoc, docgen, goals doctor, roadmap refs — **none** checks a law statement in `AGENTS.md` against shipped code. The repo's own memory records a "stale artifact false greens" class. The architecture proof oracle (`AcceptedProofManifest`, byte-for-byte) is the closest existing mechanism and only covers generated architecture artifacts. Cheap mitigation: for each law that names a concrete symbol or default, cite the file:line, and let `lint:roadmap-refs`-style link checking catch the drift. | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1455-1490`, `packages/tooling/tool/cli/src/commands/Architecture/internal/AcceptedProofManifest.ts` |

---

## 5. Suggested landing summary

| Packet | Findings | Why |
|---|---|---|
| `explorations/epistemic-belief-view-revision` (active, capture) | gai-02, gai-03, gai-04, gai-12, gai-13 | It already owns "which assertion do we believe, under a named policy, at a named `(validAt, knownAt)`" and its open Q1 is naming the typed verdict families — `blocksReadmission` and the prominence/visibility clock split are literally that question. |
| `goals/hybrid-retrieval-fusion-core` (active, P0) | gai-01, gai-05, gai-06 | Weights, tie-breaks and contribution accounting are its acceptance criteria; gai-06 names the key its SPEC leaves unnamed. |
| `explorations/rag-retrieval-projection` (active, graduate) | gai-08, gai-09, gai-11, gai-14 | Owns the queued ingest/dedup/citation-graph satellites. These are pre-commitments, cheap now, expensive after the first ingest ships. |
| `explorations/graphnosis-prior-art` | gai-07, gai-10 (as convergence notes) | No work; record as external confirmation of existing beep design. |
