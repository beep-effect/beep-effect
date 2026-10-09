// Root types are named through the package's own name, so the emitted ui.d.ts imports them from "../index.ts".
import type * as Cli from "../index.ts";
import { Audience, TerminalEnv } from "../../env/index.ts";
import { CommandNeutralizer } from "../../github-commands/index.ts";
import type * as Console from "effect/Console";
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as O from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as Pull from "effect/Pull";
import * as Queue from "effect/Queue";
import * as Result from "effect/Result";
import * as Schedule from "effect/Schedule";
import * as Scheduler from "effect/Scheduler";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import type { FunctionComponent, ReactElement, ReactNode } from "react";
import { CliInteractive } from "../CliInteractive.ts";
import { CliLinks } from "../CliLinks.ts";
import { CliTheme } from "../CliTheme.ts";
import { autoFormat, underGithubActions } from "../internal/autoFormat.ts";
import type { RenderContext } from "../Render.ts";
import { Render } from "../Render.ts";
import { errorBoundary } from "./internal/ErrorBoundary.ts";
import type { HolderSlot } from "./internal/Holder.ts";
import { holder, holderSlot } from "./internal/Holder.ts";
import { fromReact, inkModules, loadInk, withInkColour } from "./internal/ink.ts";
import { makeInkConsole } from "./internal/inkConsole.ts";
import { LazyViewShapeError, loadView } from "./internal/lazyView.ts";
import { mountPermit } from "./internal/mountPermit.ts";
import { drainPerformance, resolveDrain } from "./internal/perfDrain.ts";
import { UiRenderOptions } from "./internal/renderOptions.ts";
import { uiProviders } from "./internal/UiProviders.ts";
import { UiStreams } from "./UiStreams.ts";
import { useTerminalSize } from "./UiTheme.ts";

/**
 * Options for `CliUi.live`.
 *
 * @public
 */
export interface LiveOptions<E, S> {
	/**
	 * The events to fold: a `PubSub` subscription, or a stream.
	 *
	 * A subscription (`PubSub.subscribe`, made before the first publish) is the surest: the view takes from it directly,
	 * so nothing published after the subscribe is missed, and `LiveHandle.close` folds every message still queued in it
	 * before the view ends. A publisher can also end it from its side, and the two ends differ:
	 *
	 * - `PubSub.end(pubsub, last)` keeps everything: the view folds what is buffered, then `last` once (core repeats a
	 *   final message to every later take; the view takes it once), then ends. Make `last` an `isTerminal` event to
	 *   commit the run with it; otherwise the run is committed as drawn.
	 * - `PubSub.shutdown` drops what the view has not taken yet. End with `close` (or `PubSub.end`) first.
	 *
	 * A stream: `live` makes its first pull before it returns, so one that subscribes on its first pull without forking
	 * (`Stream.fromPubSub`) is subscribed by then and sees an event published at once. One that forks its upstream
	 * (`Stream.merge`, `buffer`, a concurrent `flatMap`) subscribes later, and an event published before that is lost.
	 * `close` folds what the view has already pulled; what the stream holds and has not yielded is the stream's.
	 */
	readonly events: Stream.Stream<E> | PubSub.Subscription<E>;
	/** The state before the first event. */
	readonly initial: S;
	/** Fold one event into the state. The kit never resets the state: a reducer that wants a fresh run resets it. */
	readonly reduce: (state: S, event: E) => S;
	/**
	 * Draw the state. `frame` is the wall clock in ticks of `tickMillis` (`floor(now / tickMillis)`, from `Clock`), so a
	 * spinner keeps turning across runs. Rendered inside the kit's providers: `useTheme`, `useGlyphs`, `Styled` and
	 * `useTerminalSize` work in it. When the final frame is printed as a string (not interactive, or a run that degraded
	 * before it painted), `useTerminalSize().rows` is `Infinity`, since that frame has no height to fit: a render must
	 * not allocate per row.
	 *
	 * To keep the view's module (its JSX, and so React) off every run that never draws it, pass
	 * `CliUi.lazyView(() => import("./view.ts"))`: the module is loaded only when a run first mounts or prints its frame
	 * with Ink, so `--help`, a usage error, and, with `final`, a run that is not interactive, never load it.
	 */
	readonly render: (state: S, frame: number) => ReactElement;
	/** Whether an event starts a run: by default, the only event that begins one (see `begins`). */
	readonly isStart: (event: E) => boolean;
	/**
	 * Whether an event begins a run while none is going, given the state before and after it is folded; `isStart` by
	 * default, so only a start begins one. Given, it replaces that default rather than adding to it, so keep `isStart`
	 * in it to begin on a start as well as on something else, such as a stream that a program joins mid-run:
	 * `(event, before, after) => isStart(event) || (before.phase === "idle" && after.phase !== "idle")`.
	 * An event that begins nothing while no run is going is folded and not drawn. A start while a run is going redraws
	 * that run in place, and this is not asked then; a start while a degraded run is going ends that run and begins a
	 * fresh one.
	 */
	readonly begins?: (event: E, before: S, after: S) => boolean;
	/** Whether an event ends a run: its frame is committed to the terminal and the view unmounts until the next. */
	readonly isTerminal: (event: E) => boolean;
	/**
	 * `"owned"` (the default) for a view that owns its output, `"hosted"` for one drawn inside a host's (a test
	 * reporter). They differ only when the run is not interactive: owned writes each run's final frame once, as a
	 * string; hosted writes nothing, its host having its own output.
	 */
	readonly mode?: "owned" | "hosted";
	/**
	 * The final frame of a run that is not interactive (an agent, CI, a pipe, `TERM=dumb`), as a document: given, an
	 * `owned` view prints each run's `final(state)` at the run's end instead of rendering `render` to a string with Ink,
	 * so such a run loads neither Ink nor React, nor a `CliUi.lazyView` module.
	 *
	 * @remarks
	 * It is called once per run, at the run's terminal event (or when the events end mid-run), with the state then, and
	 * replaces the string that run would have printed: never both. It is rendered as `Doc.print` renders a document:
	 * `Render.context("stdout")` when the environment `CliRuntime.main` builds is there (`TerminalEnv`, `Audience` and
	 * `CliLinks`; otherwise the stdout theme, the `Audience` if any, and no width limit), the renderer the audience gets
	 * (`ansi` for a person, `plain` for an agent, `githubLog` under GitHub Actions), and an agent gets no escape. It is
	 * written where the view writes, to `UiStreams` stdout, so a host's capture of the view's output holds it. A document
	 * that renders to nothing prints nothing. A `final` that throws is the run degrading: one warning, nothing printed.
	 *
	 * An interactive run never calls it, and a `hosted` view never prints either way. It need not match the Ink frame:
	 * it is what a reader with no terminal gets.
	 *
	 * With `final` set, `render` is never called on a run that is not interactive, not even to build a string that would
	 * go unused: the run's output is `final(state)` alone. (Pinned by `CliUi.live.final.test.ts`, whose watch-mode test
	 * counts zero `render` calls over three runs.)
	 */
	readonly final?: ((state: S) => Cli.Document) | undefined;
	/**
	 * The frame tick, in milliseconds; 80 by default. While a run is drawn the view redraws on every tick, so a spinner
	 * turns without events. Anything but a positive, finite number is a defect.
	 */
	readonly tickMillis?: number;
	/**
	 * Clear React's user-timing entries after every render: `true`, `false`, or `"auto"` (the default), which clears
	 * unless `NODE_ENV` is exactly `"production"`. React's development build records them on every render and never
	 * clears them. The clear is process-wide: it removes every `measure` entry, a program's own included; marks are left
	 * alone.
	 */
	readonly drainPerformance?: boolean | "auto";
}

/**
 * The handle of a live view.
 *
 * @public
 */
export interface LiveHandle<S> {
	/** The current state of the fold. */
	readonly state: Effect.Effect<S>;
	/**
	 * A `Console` whose every method writes above the frame while a run is mounted, and straight to the stream otherwise;
	 * none falls through to the program's own console. Output is split as Node's console splits it: `log`, `info`,
	 * `debug`, `dir`, `dirxml`, `table`, `count`, `timeLog`, `timeEnd` and a group's label to stdout, and `error`,
	 * `warn`, `trace` and a failed `assert` to stderr; a group indents what follows. An `Error` argument is written with
	 * its stack. `clear` does nothing, since erasing the screen would take the scrollback above the frame. Provide it
	 * around the work done while the view is mounted; a line written to the terminal any other way tears the frame.
	 *
	 * `Console.Console` is the seam: the kit's logger (`CliLogger`, `CliLog`) and `Effect.log*` write through whatever
	 * `Console` the fiber has, so they need no reference to the view. A host whose logging lives outside the view's
	 * owner provides the handle's console at the top of the program it runs, and every log line under it lands above
	 * the frame: `Effect.provideService(program, Console.Console, handle.logConsole)`. Output that never goes through
	 * Effect's `Console` (another library's own `process.stderr` writes) still tears the frame.
	 */
	readonly logConsole: Console.Console;
	/**
	 * Completes once the events have ended (the stream ended, the subscription's `PubSub` was ended with `PubSub.end` or
	 * shut down, or `close` ended them) and the last run's frame is committed. Dies with what the view died of: a `reduce` that threw, or a
	 * stream that died.
	 */
	readonly done: Effect.Effect<void>;
	/**
	 * End the view cleanly, then wait for `done`.
	 *
	 * @remarks
	 * It stops taking events, folds what the view holds and has not folded yet, and ends the run as the events ending
	 * does: an `isTerminal` event among them commits its run as usual, and a run with no terminal event is committed as
	 * drawn (owned and not interactive: its final frame is printed once). With a subscription, that includes every
	 * message still queued in it, so a run's tail published just before the close is never lost, as it would be to a
	 * `PubSub.shutdown`. With a stream, it is what the view has already pulled; elements the stream holds and has not
	 * yielded are the stream's own.
	 *
	 * Safe from the moment `live` returns, before Ink has loaded: a run whose mount is still under way is mounted and
	 * then ended, and a view with no run to end loads nothing.
	 *
	 * Idempotent: a second `close`, concurrent or later, waits for the same end and writes nothing more. After the events
	 * have ended it only waits for `done`. It dies as `done` does (a `reduce` that threw, a stream that died). Closing
	 * the caller's scope instead of calling `close` stops the view at once (nothing still queued is folded); closing it
	 * after `close` releases what is left. A `close` after the scope has closed completes at once, there being nothing
	 * left to end, where `done` is interrupted. A host ends its view with:
	 *
	 * ```ts
	 * handle.close.pipe(Effect.ensuring(Scope.close(scope, Exit.void)))
	 * ```
	 */
	readonly close: Effect.Effect<void>;
}

/**
 * The live tree's height clamp: at most the terminal's rows less one, re-read on every render and when the terminal
 * resizes, so a tall frame never takes Ink's clear-terminal path, which wipes the scrollback. No width: Ink sizes the root itself.
 */
const heightClamp: () => FunctionComponent<{ readonly children?: ReactNode }> = fromReact(() => {
	const HeightClamp = (props: { readonly children?: ReactNode }): ReactElement => {
		const { ink, react } = inkModules();
		const { rows } = useTerminalSize();
		// The content keeps its own height (`flexShrink: 0`) and the clamp clips it: left to shrink, Yoga squeezes every
		// row of a tall column into the height, and Ink draws a scattered sample of them, or nothing.
		return react.createElement(
			ink.Box,
			{ flexDirection: "column", maxHeight: rows, overflow: "hidden" },
			react.createElement(ink.Box, { flexDirection: "column", flexShrink: 0 }, props.children),
		);
	};
	HeightClamp.displayName = "CliUiLiveHeightClamp";
	return HeightClamp;
});

/**
 * What the controller acts on: a chunk of events, a tick, a render failure to look at, the end of the stream, or the
 * stream's death.
 */
type Message<E, S> =
	| { readonly _tag: "Events"; readonly chunk: ReadonlyArray<E> }
	| { readonly _tag: "Tick"; readonly frame: number }
	// The run it failed in, so a report that arrives late is never read against another run.
	| { readonly _tag: "Failed"; readonly run: Run<S> }
	| { readonly _tag: "Ended" }
	| { readonly _tag: "Died"; readonly cause: Cause.Cause<never> };

/** What is mounted for a run: its scope (permit, colour, Ink instance, tick) and the slot that swaps its frame. */
interface Mounted {
	readonly scope: Scope.Closeable;
	readonly slot: HolderSlot;
}

/** A run, from its first event to its terminal one, mounted or not. */
interface Run<S> {
	mounted: Mounted | undefined;
	/** A render failed, or the mount did: the run is unmounted and draws nothing more. */
	degraded: boolean;
	/** A frame of this run was committed to the terminal. */
	painted: boolean;
	/** The error a render threw, reported by the error boundary, not yet acted on. */
	failed: { readonly error: unknown } | undefined;
	/** The frame index last drawn. */
	frame: number;
	/** The last state and frame committed, which the boundary draws in place of a frame that threw. */
	good: { readonly state: S; readonly frame: number } | undefined;
}

const TICK_INVALID = (tickMillis: number): string =>
	`@effected/cli/ui: CliUi.live's tickMillis must be a positive, finite number of milliseconds, not ${tickMillis}`;

// Neutral about what is left on the terminal: when the warning is written, the run's last good frame may stay, may be
// printed at its end, or, when that frame and the final one both throw, be gone.
const DEGRADED = (error: unknown): string =>
	`@effected/cli/ui: the live view stopped drawing this run: ${error instanceof Error ? error.message : String(error)}`;

/**
 * `CliUi.live`, kept in its own module: see `CliUi.live` for the contract.
 *
 * @internal
 */
export const live = <E, S>(
	options: LiveOptions<E, S>,
): Effect.Effect<LiveHandle<S>, never, Scope.Scope | Cli.CliTheme> =>
	Effect.gen(function* () {
		const tickMillis = options.tickMillis ?? 80;
		const begins = options.begins ?? ((event: E) => options.isStart(event));
		if (!(Number.isFinite(tickMillis) && tickMillis > 0)) return yield* Effect.die(new Error(TICK_INVALID(tickMillis)));
		// An agent never gets an escape of any kind, whatever the terminal could do: it sees the theme at colour none, as
		// `Render.context` does, both as Ink's colour level and as the theme the tree reads (its `paint`, its colour-none
		// markers). Read only when provided, so `Audience` stays out of the requirements.
		const audience = yield* Effect.serviceOption(Audience);
		const cliTheme = yield* CliTheme;
		const theme = CliTheme.forAudience(
			cliTheme.forStream("stdout"),
			O.isSome(audience) ? audience.value.kind : undefined,
		);
		const colour = theme.color;
		// Under the GitHub Actions runner, text from data must not form a workflow command: a DocView neutralizes its own
		// lines, and a frame printed as a string is neutralized whole, a consumer's raw Text included.
		const neutralize = yield* underGithubActions;
		const provided = { theme, glyphs: theme.glyphs, ...(neutralize ? { neutralizeWorkflowCommands: true } : {}) };
		const interactive = yield* CliInteractive;
		const streams = yield* UiStreams;
		const overrides = yield* UiRenderOptions;
		const drain = yield* resolveDrain(options.drainPerformance ?? "auto");
		const bridge = yield* makeInkConsole;
		const inbox = yield* Queue.unbounded<Message<E, S>>();
		const source = options.events;
		const stream = "~effect/Stream" in source ? source : undefined;
		const subscription = "~effect/Stream" in source ? undefined : source;

		let state = options.initial;
		let run: Run<S> | undefined;
		// A subscription's PubSub was ended with `PubSub.end` and its final message taken: it is never taken again.
		let finalTaken = false;

		// The consumer's render runs inside React, under an error boundary, never in a fiber of the kit's.
		const Frame = (props: { readonly state: S; readonly frame: number }): ReactElement =>
			options.render(props.state, props.frame);
		const frameOf = Effect.map(Clock.currentTimeMillis, (now) => Math.floor(now / tickMillis));
		const elementOf = (shown: S, frame: number): ReactElement =>
			inkModules().react.createElement(Frame, { state: shown, frame });

		/**
		 * Unmount what a run has mounted: Ink's own unmount commits the last frame. Nothing is written after it. The clear
		 * and the close are one uninterruptible step: an interrupt landing between them would leave a scope nobody closes,
		 * its permit held, its instance mounted and its tick running.
		 */
		const unmount = (current: Run<S>): Effect.Effect<void> =>
			Effect.uninterruptible(
				Effect.suspend(() => {
					const mounted = current.mounted;
					current.mounted = undefined;
					return mounted === undefined ? Effect.void : Scope.close(mounted.scope, Exit.void);
				}),
			);

		/** Take the run off and unmount it, in one step an interrupt cannot split; the run taken, if any. */
		const takeRun: Effect.Effect<Run<S> | undefined> = Effect.uninterruptible(
			Effect.suspend(() => {
				const current = run;
				run = undefined;
				return current === undefined ? Effect.as(Effect.void, undefined) : Effect.as(unmount(current), current);
			}),
		);

		/**
		 * A lazy view's shape errors already warned about. A shape error is deterministic, and the lazy view keeps one
		 * error object for it, so a long watch session warns once for it, not once per run; any other failure is a fresh
		 * object, and warns each time.
		 */
		const shapesWarned = new Set<LazyViewShapeError>();

		/** The degraded-run warning, unless it is a shape error this view has already warned about. */
		const warning = (error: unknown): Effect.Effect<void> => {
			if (error instanceof LazyViewShapeError) {
				if (shapesWarned.has(error)) return Effect.void;
				shapesWarned.add(error);
			}
			return Effect.logWarning(DEGRADED(error));
		};

		/** Stop drawing a run: unmount first, so the one warning never lands inside a frame, then warn. */
		const degrade = (current: Run<S>, error: unknown): Effect.Effect<void> =>
			Effect.suspend(() => {
				if (current.degraded) return unmount(current);
				current.degraded = true;
				return Effect.andThen(unmount(current), warning(error));
			});

		/** Act on a failure the boundary reported for the run mounted now, if any. */
		const checkFailure: Effect.Effect<void> = Effect.suspend(() => {
			const current = run;
			const failed = current?.failed;
			return current === undefined || failed === undefined ? Effect.void : degrade(current, failed.error);
		});

		/** Say once that a run stopped drawing: already said for a degraded run, and said here for one that never mounted. */
		const warnOnce = (current: Run<S>, error: unknown): Effect.Effect<void> =>
			Effect.suspend(() => {
				if (current.degraded) return Effect.void;
				current.degraded = true;
				return warning(error);
			});

		/** The final frame as a string, at the stdout width (80 when it reports none) and with no height to fit. */
		const printFrame = (current: Run<S>): Effect.Effect<void> =>
			Effect.gen(function* () {
				const viewLoaded = yield* Effect.exit(loadView(options.render));
				if (Exit.isFailure(viewLoaded)) return yield* warnOnce(current, Cause.squash(Cause.map(viewLoaded.cause, (error) => error.cause)));
				const { ink, react } = yield* loadInk;
				const frame = yield* frameOf;
				const reported = streams.stdout.columns;
				const columns = reported !== undefined && reported > 0 ? reported : 80;
				let failure: { readonly error: unknown } | undefined;
				const tree = react.createElement(errorBoundary(), {
					onError: (error) => {
						failure ??= { error };
					},
					children: uiProviders(
						{ ...provided, size: { columns, rows: Number.POSITIVE_INFINITY } },
						elementOf(state, frame),
					),
				});
				const text = yield* Effect.scoped(
					Effect.andThen(
						withInkColour(colour),
						Effect.sync(() => ink.renderToString(tree, { columns })),
					),
				);
				drainPerformance(drain);
				if (failure !== undefined) return yield* warnOnce(current, failure.error);
				bridge.print(neutralize ? CommandNeutralizer.text(text) : text);
			});

		/** The context `final`'s document is rendered with: `Doc.print`'s when the environment is there. */
		const finalContext: Effect.Effect<RenderContext> = Effect.gen(function* () {
			const terminal = yield* Effect.serviceOption(TerminalEnv);
			const links = yield* Effect.serviceOption(CliLinks);
			if (O.isSome(terminal) && O.isSome(links) && O.isSome(audience)) {
				return yield* Render.context("stdout").pipe(
					Effect.provideService(CliTheme, cliTheme),
					Effect.provideService(TerminalEnv, terminal.value),
					Effect.provideService(CliLinks, links.value),
					Effect.provideService(Audience, audience.value),
				);
			}
			// No environment: what the view already knows. A run with nobody watching has no width to honour.
			return Render.contextOf({
				audience: O.isSome(audience) ? audience.value.kind : "human",
				color: theme.color,
				glyphs: theme.glyphs,
				...(neutralize ? { neutralizeWorkflowCommands: true } : {}),
			});
		});

		/** A run's `final` document, printed as `Doc.print` would, to the view's stdout; never Ink. */
		const printFinal = (current: Run<S>, final: (state: S) => Cli.Document): Effect.Effect<void> =>
			Effect.gen(function* () {
				const built = Result.try(() => final(state));
				if (Result.isFailure(built)) return yield* warnOnce(current, built.failure);
				const ctx = yield* finalContext;
				const text = Render[yield* autoFormat(ctx.audience)](built.success, ctx);
				if (text !== "") bridge.print(text);
			});

		/** Mount a run's view with the current state, its tick beside it; a failure degrades the run. */
		const mount = (current: Run<S>): Effect.Effect<void> =>
			Effect.gen(function* () {
				const scope = yield* Scope.make("sequential");
				const slot = holderSlot();
				// Recorded before anything is acquired, so the close-time finalizer finds and closes it however an interrupt
				// lands: mid-acquisition, or after the acquisition returns and before this fiber resumes.
				current.mounted = { scope, slot };
				const report = (error: unknown): void => {
					current.failed ??= { error };
					Queue.offerUnsafe(inbox, { _tag: "Failed", run: current });
				};
				yield* Effect.gen(function* () {
					// One Ink mount at a time, process-wide, held for this run only: a `CliUi.run` between runs mounts.
					yield* Effect.acquireRelease(mountPermit.take(1), () => mountPermit.release(1), { interruptible: true });
					yield* Effect.acquireRelease(
						Effect.sync(() => overrides.onMount?.("live")),
						() => Effect.sync(() => overrides.onUnmount?.(undefined)),
					);
					const { ink, react } = yield* loadInk;
					// A lazy view's module, before the first element is built; a failed import degrades the run.
					yield* Effect.catch(loadView(options.render), (error) => Effect.die(error.cause));
					yield* withInkColour(colour);
					const frame = yield* frameOf;
					const initial = elementOf(state, frame);
					const shown = state;
					// A frame that throws is replaced by the last good one, guarded in turn, so the run's last frame stays.
					const lastGood = (): ReactElement | null => {
						const good = current.good;
						return good === undefined
							? null
							: react.createElement(errorBoundary(), {
									// The last good frame threw as well: nothing of this run is left on the terminal, so its end
									// prints the final frame as a string.
									onError: () => {
										current.painted = false;
									},
									children: elementOf(good.state, good.frame),
								});
					};
					const tree = react.createElement(errorBoundary(), {
						onError: report,
						children: uiProviders(
							provided,
							react.createElement(
								bridge.Bridge,
								null,
								react.createElement(
									heightClamp(),
									null,
									react.createElement(errorBoundary(), {
										onError: report,
										fallback: lastGood,
										children: react.createElement(holder(), { initial, bind: slot.bind }),
									}),
								),
							),
						),
					});
					yield* Effect.acquireRelease(
						Effect.sync(() => {
							const instance = ink.render(tree, {
								stdin: streams.stdin,
								stdout: streams.stdout,
								stderr: streams.stderr,
								interactive: true,
								exitOnCtrlC: false,
								patchConsole: false,
								// Never Ink's debug mode, even under a harness that renders screens so: a live view writes lines above
								// its frame, which only the production path lays out as a terminal would.
								...(overrides.onRender === undefined ? {} : { onRender: overrides.onRender }),
								...(overrides.maxFps === undefined ? {} : { maxFps: overrides.maxFps }),
							});
							drainPerformance(drain);
							return instance;
						}),
						(instance) =>
							Effect.promise(() => {
								// Ink drops a hook write once it has unmounted: the console goes back to the streams first.
								bridge.detach();
								// Taken before `unmount()`, which removes the `beforeExit` listener this registers; taken after, the
								// listener would outlive the instance and hold it, one more per run.
								const exited = instance.waitUntilExit();
								// Ink's own unmount commits the last frame to the terminal; `clear()` is never called.
								instance.unmount();
								drainPerformance(drain);
								return exited.then(() => undefined, () => undefined);
							}),
					);
					// The tick, in the run's scope: interrupted with the run, so no timer outlives it.
					yield* Effect.forkIn(
						// The frame index is read when the tick fires, so a frame is never skipped while the controller is busy.
						Effect.repeat(
							Effect.flatMap(frameOf, (at) => Queue.offer(inbox, { _tag: "Tick", frame: at })),
							Schedule.spaced(Duration.millis(tickMillis)),
						),
						scope,
					);
					current.frame = frame;
					if (current.failed === undefined) {
						current.painted = true;
						current.good = { state: shown, frame };
					}
				}).pipe(
					Scope.provide(scope),
					// A mount that fails or is interrupted partway releases what it took: the permit, the colour, the instance.
					Effect.onExit((exit) =>
						Exit.isSuccess(exit)
							? Effect.void
							: Effect.andThen(
									Effect.sync(() => {
										if (current.mounted?.scope === scope) current.mounted = undefined;
									}),
									Scope.close(scope, exit),
								),
					),
				);
				yield* checkFailure;
			}).pipe(
				Effect.catchCauseIf((cause) => !Cause.hasInterruptsOnly(cause), (cause) => degrade(current, Cause.squash(cause))),
			);

		/**
		 * Push the current state to the mounted run, at `at` or the clock's frame, and wait for React to commit it; a
		 * frame that throws degrades the run.
		 */
		const drawAt = (at: number | undefined): Effect.Effect<void> =>
			Effect.suspend(() => {
				const current = run;
				const mounted = current?.mounted;
				if (current === undefined || mounted === undefined) return Effect.void;
				const shown = state;
				return Effect.gen(function* () {
					const frame = at ?? (yield* frameOf);
					yield* Effect.callback<void>((resume) => {
						// Resumed on a microtask, never inside React's commit: `resume` runs this fiber at once, and the commit
						// releases a waiter before the boundary hears of a frame that threw (`componentDidCatch` comes later in it).
						mounted.slot.swap(elementOf(shown, frame), () => queueMicrotask(() => resume(Effect.void)));
					});
					drainPerformance(drain);
					current.frame = frame;
					if (current.failed === undefined) {
						current.painted = true;
						current.good = { state: shown, frame };
					}
					yield* checkFailure;
				});
			});
		const draw = drawAt(undefined);

		/** End the run: unmount, which commits its frame; a degraded run that never painted prints its frame instead. */
		const endRun: Effect.Effect<void> = Effect.flatMap(takeRun, (current) => {
			if (current === undefined) return Effect.void;
			if (!interactive) {
				if (options.mode === "hosted") return Effect.void;
				return options.final === undefined ? printFrame(current) : printFinal(current, options.final);
			}
			return Effect.suspend(() => {
				// A frame that threw as the run ended is said here, once, after the unmount, as any other degrade is.
				const failed = current.failed;
				const warned =
					failed === undefined || current.degraded
						? Effect.void
						: Effect.suspend(() => {
								current.degraded = true;
								return Effect.logWarning(DEGRADED(failed.error));
							});
				// Read after the unmount, which is what settles whether anything of the run is left on the terminal.
				return Effect.andThen(
					warned,
					Effect.suspend(() => (current.painted ? Effect.void : printFrame(current))),
				);
			});
		});

		const beginRun: Effect.Effect<void> = Effect.suspend(() => {
			const current: Run<S> = {
				mounted: undefined,
				degraded: false,
				painted: false,
				failed: undefined,
				frame: 0,
				good: undefined,
			};
			run = current;
			return interactive ? mount(current) : Effect.void;
		});

		/** Fold a chunk, starting and ending runs at its events, and draw once for what is left of it. */
		const onChunk = (chunk: ReadonlyArray<E>): Effect.Effect<void> =>
			Effect.gen(function* () {
				let dirty = false;
				for (const event of chunk) {
					const reduced = Result.try(() => options.reduce(state, event));
					// A reducer that throws: unmount first, then the drain dies with the error.
					if (Result.isFailure(reduced)) {
						yield* Effect.suspend(() => (run === undefined ? Effect.void : unmount(run)));
						return yield* Effect.die(reduced.failure);
					}
					const folded = reduced.success;
					const before = state;
					if (run?.degraded === true && options.isStart(event)) {
						// A start during a run that degraded ends it, keeping what it left on the terminal (or printing it, at
						// the state before the start), and mounts a fresh run: a degraded run draws nothing more, so a host that
						// starts again without a terminal event would otherwise get no frames until one came.
						yield* endRun;
						state = folded;
						yield* beginRun;
						dirty = false;
						continue;
					}
					state = folded;
					if (options.isTerminal(event)) {
						if (dirty || run !== undefined) yield* draw;
						dirty = false;
						yield* endRun;
					} else if (run === undefined) {
						// No run is going: only an event that begins one mounts; any other is folded and not drawn, so what a
						// program reports after a run ends (coverage, thresholds) never mounts a second copy of it.
						if (begins(event, before, folded)) yield* beginRun;
						dirty = false;
					} else {
						// A start during a run redraws it in place, as any other event does (a degraded one excepted, above).
						dirty = true;
					}
				}
				if (dirty) yield* draw;
			});

		const onTick = (frame: number): Effect.Effect<void> =>
			Effect.suspend(() => {
				const current = run;
				// A tick that waited in the inbox past a later draw is stale: the spinner never steps back.
				return current?.mounted === undefined || frame <= current.frame ? Effect.void : drawAt(frame);
			});

		/**
		 * What a subscription holds now, taken without waiting: its buffered messages, then, once its PubSub has been
		 * ended with `PubSub.end`, the final message, the first time only. A shut-down subscription holds nothing (and a
		 * take from it would interrupt): it is not asked.
		 */
		const takeQueued = (sub: PubSub.Subscription<E>): Effect.Effect<ReadonlyArray<E>> =>
			Effect.suspend(() => {
				const queued = PubSub.remainingUnsafe(sub);
				if (O.isNone(queued)) return Effect.succeed([]);
				const ended = sub.ended.current;
				const final: ReadonlyArray<E> = O.isSome(ended) && !finalTaken ? [ended.value] : [];
				if (final.length > 0) finalTaken = true;
				return queued.value > 0
					? Effect.map(PubSub.takeUpTo(sub, queued.value), (taken): ReadonlyArray<E> => [...taken, ...final])
					: Effect.succeed(final);
			});

		/**
		 * What a subscription still queues, taken without waiting; nothing for a stream. Read once the pump has stopped
		 * (an `Ended` comes after it), so nothing else is taking. A subscription whose PubSub was shut down has nothing
		 * left, and a take from it would interrupt: it is not asked.
		 */
		const queuedTail: Effect.Effect<ReadonlyArray<E>> =
			subscription === undefined ? Effect.succeed([]) : takeQueued(subscription);

		const control: Effect.Effect<void> = Effect.gen(function* () {
			while (true) {
				// Everything queued at once, in order. Event chunks that arrived together are folded as one chunk and drawn
				// once, so a controller that lags behind its stream catches up in one draw, not one per chunk.
				const messages = yield* Queue.takeAll(inbox);
				let pending: Array<E> = [];
				const flush = Effect.suspend(() => {
					const chunk = pending;
					pending = [];
					return chunk.length === 0 ? Effect.void : onChunk(chunk);
				});
				for (const message of messages) {
					if (message._tag === "Events") {
						pending.push(...message.chunk);
						continue;
					}
					yield* flush;
					switch (message._tag) {
						case "Tick":
							yield* onTick(message.frame);
							break;
						case "Failed":
							if (message.run === run) yield* checkFailure;
							break;
						case "Ended": {
							// The events ended (or `close` ended them) mid-run: fold what a subscription still queues, then
							// commit what is drawn, or print it.
							const tail = yield* queuedTail;
							if (tail.length > 0) yield* onChunk(tail);
							return yield* endRun;
						}
						case "Died":
							// The stream died: unmount first, as for a reducer that throws, then die with its cause.
							yield* takeRun;
							return yield* Effect.failCause(message.cause);
					}
				}
				yield* flush;
			}
		});

		// A stream's pull is made in the caller's scope, as the stream's resources are.
		const streamPull = stream === undefined ? undefined : yield* Stream.toPull(stream);
		const offerEvents = (chunk: ReadonlyArray<E>): Effect.Effect<void> =>
			chunk.length === 0 ? Effect.void : Queue.offer(inbox, { _tag: "Events", chunk });

		/**
		 * One take from a subscription, taken directly (no stream machinery), true once its events have ended: its
		 * PubSub was shut down, or ended with `PubSub.end` and its final message taken. Only the wait for a message can
		 * be interrupted, and nothing from the wait's end to the hand-off to the inbox yields to the scheduler, so an
		 * interrupt (`close`) never lands while a taken message is held: it is in the subscription or in the inbox. Each
		 * step waits or ends, so holding off the scheduler never spins.
		 */
		const subscriptionStep = (sub: PubSub.Subscription<E>): Effect.Effect<boolean> =>
			Effect.uninterruptibleMask((restore) =>
				Effect.suspend(() => {
					if (sub.pipe(PubSub.remainingUnsafe, O.isNone)) return Effect.succeed(true);
					// Ended: core's final message is sticky (every later take returns it again), so take what is buffered and
					// the final message once, and end.
					if (O.isSome(sub.ended.current)) return Effect.as(Effect.flatMap(takeQueued(sub), offerEvents), true);
					return restore(PubSub.takeAll(sub)).pipe(
						// A take the shutdown interrupted ends the events; an interrupt of this fiber (`close`) stays one.
						Effect.catchCause((cause) =>
							sub.pipe(PubSub.remainingUnsafe, O.isNone) ? Effect.void : Effect.failCause(cause),
						),
						Effect.flatMap((chunk) => {
							if (chunk === undefined) return Effect.succeed(true);
							// A take that waited through the end resolves with the final message alone (nothing is buffered once
							// a PubSub has ended and its subscriber is waiting).
							const ended = sub.ended.current;
							const final =
								O.isSome(ended) &&
								chunk.length === 1 &&
								chunk[0] === ended.value &&
								O.getOrElse(PubSub.remainingUnsafe(sub), () => 0) === 0;
							if (final) finalTaken = true;
							return Effect.as(offerEvents(chunk), final);
						}),
					);
				}),
			).pipe(Effect.provideService(Scheduler.PreventSchedulerYield, true));

		const pump: Effect.Effect<void> =
			streamPull !== undefined
				? Effect.forever(
						// Only the pull can be interrupted. A chunk on its way out of the stream's own machinery when `close`
						// interrupts it can still be lost if the scheduler yields there: what a stream holds is the stream's.
						Effect.uninterruptibleMask((restore) => Effect.flatMap(restore(streamPull), offerEvents)),
					).pipe(
						Pull.catchDone(() => Queue.offer(inbox, { _tag: "Ended" })),
						// A stream that dies tells the controller, which would otherwise wait for an event that never comes.
						Effect.catchCauseIf((cause) => !Cause.hasInterruptsOnly(cause), (cause) => Queue.offer(inbox, { _tag: "Died", cause })),
					)
				: subscription === undefined ? Effect.void : Effect.gen(function* () {
						let ended = false;
						while (!ended) ended = yield* subscriptionStep(subscription);
						yield* Queue.offer(inbox, { _tag: "Ended" });
					});
		// Started at once, so its first pull (which subscribes a PubSub-backed stream) happens before `live` returns.
		const pumping = yield* Effect.forkScoped(pump, { startImmediately: true });
		const controlling = yield* Effect.forkScoped(Effect.onExit(control, () => Fiber.interrupt(pumping)));
		// Registered last, so it runs first when the caller's scope closes: stop the fold, then unmount what is drawn.
		// Nothing more is written: a run cut off by the close prints nothing.
		yield* Effect.addFinalizer(() => Effect.andThen(Fiber.interruptAll([controlling, pumping]), takeRun));
		const done = Fiber.join(controlling);
		// What `close` waits for: `done`, except that a view the caller's scope already stopped has nothing left to end.
		const settled = Effect.flatMap(Fiber.await(controlling), (exit) =>
			Exit.isSuccess(exit) || Cause.hasInterruptsOnly(exit.cause) ? Effect.void : Effect.failCause(exit.cause),
		);
		// Once, however many callers: stop taking events, then end. The pump is stopped first, so the controller, which
		// takes what a subscription still queues when it ends, never races it for a message. After an earlier end the
		// controller has returned, and this `Ended` sits in the inbox unread.
		const ending = yield* pumping.pipe(
			Fiber.interrupt,
			Effect.andThen(Queue.offer(inbox, { _tag: "Ended" })),
			Effect.uninterruptible,
			Effect.cached,
		);
		return {
			state: Effect.sync(() => state),
			logConsole: bridge.writer,
			done,
			close: Effect.andThen(ending, settled),
		};
	});
