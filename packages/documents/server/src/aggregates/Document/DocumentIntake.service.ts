/**
 * Document intake server service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Document, DocumentContentDigest, FilingOutcome } from "@beep/documents-domain/aggregates/Document";
import {
  legalDocumentTaxonomy,
  ProjectFiledDocumentPathInput,
  ProjectInboxDocumentPathInput,
  projectFiledDocumentPath,
  projectInboxDocumentPath,
} from "@beep/documents-domain/values/Taxonomy";
import * as DocumentUseCases from "@beep/documents-use-cases/server";
import { writeFileWithinRootAtomically } from "@beep/file-processing/PathSafety";
import { $DocumentsServerId } from "@beep/identity/packages";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { Effect, FileSystem, Layer, Path, pipe } from "effect";
import * as S from "effect/Schema";
import { FilingDecisionHeuristicLayer } from "./FilingDecisionHeuristic.js";
import { FilingDecisionLlmLayer } from "./FilingDecisionLlm.js";
import {
  FilingTextExtraction,
  FilingTextExtractionInput,
  FilingTextExtractionLiveLayer,
  FilingTextExtractionNoopLayer,
} from "./FilingTextExtraction.js";

const $I = $DocumentsServerId.create("aggregates/Document/DocumentIntake.service");

const DocumentIntake = DocumentUseCases.Document.DocumentIntake;
const FilingDecision = DocumentUseCases.Document.FilingDecision;

const materializationFailed = (reason: string) =>
  DocumentUseCases.Document.DocumentMaterializationFailed.make({ reason });

const isDocumentMaterializationFailed = S.is(DocumentUseCases.Document.DocumentMaterializationFailed);

const toMaterializationFailed = (error: unknown): DocumentUseCases.Document.DocumentMaterializationFailed =>
  isDocumentMaterializationFailed(error) ? error : materializationFailed(String(error));

const contentDigest = (bytes: Uint8Array): DocumentContentDigest =>
  DocumentContentDigest.make(bytesToHex(sha256(bytes)));

const materializeAtomically = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  vaultRootPath: string,
  relativeSegments: ReadonlyArray<string>,
  bytes: Uint8Array
): Effect.Effect<string, DocumentUseCases.Document.DocumentMaterializationFailed> =>
  writeFileWithinRootAtomically({
    root: vaultRootPath,
    candidate: path.join(...relativeSegments),
    bytes,
  }).pipe(
    Effect.provideService(FileSystem.FileSystem, fs),
    Effect.provideService(Path.Path, path),
    Effect.mapError(toMaterializationFailed)
  );

/**
 * Builds the document intake service from filesystem, path, and filing-decision dependencies.
 *
 * @example
 * ```ts
 * import * as BunFileSystem from "@effect/platform-bun/BunFileSystem"
 * import * as BunPath from "@effect/platform-bun/BunPath"
 * import {
 *   FilingDecisionHeuristicLayer,
 *   makeDocumentIntake
 * } from "@beep/documents-server/aggregates/Document"
 * import { Effect, Layer } from "effect"
 *
 * const program = makeDocumentIntake().pipe(
 *   Effect.provide(
 *     Layer.mergeAll(BunFileSystem.layer, BunPath.layer, FilingDecisionHeuristicLayer)
 *   ),
 *   Effect.map((service) => typeof service.intakeDroppedFile === "function")
 * )
 *
 * Effect.runPromise(program).then(console.log) // true
 * ```
 *
 * @effects Acquires filing-decision, filesystem, and path services. Each
 * returned intake operation computes the content digest and taxonomy path,
 * then atomically materializes the bytes beneath the supplied vault root.
 * @category layers
 * @since 0.0.0
 */
export const makeDocumentIntake = Effect.fn($I`makeDocumentIntake`)(function* () {
  const filingDecision = yield* FilingDecision;
  const filingTextExtraction = yield* FilingTextExtraction;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  return DocumentIntake.of({
    intakeDroppedFile: Effect.fn($I`intakeDroppedFile`)(function* (input) {
      const digest = contentDigest(input.content);
      const textExcerpt = yield* filingTextExtraction.extract(
        FilingTextExtractionInput.make({
          content: input.content,
          contentDigest: digest,
          originalFileName: input.originalFileName,
        })
      );
      const decision = yield* filingDecision.decide(
        DocumentUseCases.Document.FilingDecisionInput.make({
          contentDigest: digest,
          originalFileName: input.originalFileName,
          textExcerpt,
        })
      );
      const vaultPath = yield* FilingOutcome.match(decision, {
        filed: (filed) =>
          projectFiledDocumentPath(
            ProjectFiledDocumentPathInput.make({
              contentDigest: digest,
              context: input.filingContext,
              originalFileName: input.originalFileName,
              taxonomy: legalDocumentTaxonomy,
              taxonomyConceptId: filed.taxonomyConceptId,
            })
          ),
        inboxed: () =>
          projectInboxDocumentPath(
            ProjectInboxDocumentPathInput.make({
              contentDigest: digest,
              intakeBatchId: input.intakeBatchId,
              originalFileName: input.originalFileName,
            })
          ),
      }).pipe(
        Effect.mapError((error) =>
          DocumentUseCases.Document.DocumentMaterializationFailed.make({ reason: error.reason })
        )
      );
      yield* materializeAtomically(fs, path, input.vaultRootPath, vaultPath.segments, input.content);
      return Document.make({
        contentDigest: digest,
        filing: decision,
        originalFileName: input.originalFileName,
        vaultPath,
      });
    }),
  });
});

/**
 * Layer providing the document intake service.
 *
 * @example
 * ```ts
 * import { DocumentIntakeLayer } from "@beep/documents-server/aggregates/Document"
 *
 * console.log(DocumentIntakeLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DocumentIntakeLayer = Layer.effect(DocumentIntake, makeDocumentIntake());

/**
 * Documents server layer with deterministic P1 filing decisions.
 *
 * @example
 * ```ts
 * import { DocumentsServerLayer } from "@beep/documents-server/aggregates/Document"
 *
 * console.log(DocumentsServerLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DocumentsServerLayer = pipe(
  DocumentIntakeLayer,
  Layer.provide(Layer.merge(FilingDecisionHeuristicLayer, FilingTextExtractionNoopLayer))
);

/**
 * Documents server layer with live LLM filing and optional file-processing extraction.
 * The app runtime supplies its Anthropic LanguageModel and file-processing driver layers.
 *
 * @example
 * ```ts
 * import { DocumentsServerLlmLayer } from "@beep/documents-server/aggregates/Document"
 *
 * console.log(DocumentsServerLlmLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DocumentsServerLlmLayer = pipe(
  DocumentIntakeLayer,
  Layer.provide(Layer.merge(FilingDecisionLlmLayer, FilingTextExtractionLiveLayer))
);
