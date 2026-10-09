import { assert, describe, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { readEnv } from "../../effected/env/internal/envRecord.ts";

describe("readEnv", () => {
	it.effect("drops an empty string even when the provider preserves it", () =>
		Effect.map(
			readEnv(["FORCE_COLOR", "CI", "TERM"]).pipe(
				Effect.provideService(
					ConfigProvider.ConfigProvider,
					ConfigProvider.fromUnknown({ FORCE_COLOR: "", CI: "", TERM: "xterm" }, { preserveEmptyStrings: true }),
				),
			),
			(env) => {
				assert.deepStrictEqual(env, { TERM: "xterm" });
				assert.isFalse("FORCE_COLOR" in env);
				assert.isFalse("CI" in env);
			},
		),
	);

	it.effect("the control is live: the same provider really does carry the empty strings", () =>
		Effect.map(
			Effect.all([
				Effect.gen(function* () {
					const provider = yield* ConfigProvider.ConfigProvider;
					return yield* provider.load(["FORCE_COLOR"]);
				}),
			]).pipe(
				Effect.provideService(
					ConfigProvider.ConfigProvider,
					ConfigProvider.fromUnknown({ FORCE_COLOR: "" }, { preserveEmptyStrings: true }),
				),
			),
			([node]) => assert.deepStrictEqual(node, ConfigProvider.makeValue("")),
		),
	);

	it.effect("reads present keys and leaves absent ones out", () =>
		Effect.map(
			readEnv(["A", "B", "C"]).pipe(
				Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ A: "1", C: "3" })),
			),
			(env) => assert.deepStrictEqual(env, { A: "1", C: "3" }),
		),
	);

	it.effect("a provider whose reads fail yields an empty record", () =>
		Effect.map(
			readEnv(["A", "B"]).pipe(
				Effect.provideService(
					ConfigProvider.ConfigProvider,
					ConfigProvider.make(() => Effect.fail(new ConfigProvider.SourceError({ message: "boom" }))),
				),
			),
			(env) => assert.deepStrictEqual(env, {}),
		),
	);
});
