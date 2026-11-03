/**
 * Native Python Unicode input and unverified projection maps for regex workers.
 * Preserve exact source words; display text is never a replacement for storage.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationEngineAbsoluteMaxima,
  CitationEngineLimits,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { makeCitationPythonUnicode } from "./PythonUnicode.ts";
import type { CitationPythonUnicodeFailure, CitationPythonUnicodeValue } from "./PythonUnicode.ts";

const $I = $LawPracticeServerId.create("internal/Citation/RegexInput");
const Limits = S.toType(CitationEngineLimits);
const Role = LiteralKit(["source", "pattern"]).pipe(
  $I.annoteSchema("Role", {
    description: "Captured server preparation purpose selecting the schema-owned text budget.",
  })
);
// Existing adapter-owned input is measured before copying. Effective policy
// produces the safety error even when the caller's existing value is too large.
const NativeInput = S.Struct({ width: CitationPythonUnicodeStorage.fields.width, bytes: S.Uint8Array }).pipe(
  $I.annoteSchema("NativeInput", {
    description:
      "Existing immutable adapter-owned storage, measured against effective policy before receiving allocation.",
  })
);
const RangeInput = S.Struct({ start: S.Natural, end: S.Natural }).pipe(
  $I.annoteSchema("RangeInput", {
    description: "Half-open source point offsets, including empty matches, checked against the captured input length.",
  })
);
const Reason = LiteralKit(["invalid-policy", "invalid-input", "invalid-range"]).pipe(
  $I.annoteSchema("Reason", {
    description: "Closed input/layout/projection failures without source payload or causes.",
  })
);
/** @internal @category errors @since 0.0.0 */
export class CitationRegexInputFailure extends S.TaggedError<
  CitationRegexInputFailure,
  { readonly brand: unique symbol }
>($I`CitationRegexInputFailure`)(
  "CitationRegexInputFailure",
  { reason: Reason },
  $I.annoteError<CitationRegexInputFailure>("CitationRegexInputFailure", {
    description: "Regex preparation failed without retaining text, native bytes or supplied ranges.",
  })
) {}
const Size = S.Natural.check(S.isLessThanOrEqualTo(CitationEngineAbsoluteMaxima.producedTextUtf16)).pipe(
  $I.annoteSchema("Size", { description: "Position/count within the absolute intermediate UTF-16 ceiling." })
);
/** @internal @category models @since 0.0.0 */
export class CitationRegexInputLayout extends S.Opaque<CitationRegexInputLayout, { readonly brand: unique symbol }>()(
  S.Struct({
    width: CitationPythonUnicodeStorage.fields.width,
    byteLength: S.Natural.check(S.isLessThanOrEqualTo(4 * CitationEngineAbsoluteMaxima.producedTextUtf16)),
    pythonLength: Size,
    utf16Units: Size,
    mapBytes: S.Natural.check(S.isLessThanOrEqualTo(4 * (CitationEngineAbsoluteMaxima.producedTextUtf16 + 1))),
    projectionAmbiguous: S.Boolean,
  })
    .check(
      S.makeFilter(
        (layout) =>
          layout.byteLength === layout.pythonLength * layout.width &&
          layout.mapBytes === 4 * (layout.pythonLength + 1) &&
          (layout.pythonLength !== 0 || layout.width === 1) &&
          (layout.width === 4
            ? layout.utf16Units > layout.pythonLength && layout.utf16Units <= 2 * layout.pythonLength
            : layout.utf16Units === layout.pythonLength) &&
          (!layout.projectionAmbiguous || (layout.width !== 1 && 2 * layout.pythonLength - layout.utf16Units >= 2)),
        $I.annote("NativeLayoutCoherence", {
          description: "Require exact native/map sizes and a possible canonical point/projection layout.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("CitationRegexInputLayout", {
        description: "Exact immutable-source layout before native payload, projection or point-map allocation.",
      })
    )
) {}
/** Unverified display range; document mapping and the public span adapter remain required.
 * @internal @category models @since 0.0.0
 */
export class CitationRegexProjectedRange extends S.Opaque<
  CitationRegexProjectedRange,
  { readonly brand: unique symbol }
>()(
  S.TaggedStruct("Range", { startChar: Size, endChar: Size })
    .check(
      S.makeFilter(
        (range) => range.startChar < range.endChar,
        $I.annote("ProjectedRangeOrder", {
          description: "A range is nonempty and forward ordered; empty matches use Point.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("CitationRegexProjectedRange", {
        description: "Unverified nonempty UTF-16 range in the display projection, not a mention/anchor receipt.",
      })
    )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationRegexProjectedPoint extends S.Opaque<
  CitationRegexProjectedPoint,
  { readonly brand: unique symbol }
>()(
  S.TaggedStruct("Point", { offset: Size }).pipe(
    $I.annoteSchema("CitationRegexProjectedPoint", {
      description: "Source empty match retained as point data, outside the nonempty verified-span contract.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationRegexSplitProjection extends S.Opaque<
  CitationRegexSplitProjection,
  { readonly brand: unique symbol }
>()(
  S.TaggedStruct("Split", { startChar: Size, endChar: Size })
    .check(
      S.makeFilter(
        (range) => range.startChar <= range.endChar,
        $I.annote("SplitRangeOrder", {
          description: "A split projection preserves forward source order, including an empty point.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("CitationRegexSplitProjection", {
        description:
          "A source boundary lies between adjacent literal surrogates that coalesce in the JavaScript projection.",
      })
    )
) {}
/** @internal @category models @since 0.0.0 */
export const CitationRegexProjection = S.Union([
  CitationRegexProjectedRange,
  CitationRegexProjectedPoint,
  CitationRegexSplitProjection,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("CitationRegexProjection", {
    description: "Unverified source-to-display projection; split boundaries and empty points remain explicit data.",
  })
);
/** @internal @category models @since 0.0.0 */
export type CitationRegexProjection = typeof CitationRegexProjection.Type;
/** Live immutable map closure; decoding data cannot manufacture this operation.
 * The receiving adapter must keep the owned native byte buffer immutable.
 * @internal @category services @since 0.0.0
 */
export interface CitationPreparedRegexInput {
  readonly layout: CitationRegexInputLayout;
  readonly project: (input: unknown) => Effect.Effect<CitationRegexProjection, CitationRegexInputFailure>;
  readonly value: CitationPythonUnicodeValue;
}
const fail = (reason: CitationRegexInputFailure["reason"]) => CitationRegexInputFailure.make({ reason });
const safety = (limit: CitationSafetyLimitExceeded["limit"]) =>
  CitationSafetyLimitExceeded.make({ operation: "extract", limit });
const unitsOf = (point: number) => (point > 0xffff ? 2 : 1);
const widthOf = (largest: number): 1 | 2 | 4 => (largest > 0xffff ? 4 : largest > 255 ? 2 : 1);
const readPoint = (storage: typeof NativeInput.Type, index: number) => {
  let point = 0;
  for (let part = 0; part < storage.width; part++)
    point += (storage.bytes[index * storage.width + part] ?? 0) * 2 ** (8 * part);
  return point;
};
const high = (point: number) => point >= 0xd800 && point <= 0xdbff;
const low = (point: number) => point >= 0xdc00 && point <= 0xdfff;
const boundary = (text: string, offset: number) =>
  offset === 0 || offset === Str.length(text) || O.getOrElse(Str.codePointAt(text, offset - 1), () => -1) <= 0xffff;
/** Capture policy/Clock. Borrowed native storage must remain immutable through
 * preparation, as in the HTML transport adapter. The trusted server preflight
 * receives exact sizes before any receiving payload/projection/map allocation;
 * no callable is request data. Returned operations have R = never.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationRegexInput = Effect.fn("Citation.makeRegexInput")(function* (
  policy: unknown,
  roleInput: unknown = "source"
) {
  const limits = yield* S.decodeUnknownEffect(Limits)(policy).pipe(Effect.mapError(() => fail("invalid-policy")));
  const role = yield* S.decodeUnknownEffect(Role)(roleInput).pipe(Effect.mapError(() => fail("invalid-policy")));
  const sourceMaximum = role === "pattern" ? limits.patternUtf16 : limits.sourceUtf16;
  const producedMaximum = role === "pattern" ? limits.patternUtf16 : limits.producedTextUtf16;
  const sourceLimit = role === "pattern" ? "patternUtf16" : "sourceUtf16";
  const producedLimit = role === "pattern" ? "patternUtf16" : "producedTextUtf16";
  const clock = yield* Clock.Clock;
  const deadline = Duration.min(limits.extractDeadline, limits.operationDeadline).pipe(
    Duration.toMillis,
    Duration.millis
  );
  const deadlineLimit = Duration.isLessThanOrEqualTo(limits.operationDeadline, limits.extractDeadline)
    ? "operationDeadline"
    : "extractDeadline";
  // The shared Unicode helper's timer is parameterized for this extract stage.
  const unicode = yield* makeCitationPythonUnicode({
    ...limits,
    producedTextUtf16: producedMaximum,
    cleanDeadline: deadline,
  }).pipe(Effect.mapError(() => fail("invalid-policy")));
  const finish = Effect.fn("Citation.finishRegexInput")(function* (
    value: CitationPythonUnicodeValue,
    expected: CitationRegexInputLayout
  ): Effect.fn.Return<CitationPreparedRegexInput, CitationRegexInputFailure> {
    if (
      value.pythonLength !== expected.pythonLength ||
      value.utf16Units !== expected.utf16Units ||
      value.storage.width !== expected.width
    )
      return yield* fail("invalid-input");
    const offsets = new Uint32Array(value.pythonLength + 1);
    let offset = 0;
    let previous = -1;
    let ambiguous = false;
    for (let index = 0; index < value.pythonLength; index++) {
      if (index % 4096 === 0) yield* Effect.yieldNow;
      const point = readPoint(value.storage, index);
      if (high(previous) && low(point)) ambiguous = true;
      offset += unitsOf(point);
      offsets[index + 1] = offset;
      previous = point;
    }
    if (ambiguous !== expected.projectionAmbiguous) return yield* fail("invalid-input");
    const project = Effect.fn("Citation.projectRegexOffsets")(function* (input: unknown) {
      const range = yield* S.decodeUnknownEffect(RangeInput)(input).pipe(Effect.mapError(() => fail("invalid-range")));
      if (range.end < range.start || range.end > value.pythonLength) return yield* fail("invalid-range");
      const startChar = offsets[range.start];
      const endChar = offsets[range.end];
      if (startChar === undefined || endChar === undefined) return yield* fail("invalid-range");
      if (!boundary(value.text, startChar) || !boundary(value.text, endChar))
        return CitationRegexSplitProjection.make({ startChar, endChar });
      if (startChar === endChar) return CitationRegexProjectedPoint.make({ offset: startChar });
      return CitationRegexProjectedRange.make({ startChar, endChar });
    });
    return { layout: expected, value, project };
  });
  const capture = <A>(body: Effect.Effect<A, CitationPythonUnicodeFailure>) =>
    body.pipe(
      Effect.mapError((error) =>
        error.reason === "deadline-exceeded"
          ? safety(deadlineLimit)
          : error.reason === "limit-exceeded"
            ? safety(producedLimit)
            : fail("invalid-input")
      )
    );
  const prepareText = Effect.fn("Citation.prepareRegexText")(function* <E>(
    input: unknown,
    beforeAllocate: (layout: CitationRegexInputLayout) => Effect.Effect<void, E>
  ) {
    const text = yield* S.decodeUnknownEffect(S.String)(input).pipe(Effect.mapError(() => fail("invalid-input")));
    if (Str.length(text) > sourceMaximum) return yield* safety(sourceLimit);
    if (Str.length(text) > producedMaximum) return yield* safety(producedLimit);
    let largest = 0;
    let length = 0;
    for (let index = 0; index < Str.length(text); ) {
      if (length % 4096 === 0) yield* Effect.yieldNow;
      const point = O.getOrElse(Str.codePointAt(text, index), () => 0);
      largest = Num.max(largest, point);
      index += unitsOf(point);
      length++;
    }
    const width = widthOf(largest);
    const byteLength = length * width;
    if (byteLength > limits.processMessageBytes) return yield* safety("processMessageBytes");
    const layout = CitationRegexInputLayout.make({
      width,
      byteLength,
      pythonLength: length,
      utf16Units: Str.length(text),
      mapBytes: 4 * (length + 1),
      projectionAmbiguous: false,
    });
    yield* beforeAllocate(layout);
    return yield* finish(yield* capture(unicode.fromText(text)), layout);
  });
  const prepareUnicode = Effect.fn("Citation.prepareRegexUnicode")(function* <E>(
    input: unknown,
    beforeAllocate: (layout: CitationRegexInputLayout) => Effect.Effect<void, E>
  ) {
    const source = yield* S.decodeUnknownEffect(NativeInput)(input).pipe(Effect.mapError(() => fail("invalid-input")));
    const byteLength = source.bytes.byteLength;
    if (byteLength % source.width !== 0) return yield* fail("invalid-input");
    if (byteLength > limits.processMessageBytes) return yield* safety("processMessageBytes");
    const length = byteLength / source.width;
    if (length > producedMaximum) return yield* safety(producedLimit);
    let largest = 0;
    let units = 0;
    let previous = -1;
    let ambiguous = false;
    for (let index = 0; index < length; index++) {
      if (index % 4096 === 0) yield* Effect.yieldNow;
      const point = readPoint(source, index);
      if (point > 0x10ffff) return yield* fail("invalid-input");
      if (high(previous) && low(point)) ambiguous = true;
      largest = Num.max(largest, point);
      units += unitsOf(point);
      if (units > producedMaximum) return yield* safety(producedLimit);
      previous = point;
    }
    if (source.width !== widthOf(largest)) return yield* fail("invalid-input");
    const layout = CitationRegexInputLayout.make({
      width: source.width,
      byteLength,
      pythonLength: length,
      utf16Units: units,
      mapBytes: 4 * (length + 1),
      projectionAmbiguous: ambiguous,
    });
    yield* beforeAllocate(layout);
    return yield* finish(yield* capture(unicode.fromStorage(source)), layout);
  });
  return {
    prepareText: Effect.fn("Citation.captureRegexText")(function* <E>(
      input: unknown,
      beforeAllocate: (layout: CitationRegexInputLayout) => Effect.Effect<void, E>
    ) {
      return yield* prepareText(input, beforeAllocate).pipe(
        Effect.timeoutOrElse({ duration: deadline, orElse: () => Effect.fail(safety(deadlineLimit)) }),
        Effect.provideService(Clock.Clock, clock)
      );
    }),
    prepareUnicode: Effect.fn("Citation.captureRegexUnicode")(function* <E>(
      input: unknown,
      beforeAllocate: (layout: CitationRegexInputLayout) => Effect.Effect<void, E>
    ) {
      return yield* prepareUnicode(input, beforeAllocate).pipe(
        Effect.timeoutOrElse({ duration: deadline, orElse: () => Effect.fail(safety(deadlineLimit)) }),
        Effect.provideService(Clock.Clock, clock)
      );
    }),
  };
});
