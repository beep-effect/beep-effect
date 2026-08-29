# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets. The exploration is shaped when the human says
this file matches the picture in their head.
-->

## Problem

For a solo practice, a missed office-action response, maintenance-fee window,
registration filing, or court-ordered date is not a productivity defect. It is a
malpractice event. The current setup therefore remains the docket of record, and
this product must earn trust as a **vigilance and approval overlay**, never by
quietly becoming a second authoritative docket.

The hard failure is often silence rather than bad arithmetic. A deadline can sit
years in the future while a poller, reminder worker, credential, desktop, or
calendar integration stops running unnoticed. A locally correct date is not
enough: the system must preserve the triggering evidence, make legal computation
reviewable, require attorney approval, reconcile with the attorney's existing
record, repeatedly surface the approved obligation, and alert through an
independent path when the product itself stops proving that it is alive.

## Appetite

**RATIFIED 2026-07-14:** one focused, six-week goal-packet build
for a solo human owner working with coding/review agents, delivering the US
patent spine plus the minimum independent reliability proof required to accept
it. This is a budget, not an estimate: if an edge cannot fit, preserve it as an
explicit case and narrow supported rule coverage rather than weakening the
approval, provenance, reconciliation, or dead-man guarantees.

The appetite deliberately leaves out US trademark implementation, court orders,
foreign work, vendor connectors, two-way calendar synchronization, and promotion
of the product to docket of record. Those are separately gated packets, not
stretch goals.

## Solution Sketch

### First-slice flow — US patent office action

1. Observe a US patent office-action event from `@beep/uspto`/ODP or an ingested
   e-Office Action email. ODP's official mail date is ground truth for the
   triggering event.
2. Create an evidence-backed `CandidateTask` carrying the trigger, mail date,
   source span, and provenance. No deadline is operative yet.
3. The attorney approves the trigger and rule fixture. The narrow
   US-deterministic rules module computes a response or maintenance deadline as
   another candidate, with its primary authority, effective date, rule version,
   and explicit exceptional-case path. Cross-check against ODP and `ptmnfee2`
   where applicable; disagreement escalates and never auto-resolves.
4. The attorney approves the computed deadline. That approval is authoritative
   for the computed date. Persist the approved candidate and audit evidence in a
   durable, file-backed PGlite record.
5. The attorney personally reconciles the approved candidate against the current
   docket of record. Store acknowledgment of that reconciliation; the product
   remains an overlay regardless of how complete its local history becomes.
6. Push the approved deadline one way to Outlook through `@beep/m365`, creating
   the calendar event and reminder schedule. Calendar edits do not flow back.
7. The app pings an external dead-man endpoint. If heartbeats stop, an independent
   service alerts the attorney by email or phone push with the desktop off.

### Package boundaries

- `law-practice/domain`: deadline/event models and pure, versioned rule policies.
- `law-practice/use-cases`: official-event intake ports plus approval,
  reconciliation, candidate comparison, and scheduling workflows.
- `law-practice/tables`: durable docketing records and audit projections.
- `law-practice/server`: live repositories, orchestration layers, and adapter
  composition.
- Drivers: ODP in `@beep/uspto`, Outlook in `@beep/m365`, file-backed PGlite in
  `@beep/pglite`, and an external monitoring adapter remain engine boundaries.

### Reliability contract

- Poll ODP sequentially per API key every 15 minutes for open patent matters;
  ingest e-OA email continuously when that path is configured. A complete daily
  reconciliation pass proves every open matter was checked.
- Emit a heartbeat after each successful 15-minute poll/reconciliation cycle.
  Maximum accepted heartbeat staleness is 20 minutes; the independent monitor
  then alerts outside the desktop failure domain.
- Schedule escalation at T-90/30/14/7/3/1. Every escalation is auditable and
  requests acknowledgment; an unacknowledged notice repeats after one business
  day, while T-3 and T-1 repeat the same day over the independent channel.
- Recovery proof requires a bounded backfill from the last successful cursor,
  reconciliation of all open approved deadlines and Outlook events, an explicit
  attorney-visible recovery report, and a resumed external heartbeat.
- Acceptance includes killing the app and observing the independent alert, then
  restoring it and observing the backfill/reconciliation proof.

## Rabbit Holes

1. **Legal-rule edge cases.** Weekends, federal holidays, USPTO closures,
   extensions, revival, maintenance-fee grace/expiration asymmetry, and
   authority effective dates must be enumerated and fixture-pinned; generic
   date addition is not a fallback.
2. **ODP sequential same-key polling.** Burst=1/no concurrent calls makes cursor,
   retry, freshness, and complete-daily-sweep proof part of the design.
3. **TSDR fragility.** Outages and API churn make the trademark source a
   follow-on with its own gate, not an assumed copy of the patent path.
4. **Vendor commercial access.** CPI and LawToolBox documentation does not prove
   a solo firm can obtain production credentials, acceptable terms, or an SLA.
5. **Two-way calendar sync.** Conflict resolution and another writer to the
   record are deliberately excluded.
6. **Monitor independence.** An in-process watchdog, desktop notification, or
   shared credential/failure domain does not satisfy the dead-man requirement.
7. **Upstream rule churn.** Authority changes require attorney review and a new
   effective rule version; never silently recompute an approved deadline.

## No-Gos

- The product does not become the docket of record in this arc; the attorney's
  manually kept docket remains authoritative. The owners' stated ambition to
  eventually promote the product to docket of record is recorded in
  `DECISIONS.md` (docket-of-record-trajectory) and requires a deliberate future
  doctrine re-vote — it is never reached by feature creep.
- No autonomous authoritative deadline writes. Computations remain candidates
  until attorney approval, and disagreements always escalate.
- No handrolled foreign or litigation deadline computation. Those tracks shape
  around licensed engines before implementation.
- No two-way Outlook synchronization.
- No broad multi-jurisdiction v1; expansion follows US patents → US trademarks →
  court orders → foreign under matter-driven gates.
