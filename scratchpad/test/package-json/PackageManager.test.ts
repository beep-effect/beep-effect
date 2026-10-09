// The `packageManager` field: `<name>@<version>[+<integrity>]`.
//
// Two of the three components are shared verbatim with `@effected/npm`'s
// `PackageManagerPin` and are tested here for the FIELD's behaviour, not the
// pin's: the version through `@effected/semver`'s strict parse, the integrity
// through npm's `CorepackIntegrityHash`. The third — the name — is deliberately
// looser than the pin's four literals, and the latitude has its own suite
// below.

import { assert, describe, it } from "@effect/vitest";
import { CorepackIntegrityHash, IntegrityHash } from "../../effected/npm/index.ts";
import { SemVer } from "../../effected/semver/index.ts";
import { Effect, Option, Result, Schema } from "effect";
import { PackageManager } from "../../effected/package-json/PackageManager.ts";

const decode = Schema.decodeUnknownEffect(PackageManager.FromString);
const encode = Schema.encodeUnknownEffect(PackageManager.FromString);

describe("PackageManager.FromString", () => {
	it.effect("parses name, version and integrity", () =>
		Effect.gen(function* () {
			const pm = yield* decode("pnpm@10.33.0+sha512.abc");
			assert.strictEqual(pm.name, "pnpm");
			assert.strictEqual(pm.version, "10.33.0");
			assert.deepStrictEqual(pm.integrity, Option.some("sha512.abc"));
			assert.isTrue(pm.hasIntegrity);
		}),
	);

	it.effect("parses without integrity", () =>
		Effect.gen(function* () {
			const pm = yield* decode("pnpm@10.33.0");
			assert.deepStrictEqual(pm.integrity, Option.none());
			assert.isFalse(pm.hasIntegrity);
		}),
	);

	it.effect("round-trips encode(decode)", () =>
		Effect.gen(function* () {
			for (const input of ["pnpm@10.33.0+sha512.abc", "yarn@4.1.0", "npm@10.2.3-beta.1", "bun@1.2.20"]) {
				const pm = yield* decode(input);
				assert.strictEqual(yield* encode(pm), input);
			}
		}),
	);

	it.effect("rejects an invalid format", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(decode("not-a-pm"));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);

	// A well-formed `name@version+<integrity>` whose integrity is not a valid
	// `IntegrityHash` must fail typed through the decode, never construct the
	// branded field and escape as an unhandled defect.
	it.effect("rejects a malformed integrity as a typed failure, not a defect", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(decode("pnpm@10.33.0+GARBAGE!!"));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);

	// The `packageManager` field only ever carries corepack's `<algo>.<hex>`
	// integrity. A valid SRI or yarn `10c0/` form — accepted by the wider
	// `IntegrityHash` brand — is too loose here and must fail typed, never
	// construct the field and escape as a defect.
	it.effect("rejects an SRI integrity (not the corepack form)", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(decode("pnpm@10.33.0+sha512-abcd1234=="));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);

	it.effect("rejects a yarn 10c0/ checksum integrity (not the corepack form)", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(decode("pnpm@10.33.0+10c0/abcdef0123"));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);

	it.effect("accepts a real corepack sha512.<hex> integrity", () =>
		Effect.gen(function* () {
			const pm = yield* decode("pnpm@10.33.0+sha512.deadbeef");
			assert.deepStrictEqual(pm.integrity, Option.some("sha512.deadbeef"));
			assert.isTrue(pm.hasIntegrity);
		}),
	);

	// corepack's own package.json pins yarn with a sha224 tail; the shared
	// schema admits it and this field must too.
	it.effect("accepts corepack's sha224 default-pin integrity", () =>
		Effect.gen(function* () {
			const input = "yarn@4.12.0+sha224.877304e3c9e5b53431969ee2ca17ee44f366533b0da5a4ba9c2bd447";
			const pm = yield* decode(input);
			assert.strictEqual(yield* encode(pm), input);
		}),
	);

	// The first `+` after the version begins the integrity, always. Under the
	// semver reading, the version here would be "10.33.0+sha512.abc" with no
	// integrity — both assertions fail under that split.
	it.effect("the first + begins the integrity, never semver build metadata", () =>
		Effect.gen(function* () {
			const pm = yield* decode("pnpm@10.33.0+sha512.abc");
			assert.strictEqual(pm.version, "10.33.0");
			assert.deepStrictEqual(pm.integrity, Option.some("sha512.abc"));
		}),
	);

	// `deadbeef` is a syntactically valid semver build identifier, so a parser
	// that fell back to build-metadata parsing would ACCEPT this input.
	it.effect("a valid build-metadata tail that is not a corepack hash still fails", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(decode("pnpm@10.33.0+deadbeef"));
			assert.strictEqual(error._tag, "SchemaError");
			assert.include(String(error), "integrity");
		}),
	);
});

// The strictening. Each of these was ACCEPTED by the previous regex-level
// version grammar (`\d+\.\d+\.\d+(?:-[a-zA-Z0-9._-]+)?`) and is rejected by
// `@effected/semver`'s strict parse — the same validation corepack performs
// with `semver.valid`. Reinstating that regex turns this whole block red.
describe("PackageManager.FromString version rejection matrix", () => {
	const rejects = (input: string, why: string) =>
		it.effect(`rejects ${JSON.stringify(input)} — ${why}`, () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(decode(input));
				assert.strictEqual(error._tag, "SchemaError");
				assert.include(String(error), "version", "the failure must name the component that failed");
			}),
		);

	// Leading zeros on a numeric component are not SemVer 2.0.0 (§2).
	rejects("pnpm@01.2.3", "leading zero on major");
	rejects("pnpm@1.02.3", "leading zero on minor");
	rejects("pnpm@1.2.03", "leading zero on patch");
	// Leading zeros on a NUMERIC prerelease identifier are not valid either (§9);
	// an alphanumeric identifier with a leading zero (`0rc`) is fine.
	rejects("pnpm@1.2.3-01", "leading zero on a numeric prerelease identifier");
	// An empty prerelease identifier (`a..b`) is malformed (§9).
	rejects("pnpm@1.2.3-a..b", "empty prerelease identifier");
	rejects("pnpm@1.2.3-", "empty prerelease");
	// Ranges, partials and dist-tags were already rejected and stay rejected.
	rejects("pnpm@^9.0.0", "range");
	rejects("pnpm@9", "partial version");
	rejects("pnpm@9.1", "partial version");
	rejects("pnpm@latest", "dist-tag");
	rejects("pnpm@v1.2.3", "v prefix");
	rejects("pnpm@", "empty version");
	// Padded version substrings: `SemVer.isPinnable` refuses surrounding
	// whitespace, where a bare `SemVer.parseResult` check TRIMS and silently
	// canonicalizes — these two discriminate the shared export from that mutant.
	rejects("pnpm@ 10.33.0", "leading whitespace on the version");
	rejects("pnpm@10.33.0 ", "trailing whitespace on the version");

	it.effect("still accepts the prerelease forms that ARE valid", () =>
		Effect.gen(function* () {
			for (const input of ["pnpm@1.2.3-rc.1", "pnpm@1.2.3-0rc", "pnpm@1.2.3-alpha.0", "pnpm@0.0.0"]) {
				const pm = yield* decode(input);
				assert.strictEqual(yield* encode(pm), input, input);
			}
		}),
	);

	// The field schema, not just the codec: a directly-constructed value with a
	// bad version is bad wiring, and must not produce a manifest string that
	// re-parses differently (or not at all).
	it("a malformed version is rejected at construction", () => {
		assert.throws(() => PackageManager.make({ name: "pnpm", version: "01.2.3", integrity: Option.none() }));
		assert.throws(() => PackageManager.make({ name: "pnpm", version: "latest", integrity: Option.none() }));
		// Build metadata is inexpressible in the grammar — the `+` position is
		// spoken for by the integrity — so it is refused at construction rather
		// than encoding to a string that re-parses as an invalid integrity.
		assert.throws(() => PackageManager.make({ name: "pnpm", version: "1.2.3+build", integrity: Option.none() }));
		// Padding is refused at construction too — the shared schema's whitespace
		// posture, not just the codec's.
		assert.throws(() => PackageManager.make({ name: "pnpm", version: " 1.2.3", integrity: Option.none() }));
		// The control: the same construction with an exact version succeeds.
		const pm = PackageManager.make({ name: "pnpm", version: "1.2.3", integrity: Option.none() });
		assert.strictEqual(pm.version, "1.2.3");
	});
});

// The name half is where this field model and `@effected/npm`'s
// `PackageManagerPin` deliberately diverge. Evidence for the latitude, recorded
// in the module's TSDoc: corepack 0.34.0 recognises only npm/pnpm/yarn and
// would reject `bun@1.2.20` — a value six published packages in this repo's own
// node_modules carry — and npm documents no constraint on the field at all.
describe("PackageManager name latitude (deliberately wider than PackageManagerPin)", () => {
	it.effect("accepts names outside the pin's four literals", () =>
		Effect.gen(function* () {
			for (const input of ["bun@1.2.20", "deno@2.5.1", "cargo@1.0.0"]) {
				const pm = yield* decode(input);
				assert.strictEqual(yield* encode(pm), input, input);
			}
		}),
	);

	it.effect("still rejects names outside the lowercase grammar", () =>
		Effect.gen(function* () {
			for (const input of ["PNPM@1.0.0", "pnpm2@1.0.0", "@scope/pm@1.0.0", "@1.0.0"]) {
				const error = yield* Effect.flip(decode(input));
				assert.strictEqual(error._tag, "SchemaError", input);
			}
		}),
	);
});

// The consolidation guards. The two halves need DIFFERENT mechanisms, and the
// reason is worth stating: `Schema.check` is erased from the built type, so
// severing a shared schema is neither a type error nor — with a faithful copy —
// a behaviour change.
describe("PackageManager consolidation", () => {
	// The integrity half is a shared VALUE, so object identity settles it. A
	// private copy of the corepack restriction would pass every rejection test
	// above and compile clean; only this assertion sees it.
	it("integrity IS @effected/npm's shared corepack schema, not a copy that agrees with it", () => {
		// `Schema.Option(X)` keeps `X` on `.value`.
		assert.strictEqual(
			PackageManager.fields.integrity.value,
			CorepackIntegrityHash,
			"the corepack restriction must not be re-derived here — consume CorepackIntegrityHash",
		);
		// The control: the assertion discriminates, and is not satisfied by the
		// unrestricted brand the shared schema narrows.
		assert.notStrictEqual<unknown>(PackageManager.fields.integrity.value, IntegrityHash);
	});

	// The version half is a shared VALUE too since it became
	// `SemVer.PinnableVersionString`, so identity settles it the same way.
	it("version IS @effected/semver's shared pinnable schema, not a copy that agrees with it", () => {
		// A non-optional field keeps the schema directly on `fields`.
		assert.strictEqual(
			PackageManager.fields.version,
			SemVer.PinnableVersionString,
			"the pinnable-version restriction must not be re-derived here — consume SemVer.PinnableVersionString",
		);
		// The control: the assertion discriminates against the two neighbours a
		// faithful re-derivation would plausibly reach for.
		assert.notStrictEqual(PackageManager.fields.version, SemVer.ExactVersionString);
		assert.notStrictEqual(PackageManager.fields.version, Schema.String);
	});

	// The equivalence corpus stays as the BEHAVIOURAL guard: whatever this
	// field accepts must be exactly what `@effected/semver`'s strict parse
	// accepts (minus build metadata, which the grammar cannot express). A
	// hand-rolled parser that drifts from SemVer on any corpus entry fails here,
	// whichever direction it drifts. Corpus entries are untrimmed on purpose:
	// on PADDED input the oracle below (parseResult, which trims) and the field
	// (SemVer.isPinnable, which refuses padding) legitimately disagree — that
	// divergence is pinned by its own test, not by this corpus.
	it.effect("accepts exactly what SemVer.parseResult accepts, no build metadata", () =>
		Effect.gen(function* () {
			const corpus = [
				"1.2.3",
				"0.0.0",
				"10.33.0",
				"1.2.3-rc.1",
				"1.2.3-0rc",
				"1.2.3-alpha.0",
				"1.2.3-0.3.7",
				"01.2.3",
				"1.02.3",
				"1.2.03",
				"1.2.3-01",
				"1.2.3-a..b",
				"1.2.3-",
				"1.2",
				"1",
				"v1.2.3",
				"^1.2.3",
				"latest",
				"",
				// Build metadata parses as SemVer but is inexpressible in this
				// grammar — the `+` position belongs to the integrity — so the field
				// must reject it even though SemVer accepts it.
				"1.2.3+build",
			];
			for (const version of corpus) {
				const parsed = SemVer.parseResult(version);
				const semverAccepts = Result.isSuccess(parsed) && parsed.success.build.length === 0;
				const decoded = yield* Effect.result(decode(`pnpm@${version}`));
				assert.strictEqual(
					Result.isSuccess(decoded),
					semverAccepts,
					`"${version}": the field and SemVer.parseResult must agree`,
				);
			}
		}),
	);
});
