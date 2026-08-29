# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

## Candidate Goal Packets

| Slug | Status | Mission | Depends on / gate | Capabilities cited |
| --- | --- | --- | --- | --- |
| [`law-docketing-patent-spine`](../../goals/law-docketing-patent-spine/README.md) **FIRST** | **GRADUATED 2026-07-14** | Deliver the named first vertical slice: official US patent event → evidenced candidate → attorney-approved rule result → durable record/reconciliation → one-way Outlook push. | `m365-driver` write-scope extension; paired acceptance with `law-docketing-reliability` | Reuse `@beep/uspto`, workspace `CandidateTask`/`ApprovalGate`/`ContextPacket`/`EmailArtifact`, law-practice `Matter`/`PatentAsset` and the existing thin `OfficeAction`, `@beep/pglite`, `@beep/m365`; **NET-NEW:** docketing-grade OfficeAction extension, FilingEvent/Deadline entities, narrow US-deterministic rules module, law-practice tables and workflows. |
| [`law-docketing-reliability`](../../goals/law-docketing-reliability/README.md) | **GRADUATED 2026-07-14** | Prove years-out reminders cannot fail silently through escalation, acknowledgment, recovery, and an independent dead-man path. | Patent-spine lifecycle/records contract; blocks patent v1 acceptance | Reuse `@beep/pglite` durability and `@beep/m365` notifications; **NET-NEW:** external heartbeat integration, monitor adapter, escalation/acknowledgment/recovery workflows. |
| `law-docketing-cpi-connector` | **QUEUED** | Add CPI as a redundant IP deadline-candidate source behind the shipped candidate interface. | Trigger: **when handroll v1 lands, open the CPI access request**; then require usable credentials, terms, access, and SLA | Reuse candidate comparison and approval workflows; **NET-NEW:** CPI adapter. |
| `law-docketing-trademark` | **QUEUED** | Extend the overlay to US trademark post-registration events and §8/§9/§15 candidate deadlines. | Patent spine and reliability accepted; qualifying trademark matter | Reuse approval/rules/reliability spine; **NET-NEW:** TSDR driver and trademark event/rule fixtures. |
| `law-docketing-court-orders` | **QUEUED** | Observe court orders and obtain licensed, approval-gated cascading court deadlines. | Patent spine and reliability accepted; qualifying litigation matter; separately shaped licensed engine | Reuse candidate/reconciliation/reliability spine; **NET-NEW:** CourtListener driver and licensed court-engine connector; LawToolBox evaluation belongs here. |
| `law-docketing-foreign` | **QUEUED** | Add foreign prosecution/annuity vigilance using official events and licensed deadline engines, never local broad handroll. | Prior US tracks stable; qualifying foreign matter; separately shaped licensed engine/source set | Reuse overlay spine; **NET-NEW:** EPO/other jurisdiction drivers and licensed-engine connectors. |

## Sequencing

1. **First bet — `law-docketing-patent-spine`.** It proves the smallest complete
   L1→L4 path with the strongest existing bricks and no vendor purchase. Its
   public contract is the candidate/approval/reconciliation interface all later
   engines reuse.
2. **Required v1 companion — `law-docketing-reliability`.** It follows the
   spine's lifecycle contract but is not optional polish: patent v1 cannot pass
   acceptance until the independent kill-app alert and recovery proof pass.
3. **Trigger-gated redundancy — `law-docketing-cpi-connector`.** Exact trigger:
   **"when handroll v1 lands, open the CPI access request"**. Start only if CPI
   grants usable partner credentials, terms, sandbox/production access, and an
   acceptable SLA. Failure leaves the handroll spine intact.
4. **Matter-gated expansion — `law-docketing-trademark`.** Start when a live US
   trademark matter justifies TSDR outage/churn work and the patent reliability
   contract is stable.
5. **Matter- and license-gated expansion — `law-docketing-court-orders`.** Start
   when the firm takes a court matter and separately shapes a licensed rules
   engine. Open LawToolBox access evaluation here, not earlier.
6. **Last — `law-docketing-foreign`.** Start only with a qualifying foreign
   matter and a separately shaped licensed engine/source set. No foreign rule
   handroll is inherited from the US module.

## First Vertical Slice

**Named slice: US Patent Office-Action Approval Spine.** An ODP office action or
ingested e-OA email produces a `CandidateTask` with trigger, official mail date,
source span, and provenance. The attorney approves the event and versioned rule
fixture; the narrow module proposes a response/maintenance deadline cross-checked
against ODP/`ptmnfee2`; the attorney approves the computed date and personally
reconciles it against the current docket of record. The system durably stores
the evidence and acknowledgments, pushes an Outlook event/reminders one way
through `@beep/m365`, and emits an external heartbeat.

Proof is one fixture-backed office-action case plus one maintenance-fee case,
including an explicit exceptional-date case, persisted across restart. Verify
the official trigger provenance, rule authority/effective date, disagreement
escalation, attorney approvals, reconciliation acknowledgment, Outlook event,
T-90/30/14/7/3/1 schedule, sequential ODP polling, and the kill-app independent
alert/recovery test.

## Capability Check

| Component | Live capability or gap |
| --- | --- |
| Patent official events | **REUSE:** `@beep/uspto` ODP service at `packages/drivers/uspto/src/Uspto.service.ts`; extend for the shaped OA/polling contract. |
| Candidate evidence and approval | **REUSE:** `CandidateTask`, `ApprovalGate`, `ContextPacket`, and `EmailArtifact` under `packages/workspace/domain/src/entities/`. |
| Matter context | **REUSE:** `Matter`, `PatentAsset`, and a thin existing `OfficeAction` under `packages/law-practice/domain/src/entities/`. **NET-NEW:** docketing fields/policy plus FilingEvent and Deadline entities. |
| Rules | **NET-NEW:** pure narrow US-deterministic policy module with attorney-approved, authority/effective-date/version-pinned fixtures and explicit edge cases. |
| Use cases and persistence | **REUSE:** slice boundaries in `law-practice/use-cases` and `law-practice/server`; durable file-backed `@beep/pglite`. **NET-NEW:** approval/reconciliation/scheduling ports and `law-practice/tables` records. |
| Outlook | **REUSE/EXTEND:** `@beep/m365` from `goals/m365-driver`; this packet triggers its reserved `Calendars.ReadWrite` phase. |
| Independent monitoring | **NET-NEW:** external heartbeat/alert adapter and acceptance harness outside the desktop failure domain. |
| Follow-on sources | **NET-NEW:** TSDR, CourtListener, and EPO drivers, gated to their later packets. |

## Open Risks Inherited From The Brief

- Legal-rule edge cases and authority effective dates must remain explicit,
  fixture-pinned cases rather than generic date arithmetic.
- ODP same-key calls are sequential; cursor/retry design must still prove a
  complete daily sweep and bounded freshness.
- TSDR fragility is inherited only by the trademark packet, with its own outage
  posture.
- CPI/LawToolBox commercial access, terms, sandbox, and SLA remain unproven until
  their exact gates fire.
- Two-way Outlook sync stays prohibited; calendar conflict resolution is not
  latent scope.
- External monitoring must remain operational with the app and desktop off and
  must not share their failure domain.
- Upstream legal-rule changes open attorney review and a new effective version;
  they never silently recompute approved dates.
