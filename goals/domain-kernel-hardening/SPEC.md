# Domain Kernel Hardening Spec

## Objective

The shared-kernel persisted-entity base carries soft-delete and is the single
canonical audit base, with the typed-error convention in place for the rest of the
domain-layer hardening:

1. `BaseEntity` gains `deletedAt` and `deletedByPrincipal` (rich `Principal`
   actor, not `String`), modeled with normal Effect Schema optional/nullish codecs
   (e.g. `S.OptionFromNullOr`) and an `EntitySchema.persist.*` descriptor; SQL row
   absence encodes as `null`. (These are fields on the already-shared `BaseEntity`
   export, not a new shared export — no new promotion record is required.)
2. `@beep/schema/DomainModel` is retired (or reduced to a deprecated alias with a
   migration note), so there is one audit base, not two. `rowVersion` already
   covers `DomainModel.version` — no second version field is introduced.
3. A `.errors.ts` convention exists, demonstrated by extracting/keeping at least
   the kernel's own tagged error in the canonical `TaggedErrorClass` shape with a
   smart constructor + error union (the epistemic `ClaimInvalidTransition` pattern).

The `TemporalValidity` and `DomainEvent` value objects are deliberately **out of
this packet** (review finding): a shared-kernel export needs >=2 *current*
consumers per `02-shared-kernel.md`, and these have zero. They are introduced by
the first packet that actually consumes them (see the exploration MAP).

## Non-Goals

(from the exploration BRIEF no-gos)

- No slice-entity migration: do not replace `*FixtureKey` strings, type any
  `snapshot: UnknownRecord`, or grow placeholder vocabularies here.
- No new shared value objects in this packet — `TemporalValidity`/`DomainEvent`/
  attestation are introduced by the later packets that consume them (promotion rule:
  >=2 current consumers), not pre-built here as zero-consumer scaffolding.
- No base-wide temporal/event/crypto **columns** — those remain opt-in VOs applied
  where the domain needs them, by later packets.
- No new entity base, id scheme, tagged-union builder, or value-object library —
  reuse the canonical catalog.
- No raw `Data.TaggedError`, no optional-bag modeling of finite cases, no hand-mapped
  drizzle tables.
- No bitemporal/soft-delete **enforcement** (repository filtering, cascade) — model
  the fields now; enforcement is later (roadmap P4).

## Source Hierarchy

1. User objective: graduate the first slice of `domain-layer-hardening`.
2. `AGENTS.md`, `CLAUDE.md`, required skills (`schema-first-development`,
   `effect-first-development`).
3. `standards/ARCHITECTURE.md` + `standards/architecture/{02-shared-kernel,
   04-rich-domain-model,09-errors-across-boundaries}.md`.
4. This `SPEC.md`. 5. `PLAN.md`. 6. `GOAL.md`. 7. `research/`, exploration synthesis.

## Target Surfaces

- `packages/shared/domain/src/entity/BaseEntity.ts` (soft-delete fields + persisted).
- `packages/foundation/modeling/schema/src/DomainModel.ts` (retire/deprecate).
- Tests + docgen examples for any new/changed exported behavior.

## Constraints

(rabbit holes from the BRIEF, as boundary rules)

- Soft-delete is a field pair only; no repository/read-model filtering in this packet.
- Promotion records gate only *new shared exports* with >=2 current consumers
  (`02-shared-kernel.md:189`); adding fields to the already-shared `BaseEntity` does
  not create a new export, so this packet needs none. (Do not add a promotion record
  for a zero-consumer export — that is what excludes the VOs from this packet.)
- Domain stays driver-free (no `Sql`/`HttpClient`/`FileSystem`/`Config` in `R`).
- Keep the soft-delete shape consistent with exploration decisions G1
  (bitemporal/supersession) and G2 (lineage source) so the later VO packets compose.

## Acceptance Criteria

- [ ] `BaseEntity.fields`/`persisted` include `deletedAt` + `deletedByPrincipal`
      (Principal-typed, nullable→`null`), with passing decode/encode tests.
- [ ] `@beep/schema/DomainModel` is retired or deprecated-aliased; no product entity
      references it; the change is documented.
- [ ] The `.errors.ts` convention is demonstrated in the kernel.
- [ ] `bun run check`, `bun run test`, `bun run docgen`, `bun run lint` pass for the
      touched packages; schema-first + schema-topology lint stay green.
- [ ] No unrelated refactors or formatting churn; no slice-entity edits.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/domain-kernel-hardening/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/domain-kernel-hardening/ops/manifest.json` | Passes |
| Kernel package checks | `bunx turbo run check test docgen lint --filter=@beep/shared-domain --filter=@beep/schema` | Green |
| Whitespace | `git diff --check -- goals/domain-kernel-hardening` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed the kernel scope (slice-entity edits).
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named here.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
