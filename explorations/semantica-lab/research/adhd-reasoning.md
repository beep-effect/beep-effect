# /adhd — Reasoning Opportunity Space (D15) — 2026-08-24

**Brief.** Problem: what a schema-first, provenance-carrying, Effect-native reasoning substrate
could uniquely be for `apps/labs/semantica`. Five isolated divergence branches (Codex Sol xhigh;
frames: remove-load-bearing-assumption, competitor, 3am-on-call, speedrunner, biology), banned
top-level defaults (wrap EYE / port Rete / semi-naive Datalog), 30-idea pool, scored and
clustered by Fable, top 3 syntheses deepened by three focused agents. Raw pool + deepen JSON in
session scratchpad; substance preserved here.

## Wide set (clusters, score chips [Novelty Viability Fit])

**A. Proof-ledger plays — "the proof DAG is the database"**
- Content-addressed proof identity (conclusion+rule-version+premise-ids+engine+context) [N7 V9 F9]
- Append-only causal fabric; conclusions = disposable materializations [N6 V9 F9]
- Crash-only inference journal; byte-identical replay; commit checksums [N6 V9 F9]
- Branchable proof timelines with semantic diffs across rule/engine versions [N7 V8 F8]

**B. Truth-maintenance plays — typed JTMS/ATMS reborn**
- Retractable support-set transactions; conclusions survive only with a live minimal
  justification [N6 V8 F9]
- Apoptosis for unsupported facts: tombstone events, permanent death certificates [N5 V8 F8]
- Contradiction-preserving proof workspace; adjudication policies as typed views [N8 V7 F8]
- CDCL-style learned clauses doubling as conflict resolution and proof certificates [N8 V5 F6]

**C. Operability plays — bound everything, degrade typed**
- Budget algebra in rule schemas; typed truncation FACTS when limits fire [N6 V9 F9]
- Bounded-effect certificates (strata, monotonicity, termination measure) checked pre-run
  [N7 V8 F9]
- Two-phase inference membrane: isolated compute → atomic publish [N5 V9 F9]
- Counterexample capsules: shrink failures into gold-suite fixtures [N7 V9 F8]
- Counterfactual provenance queries ("what retraction kills this conclusion") [N7 V8 F8]

**D. Substrate-abuse plays (speedrunner) — mostly instructive traps**
- Git objects as proof store [N8 V5 F6] · XPath/MutationObserver joins [N8 V2 F4] ·
  BDD witness paths [N8 V3 F5] · packrat parse-forest proof DAG [N8 V3 F5] ·
  Bun build-graph as TMS [N7 V4 F6]

**E. Schema-native inference plays — reasoning starts at the boundary**
- Extraction as proof-producing construction: typed evidence graphs, no ingestion boundary
  [N7 V8 F9]
- Rules as schemas of admissible proof shapes; inference = typed proof search [N9 V6 F8]
- Schema constructors as bidirectional inference lenses [N8 V5 F7]
- Claims as replayable Effect workflows owning premises/invalidation/replay [N7 V6 F7]

**F. Bio-adaptive plays — later-stage optimization**
- Antibody proof-template caches (clonal expansion = memoized unification) [N7 V6 F6]
- Synapse-weighted dependency edges steering incremental scheduling [N7 V6 F6]
- Stigmergic work allocation via proof pheromones [N8 V4 F5]
- Rule populations evolved against gold proofs [N8 V5 F6]

## Converge

Shortlist:
1. **Proof-ledger kernel** (A+B): highest compound viability×fit; makes D16 concrete.
2. **Budget-certified rules + counterexample capsules** (C): the operability spine; directly
   serves the eval gold suite and the 3am story.
3. **Evidence-graph construction + contradiction-preserving workspace** (E+B): the
   charter-defining move — construction and reasoning share one substrate.
4. ★ **Rules as proof-shape schemas** (E): the non-obvious pick — Curry-Howard-flavored,
   "schema is truth" taken to its logical end. Not deepened separately; adopted as the *design
   language* for how rules are modeled inside 1–3 rather than a fourth workstream.

Traps (flagged, with reason):
- Git-plumbing-as-runtime-DB — content-addressing absorbed into idea 1; git itself is an
  operational tar pit inside a desktop app.
- XPath/MutationObserver joins — welds the kernel to the webview; runtime-placement decision
  forbids exactly this.
- Packrat/SPPF proof forests — memo tables vs the 2GB RSS budget; ambiguity ≠ justification.
- Bun build-graph TMS — file-granular caches lack minimal-support semantics; keep as lens only.
- Bio-scheduling layers (F) — optimizations before a kernel exists; park until post-M1.

## Focus (deepened; full JSON in scratchpad, key content inline)

### 1. Proof-ledger kernel
PGlite stores only immutable content-addressed proof nodes + append-only ledger commits; EAV
conclusions and Rete memories are rebuildable indexes. Proof identity = hash of the canonical
Effect Schema encoding (conclusion tuple, versioned rule id, sorted premise proof ids, engine
semantics version, eval context). Each input delta runs the v3 Rete as a transaction emitting a
proof-DAG patch + resource meter + checksum-linked commit; Tauri observes committed heads only.
Reverse support edges + minimal-justification sets in derived tables drive tombstone-emitting
retraction. Rule/engine upgrades fork a ledger head, replay, and semantically diff. The gold
suite becomes the replay contract (expected conclusions AND canonical proof subgraphs,
byte-for-byte).
**Load-bearing risk:** canonicalization drift (schema revisions / Bun–Tauri boundary / engine
upgrades) silently breaking proof identity and replay.
**First step:** `CanonicalProofNodeV1` schema + deterministic byte encoder + hash; one RDFS gold
case asserting stable hashes across premise-order permutations and cold replays.
Children: dual-head semantic diff runner · proof-aware Rete cache keyed by ledger head ·
portable offline-verifiable proof bundles · counterfactual retraction preview · resource-bounded
inference receipts.

### 2. Budget-certified rules + counterexample capsules
Rules are schema values whose certificate declares recursion stratum, monotonicity class,
termination measure, fan-out bound, provenance obligations; decoding compiles both the Rete plan
and a hash-bound certificate verdict. Execution in an isolated Scope against a read snapshot;
limits fire typed `InferenceTruncated` facts (rule hash, counters, last complete proof node);
a validator checks certificate/plan agreement + DAG closure before ONE atomic PGlite publish.
Failures shrink deterministically into capsule fixtures consumed by the gold suite.
**Load-bearing risk:** certificate soundness — data-dependent joins/recursion defeating static
analysis (unsound admission, or bounds so conservative real rules get rejected).
**First step:** `RuleCertificate` schema + pure `compileRuleCertificate` validator beside the v3
Rete compiler; one recursive RDFS fixture proving hash-binding and an undersized depth budget
producing the expected proof-linked truncation fact.
Children: certificate synthesis with reviewed escape hatches · truncation facts as resumable
checkpoints · adversarial capsule promotion · budget provenance as ordinary query surface ·
differential membrane oracle (Rete vs reference Datalog).

### 3. Evidence-graph construction + contradiction-preserving workspace
The evidence graph is the ONLY write model: parsers, manual edits, and LLM extraction emit
schema-validated claim batches (spans, confidence, transformation lineage) appended in one
transaction and streamed straight into the Rete — no ingestion/reasoning handoff. Every
activation persists an InferenceEvent referencing exact premise event ids; contradictions stay
as independently addressable nodes linked by typed conflict witnesses; adjudication policies
(strict / defeasible / user-adjudicated) are typed projections over the same append-only graph.
Engine disagreements are durable witness events the gold suite can compare.
**Load-bearing risk:** stable identity + invalidation semantics across re-extraction and replay
(duplicated claims → unsound adjudication views).
**First step:** EvidenceClaim / SourceSpan / ConflictWitness / EvidenceBatch schema slice + one
PGlite transaction appending a hand-authored batch, feeding Rete, persisting InferenceEvents,
proven by one RDFS gold fixture end-to-end.
Children: deterministic extraction replay (hash extractor+prompt+span+artifact) · policy views
as compiled queries · cross-engine disagreement witnesses · contradiction-guided construction
(conflicts drive the next extraction).

## Synthesis (the position)

These are not three competing options: **1 is the truth substrate, 2 is the execution
discipline, 3 is the construction boundary** — together they are one coherent NET-NEW substrate
shape ("proof-ledger + certified execution + evidence workspace"), with ★ (rules as proof-shape
schemas) as its design language. Per A6 this whole shape enters the reasoning bake-off as the
**dated NET-NEW spike candidate** with the three named first-steps as its kill-criteria probes;
the wrapped external engine (EYE-class for RDF suites) remains the pick-one baseline it must
beat via ablation.

## Provocation

Rule induction against the gold proofs: evolve bounded populations of typed predicate-tree
rules whose fitness is proof-DAG agreement with G-entailment — the lab writing its own rules
under the same certificates and capsules that govern human-authored ones. Out of scope for M1;
a standing invitation for the evals spine to become a self-improving loop.
