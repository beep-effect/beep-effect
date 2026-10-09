import { assert, describe, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { DevEngine, DevEnginesSchema } from "../../effected/package-json/DevEngines.ts";

describe("DevEngine", () => {
	it("constructs with optional version and onFail", () => {
		const engine = DevEngine.make({ name: "node", version: "24.11.0", onFail: "ignore" });
		assert.strictEqual(engine.name, "node");
		assert.strictEqual(engine.version, "24.11.0");
		assert.strictEqual(engine.onFail, "ignore");
	});
});

describe("DevEnginesSchema", () => {
	it.effect("decodes a single packageManager constraint and a runtime array", () =>
		Effect.gen(function* () {
			const decoded = yield* Schema.decodeUnknownEffect(DevEnginesSchema)({
				packageManager: { name: "pnpm", version: "10.33.0", onFail: "ignore" },
				runtime: [{ name: "node", version: "24.11.0", onFail: "ignore" }],
			});
			assert.instanceOf(decoded.packageManager, DevEngine);
			assert.isTrue(Array.isArray(decoded.runtime));
		}),
	);
});
