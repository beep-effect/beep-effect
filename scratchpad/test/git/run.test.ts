import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as PlatformError from "effect/PlatformError";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { available, runCollected } from "../../effected/git/internal/run.ts";
import { scripted } from "./fixtures.ts";

const command = ChildProcess.make("git", ["rev-parse", "--verify", "HEAD"], {});

const provideSpawner = (layer: Layer.Layer<ChildProcessSpawner.ChildProcessSpawner>) =>
  <A, E>(program: Effect.Effect<A, E, ChildProcessSpawner.ChildProcessSpawner>) =>
    Effect.scopedWith((scope) => Effect.flatMap(
      Layer.buildWithScope(layer, scope),
      (context) => Effect.provideContext(program, context),
    ));

describe("runCollected", () => {
	it.effect("returns stdout, stderr, and exitCode together, even on a non-zero exit", () =>
		Effect.gen(function* () {
			const collected = yield* runCollected(command).pipe(
				provideSpawner(scripted(() => ({ stdout: "abc123\n", exit: 1 }))),
			);
			assert.deepStrictEqual(collected, { stdout: "abc123\n", stderr: "", exitCode: 1 });
		}),
	);

	it.effect("captures stdout and stderr from the same run", () =>
		Effect.gen(function* () {
			const collected = yield* runCollected(command).pipe(
				provideSpawner(scripted(() => ({ stdout: "out-line\n", stderr: "err-line\n", exit: 0 }))),
			);
			assert.strictEqual(collected.stdout, "out-line\n");
			assert.strictEqual(collected.stderr, "err-line\n");
			assert.strictEqual(collected.exitCode, 0);
		}),
	);

	it.effect("propagates a PlatformError from the spawner", () =>
		Effect.gen(function* () {
			const failure = PlatformError.systemError({ _tag: "NotFound", module: "ChildProcess", method: "spawn" });
			const exit = yield* command.pipe(runCollected, provideSpawner(scripted(() => failure)), Effect.exit);
			assert.strictEqual(exit._tag, "Failure");
		}),
	);
});

describe("available", () => {
	it.effect("is true on a non-zero exit — any completed run proves existence", () =>
		Effect.gen(function* () {
			const result = yield* available(command).pipe(provideSpawner(scripted(() => ({ exit: 1 }))));
			assert.isTrue(result);
		}),
	);

	it.effect("is false when the spawner fails with a PlatformError", () =>
		Effect.gen(function* () {
			const failure = PlatformError.systemError({ _tag: "NotFound", module: "ChildProcess", method: "spawn" });
			const result = yield* available(command).pipe(provideSpawner(scripted(() => failure)));
			assert.isFalse(result);
		}),
	);

	it.effect("lets a defect propagate — only a typed PlatformError is absorbed", () =>
		Effect.gen(function* () {
			const dying = Layer.succeed(
				ChildProcessSpawner.ChildProcessSpawner,
				ChildProcessSpawner.make(() => Effect.die(new Error("boom"))),
			);
			const exit = yield* command.pipe(available, provideSpawner(dying), Effect.exit);
			if (Exit.isFailure(exit)) {
				assert.isTrue(Cause.hasDies(exit.cause));
				assert.isFalse(Cause.hasFails(exit.cause));
			} else {
				assert.fail("expected available to fail with a defect, but it succeeded");
			}
		}),
	);
});
