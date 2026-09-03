/**
 * Syncs the Professional Desktop runtime migration bundle from the repo's
 * db-admin drizzle folder into the data-only generated module
 * `src/runtime/Migrations.gen.ts`.
 *
 * The generated module is what the compiled sidecar embeds; db-admin stays
 * the migration-authoring home without becoming a production dependency.
 */

import { BunRuntime } from "@effect/platform-bun";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import type { Equivalence } from "effect/Equivalence";

const mode = Match.value(Bun.argv.includes("--check")).pipe(
  Match.when(true, () => "check" as const),
  Match.orElse(() => "write" as const)
);

// Effect calls the hook with the declared struct equivalence; narrowing it from `never` to `Self`
// is the contravariant direction (`Self` extends the struct type), so the assertion is sound.
const declaredFieldsEquivalence = <Self>(typeParameters: readonly [Equivalence<never>]): Equivalence<Self> =>
  typeParameters[0] as Equivalence<Self>;

class StaleMigrationBundle extends S.TaggedError<StaleMigrationBundle>()(
  "StaleMigrationBundle",
  {
    message: S.String,
    command: S.String,
  },
  { toEquivalence: (typeParameters) => declaredFieldsEquivalence<StaleMigrationBundle>(typeParameters) }
) {}

const quoteTemplateLiteral = (value: string): string =>
  `\`${value.replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("${", "\\${")}\``;

class MigrationBundleEntry extends S.Class<MigrationBundleEntry>("MigrationBundleEntry")({
  name: S.String,
  sql: S.String,
}) {}

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

const renderMigrationsGenModule = Effect.fn("ProfessionalDesktop.syncMigrationBundle.renderMigrationsGenModule")(
  function* (sourceFolder: string) {
    const fs = yield* FileSystem.FileSystem;
    const entries = yield* fs.readDirectory(sourceFolder);
    const migrations = yield* Effect.all(
      A.map(entries, (entry) => readMigrationBundleEntry(sourceFolder, entry)),
      { concurrency: "unbounded" }
    );
    const sortedMigrations = A.sortWith(A.getSomes(migrations), (migration) => migration.name, Order.String);
    const lines = [
      "/**",
      " * Generated from `packages/_internal/db-admin/drizzle` by",
      " * `scripts/sync-migration-bundle.ts`. Do not edit; refresh with",
      " * `bun run --cwd apps/professional-desktop codegen`.",
      " *",
      " * @packageDocumentation",
      " * @since 0.0.0",
      " */",
      'import type { MigrationBundleEntry } from "@beep/postgres";',
      "",
      "/**",
      " * Professional Desktop sidecar migration bundle, synced byte-exactly from",
      " * the db-admin drizzle migration folders.",
      " *",
      " * **Example** (Count the bundled migrations)",
      " *",
      " * ```ts",
      ' * import { migrationBundle } from "@/runtime/Migrations.gen"',
      " *",
      " * console.log(migrationBundle.length)",
      " * ```",
      " *",
      " * @category configuration",
      " * @since 0.0.0",
      " */",
      "export const migrationBundle: ReadonlyArray<MigrationBundleEntry> = [",
      ...A.flatMap(sortedMigrations, (migration) => [
        "  {",
        `    name: ${JSON.stringify(migration.name)},`,
        `    sql: ${quoteTemplateLiteral(migration.sql)},`,
        "  },",
      ]),
      "];",
      "",
    ];

    return lines.join("\n");
  }
);

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = path.resolve(import.meta.dirname, "../../..");
  const sourceFolder = path.join(root, "packages/_internal/db-admin/drizzle");
  const targetFile = path.join(root, "apps/professional-desktop/src/runtime/Migrations.gen.ts");
  const nextSource = yield* renderMigrationsGenModule(sourceFolder);
  const source = yield* fs.readFileString(targetFile).pipe(Effect.orElseSucceed(() => ""));

  if (nextSource === source) {
    return;
  }

  if (mode === "check") {
    const command = "bun run --cwd apps/professional-desktop codegen";
    return yield* StaleMigrationBundle.make({
      command,
      message: `Professional Desktop migration bundle is stale. Run \`${command}\`.`,
    });
  }

  yield* fs.writeFileString(targetFile, nextSource);
});

const MainLive = Layer.mergeAll(BunFileSystem.layer, BunPath.layer);
const main = program.pipe(Layer.effectDiscard, Layer.provide(MainLive), Layer.build, Effect.scoped);

BunRuntime.runMain(main);
