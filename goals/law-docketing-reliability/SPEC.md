# Law Docketing Reliability Spec

## Objective

Prove years-out approved reminders cannot fail silently. The system must poll
and reconcile sequentially, escalate on a fixed acknowledgment ladder, expose
staleness through an independent dead-man path that alerts with the app and
desktop off, and recover from the last durable cursor with an attorney-visible
backfill/reconciliation report before heartbeats resume.

## Non-Goals

- Computing or approving legal deadlines; the patent spine owns that lifecycle.
- Becoming the docket of record or treating local completeness as authority.
- App-local watchdogs, desktop-only notifications, or monitoring that shares
  the app's failure domain.
- Trademark, court-order, foreign, CPI, LawToolBox, or other later-track scope.
- Two-way Outlook synchronization or calendar conflict resolution.
- Weakening alert/recovery proof because an external service is inconvenient.

## Source Hierarchy

1. The user-approved graduation objective and
   [`BRIEF.md`](../../explorations/solo-firm-docketing/BRIEF.md).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `standards/ARCHITECTURE.md` and governing package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. The patent spine's lifecycle/records contract, then the exploration
   [`DECISIONS.md`](../../explorations/solo-firm-docketing/DECISIONS.md),
   [`MAP.md`](../../explorations/solo-firm-docketing/MAP.md), and supporting
   `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- The lifecycle/records integration seam defined by
  `goals/law-docketing-patent-spine`.
- `packages/law-practice/use-cases`, `tables`, and `server` for polling,
  escalation, acknowledgment, cursor, recovery, reconciliation, and reporting.
- Existing `@beep/uspto`, `@beep/pglite`, and `@beep/m365` boundaries only as
  required by the reliability contract.
- A net-new external heartbeat/monitor adapter outside the app and desktop
  failure domain.
- Focused fixtures, kill/restore acceptance harnesses, evidence, and docs.

## Constraints

1. Poll ODP sequentially per API key every 15 minutes for open patent matters.
   Same-key requests never run concurrently, and a complete daily
   reconciliation pass proves every open matter was checked.
2. Emit a heartbeat only after a successful poll/reconciliation cycle. The
   maximum accepted heartbeat staleness is 20 minutes; the external monitor
   then alerts outside the desktop failure domain.
3. Escalate at T-90/30/14/7/3/1. Every notice is auditable and requests
   acknowledgment. An unacknowledged notice repeats after one business day;
   T-3 and T-1 also repeat the same day over the independent channel.
4. Recovery begins from the last durable successful cursor and is bounded. It
   reconciles every open approved deadline and Outlook event, produces an
   explicit attorney-visible report, and resumes heartbeat only after proof.
5. Acceptance requires killing the app, observing the independent email or
   phone-push alert with the desktop off, restoring the app, and observing
   bounded backfill/reconciliation and heartbeat resumption.
6. Monitor independence is structural: an in-process watchdog, desktop
   notification, shared credential, or shared failure domain does not qualify.
7. The six-week paired appetite is a budget. Narrow implementation detail
   before weakening cadence, staleness, ladder, acknowledgment, recovery, or
   kill-app proof.
8. This packet depends on `law-docketing-patent-spine` for the lifecycle and
   records contract and does not become a second owner of legal-date truth.
9. This packet blocks patent v1 acceptance until its kill-app alert and
   restore/backfill/reconciliation proof passes.
10. Authority/rule changes remain attorney-reviewed spine concerns; reliability
    never silently recomputes an approved date.
11. TSDR outage posture and later jurisdiction sources remain behind their own
    matter gates; the reliability packet does not pull them into v1.
12. External monitor selection must verify production access, terms, alert
    channels, credentials, cost, and failure-domain independence. Deadline-engine
    vendor documentation is not evidence that the monitor contract is satisfied.

## Decision Log

The exploration retains the full questions, rationale, and rejected options;
these summaries seed implementation without copying that discussion.

| Date | Decision summary | Source |
| --- | --- | --- |
| 2026-06-18 | The product is a vigilance/approval overlay; candidates and reminders never replace the attorney's docket of record. | [`docketing-overlay-not-record`](../../explorations/solo-firm-docketing/DECISIONS.md#2026-06-18--docketing-overlay-not-record-locked) |
| 2026-06-18 | Build/buy/hybrid remained open until research ranked L2 choices behind one candidate interface. | [`build-vs-buy-disposition`](../../explorations/solo-firm-docketing/DECISIONS.md#2026-06-18--build-vs-buy-disposition-locked) |
| 2026-06-18 | Research covered IP, court, and official-data tracks and stopped at a human review gate before shaping. | [`research-breadth--end-state`](../../explorations/solo-firm-docketing/DECISIONS.md#2026-06-18--research-breadth--end-state-locked) |
| 2026-06-18 | Recommended official-register trigger truth, attorney-authoritative computed dates, and escalation on disagreement. | [`authoritative-date-source`](../../explorations/solo-firm-docketing/DECISIONS.md#2026-06-18--authoritative-date-source-recommended) |
| 2026-06-18 | Recommended a narrow US deterministic handroll first, with vendors only as additive candidates. | [`l2-first-slice`](../../explorations/solo-firm-docketing/DECISIONS.md#2026-06-18--l2-first-slice-recommended) |
| 2026-06-18 | Recommended one-way Outlook push through `@beep/m365`; two-way sync stayed out. | [`outlook-depth`](../../explorations/solo-firm-docketing/DECISIONS.md#2026-06-18--outlook-depth-recommended) |
| 2026-06-18 | Recommended US patents first, then trademarks, court orders, and foreign work. | [`jurisdiction-scope-v1`](../../explorations/solo-firm-docketing/DECISIONS.md#2026-06-18--jurisdiction-scope-v1-recommended) |
| 2026-06-18 | Recommended durable records, redundant reminders, escalation, dead-man heartbeat, and audit as one reliability model. | [`reliability-model`](../../explorations/solo-firm-docketing/DECISIONS.md#2026-06-18--reliability-model-recommended) |
| 2026-06-18 | Deferred court orders to a later event-source and licensed-rules track. | [`court-orders-track`](../../explorations/solo-firm-docketing/DECISIONS.md#2026-06-18--court-orders-track-deferred) |
| 2026-07-14 | Ratified the bounded, authority/version-pinned US rules handroll and prohibited broad foreign/litigation computation. | [`l2-rules-engine`](../../explorations/solo-firm-docketing/DECISIONS.md#2026-07-14--l2-rules-engine-locked) |
| 2026-07-14 | Ratified patents → trademarks → court orders → foreign, each behind its matter gate. | [`jurisdiction-order`](../../explorations/solo-firm-docketing/DECISIONS.md#2026-07-14--jurisdiction-order-locked) |
| 2026-07-14 | Made an external, desktop-independent kill-app alert a v1 acceptance requirement. | [`external-dead-mans-switch`](../../explorations/solo-firm-docketing/DECISIONS.md#2026-07-14--external-dead-mans-switch-locked) |
| 2026-07-14 | Deferred CPI until handroll v1 lands and LawToolBox until the court track. | [`vendor-evaluation-trigger`](../../explorations/solo-firm-docketing/DECISIONS.md#2026-07-14--vendor-evaluation-trigger-locked) |
| 2026-07-14 | Kept the attorney's current setup as docket of record with personal reconciliation. | [`docket-of-record-first-slice`](../../explorations/solo-firm-docketing/DECISIONS.md#2026-07-14--docket-of-record-first-slice-locked) |
| 2026-07-14 | Ratified official event dates, attorney-approved computed dates, and escalation instead of auto-resolution. | [`authoritative-date-policy`](../../explorations/solo-firm-docketing/DECISIONS.md#2026-07-14--authoritative-date-policy-locked) |
| 2026-07-14 | Ratified one-way Outlook writes through `@beep/m365`. | [`outlook-one-way-push`](../../explorations/solo-firm-docketing/DECISIONS.md#2026-07-14--outlook-one-way-push-locked) |
| 2026-07-14 | Assigned rule-fixture approval to the attorney and made upstream change a reviewed new version. | [`rule-validation-change-control`](../../explorations/solo-firm-docketing/DECISIONS.md#2026-07-14--rule-validation-change-control-locked) |
| 2026-07-14 | Recorded overlay now and a deliberate doctrine re-vote only after reliability is proven in practice. | [`docket-of-record-trajectory`](../../explorations/solo-firm-docketing/DECISIONS.md#2026-07-14--docket-of-record-trajectory-locked) |

## Acceptance Criteria

- [ ] ODP polling for open patent matters runs every 15 minutes, sequentially
      per API key, with retry/cursor evidence and a complete daily sweep.
- [ ] Each successful poll/reconciliation cycle emits an external heartbeat;
      heartbeat staleness beyond 20 minutes produces an independent email or
      phone-push alert with the desktop off.
- [ ] Approved obligations carry the T-90/30/14/7/3/1 escalation ladder; every
      notice is auditable, requests acknowledgment, and follows the one-business-
      day plus T-3/T-1 same-day repeat rules.
- [ ] Killing the app causes the independent alert to arrive without assistance
      from the app or desktop.
- [ ] Restoring the app performs bounded backfill from the last successful
      cursor, reconciles all open approved deadlines and Outlook events, emits
      an attorney-visible recovery report, and only then resumes heartbeat.
- [ ] Missed, repeated, acknowledged, recovered, and reconciled states are
      durable across restart and visible in audit evidence.
- [ ] The implementation consumes the patent spine lifecycle/records contract
      without authoring or silently changing an approved legal date.
- [ ] Focused tests, kill/restore proof, repo gates, reflection lint, and Yeet
      PR-to-mergeable proof pass.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/law-docketing-reliability/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/law-docketing-reliability/ops/manifest.json` | Passes |
| Packet references | `rg -n "law-docketing-reliability|GOAL.md|agentLaunchers|packetAnchorDocument" goals/law-docketing-reliability` | Expected references present |
| Packet whitespace | `git diff --check -- goals/law-docketing-reliability` | Passes |
| Cadence and ladder | Focused scheduler/polling/acknowledgment tests selected in P1 | 15-minute sequential polling, daily sweep, T-ladder, and repeats green |
| Dead-man independence | Archived kill-app/desktop-off evidence | Alert arrives after at most 20 minutes of heartbeat staleness |
| Recovery | Archived restore/backfill/reconciliation evidence | Bounded cursor recovery, complete report, then heartbeat resume |
| Dependency boundary | Integration/contract tests with patent spine | Reliability reads approved records and never authors legal truth |
| Repo quality | `bun run beep yeet verify` | Green |
| Reflection | `bun run beep lint reflection-artifacts` | Green at close |

## Stop Conditions

- The patent spine lifecycle/records contract is missing or materially
  contradictory.
- No available external path can alert independently with the app and desktop
  off within the 20-minute staleness contract; record vendor/cost/credential
  evidence rather than weakening acceptance.
- The implementation would require owning legal computation, two-way calendar
  sync, later-jurisdiction scope, or promotion to docket of record.
- Verification requires unnamed credentials, cost, destructive side effects,
  or policy approval.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
