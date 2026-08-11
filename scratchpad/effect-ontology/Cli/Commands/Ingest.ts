/**
 * CLI: Ingest Command
 *
 * Upload local files to storage and generate batch manifest.
 *
 * @since 2.0.0
 * @module Cli/Commands/Ingest
 */

import { NonNegativeInt } from "@beep/schema/Int";
import * as Clock from "effect/Clock";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Random from "effect/Random";
import * as S from "effect/Schema";
import { Console, DateTime, Effect, FileSystem, Path } from "effect";
import { Argument as Args, Command, Flag as Options } from "effect/unstable/cli";
import type { ManifestDocument } from "../../Domain/Schema/Batch.ts";
import { BatchManifest } from "../../Domain/Schema/Batch.ts";
import { OntologyName } from "../../Domain/Identity.ts";
import { StorageService } from "../../Service/Storage.ts";
import { withErrorHandler } from "../ErrorHandler.ts";

// =============================================================================
// Command Options
// =============================================================================

const inputDir = Args.directory("dir").pipe(Args.withDescription("Directory containing files to ingest"));

const ontologyOption = Options.file("ontology").pipe(
  Options.withAlias("o"),
  Options.withDescription("Path to ontology file (Turtle)")
);

const namespaceOption = Options.string("namespace").pipe(
  Options.withAlias("n"),
  Options.withDescription("Target namespace for entity minting")
);

const ontologyIdOption = Options.string("ontology-id").pipe(
  Options.withDescription("Ontology registry ID (e.g., 'seattle')")
);

const outputOption = Options.file("output").pipe(
  Options.withAlias("out"),
  Options.optional,
  Options.withDescription("Output path for manifest JSON (default: stdout)")
);

const batchIdOption = Options.string("batch-id").pipe(
  Options.withAlias("b"),
  Options.optional,
  Options.withDescription("Custom batch ID (default: auto-generated)")
);

const prefixOption = Options.string("prefix").pipe(
  Options.withAlias("p"),
  Options.optional,
  Options.withDescription("Storage path prefix for uploaded files")
);

// =============================================================================
// Command Implementation
// =============================================================================

const ingestHandler = Effect.fn("ingestHandler")(function* (
  dir: string,
  ontology: string,
  ontologyId: string,
  namespace: string,
  output: O.Option<string>,
  batchId: O.Option<string>,
  prefix: O.Option<string>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const storage = yield* StorageService;
  const timestamp = (yield* Clock.currentTimeMillis).toString(36);
  const random = (yield* Random.nextIntBetween(0, 2_176_782_336)).toString(36).padStart(6, "0");
  const effectiveBatchId = O.getOrElse(batchId, () => `batch-${timestamp}-${random}`);
  const storagePrefix = O.getOrElse(prefix, () => `batches/${effectiveBatchId}`);
  yield* Console.log(`Ingesting files from: ${dir}`);
  yield* Console.log(`Batch ID: ${effectiveBatchId}`);
  const entries = yield* fs.readDirectory(dir);
  const supportedExtensions = [".txt", ".md", ".json", ".html", ".htm"];
  const files = entries.filter((entry) => supportedExtensions.some((ext) => entry.toLowerCase().endsWith(ext)));
  if (files.length === 0) {
    yield* Console.error(`No supported files found in ${dir}`);
    yield* Console.log(`Supported extensions: ${supportedExtensions.join(", ")}`);
    return;
  }
  yield* Console.log(`Found ${files.length} files to ingest`);
  const documents: Array<ManifestDocument> = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = yield* fs.stat(filePath);
    const content = yield* fs.readFileString(filePath);
    const docId = file.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
    const storageKey = `${storagePrefix}/documents/${docId}`;
    yield* storage.set(storageKey, content);
    const contentType = file.endsWith(".json")
      ? "application/json"
      : file.endsWith(".html") || file.endsWith(".htm")
        ? "text/html"
        : file.endsWith(".md")
          ? "text/markdown"
          : "text/plain";
    documents.push({
      documentId: docId as ManifestDocument["documentId"],
      sourceUri: storageKey as ManifestDocument["sourceUri"],
      contentType,
      sizeBytes: NonNegativeInt.make(Number(stat.size)),
    });
    yield* Console.log(`  Uploaded: ${file} -> ${storageKey}`);
  }
  const ontologyContent = yield* fs.readFileString(ontology);
  const ontologyFilename = path.basename(ontology);
  const ontologyKey = `${storagePrefix}/ontology/${ontologyFilename}`;
  yield* storage.set(ontologyKey, ontologyContent);
  yield* Console.log(`  Uploaded ontology: ${ontology} -> ${ontologyKey}`);
  const firstDocument = documents[0];
  if (P.isUndefined(firstDocument)) {
    return;
  }
  const manifest = BatchManifest.make({
    batchId: effectiveBatchId as BatchManifest["batchId"],
    ontologyId: OntologyName.make(ontologyId),
    ontologyUri: ontologyKey as BatchManifest["ontologyUri"],
    ontologyVersion: "1.0.0" as BatchManifest["ontologyVersion"],
    targetNamespace: namespace as BatchManifest["targetNamespace"],
    documents: [firstDocument, ...documents.slice(1)],
    createdAt: DateTime.nowUnsafe(),
  });
  const manifestJson = yield* S.encodeEffect(S.fromJsonString(BatchManifest, { space: 2 }))(manifest);
  if (O.isSome(output)) {
    yield* fs.writeFileString(output.value, manifestJson);
    yield* Console.log(`Manifest written to: ${output.value}`);
  } else {
    yield* Console.log("\nGenerated manifest:");
    yield* Console.log(manifestJson);
  }
  yield* Console.log(`\nIngestion complete: ${documents.length} documents`);
});

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
    prefix: prefixOption,
  },
  ({ batchId, dir, namespace, ontology, ontologyId, output, prefix }) =>
    withErrorHandler(ingestHandler(dir, ontology, ontologyId, namespace, output, batchId, prefix))
).pipe(Command.withDescription("Upload local files to storage and generate batch manifest"));
