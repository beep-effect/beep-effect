# Superseded out-of-scope design

Withdrawn on 2026-09-08 at source `7440cb8c4302ce64b87860069a464bafbf65f576`.
The recorded validator declares only inline function flag parameters, excluded
by SPEC and the scanner prompt. Separate qualified schema/CLI-option carriers
remain in scope and own any shared resolver migration. See
`data/design-refresh-2026-09-08-goals-findings.md`.
This historical design is not an implementation instruction.

# codex-findings-ingest-modes

This is the per-instance GATE 2 review surface. It uses the shared literal schemas and CLI-boundary resolvers specified in [family-cli-mode-flags.md](./family-cli-mode-flags.md); the instance-specific contract follows in full.


### 1. Instance

- id: `codex-findings-ingest-modes`
- file: `packages/tooling/tool/cli/src/commands/Codex/Findings.refresh.ts:243`
- symbol: `validateCodexFindingsIngestModes`
- members: `force`, `refresh`
- evidence: E2 at `packages/tooling/tool/cli/src/commands/Codex/Findings.refresh.ts:247-251` — the existing-packet mode reader rejects combined `force && refresh`; downstream readers then select replacement or triage-preserving refresh, never a combined mode. The conflict guard is supporting evidence, not E3.

### 2. Current shape

```ts
export const validateCodexFindingsIngestModes = Effect.fnUntraced(function* (options: {
  readonly force: boolean;
  readonly refresh: boolean;
}) {
  if (options.force && options.refresh) {
    return yield* ingestFailure(
      "mode-conflict",
      "--refresh preserves an existing packet while --force replaces it; choose exactly one existing-packet mode."
    );
  }
});
```

### 3. Cardinality gap

Four pairs are representable. Legal states are `none`, `refresh`, and `force`; `refresh + force` is illegal.

### 4. Target schema

Define the domain once in `Findings.schemas.ts` and reuse it in command and refresh modules:

```ts
const CodexFindingsExistingPacketModeKit = LiteralKit(["none", "refresh", "force"])
export const CodexFindingsExistingPacketMode = CodexFindingsExistingPacketModeKit.pipe(
  $I.annoteSchema("CodexFindingsExistingPacketMode", {
    description: "How ingest handles an existing Codex findings packet.",
  })
)
export type CodexFindingsExistingPacketMode = typeof CodexFindingsExistingPacketMode.Type
export const CodexFindingsExistingPacketModeIs = CodexFindingsExistingPacketModeKit.is

export class CodexFindingsIngestOptions extends S.Class<CodexFindingsIngestOptions>(
  $I`CodexFindingsIngestOptions`
)(
  {
    from: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    slug: S.OptionFromOptionalKey(CodexPacketSlug).pipe(SchemaUtils.withNoneDefault),
    date: S.OptionFromOptionalKey(CaptureDate).pipe(SchemaUtils.withNoneDefault),
    branch: S.OptionFromOptionalKey(CodexPacketBranch).pipe(SchemaUtils.withNoneDefault),
    expectedCount: S.OptionFromOptionalKey(S.Int).pipe(SchemaUtils.withNoneDefault),
    existingPacketMode: CodexFindingsExistingPacketMode.pipe(SchemaUtils.withKeyDefaults("none")),
    dryRun: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    json: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
  },
  $I.annote("CodexFindingsIngestOptions", {
    description: "Validated options accepted by `beep codex findings ingest`.",
  })
) {}

class CodexFindingsIngestCommandOptions extends S.Class<CodexFindingsIngestCommandOptions>(
  $I`CodexFindingsIngestCommandOptions`
)(
  {
    from: S.String,
    slug: S.Option(S.String),
    date: S.Option(S.String),
    branch: S.Option(S.String),
    expectedCount: S.Option(S.Int),
    existingPacketMode: CodexFindingsExistingPacketMode,
    dryRun: S.Boolean,
    json: S.Boolean,
  },
  $I.annote("CodexFindingsIngestCommandOptions", {
    description: "Resolved command-adapter options for Codex findings ingest.",
  })
) {}
```

The CLI adapter uses the shared exclusive resolver. Reads use the derived guard
owner, for example `CodexFindingsExistingPacketModeIs.refresh(mode)`.

### 5. Migration inventory

- `Findings.schemas.ts:350-389` — examples and `CodexFindingsIngestOptions` replace two defaulted booleans with one defaulted literal and export its derived guards.
- `Findings.schemas.ts:15-18` — add `LiteralKit` to the existing `@beep/schema` import.
- `Findings.schemas.ts:411-414` — decoder now returns the literal field.
- `Findings.command.ts:102-112` — replace the local plain command-options pair with `existingPacketMode` (prefer an `S.Class` using the shared schema).
- `Findings.command.ts:195-213` — refresh provenance branches on the derived `refresh` guard.
- `Findings.command.ts:255-279` — pass `force: is.force(existingPacketMode)` only at the existing `writePacket` boundary; its separate function flag is out of this cluster.
- `Findings.command.ts:406-412` — delete validation call; options already contain a legal mode.
- `Findings.command.ts:431-459` — retain both flags, resolve once, and write the literal into command options.
- `Findings.refresh.ts:216-253` — delete `validateCodexFindingsIngestModes` and its boolean-shaped docs.
- `codex-findings-refresh.test.ts:373-390` — refresh fixture writes `existingPacketMode: "refresh"`.
- `codex-findings-refresh.test.ts:440-445` — move conflict coverage to CLI/shared adapter parsing; stop importing the deleted validator.
- `codex-findings-normalize.test.ts:304-310` — assert the decoder default is `existingPacketMode === "none"`.
- `codex-findings-write.test.ts:25-39,148-212` — unchanged: these tests exercise the lower `writePacket.force` function flag, not the ratified command-options cluster.

### 6. Guard-deletion accounting

- `Findings.refresh.ts:247-251` — delete the mutual-exclusion runtime guard.
- `Findings.command.ts:409` — delete the application-level validation call.
- `Findings.refresh.ts:219-241` — delete the comment/API describing coherence between two booleans.

### 7. Encoded-side impact

none (internal). `CodexFindingsIngestOptions` decodes command input but is not a persisted packet/wire document; packet JSON schemas remain unchanged.

### 8. Test impact

Update `packages/tooling/tool/cli/test/codex-findings-refresh.test.ts` and `packages/tooling/tool/cli/test/codex-findings-normalize.test.ts`. `packages/tooling/tool/cli/test/codex-findings-write.test.ts` remains unchanged for the distinct low-level force boundary.

### 9. Risk & sequencing

Land the schema/export before command and refresh consumers. Preserve the existing typed `mode-conflict` CLI error. This area is destructive, so do not broaden the refactor into `writePacket` promotion semantics.
