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
- **Amendment C — `PacketFold` ledger-symbol shape (2026-08-17, recorded at
  P1 implementation, carried for operator review in the P1 slice PR).** The
  D5 ledger symbol `PacketFold` ships as the pure fold function family in the
  colocated `PacketFold.ts` module (`foldPacketEvents`,
  `projectPacketTrace`, `packetTraceIsStale`) rather than a
  `Context.Service`: the fold has no dependencies and no second
  implementation, so a service wrapper would add indirection without a
  contract. The event store and guarded writer remain `Context.Service`
  contracts. No new significant symbol is introduced; the ledger's concept
  set is unchanged.
- **Promised-now vs gated.** Only `packet-control-plane-core` is promised-now
  and scaffolds at graduation. `packet-design-approval-gate` and
  `packet-projection-migration` gate on the packet-core fold contract
  stabilizing (first slice proven, advisory self-hosting running);
  `packet-evidence-closure` gates on the self-hosting slice exposing real
  friction; `packets-app-react-v2` keeps its existing KSA-v1 daily-use gate.
  Fired gates reopen this exploration at `decompose` per the ratified
  convention.

Graduation status: `packet-control-plane-core` was created at ratification
(2026-08-17); candidates 2–5 remain named by slug only (prospective-path rule)
until their gates fire and reopen this packet at decompose.

## Pre-close amendments (2026-08-24)

Recorded at the `packet-control-plane-core` pre-close review (five-lens
adversarial review, operator-grilled 2026-08-24) through this MAP's amendment
path while the goal is still open — the Amendment C precedent. None adds a
significant symbol to the candidate-1 ledger: D and E amend event-contract
rules candidates 2–3 build on, F re-scopes a projection, G stages repair
machinery and bounds stream opt-in.

- **Amendment D — tolerant reader + raw-canonical digest.** Event identity
  binds to file content, not schema knowledge: digest verification recomputes
  sha-256 over the raw parsed JSON's canonical encoding (byte-identical to
  the current decoded-re-encode for every well-formed event, and it makes
  injected unknown keys detectable). A reader that encounters an event whose
  `type` postdates its vocabulary preserves it as an opaque chain link —
  digest verified, seq/parent linkage honored, body excluded from
  derivations — surfaces an advisory `unknown-event-type` finding, and
  refuses writes whenever any opaque event occurs in the current linear
  prefix (opaque ancestry, not just an opaque tip: a recognized event atop
  an unknown one still leaves derived state incomplete) with an honest
  "stream requires a newer CLI" error, never a fake integrity issue. The
  digest rule lands in the goal's pre-close hardening rung; opaque handling
  lands with the first vocabulary growth (candidate 2).
- **Amendment E — dual-stage genesis + no-backfill law.** `packet-created`
  gains optional `furthestStage`/`furthestOrdinal` (pair-checked, with the
  furthest ordinal floored at the resume ordinal) so a stream adopted after
  a sanctioned loop-back expresses both D3 derived values without loss.
  Absent keys stay omitted from canonical encoding, so every existing event
  and fixture keeps its digest. Law: genesis is an honest adoption-time
  snapshot — synthesizing `stage-entered`/`status-set` history for a
  packet's pre-adoption life is forbidden (fabricated actors and CAS
  ordering); prior history stays in git log and reflections. Implementation
  lands with the fleet campaign's genesis seeder, its first consumer.
- **Amendment F — tip-only committed trace.** The committed `ops/trace.json`
  re-scopes from the full verbatim timeline (projector v2) to a
  constant-size derived snapshot: source tip, revision, status,
  furthest/resume stages, risk-tier override, and the fork verdicts as
  identifiers (parent digest/seq plus child digests — preserving the SPEC's
  "visible fork, two children of one parent" acceptance; only the verbatim
  event timeline is dropped). The timeline stays derivable on demand from
  the event files. This keeps the PR-diff review
  signal, staleness detection, and the fork-loud merge conflict on parallel
  transitions while removing event byte-duplication and whole-file rewrite
  churn at fleet scale. Lands as the next projector bump, before the fleet
  campaign's bulk seeder writes traces at scale.
- **Amendment G — fork-repair applier staging + opt-in freeze.** A
  single-packet repair applier (`repair-fork --preview|--apply`, executing
  the shipped `planForkRepair`) is the fleet convention-migration campaign's
  first rung, proven by repairing the committed fork fixture end-to-end in
  CI. Until it ships, no packet beyond the D9 pilot may opt into
  `ops/events/`. Candidate 3 owns only the fleet-scale repair *flow* (bulk
  repair, advisory-to-blocking ratchet), never the applier itself.

## Queued amendment candidates (2026-08-25)

Proposed 2026-08-25; **ruled at the Session B grill 2026-08-26**. The binding
dispositions live in "Session B amendments (2026-08-26)" below — H and J
ratified in reshaped form, I rejected (D20–D22) — and this section is
preserved as the record of what was proposed. Three amendments were queued: H and
I draw their mapping evidence from
[`research/2026-08-25-agento-ontology-mapping.md`](./research/2026-08-25-agento-ontology-mapping.md)
(AgentO, ESWC 2026, CC BY 4.0, reference-only), and J draws its certificate
shape from
[`research/2026-08-25-ontology-tooling-recon.md`](./research/2026-08-25-ontology-tooling-recon.md)
(open-ontologies `Certificate` disposition). All three land inside existing
candidates; none opens a packet.

- **Amendment H (candidate 3) — typed `PacketWorkPlan`, rendered
  launchers.** The manifest gains a schema-first work plan: each phase step
  binds a responsible agent (kind, model, effort), the tools/skills it may
  use, its constraints (today's `stopConditions[]`), the resources it
  requires (today's `currentSourceOfTruth[]` / `researchReports[]`), and the
  human approver. `GOAL.md` becomes a read-only projection rendered from the
  work plan under a four-part prompt contract (instruction / context / input
  data / output indicator); the `targetChars`/`maxChars` budget moves from a
  hand-authoring rule to a render check. Motivation: which model at which
  effort ran which phase with which tools is the packet fact most often
  re-derived from session memory; the launcher is the one packet artifact
  that is authored by hand yet fully determined by the others. Precedent:
  the skill-contract kernel's typed `SkillContract` (#813). Adds
  `PacketWorkPlan`, `WorkPlanStep`, `ResponsibleAgent`, `LauncherRender` to
  candidate 3's significant-symbol ledger, so ratification must amend that
  ledger explicitly.
- **Amendment I (candidates 3 and 4) — JSON-LD projection lane.** One more
  read-only projection off the existing fold emits the packet graph with
  IRIs anchored on PROV-O (`prov:Agent`, `prov:Plan`, `prov:Activity`,
  `prov:Association`) and P-Plan (`pplan:Plan`, `pplan:Step`), carried as
  `SemanticSchemaMetadata` annotations on the manifest and event schemas and
  mapped (`rdfs:subClassOf` / `owl:equivalentClass`) to AgentO terms where
  the concepts coincide. Candidate 4's evidence receipts reuse the same IRIs
  on the runtime side (PROV `Activity` / `Generation`), where AgentO models
  nothing. D8 is untouched: Markdown packets plus the event chain remain the
  sole system of record; the graph is derived and disposable. The lane is
  justified by the join to the rest of the knowledge graph (research-report
  provenance, evidence spans, ontology packages), not by SPARQL over 214
  packets on its own, and it must show one such join in its acceptance.
- **Amendment J (candidates 2 and 4) — gate certificates.** Every packet
  gate (design approval, readiness, evidence closure, projection validation)
  emits a typed certificate rather than a boolean: a verdict from a closed
  vocabulary (`pass` / `reject` / `abstain`), `assumptions[]` naming every
  check that was skipped or degraded and why, the digests of the inputs the
  verdict was computed over, a rationale listing the rules that fired, and
  reach (what was and was not examined; a gate that skipped any check
  reports `conforms: null`, never `pass`). Approval and work-plan
  applications reference the certificate by id; an unknown id is an error,
  never a fallback to latest. Source: open-ontologies `Certificate`
  (`src/civex.rs`) and reach reporting (`src/shacl.rs`, `src/temporal.rs`),
  see
  [`research/2026-08-25-ontology-tooling-recon.md`](./research/2026-08-25-ontology-tooling-recon.md).
  Adds `GateCertificate`, `GateVerdict`, `GateAssumption`, `GateReach` to
  the candidate-2 ledger and makes candidate 4's `EvidenceReceipt` carry
  one.
- **Campaign method notes (not amendments).** The fleet
  convention-migration campaign adopts: (a) the AgentO paper's Sect. 4
  recipe — translate each non-v2 manifest with a mandatory "Issues /
  Assumptions" header, hand-review a stratified sample, extend the v2
  schema from the recurring issues, re-run and diff; (b) probe-actual-shape
  migration — the translator inspects which fields a manifest has rather
  than trusting a declared version, and the fixtures include real
  half-migrated packets (open-ontologies `src/state.rs`); (c) a
  Violation / Warning severity split in which references to not-yet-migrated
  packets warn rather than fail, so packets land in any order (ontoskills
  SHACL shapes); (d) a diff report that classifies each change as breaking /
  additive / cosmetic and names the affected packets (ontoskills
  `core/src/differ.py`); (e) a fleet-wide lint pass (cycles, duplicate
  slugs, unreachable packets) separate from per-packet shape checks. Under
  Amendment E the translation of a completed-retained packet yields a
  genesis event plus a translation report, never synthesized history.

## Session B amendments (2026-08-26)

Ratified at the Session B grill, which also chartered the fleet
convention-migration campaign as candidate 6 (D17–D19) and scoped the in-toto
deferral (D23). Evidence: six lane reports under
[`research/2026-08-26-session-b/`](./research/2026-08-26-session-b/) — three
repo audits and three web prior-art sweeps; the seventh lane was the rung-4
implementation itself, whose evidence is PR #848 and the rung-4 paragraph of
[`goals/packet-control-plane-core/PLAN.md`](../../goals/packet-control-plane-core/PLAN.md). The three candidates queued on 2026-08-25 were H, I, and J; two are
ratified in reshaped form and one is rejected.

- **Amendment H (candidate 3) — typed `PacketWorkPlan`, hand-authored
  launcher.** The manifest gains a schema-first work plan: each phase step
  binds a responsible agent kind, the tools and skills it may use, its
  constraints (today's `stopConditions[]`), the resources it requires (today's
  `currentSourceOfTruth[]` / `researchReports[]`), and the human approver. The
  plan is doctor-checkable — a phase that claims browser QA while its allowed
  tools carry no browser skill is a finding. Two things the 2026-08-25 proposal
  asked for are **not** ratified. `GOAL.md` stays hand-authored: a 14-launcher
  census found no irreplaceable prose but 57.1% of launcher characters
  depending on fields the manifest does not carry, so "fully determined by the
  others" is false, and every shipped analog that types agent and tools per
  step still authors its prompt. Model and effort stay out of the plan; they
  are run facts belonging on events and receipts, or in a fleet routing table
  the plan may override. The contract stays private to the Goals command tree
  with a Goals-local renderer for a generated sidecar (paths, stop conditions,
  allowed tools) that `GOAL.md` may include. Migration is advisory
  render-and-diff with human approval; terminal legacy launchers freeze rather
  than being rewritten. Adds `PacketWorkPlan`, `WorkPlanStep`,
  `ResponsibleAgent`, and `WorkPlanSidecar` to candidate 3's
  significant-symbol ledger; `LauncherRender` is not introduced. Evidence:
  [`C3-amendment-H.md`](./research/2026-08-26-session-b/C3-amendment-H.md),
  [`G3-amendment-H-prior-art.md`](./research/2026-08-26-session-b/G3-amendment-H-prior-art.md).
  Decision: D20.

- **Amendment I — rejected; requeued narrower and gated.** The proposed JSON-LD
  projection anchored on PROV-O and P-Plan and mapped to AgentO is rejected.
  CWLProv shipped that exact design and its own authors replaced the
  interchange with schema.org JSON-LD because PROV did not carry the join;
  Nextflow deleted its first-party legacy provenance format in 2025 for a
  native JSON lineage store; P-Plan is unmaintained; AgentO remains
  `owl:versionInfo 0.2` with no adopters. As worded it would also carry
  addressing on `SemanticSchemaMetadata`, whose `canonicalIri` and
  `preferredPrefix` are annotated `deprecated: true` in favor of
  composer-derived `iri`/`curie` — the layering identity-as-IRI ratified on
  2026-07-02. The surviving idea is requeued as a **named-consumer-gated
  schema.org/RO-Crate projection**: one read-only document carrying packet
  slug, git SHA, content hashes, and report identifiers, queryable without a
  triple store. Its gate is a named external consumer, not a demonstration.
  No packet opens and no ledger changes until that gate fires. Evidence:
  [`C4-amendment-I.md`](./research/2026-08-26-session-b/C4-amendment-I.md),
  [`G1-amendment-I-prior-art.md`](./research/2026-08-26-session-b/G1-amendment-I-prior-art.md).
  Decision: D21.

- **Amendment J — gate certificates, reshaped and pulled forward out of this
  MAP.** J no longer waits for candidates 2 and 4, and it is no longer a
  packet-local type. It lands as the next version of the existing
  `@beep/skill-contract` kernel, whose `EvidenceReceipt.ts` already declares
  itself "Unsigned, in-toto Statement-aligned" and carries digest-bound
  `EvidenceSubject` values. The gap is exact: `GateOutcome` is
  `LiteralKit(["allowed", "denied"])`, so the envelope and the digests exist
  and the honest outcome vocabulary does not. The verdict vocabulary is
  EARL/ACT's five outcomes — passed, failed, cantTell, untested, inapplicable —
  with untested outranking passed, replacing the proposed three-way. Reach is
  an explicit complete/incomplete/unknown aggregate, never a nullable
  `conforms` (`sh:conforms` is a boolean in SHACL; reusing the name for a
  nullable is a trap). Inconclusive checks are excluded from the aggregate **in
  the producer**, because three-valued producers are documented being collapsed
  to binary by their consumers. The envelope is an in-toto Statement
  (`_type`, `predicateType`, `subject[].digest`) carrying an internal
  predicate; see D23 for why that does not breach the signing deferral.
  Apply-by-id splits into its own plan artifact with Terraform stale-plan
  semantics — unknown digest is an error, known-but-stale against current state
  is an error, never latest. First slice: one certificate-producing QA judge
  settlement, which already imports the kernel. Candidate 2's ledger therefore
  does **not** gain `GateCertificate`/`GateVerdict`/`GateAssumption`/
  `GateReach`; candidate 4's `EvidenceReceipt` consumes the kernel's
  certificate rather than defining one. Evidence:
  [`C2-amendment-J.md`](./research/2026-08-26-session-b/C2-amendment-J.md),
  [`G2-amendment-J-prior-art.md`](./research/2026-08-26-session-b/G2-amendment-J-prior-art.md).
  Decision: D22.

- **Campaign method notes (adopted unchanged, not amendments).** The fleet
  convention-migration campaign — now candidate 6 — adopts: (a) the AgentO
  paper's Sect. 4 recipe, translating each non-v2 manifest with a mandatory
  "Issues / Assumptions" header, hand-reviewing a stratified sample, extending
  the v2 schema from the recurring issues, then re-running and diffing;
  (b) probe-actual-shape migration, where the translator inspects which fields
  a manifest has rather than trusting a declared version, with real
  half-migrated packets in the fixtures; (c) a Violation / Warning severity
  split in which references to not-yet-migrated packets warn rather than fail,
  so packets land in any order; (d) a diff report classifying each change as
  breaking, additive, or cosmetic and naming the affected packets; (e) a
  fleet-wide lint pass (cycles, duplicate slugs, unreachable packets) separate
  from per-packet shape checks. Under Amendment E the translation of a
  completed-retained packet yields a genesis event plus a translation report,
  never synthesized history.

## Candidate Goal Packets

| Order | Proposed slug | Mission | Dependencies | Live capability composition |
| --- | --- | --- | --- | --- |
| 1 | `packet-control-plane-core` (created 2026-08-17; closed `completed-retained` 2026-08-26) | Build the D8 single internal packet-core library in the existing Goals CLI area: versioned per-event CAS records, fork detection, deterministic fold, derived `furthestStage`/`resumeStage`, risk-tier floor/override, and trace projection; expose it first through guarded `beep goals` writers and a minimal read-only `beep explore --check`/doctor surface. | Current packet templates/manifests and existing Goals CLI; implemented with the current process, then self-hosted per D9. | Extend `packages/tooling/tool/cli/src/commands/Goals/Inventory.ts`, `Goals.schemas.ts`, `Doctor.ts`, `SetStatus.ts`, and `Goals.command.ts`: live inventory, schema decode, doctor/index, and the existing single writer. NET-NEW: exploration command/check, event schema/store/fold, fork repair, derived stages, tier computation, and packet-core tests. No new package unless the colocated core later proves a real extraction need. |
| 2 | `packet-design-approval-gate` (not yet created) | Add the fifth graduation readiness check: exact change tree, significant-symbol ledger, Light/Standard/Full routing, seeded DESIGN for Standard/Full, and protected docs-PR approval references whose subject digests are revalidated for staleness. | `packet-control-plane-core`; GitHub protected-review evidence supplied through the existing delivery workflow. | Reuse goal/exploration packet contracts, Yeet’s hosted PR/check evidence boundary, and architecture proof-manifest patterns. NET-NEW: change-tree/significant-symbol schemas, digest subjects, approval-reference events, staleness derivation, amendment events, and exploration graduation enforcement. |
| 3 | `packet-projection-migration` (D6 navigation slice shipped 2026-08-27; goal not yet created) | Finish migrating packet control state onto the event fold and generated projections. Ship-velocity P5 already landed wholesale local ATLAS generation and marked README status regions with an explicit manifest-adoption boundary; this packet retains fleet stream adoption, the by-state tree, guarded exploration status writes, and the remaining ratchet. | `packet-control-plane-core`; `packet-convention-migration` must lift Amendment G's stream freeze before fleet event authority; design-gate fields from `packet-design-approval-gate` where tier requires them; KSA Workstream D projection contract. | Reuse the shipped `Explore/Atlas.ts` D3 projector, `packages/tooling/tool/cli/src/commands/Goals/PortfolioIndex.ts`, `Inventory.ts`, `Doctor.ts`, and KSA Workstream D's deterministic projector contract. REMAINING NET-NEW: fleet exploration event migration, by-state tree, golden/upcaster migration fixtures, guarded exploration writers, fork-repair flow, and the wider advisory-to-blocking ratchet. |
| 4 | `packet-evidence-closure` (not yet created) | Make landed-versus-closed derivable: schema-valid digest-bound evidence receipts, proof-cache keys, systemic OPPORTUNITIES receipts/roll-up, and the four observational flow metrics. | `packet-control-plane-core`; projection consumers from `packet-projection-migration`; lands after the initial self-hosting slice exposes real friction. | Reuse docgen proof-manifest verification/memoization in `packages/tooling/tool/cli/src/commands/Docgen/internal/Targets.ts` and `Local.ts`, the existing reflection/Yeet evidence surfaces, and per-packet `research/OPPORTUNITIES.md`. NET-NEW: canonical receipt schema, merged-commit subject sealing, landed/closed derivation, opportunity schema/roll-up/mechanical drafts, and approval-wait/parked-age/gate-wall-cache/amendment-rate projections. |
| 5 | `packets-app-react-v2` (not yet created) | If daily use of KSA’s static v1 proves an interaction gap, ship a read-only React packets viewer over the same projector: pulse first, then kanban/DAG/roadmap/markdown drill-in, with scoped reproject push and ETag-poll fallback. | KSA Workstream D static self-contained HTML v1 must ship and daily-use evidence must identify a concrete interaction gap; `packet-projection-migration` supplies the shared projector and `sourceTip`. | Reuse the KSA projector contract and existing app Vite/portless conventions. NET-NEW: a packets app workspace, read-only React views, custom `packets:projection` HMR invalidation, ETag fallback, and visible source-tip/version/age staleness chrome. No write endpoint, drag-and-drop, or client-side frontier derivation. |
| 6 | `packet-convention-migration` (not yet created) | Ship the single-packet fork-repair applier (Amendment G rung 0), then migrate every non-v2 packet manifest onto the canonical v2 convention through a translate-review-amend-rerun loop, lifting the `ops/events/` opt-in freeze that currently holds the fleet at one stream. | `packet-control-plane-core` (closed); Amendment G's applier staging; Amendment E's genesis seeder and no-backfill law. | Reuse the shipped `planForkRepair` derivation, the `PacketCore` fold/store/writer, and `beep explore --check` as the mechanical acceptance rubric; extend `Goals.schemas.ts` toward the v2 translation target. NET-NEW: the `repair-fork --preview\|--apply` applier proved against the committed fork fixture in CI, a manifest translator that probes actual field shape rather than trusting a declared version, a Violation/Warning severity split so forward references to unmigrated packets warn, a breaking/additive/cosmetic drift report naming affected packets, a fleet-wide lint for cycles/duplicate slugs/unreachable packets, and the genesis seeder. |

## D5 Design-Gate Inventory

These are the exact change-tree envelopes and architecturally significant
symbols proposed for MAP review. They constrain the future goal SPEC/DESIGN
seeds; implementation may amend them only through the ratified amendment path.

| Candidate | Exact change-tree envelope | Significant-symbol ledger |
| --- | --- | --- |
| `packet-control-plane-core` (created 2026-08-17; closed `completed-retained` 2026-08-26) | Extend `packages/tooling/tool/cli/src/commands/Goals/{Goals.schemas.ts,Inventory.ts,Doctor.ts,SetStatus.ts,Goals.command.ts,index.ts}`; add a colocated `PacketCore/` internal module inside the Goals command tree (not yet created); add a minimal read-only `Explore/` command family in the repo CLI commands tree (not yet created); focused CLI tests only. | `PacketEvent`, `PacketEventId`, `PacketTip`, `PacketRevision`, `PacketEventStore`, `PacketFold`, `PacketDerivedState`, `PacketRiskTier`, `PacketTraceProjection`, guarded transition plan/write, exploration check result, fork verdict/repair plan. |
| `packet-design-approval-gate` (not yet created) | Add design/approval modules under the same packet-core; extend goal/exploration template and doctor/graduation contracts; seed `DESIGN.md` only for Standard/Full packet fixtures; add digest/staleness tests. | `PacketChangeTree`, `SignificantSymbol`, `DesignSubject`, `ApprovalReference`, `ApprovalFreshness`, `DesignAmendment`, risk-floor/override event, fifth-readiness verdict. |
| `packet-projection-migration` (D6 navigation slice shipped; goal not yet created) | Extend the shipped Atlas/README projector into fleet event adoption and the Goals/Explore doctor/index surfaces; add migration/upcaster/golden-stream fixtures and the generated by-state tree; add the typed work-plan module and Goals-local sidecar renderer (Amendment H, D20) with render-and-diff migration fixtures. | Shipped: `ExplorationProjectionState`, `ExplorationProjection`, `ExplorationAtlasRow`, README generated regions. Remaining: `PacketProjector`, `PacketProjection`, `sourceTip`, `projectorVersion`, `PacketUpcaster`, `ForkRepairPlan`, `PacketByStateTree`, `PacketWorkPlan`, `WorkPlanStep`, `ResponsibleAgent`, `WorkPlanSidecar`, adoption/migration plan. |
| `packet-evidence-closure` (not yet created) | Add receipt/closure/opportunity/metric modules under packet-core; extend Yeet/reflection evidence adapters and packet doctor projections; add per-packet opportunity-schema and fleet-roll-up fixtures. | `EvidenceSubject`, `EvidenceReceipt`, `ProofCacheKey`, `LandedState`, `ClosedState`, `OpportunityReceipt`, `FlowMetricSnapshot`, merged-commit seal verifier. |
| `packets-app-react-v2` (not yet created) | Create the `packets` app under `apps/` (not yet created) through `bun run beep create-package` only after the gate fires; consume the shared projection JSON/API adapter; add pulse, secondary views, staleness chrome, scoped watch/HMR, ETag poll, and browser-QA fixtures. | `PacketProjectionClient`, `PacketPulseView`, `OperatorQueueView`, `PacketStaleness`, `packets:projection` event contract, scoped reproject service, ETag poll fallback. |
| `packet-convention-migration` (not yet created) | Add a `Migration/` module beside the existing packet-core inside the Goals command tree (not yet created); extend the `Explore/` check with fleet-wide lint results; extend `Goals.schemas.ts` with the v2 translation target and half-migrated fixtures; add applier, translator, and fleet-lint tests. No packet docs change outside the migration's own output. | `PacketForkRepairApplier`, `ManifestTranslation`, `TranslationReport`, `TranslationAssumption`, `ManifestShapeProbe`, `MigrationSeverity`, `DriftClassification`, `FleetLintFinding`, `PacketGenesisSeed`. |

The React candidate’s exact home is the future `packets` app under `apps/` (not yet created), resolving D12’s deferred
home question. That path is a proposal only: the app and goal do not yet exist,
and the repo’s package-creation command remains mandatory if the gate fires.

## Dependency Edges

```text
packet-control-plane-core (closed 2026-08-26)
  -> packet-convention-migration          (candidate 6: Amendment G rung 0,
                                           fork-repair applier + fleet manifest
                                           migration; lifts the ops/events/
                                           opt-in freeze)
  -> packet-design-approval-gate
  -> packet-projection-migration
  -> packet-evidence-closure

packet-convention-migration
  -> packet-design-approval-gate           (graduation gate needs packets with
                                            streams to be enforceable)
  -> packet-projection-migration           (fleet adoption needs streams to
                                            migrate)

packet-control-plane-core (closed 2026-08-26)
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

**Status 2026-08-26 (Session B):** steps 1 and 2 are complete —
`packet-control-plane-core` shipped the core, self-hosted its own stream, and
closed `completed-retained` through its guarded writer (#848, #850). D17
inserts the fleet convention-migration campaign (candidate 6) ahead of step 3:
the design gate and fleet migration both presuppose packets carrying streams,
and the Amendment G opt-in freeze holds the fleet at the single pilot stream
until candidate 6's repair applier ships. The numbered sequence below is
preserved as the ratified record.

**Projection update 2026-08-27:** ship-velocity P5 pulled D6's Atlas/README
navigation slice forward without lifting Amendment G's fleet stream freeze.
The implementation records `manifest-adoption` as transitional authority and
switches permanently to the fail-closed PacketCore fold when a packet opts in.
This does not reorder candidate 6 ahead of the remaining candidate-3 work.

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

**Shipped 2026-08-17; the packet closed `completed-retained` 2026-08-26
(#848/#850), so this section is a completed record, not the active slice — the
open slice question is candidate 6's (see the Next Open Question in the
README).** As ratified:

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

- `packet-design-approval-gate` and `packet-projection-migration`
  (candidates 2 and 3): the stabilization gate — fold contract stabilizing,
  first slice proven, advisory self-hosting running — **fired 2026-08-26** on
  main evidence when `packet-control-plane-core` closed. Eligibility is not
  sequencing: D17 orders candidate 6 first, and their fleet-facing acceptance
  additionally depends on candidate 6 lifting the Amendment G `ops/events/`
  opt-in freeze — until the repair applier ships, their enforceable scope is
  the single pilot stream.
- `packet-evidence-closure` (candidate 4) still gates on observed self-hosting
  friction exposing real receipt and metric shapes.
- `packets-app-react-v2` remains dormant until KSA static v1 ships and daily
  use documents a concrete interaction gap.
- Any extraction of packet-core into a new workspace package requires live
  evidence that colocation is harmful; it is not authorized by this MAP.
- Sigstore/in-toto signing remains deferred until an external verifier/consumer
  exists and verifies fail-closed. Scoped by D23 (2026-08-26): the deferral
  covers signing and external verification only — the unsigned in-toto
  Statement *shape* is permitted internally and already shipped in
  `@beep/skill-contract`.
