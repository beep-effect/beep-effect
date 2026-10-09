import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

const $I = $ScratchpadId.create("effected/github-actions/internal/ieeeNumber");

const NonFiniteSpelling = LiteralKit(["Infinity", "-Infinity", "NaN"]).pipe(
	$I.annoteSchema("NonFiniteSpelling", {
		description: "The text encodings of non-finite IEEE numbers.",
	}),
);
const spellNonFinite = (n: number) => (Number.isNaN(n) ? "NaN" : n > 0 ? "Infinity" : "-Infinity");
const fromJsonSpelling = SchemaTransformation.transform<number, number | typeof NonFiniteSpelling.Type>({
	decode: (value) => (P.isNumber(value) ? value : Number(value)),
	encode: (n) => (Number.isFinite(n) ? n : spellNonFinite(n)),
});
const jsonLink = () => S.link<number>()(S.Union([S.Finite, NonFiniteSpelling]), fromJsonSpelling);
const stringTreeLink = () =>
	S.link<number>()(S.Union([S.String.check(S.isStringFinite()), NonFiniteSpelling]), SchemaTransformation.numberFromString);

/**
 * Accepts every JavaScript number, including `NaN`, `Infinity` and `-Infinity`.
 *
 * **Example** (Accept non-finite numbers)
 *
 * ```ts
 * import { IeeeNumber } from "@beep/scratchpad/effected/github-actions/internal/ieeeNumber";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(IeeeNumber)(Infinity)) // true
 * console.log(S.is(IeeeNumber)(NaN)) // true
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const IeeeNumber = S.declare(P.isNumber, {
	expected: "number",
	toCodecJson: jsonLink,
	toCodecStringTree: stringTreeLink,
	toCodecArbitrary: jsonLink,
}).pipe(
	$I.annoteSchema("IeeeNumber", {
		description: "Any JavaScript number, including NaN, Infinity and -Infinity.",
	}),
);

/**
 * The number type accepted by the {@link IeeeNumber} runtime schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export type IeeeNumber = typeof IeeeNumber.Type;
