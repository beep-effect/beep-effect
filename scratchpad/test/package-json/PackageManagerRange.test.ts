// The range-tolerant `packageManager` field: `<name>@<range>[+<integrity>]`.
//
// The class exists so the presence-lenient `PackageManifest` can read the
// range spelling (`pnpm@^11.20.0`) pnpm accepts, without weakening the strict
// `PackageManager` — whose continued rejection of ranges is pinned here as a
// control.

import { assert, describe, it } from "@effect/vitest";
import { Effect, Option, Result, Schema } from "effect";
import { DevEngine } from "../../effected/package-json/DevEngines.ts";
import { PackageManager } from "../../effected/package-json/PackageManager.ts";
import { InvalidPackageManagerRangeError, PackageManagerRange } from "../../effected/package-json/PackageManagerRange.ts";

const decode = Schema.decodeUnknownEffect(PackageManagerRange.FromString);
const encode = Schema.encodeUnknownEffect(PackageManagerRange.FromString);
const decodeStrict = Schema.decodeUnknownEffect(PackageManager.FromString);

describe("PackageManagerRange.FromString", () => {
	it.effect("parses a caret range and reports it inexact", () =>
		Effect.gen(function* () {
			const pm = yield* decode("pnpm@^11.20.0");
			assert.strictEqual(pm.name, "pnpm");
			assert.strictEqual(pm.range, "^11.20.0");
			assert.isFalse(pm.isExact);
			assert.isFalse(pm.hasIntegrity);
		}),
	);

	it.effect("parses an exact version and reports it exact", () =>
		Effect.gen(function* () {
			const pm = yield* decode("pnpm@11.2.0");
			assert.strictEqual(pm.range, "11.2.0");
			assert.isTrue(pm.isExact);
		}),
	);

	// `=11.2.0` names a single version but is a RANGE spelling — exactness
	// tracks the spelling the manifest carried, not the set it denotes, because
	// a consumer re-emitting the field must reproduce the spelling.
	it.effect("reports a range spelling of a single version as inexact", () =>
		Effect.gen(function* () {
			const pm = yield* decode("pnpm@=11.2.0");
			assert.isFalse(pm.isExact);
		}),
	);

	it.effect("parses an integrity suffix", () =>
		Effect.gen(function* () {
			const pm = yield* decode("pnpm@11.2.0+sha512.abc");
			assert.deepStrictEqual(pm.integrity, Option.some("sha512.abc"));
			assert.isTrue(pm.hasIntegrity);
		}),
	);

	it.effect("round-trips encode(decode) byte-identically", () =>
		Effect.gen(function* () {
			for (const input of ["pnpm@^11.20.0", "pnpm@11.2.0", "yarn@>=4 <5", "bun@1.2.x", "npm@11.2.0+sha512.abc"]) {
				const pm = yield* decode(input);
				assert.strictEqual(yield* encode(pm), input);
			}
		}),
	);

	it.effect("rejects a version position that is not a semver range", () =>
		Effect.gen(function* () {
			for (const input of ["pnpm@garbage", "not-a-pm", "PNPM@11.2.0", "pnpm@11.2.0+GARBAGE!!"]) {
				const error = yield* Effect.flip(decode(input));
				assert.strictEqual(error._tag, "SchemaError");
			}
		}),
	);

	// node-semver coerces an empty range string to `*`; accepting `pnpm@` on
	// those terms would be a silent edit, so it is a typed format failure.
	it.effect("rejects an empty version position rather than coercing it to *", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(decode("pnpm@"));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);

	// The control: the strict PackageManager is unchanged — the range spelling
	// still fails there, so nothing was silently loosened.
	it.effect("strict PackageManager.FromString still rejects the range spelling", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(decodeStrict("pnpm@^11.20.0"));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);
});

const HEX = "sha512.0123456789abcdef";

const reasonOfEngine = (engine: DevEngine) => {
	const read = PackageManagerRange.fromDevEngineResult(engine);
	return Result.isFailure(read) ? read.failure.reason : undefined;
};

describe("PackageManagerRange.parseResult", () => {
	it("names the failing component", () => {
		const cases: ReadonlyArray<readonly [string, string]> = [
			["not-a-pm", "format"],
			["PNPM@11.2.0", "name"],
			["pnpm@", "range"],
			["pnpm@garbage", "range"],
			["pnpm@11.2.0+GARBAGE!!", "integrity"],
			["pnpm@11.2.0+sha512-3q2+7w==", "integrity"],
		];
		for (const [input, reason] of cases) {
			const parsed = PackageManagerRange.parseResult(input);
			assert.isTrue(Result.isFailure(parsed), input);
			if (Result.isFailure(parsed)) {
				assert.instanceOf(parsed.failure, InvalidPackageManagerRangeError);
				assert.strictEqual(parsed.failure.reason, reason, input);
				assert.strictEqual(parsed.failure.input, input);
			}
		}
	});

	it.effect("parse fails typed through the error channel", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(PackageManagerRange.parse("pnpm@garbage"));
			assert.strictEqual(error._tag, "InvalidPackageManagerRangeError");
			assert.strictEqual(error.reason, "range");
		}),
	);
});

describe("PackageManagerRange.fromDevEngine", () => {
	it("reads a caret range and renders it bare with the operator kept", () => {
		const read = PackageManagerRange.fromDevEngineResult(DevEngine.make({ name: "pnpm", version: "^12.6.0" }));
		assert.isTrue(Result.isSuccess(read));
		if (Result.isSuccess(read)) {
			assert.strictEqual(read.success.name, "pnpm");
			assert.strictEqual(read.success.range, "^12.6.0");
			assert.isFalse(read.success.hasIntegrity);
			assert.strictEqual(read.success.bare, "pnpm@^12.6.0");
		}
	});

	it("drops a corepack hash from an operator range, keeping the operator", () => {
		const read = PackageManagerRange.fromDevEngineResult(DevEngine.make({ name: "pnpm", version: `^12.6.0+${HEX}` }));
		assert.isTrue(Result.isSuccess(read));
		if (Result.isSuccess(read)) {
			assert.strictEqual(read.success.range, "^12.6.0");
			assert.deepStrictEqual(read.success.integrity, Option.some(HEX));
			assert.strictEqual(read.success.bare, "pnpm@^12.6.0");
			assert.strictEqual(read.success.toString(), `pnpm@^12.6.0+${HEX}`);
		}
	});

	it("reads an exact version with a hash and without", () => {
		for (const version of ["12.6.0", `12.6.0+${HEX}`]) {
			const read = PackageManagerRange.fromDevEngineResult(DevEngine.make({ name: "pnpm", version, onFail: "error" }));
			assert.isTrue(Result.isSuccess(read), version);
			if (Result.isSuccess(read)) {
				assert.strictEqual(read.success.range, "12.6.0");
				assert.isTrue(read.success.isExact);
				assert.strictEqual(read.success.bare, "pnpm@12.6.0");
			}
		}
	});

	it("rejects malformed entries with the failing component", () => {
		assert.strictEqual(reasonOfEngine(DevEngine.make({ name: "pnpm" })), "range");
		assert.strictEqual(reasonOfEngine(DevEngine.make({ name: "pnpm", version: "" })), "range");
		assert.strictEqual(reasonOfEngine(DevEngine.make({ name: "pnpm", version: "latest!" })), "range");
		assert.strictEqual(reasonOfEngine(DevEngine.make({ name: "", version: "12.6.0" })), "name");
		assert.strictEqual(reasonOfEngine(DevEngine.make({ name: "PNPM", version: "12.6.0" })), "name");
		assert.strictEqual(
			reasonOfEngine(DevEngine.make({ name: "pnpm", version: "12.6.0+sha512-3q2+7w==" })),
			"integrity",
		);
		assert.strictEqual(reasonOfEngine(DevEngine.make({ name: "pnpm", version: "12.6.0+" })), "integrity");
	});

	it("reports name@version as the error input, and the bare name when version is absent", () => {
		const bad = PackageManagerRange.fromDevEngineResult(DevEngine.make({ name: "pnpm", version: "12.6.0+x" }));
		const missing = PackageManagerRange.fromDevEngineResult(DevEngine.make({ name: "pnpm" }));
		assert.isTrue(Result.isFailure(bad) && bad.failure.input === "pnpm@12.6.0+x");
		assert.isTrue(Result.isFailure(missing) && missing.failure.input === "pnpm");
	});

	it.effect("fromDevEngine fails typed through the error channel", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(PackageManagerRange.fromDevEngine(DevEngine.make({ name: "pnpm" })));
			assert.strictEqual(error._tag, "InvalidPackageManagerRangeError");
			assert.strictEqual(error.reason, "range");
		}),
	);
});

describe("PackageManagerRange devEngines entry as a plain object", () => {
	it("accepts the encoded shape read straight off disk, with no DevEngine construction", () => {
		const raw: unknown = JSON.parse('{"name":"pnpm","version":"^12.6.0","onFail":"download"}');
		const read = PackageManagerRange.fromDevEngineResult(raw as { name: string; version?: string });
		assert.isTrue(Result.isSuccess(read) && read.success.range === "^12.6.0");
		const missing = PackageManagerRange.fromDevEngineResult({ name: "pnpm" });
		assert.isTrue(Result.isFailure(missing) && missing.failure.reason === "range");
		const badName = PackageManagerRange.fromDevEngineResult({ name: "PNPM", version: "12.6.0" });
		assert.isTrue(Result.isFailure(badName) && badName.failure.reason === "name");
	});
});

describe("PackageManagerRange operator, baseVersion and withVersion", () => {
	const range = (text: string): PackageManagerRange => {
		const parsed = PackageManagerRange.parseResult(`pnpm@${text}`);
		if (Result.isFailure(parsed)) throw new Error(`fixture ${text} did not parse`);
		return parsed.success;
	};

	it("reads the operator and base version of a single exact, caret or tilde comparator", () => {
		for (const [text, operator] of [
			["12.6.0", ""],
			["^12.6.0", "^"],
			["~12.6.0", "~"],
			[`^12.6.0+${HEX}`, "^"],
		] as const) {
			assert.deepStrictEqual(range(text).operator, Option.some(operator), text);
			assert.deepStrictEqual(range(text).baseVersion, Option.some("12.6.0"), text);
		}
	});

	it("answers none for ranges whose operator cannot be carried onto a new version", () => {
		for (const text of [">=12.0.0 <13.0.0", "12.x", "^12", "=12.6.0", ">=12.0.0 <12.7.0 || >12.7.0 <13.0.0"]) {
			assert.isTrue(Option.isNone(range(text).operator), text);
			assert.isTrue(Option.isNone(range(text).baseVersion), text);
		}
	});

	it("re-anchors on a new version keeping the operator and dropping the integrity", () => {
		for (const [text, expected] of [
			["^12.6.0", "^12.8.1"],
			["~12.6.0", "~12.8.1"],
			["12.6.0", "12.8.1"],
			[`^12.6.0+${HEX}`, "^12.8.1"],
		] as const) {
			const moved = range(text).withVersionResult("12.8.1");
			assert.isTrue(Result.isSuccess(moved), text);
			if (Result.isSuccess(moved)) {
				assert.strictEqual(moved.success.range, expected, text);
				assert.isFalse(moved.success.hasIntegrity, text);
				assert.strictEqual(moved.success.name, "pnpm");
			}
		}
	});

	it("refuses to re-anchor a compound range or onto a non-pinnable version", () => {
		const compound = range(">=12.0.0 <13.0.0").withVersionResult("12.8.1");
		assert.isTrue(Result.isFailure(compound) && compound.failure.reason === "range");
		for (const version of ["^12.8.1", "12", "v12.8.1", ""]) {
			const moved = range("^12.6.0").withVersionResult(version);
			assert.isTrue(Result.isFailure(moved) && moved.failure.reason === "range", version);
		}
	});

	it.effect("withVersion fails typed through the error channel", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(range("12.x").withVersion("12.8.1"));
			assert.strictEqual(error.reason, "range");
			const moved = yield* range("^12.6.0").withVersion("12.8.1");
			assert.strictEqual(moved.bare, "pnpm@^12.8.1");
		}),
	);
});
