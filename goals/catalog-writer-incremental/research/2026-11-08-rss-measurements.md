# Scoped catalog writer RSS measurements (2026-11-08)

Measured on the 125 GiB workstation with `/usr/bin/time -v`, from the
`goals/catalog-writer-incremental` worktree, against the five exploration
fixture files.

## Results

| Run | Max RSS | Wall | Source |
| --- | --- | --- | --- |
| Before: scoped run regenerates each owning package whole | 5.31 GB | 15.3 s | `explorations/compute-profile-gate-routing/RESEARCH.md` M1 |
| Per-file splice only (checker-backed `isExported()`) | 2.28 GB | 6.2 s | this lane |
| Per-file splice plus syntactic `getSymbol()` lookup | 2.27 GB | 6.0 s | this lane, fallback not adopted |
| After: per-file splice plus syntactic export check | 0.63 GB | 2.1 s | this lane |
| No parsed file (CLI, owner resolution, shard read and render) | 0.70 GB | 2.3 s | this lane, floor |
| Instrumentation writer, scoped, two `@beep/repo-cli` files | 566 MB | 3.4 s | earlier measurement, whole-owner regeneration kept |
| Full schema-catalog check, unchanged path | 15.0 GB | 39.6 s | this lane |

The splice parses only the staged files. That is cheap: one 36 KB file adds
about 2 MB. The remaining spike came from ts-morph `isExported()`. It builds
the type checker, which loads every imported module, the first time it meets
a statement without an export keyword. The per-file timings showed it:
`ArchiveExecution.service.ts` alone peaked at 1.74 GB.

## Commands

```sh
/usr/bin/time -v bun run beep lint schema-catalog --write \
  packages/epistemic/server/test/RetentionCalibrationCLI.test.ts \
  packages/foundation/ui-system/editor/test/capability-catalog.test.ts \
  packages/tooling/tool/cli/src/commands/Goals/ArchiveExecution.service.ts \
  packages/tooling/tool/cli/src/commands/Lint/EffectSchemaInventory.schemas.ts \
  packages/tooling/tool/cli/src/commands/Lint/SchemaCatalog.ts
/usr/bin/time -v bun run beep lint schema-catalog
/usr/bin/time -v bun run beep lint schema-catalog --write
git status --short standards/schema-catalog
```

## Parity

- The incremental write over the five fixtures changed no shard. A check-mode
  run of the same paths printed `@beep/editor, @beep/epistemic-server,
  @beep/repo-cli is current`.
- The full check then printed `standards/schema-catalog is current`
  (10451 entries, 181 shards).
- The full writer left `git status --short standards/schema-catalog` empty.
