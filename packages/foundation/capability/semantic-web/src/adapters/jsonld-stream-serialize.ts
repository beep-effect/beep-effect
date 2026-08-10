/**
 * Local JSON-LD streaming serialize adapter backing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { NonNegativeInt } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Effect, Layer, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { JsonLdDocument } from "../jsonld.ts";
import { JsonLdDocumentService, JsonLdFromRdfRequest } from "../services/jsonld-document.ts";
import {
  JsonLdStreamSerializeError,
  JsonLdStreamSerializeResult,
  JsonLdStreamSerializeService,
} from "../services/jsonld-stream-serialize.ts";
import type { JsonLdDocumentError } from "../services/jsonld-document.ts";
import type { JsonLdStreamSerializeServiceShape } from "../services/jsonld-stream-serialize.ts";

const encodeJsonLdDocumentToJson = S.encodeEffect(S.fromJsonString(JsonLdDocument));

const decodeNonNegativeInt = (value: number): Effect.Effect<NonNegativeInt, JsonLdStreamSerializeError> =>
  S.decodeEffect(NonNegativeInt)(value).pipe(
    Effect.mapError((cause) =>
      JsonLdStreamSerializeError.make({
        reason: "serializeFailure",
        message: `Failed to decode JSON-LD stream chunk count: ${String(cause)}`,
      })
    )
  );

const chunkText = (value: string, maxChunkCharacters: O.Option<number>): ReadonlyArray<string> => {
  if (O.isNone(maxChunkCharacters)) {
    return [value];
  }

  if (maxChunkCharacters.value <= 0) {
    return [];
  }

  const chunkSize = maxChunkCharacters.value;
  return A.makeBy(Math.ceil(value.length / chunkSize), (index) =>
    pipe(value, Str.slice(index * chunkSize, (index + 1) * chunkSize))
  );
};

const mapDocumentErrorToSerializeError = (error: JsonLdDocumentError): JsonLdStreamSerializeError =>
  JsonLdStreamSerializeError.make({
    reason: "serializeFailure",
    message: error.message,
  });

/**
 * JSON-LD streaming serialize service live layer.
 *
 * **Example** (Serialize stream with fallback)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Effect, Layer } from "effect"
 * import * as S from "effect/Schema"
 * import { JsonLdDocumentServiceLive } from "@beep/semantic-web/adapters/jsonld-document"
 * import { JsonLdStreamSerializeServiceLive } from "@beep/semantic-web/adapters/jsonld-stream-serialize"
 * import {
 *   JsonLdStreamSerializeRequest,
 *   JsonLdStreamSerializeService
 * } from "@beep/semantic-web/services/jsonld-stream-serialize"
 *
 * const request = S.decodeUnknownSync(JsonLdStreamSerializeRequest)({
 *   dataset: { quads: [] },
 *   maxChunkCharacters: 256
 * })
 * const layer = JsonLdStreamSerializeServiceLive.pipe(Layer.provide(JsonLdDocumentServiceLive))
 * const result = Effect.runSync(
 *   Effect.gen(function* () {
 *     const service = yield* JsonLdStreamSerializeService
 *     return yield* service.serialize(request)
 *   }).pipe(Effect.provide(layer))
 * )
 * strictEqual(result.mode, "buffered-fallback")
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const JsonLdStreamSerializeServiceLive = Layer.effect(
  JsonLdStreamSerializeService,
  Effect.gen(function* () {
    const documentService = yield* JsonLdDocumentService;

    return JsonLdStreamSerializeService.of({
      serialize: Effect.fn(function* (request) {
        const maxChunkCharacters = request.maxChunkCharacters;
        if (O.isSome(maxChunkCharacters) && maxChunkCharacters.value <= 0) {
          return yield* JsonLdStreamSerializeError.make({
            reason: "invalidChunkSize",
            message: "maxChunkCharacters must be greater than zero when provided.",
          });
        }

        const document = yield* pipe(
          documentService.fromRdf(
            JsonLdFromRdfRequest.make({
              dataset: request.dataset,
              context: request.context,
            })
          ),
          Effect.mapError(mapDocumentErrorToSerializeError)
        );

        const documentText = yield* encodeJsonLdDocumentToJson(document.document).pipe(
          Effect.mapError((cause) =>
            JsonLdStreamSerializeError.make({
              reason: "serializeFailure",
              message: `Unable to encode bounded JSON-LD document output: ${String(cause)}`,
            })
          )
        );
        const chunks = pipe(chunkText(documentText, maxChunkCharacters), A.fromIterable);
        const nonEmptyChunks = pipe(
          chunks,
          A.filter((chunk) => chunk.length > 0)
        );

        return yield* pipe(
          nonEmptyChunks,
          A.match({
            onEmpty: () =>
              Effect.fail(
                JsonLdStreamSerializeError.make({
                  reason: "serializeFailure",
                  message: "Unable to produce JSON-LD output chunks from the bounded dataset.",
                })
              ),
            onNonEmpty: Effect.fn("JsonLdStreamSerializeService.serialize.nonEmptyChunks")(function* ([
              firstChunk,
              ...restChunks
            ]) {
              return JsonLdStreamSerializeResult.make({
                chunks: [firstChunk, ...restChunks],
                mode: "buffered-fallback",
                chunkCount: yield* decodeNonNegativeInt(nonEmptyChunks.length),
              });
            }),
          })
        );
      }),
    } satisfies JsonLdStreamSerializeServiceShape);
  })
);
