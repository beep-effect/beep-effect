/**
 * Generates effect-ontology migrations and installs required extension DDL.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { BunRuntime } from "@effect/platform-bun";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Console, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const ExtensionPrelude = `-- Drizzle Kit emits extension-dependent vector columns but cannot declare their
-- prerequisite extensions. This generator-owned prelude must precede every CREATE TABLE.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
`;

class MigrationGenerationError extends S.TaggedError<MigrationGenerationError>()("MigrationGenerationError", {
  message: S.NonEmptyString,
  exitCode: S.Int,
}) {}

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const moduleRoot = path.resolve(import.meta.dirname, "..");
  const forwardedArguments = A.drop(process.argv, 2);
  const outIndex = A.findFirstIndex(forwardedArguments, (argument) => argument === "--out");
  const configuredOut = O.flatMap(outIndex, (index) => A.get(forwardedArguments, index + 1));
  const migrationsFolder = path.resolve(
    moduleRoot,
    O.getOrElse(configuredOut, () => "Runtime/Persistence/migrations")
  );
  const drizzleArguments = A.contains(forwardedArguments, "--dialect")
    ? ["--bun", "drizzle-kit", "generate", ...forwardedArguments]
    : ["--bun", "drizzle-kit", "generate", "--config", "drizzle.config.ts", ...forwardedArguments];
  const exitCode = yield* spawner.exitCode(
    ChildProcess.make(
      "bunx",
      drizzleArguments,
      { cwd: moduleRoot, stderr: "inherit", stdout: "inherit" }
    )
  );
  if (exitCode !== 0) {
    return yield* MigrationGenerationError.make({
      message: `drizzle-kit generate failed with exit code ${exitCode}`,
      exitCode,
    });
  }

  const baselineFolders = A.filter(yield* fs.readDirectory(migrationsFolder), Str.endsWith("_baseline"));
  yield* Effect.forEach(
    baselineFolders,
    Effect.fn("installExtensionPrelude")(function* (folder) {
      const migrationFile = path.join(migrationsFolder, folder, "migration.sql");
      const sql = yield* fs.readFileString(migrationFile);
      if (!Str.includes("CREATE EXTENSION IF NOT EXISTS vector")(sql)) {
        yield* fs.writeFileString(migrationFile, `${ExtensionPrelude}${sql}`);
      }
    }),
    { discard: true }
  );
  yield* Console.log(`Generated migrations in ${migrationsFolder}`);
});

const main = Effect.scoped(
  Layer.build(Layer.effectDiscard(program).pipe(Layer.provide(BunServices.layer))).pipe(Effect.asVoid)
);

BunRuntime.runMain(main);
