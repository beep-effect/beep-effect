/**
 * CLI: Ingest Command
 *
 * Upload local files to storage and generate batch manifest.
 *
 * @since 2.0.0
 * @module Cli/Commands/Ingest
 */

import { Argument as Args, Command, Flag as Options } from "effect/unstable/cli"
import { FileSystem, Path } from "effect"
import { Console, DateTime, Effect, Option, Schema } from "effect"
import type { ManifestDocument } from "../../Domain/Schema/Batch.ts"
import { BatchManifest } from "../../Domain/Schema/Batch.ts"
import { StorageService } from "../../Service/Storage.ts"
import { withErrorHandler } from "../ErrorHandler.ts"
import { NonNegativeInt } from "@beep/schema/Int";

// =============================================================================
// Command Options
// =============================================================================

const inputDir = Args.directory("dir").pipe(
  Args.withDescription("Directory containing files to ingest")
)

const ontologyOption = Options.file("ontology").pipe(
  Options.withAlias("o"),
  Options.withDescription("Path to ontology file (Turtle)")
)

const namespaceOption = Options.string("namespace").pipe(
  Options.withAlias("n"),
  Options.withDescription("Target namespace for entity minting")
)

const ontologyIdOption = Options.string("ontology-id").pipe(
  Options.withDescription("Ontology registry ID (e.g., 'seattle')")
)

const outputOption = Options.file("output").pipe(
  Options.withAlias("out"),
  Options.optional,
  Options.withDescription("Output path for manifest JSON (default: stdout)")
)

const batchIdOption = Options.string("batch-id").pipe(
  Options.withAlias("b"),
  Options.optional,
  Options.withDescription("Custom batch ID (default: auto-generated)")
)

const prefixOption = Options.string("prefix").pipe(
  Options.withAlias("p"),
  Options.optional,
  Options.withDescription("Storage path prefix for uploaded files")
)

// =============================================================================
// Command Implementation
// =============================================================================

const ingestHandler = (
  dir: string,
  ontology: string,
  ontologyId: string,
  namespace: string,
  output: Option.Option<string>,
  batchId: Option.Option<string>,
  prefix: Option.Option<string>
) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const storage = yield* StorageService

    // Generate batch ID
    const effectiveBatchId = Option.getOrElse(batchId, () => {
      const timestamp = Date.now().toString(36)
      const random = Math.random().toString(36).substring(2, 8)
      return `batch-${timestamp}-${random}`
    })

    const storagePrefix = Option.getOrElse(prefix, () => `batches/${effectiveBatchId}`)

    yield* Console.log(`Ingesting files from: ${dir}`)
    yield* Console.log(`Batch ID: ${effectiveBatchId}`)

    // Read directory contents
    const entries = yield* fs.readDirectory(dir)

    // Filter to supported file types
    const supportedExtensions = [".txt", ".md", ".json", ".html", ".htm"]
    const files = entries.filter((entry) => supportedExtensions.some((ext) => entry.toLowerCase().endsWith(ext)))

    if (files.length === 0) {
      yield* Console.error(`No supported files found in ${dir}`)
      yield* Console.log(`Supported extensions: ${supportedExtensions.join(", ")}`)
      return
    }

    yield* Console.log(`Found ${files.length} files to ingest`)

    // Upload files and collect document info
    const documents: Array<ManifestDocument> = []

    for (const file of files) {
      const filePath = path.join(dir, file)
      const stat = yield* fs.stat(filePath)
      const content = yield* fs.readFileString(filePath)

      // Generate document ID
      const docId = file.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase()
      const storageKey = `${storagePrefix}/documents/${docId}`

      // Upload to storage
      yield* storage.set(storageKey, content)

      // Determine content type
      const contentType = file.endsWith(".json")
        ? "application/json"
        : file.endsWith(".html") || file.endsWith(".htm")
        ? "text/html"
        : file.endsWith(".md")
        ? "text/markdown"
        : "text/plain"

      documents.push({
        documentId: docId as ManifestDocument["documentId"],
        sourceUri: storageKey as ManifestDocument["sourceUri"],
        contentType,
        sizeBytes: NonNegativeInt.make(Number(stat.size))
      })

      yield* Console.log(`  Uploaded: ${file} -> ${storageKey}`)
    }

    // Upload ontology
    const ontologyContent = yield* fs.readFileString(ontology)
    const ontologyFilename = path.basename(ontology)
    const ontologyKey = `${storagePrefix}/ontology/${ontologyFilename}`
    yield* storage.set(ontologyKey, ontologyContent)
    yield* Console.log(`  Uploaded ontology: ${ontology} -> ${ontologyKey}`)

    // Build manifest
    const manifest: BatchManifest = {
      batchId: effectiveBatchId as BatchManifest["batchId"],
      ontologyId,
      ontologyUri: ontologyKey as BatchManifest["ontologyUri"],
      ontologyVersion: "1.0.0" as BatchManifest["ontologyVersion"],
      targetNamespace: namespace as BatchManifest["targetNamespace"],
      documents,
      createdAt: DateTime.nowUnsafe()
    }

    const manifestJson = JSON.stringify(Schema.encodeSync(BatchManifest)(manifest), null, 2)

    // Write manifest
    if (Option.isSome(output)) {
      yield* fs.writeFileString(output.value, manifestJson)
      yield* Console.log(`Manifest written to: ${output.value}`)
    } else {
      yield* Console.log("\nGenerated manifest:")
      yield* Console.log(manifestJson)
    }

    yield* Console.log(`\nIngestion complete: ${documents.length} documents`)
  })

// =============================================================================
// Command Definition
// =============================================================================

export const ingestCommand = Command.make(
  "ingest",
  {
    dir: inputDir,
    ontology: ontologyOption,
    ontologyId: ontologyIdOption,
    namespace: namespaceOption,
    output: outputOption,
    batchId: batchIdOption,
    prefix: prefixOption
  },
  ({ batchId, dir, namespace, ontology, ontologyId, output, prefix }) =>
    withErrorHandler(
      ingestHandler(dir, ontology, ontologyId, namespace, output, batchId, prefix)
    )
).pipe(
  Command.withDescription("Upload local files to storage and generate batch manifest")
)
