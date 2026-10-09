// @effect-diagnostics strictEffectProvide:skip-file nodeBuiltinImport:skip-file asyncFunction:skip-file processEnv:skip-file processEnvInEffect:skip-file globalTimers:skip-file newPromise:skip-file globalRandom:skip-file
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import type { Server, ServerResponse } from "node:http";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assert, describe, it } from "@effect/vitest";
import { Cause, Effect, Exit, Fiber, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import { vi } from "vitest";
import {
	DetachedLogUnavailableError,
	DetachedNotReadyError,
	DetachedProcess,
	DetachedSignalFailedError,
	DetachedSpawnFailedError,
	InvalidPidError,
	ProcessId,
} from "../../effected/github-actions/index.ts";

/** A fresh scratch directory per use, removed by the test that made it. */
const scratch = () => mkdtempSync(join(tmpdir(), "effected-detached-"));

/** Wait for a real condition without a real sleep loop in the assertion. */
const eventually = async (predicate: () => boolean, attempts = 100): Promise<boolean> => {
	for (let remaining = attempts; remaining > 0; remaining -= 1) {
		if (predicate()) {
			return true;
		}
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	return predicate();
};

/** Whether a pid is still alive, asked without signalling it. */
const alive = (pid: number): boolean => {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
};

/**
 * Run an effect with `process.kill` replaced, restoring it on every exit path.
 *
 * @remarks
 * `acquireUseRelease` rather than `try`/`finally`, because a failing assertion
 * inside `Effect.gen` leaves through the error channel — and a spy on a real
 * process global that survives its own test poisons every later one, including
 * the control that proves the guard is not simply refusing everything.
 */
const withKillSpy = <A, E>(
	implementation: () => true,
	use: (calls: ReadonlyArray<ReadonlyArray<unknown>>) => Effect.Effect<A, E>,
) =>
	Effect.acquireUseRelease(
		Effect.sync(() => vi.spyOn(process, "kill").mockImplementation(implementation as never)),
		(spy) => use(spy.mock.calls),
		(spy) => Effect.sync(() => spy.mockRestore()),
	);

describe("DetachedProcess", () => {
	describe("the bare-pid guard", () => {
		it.effect("refuses pid 0 WITHOUT signalling anything", () =>
			// The assertion that matters is the spy, not the failure. pid 0 signals
			// the caller's entire process group, so on a runner an unguarded reap of a
			// state value that decoded to 0 takes down the job running it. A test that
			// only checked the effect failed would pass against an implementation that
			// killed the group and THEN reported an error.
			withKillSpy(
				() => true,
				(calls) =>
					Effect.gen(function* () {
						const error = yield* Effect.flip(DetachedProcess.reap(0));
						assert.instanceOf(error, InvalidPidError);
						assert.lengthOf(calls, 0, "process.kill must not have been called at all");
					}),
			),
		);

		it.effect("refuses pid -1 WITHOUT signalling anything", () =>
			// -1 is worse than 0: it signals every process the user owns.
			withKillSpy(
				() => true,
				(calls) =>
					Effect.gen(function* () {
						const error = yield* Effect.flip(DetachedProcess.reap(-1));
						assert.instanceOf(error, InvalidPidError);
						assert.lengthOf(calls, 0, "process.kill must not have been called at all");
					}),
			),
		);

		it.effect("refuses a non-integer pid", () =>
			withKillSpy(
				() => true,
				(calls) =>
					Effect.gen(function* () {
						const error = yield* Effect.flip(DetachedProcess.reap(Number.NaN));
						assert.instanceOf(error, InvalidPidError);
						assert.lengthOf(calls, 0);
					}),
			),
		);

		it.effect("the control: a positive pid DOES reach process.kill", () =>
			// Without this, the three tests above pass against an implementation that
			// never signals anything at all.
			withKillSpy(
				() => true,
				(calls) =>
					Effect.gen(function* () {
						assert.isTrue(yield* DetachedProcess.reap(4242, "SIGTERM"));
						assert.deepStrictEqual(calls, [[4242, "SIGTERM"]]);
					}),
			),
		);
	});

	describe("reap", () => {
		it.effect("reports an already-dead process as false rather than failing", () =>
			withKillSpy(
				() => {
					throw Object.assign(new Error("kill ESRCH"), { code: "ESRCH" });
				},
				() =>
					Effect.gen(function* () {
						// A post phase finding its child already gone is the normal ending.
						assert.isFalse(yield* DetachedProcess.reap(4242));
					}),
			),
		);

		it.effect("fails typed when the signal is refused", () =>
			withKillSpy(
				() => {
					throw Object.assign(new Error("kill EPERM"), { code: "EPERM" });
				},
				() =>
					Effect.gen(function* () {
						const error = yield* Effect.flip(DetachedProcess.reap(4242));
						assert.instanceOf(error, DetachedSignalFailedError);
						assert.strictEqual(error.pid, 4242);
					}),
			),
		);
	});

	describe("ProcessId", () => {
		it("refuses the zero a truncated state file decodes to", () => {
			// Both defenses matter and this is the first: the bad value never reaches
			// reap, because it never leaves ActionState.
			assert.strictEqual(Schema.decodeExit(ProcessId)(0)._tag, "Failure");
			assert.strictEqual(Schema.decodeExit(ProcessId)(-1)._tag, "Failure");
			assert.strictEqual(Schema.decodeExit(ProcessId)(1.5)._tag, "Failure");
		});

		it.effect("accepts a real pid", () =>
			Effect.gen(function* () {
				assert.strictEqual(yield* Schema.decodeEffect(ProcessId)(4242), 4242);
			}),
		);
	});

	describe("awaitReady", () => {
		it.effect("returns as soon as the probe holds, without waiting", () =>
			Effect.gen(function* () {
				let calls = 0;
				yield* DetachedProcess.awaitReady(
					Effect.sync(() => {
						calls += 1;
						return true;
					}),
				);
				assert.strictEqual(calls, 1, "a probe that already holds must not be retried");
			}),
		);

		it.effect("polls until the probe holds", () =>
			Effect.gen(function* () {
				let calls = 0;
				const probe = Effect.sync(() => {
					calls += 1;
					return calls >= 3;
				});
				const fiber = yield* Effect.forkChild(DetachedProcess.awaitReady(probe, { interval: "100 millis" }));
				// Latch-free but clock-driven: it.effect installs a virtual clock, so a
				// real sleep here would hang to the vitest timeout instead of ticking.
				yield* TestClock.adjust("100 millis");
				yield* TestClock.adjust("100 millis");
				yield* Fiber.join(fiber);
				assert.strictEqual(calls, 3);
			}),
		);

		it.effect("fails typed once the attempts are exhausted", () =>
			Effect.gen(function* () {
				const fiber = yield* Effect.forkChild(
					Effect.flip(DetachedProcess.awaitReady(Effect.succeed(false), { interval: "10 millis", attempts: 2 })),
				);
				yield* TestClock.adjust("10 millis");
				yield* TestClock.adjust("10 millis");
				const error = yield* Fiber.join(fiber);
				assert.instanceOf(error, DetachedNotReadyError);
			}),
		);

		it.effect("propagates a probe failure rather than retrying it", () =>
			Effect.gen(function* () {
				let calls = 0;
				const probe = Effect.suspend(() => {
					calls += 1;
					return Effect.fail("probe is misconfigured" as const);
				});
				// A probe that cannot run is a different situation from a child that is
				// not up yet; retrying the first turns a config error into a timeout
				// with nothing to show for it.
				const error = yield* Effect.flip(DetachedProcess.awaitReady(probe, { attempts: 5 }));
				assert.strictEqual(error, "probe is misconfigured");
				assert.strictEqual(calls, 1);
			}),
		);
	});

	describe("httpProbe", () => {
		/** A real local server on an ephemeral port, closed on every exit path. */
		const withServer = <A, E, R>(
			respond: (response: ServerResponse) => void,
			use: (url: string) => Effect.Effect<A, E, R>,
		) =>
			Effect.acquireUseRelease(
				Effect.promise(
					() =>
						new Promise<Server>((resolve) => {
							const server = createServer((_request, response) => respond(response));
							server.listen(0, "127.0.0.1", () => resolve(server));
						}),
				),
				(server) => use(`http://127.0.0.1:${(server.address() as AddressInfo).port}/status`),
				(server) =>
					Effect.promise(
						() =>
							new Promise<void>((resolve) => {
								server.close(() => resolve());
							}),
					),
			);

		it.live("answers true for a 2xx response", () =>
			withServer(
				(response) => response.writeHead(200).end("ok"),
				(url) =>
					Effect.gen(function* () {
						assert.isTrue(yield* DetachedProcess.httpProbe(url));
					}),
			).pipe(Effect.provide(FetchHttpClient.layer)),
		);

		it.live("answers false for a non-2xx response — answering is not ready", () =>
			withServer(
				(response) => response.writeHead(503).end("warming up"),
				(url) =>
					Effect.gen(function* () {
						assert.isFalse(yield* DetachedProcess.httpProbe(url));
					}),
			).pipe(Effect.provide(FetchHttpClient.layer)),
		);

		it.live("collapses a refused connection to false rather than failing", () =>
			Effect.gen(function* () {
				// Bind an ephemeral port and close it completely first: the port is
				// then known-refusing without racing another process for a fixed one.
				const port = yield* Effect.promise(
					() =>
						new Promise<number>((resolve) => {
							const server = createServer();
							server.listen(0, "127.0.0.1", () => {
								const bound = (server.address() as AddressInfo).port;
								server.close(() => resolve(bound));
							});
						}),
				);
				// The assertion that matters is that this line is reached at all: a
				// probe that let the transport error through would fail the effect
				// here instead of answering false.
				assert.isFalse(yield* DetachedProcess.httpProbe(`http://127.0.0.1:${port}/status`));
			}).pipe(Effect.provide(FetchHttpClient.layer)),
		);

		it.live("composes with awaitReady: an answering child reports ready", () =>
			withServer(
				(response) => response.writeHead(200).end(),
				(url) =>
					DetachedProcess.awaitReady(DetachedProcess.httpProbe(url), {
						// Small budget so a wrong `false` fails fast instead of in 6s.
						interval: "10 millis",
						attempts: 2,
					}),
			).pipe(Effect.provide(FetchHttpClient.layer)),
		);
	});

	describe("the ops seam", () => {
		/** The die a makeTestOps member exits through, asserted to BE a die. */
		const defectMessage = (exit: Exit.Exit<unknown, unknown>): string => {
			assert.isTrue(Exit.isFailure(exit));
			if (!Exit.isFailure(exit)) {
				return "";
			}
			assert.isTrue(Cause.hasDies(exit.cause), "an unstubbed member must die, never fail typed");
			const defect = exit.cause.reasons.filter(Cause.isDieReason).map((reason) => reason.defect)[0];
			assert.instanceOf(defect, Error);
			return (defect as Error).message;
		};

		it("ops IS the real statics — same references, not wrappers", () => {
			assert.strictEqual(DetachedProcess.ops.spawn, DetachedProcess.spawn);
			assert.strictEqual(DetachedProcess.ops.awaitReady, DetachedProcess.awaitReady);
			assert.strictEqual(DetachedProcess.ops.reap, DetachedProcess.reap);
		});

		describe("makeTestOps", () => {
			it.effect("an unstubbed member dies loudly, naming the member and the fix", () =>
				Effect.gen(function* () {
					const ops = DetachedProcess.makeTestOps();
					const message = defectMessage(yield* Effect.exit(ops.reap(4242)));
					assert.include(message, "reap");
					assert.include(message, "not stubbed");
				}),
			);

			it.effect("each member names ITSELF — spawn does not die blaming reap", () =>
				Effect.gen(function* () {
					const ops = DetachedProcess.makeTestOps();
					assert.include(
						defectMessage(yield* Effect.exit(ops.spawn({ command: "node", logFile: "/tmp/never.log" }))),
						"spawn",
					);
					assert.include(defectMessage(yield* Effect.exit(ops.awaitReady(Effect.succeed(true)))), "awaitReady");
				}),
			);

			it.effect("a stubbed member serves while the rest still die", () =>
				Effect.gen(function* () {
					const reaped: Array<number> = [];
					const ops = DetachedProcess.makeTestOps({
						reap: (pid) =>
							Effect.sync(() => {
								reaped.push(pid);
								return true;
							}),
					});
					assert.isTrue(yield* ops.reap(4242));
					assert.deepStrictEqual(reaped, [4242]);
					// The overrides must not soften the rest of the double.
					assert.include(
						defectMessage(yield* Effect.exit(ops.spawn({ command: "node", logFile: "/tmp/never.log" }))),
						"spawn",
					);
				}),
			);

			it.effect("dying is lazy — building the double runs nothing", () =>
				Effect.gen(function* () {
					// An eagerly-throwing double would make it impossible to build the
					// ops value in a test that only ever calls its stubbed members.
					const ops = DetachedProcess.makeTestOps();
					const described = ops.reap(4242);
					assert.isDefined(described);
					const message = defectMessage(yield* Effect.exit(described));
					assert.include(message, "reap");
				}),
			);
		});
	});

	describe("spawn", () => {
		it.live("starts a detached child, routes its output to the log file, and survives to be reaped", () => {
			const directory = scratch();
			const logFile = join(directory, "child.log");
			return Effect.gen(function* () {
				const pid = yield* DetachedProcess.spawn({
					command: process.execPath,
					args: ["-e", "process.stdout.write('hello from the child\\n'); setTimeout(() => {}, 30000);"],
					logFile,
				});
				assert.isAbove(pid, 0);

				// The parent closed its own descriptor immediately; the child holds a
				// duplicate, which is what keeps the log filling after this process
				// would have exited.
				const wrote = yield* Effect.promise(() =>
					eventually(() => {
						try {
							return readFileSync(logFile, "utf8").includes("hello from the child");
						} catch {
							return false;
						}
					}),
				);
				assert.isTrue(wrote, "the child's stdout must reach the log file");

				assert.isTrue(yield* DetachedProcess.reap(pid));
				const gone = yield* Effect.promise(() => eventually(() => !alive(pid)));
				assert.isTrue(gone, "the reaped child must actually exit");
			}).pipe(Effect.ensuring(Effect.sync(() => rmSync(directory, { recursive: true, force: true }))));
		});

		it.live("a supplied base replaces the parent's environment wholesale, with env merged over it", () => {
			const directory = scratch();
			const logFile = join(directory, "env.log");
			// A test-owned variable, not `HOME`: nothing guarantees a runner's
			// environment carries any particular name. Set on the parent for the
			// test's duration only, and restored on every path.
			const PARENT_ONLY = "EFFECTED_DETACHED_PARENT_ONLY";
			const previous = process.env[PARENT_ONLY];
			process.env[PARENT_ONLY] = `parent-${Math.random().toString(36).slice(2)}`;
			return Effect.gen(function* () {
				// The parent holds it; the child must NOT see it — the base is the
				// whole inherited block, not additions to process.env.
				assert.isString(process.env[PARENT_ONLY], "the control: the parent must hold the variable the child must lack");
				const pid = yield* DetachedProcess.spawn({
					command: process.execPath,
					args: ["-e", "process.stdout.write(JSON.stringify(process.env));"],
					logFile,
					base: { ONLY: "1", PATH: process.env.PATH, DROPPED: undefined },
					env: { X: "y" },
				});
				assert.isAbove(pid, 0);
				const wrote = yield* Effect.promise(() =>
					eventually(() => {
						try {
							return readFileSync(logFile, "utf8").endsWith("}");
						} catch {
							return false;
						}
					}),
				);
				assert.isTrue(wrote, "the child must have printed its environment");
				const seen = JSON.parse(readFileSync(logFile, "utf8")) as Record<string, string>;
				assert.strictEqual(seen.ONLY, "1");
				assert.strictEqual(seen.X, "y");
				assert.strictEqual(seen.PATH, process.env.PATH);
				assert.notProperty(seen, PARENT_ONLY, "the parent's own variables must not leak past an explicit base");
				// An `undefined` base value is dropped, never stringified.
				assert.notProperty(seen, "DROPPED");
				assert.notInclude(Object.values(seen), "undefined");
			}).pipe(
				Effect.ensuring(
					Effect.sync(() => {
						if (previous === undefined) delete process.env[PARENT_ONLY];
						else process.env[PARENT_ONLY] = previous;
						rmSync(directory, { recursive: true, force: true });
					}),
				),
			);
		});

		it.live("env overrides a key the base also carries", () => {
			const directory = scratch();
			const logFile = join(directory, "env.log");
			return Effect.gen(function* () {
				yield* DetachedProcess.spawn({
					command: process.execPath,
					args: ["-e", "process.stdout.write(JSON.stringify(process.env));"],
					logFile,
					base: { PATH: process.env.PATH, KEY: "from-base" },
					env: { KEY: "from-env" },
				});
				const wrote = yield* Effect.promise(() =>
					eventually(() => {
						try {
							return readFileSync(logFile, "utf8").endsWith("}");
						} catch {
							return false;
						}
					}),
				);
				assert.isTrue(wrote, "the child must have printed its environment");
				const seen = JSON.parse(readFileSync(logFile, "utf8")) as Record<string, string>;
				assert.strictEqual(seen.KEY, "from-env");
			}).pipe(Effect.ensuring(Effect.sync(() => rmSync(directory, { recursive: true, force: true }))));
		});

		it.live("fails typed when the command does not exist", () => {
			const directory = scratch();
			return Effect.gen(function* () {
				const error = yield* Effect.flip(
					DetachedProcess.spawn({
						command: join(directory, "no-such-binary"),
						logFile: join(directory, "child.log"),
					}),
				);
				assert.instanceOf(error, DetachedSpawnFailedError);
			}).pipe(Effect.ensuring(Effect.sync(() => rmSync(directory, { recursive: true, force: true }))));
		});

		it.live("fails typed when the log file cannot be opened", () => {
			const directory = scratch();
			return Effect.gen(function* () {
				const error = yield* Effect.flip(
					DetachedProcess.spawn({
						command: process.execPath,
						args: ["-e", ""],
						logFile: join(directory, "missing", "child.log"),
					}),
				);
				assert.instanceOf(error, DetachedLogUnavailableError);
				assert.include(String(error.path), "child.log");
			}).pipe(Effect.ensuring(Effect.sync(() => rmSync(directory, { recursive: true, force: true }))));
		});
	});
});
