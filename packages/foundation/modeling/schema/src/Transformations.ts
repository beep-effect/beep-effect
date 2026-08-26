/**
 * Lossy schema transformation helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, SchemaGetter as Getter, SchemaIssue, Struct } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

type DestructiveTransform<Self extends S.Top, B> = S.decodeTo<
  S.Codec<Readonly<B>>,
  typeof S.Unknown,
  Self["DecodingServices"]
>;

const makeDestructiveOutput = <B>(): S.Codec<Readonly<B>> => S.make<S.Codec<Readonly<B>>>(S.Unknown.ast);

/**
 * Applies a lossy transform by inferring the target type from a callback result.
 *
 * **Details**
 *
 * This helper intentionally does not require an inverse transform. Decoding runs
 * the source schema first, then applies `transform`. Encoding passes the
 * transformed value through unchanged. Supports both data-first and data-last
 * calling conventions.
 *
 * **Example** (Data-first and data-last)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { pipe } from "effect"
 * import { destructiveTransform } from "@beep/schema/Transformations"
 *
 * // data-first
 * const StringLength = destructiveTransform(S.String, (value) => value.length)
 * console.log(StringLength)
 *
 * // data-last (pipeable)
 * const Piped = pipe(S.String, destructiveTransform((value) => value.length))
 * console.log(Piped)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const destructiveTransform: {
  <Self extends S.Top, B>(transform: (input: Self["Type"]) => B): (self: Self) => DestructiveTransform<Self, B>;
  <Self extends S.Top, B>(self: Self, transform: (input: Self["Type"]) => B): DestructiveTransform<Self, B>;
} = dual(
  2,
  <Self extends S.Top, B>(self: Self, transform: (input: Self["Type"]) => B): DestructiveTransform<Self, B> => {
    const decodeInput = S.decodeUnknownEffect(self);
    const applyTransform = Effect.fnUntraced(function* (decoded: Self["Type"]) {
      return yield* Effect.try({
        try: () => transform(decoded),
        catch: () =>
          new SchemaIssue.InvalidValue({
            message: "Error applying transformation",
          }),
      });
    });
    const output = makeDestructiveOutput<B>();

    return S.Unknown.pipe(
      S.decodeTo(output, {
        decode: Getter.transformOrFail((input: unknown, options) =>
          decodeInput(input, options).pipe(Effect.mapError(Struct.get("issue")), Effect.flatMap(applyTransform))
        ),
        // Lossy transforms intentionally keep encode as a passthrough so the
        // transformed value remains the encoded value as well.
        encode: Getter.transform((value: Readonly<B>) => value),
      })
    );
  }
);
