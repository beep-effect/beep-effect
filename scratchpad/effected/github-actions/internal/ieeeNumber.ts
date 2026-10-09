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

/** Any JavaScript number, including `NaN`, `Infinity` and `-Infinity`. @internal */
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

export type IeeeNumber = typeof IeeeNumber.Type;
