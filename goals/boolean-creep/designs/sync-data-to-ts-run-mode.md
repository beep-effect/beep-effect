# sync-data-to-ts-run-mode

This is the per-instance GATE 2 review surface. It uses the shared literal schemas and CLI-boundary resolvers specified in [family-cli-mode-flags.md](./family-cli-mode-flags.md); the instance-specific contract follows in full.


### 1. Instance

- id: `sync-data-to-ts-run-mode`
- file: `packages/tooling/tool/cli/src/commands/SyncDataToTs/SyncDataToTs.command.ts:40`
- symbol: `sync-data-to-ts mode flags`
- members: `check`, `dryRun`
- evidence: E2 at `packages/tooling/tool/cli/src/commands/SyncDataToTs/SyncDataToTs.command.ts:72-83` — `resolveRunMode` rejects the combined flags and otherwise selects check, dry-run, or write through the shared RunMode reader; combined-true is never a mode. The conflict error is supporting evidence, not E3.

### 2. Current shape

```ts
const checkFlag = Flag.boolean("check").pipe(
  Flag.withDescription("Report drift without writing files and exit non-zero when changes are needed")
);
const dryRunFlag = Flag.boolean("dry-run").pipe(Flag.withDescription("Preview file updates without writing them"));
```

### 3. Cardinality gap

Four pairs are representable. Legal modes are `write` (neither flag), `check`, and `dry-run`; combined flags are illegal.

### 4. Target schema

Reuse `SyncDataRunMode`, already an alias of the shared `RunMode` LiteralKit schema at `SyncDataToTs.schemas.ts:82-99`. Keep the two parser flags, but resolve them with:

```ts
const mode: SyncDataRunMode = yield* resolveExclusiveRunModeFromFlags(
  [check, "check"],
  [dryRun, "dry-run"],
  "write",
  Effect.fail(runModeFlagConflictError())
)
```

Pass `mode` directly to the already literal-typed workflow; no new domain or stored state is needed.

### 5. Migration inventory

- `SyncDataToTs.command.ts:16` — replace local shared-helper aliases with `resolveExclusiveRunModeFromFlags`.
- `SyncDataToTs.command.ts:40-47` — retain CLI flags only at the parser boundary.
- `SyncDataToTs.command.ts:67-83` — delete local `resolveRunMode`; keep the error factory for adapter failure.
- `SyncDataToTs.command.ts:545-570` — collapse flags immediately, then all reads continue using the existing `mode` at lines 559-570.
- `SyncDataToTs.schemas.ts:82-99` — unchanged target schema owner.
- `sync-data-to-ts.test.ts:603,621` — valid `--dry-run` and `--check` command cases remain unchanged; add the combined conflict if absent.
- `cli-kits.test.ts:85-99,110-115` — update shared resolver/conflict coverage for the new exclusive helper.

### 6. Guard-deletion accounting

- `SyncDataToTs.command.ts:72-83` — delete the local conflict conditional and two-step resolution wrapper.
- `SyncDataToTs.command.ts:67-70` — retain only the typed error constructor; it is no longer paired with a local boolean guard.
- `RunMode.ts:176-199` — update comments that instruct every command to duplicate a gate before resolution.

### 7. Encoded-side impact

none (internal). Report JSON already receives the literal `mode`; its representation is unchanged.

### 8. Test impact

Update `packages/tooling/tool/cli/test/sync-data-to-ts.test.ts` only to add/retain conflict coverage and `packages/tooling/tool/cli/test/cli-kits.test.ts` for the shared adapter. Existing valid argv stays unchanged.

### 9. Risk & sequencing

This is the lowest-risk exemplar because application code already consumes `SyncDataRunMode`. Land after the shared helper and use it to validate the family pattern before broader migrations.
