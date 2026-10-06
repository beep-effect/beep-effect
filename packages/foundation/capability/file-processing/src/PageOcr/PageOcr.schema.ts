/**
 * Page OCR request, result and engine identity schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FileProcessingId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { ArtifactId, ContentDigest, OperationId } from "../Artifact/Artifact.schema.ts";
import { PosInt } from "../internal/PosInt.ts";

const $I = $FileProcessingId.create("PageOcr");

/**
 * Runtime families a page OCR engine can belong to.
 *
 * **Details**
 *
 * `tesseract` is the CPU baseline. `llama-server` is a vision model served
 * over an OpenAI-compatible HTTP endpoint. `transformers` is a vision model
 * run in a Python process. `test` is reserved for in-memory test engines.
 *
 * **Example** (Check llama-server family option)
 *
 * ```ts
 * import { PageOcrEngineFamily } from "@beep/file-processing/PageOcr"
 *
 * console.log(PageOcrEngineFamily.is["llama-server"]("llama-server")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PageOcrEngineFamily = LiteralKit(["tesseract", "llama-server", "transformers", "test"]).pipe(
  $I.annoteSchema("PageOcrEngineFamily", {
    description: "Runtime families a page OCR engine can belong to.",
  })
);

/**
 * Type for {@link PageOcrEngineFamily}.
 *
 * **Example** (Type an engine family)
 *
 * ```ts
 * import type { PageOcrEngineFamily } from "@beep/file-processing/PageOcr"
 *
 * const family: PageOcrEngineFamily = "tesseract"
 * console.log(family) // "tesseract"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PageOcrEngineFamily = typeof PageOcrEngineFamily.Type;

/**
 * Text layouts a page OCR engine can be asked to produce.
 *
 * **Example** (Check markdown format option)
 *
 * ```ts
 * import { PageOcrTextFormat } from "@beep/file-processing/PageOcr"
 *
 * console.log(PageOcrTextFormat.is.markdown("markdown")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PageOcrTextFormat = LiteralKit(["plain-text", "markdown"]).pipe(
  $I.annoteSchema("PageOcrTextFormat", {
    description: "Text layout produced for one recognized page.",
  })
);

/**
 * Type for {@link PageOcrTextFormat}.
 *
 * **Example** (Type a text format)
 *
 * ```ts
 * import type { PageOcrTextFormat } from "@beep/file-processing/PageOcr"
 *
 * const format: PageOcrTextFormat = "plain-text"
 * console.log(format) // "plain-text"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PageOcrTextFormat = typeof PageOcrTextFormat.Type;

/**
 * Raster encodings accepted for a page image.
 *
 * **Example** (Check png media type option)
 *
 * ```ts
 * import { PageImageMediaType } from "@beep/file-processing/PageOcr"
 *
 * console.log(PageImageMediaType.is["image/png"]("image/png")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PageImageMediaType = LiteralKit(["image/png", "image/jpeg", "image/tiff"]).pipe(
  $I.annoteSchema("PageImageMediaType", {
    description: "Raster encodings accepted for a rendered page image.",
  })
);

/**
 * Type for {@link PageImageMediaType}.
 *
 * **Example** (Type a page image media type)
 *
 * ```ts
 * import type { PageImageMediaType } from "@beep/file-processing/PageOcr"
 *
 * const mediaType: PageImageMediaType = "image/png"
 * console.log(mediaType) // "image/png"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PageImageMediaType = typeof PageImageMediaType.Type;

/**
 * Machine-readable conditions an engine reports about one recognized page.
 *
 * **Details**
 *
 * Vision models fail differently from classical OCR: they can stop at the
 * token limit, loop on a phrase, or return nothing for a page that has text.
 * A caller uses these to decide whether the page text may replace an earlier
 * reading.
 *
 * **Example** (Check truncation warning option)
 *
 * ```ts
 * import { PageOcrWarning } from "@beep/file-processing/PageOcr"
 *
 * console.log(PageOcrWarning.is["output-truncated"]("output-truncated")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PageOcrWarning = LiteralKit([
  "output-truncated",
  "repetition-suspected",
  "empty-output",
  "low-confidence",
]).pipe(
  $I.annoteSchema("PageOcrWarning", {
    description: "Machine-readable condition reported for one recognized page.",
  })
);

/**
 * Type for {@link PageOcrWarning}.
 *
 * **Example** (Type a page warning)
 *
 * ```ts
 * import type { PageOcrWarning } from "@beep/file-processing/PageOcr"
 *
 * const warning: PageOcrWarning = "empty-output"
 * console.log(warning) // "empty-output"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PageOcrWarning = typeof PageOcrWarning.Type;

const NonNegativeMillis = S.Finite.check(S.isGreaterThanOrEqualTo(0));

const UnitInterval = S.Finite.check(S.isBetween({ minimum: 0, maximum: 1 }));

/**
 * Identity of the model weights an OCR engine ran.
 *
 * **Details**
 *
 * `weightsDigest` is the SHA-256 of the weights file, so two runs under the
 * same `modelId` with different quantizations or revisions stay
 * distinguishable. `projectorDigest` covers the separate vision projector
 * file that GGUF vision models ship.
 *
 * **Example** (Identify a quantized vision model)
 *
 * ```ts
 * import { ContentDigest } from "@beep/file-processing/Artifact"
 * import { PageOcrModelIdentity } from "@beep/file-processing/PageOcr"
 *
 * const model = PageOcrModelIdentity.make({
 *   modelId: "example-org/example-ocr",
 *   quantization: "Q8_0",
 *   weightsDigest: ContentDigest.make(`sha256:${"a".repeat(64)}`)
 * })
 * console.log(model.quantization) // "Q8_0"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PageOcrModelIdentity extends S.Class<PageOcrModelIdentity>($I`PageOcrModelIdentity`)(
  {
    modelId: S.NonEmptyString,
    projectorDigest: S.optionalKey(ContentDigest),
    quantization: S.optionalKey(S.NonEmptyString),
    revision: S.optionalKey(S.NonEmptyString),
    weightsDigest: ContentDigest,
  },
  $I.annote("PageOcrModelIdentity", {
    description: "Identity of the model weights a page OCR engine ran, pinned by content digest.",
  })
) {}

/**
 * Identity of the engine that produced a page text.
 *
 * **Details**
 *
 * `engineId` names one configured engine (for example a served model), and
 * `version` is the version of the runtime that executed it. `model` is absent
 * for engines without separate weights.
 *
 * **Example** (Identify the CPU baseline engine)
 *
 * ```ts
 * import { PageOcrEngineIdentity } from "@beep/file-processing/PageOcr"
 *
 * const engine = PageOcrEngineIdentity.make({
 *   engineId: "tesseract/eng",
 *   family: "tesseract",
 *   version: "5.5.3"
 * })
 * console.log(engine.family) // "tesseract"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PageOcrEngineIdentity extends S.Class<PageOcrEngineIdentity>($I`PageOcrEngineIdentity`)(
  {
    engineId: S.NonEmptyString,
    family: PageOcrEngineFamily,
    model: S.optionalKey(PageOcrModelIdentity),
    version: S.NonEmptyString,
  },
  $I.annote("PageOcrEngineIdentity", {
    description: "Identity of the engine, runtime version and model that produced a page text.",
  })
) {}

/**
 * One rendered page image handed to an OCR engine.
 *
 * **Details**
 *
 * `digest` is the SHA-256 of `bytes`. It ties a result to the exact raster
 * the engine saw, so a later re-render at another resolution is a different
 * input.
 *
 * **Example** (Describe a rendered page)
 *
 * ```ts
 * import { ContentDigest } from "@beep/file-processing/Artifact"
 * import { PageImage } from "@beep/file-processing/PageOcr"
 *
 * const image = PageImage.make({
 *   bytes: new Uint8Array([137, 80, 78, 71]),
 *   digest: ContentDigest.make(`sha256:${"b".repeat(64)}`),
 *   dpi: 300,
 *   mediaType: "image/png"
 * })
 * console.log(image.dpi) // 300
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PageImage extends S.Class<PageImage>($I`PageImage`)(
  {
    bytes: S.Uint8Array,
    digest: ContentDigest,
    dpi: S.optionalKey(PosInt),
    mediaType: PageImageMediaType,
  },
  $I.annote("PageImage", {
    description: "One rendered page image, with the digest of its bytes and its render resolution.",
  })
) {}

class PageOcrRequestBase extends S.Class<PageOcrRequestBase>($I`PageOcrRequest`)(
  {
    image: PageImage,
    languages: S.Array(S.NonEmptyString),
    maxOutputChars: S.optionalKey(PosInt),
    operationId: OperationId,
    pageCount: PosInt,
    pageNumber: PosInt,
    sourceArtifactId: ArtifactId,
    sourceDigest: ContentDigest,
    textFormat: PageOcrTextFormat,
  },
  $I.annote("PageOcrRequest", {
    description: "Request to read the text of one rendered page of a source artifact.",
  })
) {}

/**
 * Request to read the text of one page of a source artifact.
 *
 * **Details**
 *
 * `pageNumber` is one-based and must not exceed `pageCount`. A single image
 * source is a one-page document. `languages` carries ISO 639-2 codes for
 * engines that take a language hint; engines that do not may ignore it.
 *
 * **Example** (Request the first page of a two-page scan)
 *
 * ```ts
 * import { ArtifactId, ContentDigest, OperationId } from "@beep/file-processing/Artifact"
 * import { PageImage, PageOcrRequest } from "@beep/file-processing/PageOcr"
 *
 * const hex = "c".repeat(64)
 * const request = PageOcrRequest.make({
 *   image: PageImage.make({
 *     bytes: new Uint8Array([137, 80, 78, 71]),
 *     digest: ContentDigest.make(`sha256:${hex}`),
 *     mediaType: "image/png"
 *   }),
 *   languages: ["eng"],
 *   operationId: OperationId.make(`operation:${hex}`),
 *   pageCount: 2,
 *   pageNumber: 1,
 *   sourceArtifactId: ArtifactId.make(`artifact:${hex}`),
 *   sourceDigest: ContentDigest.make(`sha256:${hex}`),
 *   textFormat: "plain-text"
 * })
 * console.log(request.pageNumber) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PageOcrRequest = PageOcrRequestBase.check(
  S.makeFilter(({ pageCount, pageNumber }) => pageNumber <= pageCount, {
    identifier: $I`PageOcrRequestPageRangeCheck`,
    title: "Page OCR Request Page Range",
    description: "Checks that the one-based page number does not exceed the page count.",
    message: "Expected pageNumber to be less than or equal to pageCount.",
  })
);

/**
 * Type for {@link PageOcrRequest}.
 *
 * **Example** (Read a request page number)
 *
 * ```ts
 * import type { PageOcrRequest } from "@beep/file-processing/PageOcr"
 *
 * const pageOf = (request: PageOcrRequest): number => request.pageNumber
 * console.log(typeof pageOf) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PageOcrRequest = InstanceType<typeof PageOcrRequestBase>;

/**
 * Wall-clock cost of reading one page.
 *
 * **Example** (Record recognition time)
 *
 * ```ts
 * import { PageOcrTiming } from "@beep/file-processing/PageOcr"
 *
 * const timing = PageOcrTiming.make({ recognizeMillis: 850 })
 * console.log(timing.recognizeMillis) // 850
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PageOcrTiming extends S.Class<PageOcrTiming>($I`PageOcrTiming`)(
  {
    recognizeMillis: NonNegativeMillis,
    renderMillis: S.optionalKey(NonNegativeMillis),
  },
  $I.annote("PageOcrTiming", {
    description: "Wall-clock milliseconds spent rendering and recognizing one page.",
  })
) {}

/**
 * Text an engine read from one page, with the identity of what produced it.
 *
 * **Details**
 *
 * `confidence` is a mean in `[0, 1]` and is present only when the engine
 * reports one: Tesseract does, most vision models do not. `imageDigest`
 * repeats the request image digest so a stored result is self-describing.
 *
 * **Example** (Record a recognized page)
 *
 * ```ts
 * import { ArtifactId, ContentDigest, OperationId } from "@beep/file-processing/Artifact"
 * import { PageOcrEngineIdentity, PageOcrResult, PageOcrTiming } from "@beep/file-processing/PageOcr"
 *
 * const hex = "d".repeat(64)
 * const result = PageOcrResult.make({
 *   confidence: 0.93,
 *   engine: PageOcrEngineIdentity.make({ engineId: "tesseract/eng", family: "tesseract", version: "5.5.3" }),
 *   imageDigest: ContentDigest.make(`sha256:${hex}`),
 *   operationId: OperationId.make(`operation:${hex}`),
 *   pageNumber: 1,
 *   sourceArtifactId: ArtifactId.make(`artifact:${hex}`),
 *   sourceDigest: ContentDigest.make(`sha256:${hex}`),
 *   text: "Synthetic page text.",
 *   textFormat: "plain-text",
 *   timing: PageOcrTiming.make({ recognizeMillis: 850 }),
 *   warnings: []
 * })
 * console.log(result.engine.engineId) // "tesseract/eng"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PageOcrResult extends S.Class<PageOcrResult>($I`PageOcrResult`)(
  {
    confidence: S.optionalKey(UnitInterval),
    engine: PageOcrEngineIdentity,
    imageDigest: ContentDigest,
    operationId: OperationId,
    pageNumber: PosInt,
    sourceArtifactId: ArtifactId,
    sourceDigest: ContentDigest,
    text: S.String,
    textFormat: PageOcrTextFormat,
    timing: PageOcrTiming,
    warnings: S.Array(PageOcrWarning),
  },
  $I.annote("PageOcrResult", {
    description: "Text read from one page together with the engine identity, timing and warnings.",
  })
) {}
