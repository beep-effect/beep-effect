import { assert, describe, it } from "@effect/vitest";
import { lex } from "../../effected/workspaces/internal/sourceText.ts";

/** A `/` that opens a regex blanks the body in the code view; one that divides leaves the code view untouched. */
const divides = (text: string): boolean => lex(text).code === text;

describe("lex: the contextual `of`", () => {
	const divisions = [
		["a variable named of", "const of = 8; const x = of / 2; const y = 8 / 2;"],
		["a property named of", "const x = o.of / 2; const y = 8 / 2;"],
		["an optional-chained property named of", "const x = o?.of / 2; const y = 8 / 2;"],
		["a property named like a keyword", "const x = it.return / 2; const y = 8 / 2;"],
		["of inside a classic for head", "for (let i = of / 2; i < n / 2; i++) {}"],
		["of in a call's parentheses", "const x = f(of / 2, 8 / 2);"],
		["of after a non-null assertion", "const x = of! / 2; const y = 8 / 2;"],
		["an iterable named of", "for (const x of of / 2 / 4) {}"],
		["of after a for...in keyword", "for (x in of / 2 / 4) {}"],
		["of starting a statement after a block", "if (a) {}\nof / 2; const y = 8 / 2;"],
		["of starting a statement after a name", "x\nof / 2; const y = 8 / 2;"],
	] as const;
	for (const [name, text] of divisions) {
		it(`divides after ${name}`, () => assert.isTrue(divides(text), text));
	}

	const regexes = [
		["the for...of keyword", "for (const x of /a b/.exec(s)) {}"],
		["the keyword after a binding named of", "for (const of of /a b/.exec(s)) {}"],
		["the keyword after a destructuring pattern", "for (const [a] of /a b/.exec(s)) {}"],
		["the keyword in a for await head", "for await (const x of /a b/.exec(s)) {}"],
		["a spread of a keyword", "const xs = [...new /a b/.constructor()];"],
	] as const;
	for (const [name, text] of regexes) {
		it(`opens a regex after ${name}`, () => {
			assert.isFalse(divides(text), text);
			assert.notInclude(lex(text).code, "a b", text);
		});
	}
});
