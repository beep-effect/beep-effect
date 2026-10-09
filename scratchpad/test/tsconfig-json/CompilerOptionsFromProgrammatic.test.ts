import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { CompilerOptionsFromProgrammatic } from "../../effected/tsconfig-json/CompilerOptionsFromProgrammatic.ts";
import { TsEnumCodec } from "../../effected/tsconfig-json/TsEnumCodec.ts";

const decode = S.decodeUnknownEffect(CompilerOptionsFromProgrammatic);

// One numeric value per family, with the canonical string it must decode to.
// `module: 5` and `moduleResolution: 2` are deliberately the alias-carrying
// values — R1.6's last-row-wins rule makes "es2015" and "node10" canonical
// over "es6" and "node", and a decode landing on the alias would be wrong.
const FAMILY_CASES: ReadonlyArray<readonly [key: string, numeric: number, canonical: string]> = [
	["target", 12, "es2025"],
	["module", 199, "nodenext"],
	["module", 5, "es2015"],
	["moduleResolution", 100, "bundler"],
	["moduleResolution", 2, "node10"],
	["jsx", 4, "react-jsx"],
	["newLine", 1, "lf"],
	["moduleDetection", 3, "force"],
];

describe("CompilerOptionsFromProgrammatic", () => {
	for (const [key, numeric, canonical] of FAMILY_CASES) {
		it.effect(`decodes ${key}: ${numeric} to "${canonical}"`, () =>
			Effect.gen(function* () {
				const decoded = yield* decode({ [key]: numeric });
				assert.strictEqual(decoded[key], canonical);
			}),
		);
	}

	it.effect("decodes an object mixing numeric, canonical and case-varying spellings", () =>
		Effect.gen(function* () {
			const decoded = yield* decode({
				target: 12,
				module: "NodeNext",
				moduleResolution: "bundler",
				jsx: 5,
				strict: true,
			});
			assert.strictEqual(decoded.target, "es2025");
			assert.strictEqual(decoded.module, "nodenext");
			assert.strictEqual(decoded.moduleResolution, "bundler");
			assert.strictEqual(decoded.jsx, "react-jsxdev");
			assert.strictEqual(decoded.strict, true);
		}),
	);

	it.effect("decodes lib in all three spellings, including case-varying short names", () =>
		Effect.gen(function* () {
			const decoded = yield* decode({
				lib: ["ESNext", "lib.dom.d.ts", "/nix/store/x/typescript/lib/lib.dom.iterable.d.ts"],
			});
			assert.deepStrictEqual(decoded.lib, ["esnext", "dom", "dom.iterable"]);
		}),
	);

	it.effect("preserves unknown and dead passthrough keys", () =>
		Effect.gen(function* () {
			const decoded = yield* decode({ target: 12, charset: "utf8", futureOption: 42 });
			assert.strictEqual(decoded.target, "es2025");
			assert.strictEqual(decoded.charset, "utf8");
			assert.strictEqual(decoded.futureOption, 42);
		}),
	);

	it.effect("fails decode on a numeric with no table entry rather than passing it through", () =>
		Effect.gen(function* () {
			const result = yield* Effect.result(decode({ target: 9999 }));
			assert.isTrue(Result.isFailure(result));
		}),
	);

	it.effect("fails decode on an unmappable numeric even alongside valid keys", () =>
		Effect.gen(function* () {
			const result = yield* Effect.result(decode({ target: 12, jsx: 9999 }));
			assert.isTrue(Result.isFailure(result));
		}),
	);

	it.effect("fails decode on a non-record input", () =>
		Effect.gen(function* () {
			const result = yield* Effect.result(decode("es2025"));
			assert.isTrue(Result.isFailure(result));
		}),
	);

	it.effect("encodes back to the programmatic form", () =>
		Effect.gen(function* () {
			const decoded = yield* decode({ target: 12, module: 199, lib: ["esnext"], strict: true });
			const encoded = yield* S.encodeUnknownEffect(CompilerOptionsFromProgrammatic)(decoded);
			assert.strictEqual(encoded.target, 12);
			assert.strictEqual(encoded.module, 199);
			assert.deepStrictEqual(encoded.lib, ["lib.esnext.d.ts"]);
			assert.strictEqual(encoded.strict, true);
		}),
	);

	// The consumer path this codec exists for: a synchronous caller holding the
	// programmatic spelling gets a validated result with no cast and no Effect.
	it("decodes synchronously through Result for a non-Effect caller", () => {
		const ok = S.decodeResult(CompilerOptionsFromProgrammatic)({ target: 12, strict: true });
		assert.isTrue(Result.isSuccess(ok));
		if (Result.isSuccess(ok)) assert.strictEqual(ok.success.target, "es2025");

		const bad = S.decodeResult(CompilerOptionsFromProgrammatic)({ target: 9999 });
		assert.isTrue(Result.isFailure(bad));
	});
});

describe("CompilerOptionsFromProgrammatic idempotence", () => {
	// Canonical input must survive decode untouched — the property that lets a
	// caller run mixed and already-normalized options through the same door.
	// Every key optional, so the generator walks subsets of the canonical fields.
	const Canonical = S.Struct({
		target: S.optionalKey(S.Literals(["es5", "es2015", "es2023", "esnext"])),
		module: S.optionalKey(S.Literals(["commonjs", "es2015", "nodenext", "preserve"])),
		moduleResolution: S.optionalKey(S.Literals(["classic", "node10", "bundler"])),
		jsx: S.optionalKey(S.Literals(["preserve", "react", "react-jsx"])),
		newLine: S.optionalKey(S.Literals(["crlf", "lf"])),
		moduleDetection: S.optionalKey(S.Literals(["auto", "legacy", "force"])),
		lib: S.optionalKey(
			S.Array(S.Literals(["esnext", "dom", "dom.iterable"])).check(S.isMaxLength(3)),
		),
		strict: S.optionalKey(S.Boolean),
	});

	it.effect.prop("decode leaves already-canonical options unchanged", [Canonical], ([canonical]) =>
		Effect.gen(function* () {
			const decoded = yield* decode(canonical);
			assert.deepStrictEqual(decoded, canonical);
		}),
	);

	it.effect.prop("decode is idempotent", [Canonical], ([canonical]) =>
		Effect.gen(function* () {
			const once = yield* decode(canonical);
			const twice = yield* decode(once);
			assert.deepStrictEqual(twice, once);
		}),
	);

	// Guards the composition the downstream consumer actually writes: normalize
	// through this codec, then hand the result to `encodeCompilerOptions`.
	it.effect.prop("decode composes with encodeCompilerOptions", [Canonical], ([canonical]) =>
		Effect.gen(function* () {
			const decoded = yield* decode(canonical);
			const programmatic = TsEnumCodec.encodeCompilerOptions(decoded);
			const redecoded = yield* decode(programmatic);
			assert.deepStrictEqual(redecoded, decoded);
		}),
	);
});
