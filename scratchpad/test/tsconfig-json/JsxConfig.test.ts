import { assert, describe, it } from "@effect/vitest";
import { Option } from "effect";
import type { CompilerOptions } from "../../effected/tsconfig-json/CompilerOptions.ts";
import { JsxConfig } from "../../effected/tsconfig-json/JsxConfig.ts";

/** Unwrap a `Some`, failing the test on `None`. */
const expectSome = (result: Option.Option<JsxConfig>): JsxConfig => {
	assert.isTrue(Option.isSome(result), "expected Some(JsxConfig)");
	return (result as Option.Some<JsxConfig>).value;
};

describe("JsxConfig.fromCompilerOptions", () => {
	it("react-jsx selects the automatic runtime with the react default import source", () => {
		const config = expectSome(JsxConfig.fromCompilerOptions({ jsx: "react-jsx" }));
		assert.strictEqual(config.runtime, "automatic");
		assert.strictEqual(config.importSource, "react");
	});

	it("react-jsxdev honors an explicit jsxImportSource", () => {
		const options: CompilerOptions.Type = { jsx: "react-jsxdev", jsxImportSource: "preact" };
		const config = expectSome(JsxConfig.fromCompilerOptions(options));
		assert.strictEqual(config.runtime, "automatic");
		assert.strictEqual(config.importSource, "preact");
	});

	it("react selects the classic runtime and carries no import source", () => {
		const config = expectSome(JsxConfig.fromCompilerOptions({ jsx: "react", jsxImportSource: "ignored" }));
		assert.strictEqual(config.runtime, "classic");
		// The optionalKey is genuinely absent, not present-as-undefined.
		assert.isFalse("importSource" in config);
	});

	it("preserve leaves JSX untransformed: nothing for a bundler to configure", () => {
		assert.isTrue(Option.isNone(JsxConfig.fromCompilerOptions({ jsx: "preserve" })));
	});

	it("react-native leaves JSX untransformed: nothing for a bundler to configure", () => {
		assert.isTrue(Option.isNone(JsxConfig.fromCompilerOptions({ jsx: "react-native" })));
	});

	it("an absent jsx option projects to None", () => {
		assert.isTrue(Option.isNone(JsxConfig.fromCompilerOptions({})));
	});
});
