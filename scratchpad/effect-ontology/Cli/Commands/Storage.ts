/**
 * CLI: Storage Command
 *
 * **Details**
 *
 * Browse and manage data in cloud storage (GCS) or local storage.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Console, Effect, MutableHashSet, Order } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { Argument as Args, Command, Flag as Options } from "effect/unstable/cli";
import { BatchManifest } from "../../Domain/Schema/Batch.ts";
import { StorageService } from "../../Service/Storage.ts";
import { withErrorHandler } from "../ErrorHandler.ts";

// =============================================================================
// Subcommands
// =============================================================================

// --- List Command ---

const listPrefix = Args.string("prefix").pipe(
  Args.optional,
  Args.withDescription("Path prefix to list (default: root)")
);

const listHandler = Effect.fn("listHandler")(function* (prefix: O.Option<string>) {
  const storage = yield* StorageService;
  const effectivePrefix = O.getOrElse(prefix, () => "");
  yield* Console.log(`Listing: ${effectivePrefix || "(root)"}`);
  yield* Console.log("");
  const items = yield* storage.list(effectivePrefix);
  if (A.isReadonlyArrayEmpty(items)) {
    yield* Console.log("(empty)");
    return;
  }
  const dirs = MutableHashSet.empty<string>();
  const files = A.empty<string>();
  for (const item of items) {
    const relativePath = P.isTruthy(effectivePrefix)
      ? Str.replace(/^\//, "")(Str.replace(effectivePrefix, "")(item))
      : item;
    const parts = Str.split("/")(relativePath);
    if (parts.length > 1) {
      MutableHashSet.add(dirs, `${parts[0]}/`);
    } else {
      files.push(item);
    }
  }
  for (const dir of A.sort(A.fromIterable(dirs), Order.String)) {
    yield* Console.log(`  📁 ${dir}`);
  }
  for (const file of A.sort(files, Order.String)) {
    const name = O.getOrElse(A.last(Str.split("/")(file)), () => file);
    yield* Console.log(`  📄 ${name}`);
  }
  yield* Console.log("");
  yield* Console.log(`Total: ${MutableHashSet.size(dirs)} directories, ${files.length} files`);
});

const listCommand = Command.make("ls", { prefix: listPrefix }, ({ prefix }) =>
  prefix.pipe(listHandler, withErrorHandler)
).pipe(Command.withDescription("List objects in storage"));

// --- Cat Command ---

const catPath = Args.string("path").pipe(Args.withDescription("Path to the object to read"));

const catLinesOption = Options.integer("lines").pipe(
  Options.withAlias("n"),
  Options.withDefault(0),
  Options.withDescription("Limit output to N lines (0 = all)")
);

const catHandler = Effect.fn("catHandler")(function* (path: string, lines: number) {
  const storage = yield* StorageService;
  const contentOpt = yield* storage.getOption(path);
  if (O.isNone(contentOpt)) {
    yield* Console.error(`Not found: ${path}`);
    return;
  }
  let content = contentOpt.value;
  if (lines > 0) {
    content = A.join(A.take(Str.split("\n")(content), lines), "\n");
  }
  yield* Console.log(content);
});

const catCommand = Command.make("cat", { path: catPath, lines: catLinesOption }, ({ lines, path }) =>
  withErrorHandler(catHandler(path, lines))
).pipe(Command.withDescription("Display contents of an object"));

// --- Batches Command ---

const batchesHandler = Effect.fn("batchesHandler")(function* () {
  const storage = yield* StorageService;
  yield* Console.log("Batch Manifests:");
  yield* Console.log("");
  const items = yield* storage.list("batches/");
  const manifestPaths = A.filter(items, Str.endsWith("manifest.json"));
  if (manifestPaths.length === 0) {
    yield* Console.log("No batches found.");
    yield* Console.log("");
    yield* Console.log("Use 'effect-onto ingest' to create a batch.");
    return;
  }
  for (const manifestPath of manifestPaths) {
    const contentOpt = yield* storage.getOption(manifestPath);
    if (O.isSome(contentOpt)) {
      const manifest = BatchManifest.decodeOptionString(contentOpt.value);
      yield* O.match(manifest, {
        onNone: () => Console.log(`📦 ${manifestPath} (invalid manifest)`).pipe(Effect.andThen(Console.log(""))),
        onSome: (value) =>
          Console.log(`📦 ${value.batchId}`).pipe(
            Effect.andThen(Console.log(`   Documents: ${value.documents.length}`)),
            Effect.andThen(Console.log(`   Namespace: ${value.targetNamespace}`)),
            Effect.andThen(Console.log(`   Created: ${value.createdAt}`)),
            Effect.andThen(Console.log(""))
          ),
      });
    }
  }
  yield* Console.log(`Total: ${manifestPaths.length} batches`);
});

const batchesCommand = Command.make("batches", {}, () => withErrorHandler(batchesHandler())).pipe(
  Command.withDescription("List all batch manifests")
);

// --- Info Command ---

const infoHandler = Effect.fn("infoHandler")(function* () {
  const storage = yield* StorageService;
  yield* Console.log("Storage Configuration:");
  yield* Console.log("");
  const size = yield* storage.size;
  yield* Console.log(`  Total size: ${formatBytes(size)}`);
  const hasGcsMarker = yield* storage.getOption(".gcs-marker").pipe(
    Effect.map(O.isSome),
    Effect.orElseSucceed(() => false)
  );
  yield* Console.log(`  Type: ${P.isTruthy(hasGcsMarker) ? "GCS" : "Local/Memory"}`);
  yield* Console.log("");
  yield* Console.log("Top-level directories:");
  const items = yield* storage.list("");
  const dirs = MutableHashSet.empty<string>();
  for (const item of items) {
    const parts = Str.split("/")(item);
    if (parts.length > 1) {
      MutableHashSet.add(dirs, parts[0]);
    }
  }
  for (const dir of A.sort(A.fromIterable(dirs), Order.String)) {
    yield* Console.log(`  📁 ${dir}/`);
  }
});

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
};

const infoCommand = Command.make("info", {}, () => withErrorHandler(infoHandler())).pipe(
  Command.withDescription("Show storage information")
);

// =============================================================================
// Main Storage Command
// =============================================================================

/**
 * Exposes storage command for composition by callers of this module.
 *
 * **Example** (Inspect storage command)
 *
 * ```ts
 * import { storageCommand } from "@effect-ontology/Cli/Commands/Storage"
 *
 * console.log(storageCommand)
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const storageCommand = Command.make("storage").pipe(
  Command.withSubcommands([listCommand, catCommand, batchesCommand, infoCommand]),
  Command.withDescription("Browse and manage cloud storage")
);
