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
import * as MutableList from "effect/MutableList";
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
