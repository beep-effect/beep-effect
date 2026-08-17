/**
 * Checks whether the effect-ontology Drizzle schema has an ungenerated migration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { BunRuntime } from "@effect/platform-bun";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Console, Effect, FileSystem, HashSet, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

class MigrationsDriftError extends S.TaggedError<MigrationsDriftError>()("MigrationsDriftError", {
  message: S.String,
  newFolders: S.Array(S.String),
}) {}

class MigrationGenerationError extends S.TaggedError<MigrationGenerationError>()("MigrationGenerationError", {
  exitCode: S.Int,
  message: S.String,
}) {}

const program = Effect.scoped(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const moduleRoot = path.resolve(import.meta.dirname, "..");
    const migrationsFolder = path.join(moduleRoot, "Runtime", "Persistence", "migrations");
    const scratchRoot = yield* fs.makeTempDirectoryScoped({ prefix: "effect-ontology-migrations-drift-" });
    const scratch = path.join(scratchRoot, "migrations");
    yield* fs.copy(migrationsFolder, scratch);
    const before = HashSet.fromIterable(yield* fs.readDirectory(scratch));

    const exitCode = yield* spawner.exitCode(
      ChildProcess.make(
        "bun",
        [
          "scripts/generate-migrations.ts",
          "--dialect",
          "postgresql",
          "--schema",
          "./Repository/schema.ts",
          "--out",
          scratch,
          "--name",
          "drift_check",
        ],
        { cwd: moduleRoot, stderr: "inherit", stdout: "ignore" }
      )
    );
    if (exitCode !== 0) {
      return yield* MigrationGenerationError.make({
        exitCode,
        message: `drizzle-kit generate failed with exit code ${exitCode}`,
      });
    }

    const newFolders = A.filter(yield* fs.readDirectory(scratch), (entry) => !HashSet.has(before, entry));
    if (A.isReadonlyArrayNonEmpty(newFolders)) {
      yield* Effect.forEach(
        newFolders,
        Effect.fnUntraced(function* (folder) {
          yield* Console.error(`--- pending migration ${folder} ---`);
          yield* Console.error(yield* fs.readFileString(path.join(scratch, folder, "migration.sql")));
        }),
        { discard: true }
      );
      return yield* MigrationsDriftError.make({
        message:
          "effect-ontology schema changed without a migration. Run `bun run generate:effect-ontology-migrations -- --name <slug>` from scratchpad and commit the generated folder.",
        newFolders,
      });
    }
  })
);

const main = Effect.scoped(Layer.build(Layer.effectDiscard(program).pipe(Layer.provide(BunServices.layer))));

BunRuntime.runMain(main);
