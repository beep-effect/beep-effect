/** Existing native JSON/base64 resource guards shared by closed worker codecs.
 * Schema owns encoding/decoding; these checks precede variable allocation.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $LawPracticeServerId.create("internal/Citation/NativeJson");
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
/** Trusted codec installation; no callback or schema is part of wire data.
 * @internal @category services @since 0.0.0
 */
export interface CitationNativeJsonDecoder<Codec extends S.ConstraintDecoder<unknown>, E> {
  readonly codec: Codec;
  readonly invalid: () => E;
  readonly maximumDepth: number;
  readonly propertyCeiling: number;
}
/** Reuse the existing structural guard, fatal UTF-8 decoder and strict Schema
 * JSON boundary for each closed message family.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationNativeJsonDecoder = <Codec extends S.ConstraintDecoder<unknown>, E>(
  definition: CitationNativeJsonDecoder<Codec, E>
) =>
  Effect.fn("Citation.decodeNativeJson")(function* (bytes: Uint8Array) {
    yield* preflightCitationNativeJson(bytes, definition.propertyCeiling, definition.invalid, definition.maximumDepth);
    const text = yield* Effect.try({ try: () => decoder.decode(bytes), catch: definition.invalid });
    return yield* S.decodeEffect(definition.codec, { onExcessProperty: "error" })(text).pipe(
      Effect.mapError(definition.invalid)
    );
  });
/** Exact padded base64 payload size, excluding its schema-owned JSON header.
 * @internal @category operations @since 0.0.0
 */
export const citationNativeBase64Length = (bytes: number) => 4 * ((bytes + 2 - ((bytes + 2) % 3)) / 3);
/** Build a trusted codec whose encoded bound precedes base64 allocation.
 * Name and ceiling are installation-time adapter constants, not wire fields.
 * @internal @category operations @since 0.0.0
 */
const nativeBytes = (name: string, maximum: number) =>
  S.String.check(
    S.isMaxLength(citationNativeBase64Length(maximum)),
    S.makeFilter(
      (text) => {
        const length = Str.length(text);
        const padding = Str.endsWith("==")(text) ? 2 : Str.endsWith("=")(text) ? 1 : 0;
        return length % 4 === 0 && (length / 4) * 3 - padding <= maximum;
      },
      $I.annote(`${name}EncodedBound`, { description: "Bound the decoded count before base64 allocation." })
    )
  )
    .pipe(S.decodeTo(S.Uint8ArrayFromBase64))
    .check(S.isMaxLength(maximum))
    .pipe($I.annoteSchema(name, { description: "Bounded padded base64/native bytes with a post-decode byte check." }));
/** @internal @category operations @since 0.0.0 */
export const citationNativeBytes: {
  (name: string, maximum: number): ReturnType<typeof nativeBytes>;
  (maximum: number): (name: string) => ReturnType<typeof nativeBytes>;
} = dual(2, nativeBytes);
/** Existing closed-message structure guard, before JSON/base64 materialization.
 * Bounds the property/depth work and forbids arrays; quoted punctuation is data.
 * This does not replace the subsequent Schema JSON codec validation.
 * @internal @category operations @since 0.0.0
 */
export const preflightCitationNativeJson = Effect.fn("Citation.preflightNativeJson")(function* <E>(
  bytes: Uint8Array,
  propertyCeiling: number,
  invalid: () => E,
  maximumDepth = 1
) {
  let quoted = false;
  let escaped = false;
  let depth = 0;
  let properties = 0;
  const quotedByte = (byte: number) => {
    if (escaped) escaped = false;
    else if (byte === 92) escaped = true;
    else if (byte === 34) quoted = false;
  };
  const openObject = Effect.fnUntraced(function* () {
    depth++;
    if (depth > maximumDepth) return yield* Effect.fail(invalid());
  });
  const closeObject = Effect.fnUntraced(function* () {
    depth--;
    if (depth < 0) return yield* Effect.fail(invalid());
  });
  const property = Effect.fnUntraced(function* () {
    properties++;
    if (properties > propertyCeiling) return yield* Effect.fail(invalid());
  });
  const structuralByte = (byte: number | undefined) =>
    Match.value(byte).pipe(
      Match.when(34, () =>
        Effect.sync(() => {
          quoted = true;
        })
      ),
      Match.whenOr(91, 93, () => Effect.fail(invalid())),
      Match.when(123, openObject),
      Match.when(125, closeObject),
      Match.when(58, property),
      Match.orElse(() => Effect.void)
    );
  for (let index = 0; index < bytes.byteLength; index++) {
    if (index % 4096 === 0) yield* Effect.yieldNow;
    const byte = bytes[index];
    if (quoted) quotedByte(byte ?? -1);
    else yield* structuralByte(byte);
  }
  const complete = () => !quoted && !escaped && depth === 0;
  if (!complete()) return yield* Effect.fail(invalid());
});
