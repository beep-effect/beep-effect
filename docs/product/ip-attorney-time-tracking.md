# IP Attorney Time Tracking — Product Doctrine

> **The product is a capture and prebill overlay, not a ledger.** It preserves
> bounded evidence, proposes time candidates, and helps the attorney review
> them; FreshBooks remains the authoritative billing and accounting record.

- **Status:** Ratified product doctrine (2026-07-14)
- **First implementation packet:** [manual time-capture spine](../../goals/law-time-capture-spine/README.md)
- **Source exploration:** [IP Attorney Time Tracking](../../explorations/ip-attorney-time-tracking/README.md)
- **Shared doctrine:** [Solo-Firm Docketing](./solo-firm-docketing.md) applies the same candidate/approval firewall to deadlines.

---

## 1. Capture and prebill overlay, not the record

Tom's patent work is fragmented across drafting, office actions, IDS work,
filings, client communication, and docketing administration. Some work is easy
to time deliberately; some is reconstructed later, and flat-fee or nonbillable
effort can disappear from the operating picture even when it matters to the
practice.

Beep closes that capture and review gap. It preserves local evidence, records
duration and matter context for hourly, flat-fee, and nonbillable work, drafts
candidate narratives, and previews what the attorney has approved. It never
becomes the billing, accounting, invoice, payment, trust, or general ledger.
FreshBooks remains the system of record, and a complete-looking local
projection does not acquire competing authority.

## 2. Metadata-first privacy and consent

Local-first storage does not erase privilege or surveillance risk. Every
passive source requires explicit opt-in and a declared purpose. Manual timers
have explicit start/stop controls and a visible running state. Consented
calendar or activity capture begins with metadata; content is fetched only on
demand for a user-approved purpose. PST import, if its later need-gate ever
opens, must be bounded, previewable, cancellable, and explicitly initiated.

The whole path carries the privacy boundary: evidence, prompts and model calls,
logs, telemetry, screenshots, support artifacts, local projections, and
exports. The attorney can inspect, correct, reject, revoke, and delete. Data is
encrypted locally, redacted where possible, and retained by the ratified tiers:

- purpose-fetched content and unredacted excerpts resolve with the candidate or
  delete after 7 days, whichever comes first;
- consented metadata and redacted evidence extracts delete after 30 days unless
  explicitly pinned to an unresolved candidate; and
- candidates, edits, approvals, previews, idempotency keys, and reconciliation
  outcomes retain 12 months of operational audit history by default, then
  delete.

Revocation stops collection immediately and offers deletion of the local cache.
Deletion propagates through local projections; only a narrowly necessary
tombstone may remain to prevent accidental re-import. The attorney may inspect,
export, shorten retention, or delete local records sooner.

## 3. The candidate and approval firewall, applied to time

Machine assistance has zero billing authority. Stopping a visible timer creates
evidence and a candidate duration, not a billable entry. The candidate carries
matter, native prosecution task, work arrangement, narrative, approved evidence
references, and provenance for any inference. Narrative assistance may use only
evidence the attorney approved for that purpose.

The attorney can inspect and edit the duration, association, and narrative,
then approve, reject, or delete the candidate. Approval history records the
change and who made the entry exportable. Nothing billable or exportable exists
without that explicit recorded approval. This is the same candidate/approval
firewall used by [solo-firm docketing](./solo-firm-docketing.md): proposals are
reviewable inputs, never authority by accumulation.

Approved entries cross a vendor-neutral export port. CSV and prebill preview
remain available without a network call, and stable idempotency keys prevent
duplicate logical rows. A separately gated FreshBooks adapter may later consume
the same port. After export, FreshBooks wins: Beep does not edit the remote
entry. Any discrepancy becomes a new attorney review candidate and never
auto-resolves.

## 4. Staged hybrid, with every expansion gated

The first slice is deliberately manual: visible timer → explicit matter/native-
task association → candidate duration and purpose-bounded narrative → attorney
inspection/edit/disposition → approved CSV/prebill preview. This proves the
domain, privacy, deletion, approval, and idempotency spine without making a
vendor API or Graph permission the critical path.

Only after that contract exists may a bounded M365 P0 choose and prove one
metadata-first, explicitly consented signal. Graph authentication, minimum
permissions, sync behavior, revocation, recovery, and retention are gates, not
assumptions. The signal must propose through the same candidate contract; it
does not create a second path to billable truth.

The remaining expansions also wait on their evidence: FreshBooks needs API and
mapping proof; PST needs a real historical-reconstruction need; flat-fee
profitability needs enough arrangement-agnostic pilot data without accounting
ownership; LEDES/UTBMS needs a client mandate and a concrete billing guideline.
None is authorized merely because the manual spine graduates.

The full rationale, rejected options, source ledger, and queued gates remain in
the [exploration packet](../../explorations/ip-attorney-time-tracking/README.md);
the implementation contract lives in the
[goal packet](../../goals/law-time-capture-spine/README.md).
