/**
 * Font-metrics capture service contract.
 *
 * The service tag and request contract are pure and browser-safe: consumers
 * program against `PretextCapture` without touching the DOM. The live layer
 * lives at `@beep/pretext/browser`; the fixture-backed test layer lives in
 * `PretextCapture.test-layer.ts` so every consumer tests DOM-free.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PretextId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { isNonNegative } from "@beep/schema/Number";
import { Context } from "effect";
import * as S from "effect/Schema";
import type * as Effect from "effect/Effect";
import type {
  PretextMeasurementError,
  PretextMeasurementUnavailableError,
  PretextUnsupportedFontError,
} from "./Pretext.errors.js";
import type { FontMetricsSnapshotV1 } from "./Pretext.models.js";

const $I = $PretextId.create("PretextCapture.service");

/**
 * Font-metrics capture request: the font, the caller-supplied line height
 * (pretext takes line height as layout input, it does not measure it), and
 * the words to measure. `sentence` is optional provenance recorded on the
 * resulting snapshot.
 *
 * @example
 * ```ts
 * import { PretextCaptureRequest } from "@beep/pretext"
 *
 * const request = PretextCaptureRequest.make({
 *   font: "16px Arial",
 *   lineHeight: 20,
 *   words: ["the", "dragon"]
 * })
 *
 * console.log(request.font)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class PretextCaptureRequest extends S.Class<PretextCaptureRequest>($I`PretextCaptureRequest`)(
  {
    font: S.String,
    lineHeight: S.Finite.check(isNonNegative),
    words: S.Array(S.String),
    sentence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PretextCaptureRequest", {
    description: "Font-metrics capture request: font, caller-supplied line height, words to measure.",
  })
) {}

/**
 * Font-metrics capture service shape.
 *
 * @example
 * ```ts
 * import type { PretextCaptureShape } from "@beep/pretext"
 *
 * const methodName = "captureFontMetrics" satisfies keyof PretextCaptureShape
 *
 * console.log(methodName)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface PretextCaptureShape {
  readonly captureFontMetrics: (
    request: PretextCaptureRequest
  ) => Effect.Effect<
    FontMetricsSnapshotV1,
    PretextMeasurementUnavailableError | PretextUnsupportedFontError | PretextMeasurementError
  >;
}

/**
 * Font-metrics capture service tag. Live capture requires a browser-grade
 * runtime (`@beep/pretext/browser`); fixture layers serve canned snapshots
 * anywhere.
 *
 * @example
 * ```ts
 * import { PretextCapture } from "@beep/pretext"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const capture = yield* PretextCapture
 *   return capture
 * })
 *
 * console.log(String(program))
 * ```
 *
 * @since 0.0.0
 * @category services
 */
export class PretextCapture extends Context.Service<PretextCapture, PretextCaptureShape>()($I`PretextCapture`) {}
