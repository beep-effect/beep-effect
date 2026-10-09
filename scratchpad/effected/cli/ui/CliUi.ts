// Root types are named through the package's own name, so the emitted ui.d.ts imports them from "../index.ts"
// (kept external by dtsExternals) instead of carrying copies a consumer's root layers cannot satisfy.
import type * as Cli from "../index.ts";
import { Audience } from "../../env/index.ts";
import type { Scope } from "effect";
import { Cause, Deferred, Effect, Exit, Option, Semaphore } from "effect";
import type { Param } from "effect/cli";
import { Prompt } from "effect/cli";
import type { ReactElement, ReactNode } from "react";
import { Cancelled } from "../Cancelled.ts";
import { CliInteractive } from "../CliInteractive.ts";
import { CliTheme } from "../CliTheme.ts";
import { underGithubActions } from "../internal/autoFormat.ts";
import { answerWithoutPerson } from "../internal/fallbackAnswer.ts";
import { NotInteractive } from "../NotInteractive.ts";
import type { LiveHandle, LiveOptions } from "./CliUiLive.ts";
import { live } from "./CliUiLive.ts";
import { errorBoundary } from "./internal/ErrorBoundary.ts";
import { inkModules, loadInk, withInkColour } from "./internal/ink.ts";
import { lazyView } from "./internal/lazyView.ts";
import { mountPermit } from "./internal/mountPermit.ts";
import { UiRenderOptions } from "./internal/renderOptions.ts";
import { useScreenGuard } from "./internal/ScreenContext.ts";
import { uiProviders } from "./internal/UiProviders.ts";
import { KeyTable, useKeys } from "./KeyTable.ts";
import type { UiContextValue } from "./UiProvider.ts";
import { UiStreams } from "./UiStreams.ts";

/**
 * How a screen ends: with a result, or cancelled for a reason.
 *
 * @remarks
 * Only the first call counts. Resolving with an empty value (`[]`, `""`) is a result, not a cancel.
 *
 * @public
 */
export interface ScreenControl<A> {
	/** End the screen with `value`. */
	readonly resolve: (value: A) => void;
	/** End the screen as cancelled: `"escape"` for Esc or a widget's quit key, `"interrupt"` for Ctrl-C. */
	readonly cancel: (reason: "escape" | "interrupt") => void;
}

/**
 * A screen: given its control, the React element to mount, or a promise of one.
 *
 * @remarks
 * The kit's widgets sanitise the text they draw from data; a screen's own components (Ink's `Text`, `Styled`) draw
 * what they are given, so text from data in them is the screen author's to pass through `Fmt.sanitize` first.
 *
 * @public
 */
export type Screen<A> = (control: ScreenControl<A>) => ReactElement | Promise<ReactElement>;

/**
 * Options for {@link CliUi.run}.
 *
 * @public
 */
export interface CliUiRunOptions {
	/**
	 * Erase the screen's last frame as it unmounts, however it ended; `false` by default, which leaves the last frame
	 * on the terminal, as a record of the answer.
	 */
	readonly clear?: boolean;
}

/**
 * Options for {@link CliUi.prompt}.
 *
 * @public
 */
export interface CliUiPromptOptions<A> {
	/** The value to use when the run is not interactive. Without it a non-interactive run fails with `NotInteractive`. */
	readonly otherwise?: A;
	/** Erase the screen's last frame as it unmounts; `false` by default. See {@link CliUiRunOptions.clear}. */
	readonly clear?: boolean;
}

/**
 * Options for {@link CliUi.fallback}: `CliPrompt.fallback`'s, and whether the screen erases its last frame.
 *
 * @public
 */
export type CliUiFallbackOptions<A> = Cli.CliPromptFallbackOptions<A> & {
	/** Erase the screen's last frame as it unmounts; `false` by default. See {@link CliUiRunOptions.clear}. */
	readonly clear?: boolean;
};

/**
 * stdout's theme as the audience sees it: colourless for an agent (as `Render.context` makes it), so a screen's
 * `useTheme`, `Styled` and the widgets' colour-none markers never carry an escape for one. `Audience` is read only when
 * provided, so it stays out of the requirements.
 */
const audienceTheme: Effect.Effect<Cli.StreamTheme, never, Cli.CliTheme> = Effect.gen(function* () {
	const audience = yield* Effect.serviceOption(Audience);
	return CliTheme.forAudience(
		(yield* CliTheme).forStream("stdout"),
		Option.isSome(audience) ? audience.value.kind : undefined,
	);
});

/** The root keys: Esc cancels with `"escape"`, Ctrl-C with `"interrupt"`. `q` belongs to widgets, never here. */
const RootKeys = (props: {
	readonly cancel: ScreenControl<unknown>["cancel"];
	readonly children: ReactNode;
}): ReactNode => {
	useKeys(KeyTable.root, props.cancel);
	// Registering a paste handler turns on bracketed paste and moves every paste onto Ink's paste channel, so pasted
	// text never reaches a `useInput` handler as keys: a pasted `q` or `yes\n` cannot cancel or answer a widget.
	// `TextInput` registers its own handler to read a paste as text.
	const guard = useScreenGuard();
	inkModules().ink.usePaste(guard(() => undefined));
	return props.children;
};

const SCREEN_EXITED = "@effected/cli/ui: the screen exited without resolving or cancelling";

/** The first defect a screen's tree reported, kept apart from the result so a crash beats an end in the same tick. */
interface CrashCell {
	current: { readonly defect: unknown } | undefined;
}

const mount = <A>(
	screen: Screen<A>,
	theme: Cli.StreamTheme,
	clear: boolean,
	crash: CrashCell,
	neutralize: boolean,
): Effect.Effect<A, Cli.Cancelled, Scope.Scope> =>
	Effect.gen(function* () {
		const overrides = yield* UiRenderOptions;
		// The harness's bracket, around everything a run does, so a thunk that throws before Ink draws is a screen too.
		// Released last: after Ink has exited and the colour level is restored, with the defect the run died of.
		yield* Effect.acquireRelease(
			Effect.sync(() => overrides.onMount?.("screen")),
			(_, exit) =>
				Effect.sync(() => {
					const died = Exit.isFailure(exit) ? exit.cause.reasons.find(Cause.isDieReason) : undefined;
					// An interrupt stays an interrupt, as `run` reports it: a crash recorded while it unmounts is not reported.
					const interrupted = Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause);
					overrides.onUnmount?.(died !== undefined ? { defect: died.defect } : interrupted ? undefined : crash.current);
				}),
		);
		const { ink, react } = yield* loadInk;
		const streams = yield* UiStreams;
		yield* withInkColour(theme.color);
		const result = yield* Deferred.make<A, Cli.Cancelled>();
		const control: ScreenControl<A> = {
			resolve: (value) => {
				Deferred.doneUnsafe(result, Exit.succeed(value));
			},
			cancel: (reason) => {
				Deferred.doneUnsafe(result, Exit.fail(new Cancelled({ reason })));
			},
		};
		const element = yield* Effect.promise(async () => screen(control));
		const die = (error: unknown): void => {
			// Recorded even when the result is already settled: a crash in the same tick as a cancel or a resolve wins.
			if (crash.current === undefined) crash.current = { defect: error };
			Deferred.doneUnsafe(result, Exit.die(error));
		};
		const tree = react.createElement(errorBoundary(), {
			onError: die,
			children: uiProviders(
				{
					cancel: control.cancel,
					die,
					theme,
					glyphs: theme.glyphs,
					...(neutralize ? { neutralizeWorkflowCommands: true } : {}),
				},
				react.createElement(RootKeys, { cancel: control.cancel, children: element }),
			),
		});
		const instance = yield* Effect.acquireRelease(
			Effect.sync(() =>
				ink.render(tree, {
					stdin: streams.stdin,
					stdout: streams.stdout,
					stderr: streams.stderr,
					interactive: true,
					exitOnCtrlC: false,
					patchConsole: false,
					...(overrides.debug === true ? { debug: true } : {}),
					...(overrides.onRender === undefined ? {} : { onRender: overrides.onRender }),
					...(overrides.maxFps === undefined ? {} : { maxFps: overrides.maxFps }),
				}),
			),
			(instance) =>
				Effect.promise(async () => {
					// Erases the last frame and marks it written, so the unmount's final render draws nothing over it.
					if (clear) instance.clear();
					// Taken before `unmount()`, which removes the `beforeExit` listener this registers; taken after, the listener
					// would outlive the instance and hold it, one more per screen.
					const exited = instance.waitUntilExit();
					instance.unmount();
					await exited.catch(() => undefined);
				}),
		);
		const exited: Effect.Effect<A, Cli.Cancelled> = Effect.tryPromise({
			try: () => instance.waitUntilExit(),
			catch: (cause) => cause,
		}).pipe(
			Effect.orDie,
			Effect.flatMap(() =>
				Effect.flatMap(Deferred.isDone(result), (done) =>
					done ? Deferred.await(result) : Effect.die(new Error(SCREEN_EXITED)),
				),
			),
		);
		return yield* Effect.raceFirst(Deferred.await(result), exited);
	});

/**
 * Interactive screens drawn with Ink, mounted as scoped resources.
 *
 * @example
 * ```ts
 * import { CliUi, Confirm } from "../ui.ts"
 * import { Effect } from "effect"
 *
 * // Answers `otherwise` when there is no person to ask, and fails with `Cancelled` when they back out.
 * const ask = CliUi.prompt(Confirm.screen({ message: "Overwrite the config?" }), {
 * 	otherwise: { confirmed: false, toggles: {} },
 * })
 * ```
 *
 * @public
 */
export class CliUi {
	private constructor() {}

	/**
	 * Mount `screen` and wait for it to resolve or cancel.
	 *
	 * @remarks
	 * When `CliInteractive` is false it fails with `NotInteractive` and mounts nothing; Ink and React are not even
	 * loaded. Otherwise it loads them, holds Ink's colour level at stdout's, and mounts the screen on
	 * `UiStreams` with Ink's own Ctrl-C exit off: Ctrl-C cancels with `"interrupt"` and Esc with `"escape"`.
	 *
	 * Mounting is one scoped resource. However the screen ends (resolved, cancelled, crashed, or the fiber
	 * interrupted), it is unmounted, raw mode and bracketed paste are off, the cursor is shown, and the colour level is
	 * restored. A
	 * component that throws is a defect, never a hang or a typed failure, and nothing of Ink's crash screen reaches
	 * stdout. So is a `useKeys` handler that throws; a handler a consumer registers with Ink's own `useInput` or
	 * `usePaste` is outside the kit, and what it throws escapes as Ink leaves it. A crash wins over an end in the same
	 * tick: a handler that cancels or resolves and then throws, or a component that throws before the screen has
	 * unmounted, is a defect, never the `Cancelled` or the value; a defect raised while the screen unmounts stays beside
	 * that crash in the cause rather than replacing it. An interrupt stays an interrupt, even when the tree reports a
	 * crash as it unmounts.
	 *
	 * A screen draws on stdout (`UiStreams`), and mounts only when `CliInteractive` is true: a human audience, a
	 * terminal on both stdin and stdout, and a `TERM` that is not `dumb`. `CliInteractive` reads `false` until a layer
	 * sets it (`CliRuntime.main`'s `env` does), so a program that never provides one always gets `NotInteractive`.
	 *
	 * Screens run one at a time, process-wide: Ink owns raw mode on the one terminal, so a second `run` waits until the
	 * first is released; so does a `run` while a {@link CliUi.live} view has a run drawn. A screen that itself awaits
	 * another `CliUi.run` therefore deadlocks, and nothing guards against it.
	 *
	 * Do not log while a screen is mounted. Ink redraws its frame by counting the lines it last wrote, and it is
	 * mounted with `patchConsole` off, so a line written to the terminal from elsewhere (an `Effect.log`, `CliLog`, a
	 * background fiber) lands inside the frame and tears it. Log before the screen mounts or after it resolves.
	 *
	 * With `clear` the last frame is erased as the screen unmounts, so a wizard of several screens leaves only what the
	 * program prints; without it the last frame stays, with the highlight where the answer was.
	 *
	 * @param screen - builds the element to mount from its {@link ScreenControl}
	 * @param options - whether to erase the last frame
	 */
	static readonly run = <A>(
		screen: Screen<A>,
		options?: CliUiRunOptions,
	): Effect.Effect<A, Cli.Cancelled | Cli.NotInteractive, Cli.CliTheme> =>
		Effect.gen(function* () {
			if (!(yield* CliInteractive)) return yield* Effect.fail(new NotInteractive());
			const theme = yield* audienceTheme;
			const neutralize = yield* underGithubActions;
			const crash: CrashCell = { current: undefined };
			const exit = yield* Effect.exit(
				Semaphore.withPermit(
					mountPermit,
					Effect.scoped(mount(screen, theme, options?.clear === true, crash, neutralize)),
				),
			);
			// A tree that crashed is a defect however the screen ended: a cancel or a resolve in the same tick, which
			// settled the result first, must not hide it. An interrupt stays an interrupt. The interrupt check is
			// defensive: a fiber interrupted from outside stops before it gets here.
			const crashed = crash.current;
			const interrupted = Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause);
			if (crashed === undefined || interrupted) return yield* exit;
			const dies = Exit.isFailure(exit) ? exit.cause.reasons.filter(Cause.isDieReason) : [];
			// A run that died of the crash keeps its whole cause, a failing finalizer's defect included.
			if (dies.some((reason) => reason.defect === crashed.defect)) return yield* exit;
			// Otherwise the crash replaces the end it beat, and any defect already there (a kit finalizer that failed)
			// stays beside it.
			return yield* Effect.failCause(Cause.fromReasons<never>([Cause.makeDieReason(crashed.defect), ...dies]));
		});

	/**
	 * The kit's context for an Ink tree the kit did not mount: stdout's theme and glyph set.
	 *
	 * @remarks
	 * Hand it to {@link UiProvider}. It loads Ink and React, as a screen's mount does, so the provider and the kit's
	 * hooks can render; a missing peer is a defect naming both. It is the only way to get a `UiContextValue`.
	 *
	 * Ink loads asynchronously, so this is an `Effect` that must run before the first render. A renderer that is itself
	 * synchronous (a test helper, a report-time `renderToString`) runs it once, with a top-level `await` at module
	 * scope, and then renders synchronously from the value as often as it likes:
	 *
	 * ```ts
	 * const value = await Effect.runPromise(CliUi.context.pipe(Effect.provide(themeLayer)))
	 *
	 * // later, synchronously:
	 * const text = renderToString(createElement(UiProvider, { value: { ...value, size: { columns, rows } } }, tree), {
	 *   columns,
	 * })
	 * ```
	 */
	static readonly context: Effect.Effect<UiContextValue, never, Cli.CliTheme> = Effect.gen(function* () {
		const theme = yield* audienceTheme;
		const neutralize = yield* underGithubActions;
		yield* loadInk;
		return {
			"~@effected/cli/ui/UiContextValue": true,
			theme,
			glyphs: theme.glyphs,
			...(neutralize ? { neutralizeWorkflowCommands: true } : {}),
		};
	});

	/**
	 * A live view over a stream: fold `events` into state, and draw it with Ink while a run is going, for the caller's
	 * scope.
	 *
	 * @remarks
	 * `events` is a `PubSub` subscription or a stream, folded in a fiber of the caller's scope. A subscription, made
	 * before the first publish, is the surest: nothing published after it is missed. `live` makes a stream's first pull
	 * before it returns, so one that subscribes on its first pull without forking (`Stream.fromPubSub`) is subscribed by
	 * then; one that forks its upstream (`Stream.merge`, `buffer`, a concurrent `flatMap`) subscribes later, and loses
	 * what is published before.
	 *
	 * `live` returns its handle at once, before Ink has loaded: it loads Ink when a run first mounts (or, when not
	 * interactive, when an owned run without a `final` prints its final frame), and it waits on nothing asynchronous before returning, so
	 * a host outside Effect can take the handle with `Effect.runSync`. The handle works from the start: a `close`
	 * before any run has mounted folds what is queued and ends the view as the events ending would, waiting for a mount
	 * already under way, and one with no run to end loads nothing.
	 *
	 * End the view with `handle.close`: it stops taking events, folds what is still queued (a subscription's queued
	 * messages included), commits or prints the run as the events ending would, and waits for `done`. Then close the
	 * scope. A publisher may instead end a subscription with `PubSub.end(pubsub, last)`, which keeps everything: the view
	 * folds what is buffered and `last` once, then ends. A `PubSub.shutdown` drops what the view has not taken yet, and
	 * closing the scope by itself stops the fold at once: both lose a run's tail. Closing the scope unmounts whatever is drawn: the terminal is restored (the
	 * cursor shown, Ink's colour level put back) and nothing more is written. `done` completes when the events end.
	 *
	 * A run begins at an `isStart` event (or wherever `begins` says, given the state before and after the event) and ends
	 * at an `isTerminal` event; an event while no run is going that begins none is folded and not drawn, so what a program
	 * reports after a run ends never mounts a second copy of it. A run mounts the view; its end unmounts it, which leaves
	 * its last frame on the terminal, and the next run mounts afresh below it. A start while a run is drawn redraws in
	 * place: the frame is never cleared, so nothing above it is erased. The state is never reset by the kit: a reducer that wants a fresh run
	 * resets it on the start.
	 *
	 * The frame is at most the terminal's rows less one, re-read on every render and on a resize, so a tall frame never
	 * makes Ink wipe the scrollback; its width is Ink's own. The clamp
	 * lags one paint when the terminal gets shorter: Ink re-lays out and repaints the tree it already has on a resize,
	 * before React re-renders with the new row count, so a frame already at the old height can be drawn once taller
	 * than the terminal, which Ink answers by clearing the screen and its scrollback. Only a shrink in height while
	 * the frame is at its full height does it; a frame that keeps a few rows spare never meets it.
	 *
	 * While a run is drawn the view also redraws on a tick of `tickMillis` (80 by default), a schedule in the run's
	 * scope: interrupted with the run or the scope, it never outlives them. Its timer is not unref'd, so while a run is
	 * drawn it keeps the process alive: the run's terminal event, or the scope's close, is what lets the process exit.
	 * The frame index never steps back. Events that arrive at
	 * once, in one chunk or in several the view had not yet caught up with, are folded together and drawn once. The view
	 * takes events from `events` as fast as the stream yields them, so a stream that applies backpressure buffers in the
	 * view while it draws.
	 *
	 * A run whose drawing fails (a `render` that throws, or a mount that fails) degrades rather than ending the view:
	 * it is unmounted, leaving its last good frame on the terminal, then one warning is logged (`Effect.logWarning`),
	 * and the fold goes on. At its terminal event, a run with no frame left on the terminal (it never painted, or its
	 * last good frame threw too) writes its final frame once, as a string. The next run mounts afresh, and so does a
	 * start that comes while a degraded run is going: it ends that run as its terminal event would. A `reduce` that
	 * throws, or an `events` stream that dies, unmounts the run, then `done` dies with the error.
	 *
	 * When the run is not interactive, nothing is mounted and Ink is loaded only when a string is due. In the `owned`
	 * mode (the default) each run's final frame is written once to stdout, as a string laid out at stdout's width (80
	 * when it reports none) with no height to fit, at its terminal event or when the stream ends. It is escape-free at
	 * colour `none`, and for an agent audience (`Audience`, when provided) whatever the terminal could do. With a
	 * `final` document, that document is printed instead, once per run, rendered as `Doc.print` renders it, and Ink,
	 * React and a `CliUi.lazyView` module are never loaded: an agent, CI or piped run of a command with a live view pays
	 * for none of them. In the `hosted` mode nothing is written.
	 *
	 * Keep React off the runs that never draw (`--help`, a usage error) with `render: CliUi.lazyView(() => import(...))`.
	 *
	 * No input is mounted: the view reads no keys and never enters raw mode, so Ctrl-C stays the platform's SIGINT,
	 * which interrupts the program and so closes the scope. Each run holds the process-wide mount permit from its
	 * mount to its end, so a `CliUi.run` during a run waits for the run to end, and one between runs mounts at once.
	 *
	 * While a run is drawn, write logs through `logConsole`, provided around the work the view reports on: its lines
	 * land above the frame. A line written to the terminal any other way tears the frame.
	 *
	 * The view draws on stdout (`UiStreams`), at stdout's colour level and glyphs, and mounts only when the run is
	 * interactive (`CliInteractive`).
	 *
	 * @param options - the events, the fold, the drawing, and what starts and ends a run
	 */
	static readonly live: <E, S>(
		options: LiveOptions<E, S>,
	) => Effect.Effect<LiveHandle<S>, never, Scope.Scope | Cli.CliTheme> = live;

	/**
	 * Run `screen` from a handler when the run is interactive; otherwise answer with `otherwise`, or fail with
	 * `NotInteractive` when there is none.
	 *
	 * @remarks
	 * `CliUi.run` with a default: not interactive, it returns `otherwise` and Ink and React are never loaded.
	 * Interactive, it mounts the screen, and a cancel is the typed `Cancelled` a handler can catch, which
	 * `CliRuntime.main` otherwise renders as one line with exit `130`. A missing Ink in an interactive run is a defect
	 * naming the peers, never a silent `otherwise`. Screens in sequence make a wizard: discover the defaults first,
	 * pass each as an `otherwise`, and a non-interactive run returns exactly them.
	 *
	 * Without `otherwise`, `NotInteractive` stays in the error type even after the caller checked `CliInteractive`, since
	 * the type cannot know. Catch the tag and fail with `CliError.UserError` to exit as a usage error (`64` under
	 * `CliRuntime.main`).
	 *
	 * As with `CliUi.run`, do not log while the screen is mounted: a line written to the terminal from elsewhere tears
	 * the frame.
	 *
	 * @param screen - the screen to show
	 * @param options - the non-interactive default, and whether to erase the last frame
	 */
	static readonly prompt = <A>(
		screen: Screen<A>,
		options?: CliUiPromptOptions<A>,
	): Effect.Effect<A, Cli.Cancelled | Cli.NotInteractive, Cli.CliTheme> =>
		CliUi.run(screen, options?.clear === true ? { clear: true } : undefined).pipe(
			Effect.catchTag("NotInteractive", (error) => {
				// `{ otherwise: undefined }` counts as not given.
				const otherwise = options?.otherwise;
				return otherwise === undefined ? Effect.fail(error) : Effect.succeed(otherwise);
			}),
		);

	/**
	 * A fallback for `Flag.withFallbackPrompt` or `Argument.withFallbackPrompt` that shows a screen when the run is
	 * interactive: `CliPrompt.fallback` for screens.
	 *
	 * @remarks
	 * Interactive, the screen mounts and its answer is the parameter's value. Not interactive, `otherwise` is used when
	 * given and Ink and React are never loaded; without it the parameter fails as missing, exactly as with no fallback,
	 * so core renders its own message and `CliRuntime.main` exits `64`. Name the parameter with `flag` (the name
	 * without dashes) or `argument` so that error can be built.
	 *
	 * The options are {@link @effected/cli!CliPromptFallbackOptions}, the same as `CliPrompt.fallback`'s, and `clear`
	 * as for {@link CliUi.run}.
	 *
	 * It runs during parsing, whose environment is core's alone, so it reads `CliTheme` if one is there: with
	 * `CliRuntime.main`'s `env` (`CliEnv.layer`), or provided around the program. With no theme it treats the run as
	 * not interactive, and when `CliInteractive` is on it says so once, at debug level. Interactivity is
	 * `CliInteractive`, which an audience flag can set before parsing under `CliAudience`.
	 *
	 * As with `CliPrompt.fallback`, the screen runs here rather than being handed to core, whose fallback runner
	 * turns a quit into the missing-parameter error, which would exit `64`. A cancel (Esc, Ctrl-C) is `Cancelled`,
	 * raised as a defect because core's parse step turns every typed failure into a usage error, so only
	 * `CliRuntime.main` (or `CliRuntime.reportFailures`) renders it, as one line with exit `130`. A missing Ink in an
	 * interactive run is a defect naming the peers, never a silent `otherwise`.
	 *
	 * After the screen has unmounted, core still runs the answered `Prompt.succeed` it is handed against the
	 * terminal, exactly as it does for `CliPrompt.fallback`: `Prompt.run` opens the terminal's input in a scope (on
	 * Node a readline over stdin, in raw mode) before looking at the prompt. That is harmless. The prompt is already
	 * answered, so nothing is read and no key is waited for; the scope closes at once, restoring the mode and closing
	 * the reader; and Ink has already let go of stdin, so the two never hold it together. Not interactive, the screen
	 * never mounts, and `CliPrompt.gateTerminal`, which `CliEnv.layer` installs, keeps that subscription off the real
	 * terminal altogether.
	 *
	 * @param screen - the screen to show
	 * @param options - the parameter it stands in for, the non-interactive default, and whether to erase the last frame
	 */
	static readonly fallback = <A>(screen: Screen<A>, options: CliUiFallbackOptions<A>): Param.FallbackPrompt<A> => {
		// Said once per fallback: a parse that retries must not repeat it.
		let explained = false;
		return Effect.gen(function* () {
			const theme = yield* Effect.serviceOption(CliTheme);
			if (Option.isNone(theme)) {
				if (!explained && (yield* CliInteractive)) {
					explained = true;
					const name = "flag" in options ? `--${options.flag}` : `<${options.argument}>`;
					yield* Effect.logDebug(
						`@effected/cli/ui: CliUi.fallback for ${name} answered without its screen: CliInteractive is on, but no CliTheme is provided around parsing (CliRuntime.main's env provides one)`,
					);
				}
				return yield* answerWithoutPerson(options);
			}
			return yield* CliUi.run(screen, options.clear === true ? { clear: true } : undefined).pipe(
				Effect.provideService(CliTheme, theme.value),
				Effect.map((answer) => Prompt.succeed(answer)),
				Effect.catchTag("Cancelled", (cancelled) => Effect.die(cancelled)),
				Effect.catchTag("NotInteractive", () => answerWithoutPerson(options)),
			);
		});
	};

	/**
	 * A screen whose module is loaded only when it mounts, so importing the command that uses it loads neither the
	 * screen's own code nor React.
	 *
	 * @param load - imports the module whose default export is the screen
	 */
	static readonly lazy =
		<A>(load: () => Promise<{ readonly default: Screen<A> }>): Screen<A> =>
		async (control) =>
			(await load()).default(control);

	/**
	 * A live view's `render` whose module is loaded only when a run first draws it, so importing the command that uses
	 * the view loads neither the view's own code nor React: `CliUi.lazy` for `CliUi.live`.
	 *
	 * @remarks
	 * `load` resolves to the view, `(state, frame) => ReactElement`, exactly what `render` takes, so the frame index a
	 * spinner needs reaches it: either a module whose default export is the view (`() => import("./view.ts")`), or the
	 * view itself (`() => import("./views.ts").then((module) => module.syncView)`, for a named export).
	 *
	 * It is optional: `render` still takes the view directly, and needs no dynamic import. A view passed directly
	 * loads with the module that imports it, so it costs React on every run that loads that module; `lazyView` is
	 * how a command keeps React off the runs that never draw. `CliUi.live` loads the module before a run mounts with Ink, or before it
	 * prints a run's final frame as a string; a run that is not interactive and has a `final` document never loads it,
	 * nor Ink, nor React. An import that fails degrades the run, as a render that throws does: one warning, and the next
	 * run tries the import again. A load that resolves to no view (neither a function nor a module whose `default` is
	 * one) is a programming error, and deterministic, so it is kept for the view's life: every run degrades without
	 * loading again, and the view warns once, saying what it received and what is expected, rather than once per run. A
	 * view function that happens to carry a `default` property is the view.
	 *
	 * The returned function is for `CliUi.live`'s `render` alone: called before its module has loaded, it throws.
	 *
	 * Keep the `LiveOptions` (the state, the events and the `lazyView` call) in a module the view does not import. The
	 * view module usually imports the state's types or its fold from somewhere; if that somewhere is the module that
	 * holds the `import("./view.ts")`, the dynamic import closes a cycle, which Biome's `noImportCycles` reports even
	 * though it is lazy. A layout that stays acyclic: the model (state, events, fold) in one module, the view importing
	 * the model, and the options (with `lazyView`) in a third that imports the model and loads the view.
	 *
	 * ```ts
	 * // commands/sync.ts: no JSX, no React
	 * const view = yield* CliUi.live({
	 *   events,
	 *   initial,
	 *   reduce,
	 *   render: CliUi.lazyView(() => import("./sync-view.ts")),
	 *   final: (state) => [Doc.paragraph(`${state.done} synced`)],
	 *   isStart,
	 *   isTerminal,
	 * })
	 * ```
	 *
	 * @param load - resolves to the view, or to a module whose default export is the view
	 */
	static readonly lazyView: <S>(
		load: () => Promise<
			((state: S, frame: number) => ReactElement) | { readonly default: (state: S, frame: number) => ReactElement }
		>,
	) => (state: S, frame: number) => ReactElement = lazyView;

	/**
	 * A screen whose answer is `f` of `screen`'s: it mounts `screen` and resolves with `f(value)` when `screen` resolves
	 * with `value`.
	 *
	 * @remarks
	 * Only the resolve is mapped. A cancel passes through unchanged, as the same `Cancelled`, and so does everything
	 * else about the screen: what it draws, its keys, a lazy load. `f` runs when the screen resolves; what it throws is
	 * thrown from the screen's resolve, so it is a defect of the run, as any other throw in a key handler is.
	 *
	 * The mapped screen is a `Screen` like any other, so it goes wherever a screen goes: `CliUi.run`, `CliUi.prompt`,
	 * `CliUi.fallback`, or around a `CliUi.lazy` one. The commonest use is a `Confirm` behind a boolean flag, where the
	 * fallback needs a `Screen<boolean>` and `Confirm` answers a whole `ConfirmResult`:
	 *
	 * ```ts
	 * const yes = Flag.Boolean("yes").pipe(
	 *   Flag.withFallbackPrompt(
	 *     CliUi.fallback(
	 *       CliUi.map(Confirm.screen({ message: "Publish?" }), (result) => result.confirmed),
	 *       { flag: "yes", otherwise: false },
	 *     ),
	 *   ),
	 * )
	 * ```
	 *
	 * @param screen - the screen to show
	 * @param f - turns its answer into the mapped screen's
	 */
	static readonly map =
		<A, B>(screen: Screen<A>, f: (value: A) => B): Screen<B> =>
		(control) =>
			screen({ resolve: (value) => control.resolve(f(value)), cancel: control.cancel });
}
