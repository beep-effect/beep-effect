import { assert, describe, it } from "@effect/vitest";
import { pipe } from "effect/Function";
import { envIsTruthy } from "../../effected/env/internal/osc8/env.ts";

describe("envIsTruthy dual signatures", () => {
	it("returns booleans with a default, undefined, or explicit specification", () => {
		const direct: (value: string | undefined, spec: "default" | "no-color" | undefined) => boolean = envIsTruthy;
		const result: ReturnType<typeof envIsTruthy> = direct("no-color", "default");
		assert.strictEqual(result, true);
		assert.strictEqual(pipe("false", envIsTruthy()), false);
		assert.strictEqual(direct("false", undefined), false);
		assert.strictEqual(direct("false", "default"), false);
		assert.strictEqual(direct("false", "no-color"), true);
	});
	it("returns callable pipeable forms for both specifications and defaults", () => {
		const dataLast: (spec: "default" | "no-color" | undefined) => (value: string | undefined) => boolean = envIsTruthy;
		for (const value of [undefined, "", "0", "false", "FALSE", "off", "Off", "no", "NO", "1", "true", "yes", "on", "x", "default", "no-color"]) {
			assert.strictEqual(pipe(value, envIsTruthy()), envIsTruthy(value, "default"));
			assert.strictEqual(pipe(value, dataLast(undefined)), envIsTruthy(value, undefined));
			assert.strictEqual(pipe(value, dataLast("default")), envIsTruthy(value, "default"));
			assert.strictEqual(pipe(value, dataLast("no-color")), envIsTruthy(value, "no-color"));
		}
		assert.strictEqual(dataLast("no-color")("0"), true);
		assert.strictEqual(dataLast("default")("0"), false);
	});
});

describe("envIsTruthy (default semantics)", () => {
	it("is false for undefined", () => {
		assert.strictEqual(envIsTruthy(undefined, "default"), false);
	});
	it("is false for empty string", () => {
		assert.strictEqual(envIsTruthy("", "default"), false);
	});
	it("is false for '0', 'false', 'off', 'no' (case insensitive)", () => {
		for (const v of ["0", "false", "FALSE", "off", "Off", "no", "NO"]) {
			assert.strictEqual(envIsTruthy(v, "default"), false);
		}
	});
	it("is true for any other non-empty value", () => {
		for (const v of ["1", "true", "yes", "on", "x"]) {
			assert.strictEqual(envIsTruthy(v, "default"), true);
		}
	});
});

describe("envIsTruthy with NO_COLOR semantics", () => {
	it("is false for undefined and empty string", () => {
		assert.strictEqual(envIsTruthy(undefined, "no-color"), false);
		assert.strictEqual(envIsTruthy("", "no-color"), false);
	});
	it("is true for any non-empty value (including '0')", () => {
		for (const v of ["0", "false", "off", "no", "1", "true", "x"]) {
			assert.strictEqual(envIsTruthy(v, "no-color"), true);
		}
	});
});
