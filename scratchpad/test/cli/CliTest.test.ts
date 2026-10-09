// @effect-diagnostics strictEffectProvide:skip-file nodeBuiltinImport:skip-file processEnvInEffect:skip-file
import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { CliTest } from "../../effected/cli/testing.ts";

const BIN = join(import.meta.dirname, "fixtures", "exit3.mjs");

describe("CliTest", () => {
	it.effect("a non-zero exit is data, and both streams are captured", () =>
		Effect.gen(function* () {
			const sandbox = yield* CliTest.sandbox({ path: process.env.PATH ?? "" });
			const result = yield* CliTest.run(BIN, [], { sandbox, execPath: process.execPath, stdin: "" });
			assert.strictEqual(result.exitCode, 3);
			assert.strictEqual(result.stdout, `home=${sandbox.home}\n`);
			assert.strictEqual(result.stderr, "error: something failed\n");
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);

	it.effect("the sandbox never inherits the host HOME", () =>
		Effect.gen(function* () {
			const sandbox = yield* CliTest.sandbox({ path: process.env.PATH ?? "" });
			assert.notStrictEqual(sandbox.env.HOME, process.env.HOME);
			assert.strictEqual(sandbox.env.NO_COLOR, "1");
			assert.isTrue(sandbox.env.XDG_CONFIG_HOME?.startsWith(sandbox.home));
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);

	it.effect("stdin is delivered to the child", () =>
		Effect.gen(function* () {
			const sandbox = yield* CliTest.sandbox({ path: process.env.PATH ?? "" });
			const result = yield* CliTest.run(BIN, [], { sandbox, execPath: process.execPath, stdin: "hello" });
			assert.isTrue(result.stdout.includes("stdin=hello"));
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);

	it.effect(
		"omitted stdin completes rather than hanging on an open pipe",
		() =>
			Effect.gen(function* () {
				const sandbox = yield* CliTest.sandbox({ path: process.env.PATH ?? "" });
				const result = yield* CliTest.run(BIN, [], { sandbox, execPath: process.execPath });
				assert.strictEqual(result.exitCode, 3);
				assert.isFalse(result.stdout.includes("stdin="));
			}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
		{ timeout: 5000 },
	);
});
