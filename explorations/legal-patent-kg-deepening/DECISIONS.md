# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-08-01 — packet home

**Question:** Where does this corpus-extraction effort live — new packet,
reopened `legal-ontology-landscape`, folded into the unlaunched Gold Intake
v2 campaign, or straight into `goals/semantic-foundation`?

**Answer:** New successor packet (`legal-patent-kg-deepening`), explicitly
building on — not invalidating — the graduated wave-1 findings and
semantic-foundation decisions, with cross-links both ways.

**Rationale:** Reopening a graduated packet muddies its closeout trail; Gold
Intake v2 is a repo-mining campaign whose contracts fit a paper corpus
awkwardly and it has not launched; going straight to the goal skips the
align/shape/adhd divergence this corpus warrants. Benjamin's rider: the new
packet must not be read as superseding wave-1 conclusions — they remain
standing inputs.

## 2026-08-01 — mining engine & quota routing

**Question:** Who reads the ~120 papers and ~24 repos, and where does the
`/deep-research` Workflow harness fit, given the standing codex-for-volume
doctrine vs this session's ultracode mandate?

**Answer:** Codex mines, the Workflow harness orchestrates and synthesizes:
`codex exec` (GPT-5.6 Sol, `--effort medium`) jobs are driven from inside the
Workflow scripts (Bash/codex-wrapper stages), writing per-source distillates
to this packet's `research/`; Anthropic agents run only the adversarial
verify + synthesis phases over the distillates.

**Rationale:** Matches the quota-arbitrage doctrine, wave-1's own captured
constraint ("all research/fetching via codex; Claude orchestrates and
synthesizes"), and Gold Intake v2's locked codex-only-mining decision, while
keeping deterministic orchestration and the deep-research verification
machinery. Rejected: pure-Anthropic Workflow (burns the scarce pool on ~4.4k
files of bulk reading), pure-codex end-to-end (loses adversarial verify).

## 2026-08-01 — intake depth

**Question:** Triage-then-deep-mine (gold-intake pattern) or full coverage?

**Answer:** Papers full, repos triaged: catalog + content-hash dedupe pass
first (noise excluded: cookies file, screenshots, duplicate PDFs); then a
distillate for EVERY unique paper and every `links.md` URL at codex medium
effort; the ~24 repos get a triage pass with xhigh deep-mines on survivors
only. FOPNet gets a dedicated deep-dive thread.

**Rationale:** The corpus is hand-curated — triage over the papers would
mostly say yes while risking silent drops; the repo set is bulkier and partly
redundant with wave-1 holdings (e.g. lkif-core), so triage earns its keep
there. Effort tiers mirror Gold Intake v2's locked medium-triage /
xhigh-deep-mine split.

## 2026-08-01 — deep-research track slicing

**Question:** How is the synthesis layer sliced, given tracks must run
sequentially (rate-limit memory: never 3+ parallel harness runs)?

**Answer:** Four thematic tracks, strictly one at a time, each landing a
verified synthesis note in `research/`:

1. Legal core ontology + Hohfeldian formalization.
2. Patent KGs + functional patent knowledge (carries the FOPNet priority
   thread).
3. Legal GraphRAG + temporal/diachronic norm reasoning.
4. Patent LLM authoring + multi-agent IP workflows (ODRL, Symboleo).

**Rationale:** Each theme routes to different downstream homes
(semantic-foundation; patent tooling / uspto-patent-driver-depth; epistemic
slice; OIP practice tooling), so separate verified syntheses keep routing
clean. Rejected: 2 fat tracks (routing needs a later split), 1 combined pass
(dilutes adversarial verify, buries FOPNet).

## 2026-08-01 — /adhd placement

**Question:** Where does `/adhd` divergence sit, and on what problem?

**Answer:** Post-synthesis, on integration plays: "given these findings, what
should beep-effect actually build/absorb?" Diverge/deepen branches run as
codex exec background jobs, critic inline (per the adhd-via-codex-fanout
pattern). Output feeds the align/shape stage as BRIEF candidates.

**Rationale:** Divergence works best with real material; up-front it
speculates about what the corpus might say. Rejected: up-front question
framing (the hand-curated corpus already implies its questions), both-ends
(adds a fan-out before any findings exist).

## 2026-08-01 — artifact contracts

**Question:** What contracts do distillates and syntheses land in?

**Answer:** Per-source distillates as packet `research/` notes PLUS a nugget
catalog and ROUTING-SEED reusing the `_gold-intake` v1 schemas, mapping each
finding to its downstream goal/packet; campaign ends with a HANDOFF doc.

**Rationale:** Routing is where the corpus pays off, and schema reuse lets
Gold Intake v2 dedupe against this campaign instead of re-mining the same
directory. Rejected: freeform notes only (routing stays prose-bound, no v2
dedupe ledger), catalog-only (loses the per-source provenance the verify
phase cites).

## 2026-08-01 — campaign staging & PR cadence

**Question:** Where does the run stop, and how does it land in PRs?

**Answer:** PR 1 (docs-only, immediately): packet skeleton with CAPTURE +
DECISIONS + ATLAS sync. Then the campaign runs (mining waves → four
sequential tracks → /adhd → catalog + routing seed); artifacts land as PR 2.
Campaign endpoint = syntheses + nugget catalog + ROUTING-SEED + HANDOFF;
BRIEF/MAP shaping is gated on Benjamin's sign-off in a follow-up /explore
session. Fetched third-party files (links.md targets, vendor ontologies)
stay gitignored under `assets/vendor/` with a committed manifest, per wave-1
precedent.

**Rationale:** Matches the standing grill-outcomes-as-docs-only-PR rule and
the Gold Intake v1 endpoint pattern (synthesis + routing seed + handoff,
then stop for sign-off). Rejected: run-through-shaping (bakes in unreviewed
framing), single end-of-campaign PR (long-running branch, violates the
grill-first pattern).

## 2026-08-01 — packet slug

**Question:** What is the packet called?

**Answer:** `legal-patent-kg-deepening`.

**Rationale:** Reads as the deepening pass over the strand `legal-ontology-
landscape` opened, without implying supersession. Rejected:
`patent-kg-harvest` (under-represents the legal-core/Hohfeld and GraphRAG
tracks), `legal-patent-ontology-kg-research` (wordy; "research" is redundant
for an exploration packet).

## 2026-08-01 — reconciliation grill: remo1 (constraint profiles)

**Question:** Do executable Hohfeld/FLINT correlativity invariants attached to
registry schemes supersede wave-1's SKOS-only registry stance?

**Answer:** No supersession — layered sequencing. Correlativity lands now as
Effect Schema constructs (LiteralKit eight-position domain + correlative bimap
in the consuming domain package; registry data untouched). Registry-carried
executable shapes route into the existing semantic-foundation **M4 Intake
ClaimGate Shapes** gate (bounded `ShaclValidationService` in
`@beep/semantic-web`; SPARQL remains unsupported) when workbench/intake
consumers prove need.

**Rationale:** Grounding showed the "challenge" was miscast: wave-1 locks *no
graph store or SPARQL engine for the registry*, while the SPEC already
sanctions bounded SHACL validation behind M4. Rejected: fast-tracking a
ConstraintProfile now (pulls M4 forward before its gate condition), and
schema-only-forever (forecloses data-driven workbench validation the SPEC
already plans).

## 2026-08-01 — reconciliation grill: remo2 (matter projections)

**Question:** Does a derived, queryable MatterProjection in practice-kg-mcp
violate the no-graph-store stance?

**Answer:** No — rows first plus an in-memory RDF lane. The contract is
`PracticeKgQuery`: typed Effect queries over materialized rows rebuilt from
accepted claims, never authoritative. Lineage/path queries may spin a
disposable in-memory `@beep/rdf` dataset session through the existing bounded
`SparqlQueryService` (the ontology-workbench Session pattern). No persistent
graph store; this entry is the scope note.

**Rationale:** The no-graph-store lock is scoped to the `@beep/ontology`
registry surface; memory-architecture doctrine already frames graph/search as
projections; the bounded in-memory machinery already exists in the workbench
slice. Rejected: relational-only (hand-rolls lineage queries the repo already
solved) and a persistent embedded store (genuine supersession nothing yet
justifies — revisit only if projection rebuild cost hurts in practice).

## 2026-08-01 — reconciliation grill: remo3 (episode ledger vs Cognee)

**Question:** Does the DraftingEpisode ledger with Cognee as a lossy
projection supersede the 2026-07-25 memory-architecture decision?

**Answer:** No — classify and clarify. The DraftingEpisode ledger is
law-practice **product records**: repo-native, authoritative, append-only.
Cognee's always-on dev-memory role is unchanged; it may additionally carry a
lossy, rebuildable projection of committed episode events for product
retrieval, with recent-raw-episode fallback, and is never their authority. A
clarifying entry lands in `standards/memory-architecture/04-decision-log.md`.

**Rationale:** The 2026-07-25 entry already binds "product tables are the
professional runtime's authority and NEVER become an operator-memory
backend"; this direction (operator tool projecting product records for
retrieval) was simply unwritten, which is why the /adhd lens flagged it.
Rejected: full demotion of Cognee for dev-memory too (unjustified
supersession), and classify-without-clarifying (the ambiguity would keep
generating false challenges).

## 2026-08-01 — reconciliation grill: slug set

**Question:** Keep the routing seed's five proposed exploration slugs?

**Answer:** Merge to four: `patent-drafting-promotion-gates` folds into
`patent-drafting-episode-ledger` as its first rung. Final set:
`legal-position-relator-runtime` (P1), `legal-rule-time-identity` (P2),
`patent-citation-candor-gate` (P1), `patent-drafting-episode-ledger` (P1,
absorbing limitation-support promotion gates).

**Rationale:** The deepen sketches make ClaimLimitationSupport a submachine
of the DraftingEpisode state machine sharing the same RuntimeApprovalGate —
two packets would split ownership of one schema. Rejected: keep-five
(divergent schema ownership risk) and consolidate-to-three (the candor gate's
substrate — uspto-prosecution-read + citation goals — is genuinely separate;
a merged wedge stops being problem-shaped).

## 2026-08-01 — reconciliation grill: first wedge + sign-off

**Question:** Which P1 wedge shapes first, and is the routing seed signed
off?

**Answer:** Signed off as amended (nine clusters → eight after the merge;
four proposed slugs; grill annotations resolved). First wedge:
`patent-citation-candor-gate`. BRIEF/MAP shaping may begin with that packet.

**Rationale:** Four of five /adhd frames converged on citation-event
reification independently; the first step is one failing CandorPolicy test
over existing PatentReference + verified-anchor substrate; it retires a live
duty-of-candor risk without waiting on any other wedge. Rejected as first:
relator runtime (foundational but blocks nothing), episode ledger (largest
scope; its limitation-support rung depends on citation-verified-span-substrate
P0), FunctionalUnit cluster (analysis tooling over risk-retiring capability).
