# Legal Position Relator Runtime Spec

## Objective

Give the law-practice slice its structural legal core — the vocabulary that lets
two legal claims be *comparable inputs* at all, which the live
contradiction-triage engine currently has no caller able to supply:

- A closed eight-member `HohfeldPosition` domain in its two orbits, with
  **correlative** and **opposite** derivations defined over
  `(positionKind, LegalActContent)` — pure, total, involutive, commuting — where
  the opposite derivation moves kind and content polarity together in one step.
- A **simple** `LegalPositionRelator` that stores exactly one advantage-side
  directed relation and derives every other view; persisting both ends of a
  correlative pair is a schema defect, not a style choice.
- A `LegalPositionRelatorPolicy` service that answers two set-theoretic facts
  about two relators — whether their recorded scopes overlap on every axis, and
  whether their positions are prima facie opposed under the `(kind, content)`
  opposite derivation composed with the correlative view — emitting typed
  candidate *inputs*. Legal comparability itself is never computed.
- Rung 2 adds authority-gated `PowerExercise`/`ActFrame` transition events that
  keep attempted and ineffective acts on the record, the caller-owned
  `CorrectionDelta`, `PriorityBasis` as input structure, the handoff into the
  live triage repository contract, competency-question acceptance fixtures, and
  durable append-only storage.

The system records positions, exercises, and scope alignments. Legal judgment
stays human, always.

## Decision Log (binding — from the graduated exploration)

Full grill log with rationale and rejected options:
[`explorations/legal-position-relator-runtime/DECISIONS.md`](../../explorations/legal-position-relator-runtime/DECISIONS.md).
Normative here — four wedge-scoped (1–4) and six align (5–10), plus the two
decompose settlements (11–12):

1. **Research depth** — two lanes (repo surfaces; bounded legal-theory frame
   over public primary sources only), synthesized before align. No client or
   pre-publication material touches any cloud model.
2. **Dependency posture** — live source + SPEC-bound. Rung 1 composes only live
   code. All carried contradiction vocabulary is written against
   `goals/epistemic-contradiction-triage`'s SPEC as a binding contract: that
   SPEC is **never amended from here**, and minimal generic extension slots may
   be proposed later only with fixture evidence. This goal never blocks on a
   sibling goal and never forks one's contract.
3. **Orchestration** — Claude Opus 5 subagents for research and adversarial
   review; the main thread does grill/align/synthesis only.
4. **Design order** — schema → `Context.Service` contract → implementation
   (standing repo law; rung 1 follows it end to end).
5. **V1 scope** — scheme **plus** simple relator. Rung 1 ships the closed
   position domain, both derivations over `(kind, content)` with act/omission
   polarity, and the simple relator (one correlative pair + roles + source norm
   + grounding event). Complex-relator composition, `SlotCorrespondence`, and
   `PowerExercise`/`ActFrame` defer to rung 2. Rationale: the opposite
   derivation is *unsound* without polarity, polarity lives in content, and
   UFO-L's "essential and inseparable parts" makes the correlative pair the
   simple relator — a scheme alone cannot express its own invariant.
6. **Package home** — `packages/law-practice/domain` beside the patent
   entities, entity ids in `packages/shared/domain/src/identity/LawPractice.ts`,
   with a named **promotion gate**: extract a legal-core package only when a
   second legal consumer needs the contract, through the normal
   promotion-record gate. UFO-L's core-vs-domain layering is preserved as a
   future move, not an up-front package.
7. **Party–Role/principal split** — split, composing the shared `Principal`.
   `Party` is persistent generic identity that *references* existing identities;
   `LegalRole` is norm-prescribed, scoped to a relator, carries its `sourceNorm`,
   and takes a role-mixin-style multi-kind player constraint (a natural or
   juristic person may hold the same role). The agents runtime is **not**
   widened: `RuntimePrincipalId` stays agents-private, and migrating it onto the
   shared `Principal` union is that slice's named follow-on. Role multiplicity
   is the mechanism by which principle collisions arise, so a collapsed model
   cannot represent the collisions this vocabulary exists to record.
8. **`CorrectionDelta` shape** — the full shape: an append-only event carrying a
   two-severity `validatorReport` (hard/advisory, never a boolean), a stage tag
   from the interpretation → qualification → assessment triple, per-element
   source pointers (which slot the correction touched, not one document pointer
   per record), a `reviewerAction` vocabulary including `undetermined`, and
   unresolved differences defaulting into contradiction candidates. Emission
   stays caller-owned.
9. **Void vs penalised** — two independent recorded axes, never one field: a
   constitution outcome (`constituted` / `not-constituted`) and a permission
   status (`permitted` / `violative`). A void act (no power) stays on the record
   as an attempted exercise with zero position effect; a violative-but-
   constituted act (no permission) changes positions AND records the violation.
   Both are recorded determinations bound to an attributed interpretation; in a
   contested case the system never computes which applies. The axes land in the
   relator's event vocabulary from rung 1; `PowerExercise` as an entity is
   rung 2. eFLINT's uniform violation rule is the named donor trap and is never
   copied.
10. **Opposite-derivation content model** — `LegalActContent`: required
    act/omission polarity as a typed field, act description as
    structured-but-plain text for now, equality/digest-capable so relator
    content can be compared for candidate alignment. The opposite derivation
    negates polarity and preserves the rest. A typed act-verb vocabulary is
    deferred; if it ever materializes it composes `goals/semantic-foundation`'s
    scheme loading, never a new registry.
11. **Decompose settlement — the migration-lane fork resolves in this goal's
    favour.** The BRIEF priced rung 2 conditionally on which packet establishes
    the law-practice migration precedent. The candor goal's rung 2 shipped to
    `main` as PR #575 on 2026-08-06, so this goal is **not** the first mover and
    does not pay that cost: the slice's schema is already in the baseline
    snapshot (`packages/_internal/db-admin/drizzle/20260806031625_law_practice_candor_gate/`,
    still the only migration naming `law_practice`), `AcceptedProofManifest.ts`
    already carries three entries for that lane (`:808` `migration.sql`, `:814`
    `snapshot.json`, `:874` the PGlite proof — the migration *target module* at
    `:724` is a separate artifact class a delta migration need not add),
    and an append-only PGlite proof exists to clone
    (`packages/_internal/db-admin/test/integration/LawPracticeCandorGateMigration.pglite.test.ts`).
    Rung 2 therefore generates a delta migration, not a bootstrap. Evidence:
    [`explorations/legal-position-relator-runtime/MAP.md`](../../explorations/legal-position-relator-runtime/MAP.md)
    § Sequencing.
12. **Decompose settlement — the candidate-handoff shape splits in two, and only
    half is settled.** Rung 1 crosses no slice boundary: the policy service
    returns typed candidate *inputs* to its law-practice caller as ordinary
    return values, with no epistemic type in its signature or requirement
    channel. Rung 2's handoff into the live triage repository is the real
    crossing, and the binding pick is a **P0 output**, not a pre-authorized
    edit — see Constraints for the four evaluated shapes and what P0 must
    produce.

## Non-Goals

- **No computed legal judgment, ever**: validity of an act, authority of a
  party, priority outcomes between conflicting positions, contradiction
  verdicts, **legal comparability of two positions**, or semantic act
  equivalence. Assessment exists only relative to a named, attributed
  interpretation and is never asserted as legal truth. The inherited boundary
  table in Constraints is normative.
- No amendment of `goals/epistemic-contradiction-triage`'s SPEC, no legal
  verdict families or IP-law vocabulary in the generic goal, and no second
  triage engine. Candidates compose the live repository contract as-is; minimal
  generic extension slots may be proposed later only with fixture evidence.
- No widening of `EdgeVersion` — the binary substrate stays binary; the relator
  is a multi-element law-practice aggregate (still two-party) over its posture,
  not a schema change to it — and no changes to the agents runtime's principal
  or approval contracts.
- No stored correlative or opposite views and no burden-side storage: one
  advantage-side relation stored, all other views derived.
- No kind-only opposite derivation, and no polarity-only opposite derivation
  either — the derivation moves kind and content together, always.
- No executable validation shapes ship from this goal: validator severity is a
  recorded field on `CorrectionDelta`; registry-carried executable shapes stay
  routed to `goals/semantic-foundation`'s M4 gate.
- No new packages: everything lands in existing law-practice packages plus the
  identity registration in `packages/shared/domain`. Extraction of a legal-core
  package waits for a second legal consumer through the normal promotion-record
  gate.
- No correlativity encoded in SKOS triples or `TaxonomySeed`, and no reuse of
  `@beep/ontology`'s inverse/reverse machinery — the derivations are typed
  schema derivations in the consuming domain package.
- No typed act-verb ontology and no function-verb seed scheme in this goal.
- No `PowerExercise` entity, no `ActFrame`, no `SlotCorrespondence`, and no
  complex-relator composition in rung 1.
- No multital/in-rem generalization: rung 1 models two-party paucital relations
  only.
- No vendoring of donor material. UFO-L and FLINT/eFLINT **papers** are cited,
  never copied (only the CEUR demo paper is CC BY 4.0 — no figures or extended
  passages from the others); `flint-ontology` follows the per-portion license
  discipline in [`research/SOURCES.md`](./research/SOURCES.md).
- No eFLINT uniform violation rule: the two-axis void-vs-penalised distinction
  is load-bearing and never collapses.
- No identity-resolution or entity-merge machine for parties, and no mapping of
  PACER driver DTOs into law identities.
- No versioned norm/rule identity modelling — `sourceNorm` is an opaque
  reference; its internals belong to the queued `legal-rule-time-identity`
  wedge.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards — `standards/ARCHITECTURE.md`,
   `standards/architecture/10-cross-slice-coordination.md`, and
   `standards/architecture/DECISIONS.md` bind the rung-2 handoff shape.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/law-practice/domain` — `HohfeldPosition` and the derivations,
  `LegalActContent`, `Party`, `LegalRole`, `LegalPositionRelator`,
  `LegalScopeContext`; rung 2 adds `PowerExercise`/`ActFrame`,
  `CorrectionDelta`, `PriorityBasis`. File-role precedent:
  `<Name>.model.ts` + `<Name>.values.ts` + `index.ts` where a literal/value
  domain exists (`packages/law-practice/domain/src/entities/PatentCitationEvent/`),
  `.model.ts` + `index.ts` where none does
  (`.../entities/PriorArtReference/`). **This tier declares no epistemic
  dependency and must stay that way** — both law-practice package READMEs and
  `goals/law-practice-office-action-spike/SPEC.md:207` commit to it.
- `packages/shared/domain` — identity module only: the new EntityId
  registrations in `src/identity/LawPractice.ts`, following the four candor-era
  registrations (`:217`, `:304`, `:338`, `:371`) built from
  `EntityId.factory("law_practice", $I)` (`:12`).
- `packages/law-practice/use-cases` — the `LegalPositionRelatorPolicy`
  `Context.Service` and its test. The `Context.Service` tag belongs in
  `*.ports.ts`, not `*.service.ts` (precedent:
  `packages/law-practice/use-cases/src/CandorPolicy/CandorPolicy.ports.ts:243`;
  `CandorPolicy.service.ts` holds only the factory and the `Live` layer).
- Rung 2: `packages/law-practice/tables`, `packages/law-practice/server`, and
  the db-admin migration lane (a **second** law-practice migration + PGlite
  proof + `AcceptedProofManifest` entries — decision 11).
- This packet's own files under `goals/legal-position-relator-runtime/`.

## Constraints

### Never-compute boundary (inherited, normative)

Inherited from
[`explorations/legal-position-relator-runtime/research/02-position-relator-legal-frame.md`](../../explorations/legal-position-relator-runtime/research/02-position-relator-legal-frame.md)
§6.2, drawn from what the primary sources say the machinery does **not** do, not
from engineering caution. "Records" means the system may store, index, validate
the shape of, and render it. "Derives" means the system may compute it as a pure
total function over stored data, presented as a view. "Never computes" means the
system must not produce it **and must not present a proxy for it**.

| # | Concern | Records | Derives (pure view) | NEVER computes |
| --- | --- | --- | --- | --- |
| 1 | Legal position | The stored directed position: bearer, counterparty role, kind, content+polarity, source rule, grounding event, asserting interpreter, valid/transaction time | Correlative view; opposite view over `(kind, content)`; aggregate views | Whether the position actually obtains in law |
| 2 | Interpretation | That interpreter I read source S as frame F, at time T, with a text-fragment reference | Diffs between two interpretations of the same source | Which interpretation is correct |
| 3 | Qualification | That official O qualified brute fact B as institutional fact iF, with basis | Which stored facts lack a qualification record | Whether B *counts as* iF |
| 4 | Authority of a party | The **asserted** authority basis: the Legal Object cited, the role claimed, the conferring event | Whether an authority basis is present, cited, and internally consistent | Whether the party **has** the authority |
| 5 | Validity / effectiveness of an act | The attempted act as an event; its asserted preconditions; the human disposition (effective / void / disputed / undetermined) | Which asserted preconditions have no supporting stored fact | Whether the act was legally valid, or whether effects apply |
| 6 | Violation | That a duty's violation condition was **asserted** met, by whom, on what basis | Which duties have violation conditions with no evaluation record | Whether a violation legally occurred, and its consequences |
| 7 | Scope alignment | Material, temporal, jurisdictional/territorial, quantitative, subjective scope as recorded values | Whether two positions' recorded scopes **overlap on every axis** — a set-theoretic fact | Whether two positions are *legally comparable* |
| 8 | Contradiction candidacy | Candidate pairs whose scopes overlap and whose positions are prima facie opposed | Candidate generation, duplicate suppression, unresolved visibility | That the pair **is** a contradiction |
| 9 | Contradiction verdict family | The attorney-assigned family: rule conflict / principle collision / interpretation dispute / factual dispute | Which candidates lack a family assignment | Which family a candidate belongs to |
| 10 | Priority between conflicting positions | The **basis** for a priority claim: asserting authority level, source precedence, specificity, time, forum | Whether two priority claims cite incompatible bases | Which position **wins** |
| 11 | Completeness / closure | Which competency questions a given relator answers and which it leaves blank | Coverage gaps against a required-field set | That the legal picture is complete |

Three failure modes this boundary exists to prevent, each of which the
implementation must be structurally unable to reach: **authority laundering** (a
renderer showing an exercise without its disposition state, including
`undetermined`); **priority by implementation accident** (conflicting positions
returned in any order that could read as precedence — they are an unordered set
with their recorded bases, and any ordering is an explicit attributed human
act); and **correlative drift** (both ends persisted, one superseded, the graph
now asserting a duty with no claim — prevented by one-stored-relation).

The graduated sibling already states the authority half of this boundary, and
this goal **composes** that language rather than reformulating it so the two do
not drift apart. In `goals/patent-citation-candor-gate/SPEC.md`: the Non-Goals
bullets opening "No computed legal judgment, ever" and "No inference of examiner
reliance" (`:118-124`), and the Constraints bullet opening "Disposition
authorship is recorded; practitioner authority is not enforced" (`:249-262`),
whose operative sentence is "the gate proves that a human principal disposed the
exact observation version, never that the human was authorized to."

Both the quoted phrases and the ranges are given, and the phrases are what
govern: this pair was line-anchored at `:73-79` / `:204-217` in this wedge's
research, which was correct against that SPEC at its graduation commit and was
silently invalidated when PR #575 inserted decisions 9–11 above them. The same
stale pair survives in
[`research/01-repo-surfaces.md`](../../explorations/legal-position-relator-runtime/research/01-repo-surfaces.md)
§7 as a historical artifact; re-verify against the phrases, not the numbers.

### Schema and derivation soundness

- The stored `positionKind` is canonicalised to the **advantage side**
  `{claim, privilege, power, immunity}`; burden-side kinds exist in the domain
  solely as derivation outputs. The canonicalisation is a recorded modelling
  decision, not Hohfeld's — his tables are symmetric — and it is what makes the
  stored form unique.
- Correlative maps kind through the correlative pairs (claim↔duty,
  privilege↔noRight, power↔liability, immunity↔disability) with content
  unchanged, swapping holder and counterparty — the cross-party view of one
  relation. Opposite maps kind through the opposite pairs (claim↔noRight,
  privilege↔duty, power↔disability, immunity↔liability) **and** negates content
  polarity in the same step — the same-party negation. The two commute and
  generate a Klein four-group over the eight positions with exactly two orbits;
  their composite is not exposed as a view in this goal.
- **Polarity lives inside content.** A derivation that moves kind without
  content, or content without kind, is the named unsoundness and never ships.
- Schema-required fields on the relator, failing validation when absent:
  `positionKind`, bearer, counterparty, act-or-omission content, source norm
  (an opaque reference), grounding events, and the asserting interpreter (a
  shared `Principal` — every determination is bound to an attributed
  interpretation).
- Grounding events are a **lineage reference, never a scalar**: a derived
  relator links both the exercise that produced it and the founding event of the
  relator whose power was exercised. Follow the `EdgeVersion.supersedesId`
  self-reference posture
  (`packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:141-143`)
  as a **pattern only, never an import**.
- `result` does **not** live on the relator. Requiring it on a standing position
  forces placeholder values — the false-closure trap the sibling goal exists to
  prevent. It is a required field of the rung-2 exercise event.
- `LegalScopeContext` carries exactly the five UFO-L case-study axes: material,
  temporal, jurisdictional/territorial, quantitative, subjective. Forum, proof
  standard, and institutional viewpoint arrive with `PriorityBasis` in rung 2.
- Content equality is **exact, not semantic**. The digest treats
  differently-worded same acts as different content, which under-generates
  candidates by design. No act-equivalence inference, embedding similarity, or
  normalization passes to "fix" it — semantic equivalence is attributed human
  interpretation, recorded not computed.
- Party linkage is **by reference**. The live party-likes are fixture-thin —
  `LegalClient` has three domain fields, `LegalContact` and `Matter` four, their
  literal domains are single-member (`["active_client"]`, `["founder"]`,
  `["patent_application"]`), and linkage between them is by
  `legalClientFixtureKey` **text, not an EntityId foreign key**. No design may
  assume entity-ref edges between law parties that do not exist.

### Repo law

- Effect v4 + schema-first throughout: `LiteralKit` from `@beep/schema` for
  every string-literal vocabulary, derived `S.is(...)` guards over hand-rolled
  predicates, `Effect.fn`/`Effect.fnUntraced` for effect generators, effect
  collection modules over native `Set`/`Map`, and tests importing package source
  through `@beep/*` aliases with `it.effect`.
- Deriving the advantage-side subdomain follows the live `pickOptions` + `S.is`
  precedent (`packages/epistemic/domain/src/values/EdgeRelation/EdgeRelation.model.ts:54`,
  `:74`, `:127-128`) — pattern only, never imported.
- The one live involution in the repo,
  `packages/ontology/domain/src/aggregates/Session/Session.model.ts:861`, is a
  `.match`-based swap over a two-member tagged union. Copy that **style**; its
  substance (RDF quad add/remove, no content to negate) does not transfer, and
  the four other inverse-flavoured surfaces named in
  [`MAP.md`](../../explorations/legal-position-relator-runtime/MAP.md) are all
  the wrong shape.
- Actor provenance arrives free: `createdByPrincipal`/`updatedByPrincipal` on
  `BaseEntity.fields` (`packages/shared/domain/src/entity/BaseEntity.ts:82`,
  `:88`), persisted jsonb with `valueStrategy: "providedByContext"`.

### Rung-2 cross-slice handoff (P0 output, not a pre-authorized edit)

Four shapes were evaluated at decompose. **Three carry disqualifying evidence,
and the fourth — extending the slice's documented bounded epistemic exception —
sits closer to tripping that exception's own removal condition than to being
covered by it. None is picked here**; P0 makes the binding call with an
`architecture-guardian` check and records it in this decision log together with
the exact consumer and binding files that shape writes.

- **Emitted events — unavailable.** Zero slice `*.events.ts`,
  `*.event-handlers.ts`, or `*.processes.ts` in `packages/**/src`; no bus, no
  dispatcher, no process manager. The cross-slice event contract would itself
  have to live in the non-existent `shared/use-cases`
  (`standards/architecture/10-cross-slice-coordination.md:24-30`), making this a
  strict superset of the next option's cost.
- **Promoted `shared/use-cases` contract — unavailable without waiving its own
  bar.** `packages/shared/` holds only `domain/` and `tables/`;
  `standards/architecture/02-shared-kernel.md:189` requires ≥2 packages
  *currently* importing the export by name.
- **Foundation-mediated port inversion — available, ratified 2026-07-25**
  (`standards/architecture/10-cross-slice-coordination.md:36-51`;
  `standards/architecture/DECISIONS.md:1095-1148`), with two landed precedents,
  one already consumed by this slice (`SourceTextResolver` at
  `packages/law-practice/use-cases/src/CandorPolicy/CandorPolicy.ports.ts:14`).
  **But not automatically admissible here**: the ratifying rationale is a
  synchronous fail-closed gate — "an emitted event cannot express 'and do not
  proceed'" — whereas a candidate handoff is an asynchronous data submission, so
  the rationale does not transfer; and admission condition 1 requires the port
  carry **no product semantics**, which triage candidate vocabulary arguably
  does. It also mandates a README record in both packages
  (`standards/architecture/DECISIONS.md:1117-1120`).
- **Extending the slice's existing documented bounded exception.**
  `packages/law-practice/use-cases/README.md:18-22` and
  `packages/law-practice/server/README.md:15-21` record importing
  `@beep/epistemic-*` as the slice's documented cross-slice bounded exception,
  and `packages/law-practice/use-cases/package.json:52-53` already declares
  `@beep/epistemic-domain` and `@beep/epistemic-use-cases` — so this adds **no
  new package edge**. But the exception's ledger row is scoped to the
  *gate/projection* composition
  (`goals/law-practice-office-action-spike/SPEC.md:258`) and its removal
  condition reads: "Extract a `shared/use-cases` contract (or emitted event)
  when a third consumer of the epistemic boundary appears." A triage handoff is
  a new consumer — closer to the event that *trips* the removal condition than
  to something the exception covers. P0 must read that row and say which.

Binding regardless of the pick:

- **No new `law-practice/*` → `epistemic/*` package edge.** The existing drift
  is real and wide — 13 import sites across 4 files, and
  `packages/law-practice/server/package.json:47-50` declares four epistemic
  packages including `@beep/epistemic-tables` (cross-slice table reads,
  separately banned at
  `standards/architecture/10-cross-slice-coordination.md:57`). This goal must
  not compound it. Cleaning it up is a named follow-on, not this goal.
- **Rung 1 does not touch the breach surface at all**, because it crosses no
  boundary and its schemas land in the epistemic-free domain tier.
- **`standards/ARCHITECTURE.md:632-636` is line-accurate but doctrinally
  stale** — nothing in its neighbourhood cross-references the third mechanism
  ratified 2026-07-25. Cite it only as the two-mechanism baseline, always paired
  with `10-cross-slice-coordination.md:36-51` and `DECISIONS.md:1095-1148`.
- **`submit` is repository-port-only.** There is no `submit` RPC
  (`ContradictionTriage.rpc.ts` exposes list/get/review/getEvidenceSourcePage)
  and no `submit` on the service facade
  (`ContradictionTriage.service.ts:40-56`), so any submitting caller is an
  in-process server-tier caller by construction. Building a network-boundary
  submit path would widen the epistemic goal and is out of scope.
  `SubmitContradictionCandidate` (`ContradictionTriage.commands.ts:125`, struct
  `:34-75`) declares eleven fields, of which only **four** are epistemic
  vocabulary — `assessment`, `matchBasis`, `pair`, `receiptKey`, from
  `@beep/epistemic-domain/values/Contradiction` (`:9-17`). The other seven
  (`orgId`, `receivedBy`, `source`, `recordedAt`, `validFrom`, `validTo`,
  `schemaVersion`) are shared-kernel / `@beep/schema` types the slice already
  imports. Submission still cannot be constructed without the epistemic four,
  but P0 should weigh admission condition 1 against that actual ratio, not
  against the whole command. Note also that `@beep/epistemic-use-cases` exposes
  no `./ContradictionTriage` subpath (unlike `./ClaimGate`, `./EdgeAuthority`,
  `./ExecutionLedger`), and the submit command and repository port are
  **server-only**: reach them only through `@beep/epistemic-use-cases/server`
  (`src/ContradictionTriage/server.ts`). `./public` and the root re-export just
  the client-safe contradiction surface (`src/ContradictionTriage/index.ts` —
  query, review, read models, RPCs), which reinforces that any submitting caller
  is an in-process server-tier caller by construction.
- **This goal never claims a live handoff it cannot prove.** The governing
  precedent is the sibling's owner ruling — durability now, cross-slice
  consultation deferred with standing evidence and the Exception Ledger entry
  left PENDING and unexercised
  (`goals/patent-citation-candor-gate/SPEC.md:100-114`).

### Triage composition

- Candidates enter only through the live five-operation repository contract
  (`packages/epistemic/use-cases/src/ContradictionTriage/ContradictionTriage.ports.ts:374-395`).
  Nothing law-side reaches into candidate ownership, duplicate suppression, or
  disposition flow.
- The generic vocabularies are closed and stay closed:
  `ContradictionMatchBasisKind` is `["same-source-overlap", "independent-evidence"]`
  and `ContradictionDispositionStatus` is `["rejected", "superseded"]`. The four
  legal verdict families are law-practice vocabulary on law-side records; the
  generic disposition vocabulary is untouched, and no single merged verdict enum
  is created (`goals/epistemic-contradiction-triage/SPEC.md:76-78`).
- `goals/epistemic-contradiction-triage` is **landed-but-unverified** —
  lifecycle `active`, P0/P1 complete, P2 Verify in-progress, acceptance criteria
  still unchecked. Compose against the shipped contract; do not describe it as a
  finished dependency, and re-check its state at each phase start.

### Donor discipline

- Position domain and relator shape from UFO-L; frame/slot/precondition/
  source-reference machinery and the validator severity split from FLINT.
  eFLINT's execution semantics are excluded (the P100 correction).
- FLINT narrows, UFO-L widens — keep them in their lanes. FLINT's own competency
  scope excludes liberty–no-right, immunity–disability, and omissions; the
  position domain comes from UFO-L and must not shrink to what FLINT's frames
  cover. Closing the domain at eight is a recorded stance against the live
  FLINT/Kocourek reduction that treats liberty–no-right and immunity–disability
  as absences.
- **MPL-2.0 clean-room is file-scoped, not novelty-scoped.** The pre-existing
  `ShaclSeverity` in `@beep/semantic-web` narrows what rung 2 *wants* from
  `flint-ontology/shacl/`, not the obligation: anything taken from either
  `shacl/*.ttl` file is clean-room re-expressed regardless of novelty — no
  copying of shape text, SPARQL constraint bodies, or file structure — and the
  clean-room derivation is recorded in [`research/SOURCES.md`](./research/SOURCES.md).
  Top-level Apache-2.0 portions are port-with-attribution, following the live
  Graphiti notice precedent
  (`packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:16-25`).

### Budget

Circuit-breaker, in order, if rung 1 busts its week:

1. Drop `LegalScopeContext` and the scope-overlap-and-opposition check — both
   return in rung 2 with the candidate handoff. This deletes the two
   scope-dependent proof assertions, leaving the reduced proof set: derivation
   exhaustion, relator validation, one-stored-relation.
2. Degrade `Party` linkage to an opaque party reference id, moving typed linkage
   into rung 2 — the linkage shape is the rung's largest unknown.

**Never** cut the `(kind, content)` derivation soundness requirement or the
one-stored-relation/derived-views invariant. Busting the budget means rung 1 not
reaching a green algebra-and-relator test inside its week.

## Acceptance Criteria

Rung 1 — domain proof:

- [ ] `HohfeldPosition`, `LegalActContent`, the correlative and opposite
      derivations, `Party`, `LegalRole`, `LegalPositionRelator`, and
      `LegalScopeContext` land in `packages/law-practice/domain` in design order
      (schema first), with `LiteralKit` for every literal domain, the
      advantage-side canonicalisation, required act/omission polarity inside
      content, grounding events as a lineage reference, the asserting
      interpreter as a shared `Principal`, and the two-axis
      constitution × permission outcome present in the relator's event
      vocabulary. `result` is absent from the relator.
- [ ] EntityId registrations land in
      `packages/shared/domain/src/identity/LawPractice.ts`, following the
      candor-era stanza shape.
- [ ] The `LegalPositionRelatorPolicy` `Context.Service` contract lands in
      `packages/law-practice/use-cases` (tag in `*.ports.ts`), owning relator
      admission validation, the derived correlative and opposite views (never
      stored), and the scope-overlap-and-opposition check that answers only two
      set-theoretic facts and emits typed candidate *inputs*. No epistemic type
      appears in its signature or requirement channel. The opposition half
      composes **both** derivations: two relators are prima facie opposed iff
      the opposite view of one equals the correlative view of the other on
      bearer, counterparty, kind, and content. It is never a comparison of
      stored `positionKind`s — under the advantage-side canonicalisation every
      advantage-side kind's opposite is burden-side, so a stored-vs-stored
      opposition check is vacuously false. The composite view stays unexposed;
      correlative and opposite alone suffice.
- [ ] `LegalPositionRelatorPolicy.test.ts` — written failing first, then
      green — proves: both derivations by exhaustion over all eight positions
      (totality, involutivity, commutation, and exactly the two four-element
      orbits `{claim, duty, privilege, noRight}` and
      `{power, liability, immunity, disability}`); that a derivation moving kind
      without content, or content without kind, is rejected; relator admission
      rejecting each required field's absence one at a time; one stored
      advantage-side relation deriving both views with no second persisted fact;
      Hohfeld's privilege(enter)/duty(enter) coexistence — built as a stored
      `privilege(X→Y, enter+)` plus a stored `claim(Y→X, enter+)` whose derived
      correlative view is X's `duty(enter+)`, since `duty` is never a stored
      `positionKind` — yielding **no** candidate input, because
      `opposite(privilege, enter+) = (duty, enter−)` and the two share content
      polarity; and a genuine opposite pair — stored `privilege(X→Y, enter+)`
      against stored `claim(Y→X, enter−)`, whose correlative view is X's
      `duty(enter−)` — whose `LegalScopeContext` values overlap on all five
      axes, yielding one. The last two assertions are what breaker step 1
      deletes.
- [ ] The test runs slice-isolated: in-memory/test-only layers, no other slice
      booted, no app runtime `Layer`, no dependency added to the package
      (precedent: `packages/law-practice/use-cases/test/CandorPolicy.test.ts`).

Rung 2 — transitions, correction contract, durability:

- [ ] `PowerExercise`/`ActFrame` transition events land with the FLINT
      `creates`/`terminates` frame shape, a `derivationKind` **set** over
      create/alter/extinguish (never a three-way enum — Hohfeld admits
      simultaneous create-and-extinguish), preconditions able to express
      **negative operative facts**, a **required** `result`, attempted and
      ineffective acts on record, and the two independent recorded axes with
      both determinations bound to an attributed interpreter.
- [ ] `CorrectionDelta` lands in the full decision-8 shape, with the contract
      vocabulary fixed at exactly two severities (hard/advisory) and never
      adopting the three-member `ShaclSeverity` model. Whether the
      implementation internally narrows the live `ShaclSeverity` machinery to
      *produce* that field is latitude; shipping executable shapes is not.
- [ ] `PriorityBasis` lands as typed *input* structure accompanying law-side
      candidate records (party, forum, jurisdiction, proof standard, position
      tuple, time, authority, viewpoint, source precedence, specificity — the
      last two being why priority is uncomputable), with the four legal verdict
      families as law-practice vocabulary on law-side records only.
- [ ] Durable append-and-read-only storage on the in-slice precedent
      (`packages/law-practice/use-cases/src/CandorRecord/CandorRecord.ports.ts`
      — a `LiteralKit` operation vocabulary with no update and no delete member,
      shape at `:190`, service at `:282`; drizzle repo/layer in
      `packages/law-practice/server/src/CandorRecord/`), itself following the
      originating `ExecutionLedger` ports.
- [ ] A **second** law-practice db-admin migration with its PGlite migration
      test, both registered in `AcceptedProofManifest`, installing
      `BEFORE UPDATE OR DELETE` and `BEFORE TRUNCATE` append-only guards per
      table and asserting both an UPDATE and a DELETE are rejected — each
      denial in its own `layer(...)` block, because each aborts its transaction
      (precedent: `LawPracticeCandorGateMigration.pglite.test.ts:208`, `:226`).
- [ ] Acceptance fixtures: UFO-L's power-subjection competency-question table
      plus the **in-scope** subset of FLINT's 22 competency queries, with
      out-of-scope CQs (immunity–disability, liberty–no-right, omissions, duty
      violations) excluded by FLINT's own README and the ported CQs attributed
      to TNO under Apache-2.0.
- [ ] The rung-2 candidate handoff is either implemented through the P0-chosen
      lawful shape, or explicitly deferred with its standing evidence recorded
      here — never claimed without proof, and never through a new
      `law-practice/*` → `epistemic/*` package edge.

Gated criteria (activate when the owning goal lands; never block this goal):

- [ ] GATED on `goals/epistemic-contradiction-triage` reaching verified state
      (P2 Verify is in-progress and its acceptance criteria are unchecked):
      re-confirm the submitted candidate shape against the verified contract.
- [ ] GATED on `goals/semantic-foundation`: if a typed act-verb scheme ever
      materializes, `LegalActContent`'s plain-text act description composes that
      goal's scheme loading through its own gates — never a new registry here.
- [ ] GATED on `goals/agentic-professional-runtime`: when a decision vocabulary
      richer than the single-member `pending` placeholder lands, revisit whether
      a recorded exercise can be routed through it. Until then
      `RuntimeApprovalGate` is named unconsumable and is neither widened nor
      consumed.
- [ ] GATED on the queued `legal-rule-time-identity` wedge: when versioned
      norm/rule identity lands, bind `sourceNorm`'s opaque reference to it.

Always binding (both rungs):

- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/legal-position-relator-runtime/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/legal-position-relator-runtime/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/legal-position-relator-runtime` | Passes |
| Rung-1 proof | `LegalPositionRelatorPolicy.test.ts` green in the law-practice use-cases test lane | Passes (after first failing) |
| Domain tier stays epistemic-free | `rg -n "@beep/epistemic" packages/law-practice/domain` | Zero hits |
| No new cross-slice edge | `git diff origin/main -- packages/law-practice/*/package.json` | No added `@beep/epistemic-*` dependency |
| Rung-2 migration proof | PGlite migration test + `AcceptedProofManifest` entries | Passes |
| Repo quality gate | `bun run beep yeet verify` / publish path | Green |
| Reflections | `bun run beep lint reflection-artifacts` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope — in particular anything drifting
  toward a Non-Goal: computed legal judgment (including a proxy for legal
  comparability), a stored correlative or opposite view, a kind-only or
  polarity-only opposite derivation, widened epistemic or agents vocabulary, a
  new cross-slice package edge, or an executable validation shape.
- The lawful cross-slice handoff shape cannot be satisfied without violating
  `standards/ARCHITECTURE.md` or the ratified port-inversion admission
  conditions — stop and surface the conflict rather than adding a forbidden
  import.
- Pressure appears to amend `goals/epistemic-contradiction-triage`'s SPEC, to
  add detection heuristics, or to teach the generic engine legal verdict
  families — stop and re-scope.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | This goal creates no package and exercises no exception. If P0 picks a rung-2 handoff shape that requires one — a `foundation/capability` port package, or extending the spike SPEC's bounded epistemic exception past its gate/projection scope — the entry is written here with owner sign-off **before** any code is written. | N/A |
