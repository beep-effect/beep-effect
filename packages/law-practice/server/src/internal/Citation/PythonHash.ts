/**
 * Frozen CPython 3.11.15 byte/Unicode hashing. SipHash13 adapts Python/pyhash.c,
 * Copyright (c) 2013 Marek Majkowski, MIT; Python modifications PSF-2.0.
 * See THIRD_PARTY_NOTICES.md for complete notices and exact source hashes.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima, CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const CitationEngineLimitsType = S.toType(CitationEngineLimits);

const $I = $LawPracticeServerId.create("internal/Citation/PythonHash");
const Reason = LiteralKit(["invalid-input", "deadline-exceeded"]).pipe(
  $I.annoteSchema("Reason", {
    description: "Closed input/deadline failures with no source payload or nested cause.",
  })
);
/** @internal @category errors @since 0.0.0 */
export class CitationPythonHashFailure extends S.TaggedError<
  CitationPythonHashFailure,
  { readonly brand: unique symbol }
>($I`CitationPythonHashFailure`)(
  "CitationPythonHashFailure",
  { reason: Reason },
  $I.annoteError<CitationPythonHashFailure>("CitationPythonHashFailure", {
    description: "Frozen hash evaluation failed without retaining the input.",
  })
) {}
const fail = (reason: typeof Reason.Type) => CitationPythonHashFailure.make({ reason });
const maximum = CitationEngineAbsoluteMaxima.producedTextUtf16;
const Text = S.String.check(S.isMaxLength(maximum)).pipe(
  $I.annoteSchema("Text", {
    description: "Already-owned JavaScript Unicode text, bounded by the absolute intermediate ceiling.",
  })
);
const Bytes = S.Uint8Array.check(S.isMaxLength(maximum * 4)).pipe(
  $I.annoteSchema("Bytes", {
    description: "Immutable adapter-owned bytes, bounded by the derived native Unicode storage ceiling.",
  })
);
/**
 * Exact little-endian canonical Python Unicode storage. This preserves adjacent
 * surrogate code points that a JavaScript string cannot distinguish from a
 * supplementary scalar. The receiver validates words, width and UTF-16 size.
 * @internal @category models @since 0.0.0
 */
export class CitationPythonUnicodeStorage extends S.Opaque<
  CitationPythonUnicodeStorage,
  { readonly brand: unique symbol }
>()(
  S.Struct({ width: S.Literals([1, 2, 4]), bytes: Bytes }).pipe(
    $I.annoteSchema("CitationPythonUnicodeStorage", {
      description: "Explicit canonical one/two/four-byte source code-point storage; not a source-identity receipt.",
    })
  )
) {}
const CitationPythonUnicodeStorageType = S.toType(CitationPythonUnicodeStorage);

/**
 * Hash seed zero, SipHash13, 64-bit signed Python result with minus-one remapping.
 * Inputs must remain immutable through evaluation. Each method has R = never.
 * This service supplies primitive hashes, not object hash/equality protocols.
 * @internal @category services @since 0.0.0
 */
export class CitationPythonHash extends Context.Service<
  CitationPythonHash,
  {
    readonly bytes: (input: unknown) => Effect.Effect<bigint, CitationPythonHashFailure>;
    readonly text: (input: unknown) => Effect.Effect<bigint, CitationPythonHashFailure>;
    readonly unicode: (input: unknown) => Effect.Effect<bigint, CitationPythonHashFailure>;
  }
>()($I`CitationPythonHash`) {}
const mask = BigInt("0xffffffffffffffff");
const rotate = (value: bigint, bits: bigint) => ((value << bits) | (value >> (BigInt(64) - bits))) & mask;
const readByte = (bytes: Uint8Array, index: number) => O.getOrElse(O.fromUndefinedOr(bytes[index]), () => 0);
const widthOf = (largest: number) => (largest <= 255 ? 1 : largest <= 65535 ? 2 : 4);
const pointUnits = (point: number) => (point > 65535 ? 2 : 1);
const readNativePoint = (bytes: Uint8Array, index: number, width: number) => {
  let point = 0;
  for (let part = 0; part < width; part++) point += readByte(bytes, index + part) * 2 ** (8 * part);
  return point;
};
const TextMeasure = S.Tuple([S.Natural, S.Natural]).pipe(
  $I.annoteSchema("TextMeasure", { description: "Maximum original point and point count before native allocation." })
);
/** Measure owned text without allocating native storage; yield every 4096 points.
 * @internal @category operations @since 0.0.0
 */
export const measureCitationPythonText = Effect.fn("Citation.measurePythonText")(function* (text: string) {
  let largest = 0;
  let points = 0;
  for (let index = 0; index < Str.length(text); ) {
    if (points % 4096 === 0) yield* Effect.yieldNow;
    const point = O.getOrElse(Str.codePointAt(text, index), () => 0);
    largest = Num.max(largest, point);
    index += pointUnits(point);
    points++;
  }
  return TextMeasure.make([largest, points]);
});
/**
 * Capture limits/Clock once. Unicode preparation scans code points without
 * coercion, and hashing streams native bytes without allocating an encoded
 * copy. Every 4096 code points or 8192 hashed bytes yields for interruption.
 * Enclosing cleaner work still owns its earlier operation deadline.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationPythonHash = Effect.fn("Citation.makePythonHash")(function* (input: unknown) {
  const limits = yield* S.decodeUnknownEffect(CitationEngineLimitsType)(input).pipe(
    Effect.mapError(() => fail("invalid-input"))
  );
  const clock = yield* Clock.Clock;
  const deadline = Duration.min(limits.cleanDeadline, limits.operationDeadline).pipe(
    Duration.toMillis,
    Duration.millis
  );
  const hash = Effect.fn("Citation.siphash13")(function* (length: number, read: () => number) {
    if (length === 0) return BigInt(0);
    let v0 = BigInt("0x736f6d6570736575");
    let v1 = BigInt("0x646f72616e646f6d");
    let v2 = BigInt("0x6c7967656e657261");
    let v3 = BigInt("0x7465646279746573");
    const round = () => {
      v0 = (v0 + v1) & mask;
      v2 = (v2 + v3) & mask;
      v1 = rotate(v1, BigInt(13)) ^ v0;
      v3 = rotate(v3, BigInt(16)) ^ v2;
      v0 = rotate(v0, BigInt(32));
      v2 = (v2 + v1) & mask;
      v0 = (v0 + v3) & mask;
      v1 = rotate(v1, BigInt(17)) ^ v2;
      v3 = rotate(v3, BigInt(21)) ^ v0;
      v2 = rotate(v2, BigInt(32));
    };
    let position = 0;
    while (length - position >= 8) {
      if (position % 8192 === 0) yield* Effect.yieldNow;
      let word = BigInt(0);
      for (let shift = BigInt(0); shift < BigInt(64); shift += BigInt(8)) word |= BigInt(read()) << shift;
      v3 ^= word;
      round();
      v0 ^= word;
      position += 8;
    }
    let last = (BigInt(length) << BigInt(56)) & mask;
    for (let shift = BigInt(0); position < length; position++, shift += BigInt(8)) last |= BigInt(read()) << shift;
    v3 ^= last;
    round();
    v0 ^= last;
    v2 ^= BigInt("0xff");
    round();
    round();
    round();
    const result = BigInt.asIntN(64, v0 ^ v1 ^ v2 ^ v3);
    return result === -BigInt(1) ? -BigInt(2) : result;
  });
  const bounded = <A>(body: Effect.Effect<A, CitationPythonHashFailure>) =>
    body.pipe(
      Effect.timeoutOrElse({ duration: deadline, orElse: () => Effect.fail(fail("deadline-exceeded")) }),
      Effect.provideService(Clock.Clock, clock)
    );
  const byteHash = Effect.fn("Citation.pythonByteHash")(function* (input: unknown) {
    const bytes = yield* S.decodeUnknownEffect(Bytes)(input).pipe(Effect.mapError(() => fail("invalid-input")));
    let index = 0;
    return yield* hash(bytes.length, () => readByte(bytes, index++));
  });
  const validateNative = Effect.fnUntraced(function* (width: number, bytes: Uint8Array) {
    let largest = 0;
    let units = 0;
    for (let index = 0; index < bytes.length; index += width) {
      if (index % (width * 4096) === 0) yield* Effect.yieldNow;
      const point = readNativePoint(bytes, index, width);
      if (point > 0x10ffff) return yield* fail("invalid-input");
      largest = Num.max(largest, point);
      units += pointUnits(point);
      if (units > maximum) return yield* fail("invalid-input");
    }
    if (width !== widthOf(largest)) return yield* fail("invalid-input");
  });
  return CitationPythonHash.of({
    bytes: Effect.fn("Citation.hashOwnedBytes")((value) => bounded(byteHash(value))),
    unicode: Effect.fn("Citation.hashUnicodeStorage")((input) =>
      bounded(
        Effect.gen(function* () {
          const { width, bytes } = yield* S.decodeUnknownEffect(CitationPythonUnicodeStorageType)(input).pipe(
            Effect.mapError(() => fail("invalid-input"))
          );
          if (bytes.length % width !== 0) return yield* fail("invalid-input");
          yield* validateNative(width, bytes);
          return yield* byteHash(bytes);
        })
      )
    ),
    text: Effect.fn("Citation.hashOwnedText")((input) =>
      bounded(
        Effect.gen(function* () {
          const text = yield* S.decodeUnknownEffect(Text)(input).pipe(Effect.mapError(() => fail("invalid-input")));
          const [largest, points] = yield* measureCitationPythonText(text);
          const width = widthOf(largest);
          let index = 0;
          let pending = 0;
          let left = 0;
          return yield* hash(points * width, () => {
            if (left === 0) {
              pending = O.getOrElse(Str.codePointAt(text, index), () => 0);
              index += pending > 65535 ? 2 : 1;
              left = width;
            }
            const byte = pending & 255;
            pending >>>= 8;
            left--;
            return byte;
          });
        })
      )
    ),
  });
});
