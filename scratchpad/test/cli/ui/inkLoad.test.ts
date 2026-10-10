// @effect-diagnostics asyncFunction:skip-file
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { vi } from "vitest";

// Each factory records that its package was loaded, then hands back the real module.
const { loads } = vi.hoisted(() => ({ loads: Array<string>() }));
vi.mock("ink", async (importOriginal) => {
	loads.push("ink");
	return await importOriginal();
});
vi.mock("react", async (importOriginal) => {
	loads.push("react");
	return await importOriginal();
});

describe("loading the optional peers", () => {
	it.effect("importing ./ui loads neither peer, reading before load throws, and loadInk loads both once", () =>
		Effect.gen(function* () {
			yield* Effect.promise(() => import("../../../effected/cli/ui.ts"));
			const bridge = yield* Effect.promise(() => import("../../../effected/cli/ui/internal/ink.ts"));
			// A stray import() at module scope resolves asynchronously: wait for every started import before asserting none did.
			yield* Effect.promise(() => vi.dynamicImportSettled());
			assert.deepStrictEqual(loads, [], "importing ./ui and the bridge loads nothing");
			assert.throws(() => bridge.inkModules(), /read Ink before loading it: run CliUi\.context/);

			const first = yield* bridge.loadInk;
			const second = yield* bridge.loadInk;
			assert.deepStrictEqual([...loads].sort(), ["ink", "react"]);
			assert.strictEqual(second, first, "the load is memoised");
			assert.strictEqual(bridge.inkModules(), first);
			assert.isFunction(first.react.createElement);
			assert.isFunction(first.ink.render);
		}),
	);
});
