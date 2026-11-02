/**
 * Bounded HTML Unicode/byte input preparation adapted from lxml 5.1.0
 * parser.pxi, apihelpers.pxi and html/__init__.py.
 * Copyright Infrae and Ian Bicking, BSD-3-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationEngineAbsoluteMaxima,
  CitationEngineLimits,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import { citationPythonTextData } from "./PythonTextData.ts";
import type { CitationSafetyBudget } from "@beep/law-practice-use-cases/server";

const CitationEngineLimitsType = S.toType(CitationEngineLimits);
const NativeStorage = S.toType(CitationPythonUnicodeStorage);

const $I = $LawPracticeServerId.create("internal/Citation/HtmlInput");
const Encoding = LiteralKit(["UTF-8", "ISO-8859-1", "UTF-16LE", "UTF-32LE", "AUTO"]).pipe(
  $I.annoteSchema("Encoding", {
    description: "Pinned Unicode buffer encoding or native byte-stream encoding detection.",
  })
);
/**
 * Private parser input; bytes contain no implicit BOM or terminal padding.
 * Native allocation and complete process framing remain adapter obligations.
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CitationHtmlInput extends S.Opaque<CitationHtmlInput, { readonly brand: unique symbol }>()(
  S.Struct({ encoding: Encoding, bytes: S.Uint8Array, fullHtml: S.Boolean }).pipe(
    $I.annoteSchema("CitationHtmlInput", {
      description: "Bounded Unicode or byte parser payload and exact source wrapper classification.",
    })
  )
) {}
/**
 * Parser layout computed before byte allocation. Captured transport adapters
 * use it to reject a complete encoded job before materializing its payload.
 * @internal @category models @since 0.0.0
 */
export class CitationHtmlInputLayout extends S.Opaque<CitationHtmlInputLayout, { readonly brand: unique symbol }>()(
  S.Struct({
    encoding: Encoding,
    fullHtml: S.Boolean,
    byteLength: S.Natural.check(S.isLessThanOrEqualTo(4 * CitationEngineAbsoluteMaxima.producedTextUtf16)),
  }).pipe(
    $I.annoteSchema("CitationHtmlInputLayout", {
      description: "Exact native encoding, wrapper mode and payload byte count before buffer allocation.",
    })
  )
) {}
const Reason = LiteralKit(["invalid-input", "unicode-encoding-declaration"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed private request or lxml Unicode declaration rejection." })
);
/**
 * Sanitized private preparation rejection; native parsing has not started.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class CitationHtmlInputFailure extends S.TaggedError<
  CitationHtmlInputFailure,
  { readonly brand: unique symbol }
>($I`CitationHtmlInputFailure`)(
  "CitationHtmlInputFailure",
  { reason: Reason },
  $I.annoteError<CitationHtmlInputFailure>("CitationHtmlInputFailure", {
    description: "HTML preparation rejected without source text, native messages or causes.",
  })
) {}
const whitespace = HashSet.fromIterable(
  A.map(A.fromIterable(citationPythonTextData.whitespace), (char) => O.getOrElse(Str.codePointAt(char, 0), () => -1))
);
type ReadPoint = (index: number) => number;
const xmlPrefix: ReadonlyArray<number> = [60, 63, 120, 109, 108];
const encodingName: ReadonlyArray<number> = [101, 110, 99, 111, 100, 105, 110, 103];
const htmlPrefix: ReadonlyArray<number> = [60, 104, 116, 109, 108];
const doctypePrefix: ReadonlyArray<number> = [60, 33, 100, 111, 99, 116, 121, 112, 101];
const matches = (read: ReadPoint, start: number, expected: ReadonlyArray<number>, lowercase = false) => {
  for (let index = 0; index < expected.length; index++) {
    const point = read(start + index);
    if ((lowercase && point >= 65 && point <= 90 ? point + 32 : point) !== expected[index]) return false;
  }
  return true;
};
const skipSpace = Effect.fnUntraced(function* (read: ReadPoint, length: number, start: number) {
  let index = start;
  while (index < length && HashSet.has(whitespace, read(index))) {
    if (index % 4096 === 0) yield* Effect.yieldNow;
    index++;
  }
  return index;
});
// The same linear declaration detector can read legacy UTF-16 units or exact
// native Python points. No JavaScript projection is needed for native input.
const encodingAt = (read: ReadPoint, index: number) =>
  index >= 7 && HashSet.has(whitespace, read(index - 1)) && matches(read, index, encodingName);
const quote = (point: number) => point === 34 || point === 39;
const nextEncoding = Effect.fnUntraced(function* (read: ReadPoint, length: number, start: number) {
  for (let index = start; index < length; index++) {
    if (index % 4096 === 0) yield* Effect.yieldNow;
    if (read(index) === 62) return -1;
    if (encodingAt(read, index)) return index;
  }
  return -1;
});
const closesQuote = Effect.fnUntraced(function* (read: ReadPoint, length: number, start: number) {
  for (let index = start; index < length; index++) {
    if (index % 4096 === 0) yield* Effect.yieldNow;
    if (quote(read(index))) return true;
  }
  return false;
});
const hasDeclaration = Effect.fnUntraced(function* (read: ReadPoint, length: number) {
  if (!matches(read, 0, xmlPrefix)) return false;
  let start = 5;
  while (start < length) {
    const index = yield* nextEncoding(read, length, start);
    if (index < 0) return false;
    start = index + 1;
    let cursor = yield* skipSpace(read, length, index + 8);
    if (read(cursor) !== 61) continue;
    cursor = yield* skipSpace(read, length, cursor + 1);
    if (!quote(read(cursor))) continue;
    return yield* closesQuote(read, length, cursor + 1);
  }
  return false;
});
const pointUnits = (point: number) => (point > 0xffff ? 2 : 1);
const nativeWidth = (maximum: number) => (maximum <= 0xff ? 1 : maximum <= 0xffff ? 2 : 4);
const nativeEncoding = (maximum: number): typeof Encoding.Type =>
  maximum <= 0x7f ? "UTF-8" : maximum <= 0xff ? "ISO-8859-1" : maximum <= 0xffff ? "UTF-16LE" : "UTF-32LE";
const fullDocument = (read: ReadPoint, start: number) =>
  matches(read, start, htmlPrefix, true) || matches(read, start, doctypePrefix, true);
const nativeReader =
  (source: typeof NativeStorage.Type): ReadPoint =>
  (index) => {
    if (index < 0 || index >= source.bytes.byteLength / source.width) return -1;
    let point = 0;
    for (let part = 0; part < source.width; part++)
      point += O.getOrElse(O.fromUndefinedOr(source.bytes[index * source.width + part]), () => 0) * 2 ** (8 * part);
    return point;
  };
const textLayout = Effect.fnUntraced(function* (text: string) {
  let maximum = 0;
  let points = 0;
  let nextYield = 0;
  for (let index = 0; index < Str.length(text); ) {
    if (index >= nextYield) {
      yield* Effect.yieldNow;
      nextYield = index + 4096;
    }
    const point = O.getOrElse(Str.codePointAt(text, index), () => 0);
    maximum = Num.max(maximum, point);
    points++;
    index += pointUnits(point);
  }
  const width = nativeWidth(maximum);
  return { width, encoding: nativeEncoding(maximum), size: width === 4 ? points * 4 : Str.length(text) * width };
});
const encodeText = Effect.fnUntraced(function* (text: string, size: number, width: number) {
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  let nextYield = 0;
  for (let index = 0; index < Str.length(text); ) {
    if (index >= nextYield) {
      yield* Effect.yieldNow;
      nextYield = index + 4096;
    }
    const point = O.getOrElse(Str.codePointAt(text, index), () => 0);
    if (width === 1) view.setUint8(offset, point);
    else if (width === 2) view.setUint16(offset, point, true);
    else view.setUint32(offset, point, true);
    offset += width;
    index += pointUnits(point);
  }
  return bytes;
});
const byteSpace = (byte: number | undefined) => byte === 32 || (byte !== undefined && byte >= 9 && byte <= 13);
const skipByteSpace = Effect.fnUntraced(function* (source: Uint8Array) {
  let start = 0;
  while (start < source.byteLength) {
    if (start % 4096 === 0) yield* Effect.yieldNow;
    if (!byteSpace(source[start])) break;
    start++;
  }
  return start;
});
const rawText = S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.sourceUtf16));
const stageText = S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.producedTextUtf16));
const safety = (limit: CitationSafetyBudget) => CitationSafetyLimitExceeded.make({ operation: "clean", limit });
/**
 * Capture limits and Clock. Prepare owns a byte buffer, yields during each
 * unbounded scan and has R = never. No native regex or HTML parser runs here.
 * Raw prepare retains its original input/payload ceilings. Internal prepareStage
 * accepts already-owned intermediate text and calls a captured transport check
 * with exact layout before allocating its byte buffer. This callback is a server
 * capability, never request data. The enclosing worker owns total timing.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const makeCitationHtmlInput = Effect.fn("Citation.makeHtmlInput")(function* (input: unknown) {
  const limits = yield* S.decodeUnknownEffect(CitationEngineLimitsType)(input).pipe(
    Effect.mapError(() => CitationHtmlInputFailure.make({ reason: "invalid-input" }))
  );
  const clock = yield* Clock.Clock;
  const sourceCeiling = limits.sourceUtf16;
  const messageCeiling = limits.processMessageBytes;
  const deadline = limits.cleanDeadline.pipe(Duration.toMillis, Duration.millis);
  const copyTransport = Effect.fn("Citation.copyHtmlTransport")(function* (source: Uint8Array) {
    const size = source.byteLength;
    const bytes = new Uint8Array(size);
    for (let offset = 0; offset < size; offset += 4096) {
      yield* Effect.yieldNow;
      if (source.byteLength !== size) return yield* CitationHtmlInputFailure.make({ reason: "invalid-input" });
      bytes.set(source.subarray(offset, Num.min(offset + 4096, size)), offset);
    }
    return bytes;
  });
  const nativeMaximum = Effect.fn("Citation.validateNativeHtmlPoints")(function* (read: ReadPoint, length: number) {
    let largest = 0;
    let units = 0;
    for (let index = 0; index < length; index++) {
      if (index % 4096 === 0) yield* Effect.yieldNow;
      const point = read(index);
      if (point > 0x10ffff) return yield* CitationHtmlInputFailure.make({ reason: "invalid-input" });
      largest = Num.max(largest, point);
      units += pointUnits(point);
      if (units > CitationEngineAbsoluteMaxima.producedTextUtf16) return yield* safety("producedTextUtf16");
    }
    return largest;
  });
  const prepare = Effect.fn("Citation.prepareHtmlBuffer")(
    function* <E>(
      input: unknown,
      schema: typeof rawText,
      maximumInput: number,
      beforeAllocate: (layout: CitationHtmlInputLayout) => Effect.Effect<void, E>
    ) {
      const text = yield* S.decodeUnknownEffect(schema)(input).pipe(
        Effect.mapError(() => CitationHtmlInputFailure.make({ reason: "invalid-input" }))
      );
      const length = Str.length(text);
      if (length > maximumInput) return yield* safety("sourceUtf16");
      return yield* Effect.gen(function* () {
        const read = (index: number) => O.getOrElse(Str.charCodeAt(text, index), () => -1);
        if (yield* hasDeclaration(read, length))
          return yield* CitationHtmlInputFailure.make({ reason: "unicode-encoding-declaration" });
        const start = yield* skipSpace(read, length, 0);
        const fullHtml = fullDocument(read, start);
        const { width, encoding, size } = yield* textLayout(text);
        if (size > messageCeiling) return yield* safety("processMessageBytes");
        yield* beforeAllocate(CitationHtmlInputLayout.make({ encoding, fullHtml, byteLength: size }));
        const bytes = yield* encodeText(text, size, width);
        return CitationHtmlInput.make({ encoding, bytes, fullHtml });
      }).pipe(Effect.timeoutOrElse({ duration: deadline, orElse: () => Effect.fail(safety("cleanDeadline")) }));
    },
    Effect.provideService(Clock.Clock, clock)
  );
  const prepareBytes = Effect.fn("Citation.prepareHtmlBytes")(
    function* <E>(input: unknown, beforeAllocate: (layout: CitationHtmlInputLayout) => Effect.Effect<void, E>) {
      // This private port receives an immutable, adapter-owned Python byte value.
      // The snapshot owns transport memory; callers must not mutate their value
      // while preparation runs. No raw byte field is added to public requests.
      const source = yield* S.decodeUnknownEffect(S.Uint8Array)(input).pipe(
        Effect.mapError(() => CitationHtmlInputFailure.make({ reason: "invalid-input" }))
      );
      const size = source.byteLength;
      if (size > messageCeiling) return yield* safety("processMessageBytes");
      const start = yield* skipByteSpace(source);
      const read = (index: number) => O.getOrElse(O.fromUndefinedOr(source[index]), () => -1);
      const fullHtml = fullDocument(read, start);
      yield* beforeAllocate(CitationHtmlInputLayout.make({ encoding: "AUTO", fullHtml, byteLength: size }));
      const bytes = yield* copyTransport(source);
      return CitationHtmlInput.make({ encoding: "AUTO", fullHtml, bytes });
    },
    (body) =>
      body.pipe(Effect.timeoutOrElse({ duration: deadline, orElse: () => Effect.fail(safety("cleanDeadline")) })),
    Effect.provideService(Clock.Clock, clock)
  );
  const prepareUnicode = Effect.fn("Citation.prepareNativeHtmlInput")(
    function* <E>(input: unknown, beforeAllocate: (layout: CitationHtmlInputLayout) => Effect.Effect<void, E>) {
      // This private stage borrows immutable adapter-owned storage. Validation
      // and complete-frame preflight precede allocation of transport memory.
      const source = yield* S.decodeUnknownEffect(NativeStorage)(input).pipe(
        Effect.mapError(() => CitationHtmlInputFailure.make({ reason: "invalid-input" }))
      );
      const size = source.bytes.byteLength;
      if (size % source.width !== 0) return yield* CitationHtmlInputFailure.make({ reason: "invalid-input" });
      if (size > messageCeiling) return yield* safety("processMessageBytes");
      const length = size / source.width;
      const read = nativeReader(source);
      const largest = yield* nativeMaximum(read, length);
      const width = nativeWidth(largest);
      if (source.width !== width) return yield* CitationHtmlInputFailure.make({ reason: "invalid-input" });
      if (yield* hasDeclaration(read, length))
        return yield* CitationHtmlInputFailure.make({ reason: "unicode-encoding-declaration" });
      const start = yield* skipSpace(read, length, 0);
      const fullHtml = fullDocument(read, start);
      const encoding = nativeEncoding(largest);
      yield* beforeAllocate(CitationHtmlInputLayout.make({ encoding, fullHtml, byteLength: size }));
      const bytes = yield* copyTransport(source.bytes);
      return CitationHtmlInput.make({ encoding, bytes, fullHtml });
    },
    (body) =>
      body.pipe(Effect.timeoutOrElse({ duration: deadline, orElse: () => Effect.fail(safety("cleanDeadline")) })),
    Effect.provideService(Clock.Clock, clock)
  );
  return {
    prepare: Effect.fn("Citation.prepareHtmlInput")((input: unknown) =>
      prepare(input, rawText, sourceCeiling, () => Effect.void)
    ),
    prepareBytes,
    prepareUnicode,
    prepareStage: <E>(input: unknown, beforeAllocate: (layout: CitationHtmlInputLayout) => Effect.Effect<void, E>) =>
      prepare(input, stageText, CitationEngineAbsoluteMaxima.producedTextUtf16, beforeAllocate),
  };
});
