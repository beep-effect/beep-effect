# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-08-05

Seeded from the signed-off routing matrix of
[`legal-patent-kg-deepening`](../legal-patent-kg-deepening/ROUTING-SEED.md),
TWO clusters. Primary: **"Legal positions, relators, and authorized
transitions"** (route `mixed`, wave P1, proposed slug
`legal-position-relator-runtime` — this packet). Carried: **"Legal
contradiction scope, priority, and correction deltas"** (re-routed 2026-08-04
in the phase-2 grill — compose, don't widen; it rides with this wedge and
`goals/epistemic-contradiction-triage` is composed as substrate, its SPEC not
amended). Machine rows:
[`routing-seed.json`](../legal-patent-kg-deepening/routing-seed.json). Second
wedge per the 2026-08-01 reconciliation grill order; opened 2026-08-05 on
Benjamin's call after the first wedge (`patent-citation-candor-gate`)
graduated.

### Nuggets (from the parent 46-row ledger)

From
[`research/nugget-catalog.json`](../legal-patent-kg-deepening/research/nugget-catalog.json).

Primary cluster:

- **T1-F1** (verified-finding, survived 3/3; track `10-track-legal-core` F1;
  distillates P095, P093, P031, P032, P047, P086, P088, P023, P075, P007,
  P004, P010): "Hohfeld's eight legal positions form four correlative pairs.
  Store one directed relation and derive its opposite view as a schema
  invariant instead of persisting two facts that can drift."
- **T1-F2** (verified-finding, survived 3/3; track `10-track-legal-core` F2;
  distillates P010, P086, P031, P004, P090, P091, P085, P088, L02, P049,
  P023, P047): "Legal relations are identity-bearing n-ary relators joining
  contingent roles, position moments, source norms, and grounding events. A
  binary epistemic edge is useful substrate but not the legal aggregate
  itself."
- **T1-F7** (verified-finding, survived 3/3; track `10-track-legal-core` F7;
  distillates P093, P007, P047, P023, P075, P088, P090, P091, P031, P032):
  "A legal power is an authorized network-rewriting operation that creates,
  modifies, or extinguishes positions. Attempted or ineffective acts remain
  recorded, while authority and constitutive conditions gate authoritative
  edge revisions."
- **T1-F9** (verified-finding, survived 2/3; track `10-track-legal-core` F9;
  distillates P085, P088, P049, P075, P043): "Competency questions translate
  directly into required legal-relation fields. Bearer, counterparty, act or
  omission, result, grounding event, and source rule should fail schema
  validation when absent."
- **T4-F6** (verified-finding, survived 2/3+; track `13-track-patent-llm` F6;
  distillates P079, P058): "Agent authority requires persistent Party
  identity, context-specific Role, and event-reified obligation and power
  lifecycles. Technical success or formal verification never establishes
  legal authority or validity."
- **P100** (unverified-addendum; track `14-addendum-new-items`): "FLINT
  models normative change through n-ary Act and Fact frames whose
  preconditioned acts create or terminate state facts. It may supply
  transition semantics over Hohfeldian relators, but it has not passed
  campaign verification."
- **R25** (unverified-addendum; track `14-addendum-new-items`): "Executable
  FLINT artifacts add SlotCorrespondence, hard and advisory shapes, source
  ranges, and competency queries. Apache-2.0 portions may be ported with
  attribution, while MPL-2.0 SHACL behavior requires clean-room re-expression
  if adopted."

Carried contradiction cluster:

- **T1-F3** (verified-finding, survived 3/3; track `10-track-legal-core` F3;
  distillates P004, P031, P032, P063, P008, P062, P014, P086, P082): "Legal
  contradiction triage must align position, parties, act, conditions,
  jurisdiction, and time before applying a typed, multi-axis priority stage.
  Rule conflicts, principle collisions, interpretation disputes, and factual
  disputes need distinct verdict families."
- **T3-F9** (verified-finding, survived 2/3+; track `12-track-graphrag` F9;
  distillates P083, L14, P078, P099): "Contradiction triage begins only after
  forum, jurisdiction, proof standard, time, parties, and institutional
  viewpoint align. Candidate generation, comparability, and adjudication
  remain separate stages."
- **T4-F8** (verified-finding, survived 2/3+; track `13-track-patent-llm` F8;
  distillates P016, P037, P058, P079): "Model correction must append the
  source, initial candidate, validator report, semantic checkpoints, explicit
  delta, revised candidate, and reviewer action. Unresolved differences
  become contradiction candidates rather than silently overwritten output."

### Cluster grounding (net-new vs already-covered, from the routing seed)

Net-new (source-only rg 2026-08-01 returned zero symbols):

- `[T1-F1,T1-F2,T1-F9]` A closed `HohfeldPosition` domain, a derived
  correlative bimap, and an n-ary `LegalPositionRelator` aggregate — zero
  `Hohfeld` or `LegalPositionRelator` symbols in package source.
- `[T1-F7,T4-F6,P100]` `PowerExercise` / `ActFrame` events that retain
  attempted and ineffective acts while authority gates edge revisions — zero
  `PowerExercise` or `ActFrame` symbols.
- `[R25]` `SlotCorrespondence` and FLINT competency validators — zero
  symbols; `R25` is also unverified addendum material.
- `[T1-F3,T3-F9]` `LegalScopeContext` and typed `PriorityBasis` fields
  covering party, forum, jurisdiction, proof standard, position tuple, time,
  authority, and viewpoint — zero matching symbols.
- `[T1-F3]` Rule-conflict, principle-collision, interpretation-dispute, and
  disputed-event verdict families —
  `goals/epistemic-contradiction-triage/SPEC.md:49-55` owns generic
  candidates only.
- `[T4-F8]` A caller-owned `CorrectionDelta` emission contract retaining
  original candidate, validator report, semantic checkpoints, explicit delta,
  revised candidate, model/configuration, and reviewer action — zero symbols.

Already covered (compose, do not rebuild):

- `[T1-F1]` `@beep/ontology` already supplies `LiteralKit` domains, SKOS
  mapping kinds, `TaxonomySeed`, and its registry/loader
  (`packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:98,140,287`;
  `TaxonomyLoader.ts:58,194`).
- `[T1-F2,T1-F7]` `EdgeVersion` already carries binary endpoints, immutable
  `fact`, valid time, transaction time, and supersedes lineage
  (`packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:106-163`).
- `[T1-F7,T4-F6]` `RuntimeApprovalGate` provides the human approval surface
  and `EdgeAuthority` owns record/supersede primitives
  (`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:473-490`;
  `packages/epistemic/use-cases/src/EdgeAuthority/EdgeAuthority.ports.ts:60-100`).
- `[T1-F3,T3-F9,T4-F8]` The active triage goal already owns durable
  contradiction candidates, duplicate suppression, unresolved visibility,
  scoped human disposition, and candidate-to-atomic-supersession flow
  (`goals/epistemic-contradiction-triage/SPEC.md:6-9,49-55,86-95,114-118`).
- `[T4-F8]` `EdgeAuthority` already makes supersession append-only and
  transactionally separate from detection
  (`packages/epistemic/use-cases/src/EdgeAuthority/EdgeAuthority.ports.ts:3-34`).

### Cautions (carried forward verbatim from the routing seed)

Primary cluster:

- "[P100,R25] unverified-addendum: donor semantics and license boundaries
  must pass adversarial verification before adoption."
- "[T1-F2,T1-F7] The completed-retained edge core is substrate, not the owner
  of legal vocabulary; do not widen goals/epistemic-bitemporal-edge-core
  silently."
- "[T1-F1] Keep correlativity outside plain SKOS triples unless Benjamin
  later approves a different boundary."

Carried contradiction cluster (the route caution itself is RESOLVED
2026-08-04 — compose, don't widen; retained in the parent seed for
provenance):

- "[T4-F8] Keep ODRL and other caller vocabularies out of the generic
  epistemic goal."
- "[T3-F9] Temporal overlap creates a candidate only; it never adjudicates
  truth or supersession."

### Cluster rationale (routing seed, verbatim)

Primary: "`[T1-F1,T1-F2,T1-F7,T1-F9,T4-F6]` compose a legal consumer
aggregate over three live foundations—taxonomy, bitemporal edges, and
approval—but no current packet owns their combined legal meaning.
`[P100,R25]` may strengthen the transition half only after verification."

Carried: "`[T1-F3,T3-F9,T4-F8]` are semantic inputs and caller contracts for
the existing candidate/adjudication pipeline, not a second triage engine."

### Phase-2 grill pointers

Unlike the candor wedge, ownership is NOT grounded at open: campaign
constraint 8 fixes only that legal vocabulary lives in a legal consumer
domain — whether that is `packages/law-practice/domain` beside the patent
entities or a separate legal consumer core package is a named align question
(`ops/manifest.json`). Wedge-scoped decisions (research lanes, dependency
posture, orchestration, PR staging): [`DECISIONS.md`](./DECISIONS.md).
Campaign-level decisions (phase shape, contradiction-cluster re-route,
unblock milestone):
[`../legal-patent-kg-deepening/DECISIONS.md`](../legal-patent-kg-deepening/DECISIONS.md),
2026-08-04 entries. Sibling boundary: the graduated candor goal's SPEC
(`goals/patent-citation-candor-gate/SPEC.md`) is a stable reference point per
the unblock-milestone rationale — its event/disposition/gate shapes are
composed against, never reopened from here.
