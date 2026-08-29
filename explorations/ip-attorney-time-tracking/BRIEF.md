# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets. The exploration is shaped when the human says
this file matches the picture in their head.
-->

## Problem

Tom runs a solo IP firm where the workday is fragmented across patent drafting,
office actions, IDS work, filings, client communication, and docketing
administration. Some of that time is easy to start and stop deliberately; much
of it is reconstructed later from memory. The loss is not only uncaptured
hourly work. A flat-fee-heavy prosecution practice also needs the true duration
and matter attribution of all work to understand which services are sustainable,
even when those hours never appear as invoice line items.

FreshBooks is the firm's chosen billing and accounting system, but it organizes
work around clients and projects rather than legal matters and cannot produce
LEDES. Beep should close the capture and prebill gap without displacing that
authoritative record: preserve local evidence, draft candidate durations and
narratives, let Tom correct and approve them, and preview what will cross the
boundary.

That assistance must remain visibly under attorney control. The real risk here
is surveillance, not provider choice: passive collection can still become
surveillance, and retained mail or document content can enlarge the sensitive
data footprint. The product therefore needs explicit consent, metadata-first
capture, narrow purpose-bound content access, inspect/correct/reject/delete
controls, and an approval firewall before anything becomes exportable.

## Appetite

**RATIFIED 2026-07-14:** six calendar weeks for a solo builder
working with coding agents to land and pilot the Slice 1 manual vertical. Spend
that appetite on one trustworthy spine: timer, matter/task association,
candidate duration and narrative, bounded evidence, attorney review, approval
history, and CSV/prebill preview.

The appetite excludes FreshBooks production integration, Graph authorization,
PST reconstruction, profitability analytics, and LEDES. If the complete manual
flow does not fit, cut narrative sophistication and taxonomy breadth before
cutting visible timer state, evidence inspection, explicit approval, deletion,
or export preview. FreshBooks and M365 begin only as separately gated P0
spikes after the manual contract exists.

## Solution Sketch

### Slice 1 — manual capture spine

1. Tom explicitly starts a visible timer, chooses or corrects a matter, and may
   select a small patent-prosecution task such as office-action response, claim
   drafting, IDS, filing, client communication, or docketing administration.
2. Stopping the timer creates evidence and a candidate entry, never a billable
   record. Capture is arrangement-agnostic: hourly, flat-fee, and nonbillable
   work all retain duration and matter context.
3. A narrative assistant proposes concise work-description text from the timer
   context and only the evidence Tom approved for that purpose. The candidate
   shows duration, matter, task, arrangement, narrative, evidence references,
   and confidence/provenance where inference occurred.
4. Tom inspects, edits, approves, rejects, or deletes the candidate. The
   approval history records what changed and who authorized exportability.
5. An approved-entry export port renders a vendor-neutral prebill preview. CSV
   is always available; no network call is needed to complete Slice 1.

### Slice 2 — one M365 signal through the same contract

After a bounded P0 proves Graph authentication, minimum permissions, sync
behavior, and local retention, add exactly one consented metadata-first M365
signal. It proposes candidates through the same contract and review surface as
the timer. Content is fetched only for a user-approved purpose; there is no
silent mailbox, document, or application capture. The spike chooses the signal
rather than this brief guessing it.

### Export and reconciliation boundary

The domain exposes approved entries through a vendor-neutral export port.
FreshBooks is the first planned adapter, contingent on a P0 that proves
developer onboarding, OAuth scopes, time-entry writes, client/project-to-matter
mapping, idempotency, and reconciliation. After export, FreshBooks wins: Beep
does not edit the remote entry. A mismatch becomes a new attorney review
candidate and is never auto-resolved. FreshBooks cannot emit LEDES, so a future
client-mandated LEDES path is separate.

### Package boundary sketch

- The owning law-practice slice holds time-entry, candidate, task-taxonomy, and
  narrative semantics: `packages/law-practice/domain`, `use-cases`, `tables`,
  and `server`.
- `packages/drivers/*` holds FreshBooks, M365 activity, and PST/libpff wrappers.
  Drivers translate external contracts; they do not own legal-time semantics.
- The editor/app surface composes those law-practice use cases and shows
  consent, running state, evidence, review, and export preview.
- Nothing lands in `tooling/*`. Nothing is promoted to `shared/*` until a
  second real domain consumer proves the abstraction.

### Ratified first-slice success signals

**RATIFIED 2026-07-14:** over a two-week Tom pilot after the
flow is stable:

- at least 80% of self-reported working time appears as candidates, including
  flat-fee and nonbillable work;
- at least 90% of candidates have the correct matter after review;
- at least 70% of candidates are approved rather than rejected, with edits
  allowed;
- median attorney narrative-edit time is at most 45 seconds per approved
  candidate; and
- zero entries become exportable without an explicit recorded approval, with
  zero duplicate rows across repeated CSV/preview generation.

### Ratified retention and deletion policy

**RATIFIED 2026-07-14:** retain the minimum local material
needed for review and recovery, encrypted at rest:

- purpose-fetched content and unredacted excerpts: delete when the candidate is
  resolved or after 7 days, whichever comes first;
- consented source metadata and redacted evidence extracts: delete after 30
  days unless Tom explicitly pins them to an unresolved candidate;
- candidates, edits, approvals, export previews, idempotency keys, and
  reconciliation outcomes: keep for 12 months by default as operational audit
  history, then delete; and
- revoking a source stops collection immediately and offers deletion of its
  local cache. Tom can inspect, export, shorten retention, or delete any local
  record at any time. Deletion is propagated through local projections and
  tombstoned only as narrowly as needed to prevent accidental re-import.

## Rabbit Holes

- **Matter attribution:** names, aliases, related applications, and client
  overlap can make confident-looking suggestions wrong. Slice 1 starts with
  explicit selection/correction and measures accuracy before automation.
- **Duplicate prevention:** retries, regenerated previews, and interrupted
  exports need stable idempotency keys at the approved-entry boundary.
- **Duration inference:** overlapping timers, interruptions, idle time, and
  reconstructed activity must not silently inflate work. Slice 1 uses explicit
  timer duration; inferred duration remains a later candidate-only concern.
- **Graph consent and sync:** tenant registration, delegated scopes, delta or
  notification behavior, revocation, offline recovery, and source-specific
  retention are unknown until the M365 P0 spike.
- **Privilege and purpose limitation:** content access, logs, prompts, model
  calls, screenshots, and support artifacts can all leak privileged material.
  Redaction and local boundaries must cover the whole path, not just storage.
- **Retention and deletion:** caches, evidence projections, backups, and
  idempotency tombstones need one testable deletion contract.
- **Matter-to-project mapping:** FreshBooks clients/projects do not equal legal
  clients/matters; mapping needs explicit ownership, ambiguity handling, and
  reconciliation.
- **FreshBooks API unknowns:** this packet never evaluated FreshBooks. OAuth,
  developer access, scopes, write semantics, rate limits, stable identifiers,
  error recovery, and remote edit detection are P0 research, not assumptions.
- **Task codes:** the native prosecution set must come from Tom's real matters
  without becoming a premature ontology. UTBMS/LEDES mapping stays behind the
  first-client-mandates-e-billing trigger.

## No-Gos

- No invoice creation, payments, trust accounting, general ledger, finance
  close, or authoritative billing record.
- No autonomous billable/export action; every entry remains a candidate until
  the attorney explicitly approves it.
- No post-export edits from Beep and no automatic discrepancy resolution.
- No enterprise administration, firm-wide policy engine, multi-office rollout,
  or Intapp/Aderant/Elite integration in the first product.
- No silent mailbox, document, PST, or application capture; no invisible
  timers; no blanket content retention.
- No production M365 commitment before its bounded P0 spike.
- No FreshBooks coupling inside law-practice domain semantics and no assumption
  that its clients/projects are legal matters.
- No LEDES/UTBMS export until a client actually mandates e-billing.
