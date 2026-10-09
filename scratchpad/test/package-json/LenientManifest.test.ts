// The shape-lenient discovery tier. The contract under test, pinned per the
// tsdoctor-monorepo dogfood ask (round 1, item 3):
//
//   - arbitrary real-world JSON recovers `name`/`version` whenever they are
//     string-shaped — including shapes every strict tier rejects (a legacy
//     uppercase name, a non-semver `"1.0"`);
//   - one malformed field NEVER fails the document: it degrades to absence,
//     is preserved verbatim in `rest`, and is reported on `issues`;
//   - leniency is per-field, not per-syntax — invalid JSON text and a
//     non-object document stay typed errors.

import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import { LenientManifest } from "../../effected/package-json/LenientManifest.ts";
import { PackageManifest } from "../../effected/package-json/PackageManifest.ts";

const unwrap = <A, E>(result: Result.Result<A, E>): A => {
	assertTrue(Result.isSuccess(result), "expected the lenient decode to succeed");
	return result.success;
};

const unwrapFailure = <A, E>(result: Result.Result<A, E>): E => {
	assertTrue(Result.isFailure(result), "expected the lenient decode to fail");
	return result.failure;
};

describe("LenientManifest.decodeResult", () => {
	// The consumer's bar: string-shaped name/version recovered even when every
	// strict tier rejects them.
	it("recovers a legacy uppercase name and a non-semver version", () => {
		const manifest = unwrap(LenientManifest.decodeResult({ name: "JSONStream", version: "1.0" }));
		assert.strictEqual(manifest.name, "JSONStream");
		assert.strictEqual(manifest.version, "1.0");
		assert.deepStrictEqual(manifest.issues, []);
	});

	// The contrast pinned: the presence-lenient tier still rejects the same
	// document, which is exactly why this tier exists.
	it.effect("PackageManifest.decode still rejects the non-semver version", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(PackageManifest.decode({ name: "JSONStream", version: "1.0" }));
			assert.strictEqual(error._tag, "PackageDecodeError");
		}),
	);

	it("degrades a number-shaped name to absence, preserved in rest and reported", () => {
		const manifest = unwrap(LenientManifest.decodeResult({ name: 42, version: "2.0.0" }));
		assert.strictEqual(manifest.name, undefined);
		assert.strictEqual(manifest.version, "2.0.0");
		assert.strictEqual(manifest.rest?.name, 42);
		assert.deepStrictEqual(manifest.issues, [{ field: "name", expected: "a string", value: 42 }]);
	});

	it("degrades a malformed license without touching its neighbors", () => {
		const manifest = unwrap(LenientManifest.decodeResult({ name: "pkg", version: "1.0.0", license: { type: "MIT" } }));
		assert.strictEqual(manifest.name, "pkg");
		assert.strictEqual(manifest.license, undefined);
		assert.deepStrictEqual(manifest.rest?.license, { type: "MIT" });
		assert.strictEqual(manifest.issues.length, 1);
		assert.strictEqual(manifest.issues[0]?.field, "license");
	});

	// A document malformed in MANY fields still never fails — every degradation
	// is reported independently.
	it("never fails the document: multiple junk fields all degrade and report", () => {
		const manifest = unwrap(
			LenientManifest.decodeResult({
				name: ["not", "a", "string"],
				version: 1,
				private: "true",
				keywords: ["ok", 7],
				scripts: { build: "tsc", broken: null },
				author: 9,
			}),
		);
		assert.strictEqual(manifest.name, undefined);
		assert.strictEqual(manifest.version, undefined);
		assert.strictEqual(manifest.private, undefined);
		// A non-boolean `private` degrades rather than coercing: isPrivate false.
		assert.isFalse(manifest.isPrivate);
		assert.deepStrictEqual(manifest.issues.map((issue) => issue.field).sort(), [
			"author",
			"keywords",
			"name",
			"private",
			"scripts",
			"version",
		]);
		// Every degraded raw value is preserved verbatim.
		assert.deepStrictEqual(manifest.rest?.keywords, ["ok", 7]);
		assert.strictEqual(manifest.rest?.private, "true");
	});

	// Degradation granularity is the top-level field: one junk entry degrades
	// its whole map, with the raw map still in rest.
	it("degrades a dependency map wholesale when one entry is junk", () => {
		const manifest = unwrap(
			LenientManifest.decodeResult({
				name: "pkg",
				dependencies: { effect: "^4.0.0", broken: 7 },
				devDependencies: { vitest: "^4.0.0" },
			}),
		);
		assert.strictEqual(manifest.dependencies, undefined);
		assert.deepStrictEqual(manifest.devDependencies, { vitest: "^4.0.0" });
		assert.deepStrictEqual(manifest.rest?.dependencies, { effect: "^4.0.0", broken: 7 });
		assert.deepStrictEqual(
			manifest.issues.map((issue) => issue.field),
			["dependencies"],
		);
	});

	it("keeps unknown top-level fields in rest without reporting issues", () => {
		const manifest = unwrap(
			LenientManifest.decodeResult({ name: "pkg", types: "./index.d.ts", "//": "junk comment field" }),
		);
		assert.strictEqual(manifest.rest?.types, "./index.d.ts");
		assert.strictEqual(manifest.rest?.["//"], "junk comment field");
		assert.deepStrictEqual(manifest.issues, []);
	});

	// A manifest key named after an Object.prototype member must be treated as
	// unknown, not resolved through the prototype chain of the guard table.
	it("treats prototype-named keys as ordinary unknown keys", () => {
		const manifest = unwrap(LenientManifest.decodeResult({ name: "pkg", toString: "oops", constructor: 1 }));
		// Own-property reads: a plain `.toString` access type-resolves to the
		// Object.prototype member rather than the stored data key.
		assert.strictEqual(Object.getOwnPropertyDescriptor(manifest.rest ?? {}, "toString")?.value, "oops");
		assert.strictEqual(Object.getOwnPropertyDescriptor(manifest.rest ?? {}, "constructor")?.value, 1);
		assert.deepStrictEqual(manifest.issues, []);
	});

	it("decodes an empty object: everything absent, rest empty, no issues", () => {
		const manifest = unwrap(LenientManifest.decodeResult({}));
		assert.strictEqual(manifest.name, undefined);
		assert.strictEqual(manifest.version, undefined);
		assert.deepStrictEqual(manifest.issues, []);
		assert.deepStrictEqual({ ...manifest.rest }, {});
	});

	it("keeps well-formed structured fields: author object, bin map, exports", () => {
		const manifest = unwrap(
			LenientManifest.decodeResult({
				author: { name: "Dee", twitter: "@dee" },
				contributors: ["Ann <ann@x.dev>", { name: "Bob" }],
				bin: { cli: "./bin/cli.js" },
				exports: { ".": { import: "./index.js" } },
				engines: { node: ">=22" },
			}),
		);
		assert.deepStrictEqual(manifest.author, { name: "Dee", twitter: "@dee" });
		assert.deepStrictEqual(manifest.contributors, ["Ann <ann@x.dev>", { name: "Bob" }]);
		assert.deepStrictEqual(manifest.bin, { cli: "./bin/cli.js" });
		assert.deepStrictEqual(manifest.exports, { ".": { import: "./index.js" } });
		assert.deepStrictEqual(manifest.engines, { node: ">=22" });
		assert.deepStrictEqual(manifest.issues, []);
	});

	// Zero issues does not mean the strict tiers would accept the document —
	// the permissive shapes check JSON shape, not npm semantics.
	it.effect("zero issues is not strict validity", () =>
		Effect.gen(function* () {
			const input = { name: "UPPER CASE!!", version: "not-even-close" };
			const manifest = unwrap(LenientManifest.decodeResult(input));
			assert.deepStrictEqual(manifest.issues, []);
			const error = yield* Effect.flip(PackageManifest.decode(input));
			assert.strictEqual(error._tag, "PackageDecodeError");
		}),
	);

	// Leniency is per-field, never per-document-shape: a non-object value is
	// the one failure, typed, with the SchemaError preserved as cause.
	it("fails typed on null, arrays and scalars", () => {
		for (const input of [null, ["a"], 42, "text"]) {
			const error = unwrapFailure(LenientManifest.decodeResult(input));
			assert.strictEqual(error._tag, "PackageDecodeError");
			assertTrue(P.hasProperty(error.cause, "_tag"));
			assert.strictEqual(error.cause._tag, "SchemaError");
		}
	});
});

describe("LenientManifest.decode (Effect form)", () => {
	it.effect("derives from decodeResult: same success", () =>
		Effect.gen(function* () {
			const manifest = yield* LenientManifest.decode({ name: 42, version: "1.0" });
			assert.strictEqual(manifest.version, "1.0");
			assert.strictEqual(manifest.issues[0]?.field, "name");
		}),
	);

	it.effect("fails typed on a non-object input", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(LenientManifest.decode(null));
			assert.strictEqual(error._tag, "PackageDecodeError");
		}),
	);
});

describe("LenientManifest.parseResult", () => {
	it("parses text and decodes leniently", () => {
		const manifest = unwrap(LenientManifest.parseResult('{"name": "pkg", "version": 7, "license": "SEE LICENSE"}'));
		assert.strictEqual(manifest.name, "pkg");
		assert.strictEqual(manifest.version, undefined);
		assert.strictEqual(manifest.license, "SEE LICENSE");
		assert.deepStrictEqual(
			manifest.issues.map((issue) => issue.field),
			["version"],
		);
	});

	// The JSON.parse own-`__proto__` document: the raw value must land in rest
	// as data without polluting any prototype.
	it("carries an own __proto__ key as data without prototype pollution", () => {
		const manifest = unwrap(LenientManifest.parseResult('{"name": "pkg", "__proto__": {"polluted": true}}'));
		// Own-property read (a direct `.__proto__` access is the deprecated
		// prototype accessor, which is the very thing this test proves inert).
		const protoEntry = Object.getOwnPropertyDescriptor(manifest.rest ?? {}, "__proto__")?.value;
		assert.deepStrictEqual(protoEntry, { polluted: true });
		const fresh: { readonly polluted?: boolean } = {};
		assert.strictEqual(fresh.polluted, undefined);
		assert.deepStrictEqual(manifest.issues, []);
	});

	it("fails typed on invalid JSON text", () => {
		const error = unwrapFailure(LenientManifest.parseResult("{not json"));
		assert.strictEqual(error._tag, "PackageJsonSyntaxError");
		assert.strictEqual(error.reason, "invalid-json");
	});

	it("fails typed on JSON text that is not an object", () => {
		for (const text of ["[1,2]", "42", '"str"', "null"]) {
			const error = unwrapFailure(LenientManifest.parseResult(text));
			assert.strictEqual(error._tag, "PackageJsonSyntaxError");
			assert.strictEqual(error.reason, "not-an-object");
		}
	});
});

describe("LenientManifest.parse (Effect form)", () => {
	it.effect("derives from parseResult: same success and failure", () =>
		Effect.gen(function* () {
			const manifest = yield* LenientManifest.parse('{"private": true, "type": "module"}');
			assert.isTrue(manifest.isPrivate);
			assert.isTrue(manifest.isESM);
			const error = yield* Effect.flip(LenientManifest.parse("nope"));
			assert.strictEqual(error._tag, "PackageJsonSyntaxError");
		}),
	);
});

describe("LenientManifest getters", () => {
	it("isESM is an exact comparison — a kept but miscased type is not ESM", () => {
		const manifest = unwrap(LenientManifest.decodeResult({ type: "Module" }));
		assert.strictEqual(manifest.type, "Module");
		assert.isFalse(manifest.isESM);
		assert.isTrue(unwrap(LenientManifest.decodeResult({ type: "module" })).isESM);
	});
});
