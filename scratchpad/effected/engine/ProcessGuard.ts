// Only effect/* imports are allowed before the guarded server graph loads.
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const InjectAt = S.Literals(["load", "connected"]);
const InjectKind = S.Literals(["uncaughtException", "unhandledRejection"]);
const RejectionMode = S.Literals(["exit", "exitBeforeConnect", "log"]);
const UncaughtMode = RejectionMode.pick(["exit", "exitBeforeConnect"]);

/**
 * The slice of the host process {@link ProcessGuard.run} uses. Node's
 * `process` satisfies it.
 *
 * @remarks
 * Structural on purpose: the guard never reads a global, so a test passes a
 * double and a front end passes `process` from its own `main`.
 *
 * @public
 */
export interface ProcessGuardHost {
	/** Register the `uncaughtException` listener. */
	on(event: "uncaughtException", listener: (error: Error, origin: string) => void): unknown;
	/** Register the `unhandledRejection` listener. */
	on(event: "unhandledRejection", listener: (reason: unknown) => void): unknown;
	/** Raise an `uncaughtException` to the registered listeners. Used only by {@link ProcessGuardOptions.injectCrash}. */
	emit(event: "uncaughtException", error: Error, origin: "uncaughtException" | "unhandledRejection"): unknown;
	/** Raise an `unhandledRejection` to the registered listeners. Used only by {@link ProcessGuardOptions.injectCrash}. */
	emit(event: "unhandledRejection", reason: unknown, promise: Promise<unknown>): unknown;
	/** Where every guard report is written. For a stdio server, never stdout: that is the protocol wire. */
	readonly stderr: { write(chunk: string): unknown };
	/** End the process at once. */
	exit(code?: number): never;
}

/**
 * When a stray exception or rejection ends the process.
 *
 * @remarks
 * `"exit"` exits 1 whenever it happens. `"exitBeforeConnect"` exits 1 until
 * the caller reports the server connected with
 * {@link ProcessGuardControl.markConnected}, then logs and keeps serving: a
 * server that dies mid-session drops every client attached to it. `"log"`
 * never exits.
 *
 * @public
 */
export const ProcessGuardPolicy = S.Struct({
	onUncaught: UncaughtMode.annotate({ description: "The uncaught-exception exit policy." }),
	onRejection: S.optional(RejectionMode).annotate({ description: "The rejection policy; defaults to exit." }),
}).annotate({
	identifier: "@beep/scratchpad/effected/engine/ProcessGuard/ProcessGuardPolicy",
	title: "ProcessGuardPolicy",
	description: "When a stray exception or rejection ends the process.",
});
export type ProcessGuardPolicy = typeof ProcessGuardPolicy.Type;

/**
 * One crash {@link ProcessGuardOptions.injectCrash} raises: which event, and
 * when.
 *
 * @public
 */
export const ProcessGuardInjection = S.Struct({
	at: InjectAt.annotate({ description: "Before load or after the first markConnected call." }),
	kind: InjectKind.annotate({ description: "The host event to raise." }),
}).annotate({
	identifier: "@beep/scratchpad/effected/engine/ProcessGuard/ProcessGuardInjection",
	title: "ProcessGuardInjection",
	description: "Which crash event to inject and when to raise it.",
});
export type ProcessGuardInjection = typeof ProcessGuardInjection.Type;

/**
 * What {@link ProcessGuardOptions.load} is handed: the two moments only the
 * caller can see.
 *
 * @remarks
 * Plain callbacks, so a caller with no Effect runtime (a
 * `vscode-languageserver` server, a hand-written socket loop) uses them the
 * same way an Effect launcher does: an MCP launcher passes `markConnected`
 * to `McpStdio.launch`'s `onReady`; an LSP calls it once its connection is
 * listening.
 *
 * @public
 */
export interface ProcessGuardControl {
	/**
	 * Report the server connected: from here on `"exitBeforeConnect"` logs and
	 * keeps going. Call it once the server is serving. Later calls do nothing.
	 * Safe to call after `load` has resolved, which is the usual case.
	 *
	 * @remarks
	 * For a server framed over stdio (MCP, LSP), "serving" is the moment its
	 * transport is built and reading stdin, before the first request arrives:
	 * from then on a client is attached, and a stray error should be logged,
	 * not end the session.
	 */
	readonly markConnected: () => void;
	/**
	 * Format every report from here on with `format`, in place of the guard's
	 * own dependency-free formatter. A `format` that throws falls back to the
	 * guard's own, so a broken formatter never hides a crash.
	 */
	readonly useFormat: (format: (error: unknown) => string) => void;
}

/**
 * Options for {@link ProcessGuard.run}.
 *
 * @public
 */
export interface ProcessGuardOptions {
	/** Prefixes every report the guard writes, as in `my-server: uncaughtException (…): …`. */
	readonly label: string;
	/** The process: pass `process`. */
	readonly host: ProcessGuardHost;
	/** Defaults to `{ onUncaught: "exit", onRejection: "exit" }`. */
	readonly policy?: ProcessGuardPolicy | undefined;
	/**
	 * Import, assemble and start the server. Everything that can throw while
	 * loading belongs here, behind a dynamic `import()`, so the guards are
	 * already listening when it runs. A rejection is reported as
	 * `startup failed` and exits 1, whatever the policy.
	 */
	readonly load: (guard: ProcessGuardControl) => Promise<unknown>;
	/**
	 * For a test of the guards themselves: raise one stray `kind` at `at`, so
	 * both halves of a policy can be driven end to end in a real process.
	 *
	 * **Details**
	 * - `"load"` raises it once both listeners are installed and before
	 *   `load` is called, then waits for the guard to handle it: `load` is
	 *   not called until the listener has run. If a test double's `exit`
	 *   throws instead of ending the process, `run` rejects with what it
	 *   threw and never calls `load`. The pre-connect half of the policy
	 *   applies, so `"exitBeforeConnect"` exits 1 here, and only an
	 *   `onRejection` of `"log"` lets the process go on to load and serve.
	 *   The report uses the guard's own formatter, since no `useFormat` has
	 *   run yet.
	 * - `"connected"` raises it after the first `markConnected`, where
	 *   `"exitBeforeConnect"` logs and keeps serving. It is never raised if
	 *   `markConnected` is never called. A throw from a test double's `exit`
	 *   there is dropped.
	 *
	 * **The `"connected"` report is asynchronous.** It is raised on a later
	 * timer tick, an `Effect.sleep("1 millis")` after `markConnected`, so it can land after the
	 * first responses the server sends: a test that reads stderr once, right
	 * after its first response, can see nothing. Wait for the report (with
	 * `McpProcess.stderrUntil` from `@effected/mcp/testing`, for an MCP
	 * server) rather than reading it once.
	 *
	 * Either is raised only through `host.emit`, after an Effect timer tick,
	 * never as a real throw or rejection, so the guard's listeners handle it
	 * the same way under the real `process` and under a test double. Under
	 * `process`, every listener registered for the event sees it, not only
	 * the guard's. It carries an `[injected]` message; a rejection is emitted
	 * with an already-handled rejected promise. `undefined`, or an `at` or
	 * `kind` outside these values, does nothing at all. Wire it to an
	 * environment variable only a test sets.
	 */
	readonly injectCrash?: ProcessGuardInjection | undefined;
}

type InjectedKind = ProcessGuardInjection["kind"];

const isInjectedKind = S.is(InjectKind);
const isInjection = S.is(ProcessGuardInjection);

class InjectedCrash extends S.TaggedError<InjectedCrash>()("InjectedCrash", {
	kind: InjectKind,
	message: S.String,
}, {
	identifier: "@beep/scratchpad/effected/engine/ProcessGuard/InjectedCrash",
	description: "A test-only crash delivered through the host event listeners.",
}) {}

/** Emit one injected crash through the host, to the listeners the guard installed there. */
const emitInjected = (host: ProcessGuardHost, kind: InjectedKind): void => {
	const error = InjectedCrash.make({ kind, message: `[injected] ${kind}` });
	if (kind === "uncaughtException") {
		host.emit("uncaughtException", error, "uncaughtException");
		return;
	}
	const promise = Promise.reject(error);
	// Handled, so only the emitted event reaches a listener, never a real unhandled rejection.
	promise.catch(() => undefined);
	host.emit("unhandledRejection", error, promise);
};

const fallbackFormat = (error: unknown): string =>
	error instanceof Error ? (error.stack ?? error.message) : String(error);

/**
 * Transport-neutral crash guards for a server process, installed before the
 * server's module graph loads. Imported from `@effected/engine/guard`.
 *
 * @remarks
 * {@link ProcessGuard.run} registers `uncaughtException` and
 * `unhandledRejection` listeners on `host`, then awaits `load`. It launches
 * nothing itself: `load` starts the server, over whatever transport, and
 * calls `markConnected` once it is serving. `@effected/mcp/guard`'s
 * `McpGuard.run` is this guard with an MCP stdio launch in its `load`.
 *
 * - This entrypoint imports only effect/*, so a throw while the server
 *   graph evaluates is still reported on stderr.
 * - A `load` that rejects is reported as `startup failed` and exits 1
 *   whatever the policy. Left to a log-only rejection listener, it would let
 *   the event loop drain and exit 0 with no server.
 * - Installing an `unhandledRejection` listener switches off Node's default
 *   of throwing on one, so `"log"` really does keep the process running.
 * - An exit from a guard skips every finalizer the server registered.
 * - Every report is one line: `<label>: uncaughtException (<origin>): …`,
 *   `<label>: unhandledRejection: …` or `<label>: startup failed: …`.
 *
 * @example
 * ```ts
 * import { ProcessGuard } from "./guard.ts";
 *
 * await ProcessGuard.run({
 *   label: "my-lsp",
 *   host: process,
 *   policy: { onUncaught: "exitBeforeConnect", onRejection: "log" },
 *   load: async (guard) => {
 *     const { startServer } = await import("./server.ts");
 *     await startServer();
 *     guard.markConnected();
 *   },
 * });
 * ```
 *
 * @public
 */
export class ProcessGuard {
	private constructor() {}

	/**
	 * Parse a test-only crash-injection setting into {@link ProcessGuardOptions.injectCrash}: `<at>:<kind>`, where `at`
	 * is `"load"` or `"connected"` and `kind` is `"uncaughtException"` or `"unhandledRejection"`. Anything else, or no
	 * value, is `undefined` (no injection), so a launcher can pass an environment variable straight through and every
	 * launcher shares one grammar.
	 *
	 * @example
	 * ```ts
	 * ProcessGuard.parseInjectCrash("connected:unhandledRejection"); // => { at: "connected", kind: "unhandledRejection" }
	 * ProcessGuard.parseInjectCrash("later:boom"); // => undefined
	 * ```
	 */
	static readonly parseInjectCrash = (value: string | undefined): ProcessGuardInjection | undefined => {
		if (value === undefined) return undefined;
		const [at, kind, ...rest] = Str.split(value, ":");
		if (rest.length > 0) return undefined;
		const injection = { at, kind };
		return isInjection(injection) ? injection : undefined;
	};

	/** Install the guards, then run `load`. Resolves once `load` has resolved. */
	static readonly run = (options: ProcessGuardOptions): Promise<void> => {
		// A plain function over an explicit chain, with an async function's contract: everything up to the first wait
		// runs on the caller's tick, and a throw anywhere becomes a rejection, never a synchronous throw.
		try {
			const { host, label } = options;
			const onUncaught = options.policy?.onUncaught ?? "exit";
			const onRejection = options.policy?.onRejection ?? "exit";
			let connected = false;
			let format = fallbackFormat;
			const describe = (error: unknown): string => {
				try {
					return format(error);
				} catch {
					try {
						return fallbackFormat(error);
					} catch {
						return "<unformattable error value>";
					}
				}
			};
			const exits = (mode: typeof RejectionMode.Type): boolean =>
				mode === "exit" || (mode === "exitBeforeConnect" && !connected);

			host.on("uncaughtException", (error, origin) => {
				host.stderr.write(`${label}: uncaughtException (${origin}): ${describe(error)}\n`);
				if (exits(onUncaught)) host.exit(1);
			});
			host.on("unhandledRejection", (reason) => {
				host.stderr.write(`${label}: unhandledRejection: ${describe(reason)}\n`);
				if (exits(onRejection)) host.exit(1);
			});

			const inject = options.injectCrash;
			const injectKind = isInjectedKind(inject?.kind) ? inject.kind : undefined;

			const control: ProcessGuardControl = {
				markConnected: () => {
					if (connected) return;
					connected = true;
					if (inject?.at === "connected" && injectKind !== undefined) {
						// A positive sleep uses the timer phase; sleep(0) only yields to the Effect scheduler.
						void Effect.runPromise(Effect.sleep("1 millis")).then(() => {
							try {
								emitInjected(host, injectKind);
							} catch {
								// Only a test double's `exit` throws here; a real one never returns.
							}
						});
					}
				},
				useFormat: (next) => {
					format = next;
				},
			};

			const startupFailed = (error: unknown): void => {
				host.stderr.write(`${label}: startup failed: ${describe(error)}\n`);
				host.exit(1);
			};
			const start = (): Promise<void> => {
				let loading: Promise<unknown>;
				try {
					loading = Promise.resolve(options.load(control));
				} catch (error) {
					startupFailed(error);
					return Promise.resolve();
				}
				return loading.then(() => undefined, startupFailed);
			};

			if (inject?.at === "load" && injectKind !== undefined) {
				// Keep host exceptions in the Promise boundary, so an exit double rejects with its original error.
				return Effect.runPromise(Effect.sleep("1 millis"))
					.then(() => emitInjected(host, injectKind))
					.then(start);
			}
			return start();
		} catch (error) {
			return Promise.reject(error);
		}
	};
}
