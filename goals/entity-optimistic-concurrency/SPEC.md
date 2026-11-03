# Entity Optimistic Concurrency Spec

## Objective

Every write to a persisted entity row compares and increments `rowVersion`, so
two writers working from the same read cannot both succeed. The loser fails with
a typed version-conflict error instead of silently overwriting the winner.

Verified problem (2026-10-20): the Drizzle repositories update by id with no
version guard. `SyncItem.repo.ts` runs `.set(insert).where(eq(id))`;
`ProviderInstance.repo.ts` writes `rowVersion + 1` but never checks the stored
value. `ProviderInstanceUseCases.probe` reads a row, waits on a CLI probe, then
saves `{ ...current, lastProbe }`, which reverts a configuration `update` that
landed while the probe ran. `@beep/effect-drizzle`'s `makeRepository` already
compares and increments, but no product entity could use it:
`EntityKit.baseColumns.rowVersion` was an explicit `VariantField`, which
`Pg.version()` refuses.

## Design

### 1. Schema: the version token

`EntityKit` names the token once and marks it as the optimistic version:

```ts
export const RowVersion = PosInt.annotate({ identifier: $I`RowVersion`, ... })
export const nextRowVersion = (rowVersion: RowVersion): RowVersion => ...

baseColumns.rowVersion = RowVersion.pipe(Pg.integer(), Pg.default(1), Pg.version())
```

Variant contract of `rowVersion` on every Base/Audit/Org/Product entity:

| Variant | Before | After | Meaning |
| --- | --- | --- | --- |
| `select` | required | required | stored token |
| `insert` | absent | optional | omitted → `DEFAULT 1` |
| `update` | required | required | expected token, compared then incremented |
| `json` | required | required | clients read the token |
| `jsonCreate` | absent | absent | a client never picks the first version |
| `jsonUpdate` | absent | required | a client sends back the token it read |

`jsonCreate` stays absent because `@beep/effect-drizzle` now drops version
fields from that variant (pg and sqlite, runtime and types). Before this change
`version()` made the token required in JSON create payloads.

DDL: `row_version integer NOT NULL` becomes `row_version integer DEFAULT 1 NOT
NULL` on every entity table. One generated db-admin migration sets the default.
The desktop migration bundle is regenerated from it. A table outside the
db-admin migrations (`agents_provider_instance`) gets no default from this
migration, so its adapter keeps writing the first version explicitly.

### 2. Service contract: repository ports

The rules for every repository port whose rows carry `rowVersion`:

1. **Full-entity writes** (`update(entity)`, `save(entity)`): `entity.rowVersion`
   is the expected token. The write succeeds only when the stored token equals
   it. It stores `nextRowVersion(expected)` and returns the stored entity. When
   no row matches, the adapter looks the row up by id (and tenant scope where
   the port has one). If the row is missing it fails with the port's existing
   `NotFound`. If the row exists it fails with
   `<Port>VersionConflict { <entity>Id, expectedRowVersion, actualRowVersion }`.
2. **Read-modify-write methods** (`SyncConflict.markReviewed`, the update branch
   of `SyncCursor.upsert`): the token the method read is the expected token.
   An interleaved writer turns the second write into a `VersionConflict`.
3. **Predicate or single-column writes** (`SyncOperation.requeueLeased`,
   `ThreadStore.setTitleIfEmpty`, `WorkspaceVaultStore.setVaultRoot`,
   `EdgeAuthority` head close): these keep their own predicates and add
   `row_version = row_version + 1`. A token that some write leaves unchanged
   makes rule 1 unsound: a holder of a stale copy would still match. The one
   exemption is an UPDATE of a row the same transaction inserted
   (`ThreadStore.appendTurn` reconciling the new turn's items): no other
   writer can have read it, so insert plus reconciliation commit as version 1,
   matching the in-memory adapter.
4. **In-memory adapters** implement the same contract with one atomic
   `Ref.modify`, so use-case tests see production conflict behavior.

Version-conflict errors are per port, in the port module next to the existing
`NotFound`, following the slice-local typed-error convention. Their
version fields use the shared `RowVersion` schema:

| Port | New error |
| --- | --- |
| `SyncItemRepository.update` | `SyncItemRepositoryVersionConflict` |
| `SyncOperationRepository.update` | `SyncOperationRepositoryVersionConflict` |
| `SyncConflictRepository.markReviewed` | `SyncConflictRepositoryVersionConflict` |
| `SyncCursorRepository.upsert` | `SyncCursorRepositoryVersionConflict` |
| `ProviderInstanceRepository.save` | `ProviderInstanceVersionConflict` (also in the client-safe `ProviderActionError`) |

### 3. Implementation route

Keep the Drizzle query-builder repositories (route a). The guarded write is
`.set({ ...row, rowVersion: nextRowVersion(expected) })
.where(and(eq(t.id, id), eq(t.rowVersion, expected)[, eq(t.orgId, orgId)]))
.returning()`, run in the caller's Drizzle executor so it joins any open
transaction.

## Non-Goals

- Adopting `@beep/effect-drizzle` `makeRepository` for product entities (D2).
- Upstream `effect/sql/SqlModel` soft delete, or any new soft-delete command (D3).
- Client-carried expected versions on RPC commands such as
  `UpdateProviderInstanceCommand`. The repository guard covers the server-side
  read→write window. A client that edits from a stale form needs the command to
  carry `expectedRowVersion` (follow-up F1).
- `architecture-lab` `WorkItem`: a plain `S.Opaque` with no `rowVersion` column.
- `law-practice` candor and legal-position repositories: append-only, enforced
  by `BEFORE UPDATE OR DELETE` triggers. They issue no UPDATE.
- A `row_version > 0` CHECK constraint, `updatedAt` stamping on update, and
  tooling SQLite stores (not entity tables).

## Target Surfaces

- `packages/ecosystem/effect-drizzle/src/{pg,sqlite}/{model,combinators}.ts`.
- `packages/shared/domain/src/entity/EntityKit.ts`.
- `packages/_internal/db-admin/drizzle/` (new migration) and
  `apps/professional-desktop/src/runtime/Migrations.gen.ts`.
- Ports and adapters: `packages/documents/{use-cases,server}` (SyncItem,
  SyncOperation, SyncConflict, SyncCursor), `packages/agents/{use-cases,server}`
  (ProviderInstance), `packages/workspace/server` (ThreadStore,
  WorkspaceVault), `packages/epistemic/server` (EdgeAuthority).
- Tests pinning the old variant shape, and new stale-write tests.

## Constraints

- Effect v4 only; `Effect.fn` for generator functions; `HashMap`, not `Map`.
- One migration, generated by `drizzle-kit generate`; `migrations:check` stays
  clean. Never hand-edit the baseline.
- No change to an error union a caller already matches exhaustively without
  updating that caller.

## Acceptance Criteria

- [ ] `EntityKit.baseColumns.rowVersion` carries `Pg.version()` and
      `Pg.default(1)`; variant tests assert the table in Design §1.
- [ ] `@beep/effect-drizzle` version fields are absent from `jsonCreate`
      (pg and sqlite), with a unit test.
- [ ] The db-admin migration sets `DEFAULT 1` on every `row_version`;
      `bun run --cwd packages/_internal/db-admin migrations:check` passes.
- [ ] Every full-entity and read-modify-write path in Design §2 fails with its
      `VersionConflict` on a stale write, proven for both the in-memory and
      the Drizzle (PGlite) adapter.
- [ ] Every predicate or single-column write in Design §2.3 increments
      `rowVersion`, proven by a test.
- [ ] `bun run beep quality package-verify` passes for each touched package.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/entity-optimistic-concurrency/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/entity-optimistic-concurrency/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/entity-optimistic-concurrency` | Passes |
| Migration drift | `bun run --cwd packages/_internal/db-admin migrations:check` | No new folder |
| Stale writes | slice `vitest` suites named in `PLAN.md` | Green |
| Package handoff | `bun run beep quality package-verify <@beep/pkg>` per touched package | Green |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-11-02 | The tooling-store example no longer names the deleted `AgentMessage` store (`retired:agent-message-router` ([last tree](https://github.com/beep-effect/beep-effect/tree/6bb8584b6dbc9aee927a200901c9eebc0abd63b1/goals/agent-message-router))). | Reference hygiene after `goals/t3-native-orchestration` deleted the agent-message stack. | Restore the packet from git at the permalink and revert the retirement PR. |
| 2026-10-20 | D1: `rowVersion` becomes `RowVersion.pipe(Pg.integer(), Pg.default(1), Pg.version())`, with the variant table in Design §1. The DDL gains `DEFAULT 1` through one generated migration. | `version()` is the only metadata `makeRepository` and future tooling can find; `DEFAULT 1` makes the optional insert variant honest instead of relying on every adapter writing `1`. `ALTER COLUMN SET DEFAULT` is metadata-only and instant. | Restore the explicit `VariantField({ select, update, json })`; add a migration running `ALTER COLUMN "row_version" DROP DEFAULT` on the same tables. |
| 2026-10-20 | D1a: `@beep/effect-drizzle` drops version fields from `jsonCreate`. | A client creating a row cannot know its version. The previous `jsonCreate: select` forced a meaningless required token into create payloads and broke the entity variant contract. No production code reads `jsonCreate`. | Restore `jsonCreate: select` in both `effectiveSchema` and `PlainVariants` (pg, sqlite). |
| 2026-10-20 | D2: route (a). Keep Drizzle query-builder repositories and add the compare-and-increment guard. Do not adopt `makeRepository`. | Every EntityKit entity is refused by `makeRepository` today: it throws on any `columnName` override (`core/repository.ts`), and the kit pins `entityType` and `publicId` with `Pg.columnName(...)`. It runs through raw `SqlClient`, and no production layer sets the `snakeCase`/`camelCase` name transforms it needs (only effect-drizzle live tests do). It has no tenant (`orgId`) predicate. Transaction scope is not a blocker if both run on one transform-configured client: Drizzle's Effect sessions read through `withoutTransform`/`values`/`raw`, so the transforms do not reach Drizzle (verified by the SqlModel session, 2026-10-20). A second client would not share the scope. Route (a) is a two-predicate change at each site. | Revisit once the repository supports `columnName` overrides (or the kit drops the overrides, which equal `snakeCase` of the key), the shared production `PgClient` sets the name transforms, and the repository gains a tenant predicate; then swap adapters behind the same ports. effect-drizzle #1938 (`makeNativeRepository`, unmerged) covers models without `version()` only. |
| 2026-10-20 | D2a: version-conflict errors are per port (`<Port>VersionConflict`), with typed ids and shared `RowVersion` fields. There is no shared error class. | It follows the slice-local `NotFound`/`Unavailable` convention (domain-layer-hardening Q5) and keeps typed entity ids. A shared error would need an untyped `id`. The shared part, the token schema, lives in the kit that already owns `rowVersion`. | Collapse into one shared-domain error carrying `entityType` + numeric id if a fourth slice copies the shape. |
| 2026-10-20 | D2b: every UPDATE of an entity row increments `rowVersion`, including predicate-guarded and single-column writes, except an UPDATE of a row inserted earlier in the same transaction. | The guard is only sound if the token counts every committed write; one non-bumping writer lets a stale full-row write through. A row inserted and reconciled in one transaction is one committed write, and bumping it would make the Drizzle and in-memory ThreadStore disagree on a new turn's version. | Drop the `+ 1` from those sites (reintroduces the hole). |
| 2026-10-20 | D3: no upstream `SqlModel` `softDeleteColumn`. A future soft delete is an explicit port command: it sets `deletedAt` (epoch millis), `deletedByPrincipal`, `updatedAt`/`updatedByPrincipal`, and `nextRowVersion(expected)` under the D2 guard, and read paths filter `deleted_at IS NULL`. No soft-delete command is added here; `ProviderInstance.remove` stays a hard delete. | `softDeleteColumn` writes `CURRENT_TIMESTAMP` into the bigint-millis `deletedAt` and never sets `deletedByPrincipal`. No product path soft-deletes today, so a command now would have no consumer. | N/A until a soft-delete command lands; that packet records its own choice. |
| 2026-10-20 | D4: decided under the autonomy charter without a `/grill-with-docs` round. | The direction is fixed by the brief (route analysis and soft-delete constraint given); remaining choices are reversible and recorded here. The operator reviews asynchronously. | Run `/grill-with-docs` on this log; amend rows that do not survive. |
| 2026-10-23 | D5: delete the remediation branches `fix/ledger-1941-cache-input` (`fc19393671`) and `fix/ledger-1941-proof-manifest` (remote `f0592ad084`, local `3c4ed0576c`) after archiving each tip under `refs/archive/branches/<branch>/20261023-074114` in the beep-effect6 clone. | Operator ruling relayed by the S44 orchestrator. #1967 and #2040 landed the same fixes on main, #2040 with wider inputs, so neither branch had a PR or unique content worth keeping. | `git push origin refs/archive/branches/<branch>/20261023-074114:refs/heads/<branch>` from that clone. |
| 2026-10-23 | D6: close the packet as `completed-retained` while the merge-time completion receipt for #1941 reads `unsatisfied`. The `proposedCloseout` is replaced by a declared final PR. | #1941 merged over red required checks under S43, so its receipt can never verify. Both reds were fixed on main (#1967, #2040), and the operator ruled the closeout. | `bun run beep goals set-status entity-optimistic-concurrency active`, then restore `proposedCloseout`. |

## Follow-ups

- F1: carry `expectedRowVersion` on client update commands
  (`UpdateProviderInstanceCommand` first) so a stale UI form fails instead of
  being merged into a fresh read.
- F2: decide whether `ProviderInstance.remove` becomes a soft delete under D3.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
