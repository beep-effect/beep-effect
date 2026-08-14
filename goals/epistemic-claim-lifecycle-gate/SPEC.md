# Epistemic Claim Lifecycle Gate Spec

_Date: 2026-06-17._

## Objective

The epistemic slice becomes a reusable, product-agnostic boundary, graduated
from domain-only to minimum-viable (domain + use-cases + server), observably:

1. `ClaimLifecycle` is a four-state Effect-Schema tagged/literal union
   `candidate -> shape_valid -> consistency_checked -> admitted` with transition
   value objects and typed errors, extending `@beep/epistemic-domain`.
2. `Evidence` carries the ported v3 `EvidenceSpan` char-offset primitive
   (`text`/`quote`, `startChar`, `endChar`, `confidence`) in addition to its
   existing fixture-key refs.
3. A `ClaimGate` `Context.Service` admits or rejects a `CandidateClaim` by
   running the bounded SHACL adapter and returns a typed verdict that drives a
   lifecycle transition.
4. A `ClaimProjection` pure function folds a single-owner authority array into a
   deterministic in-memory read model; it cannot write.

Provenance: decomposed in `explorations/atlas-synthesis/MAP.md` (Packet A,
sections 1.1-1.4). It is built **before** `law-practice-office-action-spike`,
which composes this slice only via its public surface.

## Non-Goals

- No IP-law vocabulary (OfficeAction / Claim / Rejection / PriorArt /
  Distinction). Those are owned by `law-practice-office-action-spike`.
- No IR -> law-entity mapping, no loop wiring, no fixture ingestion — that is
  the law-practice packet.
- No FalkorDB / persistent projection store. The projection is in-memory and
  rebuildable from authority.
- No v3 GraphRAG / extraction-pipeline port. Port **only** the `EvidenceSpan`
  char-offset primitive. langextract owns extraction in the law packet.
- No richer SHACL than the bounded adapter subset
  (targetClass / minCount / maxCount / datatype). If the claim shape needs more,
  widen to the bounded subset or flag it — do not extend the engine here.
- No cross-matter / firm projection write path. Federation is modeled as a
  read-only permissioned projection; enforcement is deferred (the model is not).
- No richer reasoner for `consistency_checked` -> `admitted` beyond a typed
  transition seam; deep consistency reasoning is out of rung-0 scope.

## Source Hierarchy

1. User objective and the rung-0 office-action-review decomposition
   (`explorations/atlas-synthesis/MAP.md`, Packet A).
2. `AGENTS.md`, `CLAUDE.md`, and required skills
   (`schema-first-development`, `effect-services`, `effect-first-development`).
3. Governing standards: `standards/ARCHITECTURE.md` (minimum-viable slice =
   domain + use-cases + server; no direct slice-to-slice imports; compose only
   via public surface / shared kernel).
4. Product authority: `goals/agentic-professional-runtime/SPEC.md` (claim +
   evidence + provenance + lifecycle is the authoritative memory; read models
   are projections).
5. This `SPEC.md`.
6. `PLAN.md`.
7. `GOAL.md`.
8. Supporting `research/`, `ops/`, and `history/` files.

Referenced, never merged: `goals/ip-law-knowledge-graph`,
`goals/oppold-corpus-pipeline`.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

Exact packages and role-files (role-suffix order:
`.model.ts`/`.errors.ts` -> `.ports.ts`/`.service.ts` -> `.repo.ts`):

| Surface | Path | Role | HAVE / NET-NEW |
| --- | --- | --- | --- |
| `ClaimLifecycle` four-state union + transitions + errors | `packages/epistemic/domain/src/values/ClaimLifecycle/ClaimLifecycle.model.ts` (+ `ClaimLifecycle.errors.ts`) | `.model.ts` / `.errors.ts` | EDIT file, NET-NEW states |
| `Evidence` char-offset fields | `packages/epistemic/domain/src/entities/Evidence/Evidence.model.ts` | `.model.ts` | EDIT file, NET-NEW fields |
| `CandidateClaim` (consumes extended lifecycle) | `packages/epistemic/domain/src/entities/CandidateClaim/CandidateClaim.model.ts` | `.model.ts` | HAVE (flows through) |
| Gate result + projection view schemas | `packages/epistemic/domain/src/values/ClaimGate/*.model.ts`, `.../values/ClaimProjection/*.model.ts` | `.model.ts` | NET-NEW |
| `ClaimGate` contract | `packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts` (+ `.ports.ts`) | `.service.ts` / `.ports.ts` | NET-NEW (new tier `@beep/epistemic-use-cases`) |
| `ClaimLifecycle` transition service | `packages/epistemic/use-cases/src/ClaimLifecycle/ClaimLifecycle.service.ts` | `.service.ts` | NET-NEW |
| `ClaimProjection` pure fn | `packages/epistemic/use-cases/src/ClaimProjection/ClaimProjection.ts` | post-contract helper | NET-NEW |
| Slice composition / Layer surface | `packages/epistemic/server/src/...` | server tier | NET-NEW (thin) |
| Bounded SHACL engine | `@beep/semantic-web/services/shacl-validation` (`ShaclValidationService`, `ShaclValidationResult`, `ShaclValidationViolation`) | engine brick | HAVE |
| Provenance vocabulary | `@beep/rdf/Vocab/Prov` (the `@beep/semantic-web/services/provenance` projection service was retired unconsumed, 2026-08) | PROV-O | HAVE |
| Evidence selector reference | `@beep/rdf/Evidence` (`EvidenceAnchor`, `TextPositionSelector`, `TextQuoteSelector`) | offset shape reference | HAVE |

The `use-cases` and `server` tiers are **new tiers inside the existing
epistemic slice**, not new slices and not `knowledge-law/*` packages. Follow the
slice-tier naming the `architecture-lab` reference slice already demonstrates.

## Constraints

- BINDING SEQUENCING: P0 schema/data-model -> P1 `Context.Service` contract
  (ports + interfaces, typed, no impl) -> P2 implementation -> P3 verify.
  Helpers are extracted **after** schema + contract are fixed, never before.
  Starting with loose helpers and composing them into a service at the end is a
  forbidden anti-pattern.
- Schema-first: states, transitions, gate verdict, and projection view are
  Effect-Schema (`LiteralKit` / tagged unions / `Model.Class`), with `$I`
  identity annotations; no exported `interface`/`type` data models.
- `ClaimGate` is a thin composition over the HAVE `ShaclValidationService`, not
  a re-implementation. It maps `CandidateClaim` + `Evidence` into a SHACL
  dataset expressible within the bounded subset, runs the engine, returns a
  typed admitted/rejected verdict + violations.
- FEDERATION INVARIANT (type-level): authority is single-owner/local; the
  projection signature takes a local authority array and returns a view — it has
  no write capability. Any cross-matter/firm view is a permissioned projection,
  never a central write.
- Domain imports only foundation primitives/modeling; live composition stays in
  `server`. No God Layers. No direct slice-to-slice imports.
- `Evidence` char-offsets reuse the `@beep/semantic-web/evidence`
  `TextPositionSelector`/`TextQuoteSelector` shape as the reference; the offsets
  become epistemic A-Box entity fields (not RDF selectors).
- Tests boot only epistemic Layers + shared test-kit. Acceptance gates on **no
  NEW** `@beep/schema` Bun-runtime failures, not full green.

## Acceptance Criteria

Each criterion gates the next phase; later phases cannot pass before earlier
ones (see Verification Matrix).

- [ ] **P0 schema** — `ClaimLifecycle` is the four-state union
      `candidate -> shape_valid -> consistency_checked -> admitted` with
      transition value objects and typed errors; `Evidence` carries
      `startChar`/`endChar`/`quote`/`confidence`; `ClaimGateResult` and
      `ClaimProjectionView` schemas exist. `bun run check --filter
      @beep/epistemic-domain` passes with no new failures. No service code yet.
- [ ] **P1 service contract** — `ClaimGate`, `ClaimLifecycle` transition, and
      `ClaimProjection` exist as typed `Context.Service` ports/interfaces
      (`ClaimGate` declares its `ShaclValidationService` dependency;
      `ClaimProjection` signature is
      `(authority: ReadonlyArray<CandidateClaim>) => ClaimProjectionView`).
      Type-checks with **no implementation bodies** and no extracted helpers.
- [ ] **P2 implementation** — gate implemented over the bounded SHACL adapter;
      lifecycle transitions implemented (`candidate -> shape_valid` on pass;
      rejected verdict blocks advance); projection implemented as a pure
      in-memory fold. The federation invariant holds: projection is read-only
      and rebuildable.
- [ ] **P3 verify** — unit proof in the epistemic slice (no IP-law data):
      (a) a well-formed `CandidateClaim` + `Evidence(char-span)` is **admitted**
      and lifecycle advances `candidate -> shape_valid`;
      (b) a SHACL-violating claim is **rejected** with a
      `ShaclValidationViolation` and lifecycle does **not** advance;
      (c) `ClaimProjection(authority[])` is deterministic and referentially
      equal on rebuild from the same authority (pure-function proof);
      (d) slice tests boot only epistemic Layers. Bun test green; no new
      `@beep/schema` Bun-runtime failures.
- [ ] No unrelated refactors or formatting churn.
- [ ] A closeout reflection exists under `history/reflections/`.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/epistemic-claim-lifecycle-gate/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/epistemic-claim-lifecycle-gate/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/epistemic-claim-lifecycle-gate` | Passes |
| P0 gates P1 | `bun run check --filter @beep/epistemic-domain` | Green, no new failures (schema lands before contract) |
| P1 gates P2 | `tsc --noEmit -p packages/epistemic/use-cases/tsconfig.json` | Type-checks; ports only, no impl bodies |
| P2 gates P3 | `bun test packages/epistemic/use-cases` | Gate/lifecycle/projection impl present |
| Acceptance proof | `bun test packages/epistemic` (lifecycle + gate + projection cases) | Green; no NEW `@beep/schema` Bun failures |
| Reflection present | `bun run beep lint reflection-artifacts` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope (e.g. IP-law vocabulary leaking
  into the epistemic slice).
- The bounded SHACL subset cannot express the claim shape — surface with
  evidence (widen the shape to the subset or note the engine as a follow-on); do
  not extend the engine.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Decision Log

Seeded from `explorations/atlas-synthesis/MAP.md` (Packet A) and the locked
decisions (2026-06-17):

- Two slice-owned goal packets; **no** new `knowledge-law/*` packages. Epistemic
  owns lifecycle + gate-mechanism + projection + the evidence primitive;
  law-practice owns the IP-law language + IR -> law mapping.
- `ClaimLifecycle` extends from candidate-only (`LiteralKit(["candidate"])`,
  verified on disk) to the four-state machine.
- Port **only** the v3 `EvidenceSpan` `{text,startChar,endChar,confidence}`
  primitive onto `Evidence`; reuse `@beep/semantic-web/evidence` selectors as
  shape reference, not as the field set.
- `ClaimGate` is composition over the HAVE bounded `ShaclValidationService`, not
  a new SHACL engine.
- Projection is a pure in-memory function rebuilt from a single-owner authority
  (federation invariant baked in at the type level).
- DEFERRED: FalkorDB store, the v3 GraphRAG/extraction-pipeline port, a real
  GraphRAG ask, the 7-source IP-law ontology grounding, matter-wall
  *enforcement* (model now, enforce later).
- Built FIRST; `law-practice-office-action-spike` composes this via its public
  surface only.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
