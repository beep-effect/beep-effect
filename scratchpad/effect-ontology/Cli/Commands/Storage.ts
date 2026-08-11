/**
 * CLI: Storage Command
 *
 * Browse and manage data in cloud storage (GCS) or local storage.
 *
 * @since 2.0.0
 * @module Cli/Commands/Storage
 */

import { Argument as Args, Command, Flag as Options } from "effect/unstable/cli"
import { Console, Effect, Option, Schema } from "effect"
import { BatchManifest } from "../../Domain/Schema/Batch.ts"
import { StorageService } from "../../Service/Storage.ts"
import { withErrorHandler } from "../ErrorHandler.ts"

// =============================================================================
// Subcommands
// =============================================================================

// --- List Command ---

const listPrefix = Args.string("prefix").pipe(
  Args.optional,
  Args.withDescription("Path prefix to list (default: root)")
)

const listHandler = (prefix: Option.Option<string>) =>
  Effect.gen(function*() {
    const storage = yield* StorageService
    const effectivePrefix = Option.getOrElse(prefix, () => "")

    yield* Console.log(`Listing: ${effectivePrefix || "(root)"}`)
    yield* Console.log("")

    const items = yield* storage.list(effectivePrefix)

    if (items.length === 0) {
      yield* Console.log("(empty)")
      return
    }

    // Group by directory
    const dirs = new Set<string>()
    const files: Array<string> = []

    for (const item of items) {
      const relativePath = effectivePrefix
        ? item.replace(effectivePrefix, "").replace(/^\//, "")
        : item

      const parts = relativePath.split("/")
      if (parts.length > 1) {
        dirs.add(parts[0] + "/")
      } else {
        files.push(item)
      }
    }

    // Print directories first
    for (const dir of Array.from(dirs).sort()) {
      yield* Console.log(`  📁 ${dir}`)
    }

    // Then files
    for (const file of files.sort()) {
      const name = file.split("/").pop() ?? file
      yield* Console.log(`  📄 ${name}`)
    }

    yield* Console.log("")
    yield* Console.log(`Total: ${dirs.size} directories, ${files.length} files`)
  })

const listCommand = Command.make(
  "ls",
  { prefix: listPrefix },
  ({ prefix }) => withErrorHandler(listHandler(prefix))
).pipe(Command.withDescription("List objects in storage"))

// --- Cat Command ---

const catPath = Args.string("path").pipe(
  Args.withDescription("Path to the object to read")
)

const catLinesOption = Options.integer("lines").pipe(
  Options.withAlias("n"),
  Options.withDefault(0),
  Options.withDescription("Limit output to N lines (0 = all)")
)

const catHandler = (path: string, lines: number) =>
  Effect.gen(function*() {
    const storage = yield* StorageService

    const contentOpt = yield* storage.get(path)

    if ((contentOpt === undefined)) {
      yield* Console.error(`Not found: ${path}`)
      return
    }

    let content = contentOpt

    if (lines > 0) {
      content = content.split("\n").slice(0, lines).join("\n")
    }

    yield* Console.log(content)
  })

const catCommand = Command.make(
  "cat",
  { path: catPath, lines: catLinesOption },
  ({ lines, path }) => withErrorHandler(catHandler(path, lines))
).pipe(Command.withDescription("Display contents of an object"))

// --- Batches Command ---

const batchesHandler = () =>
  Effect.gen(function*() {
    const storage = yield* StorageService

    yield* Console.log("Batch Manifests:")
    yield* Console.log("")

    const items = yield* storage.list("batches/")

    // Find manifest files
    const manifestPaths = items.filter((item) => item.endsWith("manifest.json"))

    if (manifestPaths.length === 0) {
      yield* Console.log("No batches found.")
      yield* Console.log("")
      yield* Console.log("Use 'effect-onto ingest' to create a batch.")
      return
    }

    for (const manifestPath of manifestPaths) {
      const contentOpt = yield* storage.get(manifestPath)

      if ((contentOpt !== undefined)) {
        try {
          const manifest = Schema.decodeSync(BatchManifest)(JSON.parse(contentOpt))

          yield* Console.log(`📦 ${manifest.batchId}`)
          yield* Console.log(`   Documents: ${manifest.documents.length}`)
          yield* Console.log(`   Namespace: ${manifest.targetNamespace}`)
          yield* Console.log(`   Created: ${manifest.createdAt}`)
          yield* Console.log("")
        } catch {
          yield* Console.log(`📦 ${manifestPath} (invalid manifest)`)
          yield* Console.log("")
        }
      }
    }

    yield* Console.log(`Total: ${manifestPaths.length} batches`)
  })

const batchesCommand = Command.make(
  "batches",
  {},
  () => withErrorHandler(batchesHandler())
).pipe(Command.withDescription("List all batch manifests"))

// --- Info Command ---

const infoHandler = () =>
  Effect.gen(function*() {
    const storage = yield* StorageService

    yield* Console.log("Storage Configuration:")
    yield* Console.log("")

    // Get storage size
    const size = yield* storage.size

    yield* Console.log(`  Total size: ${formatBytes(size)}`)

    // Try to detect storage type by checking for known paths
    const hasGcsMarker = yield* storage.get(".gcs-marker").pipe(
      Effect.map(Option.isSome),
      Effect.catch(() => Effect.succeed(false))
    )

    yield* Console.log(`  Type: ${hasGcsMarker ? "GCS" : "Local/Memory"}`)
    yield* Console.log("")

    // Show top-level directories
    yield* Console.log("Top-level directories:")
    const items = yield* storage.list("")
    const dirs = new Set<string>()

    for (const item of items) {
      const parts = item.split("/")
      if (parts.length > 1) {
        dirs.add(parts[0])
      }
    }

    for (const dir of Array.from(dirs).sort()) {
      yield* Console.log(`  📁 ${dir}/`)
    }
  })

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

const infoCommand = Command.make(
  "info",
  {},
  () => withErrorHandler(infoHandler())
).pipe(Command.withDescription("Show storage information"))

// =============================================================================
// Main Storage Command
// =============================================================================

export const storageCommand = Command.make("storage").pipe(
  Command.withSubcommands([listCommand, catCommand, batchesCommand, infoCommand]),
  Command.withDescription("Browse and manage cloud storage")
)
