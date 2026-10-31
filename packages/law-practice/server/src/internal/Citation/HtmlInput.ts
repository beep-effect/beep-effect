/**
 * Bounded HTML Unicode input preparation adapted from lxml 5.1.0
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
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { citationPythonTextData } from "./PythonTextData.ts";

const $I = $LawPracticeServerId.create("internal/Citation/HtmlInput");
const Encoding = LiteralKit(["UTF-8", "ISO-8859-1", "UTF-16LE", "UTF-32LE"]).pipe(
  $I.annoteSchema("Encoding", {
    description: "Pinned little-endian CPython PEP-393 buffer encoding, including lone surrogate units.",
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
      description: "Bounded Unicode parser payload and exact source wrapper classification.",
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
const safety = (limit: CitationSafetyLimitExceeded["limit"]) =>
  CitationSafetyLimitExceeded.make({ operation: "clean", limit });
/**
 * Capture limits and Clock. Prepare owns a byte buffer, yields during each
 * unbounded scan and has R = never. No native regex or HTML parser runs here.
 * This enforces the payload ceiling; the future worker must also charge its
 * framing bytes and share the enclosing clean operation's remaining deadline.
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const makeCitationHtmlInput = Effect.fn("Citation.makeHtmlInput")(function* (input: unknown) {
  const limits = yield* S.decodeUnknownEffect(S.toType(CitationEngineLimits))(input).pipe(
    Effect.mapError(() => CitationHtmlInputFailure.make({ reason: "invalid-input" }))
  );
  const clock = yield* Clock.Clock;
  return {
    prepare: Effect.fn("Citation.prepareHtmlInput")(
      function* (input: unknown) {
        const text = yield* S.decodeUnknownEffect(rawText)(input).pipe(
          Effect.mapError(() => CitationHtmlInputFailure.make({ reason: "invalid-input" }))
        );
        const length = Str.length(text);
        if (length > limits.sourceUtf16) return yield* safety("sourceUtf16");
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
    ),
  };
});
