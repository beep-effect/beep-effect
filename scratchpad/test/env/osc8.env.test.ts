import { assert, describe, it } from "@effect/vitest";
import { envIsTruthy } from "../../effected/env/internal/osc8/env.ts";

describe("envIsTruthy (default semantics)", () => {
	it("is false for undefined", () => {
		assert.strictEqual(envIsTruthy(undefined), false);
	});
	it("is false for empty string", () => {
		assert.strictEqual(envIsTruthy(""), false);
	});
	it("is false for '0', 'false', 'off', 'no' (case insensitive)", () => {
		for (const v of ["0", "false", "FALSE", "off", "Off", "no", "NO"]) {
			assert.strictEqual(envIsTruthy(v), false);
		}
	});
	it("is true for any other non-empty value", () => {
		for (const v of ["1", "true", "yes", "on", "x"]) {
			assert.strictEqual(envIsTruthy(v), true);
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
