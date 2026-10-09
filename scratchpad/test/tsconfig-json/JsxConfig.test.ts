import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { CompilerOptions } from "../../effected/tsconfig-json/CompilerOptions.ts";
import { JsxConfig } from "../../effected/tsconfig-json/JsxConfig.ts";

/** Unwrap a `Some`, failing the test on `None`. */
const expectSome = (result: O.Option<JsxConfig>): JsxConfig => {
	assert.isTrue(O.isSome(result), "expected Some(JsxConfig)");
	return O.getOrThrow(result);
};

describe("JsxConfig.fromCompilerOptions", () => {
	it("react-jsx selects the automatic runtime with the react default import source", () => {
		const config = expectSome(JsxConfig.fromCompilerOptions({ jsx: "react-jsx" }));
		assert(config.runtime === "automatic");
		assert.strictEqual(config.importSource, "react");
	});

	it("react-jsxdev honors an explicit jsxImportSource", () => {
		const options: CompilerOptions.Type = { jsx: "react-jsxdev", jsxImportSource: "preact" };
		const config = expectSome(JsxConfig.fromCompilerOptions(options));
		assert(config.runtime === "automatic");
		assert.strictEqual(config.importSource, "preact");
	});

	it("react selects the classic runtime and carries no import source", () => {
		const config = expectSome(JsxConfig.fromCompilerOptions({ jsx: "react", jsxImportSource: "ignored" }));
		assert.strictEqual(config.runtime, "classic");
		// The classic variant omits the field, rather than carrying undefined.
		assert.isFalse("importSource" in config);
	});

	it("preserve leaves JSX untransformed: nothing for a bundler to configure", () => {
		assert.isTrue(O.isNone(JsxConfig.fromCompilerOptions({ jsx: "preserve" })));
	});

	it("react-native leaves JSX untransformed: nothing for a bundler to configure", () => {
		assert.isTrue(O.isNone(JsxConfig.fromCompilerOptions({ jsx: "react-native" })));
	});

	it("an absent jsx option projects to None", () => {
		assert.isTrue(O.isNone(JsxConfig.fromCompilerOptions({})));
	});
});

describe("JsxConfig runtime variants", () => {
	it("rejects an automatic runtime without its required import source", () => {
		assert.isTrue(O.isNone(S.decodeUnknownOption(JsxConfig)({ runtime: "automatic" })));
	});

	it.effect("round-trips the automatic runtime and its required import source", () =>
		Effect.gen(function*() {
			const input: JsxConfig = { runtime: "automatic", importSource: "preact" };
			const config = yield* S.decodeEffect(JsxConfig)(input);
			assert(config.runtime === "automatic");
			assert.strictEqual(config.importSource, "preact");
			assert.deepEqual(yield* S.encodeEffect(JsxConfig)(config), input);
		}),
	);

	it.effect("omits automatic-only fields from the classic model and encoding", () =>
		Effect.gen(function*() {
			const config = yield* S.decodeUnknownEffect(JsxConfig)({ runtime: "classic", importSource: "ignored" });
			assert.strictEqual(config.runtime, "classic");
			assert.isFalse("importSource" in config);
			assert.deepEqual(yield* S.encodeEffect(JsxConfig)(config), { runtime: "classic" });
		}),
	);
});
