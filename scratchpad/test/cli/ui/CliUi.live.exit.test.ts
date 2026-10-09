// Real-process check of okf/decisions/live-tick-is-a-scoped-schedule.md: a live view's tick is an Effect schedule forked into the run's scope, so closing the
// scope interrupts it and the process exits at once. A tick left on a ref'd timer would keep the child alive.
// Runs the package sources through Node's type stripping (fixtures/register-ts.mjs); see CliStdin.test.ts for the
// preconditions (a built @effected/env, type-strip-clean sources).
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

const FIXTURES = join(import.meta.dirname, "..", "fixtures");

describe("CliUi.live in a real process: the tick never holds it open", () => {
	it.live(
		"the process exits promptly once the view's scope closes: no ref'd timer is left behind",
		() =>
			Effect.scoped(
				Effect.gen(function* () {
					const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
					const command = ChildProcess.make(
						process.execPath,
						["--import", join(FIXTURES, "register-ts.mjs"), join(FIXTURES, "live-exit.mts")],
						{ env: { PATH: process.env.PATH ?? "", NODE_ENV: "production" } },
					);
					const handle = yield* spawner.spawn(command);
					const text = (stream: Stream.Stream<Uint8Array, unknown>) => Stream.mkString(Stream.decodeText(stream));
					const [stdout, stderr, exitCode] = yield* Effect.all(
						[text(handle.stdout), text(handle.stderr), handle.exitCode],
						{
							concurrency: "unbounded",
						},
					);
					const exitedAt = Date.now();
					assert.strictEqual(Number(exitCode), 0, stderr);
					const match = /closed (\d+) frames (\d+)/.exec(stdout);
					assert.isNotNull(match, `the fixture reported: ${stdout} ${stderr}`);
					assert.isAbove(Number(match?.[2]), 2, "the tick drew several frames while the scope was open");
					assert.isBelow(exitedAt - Number(match?.[1]), 1000, "exited within a second of the scope closing");
				}),
			).pipe(Effect.timeout("10 seconds"), Effect.provide(NodeServices.layer)),
		{ timeout: 30_000 },
	);
});
