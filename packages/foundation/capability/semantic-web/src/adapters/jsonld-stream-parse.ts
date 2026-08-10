/**
 * Local JSON-LD streaming parse adapter backing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { NonNegativeInt } from "@beep/schema";
import { A } from "@beep/utils";
import { Effect, Layer, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { JsonLdContext, JsonLdDocument } from "../jsonld.ts";
import { JsonLdDocumentService, JsonLdToRdfRequest } from "../services/jsonld-document.ts";
import {
  JsonLdStreamParseError,
  JsonLdStreamParseInput,
  JsonLdStreamParseResult,
  JsonLdStreamParseService,
} from "../services/jsonld-stream-parse.ts";
import type { JsonLdDocumentError, JsonLdDocumentLoaderPolicy } from "../services/jsonld-document.ts";
import type { JsonLdStreamParseServiceShape } from "../services/jsonld-stream-parse.ts";

const decodeJsonLdDocumentFromJson = S.decodeUnknownEffect(S.fromJsonString(JsonLdDocument));

const decodeNonNegativeInt = (value: number): Effect.Effect<NonNegativeInt, JsonLdStreamParseError> =>
  S.decodeUnknownEffect(NonNegativeInt)(value).pipe(
    Effect.mapError((cause) =>
      JsonLdStreamParseError.make({
        reason: "parseFailure",
        message: `Failed to decode JSON-LD stream chunk count: ${String(cause)}`,
      })
    )
  );

const decodeUtf8Chunks = (chunks: ReadonlyArray<Uint8Array>): string => {
  const decoder = new TextDecoder("utf-8");
  const streamed = pipe(
    chunks,
    A.map((chunk) => decoder.decode(chunk, { stream: true })),
    A.join("")
  );
  return `${streamed}${decoder.decode()}`;
};

const mapDocumentErrorToParseError = (error: JsonLdDocumentError): JsonLdStreamParseError =>
  JsonLdStreamParseError.make({
    reason: error.reason === "loaderPolicyViolation" ? "loaderPolicyViolation" : "parseFailure",
    message: error.message,
  });

const applyLoaderBaseIri = (
  document: JsonLdDocument,
  loaderPolicy: O.Option<JsonLdDocumentLoaderPolicy>
): JsonLdDocument =>
  pipe(
    loaderPolicy,
    O.flatMap((policy) => policy.baseIri),
    O.map((baseIri) =>
      JsonLdDocument.make({
        "@context": O.some(
          pipe(
            document["@context"],
            O.map((context) =>
              JsonLdContext.make({
                "@base": O.some(baseIri),
                "@vocab": context["@vocab"],
                terms: context.terms,
              })
            ),
            O.getOrElse(() =>
              JsonLdContext.make({
                "@base": O.some(baseIri),
                "@vocab": O.none(),
                terms: {},
              })
            )
          )
        ),
        "@graph": document["@graph"],
      })
    ),
    O.getOrElse(() => document)
  );

/**
 * JSON-LD streaming parse service live layer.
 *
 * **Example** (Parse stream with fallback)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Effect, Layer } from "effect"
 * import * as S from "effect/Schema"
 * import { JsonLdDocumentServiceLive } from "@beep/semantic-web/adapters/jsonld-document"
 * import { JsonLdStreamParseServiceLive } from "@beep/semantic-web/adapters/jsonld-stream-parse"
 * import {
 *   JsonLdStreamParseRequest,
 *   JsonLdStreamParseService
 * } from "@beep/semantic-web/services/jsonld-stream-parse"
 *
 * const request = S.decodeUnknownSync(JsonLdStreamParseRequest)({
 *   input: { kind: "text", encoding: "utf-8", chunks: ["{\"@graph\":[]}"] }
 * })
 * const layer = JsonLdStreamParseServiceLive.pipe(Layer.provide(JsonLdDocumentServiceLive))
 * const result = Effect.runSync(
 *   Effect.gen(function* () {
 *     const service = yield* JsonLdStreamParseService
 *     return yield* service.parse(request)
 *   }).pipe(Effect.provide(layer))
 * )
 * strictEqual(result.mode, "buffered-fallback")
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const JsonLdStreamParseServiceLive = Layer.effect(
  JsonLdStreamParseService,
  Effect.gen(function* () {
    const documentService = yield* JsonLdDocumentService;

    return JsonLdStreamParseService.of({
      parse: Effect.fn(function* (request) {
        if (
          pipe(
            request.loaderPolicy,
            O.exists((policy) => policy.allowRemoteDocuments)
          )
        ) {
          return yield* JsonLdStreamParseError.make({
            reason: "loaderPolicyViolation",
            message: "Remote JSON-LD document loading is outside the bounded v1 stream-parse adapter surface.",
          });
        }

        const sourceText = JsonLdStreamParseInput.match(request.input, {
          text: (input) => pipe(input.chunks, A.join("")),
          bytes: (input) => decodeUtf8Chunks(input.chunks),
        });

        const document = yield* pipe(
          decodeJsonLdDocumentFromJson(sourceText),
          Effect.mapError(() =>
            JsonLdStreamParseError.make({
              reason: "parseFailure",
              message: "Unable to decode bounded JSON-LD stream input.",
            })
          )
        );

        const dataset = yield* pipe(
          documentService.toRdf(
            JsonLdToRdfRequest.make({
              document: applyLoaderBaseIri(document, request.loaderPolicy),
            })
          ),
          Effect.mapError(mapDocumentErrorToParseError)
        );

        const chunkCount = yield* decodeNonNegativeInt(request.input.chunks.length);

        return JsonLdStreamParseResult.make({
          dataset: dataset.dataset,
          mode: "buffered-fallback",
          chunkCount,
        });
      }),
    } satisfies JsonLdStreamParseServiceShape);
  })
);
