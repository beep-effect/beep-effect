/**
 * Exact runtime hash encoding adapted from eyecite 2.7.6 utils.py.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { LiteralKit, Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $LawPracticeServerId.create("internal/Citation/RuntimeHashEncoding");
const Reason = LiteralKit(["invalid-input", "digest-failed"]);
/**
 * Sanitized private encoding failure.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class CitationRuntimeHashEncodingFailure extends S.TaggedError<
  CitationRuntimeHashEncodingFailure,
  { readonly brand: unique symbol }
>($I`CitationRuntimeHashEncodingFailure`)(
  "CitationRuntimeHashEncodingFailure",
  { reason: Reason },
  $I.annoteError<CitationRuntimeHashEncodingFailure>("CitationRuntimeHashEncodingFailure", {
    description: "Closed runtime JSON/digest failure without input or causes.",
  })
) {}
const failure = (reason: typeof Reason.Type) => CitationRuntimeHashEncodingFailure.make({ reason });
const JsonString = S.fromJsonString(S.String);
const encoder = new TextEncoder();
const hex = Str.split("0123456789abcdef", "");
/**
 * Python json.dumps string escaping, including DEL and isolated surrogates.
 * @internal
 * @category encoding
 * @since 0.0.0
 */
export const encodeCitationRuntimeString = Effect.fn("Citation.pythonJsonString")(function* (value: string) {
  const encoded = yield* S.encodeEffect(JsonString)(value).pipe(Effect.mapError(() => failure("invalid-input")));
  return A.join(
    A.map(Str.split(encoded, ""), (unit) => {
      const code = O.getOrElse(Str.charCodeAt(unit, 0), () => 0);
      return code < 127
        ? unit
        : `\\u${A.getUnsafe(hex, (code >>> 12) & 15)}${A.getUnsafe(hex, (code >>> 8) & 15)}${A.getUnsafe(hex, (code >>> 4) & 15)}${A.getUnsafe(hex, code & 15)}`;
    }),
    ""
  );
});
/**
 * Source SHA-256 integer reduced under the frozen CPython 64-bit modulus.
 * @internal
 * @category encoding
 * @since 0.0.0
 */
export const hashCitationRuntimePreimage = Effect.fn("Citation.pythonShaHash")(function* (preimage: string) {
  const digest = yield* S.decodeEffect(Sha256HexFromBytes)(encoder.encode(preimage)).pipe(
    Effect.mapError(() => failure("digest-failed"))
  );
  return BigInt(`0x${digest}`) % BigInt("2305843009213693951");
});
/**
 * Python string ordering compares Unicode code points, including surrogate code points.
 * @internal
 * @category ordering
 * @since 0.0.0
 */
export const makeCitationRuntimeStringOrder = (): Order.Order<string> =>
  Order.make((left, right) => {
    let li = 0;
    let ri = 0;
    while (li < Str.length(left) && ri < Str.length(right)) {
      const l = O.getOrElse(Str.codePointAt(left, li), () => 0);
      const r = O.getOrElse(Str.codePointAt(right, ri), () => 0);
      if (l !== r) return l < r ? -1 : 1;
      li += l > 65535 ? 2 : 1;
      ri += r > 65535 ? 2 : 1;
    }
    return li < Str.length(left) ? 1 : ri < Str.length(right) ? -1 : 0;
  });
