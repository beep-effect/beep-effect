/**
 * Lossless views of pinned CPython compact Unicode storage.
 * Python Software Foundation, PSF-2.0; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as MutableList from "effect/MutableList";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  CitationPythonUnicodeStorage,
  measureCitationPythonText,
  validateCitationPythonStorage,
} from "./PythonHash.ts";

const $I = $LawPracticeServerId.create("internal/Citation/PythonUnicode");
const Limits = S.toType(CitationEngineLimits);
const Storage = S.toType(CitationPythonUnicodeStorage);
const Text = S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.producedTextUtf16)).pipe(
  $I.annoteSchema("Text", { description: "Bounded JavaScript projection; native source layout remains separate." })
);
const Reason = LiteralKit(["invalid-input", "limit-exceeded", "deadline-exceeded"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed Unicode layout, size and time failures without source values." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationPythonUnicodeFailure extends S.TaggedError<
  CitationPythonUnicodeFailure,
  { readonly brand: unique symbol }
>($I`CitationPythonUnicodeFailure`)(
  "CitationPythonUnicodeFailure",
  { reason: Reason },
  $I.annoteError<CitationPythonUnicodeFailure>("CitationPythonUnicodeFailure", {
    description: "Lossless Unicode preparation failed without source text, bytes or nested causes.",
  })
) {}
/**
 * Native source code points and their possibly lossy JavaScript text projection.
 * The data is not an issued capability. Adapters must keep its bytes immutable.
 * @internal @category models @since 0.0.0
 */
export class CitationPythonUnicodeValue extends S.Opaque<
  CitationPythonUnicodeValue,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    storage: CitationPythonUnicodeStorage,
    text: Text,
    pythonLength: S.Natural,
    utf16Units: S.Natural,
  }).pipe(
    $I.annoteSchema("CitationPythonUnicodeValue", {
      description:
        "Validated canonical native layout plus display projection; projection is never the source identity.",
    })
  )
) {}
/**
 * Bounded representation preparation with captured Clock and R = never.
 * Callers retain produced-text reservation and runtime ownership obligations.
 * @internal @category services @since 0.0.0
 */
export class CitationPythonUnicode extends Context.Service<
  CitationPythonUnicode,
  {
    readonly fromText: (input: unknown) => Effect.Effect<CitationPythonUnicodeValue, CitationPythonUnicodeFailure>;
    readonly fromStorage: (input: unknown) => Effect.Effect<CitationPythonUnicodeValue, CitationPythonUnicodeFailure>;
  }
>()($I`CitationPythonUnicode`) {}
const fail = (reason: typeof Reason.Type) => CitationPythonUnicodeFailure.make({ reason });
const widthOf = (largest: number): 1 | 2 | 4 => (largest <= 255 ? 1 : largest <= 65535 ? 2 : 4);
const readPoint = (bytes: Uint8Array, index: number, width: number) => {
  let point = 0;
  for (let part = 0; part < width; part++)
    point += O.getOrElse(O.fromUndefinedOr(bytes[index + part]), () => 0) * 2 ** (8 * part);
  return point;
};
/** Read a source point from already validated, immutable native storage.
 * The caller proves an integer index within the source length; this borrowed
 * view performs no input validation or ownership transfer.
 * @internal @category operations @since 0.0.0
 */
export const citationPythonPointAt: {
  (index: number): (source: CitationPythonUnicodeStorage) => number;
  (source: CitationPythonUnicodeStorage, index: number): number;
} = dual(2, (source: CitationPythonUnicodeStorage, index: number) =>
  readPoint(source.bytes, index * source.width, source.width)
);
const pointUnits = (point: number) => (point > 65535 ? 2 : 1);
const encodeText = Effect.fnUntraced(function* (text: string, width: 1 | 2 | 4, points: number) {
  const bytes = new Uint8Array(points * width);
  let cursor = 0;
  for (let index = 0; index < Str.length(text); ) {
    if (cursor % (width * 4096) === 0) yield* Effect.yieldNow;
    let point = O.getOrElse(Str.codePointAt(text, index), () => 0);
    index += pointUnits(point);
    for (let part = 0; part < width; part++) {
      bytes[cursor++] = point & 255;
      point >>>= 8;
    }
  }
  return bytes;
});
const projectStorage = Effect.fnUntraced(function* (bytes: Uint8Array, width: 1 | 2 | 4) {
  const chunks = MutableList.make<string>();
  let chunk = "";
  for (let index = 0; index < bytes.length; index += width) {
    if (index % (width * 4096) === 0) yield* Effect.yieldNow;
    // This conversion preserves lone surrogate source points, unlike TextDecoder.
    chunk += String.fromCodePoint(readPoint(bytes, index, width));
    if (Str.length(chunk) >= 1024) {
      MutableList.append(chunks, chunk);
      chunk = "";
    }
  }
  if (Str.length(chunk) > 0) MutableList.append(chunks, chunk);
  return A.join(MutableList.takeAll(chunks), "");
});
/** @internal @category models @since 0.0.0 */
export class CitationPythonSliceLayout extends S.Opaque<CitationPythonSliceLayout, { readonly brand: unique symbol }>()(
  S.Struct({
    width: CitationPythonUnicodeStorage.fields.width,
    pythonLength: S.Natural,
    utf16Units: S.Natural,
    byteLength: S.Natural,
  }).pipe(
    $I.annoteSchema("CitationPythonSliceLayout", {
      description: "Exact receiving sizes of a validated native source substring, before payload allocation.",
    })
  )
) {}
/** Measure validated native Python-point bounds without allocating a payload.
 * The prepared source owner validates bounds before delegating here.
 * @internal @category operations @since 0.0.0
 */
export const measureCitationPythonSlice = Effect.fn("Citation.measureNativeSlice")(function* (
  source: CitationPythonUnicodeStorage,
  start: number,
  end: number
) {
  let largest = 0;
  let units = 0;
  for (let index = start; index < end; index++) {
    if (index % 4096 === 0) yield* Effect.yieldNow;
    const point = readPoint(source.bytes, index * source.width, source.width);
    largest = Num.max(largest, point);
    units += pointUnits(point);
  }
  const width = widthOf(largest);
  return CitationPythonSliceLayout.make({
    width,
    pythonLength: end - start,
    utf16Units: units,
    byteLength: (end - start) * width,
  });
});
const materializeSlice = Effect.fn("Citation.materializeNativeSlice")(function* (
  source: CitationPythonUnicodeStorage,
  start: number,
  end: number,
  layout: CitationPythonSliceLayout
) {
  const width = layout.width;
  const bytes = new Uint8Array(layout.byteLength);
  const view = new DataView(bytes.buffer);
  for (let index = start; index < end; index++) {
    if (index % 4096 === 0) yield* Effect.yieldNow;
    const point = readPoint(source.bytes, index * source.width, source.width);
    const offset = (index - start) * width;
    if (width === 1) view.setUint8(offset, point);
    else if (width === 2) view.setUint16(offset, point, true);
    else view.setUint32(offset, point, true);
  }
  return CitationPythonUnicodeStorage.make({ width, bytes });
});

/** Materialize a range already validated by its captured source owner. Native
 * storage and bounds are trusted here, never issued by decoding this layout.
 * The receiver reserves exact units/bytes before allocating the new payload.
 * @internal @category operations @since 0.0.0
 */
export const sliceCitationPythonStorage = Effect.fn("Citation.slicePythonStorage")(function* <E>(
  source: CitationPythonUnicodeStorage,
  start: number,
  end: number,
  beforeAllocate: (layout: CitationPythonSliceLayout) => Effect.Effect<void, E>
) {
  const layout = yield* measureCitationPythonSlice(source, start, end);
  yield* beforeAllocate(layout);
  return yield* materializeSlice(source, start, end, layout);
});

const copyNativeRange = Effect.fn("Citation.copyNativeRange")(function* (
  source: CitationPythonUnicodeStorage,
  start: number,
  end: number,
  bytes: Uint8Array,
  width: 1 | 2 | 4,
  offset: number
) {
  let cursor = offset;
  for (let index = start; index < end; index++) {
    if (index % 4096 === 0) yield* Effect.yieldNow;
    let point = readPoint(source.bytes, index * source.width, source.width);
    for (let part = 0; part < width; part++) {
      bytes[cursor++] = point & 255;
      point >>>= 8;
    }
  }
  return cursor;
});

/** Concatenate validated native ranges without projecting surrogate words.
 * The caller validates ranges and reserves exact receiving sizes before allocation.
 * @internal @category operations @since 0.0.0
 */
export const concatCitationPythonRanges = Effect.fn("Citation.concatNativeRanges")(function* <E>(
  ranges: ReadonlyArray<{
    readonly source: CitationPythonUnicodeStorage;
    readonly start: number;
    readonly end: number;
  }>,
  beforeAllocate: (layout: CitationPythonSliceLayout) => Effect.Effect<void, E>
) {
  const sizes = yield* Effect.forEach(ranges, (range) =>
    measureCitationPythonSlice(range.source, range.start, range.end)
  );
  const width = A.reduce(sizes, 1 as 1 | 2 | 4, (a, size) => (a > size.width ? a : size.width));
  const pythonLength = A.reduce(sizes, 0, (a, size) => a + size.pythonLength);
  const utf16Units = A.reduce(sizes, 0, (a, size) => a + size.utf16Units);
  const layout = CitationPythonSliceLayout.make({ width, pythonLength, utf16Units, byteLength: pythonLength * width });
  yield* beforeAllocate(layout);
  const bytes = new Uint8Array(layout.byteLength);
  let cursor = 0;
  for (const range of ranges)
    cursor = yield* copyNativeRange(range.source, range.start, range.end, bytes, width, cursor);
  return CitationPythonUnicodeStorage.make({ width, bytes });
});

/**
 * Capture the intermediate ceiling and minimum operation/clean deadline.
 * Storage input is copied before the first scan yield; output bytes belong to
 * the receiving adapter. Scans yield every 4096 source code points.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationPythonUnicode = Effect.fn("Citation.makePythonUnicode")(function* (input: unknown) {
  const limits = yield* S.decodeUnknownEffect(Limits)(input).pipe(Effect.mapError(() => fail("invalid-input")));
  const maximum = limits.producedTextUtf16;
  const clock = yield* Clock.Clock;
  const deadline = Duration.min(limits.cleanDeadline, limits.operationDeadline).pipe(
    Duration.toMillis,
    Duration.millis
  );
  const bounded = <A>(body: Effect.Effect<A, CitationPythonUnicodeFailure>) =>
    body.pipe(
      Effect.timeoutOrElse({ duration: deadline, orElse: () => Effect.fail(fail("deadline-exceeded")) }),
      Effect.provideService(Clock.Clock, clock)
    );
  const fromStorage = Effect.fn("Citation.prepareNativeUnicode")(function* (input: unknown) {
    const decoded = yield* S.decodeUnknownEffect(Storage)(input).pipe(Effect.mapError(() => fail("invalid-input")));
    const width = decoded.width;
    if (decoded.bytes.length % width !== 0) return yield* fail("invalid-input");
    if (decoded.bytes.length / width > maximum) return yield* fail("limit-exceeded");
    const bytes = new Uint8Array(decoded.bytes);
    const units = yield* validateCitationPythonStorage(
      bytes,
      width,
      maximum,
      () => fail("invalid-input"),
      () => fail("limit-exceeded")
    );
    const text = yield* projectStorage(bytes, width);
    return CitationPythonUnicodeValue.make({
      storage: CitationPythonUnicodeStorage.make({ width, bytes }),
      text,
      pythonLength: bytes.length / width,
      utf16Units: units,
    });
  });
  const fromText = Effect.fn("Citation.prepareJavaScriptUnicode")(function* (input: unknown) {
    const text = yield* S.decodeUnknownEffect(Text)(input).pipe(Effect.mapError(() => fail("invalid-input")));
    const units = Str.length(text);
    if (units > maximum) return yield* fail("limit-exceeded");
    const [largest, points] = yield* measureCitationPythonText(text);
    const width = widthOf(largest);
    const bytes = yield* encodeText(text, width, points);
    return CitationPythonUnicodeValue.make({
      storage: CitationPythonUnicodeStorage.make({ width, bytes }),
      text,
      pythonLength: points,
      utf16Units: units,
    });
  });
  return CitationPythonUnicode.of({
    fromText: Effect.fn("Citation.captureJavaScriptUnicode")((input) => bounded(fromText(input))),
    fromStorage: Effect.fn("Citation.captureNativeUnicode")((input) => bounded(fromStorage(input))),
  });
});
