// Unit and property coverage for the frontmatter $schema declaration contract
// and the registry-backed resolver (P3 Task 4).
//
// The design doc's "$schema declarations" section is prescriptive: the
// four-variant classification (ByUrl / ByPath / Inline / ByName), the
// last-@ name[@version] split, the X[.Y[.Z]] integers-only version grammar,
// day-one EXACT version-segment resolution (prefix resolution is a documented
// future minor), and the unresolvable-version vs unknown-name distinction.
//
// Naming note: the design's indicative error names (SchemaDeclarationMissing,
// SchemaNameUnknown, SchemaVersionUnresolvable) finalize here with the house
// Error suffix; the declaration union members carry the SchemaDeclaration
// prefix so the package index stays collision-free.

import { fcRuns } from "@beep/fc-runs";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as P from "effect/Predicate";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { FrontmatterSchemaResolver } from "../../effected/markdown/FrontmatterResolver.ts";
import {
	SchemaDeclarationByName,
	SchemaDeclarationByPath,
	SchemaDeclarationByUrl,
	SchemaDeclarationInline,
	SchemaDeclarationInvalidError,
	SchemaDeclarationMissingError,
	SchemaNameUnknownError,
	SchemaResolver,
	SchemaVersionUnresolvableError,
} from "../../effected/markdown/FrontmatterResolver.ts";

const Skill = S.Struct({ $schema: S.optionalKey(S.String), title: S.String });
const BlogPost = S.Struct({ slug: S.String });

describe("SchemaResolver.classify", () => {
	it("classifies a string containing :// as ByUrl", () => {
		const result = SchemaResolver.classify("https://example.com/schema.json");
		assertSuccess(result, Result.getOrThrow(result));
		if (Result.isFailure(result)) return;
		assert.instanceOf(result.success, SchemaDeclarationByUrl);
		assert.strictEqual(result.success.url, "https://example.com/schema.json");
	});

	it("classifies ./, ../ and / leading strings as ByPath", () => {
		for (const path of ["./schemas/skill.json", "../shared/skill.json", "/abs/skill.json"]) {
			const result = SchemaResolver.classify(path);
			assertSuccess(result, Result.getOrThrow(result));
			if (Result.isFailure(result)) return;
			assert.instanceOf(result.success, SchemaDeclarationByPath);
			assert.strictEqual(result.success.path, path);
		}
	});

	it("classifies a mapping as Inline carrying the document", () => {
		const document = { type: "object", properties: { title: { type: "string" } } };
		const result = SchemaResolver.classify(document);
		assertSuccess(result, Result.getOrThrow(result));
		if (Result.isFailure(result)) return;
		assert.instanceOf(result.success, SchemaDeclarationInline);
		assert.deepStrictEqual(result.success.document, document);
	});

	it("classifies a bare name with no version", () => {
		const result = SchemaResolver.classify("blog-post");
		assertSuccess(result, Result.getOrThrow(result));
		if (Result.isFailure(result)) return;
		assert.instanceOf(result.success, SchemaDeclarationByName);
		assert.strictEqual(result.success.name, "blog-post");
		assert.isFalse(Object.hasOwn(result.success, "version"));
	});

	it("splits name and version at the last @", () => {
		const result = SchemaResolver.classify("skill@2.1.0");
		assertSuccess(result, Result.getOrThrow(result));
		if (Result.isFailure(result)) return;
		assert.instanceOf(result.success, SchemaDeclarationByName);
		assert.strictEqual(result.success.name, "skill");
		assert.strictEqual(result.success.version, "2.1.0");
	});

	it("keeps a leading npm scope @ with the name", () => {
		const scoped = SchemaResolver.classify("@savvy/skill@2.1.0");
		assertSuccess(scoped, Result.getOrThrow(scoped));
		if (Result.isFailure(scoped)) return;
		assert.instanceOf(scoped.success, SchemaDeclarationByName);
		assert.strictEqual(scoped.success.name, "@savvy/skill");
		assert.strictEqual(scoped.success.version, "2.1.0");

		const bare = SchemaResolver.classify("@savvy/skill");
		assertSuccess(bare, Result.getOrThrow(bare));
		if (Result.isFailure(bare)) return;
		assert.instanceOf(bare.success, SchemaDeclarationByName);
		assert.strictEqual(bare.success.name, "@savvy/skill");
		assert.isFalse(Object.hasOwn(bare.success, "version"));
	});

	it("accepts one, two and three integer version segments", () => {
		for (const [declaration, version] of [
			["skill@2", "2"],
			["okf/concept@0.1", "0.1"],
			["skill@2.1.0", "2.1.0"],
		] as const) {
			const result = SchemaResolver.classify(declaration);
			assertSuccess(result, Result.getOrThrow(result));
			if (Result.isFailure(result)) return;
			assert.instanceOf(result.success, SchemaDeclarationByName);
			assert.strictEqual(result.success.version, version);
		}
	});

	it("rejects version junk as a typed error", () => {
		for (const junk of [
			"skill@2.1.0-beta",
			"skill@2.1.0+build",
			"skill@^2.0",
			"skill@~2",
			"skill@>1.0",
			"skill@2.1.0.4",
			"skill@",
			"skill@x",
			"skill@2.",
			"skill@.1",
			"a@b@c",
		]) {
			const result = SchemaResolver.classify(junk);
			assertFailure(result, result.pipe(Result.flip, Result.getOrThrow));
			if (Result.isSuccess(result)) return;
			assert.instanceOf(result.failure, SchemaDeclarationInvalidError);
		}
	});

	it("rejects non-string non-mapping values and the empty string", () => {
		for (const value of ["", 42, true, null, undefined, ["skill"]]) {
			const result = SchemaResolver.classify(value);
			assertFailure(result, result.pipe(Result.flip, Result.getOrThrow));
			if (Result.isSuccess(result)) return;
			assert.instanceOf(result.failure, SchemaDeclarationInvalidError);
		}
	});

	it.prop(
		"classification totality: any string classifies without throwing, to exactly one shape",
		[S.String],
		([s]) => {
			const result = SchemaResolver.classify(s);
			if (Result.isSuccess(result)) {
				const declaration = result.success;
				if (s.includes("://")) {
					assert.instanceOf(declaration, SchemaDeclarationByUrl);
				} else if (s.startsWith("./") || s.startsWith("../") || s.startsWith("/")) {
					assert.instanceOf(declaration, SchemaDeclarationByPath);
				} else {
					assert.instanceOf(declaration, SchemaDeclarationByName);
				}
			}
		},
		{ arbitrary: fcRuns(300) },
	);

	const Segments = S.Array(S.Int.check(S.isBetween({ minimum: 0, maximum: 9999 }))).check(
		S.isBetweenLength(1, 3),
	);

	it.prop(
		"grammar round-trip: generated integer segments always classify, junk suffixes never do",
		[Segments],
		([parts]) => {
			const version = parts.join(".");
			const result = SchemaResolver.classify(`skill@${version}`);
			assertSuccess(result, Result.getOrThrow(result));
			if (Result.isSuccess(result)) {
				const declaration = result.success;
				assert.instanceOf(declaration, SchemaDeclarationByName);
				if (S.is(SchemaDeclarationByName)(declaration)) {
					assert.strictEqual(declaration.version, version);
				}
			}
			const junk = SchemaResolver.classify(`skill@${version}-beta`);
			assertFailure(junk, junk.pipe(Result.flip, Result.getOrThrow));
		},
		{ arbitrary: fcRuns(200) },
	);
});

describe("SchemaResolver.declarationOf", () => {
	it("extracts and classifies the $schema key", () => {
		const result = SchemaResolver.declarationOf({ $schema: "skill@2.1.0", title: "t" });
		assertSuccess(result, Result.getOrThrow(result));
		if (Result.isFailure(result)) return;
		assert.instanceOf(result.success, SchemaDeclarationByName);
	});

	it("yields undefined for a missing declaration by default", () => {
		const result = SchemaResolver.declarationOf({ title: "t" });
		assertSuccess(result, Result.getOrThrow(result));
		if (Result.isFailure(result)) return;
		assert.isUndefined(result.success);
	});

	it("fails typed for a missing declaration under requireDeclaration", () => {
		const result = SchemaResolver.declarationOf({ title: "t" }, { requireDeclaration: true });
		assertFailure(result, result.pipe(Result.flip, Result.getOrThrow));
		if (Result.isSuccess(result)) return;
		assert.instanceOf(result.failure, SchemaDeclarationMissingError);
	});

	it("treats non-mapping data as carrying no declaration", () => {
		for (const data of [null, undefined, "title: x", 42, ["a"]]) {
			const result = SchemaResolver.declarationOf(data);
			assertSuccess(result, Result.getOrThrow(result));
			if (Result.isFailure(result)) return;
			assert.isUndefined(result.success);
		}
	});

	it("propagates an invalid declaration value as a typed error", () => {
		const result = SchemaResolver.declarationOf({ $schema: 42 });
		assertFailure(result, result.pipe(Result.flip, Result.getOrThrow));
		if (Result.isSuccess(result)) return;
		assert.instanceOf(result.failure, SchemaDeclarationInvalidError);
	});
});

describe("SchemaResolver.fromRegistry", () => {
	const resolver = SchemaResolver.fromRegistry({
		"skill@2.1.0": Skill,
		"blog-post": BlogPost,
	});

	const declare = (value: string) => {
		const result = SchemaResolver.classify(value);
		assertSuccess(result, Result.getOrThrow(result));
		if (Result.isFailure(result)) throw new Error("unreachable");
		return result.success;
	};

	it.effect("resolves an identically written versioned registration", () =>
		Effect.gen(function* () {
			const schema = yield* resolver.resolve(declare("skill@2.1.0"), {});
			assert.strictEqual(schema, Skill);
		}),
	);

	it.effect("resolves a versionless registration for a versionless declaration", () =>
		Effect.gen(function* () {
			const schema = yield* resolver.resolve(declare("blog-post"), {});
			assert.strictEqual(schema, BlogPost);
		}),
	);

	it.effect("fails SchemaNameUnknownError for an unregistered name", () =>
		Effect.gen(function* () {
			const failure = yield* Effect.flip(resolver.resolve(declare("mystery"), {}));
			assert.instanceOf(failure, SchemaNameUnknownError);
		}),
	);

	it.effect("distinguishes a legal-but-unresolvable version prefix from an unknown name", () =>
		Effect.gen(function* () {
			// skill@2 is legal grammar (one segment) but resolves only against an
			// identically written registration — day-one exact matching, the
			// documented prefix-resolution future minor must NOT fire.
			const failure = yield* Effect.flip(resolver.resolve(declare("skill@2"), {}));
			assert.instanceOf(failure, SchemaVersionUnresolvableError);
			if (S.is(SchemaVersionUnresolvableError)(failure)) {
				assert.strictEqual(failure.name, "skill");
				assert.strictEqual(failure.version, "2");
			}
		}),
	);

	it.effect("resolves an identically written partial version", () =>
		Effect.gen(function* () {
			const partial = SchemaResolver.fromRegistry({ "skill@2": Skill });
			const schema = yield* partial.resolve(declare("skill@2"), {});
			assert.strictEqual(schema, Skill);
		}),
	);

	it.effect(
		"fails SchemaVersionUnresolvableError for a versionless declaration against versioned-only registrations",
		() =>
			Effect.gen(function* () {
				const failure = yield* Effect.flip(resolver.resolve(declare("skill"), {}));
				assert.instanceOf(failure, SchemaVersionUnresolvableError);
				if (S.is(SchemaVersionUnresolvableError)(failure)) {
					assert.strictEqual(failure.name, "skill");
					assert.isFalse(Object.hasOwn(failure, "version"));
				}
			}),
	);

	it.effect(
		"fails SchemaVersionUnresolvableError for a versioned declaration against a versionless-only registration",
		() =>
			Effect.gen(function* () {
				const failure = yield* Effect.flip(resolver.resolve(declare("blog-post@1"), {}));
				assert.instanceOf(failure, SchemaVersionUnresolvableError);
			}),
	);

	it.effect("compares version segments numerically, not textually", () =>
		Effect.gen(function* () {
			// "identically-written" modulo integer value: 02.1.00 and 2.1.0 carry
			// the same one-to-three integer segments.
			const schema = yield* resolver.resolve(declare("skill@02.1.00"), {});
			assert.strictEqual(schema, Skill);
		}),
	);

	it.effect("keeps adjacent large integers distinct in every version segment", () =>
		Effect.gen(function* () {
			for (const [lower, upper, paddedUpper] of [
				["9007199254740992", "9007199254740993", "009007199254740993"],
				["1.9007199254740992", "1.9007199254740993", "01.009007199254740993"],
				["1.2.9007199254740992", "1.2.9007199254740993", "01.002.009007199254740993"],
			] as const) {
				const large = SchemaResolver.fromRegistry({ [`skill@${lower}`]: Skill, [`skill@${upper}`]: BlogPost });
				assert.strictEqual(yield* large.resolve(declare(`skill@${lower}`), {}), Skill);
				assert.strictEqual(yield* large.resolve(declare(`skill@${upper}`), {}), BlogPost);
				assert.strictEqual(yield* large.resolve(declare(`skill@${paddedUpper}`), {}), BlogPost);
			}
		}),
	);

	it.effect("rejects an unregistered adjacent large integer in every version segment", () =>
		Effect.gen(function* () {
			for (const [registered, requested] of [
				["9007199254740992", "9007199254740993"],
				["1.9007199254740992", "1.9007199254740993"],
				["1.2.9007199254740992", "1.2.9007199254740993"],
			] as const) {
				const large = SchemaResolver.fromRegistry({ [`skill@${registered}`]: Skill });
				const failure = yield* Effect.flip(large.resolve(declare(`skill@${requested}`), {}));
				assert.instanceOf(failure, SchemaVersionUnresolvableError);
				assert.strictEqual(failure.name, "skill");
				assert.strictEqual(failure.version, requested);
			}
		}),
	);

	it.effect("canonicalizes zero segments without losing their count", () =>
		Effect.gen(function* () {
			const zeros = SchemaResolver.fromRegistry({ "skill@0": Skill, "skill@0.0": BlogPost, "skill@0.0.0": S.String });
			assert.strictEqual(yield* zeros.resolve(declare("skill@000"), {}), Skill);
			assert.strictEqual(yield* zeros.resolve(declare("skill@000.00"), {}), BlogPost);
			assert.strictEqual(yield* zeros.resolve(declare("skill@000.00.0000"), {}), S.String);
			const partial = SchemaResolver.fromRegistry({ "skill@9007199254740993": Skill });
			const failure = yield* Effect.flip(partial.resolve(declare("skill@9007199254740993.0"), {}));
			assert.instanceOf(failure, SchemaVersionUnresolvableError);
		}),
	);

	it("rejects duplicate large integer registrations with leading zeros", () => {
		assert.throws(() => SchemaResolver.fromRegistry({ "skill@9007199254740993": Skill, "skill@009007199254740993": BlogPost }));
	});

	it.effect("cannot resolve url, path or inline declarations", () =>
		Effect.gen(function* () {
			for (const value of ["https://example.com/s.json", "./local/s.json"]) {
				const failure = yield* Effect.flip(resolver.resolve(declare(value), {}));
				assert.instanceOf(failure, SchemaNameUnknownError);
			}
			const inline = SchemaResolver.classify({ type: "object" });
			assertSuccess(inline, Result.getOrThrow(inline));
			if (Result.isFailure(inline)) return;
			const failure = yield* Effect.flip(resolver.resolve(inline.success, {}));
			assert.instanceOf(failure, SchemaNameUnknownError);
		}),
	);

	it.effect("fails SchemaDeclarationMissingError when handed no declaration", () =>
		Effect.gen(function* () {
			const failure = yield* Effect.flip(resolver.resolve(undefined, { title: "t" }));
			assert.instanceOf(failure, SchemaDeclarationMissingError);
		}),
	);

	it("throws at construction for a registration key outside the name grammar", () => {
		assert.throws(() => SchemaResolver.fromRegistry({ "skill@^2.0": Skill }));
		assert.throws(() => SchemaResolver.fromRegistry({ "https://example.com/s.json": Skill }));
		assert.throws(() => SchemaResolver.fromRegistry({ "": Skill }));
	});

	it("throws at construction for registrations that collide numerically", () => {
		assert.throws(() => SchemaResolver.fromRegistry({ "skill@2.1.0": Skill, "skill@02.1.00": BlogPost }));
	});
});

describe("the resolver seam", () => {
	it.effect("supports whole-data dispatch with zero declaration handling", () =>
		Effect.gen(function* () {
			// The OKF model: the resolver sees the whole decoded frontmatter and
			// keys on OKF's `type` field, ignoring $schema entirely — no OKF code
			// in this package.
			const okf: FrontmatterSchemaResolver = {
				resolve: (_declaration, data) =>
					P.isObject(data) && data.type === "concept" ? Effect.succeed(Skill) : Effect.fail(SchemaDeclarationMissingError.make()),
			};
			const schema = yield* okf.resolve(undefined, { type: "concept", title: "t" });
			assert.strictEqual(schema, Skill);
			const failure = yield* Effect.flip(okf.resolve(undefined, { type: "log" }));
			assert.instanceOf(failure, SchemaDeclarationMissingError);
		}),
	);
});
