# Superseded out-of-scope design

Withdrawn on 2026-09-08 against source `7440cb8c4302ce64b87860069a464bafbf65f576`.
The declaration contains only function flag parameters, explicitly excluded by
SPEC and the scanner prompt. Its validation effect has no production caller;
the former downstream syncGeneratedFile proposal changed another symbol.
See `data/design-refresh-2026-09-08-tooling-baseline.md` for the full audit.
This historical design is not an implementation instruction.

# generated-file-drift-mode-flags

This is the per-instance GATE 2 review surface. It uses the shared literal schemas and CLI-boundary resolvers specified in [family-cli-mode-flags.md](./family-cli-mode-flags.md); the instance-specific contract follows in full.


### 1. Instance

- id: `generated-file-drift-mode-flags`
- file: `packages/tooling/tool/cli/src/internal/artifacts/GeneratedFileDrift.ts:49`
- symbol: `assertExclusiveModeFlags`
- members: `write`, `check`
- evidence: E2 at `packages/tooling/tool/cli/src/internal/artifacts/GeneratedFileDrift.ts:53` — the shared mode reader routes combined `write && check` only to `onConflict`, so the combined case is never admitted as a generated-file mode. The conflict effect is supporting evidence, not E3.

### 2. Current shape

```ts
export const assertExclusiveModeFlags = <E, R>(input: {
  readonly write: boolean;
  readonly check: boolean;
  readonly onConflict: Effect.Effect<never, E, R>;
}): Effect.Effect<void, E, R> => (input.write && input.check ? input.onConflict : Effect.void);
```

### 3. Cardinality gap

Four pairs are representable. Three flag selections are legal: no explicit mode, `write`, and `check`; both is illegal. The no-flag and explicit-check selections have the same generated-file behavior, so the honest application domain has two modes: `write` and `check`.

### 4. Target schema

Delete `assertExclusiveModeFlags`. Reuse the family `WriteCheckRunMode`, derived by `LiteralKit(RunModeKit.pickOptions(["check", "write"]))`. Change the downstream helper to:

```ts
export const syncGeneratedFile = <E, R>(input: {
  readonly mode: WriteCheckRunMode
  readonly path: string
  readonly content: string
  readonly onWrote: Effect.Effect<void, E, R>
  readonly onMissing: Effect.Effect<never, E, R>
  readonly onStale: Effect.Effect<never, E, R>
  readonly onCurrent: Effect.Effect<void, E, R>
  readonly onError: (cause: unknown) => E
}): Effect.Effect<void, E, FileSystem.FileSystem | Path.Path | R> =>
  WriteCheckRunModeIs.write(input.mode)
    ? writeGeneratedFile({
        path: input.path,
        content: input.content,
        onWrote: input.onWrote,
        onError: input.onError,
      })
    : checkGeneratedFile({
        path: input.path,
        content: input.content,
        onMissing: input.onMissing,
        onStale: input.onStale,
        onCurrent: input.onCurrent,
        onError: input.onError,
      })
```

CLI adapters resolve no flags to `check`, preserving current generated-file semantics.

### 5. Migration inventory

- `GeneratedFileDrift.ts:27-53` — delete the assertion API, docs, input writes, and boolean read.
- `GeneratedFileDrift.ts:144-191` — rename `syncGeneratedFile.write` to `mode`, update its example, and dispatch with the derived literal guard.
- `internal/artifacts/index.ts:10` — wildcard export naturally drops the deleted assertion and exports the revised sync API.
- `artifacts-io.test.ts:1-9,96-115` — stop importing/testing `assertExclusiveModeFlags`; test shared adapter conflict behavior elsewhere.
- `artifacts-io.test.ts:181-199` — write `mode: "write"` in the sync dispatch fixture.
- Whole-repo search found no production call to either `assertExclusiveModeFlags` or `syncGeneratedFile`; the only current consumers are this test and documentation examples.

### 6. Guard-deletion accounting

- `GeneratedFileDrift.ts:49-53` — delete the entire runtime coherence guard.
- `GeneratedFileDrift.ts:1-13,27-47` — delete comments that advertise boolean validation as application infrastructure.
- `artifacts-io.test.ts:96-115` — delete the guard-specific test.

### 7. Encoded-side impact

none (internal). The helper does not encode its options.

### 8. Test impact

Only `packages/tooling/tool/cli/test/artifacts-io.test.ts` touches these members. Update the dispatch test and rely on `cli-kits.test.ts` for shared conflict resolution.

### 9. Risk & sequencing

Because the helper currently has no production caller, P4 must not claim a behavior migration that does not exist. Land the shared literal first, delete the orphan guard, and keep filesystem branch behavior unchanged.
