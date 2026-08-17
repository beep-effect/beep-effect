# Map — Exploration & Goal Packet System Redesign

Status: RATIFIED BY OPERATOR 2026-08-17 (drafted 2026-08-13), with the two
amendments and the promised-now/gated split recorded below.

## Ratification amendments (2026-08-17)

- **Amendment A — live capability update.** Yeet's publish-time portfolio
  index guard (PR #736: `PortfolioIndexGuard.ts`, `PublishScope.ts` under the
  Yeet command tree) is a merged, live instance of the guarded-writer +
  derived-projection-at-the-commit-boundary pattern candidates 1 and 3
  propose. Cite and reuse it; it is no longer net-new territory.
- **Amendment B — React candidate home.** The `apps/labs` substrate landed
  (PR #732) after this MAP was drafted. If `packets-app-react-v2`'s gate ever
  fires, its presumptive home is a lab app under `apps/labs`, resolving
  D12's deferred-home question with the repo's own experimental-app
  lifecycle; the package-creation command remains mandatory.
- **Promised-now vs gated.** Only `packet-control-plane-core` is promised-now
  and scaffolds at graduation. `packet-design-approval-gate` and
  `packet-projection-migration` gate on the packet-core fold contract
  stabilizing (first slice proven, advisory self-hosting running);
  `packet-evidence-closure` gates on the self-hosting slice exposing real
  friction; `packets-app-react-v2` keeps its existing KSA-v1 daily-use gate.
  Fired gates reopen this exploration at `decompose` per the ratified
  convention.

No candidate goal below has been created. Per the prospective-path rule, each
is named by slug only until the operator ratifies this MAP and graduation
creates the packet.

## Candidate Goal Packets

| Order | Proposed slug | Mission | Dependencies | Live capability composition |
| --- | --- | --- | --- | --- |
| 1 | `packet-control-plane-core` (not yet created) | Build the D8 single internal packet-core library in the existing Goals CLI area: versioned per-event CAS records, fork detection, deterministic fold, derived `furthestStage`/`resumeStage`, risk-tier floor/override, and trace projection; expose it first through guarded `beep goals` writers and a minimal read-only `beep explore --check`/doctor surface. | Current packet templates/manifests and existing Goals CLI; implemented with the current process, then self-hosted per D9. | Extend `packages/tooling/tool/cli/src/commands/Goals/Inventory.ts`, `Goals.schemas.ts`, `Doctor.ts`, `SetStatus.ts`, and `Goals.command.ts`: live inventory, schema decode, doctor/index, and the existing single writer. NET-NEW: exploration command/check, event schema/store/fold, fork repair, derived stages, tier computation, and packet-core tests. No new package unless the colocated core later proves a real extraction need. |
| 2 | `packet-design-approval-gate` (not yet created) | Add the fifth graduation readiness check: exact change tree, significant-symbol ledger, Light/Standard/Full routing, seeded DESIGN for Standard/Full, and protected docs-PR approval references whose subject digests are revalidated for staleness. | `packet-control-plane-core`; GitHub protected-review evidence supplied through the existing delivery workflow. | Reuse goal/exploration packet contracts, Yeet’s hosted PR/check evidence boundary, and architecture proof-manifest patterns. NET-NEW: change-tree/significant-symbol schemas, digest subjects, approval-reference events, staleness derivation, amendment events, and exploration graduation enforcement. |
| 3 | `packet-projection-migration` (not yet created) | Migrate packet control state onto the event fold and generated projections: ATLAS wholesale, README status blocks, by-state tree, guarded status writes, and fleet adoption with this campaign as the D9 self-hosting pilot. | `packet-control-plane-core`; design-gate fields from `packet-design-approval-gate` where tier requires them; KSA Workstream D projection contract. | Reuse `packages/tooling/tool/cli/src/commands/Goals/PortfolioIndex.ts`, `Inventory.ts`, `Doctor.ts`, and `goals/knowledge-surface-automation/SPEC.md` Workstream D’s deterministic single-projector/JSON/Mermaid/static-HTML contract. NET-NEW: exploration projection/migration, generated ATLAS and README regions, by-state tree, golden event streams, upcasters, fork-repair flow, and advisory-to-blocking ratchet. |
| 4 | `packet-evidence-closure` (not yet created) | Make landed-versus-closed derivable: schema-valid digest-bound evidence receipts, proof-cache keys, systemic OPPORTUNITIES receipts/roll-up, and the four observational flow metrics. | `packet-control-plane-core`; projection consumers from `packet-projection-migration`; lands after the initial self-hosting slice exposes real friction. | Reuse docgen proof-manifest verification/memoization in `packages/tooling/tool/cli/src/commands/Docgen/internal/Targets.ts` and `Local.ts`, the existing reflection/Yeet evidence surfaces, and per-packet `research/OPPORTUNITIES.md`. NET-NEW: canonical receipt schema, merged-commit subject sealing, landed/closed derivation, opportunity schema/roll-up/mechanical drafts, and approval-wait/parked-age/gate-wall-cache/amendment-rate projections. |
| 5 | `packets-app-react-v2` (not yet created) | If daily use of KSA’s static v1 proves an interaction gap, ship a read-only React packets viewer over the same projector: pulse first, then kanban/DAG/roadmap/markdown drill-in, with scoped reproject push and ETag-poll fallback. | KSA Workstream D static self-contained HTML v1 must ship and daily-use evidence must identify a concrete interaction gap; `packet-projection-migration` supplies the shared projector and `sourceTip`. | Reuse the KSA projector contract and existing app Vite/portless conventions. NET-NEW: a packets app workspace, read-only React views, custom `packets:projection` HMR invalidation, ETag fallback, and visible source-tip/version/age staleness chrome. No write endpoint, drag-and-drop, or client-side frontier derivation. |

## D5 Design-Gate Inventory

These are the exact change-tree envelopes and architecturally significant
symbols proposed for MAP review. They constrain the future goal SPEC/DESIGN
seeds; implementation may amend them only through the ratified amendment path.

| Candidate | Exact change-tree envelope | Significant-symbol ledger |
| --- | --- | --- |
| `packet-control-plane-core` (not yet created) | Extend `packages/tooling/tool/cli/src/commands/Goals/{Goals.schemas.ts,Inventory.ts,Doctor.ts,SetStatus.ts,Goals.command.ts,index.ts}`; add a colocated `PacketCore/` internal module inside the Goals command tree (not yet created); add a minimal read-only `Explore/` command family in the repo CLI commands tree (not yet created); focused CLI tests only. | `PacketEvent`, `PacketEventId`, `PacketTip`, `PacketRevision`, `PacketEventStore`, `PacketFold`, `PacketDerivedState`, `PacketRiskTier`, `PacketTraceProjection`, guarded transition plan/write, exploration check result, fork verdict/repair plan. |
| `packet-design-approval-gate` (not yet created) | Add design/approval modules under the same packet-core; extend goal/exploration template and doctor/graduation contracts; seed `DESIGN.md` only for Standard/Full packet fixtures; add digest/staleness tests. | `PacketChangeTree`, `SignificantSymbol`, `DesignSubject`, `ApprovalReference`, `ApprovalFreshness`, `DesignAmendment`, risk-floor/override event, fifth-readiness verdict. |
| `packet-projection-migration` (not yet created) | Extend the packet-core projector and Goals/Explore doctor/index surfaces; add generated-region support for `explorations/ATLAS.md` and packet README status blocks; add migration/upcaster/golden-stream fixtures and the generated by-state tree. | `PacketProjector`, `PacketProjection`, `sourceTip`, `projectorVersion`, `PacketUpcaster`, `ForkRepairPlan`, `AtlasProjection`, `ReadmeStatusProjection`, `PacketByStateTree`, adoption/migration plan. |
| `packet-evidence-closure` (not yet created) | Add receipt/closure/opportunity/metric modules under packet-core; extend Yeet/reflection evidence adapters and packet doctor projections; add per-packet opportunity-schema and fleet-roll-up fixtures. | `EvidenceSubject`, `EvidenceReceipt`, `ProofCacheKey`, `LandedState`, `ClosedState`, `OpportunityReceipt`, `FlowMetricSnapshot`, merged-commit seal verifier. |
| `packets-app-react-v2` (not yet created) | Create the `packets` app under `apps/` (not yet created) through `bun run beep create-package` only after the gate fires; consume the shared projection JSON/API adapter; add pulse, secondary views, staleness chrome, scoped watch/HMR, ETag poll, and browser-QA fixtures. | `PacketProjectionClient`, `PacketPulseView`, `OperatorQueueView`, `PacketStaleness`, `packets:projection` event contract, scoped reproject service, ETag poll fallback. |

The React candidate’s exact home is the future `packets` app under `apps/` (not yet created), resolving D12’s deferred
home question. That path is a proposal only: the app and goal do not yet exist,
and the repo’s package-creation command remains mandatory if the gate fires.

## Dependency Edges

```text
packet-control-plane-core
  -> packet-design-approval-gate
  -> packet-projection-migration
  -> packet-evidence-closure

packet-control-plane-core
  -> packet-projection-migration

KSA Workstream D static HTML v1
  -> packet-projection-migration pilot input
  -> daily-use interaction-gap evidence
  -> packets-app-react-v2
```

The design gate may develop alongside projection planning after the core fold
contract stabilizes, but projection migration must understand every generated
field before fleet adoption. Evidence closure follows the first self-hosting
slice so its receipt and metric shapes are grounded in observed gates rather
than guessed telemetry.

## Sequencing

1. **Core and CLI/doctor seam.** Implement the single colocated packet-core,
   immutable event fold, derived state, and read-only exploration check behind
   the existing command vocabulary. This is the bootstrap built under the
   current process.
2. **Self-hosting adoption slice.** Use the core in advisory mode on these
   graduated candidate goals, evolve `set-status` into the guarded writer,
   and project this campaign’s state without changing canonical authored prose.
3. **Design approval and fleet migration.** Add tiered DESIGN/approval gates,
   golden-stream/upcaster/fork-repair proof, then migrate generated ATLAS and
   README status blocks under an advisory-to-blocking ratchet.
4. **Receipts and two-phase closure.** Bind evidence to landed commit subjects,
   derive landed versus closed, roll up systemic friction, and observe the four
   D11 metrics before tightening policy.
5. **React v2 only if its gate fires.** KSA owns static v1. Daily-use evidence,
   not preference, must prove a specific interaction gap before this packet
   reopens at `decompose` to graduate the React candidate.

## Chosen First Vertical Slice

Using the current process, implement enough of the single packet-core to write
and fold one versioned CAS event stream for the first graduated machinery goal.
Expose the same fold through:

- a guarded `beep goals` transition preview/write path;
- a minimal read-only `beep explore --check`/doctor result;
- a projection that reports `furthestStage`, `resumeStage`, current tip,
  a visible fork from two children of one parent, and a stale `sourceTip`.

Then self-host that slice on this campaign in advisory mode. The proof uses a
golden linear stream, a deliberate fork, and a stale projection. It does not
yet migrate the fleet, generate ATLAS wholesale, seal closure receipts, or
build any UI.

## Inherited Constraints and Risks

- D8 is binding: one packet-core library colocated behind existing command
  groups; no `beep packets` vocabulary and no premature package.
- D12 is binding: KSA owns static HTML v1. React v2 belongs only to this MAP and
  remains gated by demonstrated daily-use interaction need.
- D9 is binding: adopt the machinery onto its own campaign before widening the
  ratchet.
- Git Markdown packets and the event chain remain the sole system of record;
  every UI/export is read-only and derived.
- Event evolution requires versioned events, upcasters, golden replay, and
  explicit fork repair.
- Generated regions may replace only derivable navigation/status; authored
  Trail and Next Open Question prose remain authored.
- Risk-tier overrides are operator-only, recorded, and challengeable.
- Approval references are evidence only when their exact subject digests remain
  fresh.
- Receipt summaries must be schema-allowlisted/redacted; no secrets enter
  receipts or friction ledgers.
- Metrics remain observational. If approval wait or parked age dominates, fix
  gates/memoization before adding ceremony.

## Re-entry Gates

- `packets-app-react-v2` remains dormant until KSA static v1 ships and daily
  use documents a concrete interaction gap.
- Any extraction of packet-core into a new workspace package requires live
  evidence that colocation is harmful; it is not authorized by this MAP.
- Sigstore/in-toto signing remains deferred until an external verifier/consumer
  exists and verifies fail-closed.
