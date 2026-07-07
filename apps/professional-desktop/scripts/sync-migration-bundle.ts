import { BunRuntime } from "@effect/platform-bun";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { Data, Effect, FileSystem, Layer, Match, Order, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";

const startMarker = "// <generated:migration-bundle>";
const endMarker = "// </generated:migration-bundle>";
const mode = Match.value(Bun.argv.includes("--check")).pipe(
  Match.when(true, () => "check" as const),
  Match.orElse(() => "write" as const)
);

class MissingMigrationBundleMarkers extends Data.TaggedError("MissingMigrationBundleMarkers")<{
  readonly message: string;
  readonly targetFile: string;
}> {}

class StaleMigrationBundle extends Data.TaggedError("StaleMigrationBundle")<{
  readonly command: string;
  readonly message: string;
}> {}

const quoteTemplateLiteral = (value: string): string =>
  `\`${value.replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("${", "\\${")}\``;

type MigrationBundleEntry = {
  readonly name: string;
  readonly sql: string;
};

const readMigrationBundleEntry = Effect.fnUntraced(function* (sourceFolder: string, entry: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entryPath = path.join(sourceFolder, entry);
  const info = yield* fs.stat(entryPath);
  if (info.type !== "Directory") {
    return O.none<MigrationBundleEntry>();
  }

  const migrationSqlPath = path.join(entryPath, "migration.sql");
  const hasMigrationSql = yield* fs.exists(migrationSqlPath).pipe(Effect.orElseSucceed(() => false));
  if (!hasMigrationSql) {
    return O.none<MigrationBundleEntry>();
  }

  return O.some({
    name: entry,
    sql: yield* fs.readFileString(migrationSqlPath),
  });
});

const readMigrationBundle = Effect.fn("ProfessionalDesktop.syncMigrationBundle.readMigrationBundle")(function* (
  sourceFolder: string
) {
  const fs = yield* FileSystem.FileSystem;
  const entries = yield* fs.readDirectory(sourceFolder);
  const migrations = yield* Effect.all(
    A.map(entries, (entry) => readMigrationBundleEntry(sourceFolder, entry)),
    { concurrency: "unbounded" }
  );
  const sortedMigrations = A.sortWith(A.getSomes(migrations), (migration) => migration.name, Order.String);
  const lines = [
    startMarker,
    "const MigrationBundle: ReadonlyArray<MigrationFile> = [",
    ...A.flatMap(sortedMigrations, (migration) => [
      "  {",
      `    name: ${JSON.stringify(migration.name)},`,
      `    sql: ${quoteTemplateLiteral(migration.sql)},`,
      "  },",
    ]),
    "];",
    endMarker,
  ];

  return lines.join("\n");
});

const replaceGeneratedRegion = (targetFile: string, source: string, generatedRegion: string): string => {
  const startIndex = source.indexOf(startMarker);
  const endIndex = source.indexOf(endMarker, startIndex);
  if (startIndex === -1 || endIndex === -1) {
    throw new MissingMigrationBundleMarkers({
      message: `Missing generated migration bundle markers in ${targetFile}.`,
      targetFile,
    });
  }

  return `${source.slice(0, startIndex)}${generatedRegion}${source.slice(endIndex + endMarker.length)}`;
};

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = path.resolve(import.meta.dirname, "../../..");
  const sourceFolder = path.join(root, "packages/_internal/db-admin/drizzle");
  const targetFile = path.join(root, "apps/professional-desktop/src/runtime/Migrations.ts");
  const source = yield* fs.readFileString(targetFile);
  const generatedRegion = yield* readMigrationBundle(sourceFolder);
  const nextSource = replaceGeneratedRegion(targetFile, source, generatedRegion);

  if (nextSource === source) {
    return;
  }

  if (mode === "check") {
    const command = "bun run --cwd apps/professional-desktop codegen";
    return yield* Effect.fail(
      new StaleMigrationBundle({
        command,
        message: `Professional Desktop migration bundle is stale. Run \`${command}\`.`,
      })
    );
  }

  yield* fs.writeFileString(targetFile, nextSource);
});

const MainLive = Layer.mergeAll(BunFileSystem.layer, BunPath.layer);

BunRuntime.runMain(program.pipe(Effect.provide(MainLive)));
