# Decisions

## 2026-08-13 — Packet graduation and external re-entry triggers

**Decision:** Close the packet as `graduated`. The five queued candidates
remain re-entry points; reopen at `decompose` when the applicable external
trigger arrives from Tom's task set or consent, a client mandate, a demonstrated
PST need, or sufficient Slice-1 data.

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-06-18 - Recommendation for human review gate

**Question:** What recommendation should this packet carry into the first human
review gate?

**Answer:** RECOMMENDED, not accepted yet: treat Beep as a local-first
time-capture and prebill overlay, not the billing/accounting system of record.
Agents may propose candidate entries and narratives, but attorney approval is
required before anything becomes billable or exportable.

**Rationale:** The live repo already has CandidateTask, ApprovalGate,
ContextPacket, EmailArtifact, law-practice entities, PGlite, libpff/PST, and
NLP foundations. The repo does not currently have time-entry, billing-ledger,
trust-accounting, invoice, LEDES, UTBMS, or M365 driver models. The market
already contains mature billing/accounting systems with timers, invoices,
trust/accounting boundaries, prebill review, and enterprise compliance layers.
The lowest-risk wedge is therefore capture, inference, narrative drafting,
discrepancy detection, and approval-gated export.

**Human gate:** This is deliberately unresolved until the user answers the
open questions in `ops/manifest.json`.

## 2026-07-14 — Product posture (LOCKED)

**Question:** Is Beep the billing/timekeeping system of record, or a capture
and prebill overlay?

**Answer:** LOCKED: Beep is the capture/prebill overlay. It owns evidence,
candidate entries, narrative assistance, approval history, and export previews.
FreshBooks owns the authoritative billing record. Beep may keep a local
operational projection, but it must not grow a competing ledger.

**Rationale:** This preserves attorney-controlled evidence and review where
Beep is differentiated while leaving billing authority with Tom's chosen
platform. A Beep-owned timekeeping ledger, invoice/accounting ownership, and
dual-system authority were rejected.

## 2026-07-14 — First segment (LOCKED)

**Question:** Should the first product serve Tom's solo IP practice or design
for solo, mid-market, and enterprise firms at once?

**Answer:** LOCKED: serve Tom's solo IP practice first, with product decisions
made jointly with him. Intapp and Aderant remain pattern benchmarks only.

**Rationale:** A real solo practice gives the work concrete matters, habits,
and privacy constraints. Enterprise-first administration, compliance breadth,
and multi-segment design were rejected as premature.

## 2026-07-14 — Staged first slice (LOCKED)

**Question:** Should the first slice begin with passive M365 inference or a
manual timer and narrative workflow?

**Answer:** LOCKED: use a staged hybrid. Slice 1 is manual: timer → matter
association → candidate duration and narrative → evidence → attorney edit
and approval → export preview. Slice 2 adds one narrowly consented M365 signal
behind the same candidate-entry contract.

**Rationale:** The manual flow proves the domain and approval spine without
making Graph authorization, sync, or privacy the critical path. M365-first,
fully passive capture, and unrelated parallel signal integrations were
rejected.

## 2026-07-14 — M365 Graph spike (DEFERRED)

**Question:** Which Graph permissions, sync mechanism, and local retention
contract should Slice 2 commit to?

**Answer:** DEFERRED into the `law-time-m365-signals` goal's P0: run a bounded
Graph authentication, permissions, sync, and local-retention spike before
committing to its one signal.

**Rationale:** The product direction is locked, but the permission and data
movement contract needs direct technical proof. Choosing mail, calendar, or
document content now, broad Graph consent, and an unspiked production
commitment were rejected.

## 2026-07-14 — FreshBooks-first export (LOCKED)

**Question:** What system should receive the first approved-entry export?

**Answer:** LOCKED: expose a vendor-neutral approved-entry export port and
evaluate a FreshBooks driver as the first adapter. Its P0 must prove developer
onboarding, OAuth scopes, the time-entry write path, client/project-to-matter
mapping, idempotency, and reconciliation. CSV/prebill preview remains the
always-available fallback.

**Rationale:** FreshBooks is already the firm's billing and accounting
platform, by Tom's decision. A vendor-neutral port contains that dependency
without pretending FreshBooks is legal-native. Direct domain coupling to
FreshBooks and making network export mandatory were rejected.

## 2026-07-14 — Prior vendor ranking invalidated (LOCKED)

**Question:** Does the packet's earlier legal-vendor ranking still select the
first export target?

**Answer:** LOCKED: no. FreshBooks invalidates that ranking for this practice.
The packet did not evaluate FreshBooks, so this is a named research gap feeding
the first P0 of `law-time-freshbooks-export`.

**Rationale:** The installed system of record outweighs a hypothetical vendor
comparison. Clio-first, LeanLaw, TimeSolv, Bill4Time, and enterprise-first
Intapp/Aderant/Elite integration were rejected as moot first-target choices.

## 2026-07-14 — Privacy and consent boundary (LOCKED)

**Question:** What may Beep observe and retain while assisting with time
capture?

**Answer:** LOCKED: passive capture is metadata-first, with narrowly scoped
content enabled per source and purpose. Every source requires explicit opt-in;
manual timers require explicit start/stop and a visible running state;
calendar/activity metadata becomes observable only after consent; content is
fetched and retained only on demand for a user-approved purpose; and PST import
is explicit, bounded, previewable, and cancellable. Every inference remains a
candidate until review, and nothing is billable or exportable without explicit
approval. Inspect, correct, reject, revoke, and delete remain available.
Least-privilege permissions, local encryption, retention limits, and redaction
are requirements.

**Rationale:** Local-first storage does not erase privilege or surveillance
risk. Silent mailbox, document, PST, or application capture; blanket content
retention; invisible timers; and autonomous approval/export were rejected.

## 2026-07-14 — Arrangement-agnostic capture (LOCKED)

**Question:** Should capture cover only hourly work, or all work arrangements
from day one?

**Answer:** LOCKED: timers and candidates capture duration plus matter for
hourly, flat-fee, and nonbillable work from day one. Export semantics are
hourly-first; flat-fee profitability views are the named fast-follow.

**Rationale:** Tom's IP prosecution practice is flat-fee-heavy, and omitted
effort would defeat later profitability insight. Hourly-only capture and
building full flat-fee financial reporting into Slice 1 were rejected.

## 2026-07-14 — Reconciliation firewall (LOCKED)

**Question:** How should Beep behave after an approved entry reaches
FreshBooks?

**Answer:** LOCKED: FreshBooks wins after export. Beep never edits an exported
entry. The export boundary uses idempotency keys to prevent duplicates, and
discrepancies become review candidates for the attorney; they never
auto-resolve.

**Rationale:** A one-way authority boundary prevents silent divergence and
keeps corrections in the authoritative billing system. Beep-side post-export
edits, last-write-wins sync, and automatic discrepancy repair were rejected.

## 2026-07-14 — Patent-prosecution task taxonomy (LOCKED)

**Question:** Should Slice 1 begin with UTBMS/LEDES codes or a smaller native
IP-work taxonomy?

**Answer:** LOCKED: derive a small native patent-prosecution task set from
Tom's real matters, including office-action response, claim drafting, IDS,
filing, client communications, and docketing administration. UTBMS/LEDES
mapping is a trigger-gated follow-on when the first client mandates e-billing,
through a separate export path because FreshBooks cannot emit LEDES.

**Rationale:** No current client requires LEDES/UTBMS e-billing. A small native
set improves immediate narratives and review without importing unused
complexity. Full UTBMS-first taxonomy, speculative client-code coverage, and
routing LEDES through FreshBooks were rejected.
