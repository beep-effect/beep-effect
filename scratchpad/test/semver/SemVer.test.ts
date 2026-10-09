import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Hash from "effect/Hash";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { InvalidVersionError, SemVer } from "../../effected/semver/index.ts";

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
				assert.instanceOf(e, Error);
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
			assert.deepStrictEqual(SemVer.max(versions).pipe(O.map(String)), O.some("2.0.0"));
			assert.deepStrictEqual(SemVer.min(versions).pipe(O.map(String)), O.some("1.0.0-alpha"));
			assert.isTrue(O.isNone(SemVer.max([])));
			assert.isTrue(O.isNone(SemVer.min([])));
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
			assert.isTrue(Result.isSuccess(SemVer.parseResult(" 1.2.3")));
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
			assert.isTrue(Result.isFailure(decodeExact(" 1.2.3")), "padded input is invalid");
			assert.isTrue(Result.isFailure(decodeExact("^1.2.3")));
			assert.isTrue(Result.isFailure(decodeExact("latest")));
		});

		it("PinnableVersionString additionally refuses build metadata", () => {
			const accepted = decodePinnable("10.0.0-rc.1");
			if (Result.isFailure(accepted)) {
				return assert.fail("a pinnable version string must decode");
			}
			assert.strictEqual(accepted.success, "10.0.0-rc.1");
			assert.isTrue(Result.isFailure(decodePinnable("1.2.3+build.42")));
			assert.isTrue(Result.isFailure(decodePinnable(" 1.2.3")));
		});
	});

	describe("JSON Schema export", () => {
		it("prerelease and build identifiers export their patterns", () => {
			const document = S.toJsonSchemaDocument(SemVer);
			assert.nestedPropertyVal(
				document,
				"definitions.SemVerEncoded.properties.prerelease.items.anyOf[0].pattern",
				"^[0-9]*[A-Za-z-][0-9A-Za-z-]*$",
			);
			assert.nestedPropertyVal(document, "definitions.SemVerEncoded.properties.build.items.pattern", "^[0-9A-Za-z-]+$");
		});
	});
});
