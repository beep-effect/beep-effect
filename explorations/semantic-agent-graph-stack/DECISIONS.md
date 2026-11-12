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

## 2026-11-10 — attach-point

**Question:** The outbox send tool refuses every send with
`version-unbound` and the attorney sends prepared drafts in Outlook. Where
does a changed-basis check attach?

**Answer:** On the draft. `create_draft` records what the draft rested on,
`get_draft` rechecks it, and a stale draft is flagged in Outlook before the
attorney sends. Send stays closed. Operator's pick; it was the recommended
option.

**Rationale:** The attorney's Send button in Outlook is the release point
today, so the signal has to be visible there. The work stays inside
`@beep/m365-mcp` and does not wait for
[`text-knowledge-stack-rebuild`](../../goals/text-knowledge-stack-rebuild/README.md).
The check is advisory: beep cannot block Outlook's Send.

Rejected:

- A promised second slice that reopens agent sending as one immutable
  request built from the checked draft and the rechecked basis. It would fix
  `version-unbound` and a changed basis together, but it reopens the path
  #1728 closed on purpose. It stays in the map as a gated candidate; the
  gate is an operator decision to let agents send again.
- Moving the first consumer to the docket reminder in
  [`law-docketing-patent-spine`](../../goals/law-docketing-patent-spine/README.md).
  That packet's acceptance already carries version, approvals and a
  reconciliation acknowledgment.
- Parking.

Consequence read from the repo, not asked: `03-driver-boundaries.md` says a
driver that imports anything from a slice has the wrong boundary. The outbox
server therefore cannot ask the epistemic slice whether a claim changed. A
pin it rechecks on its own must point at something it can read itself, which
is Microsoft Graph. A pin on an outside fact can only be a digest the caller
restates.

## 2026-11-10 — basis-source

**Question:** What may a draft's basis point at in the first slice?

**Answer:** Microsoft Graph items only: the Outlook calendar event a date
came from, or the message being answered. Operator's pick; it was the
recommended option.

**Rationale:** The server can re-read Graph itself, so it detects a change
without trusting the caller, which is how the send guard already treats
attachments. Rejected: pins on outside facts as a digest the agent restates,
because the server could then only compare what the agent tells it. Also
rejected: giving the outbox binary a second driver to read USPTO or
knowledge-graph facts in the first slice. Both stay possible later behind
the same pin shape.

## 2026-11-10 — goal-home

**Question:** Does the work live in a new goal or as a fourth slice of
[`m365-agent-outbox`](../../goals/m365-agent-outbox/README.md)?

**Answer:** A new small goal with its own acceptance and closeout.
Operator's pick; it was the recommended option.

**Rationale:** `m365-agent-outbox` is active but has had no code since
2026-10-31 and no live session; its slice 3 edits the same files. A separate
goal does not wait behind that slice and does not hold that packet's
closeout open. The new goal declares the file overlap and sequences its PRs
around slice 3. Rejected: slice 4 of the outbox goal, which would close this
exploration as absorbed and queue the work behind a stalled slice.

## 2026-11-10 — pin-comparison

**Question:** How does a pin detect change: the item's `changeKey`, or a
digest of the fields the draft relied on?

**Answer:** A digest of named fields, computed by the server. `changeKey`
is kept in the audit record only. Operator's pick; it was the recommended
option and it amends the `basis-source` answer above, which named
`changeKey`.

**Rationale:** The driver's schema documents `changeKey` as changing on
every edit, and mail tagging writes categories onto inbound messages. A
`changeKey` pin would report a draft stale after a tag, a reminder change or
a read-state write, and an alarm that fires on noise gets ignored. Rejected:
`changeKey` as the comparison, which is simpler and never misses a change
but cannot tell a moved deadline from a dismissed reminder.

## 2026-11-10 — shape-accepted

**Question:** Do [`BRIEF.md`](BRIEF.md) and [`MAP.md`](MAP.md) match the
picture: one goal, `outbox-draft-basis`, two pull requests, send closed,
three gated follow-ons?

**Answer:** Yes. Graduate it. Operator's pick; it was the recommended
option.

**Rationale:** Rejected: cutting the message pin before the goal starts (it
stays the named fallback cut), and holding at decompose for a read first.
The three gated candidates stay in the map as re-entry points and do not
hold the exploration open.
