/**
 * Pretext driver typed errors.
 *
 * Centralized technical failures for the text-measurement boundary: capture
 * capability probes, font rejection, snapshot codec failures, and measurement
 * faults. No product vocabulary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PretextId } from "@beep/identity/packages";
import { LiteralKit, TaggedErrorClass } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $PretextId.create("Pretext.errors");

/**
 * Reason a runtime cannot capture font metrics.
 *
 * **Example** (Schema-decode unavailable reason)
 *
 * ```ts
 * import { PretextMeasurementUnavailableReason } from "@beep/pretext"
 * import * as S from "effect/Schema"
 *
 * const reason = S.decodeUnknownSync(PretextMeasurementUnavailableReason)("missingCanvas2d")
 *
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const PretextMeasurementUnavailableReason = LiteralKit(["missingCanvas2d", "missingIntlSegmenter"]).pipe(
  $I.annoteSchema("PretextMeasurementUnavailableReason", {
    description: "Reason a runtime cannot capture font metrics.",
  })
);

/**
 * Type for {@link PretextMeasurementUnavailableReason}.
 *
 * **Example** (Typed reason assignment)
 *
 * ```ts
 * import { PretextMeasurementUnavailableReason } from "@beep/pretext"
 *
 * const reason: PretextMeasurementUnavailableReason = "missingIntlSegmenter"
 *
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type PretextMeasurementUnavailableReason = typeof PretextMeasurementUnavailableReason.Type;

/**
 * The runtime lacks a capability the capture surface requires. Capture needs
 * `Intl.Segmenter` and a Canvas 2D context (`OffscreenCanvas` or a DOM
 * canvas); absence is this typed failure, never a crash.
 *
 * **Example** (Create unavailable measurement error)
 *
 * ```ts
 * import { PretextMeasurementUnavailableError } from "@beep/pretext"
 *
 * const error = PretextMeasurementUnavailableError.make({
 *   reason: "missingCanvas2d",
 *   message: "Text measurement requires OffscreenCanvas or a DOM canvas context."
 * })
 *
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PretextMeasurementUnavailableError extends TaggedErrorClass<PretextMeasurementUnavailableError>(
  $I`PretextMeasurementUnavailableError`
)(
  "PretextMeasurementUnavailableError",
  {
    reason: PretextMeasurementUnavailableReason,
    message: S.String,
  },
  $I.annote("PretextMeasurementUnavailableError", {
    description: "The runtime lacks a capability the pretext capture surface requires.",
  })
) {}

/**
 * The requested font is rejected for measurement accuracy. `system-ui` is the
 * canonical case: upstream pretext documents canvas/DOM divergence for it on
 * macOS, so the driver refuses to silently mis-measure.
 *
 * **Example** (Create unsupported font error)
 *
 * ```ts
 * import { PretextUnsupportedFontError } from "@beep/pretext"
 *
 * const error = PretextUnsupportedFontError.make({
 *   font: "16px system-ui",
 *   message: "system-ui cannot be measured accurately; use a concrete font family."
 * })
 *
 * console.log(error.font)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PretextUnsupportedFontError extends TaggedErrorClass<PretextUnsupportedFontError>(
  $I`PretextUnsupportedFontError`
)(
  "PretextUnsupportedFontError",
  {
    font: S.String,
    message: S.String,
  },
  $I.annote("PretextUnsupportedFontError", {
    description: "The requested font is rejected for measurement accuracy.",
  })
) {}

/**
 * Font-metrics snapshot codec operation.
 *
 * **Example** (Schema-decode codec operation)
 *
 * ```ts
 * import { PretextSnapshotCodecOperation } from "@beep/pretext"
 * import * as S from "effect/Schema"
 *
 * const operation = S.decodeUnknownSync(PretextSnapshotCodecOperation)("decode")
 *
 * console.log(operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const PretextSnapshotCodecOperation = LiteralKit(["decode", "encode"]).pipe(
  $I.annoteSchema("PretextSnapshotCodecOperation", {
    description: "Font-metrics snapshot codec operation.",
  })
);

/**
 * Type for {@link PretextSnapshotCodecOperation}.
 *
 * **Example** (Typed codec operation)
 *
 * ```ts
 * import { PretextSnapshotCodecOperation } from "@beep/pretext"
 *
 * const operation: PretextSnapshotCodecOperation = "encode"
 *
 * console.log(operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type PretextSnapshotCodecOperation = typeof PretextSnapshotCodecOperation.Type;

/**
 * A font-metrics snapshot failed to decode or encode against the versioned
 * contract.
 *
 * **Example** (Create snapshot codec error)
 *
 * ```ts
 * import { PretextSnapshotCodecError } from "@beep/pretext"
 *
 * const error = PretextSnapshotCodecError.make({
 *   operation: "decode",
 *   message: "Expected version 1, received an unversioned value."
 * })
 *
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PretextSnapshotCodecError extends TaggedErrorClass<PretextSnapshotCodecError>(
  $I`PretextSnapshotCodecError`
)(
  "PretextSnapshotCodecError",
  {
    operation: PretextSnapshotCodecOperation,
    message: S.String,
  },
  $I.annote("PretextSnapshotCodecError", {
    description: "A font-metrics snapshot failed to decode or encode against the versioned contract.",
  })
) {}

/**
 * Measurement operation that can fail.
 *
 * **Example** (Schema-decode measurement operation)
 *
 * ```ts
 * import { PretextMeasurementOperation } from "@beep/pretext"
 * import * as S from "effect/Schema"
 *
 * const operation = S.decodeUnknownSync(PretextMeasurementOperation)("measureText")
 *
 * console.log(operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const PretextMeasurementOperation = LiteralKit(["measureText", "fixtureCapture"]).pipe(
  $I.annoteSchema("PretextMeasurementOperation", {
    description: "Measurement operation that can fail.",
  })
);

/**
 * Type for {@link PretextMeasurementOperation}.
 *
 * **Example** (Typed measurement operation)
 *
 * ```ts
 * import { PretextMeasurementOperation } from "@beep/pretext"
 *
 * const operation: PretextMeasurementOperation = "fixtureCapture"
 *
 * console.log(operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type PretextMeasurementOperation = typeof PretextMeasurementOperation.Type;

/**
 * A measurement operation failed: an unmeasured word was requested from a
 * fixture, or the underlying pretext engine rejected an input.
 *
 * **Example** (Create measurement error)
 *
 * ```ts
 * import { PretextMeasurementError } from "@beep/pretext"
 *
 * const error = PretextMeasurementError.make({
 *   operation: "fixtureCapture",
 *   message: "Fixture does not carry widths for: dragon."
 * })
 *
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PretextMeasurementError extends TaggedErrorClass<PretextMeasurementError>($I`PretextMeasurementError`)(
  "PretextMeasurementError",
  {
    operation: PretextMeasurementOperation,
    message: S.String,
  },
  $I.annote("PretextMeasurementError", {
    description: "A pretext measurement operation failed.",
  })
) {}
