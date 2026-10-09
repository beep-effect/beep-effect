import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { InvalidSpdxExpressionError, License } from "../../effected/spdx/License.ts";
import type { SpdxExpression as SpdxExpressionAst } from "../../effected/spdx/SpdxExpression.ts";
import {
	AndNode,
	LicenseNode,
	LicenseRefNode,
	OrNode,
	SpdxExpression,
	WithExceptionNode,
	isValidExpression,
} from "../../effected/spdx/SpdxExpression.ts";

// A generative round-trip arbitrary built from the KNOWN SPDX id set, used
// instead of `Arbitrary.schema(SpdxExpression.Schema)`. Native derivation runs
// on the recursive union, but every leaf's `id`/`ref`/`exception` is a bare
// `Schema.String`, so it emits identifiers that no grammar recognizes
// (e.g. `"__+ WITH ?.Rf\4aV"`) — decode∘encode can never be identity on those.
// Constraining the leaves to real ids and well-formed reference idstrings makes
// the round-trip invariant meaningful: encode yields a canonical SPDX string
// that re-decodes to an equal AST.
const KNOWN_LICENSES = ["MIT", "Apache-2.0", "BSD-3-Clause", "ISC", "GPL-2.0-or-later", "MPL-2.0"] as const;
const KNOWN_EXCEPTIONS = ["Classpath-exception-2.0", "Bison-exception-2.2", "GCC-exception-2.0"] as const;
const idstring = S.String.check(S.isPattern(/^[A-Za-z0-9.-]{1,12}$/));
/** A uniform choice between arbitraries — the native module only unions Schemas. */
const oneOf = <A>(
	first: Arbitrary.Arbitrary<A>,
	...rest: ReadonlyArray<Arbitrary.Arbitrary<A>>
): Arbitrary.Arbitrary<A> =>
	Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: rest.length }))).pipe(
		Arbitrary.flatMap((index) => (index === 0 ? first : (rest[index - 1] ?? first))),
	);
const licenseNode = Arbitrary.schema(S.Struct({ id: S.Literals(KNOWN_LICENSES), plus: S.Boolean })).pipe(
	Arbitrary.map(({ id, plus }) => LicenseNode.make({ id, plus })),
);
// `documentRef` is an `optionalKey`, so the generator either draws it or
// leaves the key absent — the value passes straight to `make` with no
// explicit `undefined` ever reaching the optional field.
const licenseRefNode = Arbitrary.schema(
	S.Struct({ documentRef: S.optionalKey(idstring), ref: idstring }),
).pipe(Arbitrary.map((fields) => LicenseRefNode.make(fields)));
// `WITH` binds to any simple expression — a license id (optionally `+`) OR a
// `LicenseRef` reference — so the arbitrary generates both license shapes.
const withExceptionNode = Arbitrary.all({
	license: oneOf<LicenseNode | LicenseRefNode>(licenseNode, licenseRefNode),
	exception: Arbitrary.schema(S.Literals(KNOWN_EXCEPTIONS)),
}).pipe(Arbitrary.map(({ license, exception }) => WithExceptionNode.make({ license, exception })));
const simpleExpression = oneOf<SpdxExpressionAst>(licenseNode, licenseRefNode, withExceptionNode);
// Compound expressions nest AND/OR at most four levels deep (the old
// `maxDepth: 4`); below the floor only simple expressions remain, so every
// generation path is finite.
const expressionAt = (depth: number): Arbitrary.Arbitrary<SpdxExpressionAst> => {
	if (depth === 0) return simpleExpression;
	const operand = expressionAt(depth - 1);
	return oneOf<SpdxExpressionAst>(
		simpleExpression,
		Arbitrary.all([operand, operand]).pipe(Arbitrary.map(([left, right]) => AndNode.make({ left, right }))),
		Arbitrary.all([operand, operand]).pipe(Arbitrary.map(([left, right]) => OrNode.make({ left, right }))),
	);
};
const spdxExpressionArb = expressionAt(4);

const VALID = [
	"MIT",
	"Apache-2.0+",
	"(MIT OR Apache-2.0)",
	"MIT AND BSD-3-Clause",
	"GPL-2.0-or-later WITH Bison-exception-2.2",
	"LicenseRef-Proprietary",
	"DocumentRef-spdx-tool-1.2:LicenseRef-MIT-Style-2",
	"LicenseRef-Foo WITH Bison-exception-2.2",
	"DocumentRef-spdx-tool-1.2:LicenseRef-MIT-Style-2 WITH Classpath-exception-2.0",
	"MIT and BSD-3-Clause",
	"(MIT AND (Apache-2.0 OR BSD-3-Clause))",
];
const INVALID = [
	"NOPE-1.0",
	"MIT AND",
	"(MIT",
	"MIT OR OR Apache-2.0",
	"",
	// an unknown exception id after a reference
	"LicenseRef-Foo WITH Bogus-exception",
	// a reference never carries the `+` marker
	"LicenseRef-Foo+ WITH Bison-exception-2.2",
];

describe("SpdxExpression", () => {
	for (const s of VALID) {
		it.effect(`parses ${s}`, () =>
			Effect.gen(function* () {
				const expr = yield* SpdxExpression.parse(s);
				assert.isDefined(expr);
			}),
		);
		it(`validates ${s} synchronously`, () => assert.isTrue(isValidExpression(s)));
	}
	for (const s of INVALID) {
		it.effect(`rejects ${JSON.stringify(s)} as a typed error`, () =>
			Effect.gen(function* () {
				const exit = yield* Effect.exit(SpdxExpression.parse(s));
				assert.isTrue(Exit.isFailure(exit));
				if (Exit.isFailure(exit)) {
					// discriminate a typed failure from a defect
					assert.isFalse(Cause.hasDies(exit.cause));
				}
			}),
		);
		it(`invalidates ${JSON.stringify(s)} synchronously`, () => assert.isFalse(isValidExpression(s)));
	}
	it.effect("fails invalid input with the typed InvalidSpdxExpressionError", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(SpdxExpression.parse("NOPE-1.0"));
			assert.instanceOf(error, InvalidSpdxExpressionError);
			assert.strictEqual(error.input, "NOPE-1.0");
		}),
	);
	it.effect("round-trips through toString", () =>
		Effect.gen(function* () {
			const expr = yield* SpdxExpression.parse("(MIT OR Apache-2.0)");
			assert.strictEqual(expr.toString(), "(MIT OR Apache-2.0)");
		}),
	);
	it.effect("FromString decodes a string to the AST that re-serializes to canonical form", () =>
		Effect.gen(function* () {
			const ast = yield* S.decodeEffect(SpdxExpression.FromString)("(MIT OR Apache-2.0)");
			assert.strictEqual(ast._tag, "Or");
			// the decoded AST is the same tree the sync parser produces
			assert.strictEqual(ast.toString(), "(MIT OR Apache-2.0)");
		}),
	);
	// A TRUE codec round-trip: encode must yield the canonical SPDX string (the
	// regression is encode returning "[object Object]"), and decode∘encode must
	// be identity across a leaf `+`, an OR compound, a WITH, and a nested case.
	for (const s of [
		"(MIT OR Apache-2.0)",
		"Apache-2.0+",
		"GPL-2.0-or-later WITH Bison-exception-2.2",
		"LicenseRef-Foo WITH Bison-exception-2.2",
		"DocumentRef-spdx-tool-1.2:LicenseRef-MIT-Style-2 WITH Classpath-exception-2.0",
		"(MIT AND (Apache-2.0 OR BSD-3-Clause))",
	]) {
		it.effect(`FromString encode round-trips ${s}`, () =>
			Effect.gen(function* () {
				const ast = yield* S.decodeEffect(SpdxExpression.FromString)(s);
				const encoded = yield* S.encodeEffect(SpdxExpression.FromString)(ast);
				// encode emits the canonical string the input already is
				assert.strictEqual(encoded, s);
				// decode∘encode is identity: the string re-decodes and re-encodes to itself
				const reAst = yield* S.decodeEffect(SpdxExpression.FromString)(encoded);
				const reEncoded = yield* S.encodeEffect(SpdxExpression.FromString)(reAst);
				assert.strictEqual(reEncoded, encoded);
			}),
		);
	}
	it.effect("binds WITH to a LicenseRef reference", () =>
		Effect.gen(function* () {
			const expr = yield* SpdxExpression.parse("LicenseRef-Foo WITH Bison-exception-2.2");
			assert.instanceOf(expr, WithExceptionNode);
			if (S.is(WithExceptionNode)(expr)) {
				assert.instanceOf(expr.license, LicenseRefNode);
				assert.strictEqual(expr.exception, "Bison-exception-2.2");
			}
			assert.strictEqual(expr.toString(), "LicenseRef-Foo WITH Bison-exception-2.2");
		}),
	);
	it.effect("preserves the + marker", () =>
		Effect.gen(function* () {
			const expr = yield* SpdxExpression.parse("Apache-2.0+");
			assert.strictEqual(expr.toString(), "Apache-2.0+");
		}),
	);
	it.effect("does not overflow on deeply nested input", () =>
		Effect.gen(function* () {
			const deep = `${"(".repeat(5000)}MIT${")".repeat(5000)}`;
			const exit = yield* Effect.exit(SpdxExpression.parse(deep));
			// caps out as a typed failure, never a RangeError defect
			assert.isTrue(Exit.isFailure(exit));
			if (Exit.isFailure(exit)) {
				assert.isFalse(Cause.hasDies(exit.cause));
				assert.isTrue(Cause.hasFails(exit.cause));
			}
		}),
	);
	it.effect("caps a long AND chain as a typed failure, not a defect", () =>
		Effect.gen(function* () {
			const chain = Array.from({ length: 6000 }, () => "MIT").join(" AND ");
			const exit = yield* Effect.exit(SpdxExpression.parse(chain));
			assert.isTrue(Exit.isFailure(exit));
			if (Exit.isFailure(exit)) {
				assert.isFalse(Cause.hasDies(exit.cause));
			}
		}),
	);
	// FromString round-trips: decode∘encode is identity on generated expressions.
	// encode serializes the AST to canonical form; decode re-parses it to an
	// equal AST, and re-encoding that AST reproduces the same string.
	it.effect.prop("FromString round-trips decode(encode(e))", [spdxExpressionArb], ([e]) =>
		Effect.gen(function* () {
			const encoded = yield* S.encodeUnknownEffect(SpdxExpression.FromString)(e);
			const decoded = yield* S.decodeEffect(SpdxExpression.FromString)(encoded);
			assert.isTrue(Equal.equals(decoded, e), `expected ${decoded.toString()} to equal ${e.toString()}`);
			const reEncoded = yield* S.encodeUnknownEffect(SpdxExpression.FromString)(decoded);
			assert.strictEqual(reEncoded, encoded);
		}),
	);
});

describe("SpdxExpression — collapsing an expression to licenses", () => {
	const parse = (input: string) => {
		const result = SpdxExpression.parseResult(input);
		assertTrue(Result.isSuccess(result), input);
		return result.success;
	};

	it("a simple license is its own primary", () => {
		assert.deepStrictEqual(SpdxExpression.primaryLicense(parse("MIT")), O.some(License.of("MIT")));
	});

	it("OR takes the leftmost — the choice the author wrote first", () => {
		assert.deepStrictEqual(SpdxExpression.primaryLicense(parse("MIT OR Apache-2.0")), O.some(License.of("MIT")));
		assert.deepStrictEqual(
			SpdxExpression.primaryLicense(parse("(GPL-3.0-only OR MIT) OR Apache-2.0")),
			O.some(License.of("GPL-3.0-only")),
		);
	});

	it("AND has no single license, and says so rather than dropping a term", () => {
		// The whole reason this returns an Option: a conjunction binds every
		// term at once, so answering with one of them is a legal claim that is
		// simply false.
		assert.isTrue(O.isNone(SpdxExpression.primaryLicense(parse("MIT AND Apache-2.0"))));
	});

	it("an OR whose left branch is an AND has no primary either", () => {
		// Recursion must not sidestep the AND rule by descending past it.
		assert.isTrue(O.isNone(SpdxExpression.primaryLicense(parse("(MIT AND Apache-2.0) OR GPL-3.0-only"))));
	});

	it("an exception qualifies its license, and the license is the primary", () => {
		assert.deepStrictEqual(
			SpdxExpression.primaryLicense(parse("GPL-2.0-only WITH Bison-exception-2.2")),
			O.some(License.of("GPL-2.0-only")),
		);
	});

	it("the `+` marker qualifies a catalog entry, it does not name another", () => {
		assert.deepStrictEqual(SpdxExpression.primaryLicense(parse("AFL-2.0+")), O.some(License.of("AFL-2.0")));
	});

	it("a LicenseRef resolves as a reference", () => {
		assert.deepStrictEqual(
			SpdxExpression.primaryLicense(parse("LicenseRef-Proprietary")),
			O.some(License.of("LicenseRef-Proprietary")),
		);
		assert.deepStrictEqual(
			SpdxExpression.primaryLicense(parse("DocumentRef-spdx-tool:LicenseRef-Proprietary")),
			O.some(License.of("DocumentRef-spdx-tool:LicenseRef-Proprietary")),
		);
	});

	it("a deprecated id keeps its deprecated flag through the collapse", () => {
		const primary = SpdxExpression.primaryLicense(parse("GPL-3.0"));
		const isSome = O.isSome(primary);
		assertTrue(isSome);
		assert.strictEqual(primary.value.id, "GPL-3.0");
		assert.isTrue(primary.value.deprecated);
	});

	it("licensesOf keeps every term, in written order", () => {
		assert.deepStrictEqual(
			SpdxExpression.licensesOf(parse("MIT OR Apache-2.0")).map((license) => license.id),
			["MIT", "Apache-2.0"],
		);
		assert.deepStrictEqual(
			SpdxExpression.licensesOf(parse("MIT AND Apache-2.0")).map((license) => license.id),
			["MIT", "Apache-2.0"],
		);
	});

	it("licensesOf answers where primaryLicense declines", () => {
		// The pairing the API depends on: AND yields none from one accessor and
		// the full set from the other.
		const expr = parse("MIT AND Apache-2.0");
		assert.isTrue(O.isNone(SpdxExpression.primaryLicense(expr)));
		assert.strictEqual(SpdxExpression.licensesOf(expr).length, 2);
	});

	it("licensesOf flattens nesting left to right", () => {
		assert.deepStrictEqual(
			SpdxExpression.licensesOf(parse("(MIT OR Apache-2.0) AND (GPL-3.0-only WITH Bison-exception-2.2)")).map(
				(license) => license.id,
			),
			["MIT", "Apache-2.0", "GPL-3.0-only"],
		);
	});

	it("licensesOf de-duplicates by identifier, keeping first appearance", () => {
		assert.deepStrictEqual(
			SpdxExpression.licensesOf(parse("(Apache-2.0 OR MIT) AND MIT")).map((license) => license.id),
			["Apache-2.0", "MIT"],
		);
	});

	it("licensesOf of a simple license is that one license", () => {
		assert.deepStrictEqual(
			SpdxExpression.licensesOf(parse("MIT")).map((license) => license.id),
			["MIT"],
		);
	});
});
