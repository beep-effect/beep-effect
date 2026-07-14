# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| [`law-time-capture-spine`](../../goals/law-time-capture-spine/README.md) — **GRADUATED 2026-07-14** | Land the Slice 1 manual timer-to-approved-candidate vertical with evidence, native prosecution tasks, narrative assistance, and CSV/prebill preview. | none | Reuse `CandidateTask`, `ApprovalGate`, `ContextPacket`, law-practice `Matter`/`LegalClient`, and PGlite; **NET-NEW:** time-entry domain model, timer surface, narrative assistant, law-practice tables/use cases/server workflows. |
| `law-time-freshbooks-export` — **QUEUED** | Implement the first approved-entry adapter and one-way reconciliation firewall for FreshBooks. | `law-time-capture-spine` | Reuse the approved-entry/export-preview contract; **NET-NEW:** FreshBooks driver, mapping store, idempotent export and reconciliation workflow. |
| `law-time-m365-signals` — **QUEUED** | Add one metadata-first, explicitly consented M365 activity signal that proposes candidates through the manual spine. | `law-time-capture-spine` | Reuse `EmailArtifact`, `ContextPacket`, candidate/approval flow, and PGlite; **NET-NEW:** M365 activity driver and source-consent/sync projection. |
| `law-time-pst-reconstruction` — **QUEUED** | Offer bounded, previewable, cancellable PST history reconstruction into evidence-backed candidates. | `law-time-capture-spine` | Reuse PST/libpff ingestion, `EmailArtifact`, `ContextPacket`, CandidateTask/ApprovalGate, and PGlite; **NET-NEW:** bounded import UX and time-reconstruction policy. |
| `law-time-flat-fee-profitability` — **QUEUED** | Show matter/task effort for flat-fee work without turning Beep into the accounting ledger. | `law-time-capture-spine`; useful after pilot data exists | Reuse arrangement-agnostic approved entries, Matter/LegalClient, and PGlite; **NET-NEW:** local operational profitability projection and views. |
| `law-time-ledes-export` — **QUEUED** | Map approved entries to UTBMS and emit a separate LEDES/e-billing export when a client requires it. | `law-time-capture-spine`; independent of FreshBooks | Reuse the vendor-neutral approved-entry port; **NET-NEW:** UTBMS mapping, LEDES validation/export, client billing-rule configuration. |

## Goal Gates

| Goal | Gate condition |
| --- | --- |
| [`law-time-capture-spine`](../../goals/law-time-capture-spine/README.md) | **Passed 2026-07-14:** shape sign-off ratified the appetite, success criteria, retention policy, and first-goal slug. Tom supplies the initial native prosecution task set from real matters during goal P0. |
| `law-time-freshbooks-export` | P0 first: evaluate developer onboarding, OAuth scopes, time-entry create/write behavior, client/project-to-matter mapping, idempotency, reconciliation, rate/error behavior, and test-account access. Proceed only if a safe write path is proven; otherwise CSV remains the product path. |
| `law-time-m365-signals` | P0 first: bound Graph authentication, minimum permissions, one signal, delta/notification or polling behavior, revocation, sync recovery, and local retention. Tom explicitly consents to the selected source/purpose before implementation. |
| `law-time-pst-reconstruction` | Tom identifies a real historical reconstruction need and accepts an import preview, scope bound, cancellation, and deletion contract. |
| `law-time-flat-fee-profitability` | Slice 1 produces enough arrangement-agnostic matter/task duration data to validate a useful view; no invoice or accounting ownership is introduced. |
| `law-time-ledes-export` | Trigger only when the first client mandates UTBMS/LEDES e-billing and supplies a concrete billing guideline/format target. FreshBooks is not part of this path. |

## Capability Check

Existing bricks to compose:

- `CandidateTask`, `ApprovalGate`, and `ContextPacket` in
  `packages/workspace/domain/src/entities/` provide candidate lifecycle,
  explicit approval, and bounded evidence patterns.
- `EmailArtifact` provides a normalized email/evidence shape for later M365 and
  PST sources.
- `Matter` and `LegalClient` in `packages/law-practice/domain/src/entities/`
  provide the owning legal context; time semantics extend this slice.
- `@beep/pglite` provides the embedded local database layer.
- `packages/drivers/libpff/` provides the existing PST/libpff ingestion
  foundation.

Honest net-new work:

- the time-entry/candidate-duration model and native prosecution task set;
- the visible start/stop timer surface;
- the purpose-bounded narrative assistant;
- the FreshBooks driver and reconciliation adapter; and
- the M365 activity/time-signal driver, even if lower-level Microsoft plumbing
  is available elsewhere.

Per repo doctrine, time-entry, candidate, narrative, taxonomy, and approval
semantics belong in the law-practice `domain` / `use-cases` / `tables` /
`server` packages. FreshBooks, M365 activity, and PST external wrappers belong
under `drivers/*`. No component belongs in `tooling/*`, and nothing moves to
`shared/*` before a second real domain consumer exists.

## Sequencing

1. **Graduated first bet:** [`law-time-capture-spine`](../../goals/law-time-capture-spine/README.md).
   It proves the domain, privacy,
   approval, and export-preview contract without vendor or Graph dependency.
2. Run the `law-time-freshbooks-export` P0 against the stable approved-entry
   port. If it passes, implement the first adapter; if it fails, keep CSV as the
   operational route without reopening Slice 1.
3. Run the `law-time-m365-signals` P0 and add one consented signal behind the
   same candidate contract. This can follow or overlap the FreshBooks spike,
   but neither owns or changes the spine.
4. `law-time-pst-reconstruction` and `law-time-flat-fee-profitability` are
   evidence-driven follow-ons: the former needs an actual historical gap, the
   latter needs enough captured data.
5. `law-time-ledes-export` remains dormant until a client mandate supplies a
   real UTBMS/LEDES target.

## First Vertical Slice

**Named first vertical slice: `law-time-capture-spine`.**

Tom can start a visibly running timer, associate it with a real matter and one
small native prosecution task, stop it into an evidence-backed candidate,
review and edit the duration/narrative/association, approve or reject it, and
render an approved prebill/CSV preview. Flat-fee and nonbillable work travel the
same path even though initial export semantics are hourly-first.

The proof exercises one complete local path through the law-practice domain,
tables, use cases, server, and app surface. Acceptance includes the ratified
pilot signals in `BRIEF.md`, explicit approval before exportability, stable
preview idempotency, inspect/delete controls, and no FreshBooks or Graph
dependency.

## Open Risks Inherited From The Brief

- Matter and client/project attribution can be ambiguous; suggestions never
  erase explicit attorney correction.
- Timer overlap, interruptions, and idle time need a non-inflating policy before
  inferred duration is introduced.
- Narrative assistance must not leak privileged content through prompts, logs,
  telemetry, or support artifacts.
- Retention/deletion must cover content, metadata, projections, caches, and
  narrow idempotency tombstones as one testable contract.
- Replayed previews and retried exports must not produce duplicates.
- FreshBooks access, identifiers, write semantics, mapping, rate limits, and
  remote reconciliation are unresearched until its P0.
- Graph permissions, source choice, sync recovery, revocation, and retention
  are uncommitted until the M365 P0.
- The native patent-prosecution taxonomy must be useful on real matters without
  becoming a premature general legal ontology.
- FreshBooks cannot emit LEDES; a future client-mandated path must remain a
  separate adapter.
