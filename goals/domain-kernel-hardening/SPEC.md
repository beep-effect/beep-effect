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
   in the historical `.changeset/housekeeping-entity-stack.md` Git blob at that
   commit (the release baseline #1566 removed the working-tree note). Evidence
   satisfies this criterion;
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
- `packages/law-practice/server/src/PracticeKg.claims.ts` external physical-column
  marker and its exact parity assertion (run-4 ruling); no DDL or carry SQL edits.
- `.changeset/<name>.md`: published packages only under #1566; private workspace
  changes are recorded with compatibility impact and reversal in the handoff.

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

- [x] `EntityKit.auditColumns`, `ProductEntity.fields` and every audited kit include
      `deletedAt` + `deletedByPrincipal` (Principal-typed, nullable→`null`), with
      null/populated decode, encode and schema-derived property tests.
- [x] `@beep/schema/DomainModel` is retired by #720 and its changeset; no product
      entity references it.
- [x] The `.errors.ts` convention is demonstrated in the kernel and the existing
      TaggedError equivalence regression stays green.
- [x] The generated migration contains only `ADD COLUMN` for the two nullable
      soft-delete columns, and `migrations:check` plus desktop `codegen:check` pass.
- [x] `bun run check`, `bun run test`, `bun run docgen`, `bun run lint` pass for the
      touched packages; schema-first + schema-topology lint stay green.
- [x] No unrelated refactors or formatting churn; no slice-entity edits.

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
| External physical schema | Bundle-owned practice-kg candidate/evidence tables only | Practice-kg bundle owner | Run-4 ruling: shipped schemas stay outside db-admin and exclude the new nullable pair | Qualified bundle migration and carry upgrade with legacy load/serve proof |

## Decision Log

| Date | Decision | Reason | Reversal |
| --- | --- | --- | --- |
| 2026-10-09 | D1: Map historical BaseEntity fields/persisted to EntityKit.auditColumns flowing through the audited kits and ProductEntity.fields; EntitySchema.persist maps to effect-drizzle metadata; TaggedErrorClass maps to direct S.TaggedError. | #720 replaced the packet's original API; live source is authoritative. | Revert this reconciliation if restoring the historical stack. |
| 2026-10-09 | D2: Criterion 2 is already met by #720, commit 1e9d946750, and its historical housekeeping-entity-stack.md Git blob; #1566 removed the working-tree note. | DomainModel is deleted; no product reference or second audit base remains. | Restore the deleted model only through a separately scoped contract change. |
| 2026-10-09 | D3: Extend auditColumns, inherited by Audit, Org and Product; keep Base timestamps/version only. | One canonical audit pack, no new entity base or promotion record; amend the ProductEntity record. | Revert the new columns and promotion-record amendment. |
| 2026-10-09 | D4: Choose GeneratedByApp(OptionFromNullOr(codec)) with constructor default succeedNone and missing-key decoding default null. Timestamp uses epoch-millis bigint, principal jsonb. No paired-nullness CHECK. | Constructor omissions remain accepted and JSON writes omit audit fields; a CHECK would exceed the columns-only migration contract. Measured: 32 fixture diagnostics in 8 test files, 4 explicit converter projections; no model or behavior edits. FieldOption adds a production fixture failure and exposes JSON writes. | Revert the field additions; reassess encoding before migration generation. |
| 2026-10-09 | D5: Generate an additive nullable migration without backfill and resync the desktop bundle through codegen. | All audited tables inherit new columns; existing rows read null. The baseline records zero users; no live database is touched here. | Revert the PR and generate a drop-columns migration; preserve any later data before rollback. |
| 2026-10-09 | D6: EntityRef.errors uses the entity/EntityRef.errors identity composer; import and re-export via EntityRef.ts. Preserve the tag, fields and actualId equivalence. | Existing public path and wildcard exports reach the module; no new exports-map subpath is necessary. | Move the class back and remove the new error union and re-exports. |
| 2026-10-09 | D7: SPEC explicitly requires auditColumns soft-delete fields, EntityRef.errors exports, additive nullable drizzle migration and generated Migrations.gen.ts. Amend the GOAL stop line to name them. | These exact surfaces satisfy the stop line's SPEC exception. Under AGENTS autonomy only money escalates; other calls are recorded here. Auth, infra, security, dependencies, lockfiles, other generated/public APIs and non-additive migrations still stop this lane. | Revert GOAL and SPEC contract edits. |
| 2026-10-09 | D8: Author research/SOURCES.md and register researchReports in place (R3). | The adopt plan had one report row; after authoring it has none and conflicts is empty. Unknown manifest keys are preserved. | Remove SOURCES.md and researchReports; the report row returns and doctor still supports the packet. |
| 2026-10-09 | D9: Hold P1 before implementation because brief step 5.5 and current private-package release policy materially contradict. | Main #1566 forbids changesets naming live private workspaces; every expected target is private. The brief requires such notes and major bumps for forced outside-kernel edits. The manifest stop condition applies; changing privacy or the guard exceeds this lane. | Resume on a reconciled brief; remove the hold receipt without changing release policy. |
| 2026-10-09 | D10: Resume ruling lifts D9; #1566 manifest-aware release policy governs. Changesets name published packages only; forced private-workspace changes receive a handoff table instead. P1, P2 and P3 publish as separate bounded waves under the amended ruling. | Every measured target is private; preserving release policy avoids invalid notes. The latest orchestrator ruling supersedes the original two-wave plan. | Revert this amendment and implementation before publication; do not alter package privacy or release policy. |
| 2026-10-09 | D11: Register both generated audit-soft-delete migration files in AcceptedProofManifest, using the existing persistence inventory pattern. | Architecture operation plans enumerate every db-admin proof file, including generated SQL and snapshots. | Remove the two entries together with the generated migration and regenerate the desktop bundle. |
| 2026-10-09 | D12: Stop P1 after full qualification exceeds the brief's 40 mechanical converter/fixture-edit bound. Retain the implementation locally, without PR 2 publication or phase completion. | 37 sites already changed; 31 additional docgen fixture subjects and two column-map definitions require edits, conservative minimum 70. Compiler-only P0 missed these introduced breaks. | Resume only with a reconciled scope/encoding brief; alternatively revert the local implementation commit and regenerate the desktop bundle after migration removal. |
| 2026-10-09 | D13: Resume ruling raises the P1 mechanical bound to 90; final measured total is 71 sites: 37 retained, 31 authored docgen row subjects, two exact-column maps and one isolated PGlite table-fixture column definition. No slice model/behavior edits. | The 2026-10-09 run-3 ruling authorizes proportional migration-following repairs. Package docgen compiles authored JSDoc; no fixture-update owner command exists for these blocks. | Revert the mechanical repairs and kernel migration together; retain D12 as historical evidence. |
| 2026-10-09 | D14: Add the nullable column pair to the isolated ProviderInstance PGlite table fixture; final mechanical count is 71, below 90. | Four introduced integration failures share a hand-created table lacking both columns while the inherited Drizzle table now projects them. This is a mechanical fixture-column definition only; no repository or slice behavior changes. | Remove the two test DDL columns together with the kernel rollback. |
| 2026-10-09 | D15: Stop before editing production PracticeKg.claims.ts table DDL or carry projections; no P1 publication or phase completion. | The exact server gate has one introduced law-practice failure: bundle-owned candidate/evidence CREATE TABLE definitions lack both columns, while their current Drizzle declarations include them. Production KG DDL/carry surfaces are outside this lane's converter/test-fixture ownership. | Resume on an explicit scope reconciliation or an owner-landed fix on main, then rerun qualification; alternatively revert the kernel fields and generated migration/bundle. |
| 2026-10-09 | D16: Run-4 ruling declares bundle-backed claims/evidence tables external physical schemas. practiceKgClaimsPhysicalColumns explicitly excludes only deletedAt/deletedByPrincipal from their column contract; CREATE, insert, carry SQL and shipped bundle bytes remain unchanged. Repo-owned tables still receive the additive migration. | The shipped practice-kg bundle is independently versioned outside db-admin. Exact parity must compare its external contract, not the current repo migration schema; no slice model/behavior edit is needed. | Remove the external marker only with a separately qualified bundle migration and carry upgrade; retain legacy-bundle load/serve proof. |
| 2026-10-09 | D17: Reuse the existing absentAsNull fixture helper for the two new soft-delete insert fields in EpistemicTables.test.ts. | Inlining two additional nullish branches raised two existing UsageRecord test generators from CC 9 to 11 (estimated CRAP 37.1), failing Fallow audit and health. The existing helper preserves the same nullable row contract and brings both generators back below the limit; no new helper, assertion, behavior or slice edit. | Restore the inline nullable expressions only with the kernel rollback or an independently qualified fixture contract. |
| 2026-10-09 | D18: Stop publication after attributing the Effect-Vitest refusal; retain qualified P1 locally, lifecycle active, P2/P3 pending. | The authorized external-schema assertion changes the occurrence anchor of an existing scoped PGlite exception. Re-review and owner regeneration of standards/effect-vitest.inventory.jsonc are outside the allowed generated outputs. The inherited EV015 row matches main; the standing inherited-only fallback does not cover the own EV002 anchor. | Resume with explicit inventory ownership or an owner-landed reviewed inventory; alternatively revert D16 and the kernel expansion together. |
| 2026-10-09 | D19: Run-5 grants single-occurrence inventory re-anchoring, but stop because the owner CLI exposes only a full-scan refresh; inventory remains untouched. | `bun run beep lint effect-vitest --help` lists `--write` as "Refresh the full-scan detector baseline", with only census and rows alternatives. EffectVitestScan.ts constructs the complete discovered-source document before writing; no occurrence selector exists. The ruling explicitly forbids wider regeneration. For B (rsc-b-standards) to reconcile. | Resume after the inventory owner lands the reviewed re-anchor, or after an explicitly reconciled bounded owner command exists; retain D18 as history. |
| 2026-10-09 | D20: Run-6 authorizes the full owner refresh under a strict diff contract; execute it, then revert the generated inventory and stop because 22 changed occurrence identities belong to files outside this lane. D19 remains historical. | Owner refresh exits 0: 1,360 files, 1,860 findings versus 1,853 before; 29 changed identities (18 modified, 9 added, 2 removed). Seven authorized PracticeKg rows only move position with unchanged occurrences/statuses/reasons; 22 other identities fail the contract. For B (rsc-b-standards) to reconcile. | Resume after the inventory owner lands a reviewed refresh or the orchestrator explicitly reconciles the outside-scope rows; do not hand-edit the generated inventory. |
| 2026-10-09 | D21: Run-7 publishes PR 2 on a stale main Effect-Vitest inventory; the PracticeKg re-anchor lands with the owner refresh. Leave the inventory untouched and use the expressly authorized publication fallback. | Run-6 proved broad inherited inventory drift; the 23:05Z orchestrator ruling assigns reconciliation to B and the burn-down lane. Seven PracticeKg rows are enumerated in the handoff; the inherited ContradictionDetection EV015 source matches main. P2/P3 remain later waves. | The owner lands a reviewed full refresh; integrate main once and rerun the affected gate. No lane-authored waiver or inventory edit. |
