/**
 * Fails when the drizzle-kit schema surface (`src/schema.ts`) has changed
 * without a committed migration. The real `drizzle/` folder is never written.
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

const MigrationsDriftErrorFields = {
  message: S.String,
  newFolders: S.Array(S.String),
} satisfies S.Struct.Fields;
const sameMigrationsDriftErrorFields = S.toEquivalence(
  S.TaggedStruct("MigrationsDriftError", MigrationsDriftErrorFields)
);
const sameMigrationsDriftError = (self: MigrationsDriftError, that: MigrationsDriftError): boolean =>
  sameMigrationsDriftErrorFields(self, that);
const MigrationsDriftErrorAnnotations = {
  toEquivalence: () => sameMigrationsDriftError,
} satisfies S.Annotations.Declaration<
  MigrationsDriftError,
  readonly [S.TaggedStruct<"MigrationsDriftError", typeof MigrationsDriftErrorFields>]
>;

class MigrationsDriftError extends S.TaggedError<MigrationsDriftError>()(
  "MigrationsDriftError",
  MigrationsDriftErrorFields,
  MigrationsDriftErrorAnnotations
) {}

const MigrationGenerationErrorFields = {
  exitCode: S.Int,
  message: S.String,
} satisfies S.Struct.Fields;
const sameMigrationGenerationErrorFields = S.toEquivalence(
  S.TaggedStruct("MigrationGenerationError", MigrationGenerationErrorFields)
);
const sameMigrationGenerationError = (self: MigrationGenerationError, that: MigrationGenerationError): boolean =>
  sameMigrationGenerationErrorFields(self, that);
const MigrationGenerationErrorAnnotations = {
  toEquivalence: () => sameMigrationGenerationError,
} satisfies S.Annotations.Declaration<
  MigrationGenerationError,
  readonly [S.TaggedStruct<"MigrationGenerationError", typeof MigrationGenerationErrorFields>]
>;

class MigrationGenerationError extends S.TaggedError<MigrationGenerationError>()(
  "MigrationGenerationError",
  MigrationGenerationErrorFields,
  MigrationGenerationErrorAnnotations
) {}

const program = Effect.scoped(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const packageRoot = path.resolve(import.meta.dirname, "..");
    const drizzleFolder = path.join(packageRoot, "drizzle");
    const scratchRoot = yield* fs.makeTempDirectoryScoped({ prefix: "db-admin-migrations-drift-" });
    const scratch = path.join(scratchRoot, "drizzle");
    yield* fs.copy(drizzleFolder, scratch);
    const before = HashSet.fromIterable(yield* fs.readDirectory(scratch));

    const exitCode = yield* spawner.exitCode(
      ChildProcess.make(
        "bunx",
        [
          "--bun",
          "drizzle-kit",
          "generate",
          "--dialect",
          "postgresql",
          "--schema",
          "./src/schema.ts",
          "--out",
          scratch,
          "--name",
          "drift_check",
        ],
        { cwd: packageRoot, stderr: "inherit", stdout: "ignore" }
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
          "db-admin schema changed without a migration. Run `bun run generate -- --name <slug>` in packages/_internal/db-admin, review the SQL, and commit the new drizzle folder.",
        newFolders,
      });
    }
  })
);

const main = Effect.scoped(Layer.build(Layer.effectDiscard(program).pipe(Layer.provide(BunServices.layer))));

BunRuntime.runMain(main);
