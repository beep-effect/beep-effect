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
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  return DocumentIntake.of({
    intakeDroppedFile: Effect.fn($I`intakeDroppedFile`)(function* (input) {
      const digest = contentDigest(input.content);
      // textExcerpt defaults to none until the doc-text extraction engine threads
      // extracted text through this seam (D8-S1).
      const decision = yield* filingDecision.decide(
        DocumentUseCases.Document.FilingDecisionInput.make({
          contentDigest: digest,
          originalFileName: input.originalFileName,
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
export const DocumentsServerLayer = pipe(DocumentIntakeLayer, Layer.provide(FilingDecisionHeuristicLayer));
