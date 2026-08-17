# Decisions

## 2026-08-13 — Wave 2 executed; park on routing triage

**Decision:** Record wave 2 as executed and keep the packet parked. The
approved “97 legal-NLP/extraction papers” was an aggregate-only count and was
largely consumed by July wave-1 deep reads, including the 144 June-29 papers
already noted. The operator ratified re-triage by definition.

Five first-page-grounded batches classified the 199-paper no-note backlog into
core 2 / extended 44 / excluded 153. All 46 core+extended papers were deep-read:
46/46 notes, zero failures. Synthesis lives outside the public repo at
`synthesis/wave2-synthesis.md` in the machine-local academia-2026-07 research corpus.

The synthesis found zero contradictions of the master ten findings and made 14
routing proposals, including four candidate explorations:
`legal-inference-policy`, `ontology-curation-governance`,
`evidence-source-policy-calibration`, and `ontology-lifecycle-qa`.

**Revival trigger:** The operator triages the synthesis routing table.
Proposals never auto-enter the packet tree.

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-07-25 — corpus scope

**Question:** Normalize only the new download, or fold in the standing
machine-local research library (1,161 PDFs) and reprocess everything?

**Answer:** New download only; **mark** overlap against the standing library
and the prior synthesis's 72 deep-read papers (hash + normalized-title match);
do not reprocess the old library.

**Rationale:** The old library was already partially mined (June-29 synthesis
triaged 449 of its candidates); reprocessing burns deep-read budget on known
material. Overlap marking preserves the delta framing — this run's value is
what's *new* relative to prior coverage.

## 2026-07-25 — corpus home

**Question:** Where do normalized texts and metadata live — inside the repo or
outside?

**Answer:** Externally, in the machine-local `academia-2026-07` research corpus. The packet
commits only derived intelligence: paper catalog (inventory), cluster
syntheses, SOURCES.md ledger, routing table.

**Rationale:** The repo is public; copyrighted PDFs and full extracted texts
must never be committed. Follows the `graph-3d-navigation` precedent
(gitignored seed corpus + committed SEED-INVENTORY).

## 2026-07-25 — depth tiers

**Question:** Uniform processing depth for all 444 titles, or tiered?

**Answer:** Tiered. T1 cheap triage of ALL (codex `gpt-5.6-luna`, batched);
T2 deep-reads of a relevance shortlist (~100–180) with `gpt-5.6-sol`;
T3 cluster syntheses (~7–10) + one repo-grounded master synthesis at sol/max.
Papers already deep-read in the June-29 synthesis are excluded from T2.

**Rationale:** ~40% of the corpus is predictably off-topic or shallow-value;
uniform deep reading would multiply cost for no insight. Triage-then-shortlist
concentrates Sol max-reasoning spend where the catalog says it pays.

## 2026-07-25 — mining lenses

**Question:** Which repo work streams do papers get mined against?

**Answer:** All four, equally weighted: (1) memory/bitemporal/No-Escape
doctrine corroboration; (2) legal ontology & semantic foundation;
(3) retrieval/citation grounding/doc structure; (4) agent architecture —
metacognition/neuro-symbolic/security. Off-topic papers → catalogued-only.

**Rationale:** The two download waves map cleanly onto these four streams, and
all four have active goal packets that can absorb findings. Narrowing to fewer
lenses would orphan roughly half the corpus.

## 2026-07-25 — packet shape

**Question:** One packet or several (per-lens)?

**Answer:** One packet — `explorations/academia-corpus-mining` — scaffolded
from `_template`, ending at stage `research` with align-stage questions queued
in the manifest. Cross-packet findings land in a routing table
(attach/extend/new-exploration suggestions, gold-intake style) — recorded, not
executed.

**Rationale:** The corpus is one provenance unit; splitting by lens would
scatter the catalog and duplicate the sources ledger. The routing table is the
mechanism for distributing findings without fragmenting provenance
(precedent: `_gold-intake` routing.json).

## 2026-07-25 — prior synthesis adoption

**Question:** What happens to `Legal_Ontologies_for_beep-effect.md` (the
June-29 prior synthesis, never moved into the repo)?

**Answer:** Commit it into this packet as
`research/prior-synthesis-legal-ontologies.md`, registered in SOURCES.md as
the prior-art anchor.

**Rationale:** It is the single largest piece of prior art for this run (72
papers deep-read, ~240-paper backlog pointer) and its own footer asked to be
moved into the repo. Untracked, it is invisible to future sessions; adopted,
it defines the delta this run must beat.

## 2026-07-25 — aux tooling

**Question:** Role of firecrawl and grok (claudeg) in the pipeline?

**Answer:** firecrawl-parse only as extraction fallback (rare — 40/40 sample
PDFs extracted cleanly with `pdftotext`); `firecrawl research` only for
canonical-metadata enrichment of the T2 shortlist. No grok/claudeg.

**Rationale:** The corpus has text layers, so local extraction is nearly free;
firecrawl credits (3,532 left) are reserved for the few failures and for
DOI/venue enrichment where it adds provenance value. No live-web/X research
component exists in this run, so the grok lane spends quota for nothing.

## 2026-07-25 — T2 checkpoint: shortlist size + effort

**Question:** T1 triage produced 185 deep-read verdicts (lens-balanced
shortlist assembled at the 180 cap, trimming 5 legal-ontology papers at
relevance 68–76). Run how many, at what reasoning effort?

**Answer:** All 185 (cap lifted), `gpt-5.6-sol` at **max** reasoning per
paper. T3 syntheses stay at Sol max as planned.

**Rationale:** User-approved at the S4 checkpoint. The 5 trimmed papers were
high-relevance casualties of an arbitrary cap; the quota-pause/resume
machinery (`ops/PAUSED` sentinel, idempotent rerun) makes the larger run safe
across quota windows. Max effort honors the original "Sol on Max level
reasoning" intent; the xhigh-for-throughput alternative was offered and
declined.

## 2026-07-25 — prior-synthesis snippet audit (mid-run addition)

**Question:** User noticed foundational issues in code snippets inside the
adopted prior synthesis (and suspects other documents). How to handle?

**Answer:** Independent adversarial review job launched immediately: codex
`gpt-5.6-sol` (xhigh), repo cwd read-only, output committed as
`reviews/2026-07-25-codex-prior-synthesis-snippet-audit.md`. Verifies every
code snippet against Effect v4 as vendored + real `@beep/*` symbols, with
file:line proof per finding; recommends errata annotations (the synthesis is
a historical artifact — history is not rewritten). The same Effect-v4/beep-API
verification lens is folded into the S8 QA gate for all new pipeline outputs.

**Outcome (same day):** user's suspicion confirmed — 56 TypeScript fences
audited against vendored Effect 4.0.0-beta.101 and live package sources;
36 defective; 13 distinct findings (7 foundational, 5 significant, 1
cosmetic). Headline classes: removed `S.filter`/`S.pattern` APIs, incomplete
`makeSemanticSchemaMetadata` payloads, nonexistent `LawPractice.PartyId`,
wrong `EntityId` import, a publication gate claimed to exist that does not,
and a superseded `Ontology.create` roadmap.

**Errata placement deviation:** the audit recommends an in-file dated banner
near the top of the synthesis. Deviated deliberately: BOTH the audit's 13
findings and the prior-72 reconstruction cite exact line numbers into the
byte-identical file, so any top-of-file insertion would shift every
reference. Errata banners live at the entry points instead (packet README
"Read This First" prior-synthesis item and SOURCES.md §3), and the file
stays byte-exact.

## 2026-07-25 — align: route execution scope (master Q12)

**Question:** Of the master synthesis's 36 recorded routes (10 attach-to /
10 extend / 16 new-exploration; 15 high / 18 medium / 3 low priority),
which actually execute, and in what shape?

**Answer:** Dispatch all 15 high-priority routes in one wave. Extend and
attach-to routes land as a bounded corpus-derived note at
`<target>/research/2026-07-25-academia-corpus-mining-note.md` — distilled
requirements, fixture candidates, cluster-report provenance; evidence
input for the target's owners, never a SPEC/PLAN amendment. The two
high-priority new-exploration routes scaffold capture-stage packets
(`agent-execution-sandbox`, `model-artifact-admission`). The 18 medium and
3 low routes stay recorded in the master table.

**Rationale:** The intelligence already exists in the cluster reports;
notes are bounded and traceable, so dispatching the full high tier costs
little beyond review. "Recorded, not executed" was the research-stage
posture — align's job is to discharge it for the tier the corpus rated
highest. Medium/low routes wait for pull from their targets.

## 2026-07-25 — align: prose-to-proof fact language (master Q2)

**Question:** Should `docs/product/prose-to-proof.md` (and the approval
policy, if it repeats the phrases) replace "becomes a fact" /
"authoritative runtime truth", or keep those terms with a narrow
repository-state definition?

**Answer:** Replace. Attorney approval is recorded as a scoped human
disposition — one of seven independent typed verdicts (shape validity,
anchor fidelity, semantic stance, source authority/currentness, human
disposition, action authorization, release) — and none of those verdicts
converts a contestable proposition into source truth. The edit lands in
the follow-up binding-doc PR (see the PR-shape decision below).

**Rationale:** The corpus's strongest correction: four clusters converge
on it independently (legal-norms-reasoning, agent-metacognition-
neurosymbolic, agent-security-orchestration, retrieval-citation-
grounding), and the delta section flags the prior synthesis's "admission
makes the institutional fact obtain" framing as the corrected claim.
Keep-but-narrow was offered and declined: the word keeps doing epistemic
work no matter how carefully it is fenced.

## 2026-07-25 — align: first composition over the bitemporal core (master Q4)

**Question:** What composes over the bitemporal edge core first: preferred
belief views, legal multitemporality, exact-version telemetry, or
interpretation/closure records?

**Answer:** Preferred belief views. The recorded medium route
`new-exploration <epistemic-belief-view-revision>` is the designated first
composition; it stays recorded until the bitemporal core itself lands.

**Rationale:** Most product-shaped payoff (what does the attorney
currently believe, and why, with inconsistent evidence retained rather
than destroyed) — and the other three candidates all want a
preferred-view mechanism underneath them anyway. Multitemporality remains
next in the legal lane (see the legal-module decision).

## 2026-07-25 — align: backlog wave 2 (master Q13)

**Question:** Does the June-29 ~240-paper catalogued backlog warrant a
follow-up mining wave?

**Answer:** Yes — approved but deferred. Wave 2 starts with the 97
legal-NLP/extraction papers, using the same idempotent pipeline, and only
after this dispatch wave has landed. Recorded as the packet's parked
revival trigger.

**Rationale:** The master's honest-limits section names the 97-paper
ingestion edge as the largest remaining source of empirical retrieval and
extraction evidence — exactly where this corpus is weakest (architectural
convergence strong, production validation thin). Deferring keeps the
dispatch wave from stalling behind another multi-hour mining run.

## 2026-07-25 — align: first legal module after M1 (master Q6)

**Question:** Which legal module follows semantic-foundation M1:
procedure/practice, argumentation/evaluation, legal multitemporality, or
ontology lifecycle QA?

**Answer:** Argumentation/evaluation (the recorded
`legal-argumentation-substrate` route is the designated successor; M1
itself stays a bounded SKOS registry/loader).

**Rationale:** The legal-norms-reasoning cluster's headline: the layer
after SKOS is qualified legal argumentation — attacks, defeats, and
accepted conclusions as projections scoped to theory, proof standard,
procedure, jurisdiction, and time — not "more ontology".
Multitemporality follows in third position behind belief views.

## 2026-07-25 — align: metacognition deployment (master Q11)

**Question:** External supervisor, integrated scheduler, or both over one
shared protocol?

**Answer:** Commit only to one typed event/control protocol now: monitors
emit non-authoritative cues; later observations decide whether an
intervention worked; no reflection text escapes No-Escape. The
supervisor-vs-integrated topology question stays open until comparison
fixtures exist (the recorded low-priority compare route).

**Rationale:** The agent-metacognition-neurosymbolic cluster found no
decisive evidence for either topology and explicitly proposed direct
comparison under identical observability, privacy, latency, and recovery
fixtures. Committing to the protocol is what the downstream routes need;
committing to a topology today would be evidence-free.

## 2026-07-25 — align: packet fate after dispatch

**Question:** Once the 15-route dispatch lands and wave 2 is deferred,
what happens to this packet?

**Answer:** Park — stage `align`, status `parked`, flipped in the same PR
that lands the binding-doc edits (the last dispatch route). Revival
trigger: the wave-2 backlog run.

**Rationale:** A mining packet's deliverable is routed intelligence, not
a brief of its own — shape and decompose don't apply. Parking with an
explicit trigger is honest about that; "graduate" would stretch the
graduation contract (no goal packet emerges from this packet itself).

## 2026-07-25 — align: dispatch PR shape

**Question:** One PR or several for executing the dispatch wave?

**Answer:** Two. PR A: this align closeout + the 11 additive dispatch
notes + the 2 new packet scaffolds. PR B (after A merges): the two
binding-doc edits — `docs/product/prose-to-proof.md` typed-verdict
replacement and the `standards/memory-architecture/01-memory-layer-
taxonomy.md` episodic/projection split — plus the park flip.

**Rationale:** The notes are additive research files; the two doc edits
change binding product/standards prose and deserve their own focused
review. Three-plus PRs was rejected as pure overhead.

## 2026-07-25 — align: remaining question deferrals

**Question:** The master synthesis queued 13 align questions; the
decisions above discharge Q2, Q4, Q6, Q11, Q12, and Q13. Where do the
rest live?

**Answer:** Explicitly deferred into the targets that own them:
Q1 (canonical verdict names/owners) and Q3 (retention classes) → the
`epistemic-bitemporal-edge-core` dispatch note; Q5 (lineage identity) →
the `identity-iri-fold` note; Q7 (stance layer + minimum qualifiers) →
the `citation-grounding-hallucination-guard` note; Q8 (visual/composite
evidence timing) → the recorded doc-structure medium routes (not
dispatched, consistent with the route-scope decision); Q9 (benchmark
design) → the recorded `office-action-layout-evidence-benchmark` route;
Q10 (first action-authorization proof) → the `agent-execution-sandbox`
packet, which inherits it in its manifest.

**Rationale:** Each is a design decision inside its target's scope, not
this packet's. Align exits with every question either answered above or
explicitly owned elsewhere — the manifest's openQuestions record exactly
that.
