import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertNone, assertSome, assertSuccess } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Hash from "effect/Hash";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { InvalidVersionError, SemVer } from "../../effected/semver/index.ts";
import { SemVerBumpComponent, SemVerBumpOverflowError } from "../../effected/semver/SemVer.ts";

const SemVerBumpOverflowErrorJson = S.fromJsonString(SemVerBumpOverflowError);

describe("SemVer", () => {
	describe("parse", () => {
		it.effect("parses a full version", () =>
			Effect.gen(function* () {
				const v = yield* SemVer.parse("1.2.3-beta.1+build.42");
				assert.strictEqual(v.major, 1);
				assert.strictEqual(v.minor, 2);
				assert.strictEqual(v.patch, 3);
				assert.deepStrictEqual([...v.prerelease], ["beta", 1]);
				assert.deepStrictEqual([...v.build], ["build", "42"]);
			}),
		);

		it.effect("fails with InvalidVersionError carrying input and position", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(SemVer.parse("01.2.3"));
				assert.instanceOf(error, InvalidVersionError);
				assert.strictEqual(error._tag, "InvalidVersionError");
				assert.strictEqual(error.input, "01.2.3");
				assert.strictEqual(error.position, 0);
				assert.strictEqual(error.message, 'Invalid version string: "01.2.3" at position 0');
			}),
		);

		it.effect("rejects v-prefixed versions", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(SemVer.parse("v1.0.0"));
				assert.strictEqual(error._tag, "InvalidVersionError");
			}),
		);
	});

	describe("FromString", () => {
		it.effect("decodes a version string to a SemVer instance", () =>
			Effect.gen(function* () {
				const v = yield* S.decodeEffect(SemVer.FromString)("2.0.0-rc.1");
				assert.instanceOf(v, SemVer);
				assert.strictEqual(v.major, 2);
				assert.deepStrictEqual([...v.prerelease], ["rc", 1]);
			}),
		);

		it.effect("encodes back to the canonical string", () =>
			Effect.gen(function* () {
				const v = yield* SemVer.parse("1.2.3-beta.1+build.42");
				const encoded = yield* S.encodeUnknownEffect(SemVer.FromString)(v);
				assert.strictEqual(encoded, "1.2.3-beta.1+build.42");
			}),
		);

		it.effect("fails decoding invalid input with a SchemaError", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(S.decodeEffect(SemVer.FromString)("nope"));
				assert.strictEqual(error._tag, "SchemaError");
			}),
		);

		it.effect.prop("round-trips decode(encode(v))", [SemVer], ([v]) =>
			Effect.gen(function* () {
				const encoded = yield* S.encodeUnknownEffect(SemVer.FromString)(v);
				const decoded = yield* S.decodeEffect(SemVer.FromString)(encoded);
				assert.isTrue(Equal.equals(decoded, v), `expected ${decoded.toString()} to equal ${v.toString()}`);
				assert.deepStrictEqual([...decoded.build], [...v.build]);
			}),
		);
	});

	describe("make validation", () => {
		it("rejects negative components", () => {
			assert.throws(() => SemVer.make({ major: -1, minor: 0, patch: 0, prerelease: [], build: [] }));
		});

		it("rejects fractional components", () => {
			assert.throws(() => SemVer.make({ major: 1.5, minor: 0, patch: 0, prerelease: [], build: [] }));
		});

		it("rejects malformed prerelease identifiers", () => {
			assert.throws(() => SemVer.make({ major: 1, minor: 0, patch: 0, prerelease: ["not ok"], build: [] }));
		});

		it("rejects all-digit string prerelease identifiers", () => {
			assert.throws(() => SemVer.make({ major: 1, minor: 0, patch: 0, prerelease: ["007"], build: [] }));
		});
	});

	describe("comparison", () => {
		it.effect("instance methods agree with the spec", () =>
			Effect.gen(function* () {
				const a = yield* SemVer.parse("1.0.0");
				const b = yield* SemVer.parse("2.0.0");
				assert.strictEqual(a.compare(b), -1);
				assert.isTrue(a.lt(b));
				assert.isTrue(a.lte(b));
				assert.isTrue(b.gt(a));
				assert.isTrue(b.gte(a));
				assert.isTrue(a.neq(b));
				assert.isFalse(a.equal(b));
			}),
		);

		it("dual statics support both call forms", () => {
			const a = SemVer.of(1, 0, 0);
			const b = SemVer.of(2, 0, 0);
			assert.strictEqual(SemVer.compare(a, b), -1);
			assert.strictEqual(SemVer.compare(b)(a), -1);
			assert.isTrue(SemVer.lt(a, b));
			// Data-last: gt(that)(self) tests self > that.
			assert.isTrue(SemVer.gt(a)(b));
			assert.isTrue(SemVer.equal(a, SemVer.of(1, 0, 0, [], ["different", "build"])));
		});

		it("Order ignores build metadata; OrderWithBuild breaks ties", () => {
			const plain = SemVer.of(1, 0, 0);
			const withBuild = SemVer.of(1, 0, 0, [], ["abc"]);
			assert.strictEqual(SemVer.Order(plain, withBuild), 0);
			assert.isBelow(SemVer.OrderWithBuild(plain, withBuild), 0);
		});
	});

	describe("equality and hashing", () => {
		it("ignores build metadata but not prerelease (SemVer §10/§11)", () => {
			const a = SemVer.of(1, 2, 3, ["alpha", 1], ["build", "1"]);
			const b = SemVer.of(1, 2, 3, ["alpha", 1], ["build", "2"]);
			const c = SemVer.of(1, 2, 3, ["alpha", 2], ["build", "1"]);
			assert.isTrue(Equal.equals(a, b));
			assert.isFalse(Equal.equals(a, c));
		});

		it("hash agrees with equality across build metadata", () => {
			const a = SemVer.of(1, 2, 3, ["alpha", 1], ["build", "1"]);
			const b = SemVer.of(1, 2, 3, ["alpha", 1], ["build", "2"]);
			assert.strictEqual(Hash.hash(a), Hash.hash(b));
		});
	});

	describe("predicates", () => {
		it("isStable / isPrerelease", () => {
			assert.isTrue(SemVer.of(1, 0, 0).isStable);
			assert.isFalse(SemVer.of(1, 0, 0).isPrerelease);
			assert.isTrue(SemVer.of(1, 0, 0, ["rc", 1]).isPrerelease);
			assert.isFalse(SemVer.of(1, 0, 0, ["rc", 1]).isStable);
		});
	});

	describe("bump", () => {
		it("major/minor/patch reset lower components and metadata", () => {
			const v = SemVer.of(1, 2, 3, ["beta", 1], ["build"]);
			assert.strictEqual(v.bump.major().toString(), "2.0.0");
			assert.strictEqual(v.bump.minor().toString(), "1.3.0");
			assert.strictEqual(v.bump.patch().toString(), "1.2.4");
		});

		it("prerelease bump on a stable version starts the next patch prerelease", () => {
			assert.strictEqual(SemVer.of(1, 0, 0).bump.prerelease().toString(), "1.0.1-0");
			assert.strictEqual(SemVer.of(1, 0, 0).bump.prerelease("alpha").toString(), "1.0.1-alpha.0");
		});

		it("prerelease bump increments a trailing numeric identifier", () => {
			assert.strictEqual(SemVer.of(1, 0, 1, ["alpha", 0]).bump.prerelease().toString(), "1.0.1-alpha.1");
			assert.strictEqual(SemVer.of(1, 0, 1, ["alpha", 0]).bump.prerelease("alpha").toString(), "1.0.1-alpha.1");
		});

		it("switching prerelease identifiers resets the counter", () => {
			assert.strictEqual(SemVer.of(1, 0, 1, ["alpha", 4]).bump.prerelease("beta").toString(), "1.0.1-beta.0");
		});

		it("appends a counter to a non-numeric tail", () => {
			assert.strictEqual(SemVer.of(1, 0, 1, ["alpha"]).bump.prerelease().toString(), "1.0.1-alpha.0");
		});

		it("release strips prerelease and build", () => {
			assert.strictEqual(SemVer.of(1, 2, 3, ["rc", 1], ["meta"]).bump.release().toString(), "1.2.3");
		});

		it("major/minor/patch bump a prerelease version's numeric core directly — diverges from node-semver", () => {
			// node-semver: inc("2.0.0-beta.1", "major") === "2.0.0" (drops the prerelease
			// without incrementing, since the release target is already ahead of it).
			// This package always increments the requested component, prerelease or not.
			assert.strictEqual(SemVer.of(2, 0, 0, ["beta", 1]).bump.major().toString(), "3.0.0");
			assert.strictEqual(SemVer.of(1, 2, 3, ["beta", 1]).bump.minor().toString(), "1.3.0");
			assert.strictEqual(SemVer.of(1, 2, 3, ["beta", 1]).bump.patch().toString(), "1.2.4");
		});
	});

	describe("bump overflow", () => {
		const MAX = Number.MAX_SAFE_INTEGER;

		it("major throws an invariant error naming the component and the cap", () => {
			assert.throws(
				() => SemVer.of(MAX, 0, 0).bump.major(),
				new RegExp(`SemVerBump invariant violated: bumping "major".*${MAX}`),
			);
		});

		it("minor throws an invariant error naming the component and the cap", () => {
			assert.throws(
				() => SemVer.of(0, MAX, 0).bump.minor(),
				new RegExp(`SemVerBump invariant violated: bumping "minor".*${MAX}`),
			);
		});

		it("patch throws an invariant error naming the component and the cap", () => {
			assert.throws(
				() => SemVer.of(0, 0, MAX).bump.patch(),
				new RegExp(`SemVerBump invariant violated: bumping "patch".*${MAX}`),
			);
		});

		it("prerelease's trailing numeric identifier throws an invariant error naming the component and the cap", () => {
			assert.throws(
				() => SemVer.of(1, 0, 0, ["alpha", MAX]).bump.prerelease(),
				new RegExp(`SemVerBump invariant violated: bumping "prerelease".*${MAX}`),
			);
		});

		it("starting a prerelease from a stable version at the patch cap throws naming patch", () => {
			assert.throws(
				() => SemVer.of(1, 0, MAX).bump.prerelease(),
				new RegExp(`SemVerBump invariant violated: bumping "patch".*${MAX}`),
			);
		});

		it("carries the underlying schema failure as the error's cause", () => {
			try {
				SemVer.of(MAX, 0, 0).bump.major();
				assert.fail("expected bump.major() to throw");
			} catch (e) {
				assert.instanceOf(e, SemVerBumpOverflowError);
				assert.isDefined(e.cause);
			}
		});

		it("one below the cap bumps normally (control)", () => {
			assert.strictEqual(SemVer.of(MAX - 1, 0, 0).bump.major().major, MAX);
			assert.strictEqual(SemVer.of(0, MAX - 1, 0).bump.minor().minor, MAX);
			assert.strictEqual(SemVer.of(0, 0, MAX - 1).bump.patch().patch, MAX);
			assert.strictEqual([...SemVer.of(1, 0, 0, ["alpha", MAX - 1]).bump.prerelease().prerelease][1], MAX);
		});
	});

	describe("truncate", () => {
		it("truncates to release or to prerelease-with-no-build", () => {
			const v = SemVer.of(1, 2, 3, ["alpha", 1], ["build"]);
			assert.strictEqual(SemVer.truncate(v, "prerelease").toString(), "1.2.3");
			assert.strictEqual(SemVer.truncate(v, "build").toString(), "1.2.3-alpha.1");
			assert.strictEqual(SemVer.truncate("build")(v).toString(), "1.2.3-alpha.1");
		});
	});

	describe("collections", () => {
		const versions = [SemVer.of(2, 0, 0), SemVer.of(1, 0, 0, ["alpha"]), SemVer.of(1, 0, 0), SemVer.of(1, 5, 0)];

		it("sort ascending / rsort descending", () => {
			assert.deepStrictEqual(SemVer.sort(versions).map(String), ["1.0.0-alpha", "1.0.0", "1.5.0", "2.0.0"]);
			assert.deepStrictEqual(SemVer.rsort(versions).map(String), ["2.0.0", "1.5.0", "1.0.0", "1.0.0-alpha"]);
		});

		it("max / min return Options", () => {
			assertSome(SemVer.max(versions).pipe(O.map(String)), "2.0.0");
			assertSome(SemVer.min(versions).pipe(O.map(String)), "1.0.0-alpha");
			assertNone(SemVer.max([]));
			assertNone(SemVer.min([]));
		});

		it("groupBy returns an immutable record keyed by strategy", () => {
			const grouped = SemVer.groupBy([SemVer.of(1, 0, 0), SemVer.of(1, 5, 0), SemVer.of(2, 0, 0)], "major");
			assert.deepStrictEqual(Object.keys(grouped), ["1", "2"]);
			assert.deepStrictEqual(grouped["1"]?.map(String), ["1.0.0", "1.5.0"]);
		});

		it("latestByMajor / latestByMinor keep the highest per group", () => {
			const input = [
				SemVer.of(1, 0, 0),
				SemVer.of(1, 5, 0),
				SemVer.of(1, 5, 9),
				SemVer.of(2, 0, 0),
				SemVer.of(2, 1, 0),
			];
			assert.deepStrictEqual(SemVer.latestByMajor(input).map(String), ["1.5.9", "2.1.0"]);
			assert.deepStrictEqual(SemVer.latestByMinor(input).map(String), ["1.0.0", "1.5.9", "2.0.0", "2.1.0"]);
		});
	});

	describe("of", () => {
		it("constructs positionally with validation", () => {
			assert.strictEqual(SemVer.of(1, 2, 3, ["rc", 1], ["sha"]).toString(), "1.2.3-rc.1+sha");
		});
	});

	// `parseResult` is the primitive; `parse` derives from it via
	// `Effect.fromResult` and adds only the tracing span. Every row is checked
	// in BOTH directions so the sync path can never become the reason the two
	// drift — a future edit that re-derives the grammar on one side fails here.
	describe("Result parity", () => {
		const rows: ReadonlyArray<readonly [label: string, input: string]> = [
			["a bare version", "1.2.3"],
			["a prerelease", "1.2.3-beta.1"],
			["build metadata", "1.2.3+build.42"],
			["both", "1.2.3-beta.1+build.42"],
			["zeros", "0.0.0"],
			["a v prefix", "v1.2.3"],
			["a leading zero", "01.2.3"],
			["an incomplete version", "1.2"],
			["trailing junk", "1.2.3junk"],
			["the empty string", ""],
		];

		for (const [label, input] of rows) {
			it.effect(`parse and parseResult agree on ${label}`, () =>
				Effect.gen(function* () {
					const viaEffect = yield* Effect.result(SemVer.parse(input));
					assert.deepStrictEqual(SemVer.parseResult(input), viaEffect);
				}),
			);
		}

		it("parseResult succeeds with a real SemVer", () => {
			const result = SemVer.parseResult("1.2.3-beta.1+build.42");
			if (Result.isFailure(result)) {
				return assert.fail("expected a successful parse");
			}
			assert.instanceOf(result.success, SemVer);
			assert.strictEqual(result.success.toString(), "1.2.3-beta.1+build.42");
		});

		it("parseResult carries the typed failure, not a throw", () => {
			const result = SemVer.parseResult("01.2.3");
			if (Result.isSuccess(result)) {
				return assert.fail("expected a typed parse failure");
			}
			assert.instanceOf(result.failure, InvalidVersionError);
			assert.strictEqual(result.failure.input, "01.2.3");
			assert.strictEqual(result.failure.position, 0);
		});
	});

	describe("isValid", () => {
		it("accepts exactly one version, build metadata included", () => {
			assert.isTrue(SemVer.isValid("1.2.3"));
			assert.isTrue(SemVer.isValid("0.0.0"));
			assert.isTrue(SemVer.isValid("1.2.3-rc.1"));
			// Build metadata is valid grammar; only the PINNABLE notion excludes it.
			assert.isTrue(SemVer.isValid("1.2.3+build.42"));
			assert.isTrue(SemVer.isValid("1.2.3-rc.1+build"));
		});

		it("rejects everything that is not exactly one version", () => {
			assert.isFalse(SemVer.isValid("v1.2.3"));
			assert.isFalse(SemVer.isValid("^1.2.3"));
			assert.isFalse(SemVer.isValid("1.2"));
			assert.isFalse(SemVer.isValid("1"));
			assert.isFalse(SemVer.isValid("01.2.3"));
			assert.isFalse(SemVer.isValid("latest"));
			assert.isFalse(SemVer.isValid(""));
		});

		it("rejects padded input that parseResult would trim into validity", () => {
			// The posture, stated as a control pair: parseResult TRIMS (matching
			// node-semver), so the boolean must diverge from it on exactly this
			// class of input — whitespace is the caller's bug to surface, never
			// this package's to hide. A version of isValid written as a bare
			// parseResult success check passes every other case and fails here.
			assertSuccess(SemVer.parseResult(" 1.2.3"), SemVer.of(1, 2, 3));
			assert.isFalse(SemVer.isValid(" 1.2.3"));
			assert.isFalse(SemVer.isValid("1.2.3 "));
			assert.isFalse(SemVer.isValid(" 1.2.3 "));
			assert.isFalse(SemVer.isValid("1.2.3\n"));
			assert.isFalse(SemVer.isValid("\t1.2.3"));
		});
	});

	describe("isPinnable", () => {
		it("is isValid minus build metadata", () => {
			assert.isTrue(SemVer.isPinnable("1.2.3"));
			assert.isTrue(SemVer.isPinnable("10.0.0-rc.1"));
			assert.isFalse(SemVer.isPinnable("1.2.3+build.42"), "build metadata is valid grammar but not pinnable");
			assert.isFalse(SemVer.isPinnable("1.2.3-rc.1+build"));
		});

		it("shares isValid's whitespace posture and grammar", () => {
			assert.isFalse(SemVer.isPinnable(" 1.2.3"));
			assert.isFalse(SemVer.isPinnable("1.2.3 "));
			assert.isFalse(SemVer.isPinnable("^1.2.3"));
			assert.isFalse(SemVer.isPinnable("1.2"));
			assert.isFalse(SemVer.isPinnable("latest"));
		});
	});

	describe("ExactVersionString and PinnableVersionString", () => {
		const decodeExact = S.decodeUnknownResult(SemVer.ExactVersionString);
		const decodePinnable = S.decodeUnknownResult(SemVer.PinnableVersionString);

		it("ExactVersionString accepts exactly what isValid accepts, and the type stays string", () => {
			const accepted = decodeExact("1.2.3+build.42");
			if (Result.isFailure(accepted)) {
				return assert.fail("a valid version string must decode");
			}
			// The point of the schema: a consumer struct field stays a plain string.
			assert.strictEqual(accepted.success, "1.2.3+build.42");
			const padded = decodeExact(" 1.2.3");
			assertFailure(padded, padded.pipe(Result.flip, Result.getOrThrow));
			const range = decodeExact("^1.2.3");
			assertFailure(range, range.pipe(Result.flip, Result.getOrThrow));
			const tag = decodeExact("latest");
			assertFailure(tag, tag.pipe(Result.flip, Result.getOrThrow));
		});

		it("PinnableVersionString additionally refuses build metadata", () => {
			const accepted = decodePinnable("10.0.0-rc.1");
			if (Result.isFailure(accepted)) {
				return assert.fail("a pinnable version string must decode");
			}
			assert.strictEqual(accepted.success, "10.0.0-rc.1");
			const build = decodePinnable("1.2.3+build.42");
			assertFailure(build, build.pipe(Result.flip, Result.getOrThrow));
			const padded = decodePinnable(" 1.2.3");
			assertFailure(padded, padded.pipe(Result.flip, Result.getOrThrow));
		});
	});

	describe("JSON Schema export", () => {
		it("prerelease and build identifiers export their patterns", () => {
			const document = S.toJsonSchemaDocument(SemVer);
			assert.nestedPropertyVal(
				document,
				"definitions.@beep/scratchpad/effected/semver/SemVer/SemVerEncoded.properties.prerelease.items.anyOf[0].pattern",
				"^[0-9]*[A-Za-z-][0-9A-Za-z-]*$",
			);
			assert.nestedPropertyVal(document, "definitions.@beep/scratchpad/effected/semver/SemVer/SemVerEncoded.properties.build.items.pattern", "^[0-9A-Za-z-]+$");
		});
	});
});

describe("SemVer round-1 regressions", () => {
	it("annotates both string schemas and their filters without changing validation", () => {
		for (const [name, schema, valid] of [
			["ExactVersionString", SemVer.ExactVersionString, SemVer.isValid],
			["PinnableVersionString", SemVer.PinnableVersionString, SemVer.isPinnable],
		] as const) {
			const prefix = "@beep/scratchpad/effected/semver/SemVer/";
			assert.strictEqual(S.resolveAnnotations(schema)?.identifier, `${prefix}${name}`);
			assert.isString(S.resolveAnnotations(schema)?.title);
			assert.isString(S.resolveAnnotations(schema)?.description);
			const group = schema.ast.checks?.[0];
			if (group?._tag !== "FilterGroup") return assert.fail("expected a metadata-bearing check group");
			const check = group.checks[0];
			assert.strictEqual(check?.annotations?.identifier, `${prefix}${name}Check`);
			assert.isString(check?.annotations?.title);
			assert.isString(check?.annotations?.description);
			for (const input of ["1.2.3", "1.2.3-alpha.0", "1.2.3+build", " 1.2.3", "1.2.3 ", "^1.2.3", "1.2", "latest", "01.2.3", ""]) {
				const result = S.decodeResult(schema)(input);
				assert.strictEqual(Result.isSuccess(result), valid(input), `${name}: ${input}`);
				if (Result.isSuccess(result)) assert.strictEqual(result.success, input);
			}
		}
	});

	it.effect("bump overflow exposes structured components and a serializable Defect cause", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual(SemVerBumpComponent.literals, ["major", "minor", "patch", "prerelease"]);
			assert.strictEqual(SemVerBumpComponent.ast.annotations?.identifier, "@beep/scratchpad/effected/semver/SemVer/SemVerBumpComponent");
			const max = Number.MAX_SAFE_INTEGER;
			const rows = [
				["major", () => SemVer.of(max, 0, 0).bump.major()],
				["minor", () => SemVer.of(0, max, 0).bump.minor()],
				["patch", () => SemVer.of(0, 0, max).bump.patch()],
				["prerelease", () => SemVer.of(1, 0, 0, ["alpha", max]).bump.prerelease()],
			] as const;
			for (const [component, bump] of rows) {
				const result = Result.try(bump);
				if (Result.isSuccess(result)) return assert.fail("expected bump to fail");
				const error = result.failure;
				if (!S.is(SemVerBumpOverflowError)(error)) return assert.fail("expected a tagged overflow error");
				assert.strictEqual(error.component, component);
				assert.include(error.message, `bumping "${component}"`);
				const encoded = yield* S.encodeEffect(SemVerBumpOverflowError)(error);
				assert.strictEqual(encoded.component, component);
				assert.isTrue(P.isObject(encoded.cause));
				assert.property(encoded.cause, "message");
				assert.property(encoded.cause, "stack");
				const json = yield* S.encodeEffect(SemVerBumpOverflowErrorJson)(error);
				const decoded = yield* S.decodeEffect(SemVerBumpOverflowErrorJson)(json);
				assert.strictEqual(decoded.component, component);
				assert.strictEqual(decoded.message, error.message);
				assert.isTrue(P.isError(decoded.cause));
				const recoded = yield* S.encodeEffect(SemVerBumpOverflowError)(decoded);
				assert.deepStrictEqual(recoded.cause, encoded.cause);
			}
		}),
	);

	it("sorts into fresh arrays and keeps input order for equal precedence", () => {
		const first = SemVer.of(1, 0, 0, [], ["z"]);
		const second = SemVer.of(1, 0, 0, [], ["a"]);
		const lower = SemVer.of(1, 0, 0, ["alpha"]);
		const higher = SemVer.of(2, 0, 0);
		const versions = [higher, first, lower, second];
		const ascending = SemVer.sort(versions);
		const descending = SemVer.rsort(versions);
		assert.deepStrictEqual(ascending.map(String), ["1.0.0-alpha", "1.0.0+z", "1.0.0+a", "2.0.0"]);
		assert.deepStrictEqual(descending.map(String), ["2.0.0", "1.0.0+z", "1.0.0+a", "1.0.0-alpha"]);
		assert.notStrictEqual(ascending, versions);
		assert.notStrictEqual(descending, versions);
		assert.deepStrictEqual(versions, [higher, first, lower, second]);
		const empty: ReadonlyArray<SemVer> = [];
		assert.notStrictEqual(SemVer.sort(empty), empty);
		assert.notStrictEqual(SemVer.rsort(empty), empty);
	});

	it("groupBy preserves sorted group and member order for every strategy", () => {
		const versions = [
			SemVer.of(2, 0, 0), SemVer.of(1, 5, 1), SemVer.of(1, 0, 0, [], ["z"]),
			SemVer.of(1, 0, 0, ["alpha"]), SemVer.of(1, 0, 0, [], ["a"]),
		];
		const major = SemVer.groupBy(versions, "major");
		assert.deepStrictEqual(R.keys(major), ["1", "2"]);
		assert.deepStrictEqual(major["1"]?.map(String), ["1.0.0-alpha", "1.0.0+z", "1.0.0+a", "1.5.1"]);
		for (const strategy of ["minor", "patch"] as const) {
			const grouped = SemVer.groupBy(versions, strategy);
			const key = strategy === "minor" ? "1.0" : "1.0.0";
			assert.deepStrictEqual(R.keys(grouped), [key, strategy === "minor" ? "1.5" : "1.5.1", strategy === "minor" ? "2.0" : "2.0.0"]);
			assert.deepStrictEqual(grouped[key]?.map(String), ["1.0.0-alpha", "1.0.0+z", "1.0.0+a"]);
		}
		assert.deepStrictEqual(SemVer.groupBy([], "major"), {});
	});
});
