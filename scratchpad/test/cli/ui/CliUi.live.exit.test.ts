// Real-process check of okf/decisions/live-tick-is-a-scoped-schedule.md: a live view's tick is an Effect schedule forked into the run's scope, so closing the
// scope interrupts it and the process exits at once. A tick left on a ref'd timer would keep the child alive.
// Runs the package sources through Node's type stripping (fixtures/register-ts.mjs); see CliStdin.test.ts for the
// preconditions (a built @effected/env, type-strip-clean sources).
import { NodeServices } from "@effect/platform-node";
import { assert, it } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as Stream from "effect/Stream";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

it.layer(NodeServices.layer, { timeout: "30 seconds", excludeTestServices: true })(
	"CliUi.live in a real process: the tick never holds it open",
	(it) => {
		// Real clock: compare the child's scope-close timestamp with parent process exit time.
		it.effect(
			"the process exits promptly once the view's scope closes: no ref'd timer is left behind",
			() =>
				Effect.gen(function* () {
					const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
					const path = yield* Path.Path;
					const fixtures = path.join(import.meta.dirname, "..", "fixtures");
					const command = ChildProcess.make(
						process.execPath,
						["--import", path.join(fixtures, "register-ts.mjs"), path.join(fixtures, "live-exit.mts")],
						{ env: { PATH: yield* Config.String("PATH").pipe(Config.withDefault("")), NODE_ENV: "production" } },
					);
					const handle = yield* spawner.spawn(command);
					const text = <E>(stream: Stream.Stream<Uint8Array, E>) => stream.pipe(Stream.decodeText, Stream.mkString);
					const [stdout, stderr, exitCode] = yield* Effect.all(
						[text(handle.stdout), text(handle.stderr), handle.exitCode],
						{
							concurrency: "unbounded",
						},
					);
					const exitedAt = yield* Clock.currentTimeMillis;
					assert.strictEqual(Number(exitCode), 0, stderr);
					const match = /closed (\d+) frames (\d+)/.exec(stdout);
					assert.isNotNull(match, `the fixture reported: ${stdout} ${stderr}`);
					assert.isAbove(Number(match?.[2]), 2, "the tick drew several frames while the scope was open");
					assert.isBelow(exitedAt - Number(match?.[1]), 1000, "exited within a second of the scope closing");
				}).pipe(Effect.timeout("10 seconds")),
			{ timeout: 30_000 },
		);
	},
);
