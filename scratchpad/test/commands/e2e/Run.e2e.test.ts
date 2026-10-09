// Real processes, through @effect/platform-node's real ChildProcessSpawner.
//
// Everything here exercises behavior a mocked spawner cannot reproduce: OS pipe
// backpressure, the platform backend's ENOENT mapping, and the unref/scope
// interaction that `Run.detach` rests on. Nothing here re-tests classification
// logic — that lives in the unit suite over a scripted spawner.

import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import { CommandFailedError, Run } from "../../../effected/commands/Run.ts";

/** Builds each test layer under the program's scope, with fresh per-invocation state. */
const withLayer = <R, E2, R2>(layer: Layer.Layer<R, E2, R2>) => <A, E, R3>(program: Effect.Effect<A, E, R3>) =>
 Effect.scopedWith((scope) => Effect.flatMap(
  Layer.buildWithScope(layer, scope),
  (context) => Effect.provideContext(program, context),
 ));

/** The real platform services, built once for the file. */
const Platform = NodeServices.layer;

/** Runs a program against the real spawner. */
const live = <A, E>(program: Effect.Effect<A, E, ChildProcessSpawner.ChildProcessSpawner>): Effect.Effect<A, E> =>
	withLayer(Platform)(program);

/** `node -e "<script>"` — the one binary guaranteed to exist wherever these tests run. */
const node = (script: string) => ChildProcess.make(process.execPath, ["-e", script]);

/** A pause on the live clock used by the real-process tests. */
const realDelay = (millis: number) => Effect.sleep(millis);

/** Whether a pid is still alive, without signalling it. */
const isAlive = (pid: number): boolean => {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
};

describe("Run against real processes", () => {
	it.effect("text captures stdout", () =>
		Effect.gen(function* () {
			const output = yield* live(Run.text(node("process.stdout.write('hello')")));
			assert.strictEqual(output, "hello");
		}),
	);

	it.effect("a real non-zero exit fails typed with the real code", () =>
		Effect.gen(function* () {
			const error = yield* Run.text(node("process.stderr.write('bad'); process.exit(3)")).pipe(live, Effect.flip);
			assert.instanceOf(error, CommandFailedError);
			if (S.is(CommandFailedError)(error)) {
				assert.strictEqual(error.kind, "nonZero");
				assert.strictEqual(error.exitCode, 3);
				assert.include(error.stderr ?? "", "bad");
			}
		}),
	);

	it.effect("an absent executable maps to notFound", () =>
		// This pins PLATFORM-BACKEND behavior, not core's contract: the whole
		// "tool is absent" classification rests on the Node backend mapping ENOENT
		// to a NotFound SystemError. If a future backend changes that, every
		// availability answer in this package silently inverts — so it is tested
		// against a real spawn, not a fixture.
		Effect.gen(function* () {
			const error = yield* Run.text(ChildProcess.make("effected-no-such-binary-xyz", [])).pipe(live, Effect.flip);
			assert.instanceOf(error, CommandFailedError);
			if (S.is(CommandFailedError)(error)) {
				assert.strictEqual(error.kind, "spawn");
				assert.isTrue(error.notFound, "ENOENT from a real spawn must classify as notFound");
			}
		}),
	);

	it.effect("succeeds answers false for an absent executable and true for a real one", () =>
		Effect.gen(function* () {
			assert.isFalse(yield* live(Run.succeeds(ChildProcess.make("effected-no-such-binary-xyz", []))));
			assert.isTrue(yield* live(Run.succeeds(node("process.exit(0)"))));
		}),
	);

	it.effect(
		"collect drains stdout and stderr concurrently under simultaneous backpressure on BOTH pipes",
		() =>
			// The single most important test in this file. Collecting the two
			// streams sequentially deadlocks the moment either OS pipe buffer
			// fills: the child blocks writing to a full pipe while the reader that
			// would drain it is still waiting on the other stream. A mock spawner
			// over in-memory streams CANNOT reproduce this, and a large-output-on-
			// one-stream case does not discriminate sequential from concurrent
			// collection — the pressure has to be on both at once.
			//
			// Do not delete this test. If `{ concurrency: "unbounded" }` in
			// `collectRaw` is ever relaxed, this hangs to the timeout below.
			Effect.gen(function* () {
				const script = [
					"const big = 'x'.repeat(1024 * 1024);",
					"process.stdout.write(big);",
					"process.stderr.write(big);",
					"process.stdout.write(big);",
					"process.stderr.write(big);",
				].join("");
				const output = yield* live(Run.collect(node(script)));
				assert.strictEqual(output.stdout.length, 2 * 1024 * 1024);
				assert.strictEqual(output.stderr.length, 2 * 1024 * 1024);
				assert.strictEqual(output.exitCode, 0);
			}),
		30_000,
	);

	it.effect("json decodes real tool output through a schema", () =>
		Effect.gen(function* () {
			const parsed = yield* live(
				Run.json(node("process.stdout.write(JSON.stringify({ ok: true }))"), S.Struct({ ok: S.Boolean })),
			);
			assert.deepStrictEqual(parsed, { ok: true });
		}),
	);
});

describe("environment extension against a real spawn", () => {
	// One probe script serves both halves: it reports whether the child saw the
	// marker AND whether it saw a PATH. The pair is what discriminates — either
	// test alone would pass under the wrong env-resolution behavior.
	const probe =
		"process.stdout.write((process.env.EFFECTED_MARKER ?? 'no-marker') + ':' + (process.env.PATH ? 'has-path' : 'no-path'))";

	it.effect("Run.extendEnv gives the child the new variable WITHOUT losing the parent PATH", () =>
		Effect.gen(function* () {
			const output = yield* live(Run.text(node(probe).pipe(Run.extendEnv({ EFFECTED_MARKER: "x" }))));
			assert.strictEqual(output, "x:has-path");
		}),
	);

	it.effect("bare core setEnv strips the parent environment — the platform trap Run.extendEnv exists for", () =>
		// This empirically pins the resolveEnvironment behavior the combinator
		// compensates for: setEnv never sets extendEnv, so the child's WHOLE
		// environment is the one variable. The spawn itself still works because
		// `node` is invoked by absolute path, not through PATH lookup.
		Effect.gen(function* () {
			const output = yield* live(Run.text(node(probe).pipe(ChildProcess.setEnv({ EFFECTED_MARKER: "x" }))));
			assert.strictEqual(output, "x:no-path");
		}),
	);
});

describe("Run.detach lifecycle", () => {
	it.live(
		"an unref'd child SURVIVES its scope closing",
		() =>
			Effect.gen(function* () {
				// A child that would outlive the test if we leaked it — always reaped
				// below, whichever way the assertions go.
				const pid = yield* live(Run.detach(node("setTimeout(() => {}, 60_000)")));
				yield* realDelay(250).pipe(
					Effect.tap(() => Effect.sync(() =>
						assert.isTrue(isAlive(Number(pid)), "detach must leave the child running after its scope closed"),
					)),
					Effect.ensuring(Effect.sync(() => {
						try {
							process.kill(Number(pid), "SIGKILL");
						} catch {
							// already gone
						}
					})),
				);
			}),
		15_000,
	);

	it.live(
		"a child spawned WITHOUT unref is killed when its scope closes — the mirror case",
		() =>
			// Without this half, the test above could pass for the wrong reason: if
			// scope close never killed anything, "still alive" would prove nothing
			// about unref. This is what makes the pair discriminating.
			Effect.gen(function* () {
				const pid = yield* Effect.gen(function* () {
					const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
					const handle = yield* spawner.spawn(node("setTimeout(() => {}, 60_000)"));
					return handle.pid;
				}).pipe(Effect.scoped, live);
				yield* realDelay(250);
				assert.isFalse(isAlive(Number(pid)), "a referenced child must not survive its scope");
			}),
		15_000,
	);
});
