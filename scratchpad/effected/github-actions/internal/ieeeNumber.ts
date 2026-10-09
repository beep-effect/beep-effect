import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

const NonFiniteSpelling = S.Literals(["Infinity", "-Infinity", "NaN"]);
const spellNonFinite = (n: number) => (Number.isNaN(n) ? "NaN" : n > 0 ? "Infinity" : "-Infinity");
const fromJsonSpelling = SchemaTransformation.transform<number, number | typeof NonFiniteSpelling.Type>({
	decode: (value) => (P.isNumber(value) ? value : Number(value)),
	encode: (n) => (Number.isFinite(n) ? n : spellNonFinite(n)),
});
const jsonLink = () => S.link<number>()(S.Union([S.Finite, NonFiniteSpelling]), fromJsonSpelling);
const stringTreeLink = () =>
	S.link<number>()(S.Union([S.String.check(S.isStringFinite()), NonFiniteSpelling]), SchemaTransformation.numberFromString);

/** Any JavaScript number, including `NaN`, `Infinity` and `-Infinity`. @internal */
export const IeeeNumber = S.declare(P.isNumber, {
	expected: "number",
	toCodecJson: jsonLink,
	toCodecStringTree: stringTreeLink,
	toCodecArbitrary: jsonLink,
});

export type IeeeNumber = typeof IeeeNumber.Type;
