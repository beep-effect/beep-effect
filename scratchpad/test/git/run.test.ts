// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import { Cause, Effect, Exit, Layer, PlatformError } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { available, runCollected } from "../../effected/git/internal/run.ts";
import { scripted } from "./fixtures.ts";

const command = ChildProcess.make("git", ["rev-parse", "--verify", "HEAD"], {});

describe("runCollected", () => {
	it.effect("returns stdout, stderr, and exitCode together, even on a non-zero exit", () =>
		Effect.gen(function* () {
			const collected = yield* runCollected(command).pipe(
				Effect.provide(scripted(() => ({ stdout: "abc123\n", exit: 1 }))),
			);
			assert.deepStrictEqual(collected, { stdout: "abc123\n", stderr: "", exitCode: 1 });
		}),
	);

	it.effect("captures stdout and stderr from the same run", () =>
		Effect.gen(function* () {
			const collected = yield* runCollected(command).pipe(
				Effect.provide(scripted(() => ({ stdout: "out-line\n", stderr: "err-line\n", exit: 0 }))),
			);
			assert.strictEqual(collected.stdout, "out-line\n");
			assert.strictEqual(collected.stderr, "err-line\n");
			assert.strictEqual(collected.exitCode, 0);
		}),
	);

	it.effect("propagates a PlatformError from the spawner", () =>
		Effect.gen(function* () {
			const failure = PlatformError.systemError({ _tag: "NotFound", module: "ChildProcess", method: "spawn" });
			const exit = yield* Effect.exit(runCollected(command).pipe(Effect.provide(scripted(() => failure))));
			assert.strictEqual(exit._tag, "Failure");
		}),
	);
});

describe("available", () => {
	it.effect("is true on a non-zero exit — any completed run proves existence", () =>
		Effect.gen(function* () {
			const result = yield* available(command).pipe(Effect.provide(scripted(() => ({ exit: 1 }))));
			assert.isTrue(result);
		}),
	);

	it.effect("is false when the spawner fails with a PlatformError", () =>
		Effect.gen(function* () {
			const failure = PlatformError.systemError({ _tag: "NotFound", module: "ChildProcess", method: "spawn" });
			const result = yield* available(command).pipe(Effect.provide(scripted(() => failure)));
			assert.isFalse(result);
		}),
	);

	it.effect("lets a defect propagate — only a typed PlatformError is absorbed", () =>
		Effect.gen(function* () {
			const dying = Layer.succeed(
				ChildProcessSpawner.ChildProcessSpawner,
				ChildProcessSpawner.make(() => Effect.die(new Error("boom"))),
			);
			const exit = yield* Effect.exit(available(command).pipe(Effect.provide(dying)));
			if (Exit.isFailure(exit)) {
				assert.isTrue(Cause.hasDies(exit.cause));
				assert.isFalse(Cause.hasFails(exit.cause));
			} else {
				assert.fail("expected available to fail with a defect, but it succeeded");
			}
		}),
	);
});
