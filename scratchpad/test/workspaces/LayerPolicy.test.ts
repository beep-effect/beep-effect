import { assert, describe, it, layer } from "@effect/vitest";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { LayerPolicy } from "../../effected/workspaces/testing.ts";

const VALID = { layers: [["app"], ["core"]], tooling: [], unconstrained: ["@e2e/*"] };

describe("LayerPolicy.decode", () => {
	it.effect("defaults fields to all four dependency maps, and honours an explicit list", () =>
		Effect.gen(function* () {
			const all = yield* LayerPolicy.decode(VALID);
			assert.deepStrictEqual(all.effectiveFields, [
				"dependencies",
				"devDependencies",
				"peerDependencies",
				"optionalDependencies",
			]);
			const runtime = yield* LayerPolicy.decode({ ...VALID, fields: ["dependencies", "peerDependencies"] });
			assert.deepStrictEqual(runtime.effectiveFields, ["dependencies", "peerDependencies"]);
		}),
	);

	it.effect("rejects every key it does not model, naming each one, so a typo cannot drop a guard", () =>
		Effect.gen(function* () {
			// requiredEdge (singular) would otherwise vanish, and the non-vacuity guard with it.
			const error = yield* Effect.flip(
				LayerPolicy.decode({ ...VALID, requiredEdge: ["app -> core"], feilds: ["dependencies"] }),
			);
			assert.strictEqual(error.reason, "decode");
			assert.include(error.message, "requiredEdge");
			assert.include(error.message, "feilds");
		}),
	);

	it.effect("accepts $schema, and a foreign key only when the caller allows it (systems' harness)", () =>
		Effect.gen(function* () {
			const withSchema = yield* LayerPolicy.decode({ ...VALID, $schema: "./layers.schema.json" });
			assert.deepStrictEqual(withSchema.layers, [["app"], ["core"]]);
			const allowed = yield* LayerPolicy.decode({ ...VALID, harness: ["@e2e/*"] }, { allowKeys: ["harness"] });
			assert.deepStrictEqual(allowed.unconstrained, ["@e2e/*"]);
			// Control: the same input without the allowance fails.
			const refused = yield* Effect.flip(LayerPolicy.decode({ ...VALID, harness: ["@e2e/*"] }));
			assert.include(refused.message, "harness");
		}),
	);

	it.effect("rejects a required edge not written as 'a -> b'", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(LayerPolicy.decode({ ...VALID, requiredEdges: ["app->core"] }));
			assert.strictEqual(error.reason, "decode");
		}),
	);

	it.effect("rejects an unconstrained glob that cannot compile", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(LayerPolicy.decode({ ...VALID, unconstrained: ["a".repeat(65_537)] }));
			assert.strictEqual(error.reason, "decode");
		}),
	);
});

describe("LayerPolicy.load", () => {
	layer(
		MemoryFileSystem.layerWith({
			"/repo/layers.json": JSON.stringify(VALID),
			"/repo/broken.json": "{ not json",
			"/repo/foreign.json": JSON.stringify({ ...VALID, harness: ["@e2e/*"] }),
		}),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("reads and decodes a committed policy", () =>
			Effect.gen(function* () {
				const policy = yield* LayerPolicy.load("/repo/layers.json");
				assert.deepStrictEqual(policy.unconstrained, ["@e2e/*"]);
			}),
		);

		it.effect("names the file and the failure kind", () =>
			Effect.gen(function* () {
				const missing = yield* Effect.flip(LayerPolicy.load("/repo/nope.json"));
				assert.deepStrictEqual([missing.reason, missing.path], ["read", "/repo/nope.json"]);
				const broken = yield* Effect.flip(LayerPolicy.load("/repo/broken.json"));
				assert.deepStrictEqual([broken.reason, broken.path], ["json", "/repo/broken.json"]);
			}),
		);

		it.effect("passes allowKeys through to decode, and names the file when a key is refused", () =>
			Effect.gen(function* () {
				const refused = yield* Effect.flip(LayerPolicy.load("/repo/foreign.json"));
				assert.deepStrictEqual([refused.reason, refused.path], ["decode", "/repo/foreign.json"]);
				const policy = yield* LayerPolicy.load("/repo/foreign.json", { allowKeys: ["harness"] });
				assert.deepStrictEqual(policy.layers, [["app"], ["core"]]);
			}),
		);
	});
});

describe("LayerPolicy JSON Schema export", () => {
	it("each required edge exports its pattern", () => {
		assert.nestedPropertyVal(
			S.toJsonSchemaDocument(LayerPolicy),
			"definitions.@beep/scratchpad/effected/workspaces/LayerPolicy/LayerPolicyEncoded.properties.requiredEdges.items.pattern",
			String.raw`^\S+ -> \S+$`,
		);
	});
});
