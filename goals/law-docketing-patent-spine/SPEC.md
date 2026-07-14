# Law Docketing Patent Spine Spec

## Objective

Deliver the named **US Patent Office-Action Approval Spine**: an ODP office
action or ingested e-Office Action email becomes an evidence-backed candidate;
the attorney approves the trigger and versioned rule fixture; a bounded US
rules module proposes a response or maintenance-fee deadline; the attorney
approves and reconciles that date against the current docket of record; and the
system durably stores the evidence and acknowledgment before pushing an Outlook
event and reminders one way through `@beep/m365`.

## Non-Goals

- Promoting the product to docket of record; the attorney's manually maintained
  setup remains authoritative throughout this arc.
- Autonomous authoritative deadline writes or silent resolution of candidate
  disagreements.
- US trademark, court-order, foreign, or broad multi-jurisdiction support.
- Handrolled foreign or litigation deadline computation.
- CPI, LawToolBox, Alt Legal, or other commercial deadline-engine connectors.
- Two-way Outlook synchronization or calendar edits flowing back into docket truth.

## Source Hierarchy

1. The user-approved graduation objective and
   [`BRIEF.md`](../../explorations/solo-firm-docketing/BRIEF.md).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `standards/ARCHITECTURE.md` and governing package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. The exploration [`DECISIONS.md`](../../explorations/solo-firm-docketing/DECISIONS.md),
   [`MAP.md`](../../explorations/solo-firm-docketing/MAP.md), and supporting
   `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/law-practice/domain` for docketing-grade office-action,
  filing-event, deadline, and pure versioned policy models.
- `packages/law-practice/use-cases` for intake, approval, comparison,
  reconciliation, persistence, and scheduling ports/workflows.
- `packages/law-practice/tables` for durable records and audit projections.
- `packages/law-practice/server` for live repositories, orchestration, and
  adapter composition.
- Existing `@beep/uspto`, `@beep/pglite`, and `@beep/m365` driver boundaries,
  changed only as required by the named slice.
- Focused fixtures, tests, packet evidence, and documentation.

## Constraints

1. The six-week appetite is a budget, not an estimate. Narrow supported rule
   coverage before weakening provenance, approval, reconciliation, or paired
   dead-man acceptance.
2. Office-action and maintenance-fee date logic is fixture-pinned to recorded
   primary authority, effective date, and rule version. Weekends, federal
   holidays, USPTO closures, extensions, revival, maintenance-fee grace and
   expiration asymmetry, and other supported exceptions are explicit cases;
   generic date addition is not a fallback.
3. ODP same-key calls remain sequential (burst 1/no concurrent calls). Cursor,
   retry, freshness, and complete-daily-sweep behavior must be provable.
4. TSDR fragility belongs to the gated trademark packet and is not inherited as
   patent scope.
5. Commercial vendor access, terms, credentials, and SLA remain unproven. CPI
   evaluation starts only when handroll v1 lands; LawToolBox belongs to the
   court-order packet.
6. Outlook is a one-way projection of approved truth; no calendar conflict
   resolution or second writer is introduced.
7. Every authority change opens attorney review and a new effective rule
   version; approved deadlines are never silently recomputed.
8. The official register's event date is trigger truth; only attorney approval
   makes a computed deadline authoritative. Disagreement escalates and never
   auto-resolves.
9. The attorney personally reconciles every approved candidate against the
   current docket of record and the system stores that acknowledgment.
10. `law-docketing-reliability` depends on this packet's lifecycle/records
    contract, while this packet's v1 acceptance is blocked until that sibling's
    independent kill-app alert and restore/backfill/reconciliation proof pass.
11. External heartbeat vendor selection and monitor implementation are owned by
    `law-docketing-reliability`; this packet supplies the lifecycle/records
    contract and integration seam.

## Decision Log

The exploration retains the full questions, rationale, and rejected options;
these summaries seed implementation without copying that discussion.

| Date | Decision summary | Source |
| --- | --- | --- |
| 2026-06-18 | The product is a vigilance/approval overlay; candidates and reminders never replace the attorney's docket of record. | [`docketing-overlay-not-record`](../../explorations/solo-firm-docketing/DECISIONS.md#2026-06-18--docketing-overlay-not-record-locked) |
| 2026-06-18 | Build/buy/hybrid remained open until research ranked the L2 choices behind one candidate interface. | [`build-vs-buy-disposition`](../../explorations/solo-firm-docketing/DECISIONS.md#2026-06-18--build-vs-buy-disposition-locked) |
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

- [ ] One fixture-backed ODP office-action or ingested e-OA case traverses
      evidenced intake, trigger approval, rule proposal, deadline approval,
      durable storage, reconciliation acknowledgment, and one-way Outlook push.
- [ ] One fixture-backed maintenance-fee case traverses the same lifecycle and
      is cross-checked against ODP/`ptmnfee2` where applicable.
- [ ] At least one explicit exceptional-date case proves the supported
      weekend/holiday/closure/extension/revival or maintenance asymmetry path;
      unsupported cases fail visibly rather than falling back to generic math.
- [ ] The approved records, trigger/rule evidence, provenance, authority,
      effective date, version, approvals, and reconciliation acknowledgment
      survive process restart in durable file-backed PGlite storage.
- [ ] A computed-source disagreement is preserved and escalated; it never
      silently chooses or writes an operative date.
- [ ] Outlook contains the one-way event/reminder projection of the approved
      table; calendar edits cannot author docket truth.
- [ ] The T-90/30/14/7/3/1 schedule is derived for each approved obligation and
      is consumable by the reliability packet.
- [ ] ODP polling is sequential per API key at the shaped cadence and produces
      cursor/freshness/complete-daily-sweep evidence.
- [ ] `law-docketing-reliability` proves the paired kill-app independent alert,
      bounded recovery/backfill, open-deadline and Outlook reconciliation,
      attorney-visible recovery report, and resumed heartbeat.
- [ ] Focused package tests, restart/integration proof, repo gates, reflection
      lint, and Yeet PR-to-mergeable proof pass.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/law-docketing-patent-spine/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/law-docketing-patent-spine/ops/manifest.json` | Passes |
| Packet references | `rg -n "law-docketing-patent-spine|GOAL.md|agentLaunchers|packetAnchorDocument" goals/law-docketing-patent-spine` | Expected references present |
| Packet whitespace | `git diff --check -- goals/law-docketing-patent-spine` | Passes |
| Fixture lifecycle | Focused law-practice/USPTO/PGlite/M365 tests selected in P1 | OA, maintenance, exceptional case, and restart proof green |
| Provenance and governance | Archived integration evidence | Trigger/rule provenance, approvals, disagreement escalation, and reconciliation visible |
| Outlook and polling | Archived live/fake-boundary evidence appropriate to each driver | One-way event plus T-ladder; sequential polling and daily sweep proven |
| Paired reliability | `goals/law-docketing-reliability` P2 evidence | Kill-app alert and restore/recovery proof green |
| Repo quality | `bun run beep yeet verify` | Green |
| Reflection | `bun run beep lint reflection-artifacts` | Green at close |

## Stop Conditions

- Required authorities or source files are missing, materially contradictory,
  or too stale to support an attorney-reviewed fixture.
- The bounded US slice would require generic fallback arithmetic, broad foreign
  or litigation computation, a vendor connector, two-way sync, or promotion to
  docket of record.
- The sibling lifecycle/records contract cannot be made explicit or the paired
  reliability proof cannot be produced.
- Verification requires unnamed credentials, cost, destructive side effects,
  or policy approval.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
