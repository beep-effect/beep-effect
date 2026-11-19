import { generate } from "drizzle-kit/cli";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { generatedFile } from "./GeneratedFile.ts";

/**
 * drizzle-kit refused to generate, or reported an error.
 *
 * @category errors
 * @since 0.0.0
 */
export class DrizzleKitFailed extends S.TaggedError<DrizzleKitFailed, { readonly brand: unique symbol }>()("DrizzleKitFailed", {
  message: S.String,
  cause: S.optionalKey(S.Defect({ includeStack: true })),
}) {}

/**
 * The schema and the committed migrations disagree: the schema has changes
 * no migration holds yet.
 *
 * @category errors
 * @since 0.0.0
 */
export class MigrationsDrift extends S.TaggedError<MigrationsDrift, { readonly brand: unique symbol }>()("MigrationsDrift", {
  message: S.String,
}) {}

/**
 * Where a host's Drizzle schema, its migrations and the module that carries
 * them live.
 *
 * @category models
 * @since 0.0.0
 */
export interface Options {
  /** The schema module drizzle-kit reads: every table exported by name, absolute. */
  readonly schema: string;
  /** The migrations folder, in drizzle-kit's layout (`<timestamp>_<name>/{migration.sql,snapshot.json}`), absolute. */
  readonly out: string;
  /** The generated module, absolute. */
  readonly module: string;
  /** The record the module exports, e.g. `PartyMigrations`. */
  readonly exportName: string;
  /** The command that regenerates both, for the generated header and drift messages. */
  readonly command: string;
}

/** A migration folder: drizzle-kit names it `<yyyyMMddHHmmss>_<name>`. */
const MigrationFolder = S.String.check(
  S.isPattern(/^\d{14}_[A-Za-z0-9_]+$/, {
    identifier: "MigrationFolderCheck",
    title: "MigrationFolder",
    description: "A drizzle-kit migration folder: a 14-digit timestamp, then the migration's name.",
  }),
);

const BREAKPOINT = "--> statement-breakpoint";
const encodeString = S.encodeEffect(S.fromJsonString(S.String));

/** One SQL statement as a string literal, indented under its migration. */
const literal = (statement: string) => Effect.map(encodeString(statement), (text) => `    ${text},`);

/**
 * The module that carries a host's committed migrations: each folder's
 * statements, in folder order, keyed `<id>_<folder>`. `effect/sql/Migrator`
 * runs pending ids in order and records the folder as the migration's name,
 * so a runner applies them without reading files.
 *
 * @category generators
 * @since 0.0.0
 */
export const render = Effect.fn("Migrations.render")(function* (options: Options) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const listed = yield* fs.readDirectory(options.out).pipe(Effect.orElseSucceed(A.empty<string>));
  const folders = pipe(
    listed,
    A.filter(S.is(MigrationFolder)),
    A.sort(Order.String),
  );
  const entries = yield* Effect.forEach(
    folders,
    Effect.fnUntraced(function* (folder, index) {
      const text = yield* fs.readFileString(path.join(options.out, folder, "migration.sql"));
      const statements = pipe(text, Str.split(BREAKPOINT), A.map(Str.trim), A.filter(Str.isNonEmpty));
      const lines = yield* Effect.forEach(statements, literal, { concurrency: 1 });
      return [`  "${index + 1}_${folder}": [`, ...lines, "  ],"];
    }),
    { concurrency: 1 },
  );
  return A.join(
    [
      `// Generated from migrations/ by \`${options.command}\`. Do not edit:`,
      `// the same command rewrites it, and \`${options.command} --check\` fails on drift.`,
      "",
      "/**",
      " * Every committed migration, in order: its statements, keyed",
      " * `<id>_<folder>`. `id` orders them for `effect/sql/Migrator`; the folder",
      " * is drizzle-kit's, under `migrations/`.",
      " *",
      " * @category migrations",
      " * @since 0.0.0",
      " */",
      `export const ${options.exportName}: Readonly<Record<string, ReadonlyArray<string>>> = {`,
      ...A.flatten(entries),
      "};",
      "",
    ],
    "\n",
  );
});

const failed = (result: { readonly status: string; readonly error?: unknown }) =>
  DrizzleKitFailed.make({
    message: `drizzle-kit generate returned ${result.status}: ${O.getOrElse(S.encodeUnknownOption(S.fromJsonString(S.Unknown))(result.error), () => "no detail")}`,
  });

/** drizzle-kit's `generate`, as an Effect. With `explain` it is a dry run that writes nothing. */
const drizzleKitGenerate = (options: Options, explain: boolean, name: string | undefined) =>
  Effect.tryPromise({
    try: () => generate({ dialect: "postgresql", schema: options.schema, out: options.out, explain, ...(name === undefined ? {} : { name }) }),
    catch: (cause) => DrizzleKitFailed.make({ message: "drizzle-kit generate threw", cause }),
  });

/**
 * Generate the next migration from the schema with drizzle-kit, when the
 * schema has changed, then rewrite the module.
 *
 * @category generators
 * @since 0.0.0
 */
export const write = Effect.fn("Migrations.write")(function* (options: Options, name: string | undefined) {
  const fs = yield* FileSystem.FileSystem;
  const result = yield* drizzleKitGenerate(options, false, name);
  if (result.status !== "ok" && result.status !== "no_changes") return yield* failed(result);
  const module = yield* render(options);
  yield* fs.writeFileString(options.module, module);
});

/**
 * Fail unless the committed migrations hold the schema (drizzle-kit has
 * nothing to generate) and the module is exactly what they render.
 *
 * @category generators
 * @since 0.0.0
 */
export const check = Effect.fn("Migrations.check")(function* (options: Options) {
  const result = yield* drizzleKitGenerate(options, true, undefined);
  if (result.status === "ok") {
    return yield* MigrationsDrift.make({ message: `${options.schema} has changes no migration holds; run \`${options.command}\`` });
  }
  if (result.status !== "no_changes") return yield* failed(result);
  yield* generatedFile(options.module, render(options), ["--check"]);
});

/**
 * A host's `scripts/migrations.ts`: `--check` checks, `--name=<name>` names
 * the migration it writes.
 *
 * **Example** (A host's generator)
 * ```ts
 * import * as Migrations from "@proto/tooling/Migrations";
 *
 * const run = Migrations.main(["--check"], {
 *   schema: "/repo/party/host/src/Party.schema.ts",
 *   out: "/repo/party/host/migrations",
 *   module: "/repo/party/host/src/Party.migrations.ts",
 *   exportName: "PartyMigrations",
 *   command: "bun run --cwd party/host migrations",
 * });
 * ```
 *
 * @category generators
 * @since 0.0.0
 */
export const main: {
  (options: Options): (argv: ReadonlyArray<string>) => ReturnType<typeof check> | ReturnType<typeof write>;
  (argv: ReadonlyArray<string>, options: Options): ReturnType<typeof check> | ReturnType<typeof write>;
} = dual(2, (argv: ReadonlyArray<string>, options: Options) =>
  A.contains(argv, "--check")
    ? check(options)
    : write(options, pipe(A.findFirst(argv, Str.startsWith("--name=")), O.map(Str.slice(7)), O.getOrUndefined)),
);
