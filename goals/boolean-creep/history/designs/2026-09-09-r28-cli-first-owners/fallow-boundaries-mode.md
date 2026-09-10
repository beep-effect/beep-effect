# fallow-boundaries-mode

This is the per-instance GATE 2 review surface. It uses the shared literal schemas and CLI-boundary resolvers specified in [family-cli-mode-flags.md](./family-cli-mode-flags.md); the instance-specific contract follows in full.


### 1. Instance

- id: `fallow-boundaries-mode`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file: `packages/tooling/tool/cli/src/commands/Fallow/Fallow.command.ts:468`
- symbol: `fallow boundaries flags`
- members: `write`, `check`
- evidence: E2 at `packages/tooling/tool/cli/src/commands/Fallow/Fallow.command.ts:478-499` — after rejecting combined `write && check`, the reader dispatches write, check, or print and never handles combined-true as a mode. The conflict guard is supporting evidence, not E3.

### 2. Current shape

```ts
const boundariesCommand = Command.make(
  "boundaries",
  {
    output: Flag.string("output").pipe(
      Flag.withAlias("o"),
      Flag.withDefault(DEFAULT_BOUNDARY_CONFIG_PATH),
      Flag.withDescription("Generated Fallow boundary config path")
    ),
    write: Flag.boolean("write").pipe(Flag.withDescription("Write the generated boundary config")),
    check: Flag.boolean("check").pipe(Flag.withDescription("Fail when the generated boundary config is stale")),
  },
  Effect.fn(function* ({ output, write, check }) {
    if (write && check) {
      yield* Console.error("fallow boundaries: --write and --check are mutually exclusive.");
      return yield* failWithReportedExit("fallow boundaries: choose either --write or --check.");
    }

    const repoRoot = yield* findRepoRoot();
    const outputPath = yield* resolveOutputPath(repoRoot, output);
    const expectedText = yield* renderBoundaryConfig(repoRoot, outputPath);

    if (write) {
      yield* writeBoundaryConfig(outputPath, expectedText);
      yield* Console.log(`fallow boundaries: wrote ${outputPath}.`);
      return;
    }

    if (check) {
      yield* checkBoundaryConfig(outputPath, expectedText);
      yield* checkDoctrineBoundaries(repoRoot, outputPath);
      return;
    }

    yield* Console.log(expectedText);
  })
).pipe(Command.withDescription("Generate the advisory Fallow boundary config from workspace dependency metadata"));
```

### 3. Cardinality gap

Four pairs are representable. Legal modes are `print`, `write`, and `check`; the combined mode is illegal.

### 4. Target schema

Reuse the family `PrintWriteCheckMode`. Keep both Flag declarations, resolve them at the adapter with fallback `print`, and move the existing branch bodies behind an exhaustive literal match.

```ts
const runFallowBoundaries = Effect.fn("Fallow.runBoundaries")(function* (
  output: string,
  mode: PrintWriteCheckMode
) {
  const repoRoot = yield* findRepoRoot()
  const outputPath = yield* resolveOutputPath(repoRoot, output)
  const expectedText = yield* renderBoundaryConfig(repoRoot, outputPath)

  return yield* PrintWriteCheckModeMatch(mode, {
    print: () => Console.log(expectedText),
    write: Effect.fnUntraced(function* () {
      yield* writeBoundaryConfig(outputPath, expectedText)
      yield* Console.log(`fallow boundaries: wrote ${outputPath}.`)
    }),
    check: Effect.fnUntraced(function* () {
      yield* checkBoundaryConfig(outputPath, expectedText)
      yield* checkDoctrineBoundaries(repoRoot, outputPath)
    }),
  })
})
```

### 5. Migration inventory

- `Fallow.command.ts:460-470` — CLI parser remains source of the two legacy booleans.
- `Fallow.command.ts:477-500` — resolve `PrintWriteCheckMode` before
  `findRepoRoot`, exactly where the current conflict guard runs, then dispatch
  exhaustively. Preserve the exact Console error followed by the exact
  `failWithReportedExit` message.
- `package.json:346` and `:367-369` — `beep:preflight` and the three Fallow scripts retain their current argv unchanged.
- `DeletePackage.command.ts:426` — generated baseline writer continues invoking `fallow boundaries --write` unchanged.
- `Quality/FallowQuality.command.ts:2052` — wrapper script choice remains unchanged.
- `quality-tasks.test.ts:871`, `:879`, and `:1683`, plus `ci-lane.test.ts:1128` — the live fallow-boundaries config and lane assertions do not construct the pair and remain unchanged.

### 6. Guard-deletion accounting

- `Fallow.command.ts:478-481` — delete the local mutual-exclusion guard while moving its exact two-message Console/failure behavior into the shared resolver's `onConflict` Effect.
- `Fallow.command.ts:487-499` — delete the `if (write)`, `if (check)`, else-print chain.
- `GeneratedFileDrift.ts:6-13` — when the shared docs are updated, stop citing Fallow as a consumer of boolean assertion infrastructure.

### 7. Encoded-side impact

none (internal). The generated Fallow JSONC bytes and public CLI spellings are unchanged.

All four raw CLI pairs retain behavior: three resolve to modes and combined
true fails with the existing two messages before repository discovery.

### 8. Test impact

No test directly drives the raw `fallow boundaries` flag pair. `packages/tooling/tool/cli/test/quality-tasks.test.ts` and `packages/tooling/tool/cli/test/ci-lane.test.ts` only assert stable related argv/lane state. Add focused command tests for all modes and the conflict during P4, including the exact Console error and `failWithReportedExit` message in their current order.

### 9. Risk & sequencing

Land after `PrintWriteCheckMode` and the exclusive resolver. Generated-file output is repository governance state, so prove byte identity without changing render/check functions.
