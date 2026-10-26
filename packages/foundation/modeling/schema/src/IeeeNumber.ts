/**
 * Schema for any JavaScript number, including `NaN` and the infinities.
 *
 * **Details**
 *
 * `S.Finite` rejects the IEEE-754 special values, which is right for every
 * domain value and wrong for the few places that must carry whatever number
 * arrived: a TOML float (`inf`, `nan`), or an error that reports the value it
 * refused. The JSON and string-tree codecs spell the special values as
 * `"Infinity"`, `"-Infinity"` and `"NaN"`, so a round trip keeps them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { LiteralKit } from "./LiteralKit/index.ts";

const $I = $SchemaId.create("IeeeNumber");

const NonFiniteSpelling = LiteralKit(["Infinity", "-Infinity", "NaN"]).pipe(
  $I.annoteSchema("NonFiniteSpelling", {
    description: "The text spellings of the non-finite IEEE-754 numbers used by the JSON and string-tree codecs.",
  })
);
const spellNonFinite = (n: number) => (Number.isNaN(n) ? "NaN" : n > 0 ? "Infinity" : "-Infinity");
const fromJsonSpelling = SchemaTransformation.transform<number, number | typeof NonFiniteSpelling.Type>({
  decode: (value) => (P.isNumber(value) ? value : Number(value)),
  encode: (n) => (Number.isFinite(n) ? n : spellNonFinite(n)),
});
const jsonLink = () => S.link<number>()(S.Union([S.Finite, NonFiniteSpelling]), fromJsonSpelling);
const stringTreeLink = () =>
  S.link<number>()(
    S.Union([S.String.check(S.isStringFinite()), NonFiniteSpelling]),
    SchemaTransformation.numberFromString
  );

/**
 * Accepts every JavaScript number, including `NaN`, `Infinity` and `-Infinity`.
 *
 * **Example** (Keep a non-finite number through JSON)
 *
 * ```ts import.meta.vitest name="Keep a non-finite number through JSON"
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema";
 * import { IeeeNumber } from "@beep/schema/IeeeNumber";
 *
 * const codec = S.toCodecJson(IeeeNumber);
 * const encoded = await Effect.runPromise(S.encodeEffect(codec)(Number.NEGATIVE_INFINITY));
 * encoded // => "-Infinity"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const IeeeNumber = S.declare(P.isNumber, {
  expected: "number",
  toCodecJson: jsonLink,
  toCodecStringTree: stringTreeLink,
  toCodecArbitrary: jsonLink,
}).pipe(
  $I.annoteSchema("IeeeNumber", {
    description:
      "Any JavaScript number, including NaN and positive or negative infinity, with non-finite codec spellings.",
  })
);

/**
 * The number type accepted by the {@link IeeeNumber} runtime schema.
 *
 * @category validation
 * @since 0.0.0
 */
export type IeeeNumber = typeof IeeeNumber.Type;
