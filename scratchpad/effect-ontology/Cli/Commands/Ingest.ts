/**
 * CLI: Ingest Command
 *
 * **Details**
 *
 * Upload local files to storage and generate batch manifest.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { NonNegativeInt } from "@beep/schema/Int";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Random from "effect/Random";
import * as Str from "effect/String";
import * as Argument from "effect/unstable/cli/Argument";
import * as Command from "effect/unstable/cli/Command";
import * as Flag from "effect/unstable/cli/Flag";
import {
  BatchId,
  ContentHash,
  DocumentId,
  GcsBucket,
  GcsUri,
  Namespace,
  OntologyName,
  OntologyVersion,
} from "../../Domain/Identity.ts";
import type { ManifestDocument } from "../../Domain/Schema/Batch.ts";
import { BatchManifest } from "../../Domain/Schema/Batch.ts";
import { ConfigService } from "../../Service/Config.ts";
import { StorageService } from "../../Service/Storage.ts";
import { sha256SyncFull } from "../../Utils/Hash.ts";
import { withErrorHandler } from "../ErrorHandler.ts";

// =============================================================================
// Command Options
// =============================================================================

const inputDir = Argument.directory("dir").pipe(Argument.withDescription("Directory containing files to ingest"));

const ontologyOption = Flag.file("ontology").pipe(
  Flag.withAlias("o"),
  Flag.withDescription("Path to ontology file (Turtle)")
);

const namespaceOption = Flag.string("namespace").pipe(
  Flag.withAlias("n"),
  Flag.withDescription("Target namespace for entity minting")
);

const ontologyIdOption = Flag.string("ontology-id").pipe(
  Flag.withDescription("Ontology registry ID (e.g., 'seattle')")
);

const outputOption = Flag.file("output").pipe(
  Flag.withAlias("out"),
  Flag.optional,
  Flag.withDescription("Output path for manifest JSON (default: stdout)")
);

const batchIdOption = Flag.string("batch-id").pipe(
  Flag.withAlias("b"),
  Flag.optional,
  Flag.withDescription("Custom batch ID (default: auto-generated)")
);

const prefixOption = Flag.string("prefix").pipe(
  Flag.withAlias("p"),
  Flag.optional,
  Flag.withDescription("Storage path prefix for uploaded files")
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
  const config = yield* ConfigService;
  const randomA = (yield* Random.nextIntBetween(0, 16_777_216)).toString(16).padStart(6, "0");
  const randomB = (yield* Random.nextIntBetween(0, 16_777_216)).toString(16).padStart(6, "0");
  const effectiveBatchId = yield* O.match(batchId, {
    onNone: () => Effect.succeed(BatchId.make(`batch-${randomA}${randomB}`)),
    onSome: BatchId.decodeUnknownEffect,
  });
  const bucket = yield* O.match(config.storage.bucket, {
    onNone: () => GcsBucket.decodeUnknownEffect(undefined),
    onSome: GcsBucket.decodeUnknownEffect,
  });
  const storagePrefix = O.getOrElse(prefix, () => `batches/${effectiveBatchId}`);
  yield* Console.log(`Ingesting files from: ${dir}`);
  yield* Console.log(`Batch ID: ${effectiveBatchId}`);
  const entries = yield* fs.readDirectory(dir);
  const supportedExtensions = [".txt", ".md", ".json", ".html", ".htm"];
  const files = A.filter(entries, (entry) =>
    A.some(supportedExtensions, (ext) => pipe(entry, Str.toLowerCase, Str.endsWith(ext)))
  );
  if (A.isReadonlyArrayEmpty(files)) {
    yield* Console.error(`No supported files found in ${dir}`);
    yield* Console.log(`Supported extensions: ${A.join(supportedExtensions, ", ")}`);
    return;
  }
  yield* Console.log(`Found ${files.length} files to ingest`);
  const documents: Array<ManifestDocument> = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = yield* fs.stat(filePath);
    const content = yield* fs.readFileString(filePath);
    const docId = DocumentId.fromContentHash(ContentHash.make(sha256SyncFull(content)));
    const storageKey = `${storagePrefix}/documents/${docId}`;
    yield* storage.set(storageKey, content);
    const contentType = Str.endsWith(".json")(file)
      ? "application/json"
      : Str.endsWith(".html")(file) || Str.endsWith(".htm")(file)
        ? "text/html"
        : Str.endsWith(".md")(file)
          ? "text/markdown"
          : "text/plain";
    const sourceUri = yield* GcsUri.decodeUnknownEffect(`gs://${bucket}/${storageKey}`);
    documents.push({
      documentId: docId,
      sourceUri,
      contentType,
      sizeBytes: NonNegativeInt.make(Number(stat.size)),
    });
    yield* Console.log(`  Uploaded: ${file} -> ${storageKey}`);
  }
  const ontologyContent = yield* fs.readFileString(ontology);
  const ontologyName = yield* OntologyName.decodeEffect(ontologyId);
  const targetNamespace = yield* Namespace.decodeEffect(namespace);
  const ontologyHash = ContentHash.make(sha256SyncFull(ontologyContent));
  const ontologyFilename = path.basename(ontology);
  const ontologyKey = `${storagePrefix}/ontology/${ontologyFilename}`;
  yield* storage.set(ontologyKey, ontologyContent);
  yield* Console.log(`  Uploaded ontology: ${ontology} -> ${ontologyKey}`);
  const firstDocument = documents[0];
  if (P.isUndefined(firstDocument)) {
    return;
  }
  const ontologyUri = yield* GcsUri.decodeUnknownEffect(`gs://${bucket}/${ontologyKey}`);
  const createdAt = yield* DateTime.now;
  const manifest = BatchManifest.make({
    batchId: effectiveBatchId,
    ontologyId: ontologyName,
    ontologyUri,
    ontologyVersion: OntologyVersion.fromParts(targetNamespace, ontologyName, ontologyHash),
    targetNamespace,
    documents: [firstDocument, ...A.drop(documents, 1)],
    createdAt,
  });
  const manifestJson = yield* BatchManifest.encodeEffectFromJsonStringFormatted(manifest);
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

/**
 * Exposes ingest command for composition by callers of this module.
 *
 * **Example** (Inspect ingest command)
 *
 * ```ts
 * import { ingestCommand } from "@effect-ontology/Cli/Commands/Ingest"
 *
 * console.log(ingestCommand)
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
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
