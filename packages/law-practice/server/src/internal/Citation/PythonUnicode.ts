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
    readonly fromStorageReserved: <E>(
      input: unknown,
      beforeAllocate: (units: number) => Effect.Effect<void, E>
    ) => Effect.Effect<CitationPythonUnicodeValue, E | CitationPythonUnicodeFailure>;
    readonly fromTextReserved: <E>(
      input: unknown,
      beforeAllocate: (units: number) => Effect.Effect<void, E>
    ) => Effect.Effect<CitationPythonUnicodeValue, E | CitationPythonUnicodeFailure>;
  }
>()($I`CitationPythonUnicode`) {}
const fail = (reason: typeof Reason.Type) => CitationPythonUnicodeFailure.make({ reason });
const invalidInput = () => fail("invalid-input");
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
    let point = O.getOrThrow(Str.codePointAt(text, index));
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
const writeNativePoint = (view: DataView, width: 1 | 2 | 4, index: number, point: number) => {
  const offset = index * width;
  if (width === 1) view.setUint8(offset, point);
  else if (width === 2) view.setUint16(offset, point, true);
  else view.setUint32(offset, point, true);
};
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
    writeNativePoint(view, width, index - start, point);
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

const allocateNativeOutput = Effect.fn("Citation.allocateNativeOutput")(function* <E>(
  width: 1 | 2 | 4,
  pythonLength: number,
  utf16Units: number,
  beforeAllocate: (layout: CitationPythonSliceLayout) => Effect.Effect<void, E>
) {
  const layout = CitationPythonSliceLayout.make({ width, pythonLength, utf16Units, byteLength: pythonLength * width });
  yield* beforeAllocate(layout);
  return new Uint8Array(layout.byteLength);
});
const visitKeptNativePoints = Effect.fn("Citation.visitKeptNativePoints")(function* (
  source: CitationPythonUnicodeStorage,
  keep: (point: number) => boolean,
  visit: (point: number) => void
) {
  const length = source.bytes.length / source.width;
  for (let index = 0; index < length; index++) {
    if (index % 4096 === 0) yield* Effect.yieldNow;
    const point = citationPythonPointAt(source, index);
    if (keep(point)) visit(point);
  }
});
/** Filter already owned native points with a trusted pure server predicate.
 * Two cooperative passes measure and reserve exact canonical output before its
 * allocation. The predicate is server composition, never a request field; input
 * remains immutable through both passes, as for native slicing/replacement.
 * @internal @category operations @since 0.0.0
 */
export const filterCitationPythonStorage = Effect.fn("Citation.filterNativeStorage")(function* <E>(
  source: CitationPythonUnicodeStorage,
  keep: (point: number) => boolean,
  beforeAllocate: (layout: CitationPythonSliceLayout) => Effect.Effect<void, E>
) {
  let largest = 0;
  let pythonLength = 0;
  let utf16Units = 0;
  yield* visitKeptNativePoints(source, keep, (point) => {
    pythonLength++;
    utf16Units += pointUnits(point);
    largest = Num.max(largest, point);
  });
  const width = widthOf(largest);
  const bytes = yield* allocateNativeOutput(width, pythonLength, utf16Units, beforeAllocate);
  const view = new DataView(bytes.buffer);
  let cursor = 0;
  yield* visitKeptNativePoints(source, keep, (point) => writeNativePoint(view, width, cursor++, point));
  return CitationPythonUnicodeStorage.make({ width, bytes });
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
  const bytes = yield* allocateNativeOutput(width, pythonLength, utf16Units, beforeAllocate);
  let cursor = 0;
  for (const range of ranges)
    cursor = yield* copyNativeRange(range.source, range.start, range.end, bytes, width, cursor);
  return CitationPythonUnicodeStorage.make({ width, bytes });
});

const nativeReplacementMatches = Effect.fn("Citation.nativeReplacementMatches")(function* (
  source: CitationPythonUnicodeStorage,
  needle: CitationPythonUnicodeStorage,
  start: number
) {
  const count = needle.bytes.length / needle.width;
  for (let offset = 0; offset < count; offset++) {
    if (offset % 4096 === 0) yield* Effect.yieldNow;
    if (citationPythonPointAt(source, start + offset) !== citationPythonPointAt(needle, offset)) return false;
  }
  return true;
});
const visitNativeReplacement = Effect.fn("Citation.visitNativeReplacement")(function* <E>(
  source: CitationPythonUnicodeStorage,
  needle: CitationPythonUnicodeStorage,
  replacement: CitationPythonUnicodeStorage,
  visit: (word: CitationPythonUnicodeStorage, start: number, end: number) => Effect.Effect<void, E>
) {
  const length = source.bytes.length / source.width;
  const oldLength = needle.bytes.length / needle.width;
  const newLength = replacement.bytes.length / replacement.width;
  let start = 0;
  let index = 0;
  while (index + oldLength <= length) {
    if (index % 4096 === 0) yield* Effect.yieldNow;
    const matches = yield* nativeReplacementMatches(source, needle, index);
    if (matches) {
      yield* visit(source, start, index);
      yield* visit(replacement, 0, newLength);
      start = index + oldLength;
      index += Num.max(oldLength, 1);
    } else index++;
  }
  yield* visit(source, start, length);
});
/** Replace all nonoverlapping native Python words, including empty-needle
 * insertion, without UTF-16 projection or JavaScript replacement templates.
 * Inputs are already validated immutable owned storage. Two cooperative scans
 * measure exact canonical output before reservation and allocation; no match
 * list or per-occurrence payload is retained. The caller supplies timing and
 * the receiving allocation authority, as for concatCitationPythonRanges.
 * @internal @category operations @since 0.0.0
 */
export const replaceCitationPythonStorage = Effect.fn("Citation.replaceNativeStorage")(function* <E>(
  source: CitationPythonUnicodeStorage,
  needle: CitationPythonUnicodeStorage,
  replacement: CitationPythonUnicodeStorage,
  beforeAllocate: (layout: CitationPythonSliceLayout) => Effect.Effect<void, E>
) {
  let width: 1 | 2 | 4 = 1;
  let pythonLength = 0;
  let utf16Units = 0;
  yield* visitNativeReplacement(source, needle, replacement, (word, start, end) =>
    measureCitationPythonSlice(word, start, end).pipe(
      Effect.map((size) => {
        width = width > size.width ? width : size.width;
        pythonLength += size.pythonLength;
        utf16Units += size.utf16Units;
      })
    )
  );
  const bytes = yield* allocateNativeOutput(width, pythonLength, utf16Units, beforeAllocate);
  let cursor = 0;
  yield* visitNativeReplacement(source, needle, replacement, (word, start, end) =>
    copyNativeRange(word, start, end, bytes, width, cursor).pipe(
      Effect.map((next) => {
        cursor = next;
      })
    )
  );
  return CitationPythonUnicodeStorage.make({ width, bytes });
});

/**
 * Capture the intermediate ceiling and minimum operation/clean deadline.
 * Storage input is copied before the first scan yield; output bytes belong to
 * the receiving adapter. Scans yield every 4096 source code points.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationPythonUnicode = Effect.fn("Citation.makePythonUnicode")(function* (input: unknown) {
  const limits = yield* S.decodeUnknownEffect(Limits)(input).pipe(Effect.mapError(invalidInput));
  const maximum = limits.producedTextUtf16;
  const clock = yield* Clock.Clock;
  const deadline = Duration.min(limits.cleanDeadline, limits.operationDeadline).pipe(
    Duration.toMillis,
    Duration.millis
  );
  const bounded = <A, E>(body: Effect.Effect<A, E>) =>
    body.pipe(
      Effect.timeoutOrElse({ duration: deadline, orElse: () => Effect.fail(fail("deadline-exceeded")) }),
      Effect.provideService(Clock.Clock, clock)
    );
  const decodeStorage = Effect.fn("Citation.decodeNativeUnicodeStorage")(function* (input: unknown) {
    const decoded = yield* S.decodeUnknownEffect(Storage)(input).pipe(Effect.mapError(invalidInput));
    if (decoded.bytes.length % decoded.width !== 0) return yield* fail("invalid-input");
    if (decoded.bytes.length / decoded.width > maximum) return yield* fail("limit-exceeded");
    return decoded;
  });
  const fromStorage = Effect.fn("Citation.prepareNativeUnicode")(function* (input: unknown) {
    const decoded = yield* decodeStorage(input);
    const width = decoded.width;
    const bytes = new Uint8Array(decoded.bytes);
    const units = yield* validateCitationPythonStorage(bytes, width, maximum, invalidInput, () =>
      fail("limit-exceeded")
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
    const text = yield* S.decodeUnknownEffect(Text)(input).pipe(Effect.mapError(invalidInput));
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
  // Reserved calls borrow immutable adapter-owned input through preflight.
  // The receiving copy is independently validated before success; ordinary
  // fromStorage retains its existing copy-before-scan snapshot behavior.
  const fromStorageReserved = Effect.fn("Citation.reserveNativeUnicode")(function* <E>(
    input: unknown,
    beforeAllocate: (units: number) => Effect.Effect<void, E>
  ) {
    const decoded = yield* decodeStorage(input);
    const units = yield* validateCitationPythonStorage(decoded.bytes, decoded.width, maximum, invalidInput, () =>
      fail("limit-exceeded")
    );
    yield* beforeAllocate(units);
    const value = yield* fromStorage(decoded);
    if (value.utf16Units !== units) return yield* fail("invalid-input");
    return value;
  });
  const fromTextReserved = Effect.fn("Citation.reserveJavaScriptUnicode")(function* <E>(
    input: unknown,
    beforeAllocate: (units: number) => Effect.Effect<void, E>
  ) {
    const text = yield* S.decodeUnknownEffect(Text)(input).pipe(Effect.mapError(invalidInput));
    if (Str.length(text) > maximum) return yield* fail("limit-exceeded");
    yield* beforeAllocate(Str.length(text));
    return yield* fromText(text);
  });
  return CitationPythonUnicode.of({
    fromText: Effect.fn("Citation.captureJavaScriptUnicode")((input) => bounded(fromText(input))),
    fromStorage: Effect.fn("Citation.captureNativeUnicode")((input) => bounded(fromStorage(input))),
    fromStorageReserved: Effect.fn("Citation.captureReservedNativeUnicode")(function* <E>(
      input: unknown,
      beforeAllocate: (units: number) => Effect.Effect<void, E>
    ) {
      return yield* bounded(fromStorageReserved(input, beforeAllocate));
    }),
    fromTextReserved: Effect.fn("Citation.captureReservedJavaScriptUnicode")(function* <E>(
      input: unknown,
      beforeAllocate: (units: number) => Effect.Effect<void, E>
    ) {
      return yield* bounded(fromTextReserved(input, beforeAllocate));
    }),
  });
});
