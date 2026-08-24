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
import { LiteralKit } from "@beep/schema";
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

const PretextMeasurementUnavailableErrorFields = {
  reason: PretextMeasurementUnavailableReason,
  message: S.String,
} satisfies S.Struct.Fields;
const samePretextMeasurementUnavailableErrorFields = S.toEquivalence(
  S.TaggedStruct("PretextMeasurementUnavailableError", PretextMeasurementUnavailableErrorFields)
);
const samePretextMeasurementUnavailableError = (
  self: PretextMeasurementUnavailableError,
  that: PretextMeasurementUnavailableError
): boolean => samePretextMeasurementUnavailableErrorFields(self, that);

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
export class PretextMeasurementUnavailableError extends S.TaggedError<PretextMeasurementUnavailableError>(
  $I`PretextMeasurementUnavailableError`
)(
  "PretextMeasurementUnavailableError",
  PretextMeasurementUnavailableErrorFields,
  $I.annoteClass<
    S.declare<PretextMeasurementUnavailableError>,
    readonly [S.TaggedStruct<"PretextMeasurementUnavailableError", typeof PretextMeasurementUnavailableErrorFields>]
  >("PretextMeasurementUnavailableError", {
    description: "The runtime lacks a capability the pretext capture surface requires.",
    toEquivalence: () => samePretextMeasurementUnavailableError,
  })
) {}

const PretextUnsupportedFontErrorFields = {
  font: S.String,
  message: S.String,
} satisfies S.Struct.Fields;
const samePretextUnsupportedFontErrorFields = S.toEquivalence(
  S.TaggedStruct("PretextUnsupportedFontError", PretextUnsupportedFontErrorFields)
);
const samePretextUnsupportedFontError = (
  self: PretextUnsupportedFontError,
  that: PretextUnsupportedFontError
): boolean => samePretextUnsupportedFontErrorFields(self, that);

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
export class PretextUnsupportedFontError extends S.TaggedError<PretextUnsupportedFontError>(
  $I`PretextUnsupportedFontError`
)(
  "PretextUnsupportedFontError",
  PretextUnsupportedFontErrorFields,
  $I.annoteClass<
    S.declare<PretextUnsupportedFontError>,
    readonly [S.TaggedStruct<"PretextUnsupportedFontError", typeof PretextUnsupportedFontErrorFields>]
  >("PretextUnsupportedFontError", {
    description: "The requested font is rejected for measurement accuracy.",
    toEquivalence: () => samePretextUnsupportedFontError,
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

const PretextSnapshotCodecErrorFields = {
  operation: PretextSnapshotCodecOperation,
  message: S.String,
} satisfies S.Struct.Fields;
const samePretextSnapshotCodecErrorFields = S.toEquivalence(
  S.TaggedStruct("PretextSnapshotCodecError", PretextSnapshotCodecErrorFields)
);
const samePretextSnapshotCodecError = (self: PretextSnapshotCodecError, that: PretextSnapshotCodecError): boolean =>
  samePretextSnapshotCodecErrorFields(self, that);

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
export class PretextSnapshotCodecError extends S.TaggedError<PretextSnapshotCodecError>($I`PretextSnapshotCodecError`)(
  "PretextSnapshotCodecError",
  PretextSnapshotCodecErrorFields,
  $I.annoteClass<
    S.declare<PretextSnapshotCodecError>,
    readonly [S.TaggedStruct<"PretextSnapshotCodecError", typeof PretextSnapshotCodecErrorFields>]
  >("PretextSnapshotCodecError", {
    description: "A font-metrics snapshot failed to decode or encode against the versioned contract.",
    toEquivalence: () => samePretextSnapshotCodecError,
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

const PretextMeasurementErrorFields = {
  operation: PretextMeasurementOperation,
  message: S.String,
} satisfies S.Struct.Fields;
const samePretextMeasurementErrorFields = S.toEquivalence(
  S.TaggedStruct("PretextMeasurementError", PretextMeasurementErrorFields)
);
const samePretextMeasurementError = (self: PretextMeasurementError, that: PretextMeasurementError): boolean =>
  samePretextMeasurementErrorFields(self, that);

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
export class PretextMeasurementError extends S.TaggedError<PretextMeasurementError>($I`PretextMeasurementError`)(
  "PretextMeasurementError",
  PretextMeasurementErrorFields,
  $I.annoteClass<
    S.declare<PretextMeasurementError>,
    readonly [S.TaggedStruct<"PretextMeasurementError", typeof PretextMeasurementErrorFields>]
  >("PretextMeasurementError", {
    description: "A pretext measurement operation failed.",
    toEquivalence: () => samePretextMeasurementError,
  })
) {}
