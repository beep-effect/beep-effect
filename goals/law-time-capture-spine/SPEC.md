# Law Time Capture Spine Spec

## Objective

Deliver the exact Slice 1 manual capture spine ratified in the source brief: a
visible explicit start/stop timer associates work with a real matter and a small
native prosecution task; stopping it produces a candidate duration and a
purpose-bounded narrative from approved evidence only; the attorney can inspect,
edit, approve, reject, or delete the candidate with durable approval history;
and a vendor-neutral approved-entry export port renders duplicate-safe CSV and
prebill previews without requiring a network connection.

## Non-Goals

- Making Beep the timekeeping, billing, accounting, invoice, payment, trust,
  general-ledger, finance-close, or other system of record. FreshBooks remains
  authoritative after any future export.
- Implementing or evaluating a FreshBooks adapter, OAuth flow, remote write,
  project-to-matter mapping, or reconciliation behavior. That work is gate-
  queued in `law-time-freshbooks-export`.
- Adding M365/Graph activity signals. That work is gate-queued behind the
  bounded `law-time-m365-signals` P0 and explicit source/purpose consent.
- PST reconstruction or passive historical inference. That work is gate-queued
  behind a demonstrated need and an accepted preview/cancellation/deletion
  contract.
- Flat-fee profitability views. Capture is arrangement-agnostic now, but the
  view waits for enough real pilot data and may not introduce accounting truth.
- LEDES/UTBMS mapping or export. That work waits for a client mandate and a
  concrete billing guideline through a separate export path.
- Autonomous billable/export action, post-export edits from Beep, automatic
  discrepancy resolution, invisible timers, silent content capture, enterprise
  administration, or firm-wide policy breadth.

## Source Hierarchy

1. The user-approved graduation objective and
   [`BRIEF.md`](../../explorations/ip-attorney-time-tracking/BRIEF.md).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `standards/ARCHITECTURE.md` and governing package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. The exploration [`DECISIONS.md`](../../explorations/ip-attorney-time-tracking/DECISIONS.md),
   [`MAP.md`](../../explorations/ip-attorney-time-tracking/MAP.md), and supporting
   `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/law-practice/domain` for schema-first time-entry,
  candidate-duration, arrangement, native task, evidence, approval-history,
  export, retention, and deletion contracts.
- `packages/law-practice/use-cases` for timer, candidate review, approval,
  deletion, and approved-entry export workflows/ports.
- `packages/law-practice/tables` for durable local records, projections,
  retention clocks, idempotency keys, and narrowly necessary tombstones.
- `packages/law-practice/server` for repositories and orchestration.
- `apps/professional-desktop` for the visible timer, matter/task association,
  candidate inspection/edit/disposition, approval history, and preview surface.
- Focused redacted fixtures, tests, pilot evidence, and packet documentation.

## Constraints

1. The six-calendar-week appetite is a budget. Cut narrative sophistication and
   taxonomy breadth before visible timer state, evidence inspection, explicit
   approval, deletion, or export preview.
2. Matter attribution starts explicit. Suggestions may assist later, but Slice 1
   always exposes selection/correction and measures post-review accuracy.
3. Source duration is explicit timer duration only. Overlaps, idle time,
   interruptions, reconstructed activity, and other inferred durations do not
   silently inflate candidates; attorney edits remain visible in history.
4. Candidate narrative uses only evidence explicitly approved for that purpose.
   Privilege, purpose limitation, redaction, local encryption, and sensitive-
   data handling cover content, prompts/model calls, logs, telemetry,
   screenshots, support artifacts, tests, and archived evidence across the
   whole path, not storage alone.
5. Nothing becomes billable or exportable without an explicit recorded attorney
   approval. Edit, approve, reject, and delete transitions and their actor/time
   history are inspectable.
6. The vendor-neutral approved-entry boundary owns stable idempotency keys.
   Repeated preview/CSV generation and retried future exports cannot create
   duplicate logical rows.
7. CSV and prebill preview are the complete Slice 1 adapter. The flow requires
   no network, vendor account, OAuth grant, or live external service.
8. Retention and deletion form one testable contract across source content,
   metadata, redacted extracts, candidates, approvals, previews, projections,
   caches, backups under product control, and narrow idempotency tombstones.
9. Purpose-fetched content and unredacted excerpts are deleted when their
   candidate resolves or after 7 days, whichever comes first.
10. Consented source metadata and redacted evidence extracts are deleted after
    30 days unless the attorney explicitly pins them to an unresolved candidate.
11. Candidates, edits, approvals, export previews, idempotency keys, and
    reconciliation outcomes are deleted after the default 12-month operational
    audit period. The attorney may inspect, export, shorten retention, or delete
    any local record sooner.
12. Source revocation stops collection immediately and offers local-cache
    deletion. Deletion propagates through local projections; tombstones retain
    only what is necessary to prevent accidental re-import and expire under the
    same explicit contract.
13. Tom supplies the initial native patent-prosecution task set from real
    matters during P0. It may include office-action response, claim drafting,
    IDS, filing, client communication, and docketing administration, but must
    not become a speculative ontology or inherit UTBMS/LEDES.
14. FreshBooks API behavior is unknown and is not researched, assumed,
    implemented, or accepted by this packet. Domain semantics remain vendor-
    neutral so the separate P0 can fail safely while CSV remains operational.
15. Time capture includes hourly, flat-fee, and nonbillable work from day one;
    initial export semantics remain hourly-first.

## Decision Log

The exploration retains the questions, rationale, and rejected options. The
nine locked 2026-07-14 ratifications and one deferred spike are summarized here
with back-links rather than copied discussion.

| Date | Decision summary | Source |
| --- | --- | --- |
| 2026-07-14 | Ratified Beep as the capture/prebill overlay while FreshBooks remains authoritative; rejected a competing ledger. | [`Product posture`](../../explorations/ip-attorney-time-tracking/DECISIONS.md#2026-07-14--product-posture-locked) |
| 2026-07-14 | Ratified Tom's solo IP practice as the first segment; enterprise systems remain pattern benchmarks. | [`First segment`](../../explorations/ip-attorney-time-tracking/DECISIONS.md#2026-07-14--first-segment-locked) |
| 2026-07-14 | Ratified the staged hybrid: manual Slice 1 first, then one consented M365 signal through the same candidate contract. | [`Staged first slice`](../../explorations/ip-attorney-time-tracking/DECISIONS.md#2026-07-14--staged-first-slice-locked) |
| 2026-07-14 | Deferred Graph permissions, sync, signal choice, and retention to the separate M365 P0. | [`M365 Graph spike`](../../explorations/ip-attorney-time-tracking/DECISIONS.md#2026-07-14--m365-graph-spike-deferred) |
| 2026-07-14 | Ratified a vendor-neutral approved-entry port, FreshBooks as the first adapter to evaluate separately, and CSV/prebill as the network-free fallback. | [`FreshBooks-first export`](../../explorations/ip-attorney-time-tracking/DECISIONS.md#2026-07-14--freshbooks-first-export-locked) |
| 2026-07-14 | Ratified the FreshBooks pivot and invalidated the earlier legal-vendor ranking for this practice. | [`Prior vendor ranking invalidated`](../../explorations/ip-attorney-time-tracking/DECISIONS.md#2026-07-14--prior-vendor-ranking-invalidated-locked) |
| 2026-07-14 | Ratified metadata-first consent, narrow purpose-bound content, visible timers, explicit approval, inspect/correct/reject/revoke/delete controls, least privilege, encryption, limits, and redaction. | [`Privacy and consent boundary`](../../explorations/ip-attorney-time-tracking/DECISIONS.md#2026-07-14--privacy-and-consent-boundary-locked) |
| 2026-07-14 | Ratified duration-plus-matter capture for hourly, flat-fee, and nonbillable work while profitability remains a follow-on. | [`Arrangement-agnostic capture`](../../explorations/ip-attorney-time-tracking/DECISIONS.md#2026-07-14--arrangement-agnostic-capture-locked) |
| 2026-07-14 | Ratified FreshBooks-wins reconciliation, no post-export Beep edits, boundary idempotency, and attorney-reviewed discrepancies only. | [`Reconciliation firewall`](../../explorations/ip-attorney-time-tracking/DECISIONS.md#2026-07-14--reconciliation-firewall-locked) |
| 2026-07-14 | Ratified a small native prosecution task set from Tom's real matters; UTBMS/LEDES remains client-triggered and separate. | [`Patent-prosecution task taxonomy`](../../explorations/ip-attorney-time-tracking/DECISIONS.md#2026-07-14--patent-prosecution-task-taxonomy-locked) |

## Acceptance Criteria

- [ ] A redacted real-matter fixture traverses visible explicit timer start,
      matter/native-task association, stop, candidate creation, evidence and
      narrative inspection, attorney edit, explicit approval, approval history,
      and approved CSV/prebill preview without network access.
- [ ] Reject and delete paths are first-class; neither leaves an exportable
      entry, and deletion propagates through every local projection in the
      testable deletion contract.
- [ ] Hourly, flat-fee, and nonbillable fixtures retain explicit duration and
      matter/task context through review; no inferred duration is introduced.
- [ ] Candidate narrative proof shows that only attorney-approved evidence
      reaches the purpose-bounded assistant and that sensitive content is absent
      from logs, telemetry, support/test artifacts, and unapproved exports.
- [ ] Over a stable two-week Tom pilot, at least 80% of self-reported working
      time appears as candidates, including flat-fee and nonbillable work.
- [ ] Over that pilot, at least 90% of candidates have the correct matter after
      review and at least 70% are approved rather than rejected, with edits
      allowed.
- [ ] Median attorney narrative-edit time is at most 45 seconds per approved
      candidate during the pilot.
- [ ] Zero entries become exportable without explicit recorded approval, and
      repeated preview/CSV generation produces zero duplicate logical rows.
- [ ] Retention clock tests delete purpose-fetched content/unredacted excerpts
      on resolution or by 7 days, delete unpinned metadata/redacted extracts by
      30 days, and delete operational audit records by 12 months.
- [ ] Revocation proof stops source collection immediately, offers cache
      deletion, propagates requested deletion through projections, and retains
      no broader tombstone than duplicate prevention requires.
- [ ] Focused package/integration/restart tests, repo gates, reflection lint,
      and Yeet PR-to-mergeable proof pass.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/law-time-capture-spine/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/law-time-capture-spine/ops/manifest.json` | Passes |
| Packet references | `rg -n "law-time-capture-spine|GOAL.md|agentLaunchers|packetAnchorDocument" goals/law-time-capture-spine` | Expected references present |
| Packet whitespace | `git diff --check -- goals/law-time-capture-spine` | Passes |
| Manual lifecycle | Focused law-practice/professional-desktop tests selected in P1 | Complete timer-to-approved-preview flow green; no network |
| Approval and idempotency | Focused transition/export tests plus archived evidence | Zero unapproved exports and duplicate rows |
| Privacy and deletion | Clock/revocation/projection tests plus redacted evidence audit | 7d/30d/12mo, early delete, revocation, and narrow tombstones pass |
| Pilot | Two-week redacted aggregate report under `history/` | ≥80% capture; ≥90% matter; ≥70% approval; median ≤45s edit; zero firewall/duplicate failures |
| Repo quality | `bun run beep yeet verify` | Green |
| Reflection | `bun run beep lint reflection-artifacts` | Green at close |

## Stop Conditions

- Tom cannot supply representative real matters or approve a bounded native task
  set without exposing sensitive data beyond the agreed redacted process.
- The manual vertical would require inferred duration, a network/vendor
  dependency, FreshBooks/Graph/PST/LEDES/profitability scope, autonomous export,
  or promotion to billing system of record.
- The privilege/purpose, approval, idempotency, retention, deletion, or
  revocation contract cannot be made explicit and testable before build.
- Verification requires unnamed credentials, cost, destructive side effects,
  or policy approval.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
