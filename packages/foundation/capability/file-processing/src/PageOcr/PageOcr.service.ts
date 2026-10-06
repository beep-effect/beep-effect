/**
 * Page OCR engine and service contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FileProcessingId } from "@beep/identity";
import { A, O } from "@beep/utils";
import { Context, Effect, Layer } from "effect";
import { PageOcrError } from "./PageOcr.errors.ts";
import type { PageOcrEngineIdentity, PageOcrRequest, PageOcrResult } from "./PageOcr.schema.ts";

const $I = $FileProcessingId.create("PageOcr");

/**
 * Contract a driver implements to expose one OCR engine.
 *
 * **Details**
 *
 * An engine reads exactly one page per call and owns its own timeout and
 * output limit. `identity` is fixed for the lifetime of the engine value: a
 * driver that swaps model weights builds a new engine.
 *
 * **Example** (Implement an in-memory engine)
 *
 * ```ts
 * import { Effect } from "effect"
 * import {
 *   PageOcrEngineIdentity,
 *   type PageOcrEngineShape,
 *   PageOcrResult,
 *   PageOcrTiming
 * } from "@beep/file-processing/PageOcr"
 *
 * const identity = PageOcrEngineIdentity.make({ engineId: "test/echo", family: "test", version: "1" })
 * const engine: PageOcrEngineShape = {
 *   identity,
 *   recognizePage: (request) =>
 *     Effect.succeed(
 *       PageOcrResult.make({
 *         engine: identity,
 *         imageDigest: request.image.digest,
 *         operationId: request.operationId,
 *         pageNumber: request.pageNumber,
 *         sourceArtifactId: request.sourceArtifactId,
 *         sourceDigest: request.sourceDigest,
 *         text: "",
 *         textFormat: request.textFormat,
 *         timing: PageOcrTiming.make({ recognizeMillis: 0 }),
 *         warnings: ["empty-output"]
 *       })
 *     )
 * }
 * console.log(engine.identity.engineId) // "test/echo"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type PageOcrEngineShape = {
  readonly identity: PageOcrEngineIdentity;
  readonly recognizePage: (request: PageOcrRequest) => Effect.Effect<PageOcrResult, PageOcrError>;
};

/**
 * Capability contract for reading pages with a named engine.
 *
 * **Example** (Describe the service shape)
 *
 * ```ts
 * import type { PageOcrServiceShape } from "@beep/file-processing/PageOcr"
 *
 * const engineCount = (service: PageOcrServiceShape): number => service.engines.length
 * console.log(typeof engineCount) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type PageOcrServiceShape = {
  readonly engines: ReadonlyArray<PageOcrEngineIdentity>;
  readonly recognizePage: (engineId: string, request: PageOcrRequest) => Effect.Effect<PageOcrResult, PageOcrError>;
};

/**
 * Service tag for the page OCR capability.
 *
 * **Example** (Require the service in a program)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { PageOcrService } from "@beep/file-processing/PageOcr"
 *
 * const program = Effect.gen(function* () {
 *   const service = yield* PageOcrService
 *   return service.engines.length
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PageOcrService extends Context.Service<PageOcrService, PageOcrServiceShape>()($I`PageOcrService`) {}

/**
 * Reads one page with the engine that has the given id.
 *
 * **Example** (Build a page read program)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { type PageOcrRequest, recognizePage } from "@beep/file-processing/PageOcr"
 *
 * const read = (request: PageOcrRequest) => recognizePage("tesseract/eng", request)
 * console.log(typeof read) // "function"
 * ```
 *
 * @category accessors
 * @since 0.0.0
 */
export const recognizePage = Effect.fn("PageOcr.recognizePage")(function* (
  engineId: string,
  request: PageOcrRequest
): Effect.fn.Return<PageOcrResult, PageOcrError, PageOcrService> {
  const service = yield* PageOcrService;
  return yield* service.recognizePage(engineId, request);
});

/**
 * Builds the page OCR service from a fixed set of engines.
 *
 * **Details**
 *
 * Routing is by exact `engineId`. An unknown id fails with
 * `engine-not-found`; the service never substitutes another engine, because
 * a stored page text must name the engine that actually produced it. When
 * two engines share an id the first one wins.
 *
 * **Example** (Provide a service with no engines)
 *
 * ```ts
 * import { Layer } from "effect"
 * import { makePageOcrServiceLayer } from "@beep/file-processing/PageOcr"
 *
 * const layer = makePageOcrServiceLayer([])
 * console.log(Layer.isLayer(layer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makePageOcrServiceLayer = (engines: ReadonlyArray<PageOcrEngineShape>): Layer.Layer<PageOcrService> =>
  Layer.succeed(
    PageOcrService,
    PageOcrService.of({
      engines: A.map(engines, (engine) => engine.identity),
      recognizePage: Effect.fn("PageOcrService.recognizePage")(function* (engineId, request) {
        const engine = A.findFirst(engines, (candidate) => candidate.identity.engineId === engineId);
        if (O.isNone(engine)) {
          return yield* PageOcrError.fromReason("engine-not-found", {
            message: `No page OCR engine is configured with id "${engineId}".`,
            operationId: request.operationId,
            pageNumber: request.pageNumber,
            sourceArtifactId: request.sourceArtifactId,
          });
        }
        return yield* engine.value.recognizePage(request);
      }),
    })
  );
