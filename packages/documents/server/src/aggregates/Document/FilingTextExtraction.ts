/**
 * Optional extracted-text seam for document filing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DocumentContentDigest } from "@beep/documents-domain/aggregates/Document";
import { FilingTextExcerpt } from "@beep/documents-use-cases/aggregates/Document/server";
import { ProcessFileResult } from "@beep/file-processing/Extraction";
import { FileProcessingOperationError, ProcessFileOperation } from "@beep/file-processing/Operation";
import { FileProcessingService } from "@beep/file-processing/Service";
import { $DocumentsServerId } from "@beep/identity/packages";
import { A, O } from "@beep/utils";
import { Cause, Context, Effect, flow, Layer, pipe } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FilingDecisionLlmConfig } from "./FilingDecisionLlm.config.ts";

const $I = $DocumentsServerId.create("aggregates/Document/FilingTextExtraction");

/**
 * Input supplied to the optional filing text-extraction seam.
 *
 * **Example** (Construct extraction input)
 *
 * ```ts
 * import { FilingTextExtractionInput } from "@beep/documents-server/aggregates/Document"
 * import { DocumentContentDigest } from "@beep/documents-domain/aggregates/Document"
 *
 * const input = FilingTextExtractionInput.make({
 *   content: new Uint8Array([1, 2, 3]),
 *   contentDigest: DocumentContentDigest.make("abc123"),
 *   originalFileName: "complaint.pdf"
 * })
 * console.log(input.originalFileName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FilingTextExtractionInput extends S.Class<FilingTextExtractionInput>($I`FilingTextExtractionInput`)(
  {
    content: S.Uint8Array,
    contentDigest: DocumentContentDigest,
    originalFileName: S.NonEmptyString,
  },
  $I.annote("FilingTextExtractionInput", {
    description: "Input supplied to the optional filing text-extraction seam.",
  })
) {}

/**
 * Optional text extraction service shape used by document intake.
 *
 * **Example** (Stub extraction service)
 *
 * ```ts
 * import type { FilingTextExtractionShape } from "@beep/documents-server/aggregates/Document"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const service: FilingTextExtractionShape = { extract: () => Effect.succeed(O.none()) }
 * console.log(service)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface FilingTextExtractionShape {
  readonly extract: (input: FilingTextExtractionInput) => Effect.Effect<O.Option<FilingTextExcerpt>>;
}

/**
 * Optional text extraction service used before filing classification.
 *
 * **Example** (Log service key)
 *
 * ```ts
 * import { FilingTextExtraction } from "@beep/documents-server/aggregates/Document"
 *
 * console.log(FilingTextExtraction.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FilingTextExtraction extends Context.Service<FilingTextExtraction, FilingTextExtractionShape>()(
  $I`FilingTextExtraction`
) {}

/**
 * No-op extraction layer used by deterministic fixture mode.
 *
 * **Example** (Inspect noop layer)
 *
 * ```ts
 * import { FilingTextExtractionNoopLayer } from "@beep/documents-server/aggregates/Document"
 *
 * console.log(FilingTextExtractionNoopLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const FilingTextExtractionNoopLayer = Layer.succeed(
  FilingTextExtraction,
  FilingTextExtraction.of({
    extract: Effect.fn($I`extractNoop`)(function* () {
      return O.none<FilingTextExcerpt>();
    }),
  })
);

const extensionFrom: (fileName: string) => O.Option<string> = flow(
  Str.split("."),
  A.tail,
  O.flatMap(A.last),
  O.map(Str.toLowerCase)
);

const decodeProcessFileOperation = S.decodeUnknownEffect(ProcessFileOperation);
const decodeFilingTextExcerpt = S.decodeUnknownEffect(FilingTextExcerpt);

const extractedText = (result: ProcessFileResult, maxExcerptChars: number) =>
  ProcessFileResult.match(result, {
    "archive-exported": () => Effect.succeed(O.none<FilingTextExcerpt>()),
    extracted: (value) =>
      pipe(
        O.fromUndefinedOr(value.extraction.text),
        O.map(Str.takeLeft(maxExcerptChars)),
        O.filter(Str.isNonEmpty),
        O.match({
          onNone: () => Effect.succeed(O.none<FilingTextExcerpt>()),
          onSome: (text) => decodeFilingTextExcerpt(text).pipe(Effect.asSome),
        })
      ),
    skipped: () => Effect.succeed(O.none<FilingTextExcerpt>()),
  });

/**
 * Live extraction layer backed by the file-processing capability service.
 *
 * **Example** (Inspect live layer)
 *
 * ```ts
 * import { FilingTextExtractionLiveLayer } from "@beep/documents-server/aggregates/Document"
 *
 * console.log(FilingTextExtractionLiveLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const FilingTextExtractionLiveLayer = Layer.effect(
  FilingTextExtraction,
  Effect.gen(function* () {
    const config = yield* FilingDecisionLlmConfig;
    const fileProcessing = yield* FileProcessingService;

    return FilingTextExtraction.of({
      extract: Effect.fn($I`extract`)(function* (input: FilingTextExtractionInput) {
        return yield* Effect.gen(function* () {
          const extension = extensionFrom(input.originalFileName);
          if (input.content.byteLength > config.maxMaterializedBytes) {
            return yield* FileProcessingOperationError.fromReason("output-limit-exceeded", {
              message: "Document source exceeds the configured filing text extraction byte cap.",
            });
          }
          const operation = yield* decodeProcessFileOperation({
            exportChildren: false,
            maxMaterializedBytes: config.maxMaterializedBytes,
            operationId: `operation:${input.contentDigest}`,
            operationKind: "process",
            preference: { engine: "auto" },
            source: {
              // Defensive copy: an engine must never be able to detach or
              // mutate the intake bytes that are later materialized verbatim.
              bytes: new Uint8Array(input.content),
              digest: `sha256:${input.contentDigest}`,
              ...O.getSomesStruct({ extension }),
              id: `artifact:${input.contentDigest}`,
              locator: { kind: "memory", value: input.originalFileName },
              name: input.originalFileName,
              relativePath: input.originalFileName,
              sizeBytes: input.content.length,
            },
          });
          return yield* fileProcessing.process(operation).pipe(
            Effect.timeoutOrElse({
              duration: config.extractionTimeout,
              orElse: () =>
                Effect.fail(
                  FileProcessingOperationError.fromReason("operation-timed-out", {
                    artifactId: operation.source.id,
                    message: "Document filing text extraction timed out.",
                    operationId: operation.operationId,
                  })
                ),
            }),
            Effect.flatMap((result) => extractedText(result, config.maxExcerptChars))
          );
        }).pipe(
          Effect.matchCauseEffect({
            onFailure: (cause) =>
              Effect.logWarning("Document text extraction unavailable; continuing without an excerpt", {
                cause: Cause.pretty(cause),
              }).pipe(Effect.as(O.none<FilingTextExcerpt>())),
            onSuccess: Effect.succeed,
          })
        );
      }),
    });
  }).pipe(Effect.withSpan($I`make`))
);
