// The corepack pin triple `<name>@<version>[+<integrity>]`.
//
// The load-bearing case is the `+`-split rule: `pnpm@11.17.0+sha512.abc` must
// decode as version `11.17.0` plus integrity `sha512.abc`, never as the semver
// build-metadata reading `11.17.0+sha512.abc` — and a malformed tail after a
// `+` must fail typed rather than fall back to build-metadata parsing. Both
// directions of that rule get their own tests.

import { assert, describe, it } from "@effect/vitest";
import { SemVer } from "../../effected/semver/index.ts";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { InvalidPackageManagerPinError, PackageManagerPin } from "../../effected/npm/index.ts";

const decode = S.decodeUnknownEffect(PackageManagerPin.FromString);
const encode = S.encodeUnknownEffect(PackageManagerPin.FromString);

const flipParse = (input: string) => Effect.flip(PackageManagerPin.parse(input));

describe("PackageManagerPin.parse", () => {
	it.effect("parses the bare <name>@<version> form", () =>
		Effect.gen(function* () {
			const pin = yield* PackageManagerPin.parse("pnpm@11.17.0");
			assert.strictEqual(pin.name, "pnpm");
			assert.strictEqual(pin.version.toString(), "11.17.0");
			assert.strictEqual(pin.version.major, 11);
			// optionalKey: the field is ABSENT, not present-but-undefined.
			assert.isFalse(Object.hasOwn(pin, "integrity"));
			assert.strictEqual(pin.toString(), "pnpm@11.17.0");
		}),
	);

	it.effect("parses the <name>@<version>+<integrity> form", () =>
		Effect.gen(function* () {
			const pin = yield* PackageManagerPin.parse("pnpm@11.17.0+sha512.deadbeef01");
			assert.strictEqual(pin.name, "pnpm");
			assert.strictEqual(pin.version.toString(), "11.17.0");
			assert.strictEqual(pin.integrity, "sha512.deadbeef01");
			assert.strictEqual(pin.toString(), "pnpm@11.17.0+sha512.deadbeef01");
		}),
	);

	it.effect("accepts every supported manager name", () =>
		Effect.gen(function* () {
			for (const name of ["npm", "pnpm", "yarn", "bun"] as const) {
				const pin = yield* PackageManagerPin.parse(`${name}@1.2.3`);
				assert.strictEqual(pin.name, name);
			}
		}),
	);

	it.effect("accepts prerelease versions — corepack pins can carry them", () =>
		Effect.gen(function* () {
			const bare = yield* PackageManagerPin.parse("yarn@4.0.0-rc.1");
			assert.strictEqual(bare.version.toString(), "4.0.0-rc.1");
			assert.deepStrictEqual(bare.version.prerelease, ["rc", 1]);

			const withIntegrity = yield* PackageManagerPin.parse("pnpm@10.0.0-beta.2+sha512.abc123");
			// corepack's own transparent default pin for yarn Berry hashes with
			// sha224 — the exact shape that once failed with reason "integrity".
			const sha224 = yield* PackageManagerPin.parse(
				"yarn@4.12.0+sha224.877304e3c9e5b53431969ee2ca17ee44f366533b0da5a4ba9c2bd447",
			);
			assert.strictEqual(sha224.integrity, "sha224.877304e3c9e5b53431969ee2ca17ee44f366533b0da5a4ba9c2bd447");
			assert.strictEqual(withIntegrity.version.toString(), "10.0.0-beta.2");
			assert.strictEqual(withIntegrity.integrity, "sha512.abc123");
		}),
	);
});

describe("the +-split rule", () => {
	// The downstream's exact pain point: the first `+` after the version always
	// begins the integrity component. Under the wrong (semver build-metadata)
	// split, the version would be "11.17.0+sha512.abc" and integrity absent —
	// each assertion here fails under that split.
	it.effect("the first + begins the integrity, never semver build metadata", () =>
		Effect.gen(function* () {
			const pin = yield* PackageManagerPin.parse("pnpm@11.17.0+sha512.abc");
			assert.strictEqual(pin.version.toString(), "11.17.0");
			assert.deepStrictEqual(pin.version.build, []);
			assert.strictEqual(pin.integrity, "sha512.abc");
		}),
	);

	it.effect("a malformed tail after + fails typed — no fallback to build-metadata parsing", () =>
		Effect.gen(function* () {
			// `garbage` IS a syntactically valid semver build identifier, so a
			// parser that falls back to build-metadata parsing would ACCEPT this
			// input. It must fail, and it must fail on the integrity component.
			const error = yield* flipParse("pnpm@11.17.0+garbage");
			assert.instanceOf(error, InvalidPackageManagerPinError);
			assert.strictEqual(error.reason, "integrity");
		}),
	);

	it("a version constructed with build metadata is rejected at make", () => {
		// The grammar cannot express build metadata in the version position, so a
		// directly-constructed one would encode to a string that re-parses
		// differently. Construction is a defect (bad wiring, not bad input).
		assert.throws(() => PackageManagerPin.make({ name: "pnpm", version: SemVer.of(1, 2, 3, [], ["sha"]) }));
		// The control: the same construction without build metadata succeeds.
		const pin = PackageManagerPin.make({ name: "pnpm", version: SemVer.of(1, 2, 3) });
		assert.strictEqual(pin.toString(), "pnpm@1.2.3");
	});
});

describe("PackageManagerPin rejection matrix", () => {
	const rejects = (input: string, reason: "format" | "name" | "version" | "integrity") =>
		it.effect(`rejects ${JSON.stringify(input)} with reason "${reason}"`, () =>
			Effect.gen(function* () {
				const error = yield* flipParse(input);
				assert.instanceOf(error, InvalidPackageManagerPinError);
				assert.strictEqual(error._tag, "InvalidPackageManagerPinError");
				assert.strictEqual(error.reason, reason);
				// The Result twin agrees — the two surfaces share one grammar.
				const result = PackageManagerPin.parseResult(input);
				assert.isTrue(Result.isFailure(result));
			}),
		);

	// Ranges are not pinnable.
	rejects("pnpm@^9.0.0", "version");
	rejects("pnpm@~9.0.0", "version");
	rejects("pnpm@>=9", "version");
	// Partial versions are not exact versions.
	rejects("pnpm@9", "version");
	rejects("pnpm@9.1", "version");
	// Dist-tags are not versions.
	rejects("yarn@berry", "version");
	rejects("pnpm@latest", "version");
	// v-prefixed and empty versions.
	rejects("pnpm@v1.2.3", "version");
	rejects("pnpm@", "version");
	// Padded versions: the version substring is ruled on by SemVer.isPinnable,
	// which rejects surrounding whitespace — SemVer.parseResult alone TRIMS, so
	// a bare-parse implementation silently canonicalizes these instead of
	// failing typed. These three are what discriminate the two.
	rejects("pnpm@ 11.17.0", "version");
	rejects("pnpm@11.17.0 ", "version");
	rejects("pnpm@ 11.17.0 +sha512.deadbeef", "version");
	// Unknown or empty manager names.
	rejects("cargo@1.0.0", "name");
	rejects("PNPM@1.0.0", "name");
	rejects("@1.0.0", "name");
	// No separator at all.
	rejects("pnpm", "format");
	rejects("", "format");
	// Malformed integrity tails: empty, wrong form (SRI), uppercase hex.
	rejects("pnpm@11.17.0+", "integrity");
	rejects("pnpm@11.17.0+sha512-YWJjZGVm", "integrity");
	rejects("pnpm@11.17.0+sha512.DEADBEEF", "integrity");
	rejects("pnpm@11.17.0+md5.deadbeef", "integrity");
});

describe("PackageManagerPin.FromString", () => {
	it.effect("round-trips both forms byte-for-byte", () =>
		Effect.gen(function* () {
			for (const input of ["pnpm@11.17.0", "npm@10.9.2+sha512.abcdef0123", "yarn@4.0.0-rc.1+sha512.0badf00d"]) {
				const pin = yield* decode(input);
				assert.instanceOf(pin, PackageManagerPin);
				assert.strictEqual(yield* encode(pin), input);
			}
		}),
	);

	it.effect("fails decode with the pin error's message on malformed input", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(decode("pnpm@^9.0.0"));
			assert.strictEqual(error._tag, "SchemaError");
			assert.include(String(error), "exact SemVer version");
		}),
	);

	it.effect("encodes a constructed pin without integrity to the bare form", () =>
		Effect.gen(function* () {
			const parsed = PackageManagerPin.parseResult("bun@1.3.0");
			assert.isTrue(Result.isSuccess(parsed));
			if (Result.isSuccess(parsed)) {
				assert.strictEqual(yield* encode(parsed.success), "bun@1.3.0");
			}
		}),
	);
});

describe("PackageManagerPin.parseResult", () => {
	it("is the sync primitive: success carries the pin, failure the typed error", () => {
		const ok = PackageManagerPin.parseResult("pnpm@11.17.0+sha512.abc");
		assert.isTrue(Result.isSuccess(ok));
		if (Result.isSuccess(ok)) {
			assert.strictEqual(ok.success.name, "pnpm");
			assert.strictEqual(ok.success.integrity, "sha512.abc");
		}

		const bad = PackageManagerPin.parseResult("pnpm@11");
		assert.isTrue(Result.isFailure(bad));
		if (Result.isFailure(bad)) {
			assert.strictEqual(bad.failure._tag, "InvalidPackageManagerPinError");
			assert.strictEqual(bad.failure.reason, "version");
			assert.strictEqual(bad.failure.input, "pnpm@11");
			assert.include(bad.failure.message, "pnpm@11");
		}
	});
});

describe("PackageManagerPin.bare", () => {
	it("renders name@version without the integrity, and equals toString for a bare pin", () => {
		const hashed = PackageManagerPin.parseResult(`pnpm@12.6.0+sha512.${"ab".repeat(64)}`);
		const plain = PackageManagerPin.parseResult("pnpm@12.6.0");
		assert.isTrue(Result.isSuccess(hashed) && Result.isSuccess(plain));
		if (Result.isSuccess(hashed) && Result.isSuccess(plain)) {
			assert.strictEqual(hashed.success.bare, "pnpm@12.6.0");
			assert.notStrictEqual(hashed.success.toString(), hashed.success.bare);
			assert.strictEqual(plain.success.bare, plain.success.toString());
		}
	});
});
