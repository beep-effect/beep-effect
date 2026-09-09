# tsconfig-sync-mode-flags

This is the per-instance GATE 2 review surface. It uses the shared literal schemas and CLI-boundary resolvers specified in [family-cli-mode-flags.md](./family-cli-mode-flags.md); the instance-specific contract follows in full.


### 1. Instance

- id: `tsconfig-sync-mode-flags`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file: `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.schemas.ts:425`
- symbol: `TsconfigSyncModeFlags`
- members: `check`, `dryRun`, `write`
- evidence: E2 at `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.command.ts:21` — `resolveMode` first-Somes `isCheckModeFlags`, `isDryRunModeFlags`, and `isWriteModeFlags`; combined-true is never a distinct mode and collapses to check, then dry-run, then sync.

### 2. Current shape

```ts
export type TsconfigSyncModeFlags = readonly [check: boolean, dryRun: boolean, write: boolean];
```

### 3. Cardinality gap

All eight CLI tuples are accepted inputs. They resolve to three semantic modes:
`check`, `dry-run`, and `sync`. Explicit `--write` and no mode flag both mean
`sync`; combined inputs collapse by current precedence. Do not describe the
five combined tuples as illegal or newly reject them.

### 4. Target schema

Reuse `TsconfigSyncMode` and its existing `TsconfigSyncModeKit` at `TsconfigSync.schemas.ts:334-391`. Delete the tuple type and all tuple predicates. The command adapter becomes:

```ts
const mode: TsconfigSyncMode = resolveRunMode(
  [
    [check, "check"],
    [dryRun, "dry-run"],
    [write, "sync"],
  ],
  "sync"
)
```

It then constructs the already schema-backed `TsconfigSyncRunOptions` union at `TsconfigSync.schemas.ts:479-540`; no new domain is introduced.

### 5. Migration inventory

- `TsconfigSync.schemas.ts:412-425` — delete `TsconfigSyncModeFlags` and its JSDoc.
- `TsconfigSync.schemas.ts:427-477` — delete `isCheckModeFlags`, `isDryRunModeFlags`, `isWriteModeFlags` and their examples.
- `TsconfigSync.command.ts:9-16` — delete the three tuple-predicate and tuple-type imports and import the existing dual `resolveRunMode` API. Retain the `O`/Option import because the live handler still uses `O.getSomesStruct({ filter })` at line 80.
- `TsconfigSync.command.ts:18-30` — replace the tuple/predicate resolver with the shared literal resolver.
- `TsconfigSync.command.ts:52-68` — keep all three CLI flags; collapse them at the handler boundary and pass only `mode` into `syncOptions`.
- `tsconfig-sync.test.ts:191-210` — explicit `--write` case remains unchanged and still proves the sync alias.

### 6. Guard-deletion accounting

- `TsconfigSync.schemas.ts:443,460,477` — delete the three runtime tuple predicates that encode precedence as boolean shapes.
- `TsconfigSync.command.ts:21-29` — delete the `O.firstSomeOf` boolean coherence chain.
- `TsconfigSync.schemas.ts:412-477` — delete comments/examples teaching the tuple invariant.

### 7. Encoded-side impact

none (internal). `TsconfigSyncRunOptions` already carries the literal `mode`; generated tsconfig files are unchanged.

### 8. Test impact

`packages/tooling/tool/cli/test/tsconfig-sync.test.ts` retains the explicit
write CLI case. Add a local table for all eight accepted triples and their
exact result (`check` wins, then `dry-run`, then `sync`). Generic
`cli-kits.test.ts` coverage proves the shared helper, but cannot replace this
command-specific candidate ordering and default.

### 9. Risk & sequencing

Reuse the existing dual data-first/data-last `resolveRunMode` API. Preserve all
eight accepted inputs and current combined-flag precedence; changing any tuple
to rejection is outside this ratified design.
