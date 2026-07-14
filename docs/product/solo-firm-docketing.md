# Solo-Firm Docketing — Product Doctrine

> **The product is a vigilance and approval overlay.** It observes, proposes,
> preserves evidence, escalates, and reminds; it does not quietly become the
> attorney's docket of record.

- **Status:** Ratified product doctrine (2026-07-14)
- **First implementation packets:** [US patent approval spine](../../goals/law-docketing-patent-spine/README.md) · [independent reliability proof](../../goals/law-docketing-reliability/README.md)
- **Source exploration:** [Solo-Firm IP Docketing](../../explorations/solo-firm-docketing/README.md)

---

## 1. Vigilance overlay, not the record

A missed legal deadline can be malpractice, and the dangerous failure is often
silence: an event source, reminder worker, credential, desktop, or calendar
integration can stop operating while a deadline waits years in the future. The
product therefore earns trust by proving vigilance. It observes official events,
retains their evidence and provenance, proposes reviewable work, records human
approval and reconciliation, and repeatedly surfaces approved obligations.

For this arc, the attorney's current manually maintained setup remains the
docket of record. The product's local history does not become authoritative by
growing complete-looking, and no feature may quietly promote it to a second
record.

## 2. The candidate and approval firewall

Machine output has zero authority. An official register supplies the ground
truth for a triggering event: for the first slice, ODP's office-action mail
date. The system packages that event as an evidence-backed candidate carrying
its source span and provenance. A versioned legal-rule fixture may then propose
a computed deadline with its primary authority and effective date, but the
proposal remains a candidate too.

Only attorney approval writes operative truth for the computed deadline. The
attorney then personally reconciles the approved candidate against the current
docket of record, and the product stores that acknowledgment. When official,
local, or future vendor candidates disagree, the disagreement escalates; it is
never auto-resolved by preferring one source. Upstream rule changes open review
and a new effective rule version; they never silently rewrite an approved date.

Exports and one-way Outlook projections read only from the approved table.
Calendar edits do not flow back, and no unapproved candidate can leak into an
authoritative export or reminder schedule.

## 3. The dead-man reliability contract

Correct arithmetic is insufficient if the system can stop running unnoticed.
For open patent matters, ODP polling is sequential per API key every 15 minutes,
with a complete daily reconciliation pass. Each successful cycle emits an
external heartbeat. At 20 minutes of staleness, an independent service alerts
the attorney by email or phone push outside the app and desktop failure domain.

Approved obligations escalate at T-90/30/14/7/3/1. Every notice is auditable and
requests acknowledgment. An unacknowledged notice repeats after one business
day; T-3 and T-1 also repeat the same day over the independent channel.

Recovery starts from the last durable cursor, performs bounded backfill,
reconciles every open approved deadline and Outlook event, shows the attorney an
explicit recovery report, and only then resumes heartbeat. Acceptance is
literal: kill the app and observe the independent alert with the desktop off;
restore it and observe backfill, reconciliation, reporting, and heartbeat
resumption. The [reliability goal](../../goals/law-docketing-reliability/README.md)
blocks acceptance of the [patent spine](../../goals/law-docketing-patent-spine/README.md)
until that proof passes.

## 4. Expansion follows gates, not a calendar

The rollout order is US patents → US trademarks → court orders → foreign work.
That order does not authorize speculative breadth:

1. The US patent spine and its paired reliability proof land first.
2. When handroll v1 lands, open the CPI access request. CPI remains additive
   candidate redundancy and proceeds only with usable credentials, terms,
   sandbox/production access, and an acceptable SLA.
3. Trademark work opens only when a live US trademark matter justifies the TSDR
   outage and churn burden and the patent reliability contract is stable.
4. Court work opens only for a qualifying court matter and a separately shaped,
   licensed rules engine. LawToolBox evaluation belongs there.
5. Foreign work opens only for a qualifying foreign matter and a separately
   shaped licensed engine/source set; broad foreign rules are never handrolled
   as an extension of the US module.

## 5. Docket-of-record trajectory

The owners intend to build toward their own docketing system, but that ambition
does not amend today's doctrine. The recorded trajectory is **overlay now,
deliberate re-vote later**. Promotion to docket of record can be considered only
after the independent heartbeat and a real operating track record have earned
the question. It requires a `grill-with-docs` review and a product-vision
amendment. It is never the cumulative side effect of feature work.

The full rationale, rejected options, and source ledger remain in the
[exploration packet](../../explorations/solo-firm-docketing/README.md); this page
states only the doctrine ratified there.
