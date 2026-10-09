// Real-process regression for the Critical finding on the non-interactive prompt path: core runs `Prompt.run` on the
// answered fallback, and on the real NodeTerminal that attaches a readline to stdin, so piped bytes vanished when a
// handler did anything before reading them. This spawns a real child with real piped stdin and the real terminal,
// running the package sources through Node's type stripping (fixtures/register-ts.mjs).
//
// Two preconditions, neither of which is checked for you:
// - It is NOT build-free. The sources import `@effected/env`, which resolves to that package's BUILT output, so
//   `@effected/env` must have been built (`pnpm build --filter @effected/env`, or the `prepare` build on install).
// - Every module reachable from the fixture must be type-strip-clean: no parameter properties, enums or namespaces.
//   Node's plain type stripping rejects them with ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX, which shows up here as a failed
//   child exit, not as a test of the stdin behaviour.
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

const FIXTURES = join(import.meta.dirname, "fixtures");

const run = (args: ReadonlyArray<string>, stdin: string) =>
	Effect.scoped(
		Effect.gen(function* () {
			const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
			const command = ChildProcess.make(
				process.execPath,
				["--import", join(FIXTURES, "register-ts.mjs"), join(FIXTURES, "stdin-gate.mts"), ...args],
				{ env: { PATH: process.env.PATH ?? "", NO_COLOR: "1" }, stdin: Stream.make(new TextEncoder().encode(stdin)) },
			);
			const handle = yield* spawner.spawn(command);
			const text = (stream: Stream.Stream<Uint8Array, unknown>) => Stream.mkString(Stream.decodeText(stream));
			const [stdout, stderr, exitCode] = yield* Effect.all(
				[text(handle.stdout), text(handle.stderr), handle.exitCode],
				{
					concurrency: "unbounded",
				},
			);
			return { stdout, stderr, exitCode: Number(exitCode) };
		}),
	);

describe("a non-interactive run never consumes piped stdin", () => {
	it.effect(
		"a handler that waits before reading still gets every byte, through the fallback path",
		() =>
			Effect.gen(function* () {
				const { stdout, stderr, exitCode } = yield* run(["read"], "hello world");
				assert.strictEqual(exitCode, 0, stderr);
				assert.include(stdout, "bytes=11");
			}).pipe(Effect.provide(NodeServices.layer)),
		{ timeout: 30_000 },
	);

	it.effect(
		"control: with the flag given, the same handler also gets every byte",
		() =>
			Effect.gen(function* () {
				const { stdout, stderr, exitCode } = yield* run(["read", "--profile", "x"], "hello world");
				assert.strictEqual(exitCode, 0, stderr);
				assert.include(stdout, "bytes=11");
			}).pipe(Effect.provide(NodeServices.layer)),
		{ timeout: 30_000 },
	);
});
