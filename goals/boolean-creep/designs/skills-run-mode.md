# skills-run-mode

This is the per-instance GATE 2 review surface. It uses the shared literal schemas and CLI-boundary resolvers specified in [family-cli-mode-flags.md](./family-cli-mode-flags.md); the instance-specific contract follows in full.


### 1. Instance

- id: `skills-run-mode`
- file: `packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:988`
- symbol: `skills mode flags`
- members: `check`, `dryRun`
- evidence: E2 at `packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:879-893` — `resolveMode` rejects combined `check && dryRun` and otherwise reads the pair as check, dry-run, or write; combined-true is never a `SkillsRunMode`. The conflict branch is supporting evidence, not E3.

### 2. Current shape

```ts
const checkFlag = Flag.boolean("check").pipe(
  Flag.withDescription("Report skill drift without writing files and exit non-zero when changes are needed")
);
const dryRunFlag = Flag.boolean("dry-run").pipe(
  Flag.withDescription("Preview skill updates without writing files or failing on drift")
);
```

### 3. Cardinality gap

Four pairs are representable. Legal modes are `write` (neither flag), `check`, and `dry-run`; combined flags are illegal.

### 4. Target schema

Preserve the existing symbol name but replace the hand-written union at `Skills.command.ts:41` with the shared LiteralKit schema:

```ts
const SkillsRunMode = RunMode
type SkillsRunMode = RunMode

class SkillsUpdateOptions extends S.Class<SkillsUpdateOptions>($I`SkillsUpdateOptions`)(
  {
    mode: SkillsRunMode,
    skill: S.Option(S.String),
  },
  $I.annote("SkillsUpdateOptions", { description: "Resolved options for the skills update workflow." })
) {}
```

Import runtime `RunMode` and its type from `internal/cli/RunMode.ts`. Resolve the parser flags through the shared exclusive resolver before constructing `SkillsUpdateOptions`.

### 5. Migration inventory

- `Skills.command.ts:41` — replace the hand-rolled literal union with runtime/type aliases to shared `RunMode`; do not mint another literal set.
- `Skills.command.ts:879-893` — delete local `resolveMode`; call `resolveExclusiveRunModeFromFlags` with an `onConflict` Effect that fails with `SkillsCommandError` and the exact message `The --check and --dry-run flags are mutually exclusive.`; `printDriftReport` keeps the literal mode.
- `Skills.command.ts:908-912` — replace the plain options literal with `SkillsUpdateOptions`; all reads already use `options.mode` and need no semantic change.
- `Skills.command.ts:988-990` — retain flags only at the CLI boundary, resolve them once, construct schema-backed options, and call the workflow.
- `skills-command.test.ts:1,262` — existing direct `runSkillsUpdate({ mode: "write", ... })` remains semantically valid; construct `SkillsUpdateOptions.make(...)` if the function requires class instances.
- `cli-kits.test.ts:85-115` — shared resolver owns mode/conflict unit coverage.

### 6. Guard-deletion accounting

- `Skills.command.ts:879-893` — delete the local `check && dryRun` guard and nested ternary resolver while preserving its typed `SkillsCommandError` and exact message in the shared resolver's `onConflict` Effect.
- `Skills.command.ts:41` — delete the comment-only/hand-written invariant embodied by a bare literal union rather than a schema.
- `Skills.command.ts:988-990` — replace the boolean-to-mode step with the shared boundary resolver; application code receives an already legal mode.

### 7. Encoded-side impact

none (internal). `skills-lock.json` and `.codex/config.toml` output formats are unaffected.

### 8. Test impact

`packages/tooling/tool/cli/test/skills-command.test.ts` only calls the workflow with `mode: "write"`; update construction if needed. Add CLI conflict coverage for the exact `SkillsCommandError` message and rely on `packages/tooling/tool/cli/test/cli-kits.test.ts` for shared resolution.

### 9. Risk & sequencing

Land after shared `RunMode` exports. `Skills.command.ts` is large, but downstream logic already uses a literal, so constrain the change to schema ownership, adapter collapse, and option construction.
