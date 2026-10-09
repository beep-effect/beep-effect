import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Ref from "effect/Ref";
import { ChildProcess } from "effect/process";
import { TestClock } from "effect/testing";
import { Retry } from "../../effected/commands/Retry.ts";
import { CommandFailedError, CommandOutput } from "../../effected/commands/Run.ts";
import { ScriptedSpawner } from "../../effected/commands/ScriptedSpawner.ts";

const command = ChildProcess.make("npm", ["publish"]);

const failedWith = (stderr: string, exitCode = 1) =>
	CommandFailedError.nonZero(command, CommandOutput.make({ stdout: "", stderr, exitCode }));

describe("Retry.isTransient", () => {
	it("classifies network transport codes as transient", () => {
		for (const code of ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "fetch failed"]) {
			assert.isTrue(Retry.isTransient(failedWith(`npm error ${code}`)), `${code} should be transient`);
		}
	});

	it("reads stdout too, because npm routes errors there", () => {
		const error = CommandFailedError.nonZero(
			command,
			CommandOutput.make({ stdout: "npm error ECONNRESET", stderr: "", exitCode: 1 }),
		);
		assert.isTrue(Retry.isTransient(error));
	});

	it("classifies an ordinary failure as permanent", () => {
		assert.isFalse(Retry.isTransient(failedWith("EPUBLISHCONFLICT: version already exists")));
	});

	it("a MISSING EXECUTABLE is never transient — retrying cannot install it", () => {
		assert.isFalse(Retry.isTransient(CommandFailedError.spawn(command, ScriptedSpawner.notFound("npm"))));
	});

	it("a non-NotFound spawn failure IS transient — a busy or locked binary can clear", () => {
		assert.isTrue(Retry.isTransient(CommandFailedError.spawn(command, ScriptedSpawner.permissionDenied("npm"))));
	});

	it("a timeout is NOT transient by default", () => {
		// A deterministically hanging command would otherwise burn its whole
		// ceiling on every attempt. Callers opt in explicitly.
		assert.isFalse(Retry.isTransient(CommandFailedError.timedOut(command)));
	});

	it("matches case-insensitively", () => {
		assert.isTrue(Retry.isTransient(failedWith("econnreset while fetching")));
	});
});

describe("Retry.transient", () => {
	it("accepts caller-supplied extra patterns", () => {
		const policy = Retry.transient({ also: ["EBUSY"] });
		assert.isTrue(policy.while(failedWith("EBUSY: resource busy")));
		assert.isFalse(Retry.isTransient(failedWith("EBUSY: resource busy")), "the default set is unchanged");
	});

	it("defaults to three attempts", () => {
		assert.strictEqual(Retry.transient().times, 2);
	});

	it.effect("retries a transient failure and eventually succeeds", () =>
		Effect.gen(function* () {
			const attempts = yield* Ref.make(0);
			const flaky = Effect.gen(function* () {
				const n = yield* Ref.updateAndGet(attempts, (c) => c + 1);
				if (n < 3) return yield* failedWith("npm error ECONNRESET");
				return "published";
			});
			const fiber = yield* Effect.forkChild(Effect.retry(flaky, Retry.transient()));
			yield* TestClock.adjust("1 minute");
			assert.strictEqual(yield* Fiber.join(fiber), "published");
			assert.strictEqual(yield* Ref.get(attempts), 3);
		}),
	);

	it.effect("does NOT retry a permanent failure", () =>
		Effect.gen(function* () {
			const attempts = yield* Ref.make(0);
			const doomed = Effect.gen(function* () {
				yield* Ref.update(attempts, (c) => c + 1);
				return yield* failedWith("EPUBLISHCONFLICT");
			});
			const fiber = yield* doomed.pipe(Effect.retry(Retry.transient()), Effect.flip, Effect.forkChild);
			yield* TestClock.adjust("1 minute");
			yield* Fiber.join(fiber);
			assert.strictEqual(yield* Ref.get(attempts), 1, "a permanent failure must not be retried at all");
		}),
	);

	it.effect("gives up after the attempt budget", () =>
		Effect.gen(function* () {
			const attempts = yield* Ref.make(0);
			const alwaysTransient = Effect.gen(function* () {
				yield* Ref.update(attempts, (c) => c + 1);
				return yield* failedWith("ECONNRESET");
			});
			const fiber = yield* alwaysTransient.pipe(Effect.retry(Retry.transient({ times: 2 })), Effect.flip, Effect.forkChild);
			yield* TestClock.adjust("1 minute");
			const error = yield* Fiber.join(fiber);
			assert.instanceOf(error, CommandFailedError);
			assert.strictEqual(yield* Ref.get(attempts), 3, "one initial attempt plus two retries");
		}),
	);
});
