import * as Config from "effect/Config";
import * as O from "effect/Option";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { CliTest } from "../../effected/cli/testing.ts";

const HOST_PATH = Config.String("PATH").pipe(Config.withDefault(""));
const HOST_HOME = Config.option(Config.String("HOME"));

const BIN = `${import.meta.dirname}/fixtures/exit3.mjs`;

it.layer(NodeServices.layer, { timeout: "30 seconds" })("CliTest", (it) => {
	it.effect("a non-zero exit is data, and both streams are captured", () =>
		Effect.gen(function* () {
			const sandbox = yield* CliTest.sandbox({ path: yield* HOST_PATH });
			const result = yield* CliTest.run(BIN, [], { sandbox, execPath: process.execPath, stdin: "" });
			assert.strictEqual(result.exitCode, 3);
			assert.strictEqual(result.stdout, `home=${sandbox.home}\n`);
			assert.strictEqual(result.stderr, "error: something failed\n");
		}),
	);

	it.effect("the sandbox never inherits the host HOME", () =>
		Effect.gen(function* () {
			const sandbox = yield* CliTest.sandbox({ path: yield* HOST_PATH });
			assert.notStrictEqual(sandbox.env.HOME, O.getOrUndefined(yield* HOST_HOME));
			assert.strictEqual(sandbox.env.NO_COLOR, "1");
			assert.isTrue(sandbox.env.XDG_CONFIG_HOME?.startsWith(sandbox.home));
		}),
	);

	it.effect("stdin is delivered to the child", () =>
		Effect.gen(function* () {
			const sandbox = yield* CliTest.sandbox({ path: yield* HOST_PATH });
			const result = yield* CliTest.run(BIN, [], { sandbox, execPath: process.execPath, stdin: "hello" });
			assert.isTrue(result.stdout.includes("stdin=hello"));
		}),
	);

	it.effect(
		"omitted stdin completes rather than hanging on an open pipe",
		() =>
			Effect.gen(function* () {
				const sandbox = yield* CliTest.sandbox({ path: yield* HOST_PATH });
				const result = yield* CliTest.run(BIN, [], { sandbox, execPath: process.execPath });
				assert.strictEqual(result.exitCode, 3);
				assert.isFalse(result.stdout.includes("stdin="));
			}),
		{ timeout: 5000 },
	);
});
