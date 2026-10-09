import { assert, describe, it } from "@effect/vitest";

describe("the @effected/env entrypoint", () => {
	it("exports exactly the public runtime surface", async () => {
		const main = await import("../../effected/env/index.ts");
		assert.deepStrictEqual(Object.keys(main).sort(), [
			"Audience",
			"CurrentRuntimeEnv",
			"EnvOverride",
			"RuntimeEnv",
			"TerminalEnv",
		]);
	});
});
