# Domain Kernel Hardening Spec

## Objective

The shared-kernel persisted-entity base carries soft-delete and is the single
canonical audit base, with the typed-error convention in place for the rest of the
domain-layer hardening:

1. `EntityKit.auditColumns` gains nullable `deletedAt` and
   `deletedByPrincipal` (rich `Principal` actor), inherited by Audit, Org and
   Product tiers. Effect-drizzle metadata persists epoch milliseconds as bigint
   and the actor as jsonb; SQL absence encodes as `null` and decodes to `Option`.
   Base remains timestamps plus row version. Amend the existing ProductEntity
   promotion record; introduce no new audit base.
2. `@beep/schema/DomainModel` is already retired by #720 (`1e9d946750`), recorded
   in `.changeset/housekeeping-entity-stack.md`. Evidence satisfies this criterion;
   no schema-package edit or second version field is needed.
3. Extract the existing invariant into `entity/EntityRef.errors.ts` as direct
   `S.TaggedError`, preserving its tag, fields and opaque `actualId` equivalence.
   Add a static smart constructor and `EntityRefError` union; re-export both
   through the existing EntityRef surface.

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

- `packages/shared/domain/src/entity/EntityKit.ts` `auditColumns`: the two
  soft-delete fields, an additive public API change inherited by audited kits.
- `packages/shared/domain/src/entity/ProductEntity.ts`: inherited fields and docs.
- `packages/shared/domain/src/entity/EntityRef.errors.ts`: new public exports
  `EntityRefInvariantError` and `EntityRefError`; `EntityRef.ts` imports/re-exports.
- `packages/shared/domain/test/**` and the existing ProductEntity promotion record
  in `packages/shared/domain/README.md`.
- `packages/_internal/db-admin/drizzle/<timestamp>_audit_soft_delete/`: generated,
  additive nullable migration with no backfill, drops or renames.
- `apps/professional-desktop/src/runtime/Migrations.gen.ts`: owner-command resync.
- `packages/tooling/tool/cli/src/commands/Architecture/internal/AcceptedProofManifest.ts`:
  accepted proof entry only if required by the migration proof.
- `.changeset/<name>.md`: changed versioned packages; major if consumer edits break
  compatibility, otherwise patch.

## Constraints

(rabbit holes from the BRIEF, as boundary rules)

- Soft-delete is a field pair only; no repository/read-model filtering in this packet.
- Promotion records gate only *new shared exports* with >=2 current consumers
  (`02-shared-kernel.md:189`); adding fields to the already-shared `ProductEntity` does
  not create a new export, so this packet needs none. (Do not add a promotion record
  for a zero-consumer export — that is what excludes the VOs from this packet.)
- Domain stays driver-free (no `Sql`/`HttpClient`/`FileSystem`/`Config` in `R`).
- Keep the soft-delete shape consistent with exploration decisions G1
  (bitemporal/supersession) and G2 (lineage source) so the later VO packets compose.

## Acceptance Criteria

- [ ] `EntityKit.auditColumns`, `ProductEntity.fields` and every audited kit include
      `deletedAt` + `deletedByPrincipal` (Principal-typed, nullable→`null`), with
      null/populated decode, encode and schema-derived property tests.
- [x] `@beep/schema/DomainModel` is retired by #720 and its changeset; no product
      entity references it.
- [ ] The `.errors.ts` convention is demonstrated in the kernel and the existing
      TaggedError equivalence regression stays green.
- [ ] The generated migration contains only `ADD COLUMN` for the two nullable
      soft-delete columns, and `migrations:check` plus desktop `codegen:check` pass.
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

## Decision Log

| Date | Decision | Reason | Reversal |
| --- | --- | --- | --- |
| 2026-10-09 | D1: Map historical BaseEntity fields/persisted to EntityKit.auditColumns flowing through the audited kits and ProductEntity.fields; EntitySchema.persist maps to effect-drizzle metadata; TaggedErrorClass maps to direct S.TaggedError. | #720 replaced the packet's original API; live source is authoritative. | Revert this reconciliation if restoring the historical stack. |
| 2026-10-09 | D2: Criterion 2 is already met by #720, commit 1e9d946750, and housekeeping-entity-stack.md. | DomainModel is deleted; no product reference or second audit base remains. | Restore the deleted model only through a separately scoped contract change. |
| 2026-10-09 | D3: Extend auditColumns, inherited by Audit, Org and Product; keep Base timestamps/version only. | One canonical audit pack, no new entity base or promotion record; amend the ProductEntity record. | Revert the new columns and promotion-record amendment. |
| 2026-10-09 | D4: Choose GeneratedByApp(OptionFromNullOr(codec)) with constructor default succeedNone and missing-key decoding default null. Timestamp uses epoch-millis bigint, principal jsonb. No paired-nullness CHECK. | Constructor omissions remain accepted and JSON writes omit audit fields; a CHECK would exceed the columns-only migration contract. Measured: 32 fixture diagnostics in 8 test files, 4 explicit converter projections; no model or behavior edits. FieldOption adds a production fixture failure and exposes JSON writes. | Revert the field additions; reassess encoding before migration generation. |
| 2026-10-09 | D5: Generate an additive nullable migration without backfill and resync the desktop bundle through codegen. | All audited tables inherit new columns; existing rows read null. The baseline records zero users; no live database is touched here. | Revert the PR and generate a drop-columns migration; preserve any later data before rollback. |
| 2026-10-09 | D6: EntityRef.errors uses the entity/EntityRef.errors identity composer; import and re-export via EntityRef.ts. Preserve the tag, fields and actualId equivalence. | Existing public path and wildcard exports reach the module; no new exports-map subpath is necessary. | Move the class back and remove the new error union and re-exports. |
| 2026-10-09 | D7: SPEC explicitly requires auditColumns soft-delete fields, EntityRef.errors exports, additive nullable drizzle migration and generated Migrations.gen.ts. Amend the GOAL stop line to name them. | These exact surfaces satisfy the stop line's SPEC exception. Under AGENTS autonomy only money escalates; other calls are recorded here. Auth, infra, security, dependencies, lockfiles, other generated/public APIs and non-additive migrations still stop this lane. | Revert GOAL and SPEC contract edits. |
| 2026-10-09 | D8: Author research/SOURCES.md and register researchReports in place (R3). | The adopt plan had one report row; after authoring it has none and conflicts is empty. Unknown manifest keys are preserved. | Remove SOURCES.md and researchReports; the report row returns and doctor still supports the packet. |
