import { assert, describe, it } from "@effect/vitest";
import { Result, Schema } from "effect";
import { Remediation } from "../../effected/engine/index.ts";

describe("Remediation", () => {
	it("accepts a bare hint", () => {
		assert.deepStrictEqual(Result.getOrThrowWith(Schema.decodeResult(Remediation)({ hint: "Run okfit init." }), (error) => error), {
			hint: "Run okfit init.",
		});
	});

	it("accepts the okfit/systems shape with a suggested tool", () => {
		const value: Remediation = { hint: "No such concept.", suggestedTool: "list_concepts" };
		assert.deepStrictEqual(Result.getOrThrowWith(Schema.decodeResult(Remediation)(value), (error) => error), value);
	});

	it("accepts the vitest-agent shape with suggested args", () => {
		const value: Remediation = { hint: "Goal not found.", suggestedTool: "tdd_goal", suggestedArgs: { action: "list" } };
		assert.deepStrictEqual(Result.getOrThrowWith(Schema.decodeResult(Remediation)(value), (error) => error), value);
	});

	it("rejects an explicit undefined on an optional key", () => {
		assert.throws(() =>
			Result.getOrThrowWith(Schema.decodeUnknownResult(Remediation)({ hint: "x", suggestedTool: undefined }), (error) => error),
		);
	});

	it("rejects a missing hint", () => {
		assert.throws(() =>
			Result.getOrThrowWith(Schema.decodeUnknownResult(Remediation)({ suggestedTool: "list_concepts" }), (error) => error),
		);
	});
});
