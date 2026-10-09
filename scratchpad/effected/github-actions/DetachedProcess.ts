import { $ScratchpadId } from "@beep/identity/packages";
import type * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import { HttpClient } from "effect/http";
import { ChildProcessSpawner } from "effect/process";
import { isErrno } from "./internal/fsProbe.ts";
import { IeeeNumber } from "./internal/ieeeNumber.ts";
import { unstubbed } from "./internal/unstubbed.ts";
import * as O from "@beep/utils/Option";

const $I = $ScratchpadId.create("effected/github-actions/DetachedProcess");

/** A spawned detached child did not provide a process id. */
export class MissingProcessIdError extends S.TaggedError<MissingProcessIdError>($I`MissingProcessIdError`)("MissingProcessIdError", {
	message: S.String,
}, $I.annote("MissingProcessIdError", { description: "A spawned detached child did not provide a process id." })) {}

// Effect ChildProcess cannot route detached output to native file descriptors.
const { spawn: spawnChild } = process.getBuiltinModule("node:child_process");
const { closeSync, openSync } = process.getBuiltinModule("node:fs");

/**
 * Raised when the log file for a detached child's output cannot be opened.
 *
 * @public
 */
export class DetachedLogUnavailableError extends S.TaggedError<DetachedLogUnavailableError>($I`DetachedLogUnavailableError`)(
	"DetachedLogUnavailableError",
	{
		/** The log file that could not be opened. */
		path: S.String.annotateKey({ description: "The log file that could not be opened." }),
		/** The underlying failure, preserved structurally. */
		cause: S.optionalKey(S.Defect()).annotateKey({ description: "The underlying failure, preserved structurally." }),
	}, $I.annote("DetachedLogUnavailableError", { description: "Raised when the log file for a detached child's output cannot be opened." }),
) {
	override get message(): string {
		return `Could not open the detached log file "${this.path}"`;
	}
}

/**
 * Raised when the detached child did not start.
 *
 * @public
 */
export class DetachedSpawnFailedError extends S.TaggedError<DetachedSpawnFailedError>($I`DetachedSpawnFailedError`)(
	"DetachedSpawnFailedError",
	{
		/** The underlying failure, preserved structurally. */
		cause: S.optionalKey(S.Defect()).annotateKey({ description: "The underlying failure, preserved structurally." }),
	}, $I.annote("DetachedSpawnFailedError", { description: "Raised when the detached child did not start." }),
) {
	override get message(): string {
		return "The detached child did not start";
	}
}

/**
 * Raised when a non-positive pid was handed to {@link DetachedProcess.reap}.
 *
 * @remarks
 * See {@link DetachedProcess.reap} for why this is the most important value in
 * the module: a non-positive pid targets a process *group*, not a process.
 *
 * @public
 */
export class InvalidPidError extends S.TaggedError<InvalidPidError>($I`InvalidPidError`)("InvalidPidError", {
	/** The pid that was refused. */
	pid: IeeeNumber.annotateKey({ description: "The pid that was refused." }),
	/** The underlying failure, preserved structurally. */
	cause: S.optionalKey(S.Defect()).annotateKey({ description: "The underlying failure, preserved structurally." }),
}, $I.annote("InvalidPidError", { description: "Raised when a non-positive pid was handed to DetachedProcess.reap." })) {
	override get message(): string {
		return `Refusing to signal pid ${this.pid}: a non-positive pid targets a process group, not a process`;
	}
}

/**
 * Raised when a signal was refused, e.g. the process belongs to another user.
 *
 * @public
 */
export class DetachedSignalFailedError extends S.TaggedError<DetachedSignalFailedError>($I`DetachedSignalFailedError`)(
	"DetachedSignalFailedError",
	{
		/** The pid that could not be signalled. */
		pid: S.Finite.annotateKey({ description: "The pid that could not be signalled." }),
		/** The underlying failure, preserved structurally. */
		cause: S.optionalKey(S.Defect()).annotateKey({ description: "The underlying failure, preserved structurally." }),
	}, $I.annote("DetachedSignalFailedError", { description: "Raised when a signal was refused, e.g. the process belongs to another user." }),
) {
	override get message(): string {
		return `Could not signal pid ${this.pid}`;
	}
}

/**
 * Raised when the readiness probe never held.
 *
 * @public
 */
export class DetachedNotReadyError extends S.TaggedError<DetachedNotReadyError>($I`DetachedNotReadyError`)("DetachedNotReadyError", {
	/** The underlying failure, preserved structurally. */
	cause: S.optionalKey(S.Defect()).annotateKey({ description: "The underlying failure, preserved structurally." }),
}, $I.annote("DetachedNotReadyError", { description: "Raised when the readiness probe never held." })) {
	override get message(): string {
		return "The detached child never became ready";
	}
}

/**
 * Anything that can go wrong spawning, awaiting or reaping a detached child.
 *
 * @remarks
 * **One class per failure, rather than one class with a `reason` field.** The
 * pid is required on the two members that report one and the path on the one
 * that does, so a value short a field is a compile error rather than a message
 * reading `"undefined"`.
 *
 * @public
 */
export type DetachedProcessError =
	| DetachedLogUnavailableError
	| DetachedSpawnFailedError
	| InvalidPidError
	| DetachedSignalFailedError
	| DetachedNotReadyError;

/**
 * The schema a pid crosses the phase boundary through.
 *
 * @remarks
 * A pid is persisted in `GITHUB_STATE` by `main` and read back by `post`, which
 * means it makes the round trip as **text**. This is the boundary check on the
 * way back in: a truncated file, an absent key or a `Number("")` all decode to
 * `0`, and `0` is not a process — it is the current process's whole group.
 * Refusing it here means the bad value never reaches {@link DetachedProcess.reap}
 * in the first place, and reap's own guard is the second of two defenses rather
 * than the only one.
 *
 * **The brand is core's**, from `ChildProcessSpawner` — the subprocess
 * vocabulary belongs to core and this package does not get to re-declare it.
 * What core does not have is a *validating* way to reconstruct one: its
 * constructor is `Brand.nominal`, which applies no runtime check, so
 * `ChildProcessSpawner.ProcessId(0)` succeeds. That is exactly right for a pid
 * the spawner just produced, and exactly wrong for a pid that has been through a
 * text file. This schema is that missing check, and it decodes to core's type so
 * the two are interchangeable.
 *
 * @example
 * ```ts
 * import { ActionState, DetachedProcess, ProcessId } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const post = Effect.gen(function* () {
 *   const pid = yield* (yield* ActionState).get("server-pid", ProcessId);
 *   return yield* DetachedProcess.reap(pid);
 * });
 * ```
 *
 * @public
 */
export const ProcessId = S.Number.pipe(
	S.check(
		S.makeFilter(
			(value) => (Number.isInteger(value) && value > 0 ? undefined : "Expected a positive integer process id"),
			$I.annote("PositiveIntegerProcessId", {
				title: "Positive integer process id",
				description: "A positive integer identifying a process rather than a process group.",
			}),
			true,
		),
		S.isFinite(),
	),
	S.brand("ProcessId"),
	$I.annoteSchema("ProcessId", {
		description: "A validated positive integer process id persisted across action phases.",
	}),
);

/**
 * How a detached child is started.
 *
 * @public
 */
export interface DetachedSpawnOptions {
	/** The executable. */
	readonly command: string;
	/** Its arguments. */
	readonly args?: ReadonlyArray<string> | undefined;
	/**
	 * Where the child's stdout and stderr go, opened for append.
	 *
	 * @remarks
	 * A file **descriptor**, not a pipe. An in-process pipe would keep the parent
	 * attached to the child and defeat the detachment, which is the upstream
	 * limitation this module exists to work around — core's `CommandOptions.stdout`
	 * maps to a pipe, and so do its additional fds. If core grows fd routing this
	 * becomes a thin adapter over it.
	 */
	readonly logFile: string;
	/** The working directory. */
	readonly cwd?: string | undefined;
	/**
	 * The environment the child inherits, before `env` is merged over it.
	 *
	 * @remarks
	 * Defaults to the parent's `process.env` — **the one sanctioned ambient
	 * fallback in this module**, the same class of default as
	 * `ActionInput.provider`'s `env = process.env`, and an exception to the
	 * package rule stated on `ChildEnv` (ambient process state is never read
	 * behind a caller's back) precisely because passing a value here is how a
	 * caller opts out of it. Supply it to give the child a controlled block —
	 * a test proving exactly what a worker sees, or a worker that must not
	 * inherit the action's secrets — remembering that a base without `PATH`
	 * costs the child its runtime. An `undefined` value is dropped by Node's
	 * spawn, never stringified.
	 */
	readonly base?: Readonly<Record<string, string | undefined>> | undefined;
	/**
	 * Environment additions.
	 *
	 * @remarks
	 * **Merged over `base` (the parent's environment by default), not
	 * substituted for it.** A bare environment costs the child `PATH`, which
	 * usually means it cannot find its own runtime and dies before writing a
	 * word to the log — a failure that looks like a spawn bug and is not.
	 * Secrets belong here only via `Secret.forChildEnv`, which masks them on
	 * the way out.
	 */
	readonly env?: Readonly<Record<string, string>> | undefined;
}

/**
 * How long to wait for a child to become ready.
 *
 * @public
 */
export interface ReadinessOptions {
	/** Time between probes. Defaults to 150 milliseconds. */
	readonly interval?: Duration.Input | undefined;
	/** How many times to retry after the first probe. Defaults to 40. */
	readonly attempts?: number | undefined;
}

/**
 * The module's operations as a value: the seam a consumer's tests inject.
 *
 * @remarks
 * `DetachedProcess` is statics on a class, deliberately — there is no scope to
 * hang a service off, because the whole point is a child that outlives the
 * process holding any handle to it. The cost of that choice is that the
 * package's `makeTest`/`layerTest` convention has nothing to attach to:
 * statics cannot be swapped by a layer, and a test must never spawn a real
 * child, poll a real port, or — above all — signal a real pid. This interface
 * restores the seam as **parameter injection**: production code takes a
 * `DetachedProcessOps`, defaulting to {@link DetachedProcess.ops}, and a test
 * passes {@link DetachedProcess.makeTestOps} with only the members it means to
 * observe.
 *
 * {@link DetachedProcess.httpProbe} is deliberately not a member. It is a
 * probe *constructor* with no process side effect of its own; a test stubs
 * `awaitReady` — the operation that runs the probe — or provides a stub
 * `HttpClient`.
 *
 * @public
 */
export interface DetachedProcessOps {
	/** {@link DetachedProcess.spawn}. */
	readonly spawn: (options: DetachedSpawnOptions) => Effect.Effect<ChildProcessSpawner.ProcessId, DetachedProcessError>;
	/** {@link DetachedProcess.awaitReady}. */
	readonly awaitReady: <E, R>(
		probe: Effect.Effect<boolean, E, R>,
		options?: ReadinessOptions,
	) => Effect.Effect<void, E | DetachedProcessError, R>;
	/** {@link DetachedProcess.reap}. */
	readonly reap: (pid: number, signal?: NodeJS.Signals) => Effect.Effect<boolean, DetachedProcessError>;
}

/** See {@link DetachedProcess.makeTestOps}: an unstubbed member dies naming itself. */
const dies = unstubbed("DetachedProcess.makeTestOps");

/**
 * A long-lived child that outlives the phase that started it.
 *
 * @remarks
 * The shape an action needs is three separate things, because the child
 * survives the process that spawned it: `main` starts it and persists the pid,
 * `main` or `post` waits on a domain predicate rather than on time, and `post`
 * — a **different process**, holding no handle to the child — signals the pid
 * it read back out of `GITHUB_STATE`.
 *
 * That last step is why this lives here rather than in a command runner. There
 * is no `ChildProcess` to `.kill()`; there is only a number that has been
 * through a text file. See {@link DetachedProcess.reap}.
 *
 * @example
 * ```ts
 * import { DetachedProcess } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const pid = yield* DetachedProcess.spawn({
 *     command: "node",
 *     args: ["server.js"],
 *     logFile: "/tmp/server.log",
 *   });
 *   yield* DetachedProcess.awaitReady(healthCheck);
 *   return pid;
 * });
 * ```
 *
 * @public
 */
export class DetachedProcess {
	private constructor() {}

	/**
	 * Start a detached child with its output routed to a log file.
	 *
	 * @remarks
	 * The parent closes its own copy of the descriptor immediately — the child
	 * holds a duplicate, so the log keeps filling after the action's process
	 * exits, which is the entire point.
	 */
	static readonly spawn = Effect.fn("DetachedProcess.spawn")(function* (options: DetachedSpawnOptions) {
		const descriptor = yield* Effect.try({
			try: () => openSync(options.logFile, "a"),
			catch: (cause) => DetachedLogUnavailableError.make({ path: options.logFile, cause }),
		});

		const pid = yield* Effect.try({
			try: () => {
				try {
					const child = spawnChild(options.command, [...(options.args ?? [])], {
						...O.getSomesStruct({ cwd: O.fromUndefinedOr(options.cwd) }),
						env: { ...(options.base ?? process.env), ...options.env },
						detached: true,
						stdio: ["ignore", descriptor, descriptor],
					});
					// A `ChildProcess` with no `error` listener re-throws the event, so a
					// missing binary would take down the ACTION rather than failing this
					// call — the emit is asynchronous and lands after the guard below has
					// already reported the failure properly. The parent has deliberately
					// let go of this child, so there is nothing left for it to do with
					// the event except not die of it.
					child.on("error", () => {});
					child.unref();
					if (child.pid === undefined) {
						throw MissingProcessIdError.make({ message: `"${options.command}" produced no process id` });
					}
					return child.pid;
				} finally {
					closeSync(descriptor);
				}
			},
			catch: (cause) => DetachedSpawnFailedError.make({ cause }),
		});

		yield* Effect.annotateCurrentSpan({ pid });
		// Core's nominal constructor: no runtime check, which is correct here
		// because the operating system just handed us the number.
		return ChildProcessSpawner.ProcessId(pid);
	});

	/**
	 * Poll a predicate until it holds.
	 *
	 * @remarks
	 * A domain predicate rather than a sleep: "the server answers" is the thing
	 * being waited for, and any fixed delay is simultaneously too long on a fast
	 * runner and too short on a slow one.
	 *
	 * A probe *failure* is propagated rather than treated as "not ready" — a
	 * probe that cannot run is a different situation from a child that is not up
	 * yet, and silently retrying the first is how a misconfigured probe becomes a
	 * timeout six seconds later with nothing to show for it.
	 */
	static readonly awaitReady = Effect.fn("DetachedProcess.awaitReady")(function* <E, R>(
		probe: Effect.Effect<boolean, E, R>,
		options?: ReadinessOptions,
	) {
		// One initial probe plus `attempts` spaced retries, stopping early the
		// moment one answers ready; the last answer is what remains when the
		// budget runs out.
		const ready = yield* Effect.repeat(probe, {
			schedule: Schedule.spaced(options?.interval ?? "150 millis"),
			times: options?.attempts ?? 40,
			until: (answer) => answer,
		});
		if (!ready) {
			return yield* DetachedNotReadyError.make({});
		}
	});

	/**
	 * A readiness probe over HTTP: `true` when a `GET` answers 2xx.
	 *
	 * @remarks
	 * The probe {@link DetachedProcess.awaitReady} almost always wants: an HTTP
	 * `GET` at a port the child is still binding, where connection-refused *is*
	 * "not up yet". The probe's error channel must stay empty, because
	 * `awaitReady` deliberately propagates probe failures, and a refused
	 * connection is not a failure of the probe.
	 *
	 * So this probe never fails: a refused connection, any other transport
	 * error and a non-2xx answer all collapse to `false`, leaving
	 * `awaitReady`'s own exhaustion as the only failure left. That is a
	 * deliberate opt-out of the propagate-probe-failures posture, and it is
	 * only sound because every failure an HTTP readiness check can see means
	 * the same thing here. The cost is the documented one: a *misconfigured*
	 * probe — a typo'd port, a wrong path — is indistinguishable from a child
	 * that never came up, and reports as {@link DetachedNotReadyError} only after
	 * the full budget. A probe whose failures are meaningfully distinct should
	 * stay a hand-written effect with those failures in `E`.
	 *
	 * The request goes through core's `HttpClient` — `Action.run` provides it
	 * ambiently — rather than a bare `fetch`, per the package rule that
	 * everything that *can* go through a core contract does.
	 */
	static readonly httpProbe = (url: string | URL): Effect.Effect<boolean, never, HttpClient.HttpClient> =>
		HttpClient.get(url).pipe(
			Effect.map((response) => response.status >= 200 && response.status < 300),
			Effect.orElseSucceed(() => false),
		);

	/**
	 * Signal a pid that came back across the phase boundary.
	 *
	 * @remarks
	 * **The guard is the reason this function exists.** `process.kill(0, …)`
	 * signals the caller's entire process group and `process.kill(-1, …)` signals
	 * every process the user owns — so on a GitHub runner, an unguarded reap of a
	 * pid that decoded to `0` takes down the job that is running it. The value is
	 * exactly the one most likely to be wrong: it is what an absent state key, a
	 * truncated state file or a `Number("")` all produce.
	 *
	 * A non-positive pid therefore fails **typed and before any signal is sent**.
	 * The parameter is a plain `number` rather than a {@link ProcessId} on purpose:
	 * the value arrives as text from another process, so the type system stopped
	 * applying the moment it crossed that boundary, and a guard that only a
	 * well-typed caller can trip is not a guard.
	 *
	 * Returns `false` for a process that is already gone, because a `post` phase
	 * finding its child already dead is the normal ending, not a failure.
	 */
	static readonly reap = Effect.fn("DetachedProcess.reap")(function* (pid: number, signal: NodeJS.Signals = "SIGTERM") {
		yield* Effect.annotateCurrentSpan({ pid });
		if (!Number.isInteger(pid) || pid <= 0) {
			return yield* InvalidPidError.make({ pid });
		}
		return yield* Effect.suspend(() => {
			try {
				process.kill(pid, signal);
				return Effect.succeed(true);
			} catch (cause) {
				// ESRCH is "no such process", which for a `post` phase means the child
				// has already exited — the normal ending, not a failure.
				return isErrno(cause, "ESRCH")
					? Effect.succeed(false)
					: Effect.fail(DetachedSignalFailedError.make({ pid, cause }));
			}
		});
	});

	/**
	 * The real operations: the production default for a
	 * {@link DetachedProcessOps} parameter.
	 *
	 * @remarks
	 * The members ARE the statics — same references, not wrappers — so taking
	 * the seam costs a consumer nothing over calling the statics directly.
	 */
	static readonly ops: DetachedProcessOps = {
		spawn: DetachedProcess.spawn,
		awaitReady: DetachedProcess.awaitReady,
		reap: DetachedProcess.reap,
	};

	/**
	 * A test double. Unstubbed members die rather than silently succeeding.
	 *
	 * @remarks
	 * The package's `makeTest` convention, on the module's one non-service.
	 * Every member a test does not stub dies loudly **naming the member**,
	 * because silence is worse here than anywhere else in the package: a spawn
	 * that silently "succeeds" fakes a child that does not exist, and a reap
	 * that silently succeeds asserts nothing about the one call whose
	 * production form signals a real pid.
	 */
	static readonly makeTestOps = (overrides: Partial<DetachedProcessOps> = {}): DetachedProcessOps => ({
		spawn: () => dies("spawn"),
		awaitReady: () => dies("awaitReady"),
		reap: () => dies("reap"),
		...overrides,
	});
}
