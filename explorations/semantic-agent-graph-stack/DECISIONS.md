# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-11-10 — extraction-pipeline-scope

**Question:** Is a document-to-graph extraction pipeline in scope, or only
the knowledge / memory / context role split over bricks that already exist?

**Answer:** Out of scope. This packet builds no extraction pipeline, no
proposer or judge seat, no pack compiler and no graph store.

**Rationale:** The repo answers it, so the operator was not asked.
[`legal-document-intake`](../../goals/legal-document-intake/README.md) owns
document-to-knowledge-graph work and its decision D6 fixes the graph as a
Postgres projection. [`langextract-capability`](../../goals/langextract-capability/README.md)
is complete and [`citation-extraction-engine`](../../goals/citation-extraction-engine/README.md)
is active. The 2026-11-06 research marked the pipeline NOT FOUND; the
2026-11-10 re-baseline in [`RESEARCH.md`](RESEARCH.md) corrects that.
Rejected: a second pipeline here, which would duplicate three packets.

## 2026-11-10 — model-drafted-ontology

**Question:** When a model drafts ontology structure, what may it emit
before a person accepts it?

**Answer:** Not decided here. The question belongs to two other packets and
this one defers to them.

**Rationale:** [`text-knowledge-stack-rebuild`](../../goals/text-knowledge-stack-rebuild/README.md)
already requires that write tools emit `proposed` records only, with
admission as a separate step, and that covers model output over claims and
annotations. Class authorship is a curation rule, and the parked
[`ontology-curation-governance`](../ontology-curation-governance/README.md)
exploration owns it. Heimsbakk's rule (a model drafts SKOS candidates and
SHACL scaffolding; a person owns the blueprint) is recorded in the research
as input for that packet. Rejected: settling a curation rule inside a packet
whose one surviving idea is correction reach.

## 2026-11-10 — owned-ranks-closed

**Question:** Which of the ten ranked patterns in the 2026-11-06 research
does this packet still carry?

**Answer:** Rank 1 only, narrowed to a record of what an approved artifact
rested on plus a signal that the basis changed. Rank 2 stays as a gated
candidate. The rest are closed by reference.

**Rationale:**

| Rank | Pattern | Disposition |
| --- | --- | --- |
| 1 | A correction must reach the next action | Kept. The one-hop case exists as `ClaimEvidenceReviewStatus.Stale`; reach past the review does not. |
| 2 | Context is a view; sufficiency is a second result | Gated on the matched-budget grounding pilot proposed by `research-intake-2026-11` and on a resumed `belief-view-engine`. |
| 3 | The proposer does not judge | Owned by `text-knowledge-stack-rebuild` (stance and admission) and `legal-document-intake`. |
| 4 | A person owns the ontology | Owned by `ontology-curation-governance`. See the entry above. |
| 5 | Candidates stay out of search until accepted | Exists: `ReviewTag`, `CandidateClaim`, `ClaimLifecycle`. The rebuild replaces the vocabulary. |
| 6 | Cite only a span the agent fetched | Owned by `citation-verified-span-substrate` (complete) and `citation-extraction-engine`. |
| 7 | Link near-duplicates; do not merge | Recorded as a reference shape for a later identity resolver. No goal. |
| 8 | Hash-pinned extraction packs | Out of scope with the pipeline. |
| 9 | One generated page per term | Unverified against `@beep/ontology-ui`. No rank until read. |
| 10 | As many ontologies as responsibilities | No work. Slice isolation already gives it. |

## 2026-11-10 — first-consumer

**Question:** Which existing beep decision is the first consumer: a
corrected claim that must reach a later action, ontology-session authoring,
or agent-run memory?

**Answer:** A corrected claim that must reach a later action, and the action
is the outbox send. Operator's pick.

**Rationale:** Agent-run memory is taken by
[`agent-memory-store`](../../goals/agent-memory-store/README.md).
Ontology-session authoring gains a decision link in
[`execution-authority-slice`](../../goals/execution-authority-slice/README.md)
P2. The outbox send is the action the operator named when asked which
approved action would go wrong if a claim were corrected after approval.

What the code says about that pick, read after the answer
([`RESEARCH.md`](RESEARCH.md), "The outbox send, read at the pin"):

- The review that proposed this consumer suggested carrying a basis digest
  on the execution-authority decision record. That seam is wrong. The
  outbox does not pass through governed egress, and governed egress sees
  no tool parameters.
- `m365_outbox_send_draft` refuses every send with `version-unbound`. The
  attorney sends the prepared draft in Outlook.

The pick stands. Where the basis check attaches is the next question.
