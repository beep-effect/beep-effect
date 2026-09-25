/**
 * Python `float` semantics for number fields.
 *
 * **Details**
 *
 * The OMI models declare plain `float` fields, and a plain Python `float`
 * admits `nan`, `inf`, and `-inf`. {@link PythonFloat} keeps those values
 * valid where `S.Finite` would reject them, and still persists in a
 * PostgreSQL `double precision` column.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { NumberDeclarationRepresentation } from "@beep/effect-drizzle/pg";
import * as P from "effect/Predicate";
import * as SchemaGetter from "effect/SchemaGetter";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("beep/PythonFloat");

const NonFiniteNumberName = LiteralKit(["NaN", "Infinity", "-Infinity"]);

const isNonFiniteNumberName = S.is(NonFiniteNumberName);

/**
 * Finite numbers stay numbers; `NaN` and the infinities travel as their names.
 *
 * This is the link `S.Number` uses for its JSON codec, reused for the arbitrary.
 */
const pythonFloatEncoding = S.link<number>()(S.Union([S.Finite, NonFiniteNumberName]), {
  decode: SchemaGetter.Number(),
  encode: SchemaGetter.transform((value: number) => {
    const name = `${value}`;
    return isNonFiniteNumberName(name) ? name : value;
  }),
});

/**
 * Any JavaScript number, `NaN` and the infinities included.
 *
 * **Details**
 *
 * A Python `float` field admits `nan`, `inf`, and `-inf` unless its model sets
 * `allow_inf_nan=False`. Released clients may still send them, so this schema
 * keeps them valid where `S.Finite` would reject them. The JSON codec writes
 * non-finite values as the strings `"NaN"`, `"Infinity"`, and `"-Infinity"`,
 * and the arbitrary draws finite numbers and those three values.
 *
 * The declaration carries the effect-drizzle number representation, so a
 * model field built on it corroborates against a number column such as
 * `pg.doublePrecision()`.
 *
 * A value that is not a number fails with
 * `Expected @beep/scratchpad/beep/PythonFloat/PythonFloat`, where `S.Number`
 * reports `Expected number`. The default formatter names a declared schema by
 * its identifier before its `expected` annotation, so `expected: "number"`
 * only shows when the identifier is absent.
 *
 * **Example** (Keep a non-finite coordinate)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { PythonFloat } from "./PythonFloat.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(PythonFloat)(Number.POSITIVE_INFINITY))
 * const json = Effect.runSync(S.encodeEffect(S.toCodecJson(PythonFloat))(Number.NaN))
 * console.log(decoded) // Infinity
 * console.log(json) // "NaN"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PythonFloat = S.declare(P.isNumber, {
  expected: "number",
  representation: NumberDeclarationRepresentation,
  toCodecJson: () => pythonFloatEncoding,
  toCodecArbitrary: () => pythonFloatEncoding,
}).pipe(
  $I.annoteSchema("PythonFloat", {
    description: "A JavaScript number, NaN and the infinities included, as a Python float field admits them.",
  }),
);
