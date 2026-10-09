import { assert, describe, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import {
	CompilerOptions,
	Jsx,
	Module,
	ModuleDetection,
	ModuleResolution,
	NewLine,
	Target,
} from "../../effected/tsconfig-json/CompilerOptions.ts";

describe("CompilerOptions", () => {
	it.effect("decodes a full realistic options object preserving every field", () =>
		Effect.gen(function* () {
			const decoded = yield* Schema.decodeEffect(CompilerOptions)({
				target: "es2023",
				module: "nodenext",
				moduleResolution: "bundler",
				strict: true,
				lib: ["esnext", "dom"],
				paths: { "#app/*": ["./src/*"] },
			});
			assert.strictEqual(decoded.target, "es2023");
			assert.strictEqual(decoded.module, "nodenext");
			assert.strictEqual(decoded.moduleResolution, "bundler");
			assert.strictEqual(decoded.strict, true);
			assert.deepStrictEqual(decoded.lib, ["esnext", "dom"]);
			assert.deepStrictEqual(decoded.paths, { "#app/*": ["./src/*"] });
		}),
	);

	it.effect("decodes enum values case-insensitively", () =>
		Effect.gen(function* () {
			const target = yield* Schema.decodeEffect(CompilerOptions)({ target: "ES2023" });
			assert.strictEqual(target.target, "es2023");

			const mod = yield* Schema.decodeEffect(CompilerOptions)({ module: "NodeNext" });
			assert.strictEqual(mod.module, "nodenext");
		}),
	);

	it.effect("rejects an unknown enum value", () =>
		Effect.gen(function* () {
			const result = yield* Effect.result(Schema.decodeEffect(CompilerOptions)({ target: "es9999" }));
			assert.strictEqual(result._tag, "Failure");
		}),
	);

	it.effect("passes unknown option keys through and preserves them across encode", () =>
		Effect.gen(function* () {
			const decoded = yield* Schema.decodeEffect(CompilerOptions)({ strict: true, futureOption: 42 });
			assert.strictEqual(decoded.strict, true);
			assert.strictEqual(decoded.futureOption, 42);

			const encoded = yield* Schema.encodeUnknownEffect(CompilerOptions)(decoded);
			assert.strictEqual((encoded as Record<string, unknown>).futureOption, 42);
		}),
	);

	it.effect("treats dead options as passthrough, not errors", () =>
		Effect.gen(function* () {
			const decoded = yield* Schema.decodeEffect(CompilerOptions)({ charset: "utf8", out: "x.js" });
			assert.strictEqual(decoded.charset, "utf8");
			assert.strictEqual(decoded.out, "x.js");
		}),
	);

	it.effect("decodes maxNodeModuleJsDepth as a number", () =>
		Effect.gen(function* () {
			const decoded = yield* Schema.decodeEffect(CompilerOptions)({ maxNodeModuleJsDepth: 2 });
			assert.strictEqual(decoded.maxNodeModuleJsDepth, 2);
		}),
	);

	it.effect("keeps unknown keys on plugins array elements", () =>
		Effect.gen(function* () {
			const decoded = yield* Schema.decodeEffect(CompilerOptions)({
				plugins: [{ name: "x", extra: 1 }],
			});
			assert.strictEqual(decoded.plugins?.[0]?.name, "x");
			const plugin = decoded.plugins?.[0] as unknown as Record<string, unknown>;
			assert.strictEqual(plugin.extra, 1);
		}),
	);

	describe("enum value schemas", () => {
		it.effect("Target decodes case-insensitively and rejects unknown members", () =>
			Effect.gen(function* () {
				const decoded = yield* Schema.decodeEffect(Target)("ES2015");
				assert.strictEqual(decoded, "es2015");
				const result = yield* Effect.result(Schema.decodeEffect(Target)("es9999"));
				assert.strictEqual(result._tag, "Failure");
			}),
		);

		it.effect("Module decodes case-insensitively", () =>
			Effect.gen(function* () {
				const decoded = yield* Schema.decodeEffect(Module)("NodeNext");
				assert.strictEqual(decoded, "nodenext");
			}),
		);

		it.effect("ModuleResolution decodes case-insensitively", () =>
			Effect.gen(function* () {
				const decoded = yield* Schema.decodeEffect(ModuleResolution)("Bundler");
				assert.strictEqual(decoded, "bundler");
			}),
		);

		it.effect("Jsx decodes case-insensitively", () =>
			Effect.gen(function* () {
				const decoded = yield* Schema.decodeEffect(Jsx)("React-JSX");
				assert.strictEqual(decoded, "react-jsx");
			}),
		);

		it.effect("NewLine decodes case-insensitively", () =>
			Effect.gen(function* () {
				const decoded = yield* Schema.decodeEffect(NewLine)("CRLF");
				assert.strictEqual(decoded, "crlf");
			}),
		);

		it.effect("ModuleDetection decodes case-insensitively", () =>
			Effect.gen(function* () {
				const decoded = yield* Schema.decodeEffect(ModuleDetection)("Force");
				assert.strictEqual(decoded, "force");
			}),
		);
	});
});

describe("CompilerOptions round-trip", () => {
	// Every key optional, so the generator walks subsets of the typed fields.
	const Subset = Schema.Struct({
		strict: Schema.optionalKey(Schema.Boolean),
		target: Schema.optionalKey(Schema.Literals(["es5", "es2015", "es2023", "esnext"])),
		maxNodeModuleJsDepth: Schema.optionalKey(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 10 }))),
	});

	it.effect.prop("decode ∘ encode is identity over a generated subset of typed fields", [Subset], ([subset]) =>
		Effect.gen(function* () {
			const decoded = yield* Schema.decodeEffect(CompilerOptions)(subset);
			const encoded = yield* Schema.encodeUnknownEffect(CompilerOptions)(decoded);
			const redecoded = yield* Schema.decodeEffect(CompilerOptions)(encoded);
			assert.deepStrictEqual(redecoded, decoded);
		}),
	);
});
