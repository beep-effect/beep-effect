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
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { citationPythonTextData } from "./PythonTextData.ts";

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
const whitespace = HashSet.fromIterable(citationPythonTextData.whitespace);
const at = (text: string, index: number) => O.getOrElse(Str.charAt(text, index), () => "");
const space = (text: string, index: number) => HashSet.has(whitespace, at(text, index));
const skipSpace = Effect.fnUntraced(function* (text: string, start: number) {
  let index = start;
  while (space(text, index)) {
    if (index % 4096 === 0) yield* Effect.yieldNow;
    index++;
  }
  return index;
});
// Linear equivalent of lxml's anchored Unicode declaration detector. Its
// quote classes accept either closing quote, and [^>]+ requires one prefix
// character before the whitespace immediately preceding "encoding".
const hasDeclaration = Effect.fnUntraced(function* (text: string) {
  if (!Str.startsWith("<?xml")(text)) return false;
  const length = Str.length(text);
  for (let index = 5; index < length; index++) {
    if (index % 4096 === 0) yield* Effect.yieldNow;
    if (at(text, index) === ">") return false;
    if (index < 7 || !space(text, index - 1) || Str.slice(index, index + 8)(text) !== "encoding") continue;
    let cursor = yield* skipSpace(text, index + 8);
    if (at(text, cursor) !== "=") continue;
    cursor = yield* skipSpace(text, cursor + 1);
    if (at(text, cursor) !== '"' && at(text, cursor) !== "'") continue;
    for (cursor++; cursor < length; cursor++) {
      if (cursor % 4096 === 0) yield* Effect.yieldNow;
      if (at(text, cursor) === '"' || at(text, cursor) === "'") return true;
    }
    return false;
  }
  return false;
});
const rawText = S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.sourceUtf16));
const stageText = S.String.check(S.isMaxLength(CitationEngineAbsoluteMaxima.producedTextUtf16));
const safety = (limit: CitationSafetyLimitExceeded["limit"]) =>
  CitationSafetyLimitExceeded.make({ operation: "clean", limit });
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
  const limits = yield* S.decodeUnknownEffect(S.toType(CitationEngineLimits))(input).pipe(
    Effect.mapError(() => CitationHtmlInputFailure.make({ reason: "invalid-input" }))
  );
  const clock = yield* Clock.Clock;
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
        if (yield* hasDeclaration(text))
          return yield* CitationHtmlInputFailure.make({ reason: "unicode-encoding-declaration" });
        const start = yield* skipSpace(text, 0);
        const prefix = Str.toLowerCase(Str.slice(start, start + 9)(text));
        const fullHtml = Str.startsWith("<html")(prefix) || Str.startsWith("<!doctype")(prefix);
        let maximum = 0;
        let points = 0;
        let nextYield = 0;
        for (let index = 0; index < length; ) {
          if (index >= nextYield) {
            yield* Effect.yieldNow;
            nextYield = index + 4096;
          }
          const point = O.getOrElse(Str.codePointAt(text, index), () => 0);
          if (point > maximum) maximum = point;
          points++;
          index += point > 0xffff ? 2 : 1;
        }
        const encoding =
          maximum <= 0x7f ? "UTF-8" : maximum <= 0xff ? "ISO-8859-1" : maximum <= 0xffff ? "UTF-16LE" : "UTF-32LE";
        const width = maximum <= 0xff ? 1 : maximum <= 0xffff ? 2 : 4;
        const size = width === 4 ? points * 4 : length * width;
        if (size > limits.processMessageBytes) return yield* safety("processMessageBytes");
        yield* beforeAllocate(CitationHtmlInputLayout.make({ encoding, fullHtml, byteLength: size }));
        const bytes = new Uint8Array(size);
        const view = new DataView(bytes.buffer);
        let offset = 0;
        nextYield = 0;
        for (let index = 0; index < length; ) {
          if (index >= nextYield) {
            yield* Effect.yieldNow;
            nextYield = index + 4096;
          }
          const point = O.getOrElse(Str.codePointAt(text, index), () => 0);
          if (width === 1) view.setUint8(offset, point);
          else if (width === 2) view.setUint16(offset, point, true);
          else view.setUint32(offset, point, true);
          offset += width;
          index += point > 0xffff ? 2 : 1;
        }
        return CitationHtmlInput.make({ encoding, bytes, fullHtml });
      }).pipe(
        Effect.timeoutOrElse({ duration: limits.cleanDeadline, orElse: () => Effect.fail(safety("cleanDeadline")) })
      );
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
      if (size > limits.processMessageBytes) return yield* safety("processMessageBytes");
      let start = 0;
      while (start < size) {
        if (start % 4096 === 0) yield* Effect.yieldNow;
        const byte = source[start];
        if (byte !== 32 && (byte === undefined || byte < 9 || byte > 13)) break;
        start++;
      }
      const matches = (prefix: ReadonlyArray<number>) => {
        for (let index = 0; index < prefix.length; index++) {
          const byte = source[start + index];
          if (byte === undefined || (byte >= 65 && byte <= 90 ? byte + 32 : byte) !== prefix[index]) return false;
        }
        return true;
      };
      const fullHtml = matches([60, 104, 116, 109, 108]) || matches([60, 33, 100, 111, 99, 116, 121, 112, 101]);
      yield* beforeAllocate(CitationHtmlInputLayout.make({ encoding: "AUTO", fullHtml, byteLength: size }));
      const bytes = new Uint8Array(size);
      for (let offset = 0; offset < size; offset += 4096) {
        yield* Effect.yieldNow;
        if (source.byteLength !== size) return yield* CitationHtmlInputFailure.make({ reason: "invalid-input" });
        bytes.set(source.subarray(offset, Num.min(offset + 4096, size)), offset);
      }
      return CitationHtmlInput.make({ encoding: "AUTO", fullHtml, bytes });
    },
    (body) =>
      body.pipe(
        Effect.timeoutOrElse({ duration: limits.cleanDeadline, orElse: () => Effect.fail(safety("cleanDeadline")) })
      ),
    Effect.provideService(Clock.Clock, clock)
  );
  return {
    prepare: Effect.fn("Citation.prepareHtmlInput")((input: unknown) =>
      prepare(input, rawText, limits.sourceUtf16, () => Effect.void)
    ),
    prepareBytes,
    prepareStage: <E>(input: unknown, beforeAllocate: (layout: CitationHtmlInputLayout) => Effect.Effect<void, E>) =>
      prepare(input, stageText, CitationEngineAbsoluteMaxima.producedTextUtf16, beforeAllocate),
  };
});
