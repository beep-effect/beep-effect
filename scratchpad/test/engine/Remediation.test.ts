import { assert, describe, it } from "@effect/vitest";
import { Schema } from "effect";
import { Remediation } from "../../effected/engine/index.ts";

describe("Remediation", () => {
	it("accepts a bare hint", () => {
		assert.deepStrictEqual(Schema.decodeUnknownSync(Remediation)({ hint: "Run okfit init." }), {
			hint: "Run okfit init.",
		});
	});

	it("accepts the okfit/systems shape with a suggested tool", () => {
		const value = { hint: "No such concept.", suggestedTool: "list_concepts" };
		assert.deepStrictEqual(Schema.decodeUnknownSync(Remediation)(value), value);
	});

	it("accepts the vitest-agent shape with suggested args", () => {
		const value = { hint: "Goal not found.", suggestedTool: "tdd_goal", suggestedArgs: { action: "list" } };
		assert.deepStrictEqual(Schema.decodeUnknownSync(Remediation)(value), value);
	});

	it("rejects an explicit undefined on an optional key", () => {
		assert.throws(() => Schema.decodeUnknownSync(Remediation)({ hint: "x", suggestedTool: undefined }));
	});

	it("rejects a missing hint", () => {
		assert.throws(() => Schema.decodeUnknownSync(Remediation)({ suggestedTool: "list_concepts" }));
	});
});
