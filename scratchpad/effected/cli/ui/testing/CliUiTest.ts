import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Schedule from "effect/Schedule";
// Root and ./ui types are named through the package's own name, so the emitted ui-testing.d.ts imports them rather
// than carrying copies a consumer's own layers and screens could not satisfy.
import type * as Cli from "../../index.ts";
import type { KeyName, LiveHandle, LiveOptions, Screen, ScreenControl } from "../../ui.ts";
import type { ColorLevel } from "../../../env/index.ts";
import { TerminalEnv } from "../../../env/index.ts";
import type * as Scope from "effect/Scope";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Inspectable from "effect/Inspectable";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import { TestClock } from "effect/testing";
import type { ReactElement } from "react";
import { CliInteractive } from "../../CliInteractive.ts";
import { CliTheme } from "../../CliTheme.ts";
import type { Style, TokenName } from "../../Token.ts";
import { CliUi } from "../CliUi.ts";
import { holder, holderSlot } from "../internal/Holder.ts";
import { inkModules } from "../internal/ink.ts";
import { UiRenderOptions } from "../internal/renderOptions.ts";
import { UiStreams } from "../UiStreams.ts";
import { makeFakeStreams } from "./fakeStreams.ts";
import { screenAfter } from "./terminalModel.ts";

/**
 * Options for {@link CliUiTest.render}, {@link CliUiTest.view} and {@link CliUiTest.session}, and the terminal's
 * half of {@link CliUiTest.live}'s.
 *
 * @public
 */
export interface CliUiTestOptions {
	/** The terminal width the screen lays out at; 80 by default. */
	readonly columns?: number;
	/** The terminal height; 24 by default. */
	readonly rows?: number;
	/**
	 * The colour level of both streams; `"truecolor"` by default, so frames carry the marker palette that
	 * {@link CliUiTest.styled} decodes to token markup. `"none"` gives escape-free frames.
	 *
	 * @remarks
	 * Only truecolor keeps tokens apart. Below it, chalk maps every marker `#0000NN` to the same colour
	 * (`ansi256(16)` at `"256"`, black at `"basic"`), so token identity is lost; do not snapshot tokens from such a run.
	 */
	readonly color?: ColorLevel;
	/** The glyph set; Unicode by default. */
	readonly glyphs?: "unicode" | "ascii";
	/**
	 * Whether the run is interactive; `true` by default. `false` makes a screen fail with `NotInteractive`, and makes a
	 * live view print each run's final frame as a string instead of mounting it.
	 */
	readonly interactive?: boolean;
}

/**
 * Options for {@link CliUiTest.session}: the terminal's, and the render path its screens mount on.
 *
 * @public
 */
export interface CliUiTestSessionOptions extends CliUiTestOptions {
	/**
	 * The path the session's screens render on. `"debug"`, the default, is `render`'s: Ink writes every frame whole and
	 * unthrottled, which is what `next`, `frame` and `frames` read best, and where `clear` does nothing. `"production"`
	 * renders screens as a real terminal does, erase moves and all, so `CliUi.run`'s `clear: true` is observable in
	 * {@link CliUiTestSession.transcript}: the cleared frame is gone from it. A live view mounted in a session always
	 * renders on the production path, whichever this is.
	 */
	readonly renderPath?: "debug" | "production";
}

/**
 * A screen under test: drive it with keys and read its frames.
 *
 * @public
 */
export interface CliUiTestScreen {
	/**
	 * Press named keys, one after another. Each waits until the screen draws its next frame or 50 ms pass with
	 * nothing written; `"escape"` first waits a real 30 ms, because Ink holds a lone ESC for 20 ms before reporting
	 * it. Pressing, typing or chunking on a screen that has ended is a defect, not a key for whatever screen is mounted
	 * now.
	 *
	 * @remarks
	 * A `{ char }` item sends its text as typed, as `chunk` does, settling like a key: `press({ char: "n" }, "enter")`.
	 * A bare string that is not a key name (`press("n")`) is a defect naming `type("n")` and `{ char: "n" }`, since a
	 * letter is not a `KeyName`.
	 */
	readonly press: (...keys: ReadonlyArray<KeyName | { readonly char: string }>) => Effect.Effect<void>;
	/** Type text, one character at a time, each settling like a key. */
	readonly type: (text: string) => Effect.Effect<void>;
	/**
	 * Press named keys together: all their bytes in ONE stdin write, then one settle, as a fast typist, a held key or
	 * a batching terminal delivers them.
	 *
	 * @remarks
	 * Ink dispatches every key of one read before React re-renders, so a handler that steps from state its render
	 * captured repeats the first key's move; {@link CliUiTestScreen.press}, which writes and settles key by key, can
	 * never show that. Use `chunk` to test a key handler against it. An `"escape"` inside a chunk joins the bytes after
	 * it, as on a real terminal; only a trailing one waits out Ink's ESC hold. A `{ char }` writes its text as typed:
	 * Ink hands text read in one go to `useInput` as one string, `"yy"` or `"y\r"`, which `useKeys` splits into keys.
	 */
	readonly chunk: (...keys: ReadonlyArray<KeyName | { readonly char: string }>) => Effect.Effect<void>;
	/** Resize the terminal and emit `resize`, as a real one does, settling like a key. */
	readonly resize: (columns: number, rows: number) => Effect.Effect<void>;
	/** The latest frame as token markup ({@link CliUiTest.styled}), each line's trailing spaces trimmed. */
	readonly frame: Effect.Effect<string>;
	/** The latest frame as Ink wrote it, escapes included. */
	readonly rawFrame: Effect.Effect<string>;
	/** The latest frame as plain text: no escapes and no markup, each line's trailing spaces trimmed. */
	readonly plainFrame: Effect.Effect<string>;
	/** Every frame of this screen so far, oldest first, as token markup like {@link CliUiTestScreen.frame}. */
	readonly frames: Effect.Effect<ReadonlyArray<string>>;
}

/**
 * A screen mounted by {@link CliUiTest.render}: a {@link CliUiTestScreen} that can also be swapped and awaited.
 *
 * @public
 */
export interface CliUiTestHandle<A> extends CliUiTestScreen {
	/**
	 * Show another screen in place of the current one, settling like a key.
	 *
	 * @remarks
	 * `screen` is called with the same `ScreenControl` the first screen got, so `result` still resolves through it,
	 * and only the screen's own subtree is swapped: the error boundary, root keys and colour hold stay mounted. Ink's
	 * own `rerender` is never used. A rerender after the screen has ended is a defect, not a no-op, because a test
	 * that does it has lost track of the screen; so is one on a screen that has not mounted within 2 s, such as a
	 * handle queued behind another mounted screen.
	 */
	readonly rerender: (screen: Screen<A>) => Effect.Effect<void>;
	/** How the screen ended: its value, or `Cancelled` or `NotInteractive`. Waits for it to end. */
	readonly result: Effect.Effect<A, Cli.Cancelled | Cli.NotInteractive>;
}

/**
 * A display-only element mounted by {@link CliUiTest.view}: a {@link CliUiTestScreen} that can be swapped for another
 * element, with no result to wait for.
 *
 * @public
 */
export interface CliUiTestView extends CliUiTestScreen {
	/**
	 * Show another element in place of the current one, settling like a key.
	 *
	 * @remarks
	 * Only the element's subtree is swapped: the kit's providers stay mounted. A rerender after the view has ended
	 * (Esc or Ctrl-C ends it, as on every screen) is a defect, not a no-op.
	 */
	readonly rerender: (element: ReactElement) => Effect.Effect<void>;
}

/**
 * Options for {@link CliUiTestSession.next}.
 *
 * @public
 */
export interface CliUiTestNextOptions {
	/**
	 * Text the screen must have shown, in plain text, before `next` returns it: in any frame since its mount, not
	 * necessarily the latest one. Read `plainFrame` to check what it shows now.
	 */
	readonly contains?: string;
}

/**
 * A terminal a whole program runs its screens on, from {@link CliUiTest.session}.
 *
 * @public
 */
export interface CliUiTestSession {
	/**
	 * Provide it around the program: in-memory terminal streams (`UiStreams`), the marker-palette `CliTheme`,
	 * `CliInteractive` from the session's options, frame capture, and a `Console` whose writes the session keeps. Its
	 * type names `CliTheme` alone because that is the only one of them a program can require: `UiStreams`,
	 * `CliInteractive`, the capture and `Console` are `Context.Reference`s with defaults, which never appear in a
	 * requirement, so a type cannot say that the layer supplies them. Their defaults are the real process streams, a
	 * run that is not interactive, and the real console, so a session provided where it is shadowed fails quietly
	 * rather than by a type error. Hence the ordering below.
	 *
	 * @remarks
	 * **Where you provide it decides what it supplies.** Anything the program provides closer to the screens wins, so:
	 *
	 * - Provided **outside** a layer that supplies the same services, it is shadowed there. Under `CliRuntime.main`
	 *   with `env`, `CliEnv.layer` (provided inside `main`) supplies the theme and decides interactivity, as it does for
	 *   real, and the session keeps only the streams, the capture and the console. That is the intended way to test the
	 *   production wiring.
	 * - To have the session's own theme and `interactive` option win, provide it **inside** any presentation layer of
	 *   your own (closest to the program), or drop that layer from the test.
	 *
	 * The streams, the capture and the console are the session's wherever it is provided, since nothing else in the kit
	 * provides them.
	 */
	readonly layer: Layer.Layer<Cli.CliTheme>;
	/**
	 * Wait for the next screen to mount and draw (and, with `contains`, to show that text), and return it.
	 *
	 * @remarks
	 * Each call takes the next mount in order, counting every mount since the session began, so a screen that mounted
	 * before the call is not missed. It waits at most 2 s, then dies naming the screen's number, the text it waited
	 * for and how many screens had mounted. The returned screen's frames start at its own mount. A screen that crashed
	 * makes `next` die with the crash instead.
	 */
	readonly next: (options?: CliUiTestNextOptions) => Effect.Effect<CliUiTestScreen>;
	/**
	 * How many screens have mounted so far: every run that started mounting, one whose thunk threw before Ink drew
	 * included.
	 */
	readonly mounts: Effect.Effect<number>;
	/** What the program wrote to stdout through `Console` (`log`, `info`, `debug`), one line per call. */
	readonly stdout: Effect.Effect<string>;
	/** What the program wrote to stderr through `Console` (`error`, `warn`, `trace`), one line per call. */
	readonly stderr: Effect.Effect<string>;
	/**
	 * What the terminal shows now, scrollback included, as plain text: what the session's screens and live views wrote to
	 * the terminal streams (`UiStreams`), with Ink's erases and clears applied, each line's trailing spaces trimmed and
	 * blank lines left out, as {@link CliUiTestLive.transcript} reads it.
	 *
	 * @remarks
	 * It holds the lines a live view writes above its frame through `handle.logConsole` (stdout's and stderr's, merged in the order
	 * written, as one terminal shows them; `stdoutWritten` and `stderrWritten` keep them apart), each run's committed frame, a frame printed as a string, and, with
	 * `renderPath: "production"`, each screen's frames as they stay on the terminal, so a screen run with `clear: true`
	 * leaves nothing. On the default debug path each screen frame is written whole, one after another, so the
	 * transcript shows every frame a screen drew rather than what a terminal would keep. What the program writes through
	 * `Console` is not here: that is `stdout` and `stderr`.
	 */
	readonly transcript: Effect.Effect<string>;
	/** Every byte written to the terminal streams, both of them in the order written, escapes included. */
	readonly written: Effect.Effect<string>;
	/**
	 * Every byte written to the terminal's stdout (`UiStreams.stdout`) alone, escapes included: with
	 * {@link CliUiTestSession.stderrWritten}, what tells a line on the wrong stream from one on the right, which the
	 * merged `transcript` and `written` cannot.
	 */
	readonly stdoutWritten: Effect.Effect<string>;
	/** Every byte written to the terminal's stderr (`UiStreams.stderr`) alone, escapes included. */
	readonly stderrWritten: Effect.Effect<string>;
	/**
	 * What the terminal's stdout alone shows now, as plain text: {@link CliUiTestSession.stdoutWritten} run through the
	 * same pipeline as {@link CliUiTestSession.transcript} (Ink's erases and clears applied, escapes stripped, trailing
	 * spaces trimmed, blank lines left out).
	 *
	 * @remarks
	 * Assert text per stream here rather than on the raw bytes, which split a painted line wherever the paint breaks
	 * (a counter's `Dry run` from its `0/2 repos`). A frame cleared on the production render path is absent from it
	 * and present in `stdoutWritten`.
	 */
	readonly stdoutTranscript: Effect.Effect<string>;
	/** What the terminal's stderr alone shows now, as plain text: {@link CliUiTestSession.stderrWritten} read as `stdoutTranscript` reads stdout. */
	readonly stderrTranscript: Effect.Effect<string>;
}

/**
 * A live view mounted by {@link CliUiTest.live}: its event stream to publish to, and its output on the production
 * render path.
 *
 * @public
 */
export interface CliUiTestLive<E, S> {
	/**
	 * Publish one event to the view's stream, then wait as a key press does: until the view draws its next frame and a
	 * short quiet follows, or 50 ms pass with nothing drawn.
	 */
	readonly publish: (event: E) => Effect.Effect<void>;
	/** End the event stream, then wait for the view to finish (`handle.done`): it dies with what the view died of. */
	readonly end: Effect.Effect<void>;
	/**
	 * Move the `TestClock` on by `duration`, which fires the view's tick, then wait as `publish` does. The test runs
	 * under `it.effect`, whose clock is a `TestClock`; under `it.live` there is no `TestClock` to move and `advance`
	 * dies, while the view's own tick runs on real time.
	 */
	readonly advance: (duration: Duration.Input) => Effect.Effect<void>;
	/** Resize the terminal, then wait as `publish` does. */
	readonly resize: (columns: number, rows: number) => Effect.Effect<void>;
	/**
	 * The last frame drawn, as token markup (see {@link CliUiTest.styled}); empty before the first.
	 *
	 * @remarks
	 * Frames are best-effort: each is the write Ink makes after a render, so a render whose output is unchanged, or
	 * empty, adds none, and a frame printed as a string (not interactive, or a degraded run) is not one. `transcript`
	 * and `written` are the authority on what reached the terminal.
	 */
	readonly frame: Effect.Effect<string>;
	/** The last frame drawn, as written: with its escape sequences. */
	readonly rawFrame: Effect.Effect<string>;
	/** The last frame drawn, as plain text. */
	readonly plainFrame: Effect.Effect<string>;
	/**
	 * The frames drawn, across every run, as token markup, oldest first: best-effort, as `frame` says (an unchanged or
	 * empty render adds none, and a printed string is not a frame); `transcript` and `written` are the authority.
	 */
	readonly frames: Effect.Effect<ReadonlyArray<string>>;
	/**
	 * What the terminal shows now, scrollback included, as plain text: every committed frame, every line logged above a
	 * frame, every frame printed as a string, and the frame drawn now, with Ink's erases and clears applied (a
	 * scrollback wipe shows as the loss of what was above the frame), each line's trailing spaces trimmed and blank
	 * lines left out. For assertions about what stays on the terminal. With `interactive: false`, the frames printed
	 * as strings show here and in `written`, and nowhere else.
	 */
	readonly transcript: Effect.Effect<string>;
	/**
	 * Every byte written to the terminal, escapes included: what to assert a sequence on, such as no `ESC[3J`
	 * (a scrollback wipe) anywhere in a run.
	 */
	readonly written: Effect.Effect<string>;
	/** The view's own handle: its `state`, its `logConsole`, `done` and `close`. */
	readonly handle: LiveHandle<S>;
}

/** The tokens, in the order their marker colours are numbered. */
const TOKENS: ReadonlyArray<TokenName> = [
	"success",
	"failure",
	"warning",
	"info",
	"error",
	"muted",
	"accent",
	"emphasis",
];

/** The marker palette: token N (1-based) paints in `#0000NN`, so a frame decodes back to the token. */
const MARKER_STYLES: Record<TokenName, Style> = Object.fromEntries(
	TOKENS.map((token, index) => [token, { fg: `#0000${(index + 1).toString(16).padStart(2, "0")}` }]),
) as Record<TokenName, Style>;

const TOKEN_BY_BLUE = new Map(TOKENS.map((token, index) => [index + 1, token] as const));

const NAMED = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"] as const;

/** The bytes a terminal in raw mode sends for each named key, as Ink's keypress parser reads them. */
const KEY_BYTES: Record<KeyName, string> = {
	up: "\u001b[A",
	down: "\u001b[B",
	right: "\u001b[C",
	left: "\u001b[D",
	enter: "\r",
	space: " ",
	tab: "\t",
	"shift+tab": "\u001b[Z",
	backspace: "\u007f",
	delete: "\u001b[3~",
	escape: "\u001b",
	"ctrl+c": "\u0003",
	home: "\u001b[H",
	end: "\u001b[F",
	pageup: "\u001b[5~",
	pagedown: "\u001b[6~",
};

// biome-ignore lint/suspicious/noControlCharactersInRegex: SGR, other CSI and OSC sequences all start with ESC
const ESCAPES = /\u001b\[([0-9;]*)m|\u001b\[[0-9;?]*[A-Za-z]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g;

const hex = (r: number, g: number, b: number): string =>
	`#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;

type Kind = "fg" | "bg" | "b" | "dim" | "i" | "u" | "inverse" | "s";

/** Decode one run of SGR parameters into markup, against the stack of open styles. */
const decodeSgr = (params: string, open: Array<{ readonly kind: Kind; readonly close: string }>): string => {
	let out = "";
	const close = (kind: Kind): void => {
		for (let index = open.length - 1; index >= 0; index--) {
			const entry = open[index];
			if (entry?.kind === kind) {
				out += entry.close;
				open.splice(index, 1);
				return;
			}
		}
	};
	const push = (kind: Kind, tag: string, closeTag: string): void => {
		if (kind === "fg" || kind === "bg") close(kind);
		out += tag;
		open.push({ kind, close: closeTag });
	};
	const colour = (kind: "fg" | "bg", codes: ReadonlyArray<number>, at: number): number => {
		if (codes[at + 1] === 2) {
			const [r, g, b] = [codes[at + 2] ?? 0, codes[at + 3] ?? 0, codes[at + 4] ?? 0];
			const token = kind === "fg" && r === 0 && g === 0 ? TOKEN_BY_BLUE.get(b) : undefined;
			if (token !== undefined) push(kind, `[${token}]`, `[/${token}]`);
			else push(kind, `[${kind}:${hex(r, g, b)}]`, `[/${kind}]`);
			return at + 4;
		}
		if (codes[at + 1] === 5) {
			push(kind, `[${kind}:ansi256(${codes[at + 2] ?? 0})]`, `[/${kind}]`);
			return at + 2;
		}
		return at;
	};
	const codes = params === "" ? [0] : params.split(";").map(Number);
	for (let at = 0; at < codes.length; at++) {
		const code = codes[at] ?? 0;
		if (code === 0) while (open.length > 0) close(open[open.length - 1]?.kind ?? "fg");
		else if (code === 1) push("b", "[b]", "[/b]");
		else if (code === 2) push("dim", "[dim]", "[/dim]");
		else if (code === 22) {
			close("dim");
			close("b");
		} else if (code === 3) push("i", "[i]", "[/i]");
		else if (code === 23) close("i");
		else if (code === 4) push("u", "[u]", "[/u]");
		else if (code === 24) close("u");
		else if (code === 7) push("inverse", "[inverse]", "[/inverse]");
		else if (code === 27) close("inverse");
		else if (code === 9) push("s", "[s]", "[/s]");
		else if (code === 29) close("s");
		else if (code >= 30 && code <= 37) push("fg", `[fg:${NAMED[code - 30]}]`, "[/fg]");
		else if (code >= 90 && code <= 97) push("fg", `[fg:${NAMED[code - 90]}Bright]`, "[/fg]");
		else if (code === 38) at = colour("fg", codes, at);
		else if (code === 39) close("fg");
		else if (code >= 40 && code <= 47) push("bg", `[bg:${NAMED[code - 40]}]`, "[/bg]");
		else if (code >= 100 && code <= 107) push("bg", `[bg:${NAMED[code - 100]}Bright]`, "[/bg]");
		else if (code === 48) at = colour("bg", codes, at);
		else if (code === 49) close("bg");
	}
	return out;
};

const styled = (ansi: string): string => {
	const open: Array<{ readonly kind: Kind; readonly close: string }> = [];
	let out = "";
	let last = 0;
	for (const match of ansi.matchAll(ESCAPES)) {
		out += ansi.slice(last, match.index);
		last = match.index + match[0].length;
		if (match[1] !== undefined) out += decodeSgr(match[1], open);
	}
	out += ansi.slice(last);
	for (let index = open.length - 1; index >= 0; index--) out += open[index]?.close ?? "";
	return out;
};

const trimLines = (text: string): string =>
	text
		.split("\n")
		.map((line) => line.trimEnd())
		.join("\n");

/**
 * Markup only this harness writes: a token tag opened and closed (`[info]…[/info]`), or a colour tag. A lone
 * `[info]` is a log prefix, and style-only tags (`[b]`, `[i]`) are too common in unrelated data, so neither is claimed.
 */
const MARKUP = new RegExp(`\\[(${TOKENS.join("|")})\\][\\s\\S]*?\\[/\\1\\]|\\[(?:fg|bg):[^\\]\\s]+\\]`);

/** Run `register`'s check on native timers, which a `TestClock` cannot hold, until it says done. */
const realTime = (poll: () => boolean): Effect.Effect<void> =>
	Effect.sync(poll).pipe(
		Effect.repeat({ until: (done) => done, schedule: Schedule.fixed("2 millis") }),
		Effect.asVoid,
		Effect.provideService(Clock.Clock, Clock.Clock.defaultValue()),
	);

/**
 * Resume once every timer already due by the wall clock has run.
 *
 * @remarks
 * A zero-delay timer set straight away is not enough: during a timers phase the loop's time is the one cached when the
 * phase began, so after a long block a new timer can count as due before an older one the wall clock says is overdue.
 * `setImmediate` runs in the check phase, after the loop has refreshed its time; a zero-delay timer set there comes due
 * after every timer already overdue, so the next timers phase runs them first.
 */
const checkPhase: Effect.Effect<void> = Effect.callback<void>((resume) => {
	const immediate = setImmediate(() => resume(Effect.void));
	return Effect.sync(() => clearImmediate(immediate));
});

const afterDueTimers: Effect.Effect<void> = Effect.andThen(
	checkPhase,
	Effect.andThen(Clock.Clock.defaultValue().sleep(Duration.millis(1)), checkPhase),
);

const QUIET_MS = 50;
const TRAILING_QUIET_MS = 8;
const ESCAPE_FLUSH_MS = 30;
const MOUNT_LIMIT_MS = 2_000;
const RERENDER_AFTER_END = "@effected/cli/ui/testing: rerender after the screen ended";
const RERENDER_BEFORE_MOUNT =
	"@effected/cli/ui/testing: rerender before the screen mounted (waited 2 s; is another screen still mounted?)";

const SCREEN_ENDED =
	"@effected/cli/ui/testing: a key was sent to a screen that has ended; take the screen mounted now with session.next()";

const NEXT_DIED = (index: number, contains: string | undefined, mounted: number, why: string): string =>
	`@effected/cli/ui/testing: next waited for screen ${index + 1} to mount and ${
		contains === undefined ? "draw" : `show "${contains}"`
	}, but ${why}; ${mounted} mounted so far`;

const NOT_A_KEY = (method: string, text: string): string =>
	`@effected/cli/ui/testing: ${method}(${JSON.stringify(text)}): ${JSON.stringify(text)} is not a key name; send text with type(${JSON.stringify(text)}) or ${method}({ char: ${JSON.stringify(text)} })`;

/** The bytes of a named key or a `{ char }`; a bare string that names no key is a defect saying how to send text. */
const bytesOf = (key: KeyName | { readonly char: string }, method: "press" | "chunk"): Effect.Effect<string> => {
	if (typeof key !== "string") return Effect.succeed(key.char);
	return Object.hasOwn(KEY_BYTES, key) ? Effect.succeed(KEY_BYTES[key]) : Effect.die(new Error(NOT_A_KEY(method, key)));
};

/** A `Cancelled` from the root entrypoint, matched by shape: this entry may carry its own copy of the class. */
const cancelledReason = (value: unknown): "escape" | "interrupt" | undefined => {
	if (typeof value !== "object" || value === null) return undefined;
	const { _tag, reason } = value as { readonly _tag?: unknown; readonly reason?: unknown };
	return _tag === "Cancelled" && (reason === "escape" || reason === "interrupt") ? reason : undefined;
};

/** One mounted screen's frames, whether it has unmounted, and the defect it died of, if it crashed. */
interface Capture {
	readonly raws: Array<string>;
	/** How this mount's writes are read: whole debug frames, or production writes with their erase moves. */
	readonly mode: "debug" | "production";
	ended: boolean;
	crash: { readonly defect: unknown } | undefined;
}

/** Synchronized-update brackets and cursor show/hide: written around a frame, never a frame themselves. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: the sequences start with ESC
const FRAME_BRACKETS = /\u001b\[\?(?:2026|25)[hl]/g;

/** A chunk of nothing but control sequences: Ink erasing its frame to write a log line above it. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: the sequences start with ESC
const CONTROLS_ONLY = /^(?:\u001b\[[0-9;?]*[A-Za-z])*$/;

/** The erase and cursor moves log-update writes before a frame; colour (SGR, `m`) is part of the frame. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: the sequences start with ESC
const LEADING_MOVES = /^(?:\u001b\[[0-9;?]*[A-Za-ln-z])+/;

/**
 * The in-memory terminal `render`, `session` and `live` share: fake streams, the environment, and a capture per mount,
 * with the settle-and-send machinery that drives a screen.
 *
 * @remarks
 * `screens` is the render path a screen mounts on; a live view always mounts on the production path. On the debug path
 * Ink writes each frame whole and the capture keeps it as written. On the production path Ink runs as it does for real:
 * each render writes its erase moves and the new frame in one write, so the capture keeps that write without its
 * moves; a write of moves alone is Ink clearing the frame for a log line, not a frame. stdout and stderr are two
 * streams, each read alone, and `fake.written` is both in the order written: one terminal, for `written` and the
 * transcript.
 */
const makeTerminal = (
	options: CliUiTestOptions,
	settings: { readonly screens: "debug" | "production" } = { screens: "debug" },
) => {
	const columns = options.columns ?? 80;
	const rows = options.rows ?? 24;
	const color = options.color ?? "truecolor";
	const captures: Array<Capture> = [];
	let lastWrite = 0;
	let frameDue = false;
	const fake = makeFakeStreams({
		columns,
		rows,
		onStdoutWrite: (chunk) => {
			lastWrite = Clock.Clock.defaultValue().currentTimeMillisUnsafe();
			const current = captures.at(-1);
			// An ended capture takes no more frames: a write after its unmount (a log line, a printed frame) is not one.
			if (!frameDue || current === undefined || current.ended) return;
			if (current.mode === "debug") {
				frameDue = false;
				current.raws.push(chunk);
				return;
			}
			const text = chunk.replace(FRAME_BRACKETS, "");
			if (text === "") return;
			frameDue = false;
			if (CONTROLS_ONLY.test(text)) return;
			current.raws.push(text.replace(LEADING_MOVES, "").replace(/\n+$/, ""));
		},
	});
	// The two streams stay apart, so each one's bytes can be read; `fake.written` is both in order, one terminal.
	const streams = fake.streams;
	const stream = { isTerminal: true, color, hyperlinks: false, columns: O.some(columns) };
	const terminal = TerminalEnv.layerTest({ stdinIsTerminal: true, stdout: stream, stderr: stream });
	const layer = Layer.mergeAll(
		CliTheme.layer({ tokens: MARKER_STYLES, glyphs: options.glyphs ?? "unicode" }).pipe(Layer.provide(terminal)),
		CliInteractive.layerTest(options.interactive ?? true),
		Layer.succeed(UiStreams, streams),
		Layer.succeed(UiRenderOptions, {
			...(settings.screens === "debug" ? { debug: true } : {}),
			// Ink throttles the production path to 30 fps, a trailing ~33 ms timer: a frame due after a settle's quiet would
			// land a throttle period after the harness read the screen, under load. At 1000 fps the throttle is 1 ms, so a
			// render is written within the settle window, for the kit's tests and every consumer's alike.
			maxFps: 1000,
			onRender: () => {
				frameDue = true;
			},
			onMount: (kind) => {
				const mode = kind === "live" ? "production" : settings.screens;
				captures.push({ raws: [], mode, ended: false, crash: undefined });
			},
			onUnmount: (crash) => {
				// The unmount's own final render can leave a frame due that it never wrote: nothing more is a frame.
				frameDue = false;
				const current = captures.at(-1);
				if (current === undefined) return;
				current.ended = true;
				current.crash = crash;
			},
		}),
	);

	/**
	 * Wait until a frame after `before` has been followed by a short quiet, so a reaction that renders twice is read
	 * whole; or, with no new frame, until quiet since the later of `since` and the last write. Never longer than
	 * `limitMs` from the first new frame once one has come, so a screen that never stops drawing still lets the wait end;
	 * counted from that frame rather than from `since`, so a loaded machine that was slow to draw it still gets the
	 * time to see the reaction that follows it.
	 */
	const settle = (
		raws: () => ReadonlyArray<string>,
		ended: () => boolean,
		before: number,
		since: number,
		limitMs = QUIET_MS,
	): Effect.Effect<void> =>
		Effect.suspend(() => {
			let firstFrameAt: number | undefined;
			const pastLimit = (now: number): boolean => firstFrameAt !== undefined && now - firstFrameAt >= limitMs;
			const quiet = realTime(() => {
				if (ended()) return true;
				const now = Clock.Clock.defaultValue().currentTimeMillisUnsafe();
				if (raws().length > before) {
					firstFrameAt ??= now;
					return now - lastWrite >= TRAILING_QUIET_MS || pastLimit(now);
				}
				return now - Math.max(since, lastWrite) >= QUIET_MS && now - since >= QUIET_MS;
			});
			// A quiet judged by a late poll is confirmed only once every timer already due has run: on a loaded machine the
			// poll can wake with a screen's own reaction timer overdue too, and fire first. A write they make keeps the wait
			// going, still bounded by `limitMs` from the first new frame.
			const confirmed: Effect.Effect<void> = Effect.flatMap(quiet, () => {
				const seen = lastWrite;
				return Effect.flatMap(afterDueTimers, () =>
					lastWrite === seen || ended() || pastLimit(Clock.Clock.defaultValue().currentTimeMillisUnsafe()) ? Effect.void : confirmed,
				);
			});
			return confirmed;
		});

	/**
	 * Drive and read the screen whose capture `capture` returns (none yet: no frames), ended when `ended` says. A crash
	 * is never swallowed: once `failed` (by default, the capture's own crash) holds a cause, every read and send dies
	 * with it, so a screen that drew nothing is never read as an empty one.
	 */
	const screen = (
		capture: () => Capture | undefined,
		ended: () => boolean,
		failed: () => Cause.Cause<unknown> | undefined = () => {
			const crash = capture()?.crash;
			return crash === undefined ? undefined : Cause.die(crash.defect);
		},
	) => {
		const surfaced = <X>(effect: Effect.Effect<X>): Effect.Effect<X> =>
			Effect.suspend(() => {
				const cause = failed();
				return cause === undefined ? effect : cause.pipe(Cause.squash, Effect.die);
			});
		const raws = (): ReadonlyArray<string> => capture()?.raws ?? [];
		const after = (before: number, since: number) => settle(raws, ended, before, since);
		const send = (bytes: string, flushMs = 0): Effect.Effect<void> =>
			Effect.suspend(() => {
				// A key for an ended screen would land in whichever screen is mounted now: a test that does that has lost
				// track of its screens, so it is a defect, not a key.
				if (ended()) return Effect.die(new Error(SCREEN_ENDED));
				const before = raws().length;
				fake.input(bytes);
				const sent = Clock.Clock.defaultValue().currentTimeMillisUnsafe();
				const flushed = flushMs === 0 ? Effect.void : realTime(() => Clock.Clock.defaultValue().currentTimeMillisUnsafe() - sent >= flushMs);
				return Effect.andThen(flushed, after(before, Clock.Clock.defaultValue().currentTimeMillisUnsafe()));
			});
		const handle: CliUiTestScreen = {
			press: (...keys) =>
				Effect.forEach(
					keys,
					(key) =>
						surfaced(
							Effect.flatMap(bytesOf(key, "press"), (bytes) => send(bytes, key === "escape" ? ESCAPE_FLUSH_MS : 0)),
						),
					{ discard: true },
				),
			type: (text) => Effect.forEach([...text], (character) => surfaced(send(character)), { discard: true }),
			chunk: (...keys) =>
				surfaced(
					Effect.flatMap(
						Effect.forEach(keys, (key) => bytesOf(key, "chunk")),
						(bytes) => send(bytes.join(""), keys.at(-1) === "escape" ? ESCAPE_FLUSH_MS : 0),
					),
				),
			resize: (nextColumns, nextRows) =>
				surfaced(
					Effect.suspend(() => {
						const before = raws().length;
						const since = Clock.Clock.defaultValue().currentTimeMillisUnsafe();
						fake.resize(nextColumns, nextRows);
						return after(before, since);
					}),
				),
			frame: surfaced(Effect.sync(() => trimLines(styled(raws().at(-1) ?? "")))),
			rawFrame: surfaced(Effect.sync(() => raws().at(-1) ?? "")),
			plainFrame: surfaced(Effect.sync(() => trimLines((raws().at(-1) ?? "").replace(ESCAPES, "")))),
			frames: surfaced(Effect.sync(() => raws().map((raw) => trimLines(styled(raw))))),
		};
		return { handle, raws, after, surfaced };
	};

	return { fake, layer, captures, screen, settle };
};

/**
 * Mount `screen` on a fresh terminal for the enclosing scope, held in a swappable holder so a rerender changes only its
 * subtree under the same control: what `render` and `view` share. Ready once the first frame is drawn, the screen has
 * ended, or 2 s have passed. A crash surfaces on every read and send, as on a session's screen; with `refusal`, so does
 * a run refused as not interactive, for a view, which has no `result` to carry it.
 */
const mount = Effect.fn("mount")(function*<A> (screen: Screen<A>, options: CliUiTestOptions, refusal: boolean) {
		const terminal = makeTerminal(options);
		let ended = false;
		// How the run ended when it failed or died (a crash, `NotInteractive`), never for the scope's own interrupt nor a
		// deliberate end (Esc or Ctrl-C, a `Cancelled`), after which the frames stay readable and a key is SCREEN_ENDED.
		let failure: Cause.Cause<unknown> | undefined;
		const slot = holderSlot();
		let control: ScreenControl<A> | undefined;
		const held: Screen<A> = (given) => {
			control = given;
			return Promise.resolve(screen(given)).then((initial) => inkModules().react.createElement(holder(), { initial, bind: slot.bind }));
		};
		const fiber = yield* Effect.forkScoped(
			CliUi.run(held).pipe(
				(self) => Effect.scopedWith((scope) => Effect.flatMap(Layer.buildWithScope(terminal.layer, scope), (context) => Effect.provideContext(self, context))),
				Effect.onExit((exit) =>
					Effect.sync(() => {
						ended = true;
						// A defect is a failure even beside a `Cancelled`: a crash in the same tick as a cancel wins.
						if (
							Exit.isFailure(exit) &&
							!Cause.hasInterruptsOnly(exit.cause) &&
							(exit.cause.reasons.some(Cause.isDieReason) || exit.cause.pipe(Cause.squash, cancelledReason) === undefined)
						) {
							failure = exit.cause;
						}
					}),
				),
			),
		);
		// One screen per mount: its capture is the first, and it has ended when the run has.
		const { handle, raws, after, surfaced } = terminal.screen(
			() => terminal.captures[0],
			() => ended,
			refusal ? () => failure : undefined,
		);
		const mountedBy = Clock.Clock.defaultValue().currentTimeMillisUnsafe() + MOUNT_LIMIT_MS;
		yield* realTime(() => raws().length > 0 || ended || Clock.Clock.defaultValue().currentTimeMillisUnsafe() >= mountedBy);
		yield* after(0, Clock.Clock.defaultValue().currentTimeMillisUnsafe());
		const swapTo = (next: Screen<A>): Effect.Effect<void> =>
			Effect.gen(function* () {
				// Bounded like the first frame: a handle queued behind another screen may never mount here.
				const mountedBy = Clock.Clock.defaultValue().currentTimeMillisUnsafe() + MOUNT_LIMIT_MS;
				yield* realTime(() => slot.isBound() || ended || Clock.Clock.defaultValue().currentTimeMillisUnsafe() >= mountedBy);
				if (ended) return yield* Effect.die(new Error(RERENDER_AFTER_END));
				if (!slot.isBound() || control === undefined) {
					return yield* Effect.die(new Error(RERENDER_BEFORE_MOUNT));
				}
				const given = control;
				const element = yield* Effect.promise(() => Promise.resolve(next(given)));
				const before = raws().length;
				const since = Clock.Clock.defaultValue().currentTimeMillisUnsafe();
				// The screen ended while the element was built (unbound: it is unmounting). Wait for the end to be
				// recorded, so a screen that crashed reports its crash rather than having ended.
				if (ended || !slot.swap(element)) {
					const endedBy = Clock.Clock.defaultValue().currentTimeMillisUnsafe() + MOUNT_LIMIT_MS;
					yield* realTime(() => ended || Clock.Clock.defaultValue().currentTimeMillisUnsafe() >= endedBy);
					return yield* surfaced(Effect.die(new Error(RERENDER_AFTER_END)));
				}
				yield* after(before, since);
			});
		// A rerender that crashes dies with the crash, never with "rerender after the screen ended".
		const rerender = (next: Screen<A>): Effect.Effect<void> =>
			surfaced(Effect.andThen(swapTo(next), surfaced(Effect.void)));
		return { handle, rerender, fiber, surfaced };
	});

/** A `Console` that keeps what is written: `log`, `info` and `debug` as stdout, `error`, `warn` and `trace` as stderr. */
const capturingConsole = (ambient: Console.Console) => {
	const out: Array<string> = [];
	const err: Array<string> = [];
	const line =
		(sink: Array<string>) =>
		(...args: ReadonlyArray<unknown>): void => {
			// Formatted as data, as a console would show it: an object as JSON, never "[object Object]".
			sink.push(`${args.map((arg) => Inspectable.toStringUnknown(arg, 0)).join(" ")}\n`);
		};
	// Over the ambient Console, so every method this does not keep still behaves as it did.
	const writer: Console.Console = Object.assign(Object.create(ambient) as Console.Console, {
		log: line(out),
		info: line(out),
		debug: line(out),
		error: line(err),
		warn: line(err),
		trace: line(err),
	});
	return { writer, out, err };
};

/**
 * Drive and read Ink screens in tests: mount a screen on in-memory streams, press keys, and read its frames as token
 * markup.
 *
 * @example
 * ```ts
 * import { assert, it } from "@effect/vitest"
 * import { Select } from "../../ui.ts"
 * import { CliUiTest } from "../../ui-testing.ts"
 * import { Effect } from "effect"
 *
 * it.effect("chooses the second option", () =>
 *   Effect.gen(function* () {
 *     const choices = [
 *       { label: "a", value: "a" },
 *       { label: "b", value: "b" },
 *     ]
 *     const handle = yield* CliUiTest.render(Select.screen({ message: "Pick one", choices }))
 *     yield* handle.press("down", "enter")
 *     assert.strictEqual(yield* handle.result, "b")
 *   }).pipe(Effect.scoped),
 * )
 * ```
 *
 * @public
 */
export class CliUiTest {
	private constructor() {}

	/**
	 * Mount `screen` on in-memory terminal streams for the enclosing scope.
	 *
	 * @remarks
	 * The screen runs under a fixed environment: a `TerminalEnv` test layer with the given columns and colour, a
	 * `CliTheme` whose every token paints in its own marker colour (so frames do not depend on the real palette), and
	 * `CliInteractive` set from `interactive`. Ink renders in debug mode, writing every frame in full; the frames
	 * are taken from those writes. Closing the scope unmounts the screen. The returned handle is ready once the first
	 * frame is drawn or the screen has ended.
	 *
	 * Waiting is on real time, through native timers a `TestClock` cannot hold, so the harness's own waits work under
	 * `it.effect` and `it.live` alike, and never sleep longer than 50 ms past the last write (30 ms first, for Esc). A
	 * screen test that itself sleeps, times out or retries on a schedule needs `it.live` (or real timers): under
	 * `it.effect` those run on the `TestClock`, which nothing advances while a screen waits on real time.
	 *
	 * The first frame is awaited for at most 2 s: a screen that draws nothing for longer gives a handle whose `frames`
	 * is `[]`. Screens run one at a time process-wide (`CliUi.run`), so a second handle opened while another is
	 * still mounted waits for that mount: it returns at the 2 s cap with no frames, and its keys queue in its input until
	 * it mounts.
	 *
	 * Debug frames bypass Ink's erase-and-redraw path, so a harness frame says nothing about what Ink writes between
	 * frames on a real terminal (a screen clear, for instance), nor about the final frame left in the scrollback once
	 * the screen ends (answered screens stay); a test of that needs the production render path.
	 * For the same reason `CliUi.run`'s `clear` has no visible effect on a harness frame, since Ink's `clear` does
	 * nothing in debug mode: test `clear` with `session({ renderPath: "production" })` and its `transcript`.
	 * Unmounting is the scope's close; to draw a different screen, render it in a new scope.
	 *
	 * A crash is never swallowed. A screen thunk that throws (a classic-JSX `React is not defined` included) or a
	 * component that throws ends the run with a defect: `result` dies with it, and so does the next frame read, key,
	 * resize or rerender, so a crashed screen is never read as one that drew nothing. As with `view`, after a crash
	 * the frames drawn before it cannot be read. A run refused as not interactive is `result`'s `NotInteractive`, and
	 * its frames read as `[]`.
	 *
	 * @param screen - the screen to mount
	 * @param options - the terminal's size, colour and glyphs, and whether the run is interactive
	 */
	static readonly render = <A>(
		screen: Screen<A>,
		options: CliUiTestOptions = {},
	): Effect.Effect<CliUiTestHandle<A>, never, Scope.Scope> =>
		Effect.map(mount(screen, options, false), ({ handle, rerender, fiber }) => ({
			...handle,
			rerender,
			result: Fiber.join(fiber),
		}));

	/**
	 * Mount a display-only element on in-memory terminal streams for the enclosing scope: a status line, a live view,
	 * a component a consumer mounts in an Ink tree of its own.
	 *
	 * @remarks
	 * The same harness as {@link CliUiTest.render}, with the same options: the marker-palette theme, the fake streams
	 * and the debug frames, and the element is drawn inside the kit's providers, so `useTheme`, `useGlyphs`,
	 * `useTerminalSize` and `Styled` work in it. The handle reads frames and sends keys as a rendered screen's does, and
	 * `rerender` swaps in another element, but it has no `result`: a display-only element never ends on its own, so a
	 * `render` of one would leave `result` waiting forever. Closing the scope unmounts it.
	 *
	 * The kit's root keys stay bound, as on every screen: Esc or Ctrl-C ends the view, after which a key or a rerender
	 * is a defect.
	 *
	 * An element that crashes, or a run that is refused (`interactive: false` ends it with `NotInteractive`), is never
	 * swallowed: `view` dies with that error when it happens before the first frame, and otherwise the next frame read,
	 * key, resize or rerender does. After a crash every read dies with it, `frames` included, so the frames drawn before
	 * the crash cannot be read: the crash is the signal a test needs. A deliberate end (Esc or Ctrl-C) is not a crash:
	 * the frames stay readable, and only a key, resize or rerender after it dies, saying the screen has ended.
	 *
	 * @param element - the element to mount
	 * @param options - the terminal's size, colour and glyphs, and whether the run is interactive
	 */
	static readonly view = (
		element: ReactElement,
		options: CliUiTestOptions = {},
	): Effect.Effect<CliUiTestView, never, Scope.Scope> =>
		Effect.flatMap(
			mount<never>(() => element, options, true),
			({ handle, rerender, surfaced }) => {
				// A view has no `result` to re-raise how its run ended, so a crash or a refusal also surfaces at the mount.
				const view: CliUiTestView = { ...handle, rerender: (next) => rerender(() => next) };
				return surfaced(Effect.succeed(view));
			},
		);

	/**
	 * A terminal for a whole program that runs screens of its own (a wizard, a handler calling `CliUi.prompt` several
	 * times): provide its `layer` around the program, then take each screen as it mounts with `next`.
	 *
	 * @remarks
	 * The same environment and the same waiting as {@link CliUiTest.render}, with the same options. The session also
	 * keeps what the program writes through `Console`, its own output beside the screens, as `stdout` and `stderr`.
	 *
	 * Run the program forked (`Effect.forkScoped`) and drive it from the test: `next` returns each screen once it has
	 * mounted and drawn, `press` and `type` settle as they do on a rendered screen, and joining the program's fiber
	 * gives its exit. Screens still run one at a time, process-wide, so `next` sees them in the order they mount.
	 *
	 * By default, as with `render`, a screen run with `clear` leaves its frames unchanged here: Ink renders screens in
	 * debug mode, where its `clear` does nothing. Pass `renderPath: "production"` to render them as a terminal does, and
	 * read `transcript` to see what stays on it: a cleared screen leaves nothing there. A live view a handler mounts
	 * (`CliUi.live`) always renders on the production path, and the lines it writes above its frame through
	 * `handle.logConsole` are in `transcript` and `written`.
	 * The waits are real time: a session test that itself sleeps or times out needs `it.live`. To assert that no screen
	 * mounted (a non-interactive run, a flag that skips a prompt), check that `mounts` is `0` once the program has
	 * finished.
	 *
	 * A screen that crashes (its thunk or a component throws) is never swallowed: `next` dies with the crash when it has
	 * happened by then, whatever `contains` waited for, and otherwise the screen's next frame read, key or resize does.
	 * The program's own fiber dies with it too.
	 *
	 * Driving a whole `Command` handler: provide `layer`, a fresh `CliExit.layer` if the handler records a code, a
	 * `ConfigProvider` that sandboxes what the handler reads (`HOME`, the XDG directories), and the platform core's
	 * runner needs, then fork the program and take each screen with `next`:
	 *
	 * ```ts
	 * const session = yield* CliUiTest.session()
	 * const program = Effect.gen(function* () {
	 *   yield* Command.runWith(root, { version })(["init"])
	 *   return MutableRef.get((yield* CliExit).code)
	 * }).pipe(
	 *   Effect.provide(session.layer),
	 *   Effect.provide(CliExit.layer),
	 *   Effect.provide(NodeServices.layer),
	 *   Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ HOME: "/sandbox/home" })),
	 * )
	 * const fiber = yield* Effect.forkScoped(program)
	 * yield* (yield* session.next({ contains: "Profile" })).press("enter")
	 * const code = yield* Fiber.join(fiber)
	 * ```
	 *
	 * To exercise `CliRuntime.main` as well (its failure report and exit code), run the program through it with the
	 * session's layer provided around it instead; `main` provides its own `CliExit`.
	 *
	 * @param options - the terminal's size, colour and glyphs, whether the run is interactive, and the screens' render path
	 */
	static readonly session = (
		options: CliUiTestSessionOptions = {},
	): Effect.Effect<CliUiTestSession, never, Scope.Scope> =>
		Effect.map(Console.Console, (ambient) => {
			const { renderPath, ...terminalOptions } = options;
			const terminal = makeTerminal(terminalOptions, { screens: renderPath ?? "debug" });
			const output = capturingConsole(ambient);
			let taken = 0;
			const next = (nextOptions: CliUiTestNextOptions = {}): Effect.Effect<CliUiTestScreen> =>
				Effect.gen(function* () {
					const index = taken++;
					const { contains } = nextOptions;
					const capture = () => terminal.captures[index];
					const { handle, raws, after, surfaced } = terminal.screen(capture, () => capture()?.ended ?? false);
					const shows = (): boolean =>
						contains === undefined
							? raws().length > 0
							: raws().some((raw) => raw.replace(ESCAPES, "").includes(contains));
					const by = Clock.Clock.defaultValue().currentTimeMillisUnsafe() + MOUNT_LIMIT_MS;
					yield* realTime(() => shows() || capture()?.ended === true || Clock.Clock.defaultValue().currentTimeMillisUnsafe() >= by);
					// A screen that crashed dies with its crash, whatever `next` waited for.
					yield* surfaced(Effect.void);
					if (!shows()) {
						const why =
							capture() === undefined
								? "none mounted within 2 s"
								: capture()?.ended === true
									? "it unmounted first"
									: "it did not within 2 s";
						return yield* Effect.die(new Error(NEXT_DIED(index, contains, terminal.captures.length, why)));
					}
					yield* after(0, Clock.Clock.defaultValue().currentTimeMillisUnsafe());
					return handle;
				});
			return {
				layer: Layer.merge(terminal.layer, Layer.succeed(Console.Console, output.writer)),
				next,
				mounts: Effect.sync(() => terminal.captures.length),
				stdout: Effect.sync(() => output.out.join("")),
				stderr: Effect.sync(() => output.err.join("")),
				transcript: Effect.sync(() =>
					screenAfter(terminal.fake.written(), terminal.fake.streams.stdout.rows).join("\n"),
				),
				written: Effect.sync(() => terminal.fake.written()),
				stdoutWritten: Effect.sync(() => terminal.fake.stdout()),
				stderrWritten: Effect.sync(() => terminal.fake.stderr()),
				stdoutTranscript: Effect.sync(() =>
					screenAfter(terminal.fake.stdout(), terminal.fake.streams.stdout.rows).join("\n"),
				),
				stderrTranscript: Effect.sync(() =>
					screenAfter(terminal.fake.stderr(), terminal.fake.streams.stdout.rows).join("\n"),
				),
			} satisfies CliUiTestSession;
		});

	/**
	 * Mount a live view (`CliUi.live`) on a fresh in-memory terminal for the enclosing scope, with an event stream the
	 * test publishes to, and read what it draws on the production render path.
	 *
	 * @remarks
	 * The options are `CliUi.live`'s without `events`, which the harness supplies, and the terminal's own (`columns`,
	 * `rows`, `color`, `glyphs`, `interactive`). The view runs as it does for real: Ink is interactive and not in debug
	 * mode, so frames are what Ink actually writes, committed frames stay on the terminal, and `transcript` shows what is
	 * left there, scrollback included, through a small terminal model (it does not wrap a line wider than the terminal).
	 * stderr is the same stream as stdout, as on a terminal, so a line logged through `handle.logConsole` lands in the
	 * transcript too.
	 *
	 * Write live tests with `it.effect`: the view's tick runs on the `TestClock`, so `advance` (or `TestClock.adjust`)
	 * drives it frame by frame, and the frame index is `floor(now / tickMillis)` from the clock's epoch. The waits after
	 * `publish`, `advance` and `resize` are real time, which the `TestClock` does not hold. Without `@effect/vitest`'s
	 * `it.effect`, provide the clock yourself: `Effect.provide(test, TestClock.layer())` (from `effect/testing`).
	 *
	 * @example
	 * ```ts
	 * import { assert, it } from "@effect/vitest"
	 * import { CliUiTest } from "../../ui-testing.ts"
	 * import { Effect } from "effect"
	 * import { Text } from "ink"
	 * import { createElement } from "react"
	 *
	 * type Event = { readonly _tag: "RunStarted" } | { readonly _tag: "RunEnded" }
	 *
	 * it.effect("turns the spinner on the tick", () =>
	 *   Effect.gen(function* () {
	 *     const view = yield* CliUiTest.live({
	 *       initial: 0,
	 *       reduce: (count: number, _event: Event) => count + 1,
	 *       render: (_count, frame) => createElement(Text, null, `frame ${frame}`),
	 *       isStart: (event) => event._tag === "RunStarted",
	 *       isTerminal: (event) => event._tag === "RunEnded",
	 *     })
	 *     yield* view.publish({ _tag: "RunStarted" })
	 *     // The clock starts at 0 and the tick is 80 ms, so 160 ms on is frame 2.
	 *     yield* view.advance("160 millis")
	 *     assert.include(yield* view.plainFrame, "frame 2")
	 *   }).pipe(Effect.scoped),
	 * )
	 * ```
	 *
	 * @param options - the live view's options without `events`, and the terminal's size, colour, glyphs and
	 * interactivity
	 */
	static readonly live = <E, S>(
		options: Omit<LiveOptions<E, S>, "events"> & CliUiTestOptions,
	): Effect.Effect<CliUiTestLive<E, S>, never, Scope.Scope> =>
		Effect.gen(function* () {
			const { columns, rows, color, glyphs, interactive, ...view } = options;
			const terminal = makeTerminal(
				{
					...(columns === undefined ? {} : { columns }),
					...(rows === undefined ? {} : { rows }),
					...(color === undefined ? {} : { color }),
					...(glyphs === undefined ? {} : { glyphs }),
					...(interactive === undefined ? {} : { interactive }),
				},
				{ screens: "production" },
			);
			const queue = yield* Queue.unbounded<E, Cause.Done>();
			const handle = yield* CliUi.live<E, S>({ ...view, events: Stream.fromQueue(queue) }).pipe(
				(self) => Effect.scopedWith((scope) => Effect.flatMap(Layer.buildWithScope(terminal.layer, scope), (context) => Effect.provideContext(self, context))),
			);
			const raws = (): ReadonlyArray<string> => terminal.captures.flatMap((capture) => capture.raws);
			const settled = <X>(effect: Effect.Effect<X>): Effect.Effect<void> =>
				Effect.suspend(() => {
					const before = raws().length;
					const since = Clock.Clock.defaultValue().currentTimeMillisUnsafe();
					return Effect.andThen(
						effect,
						terminal.settle(raws, () => false, before, since),
					);
				});
			const last = (): string => raws().at(-1) ?? "";
			return {
				publish: (event) => settled(Queue.offer(queue, event)),
				end: Effect.andThen(Queue.end(queue), handle.done),
				advance: (duration) => settled(TestClock.adjust(duration)),
				resize: (nextColumns, nextRows) => settled(Effect.sync(() => terminal.fake.resize(nextColumns, nextRows))),
				frame: Effect.sync(() => trimLines(styled(last()))),
				rawFrame: Effect.sync(last),
				plainFrame: Effect.sync(() => trimLines(last().replace(ESCAPES, ""))),
				frames: Effect.sync(() => raws().map((raw) => trimLines(styled(raw)))),
				transcript: Effect.sync(() =>
					screenAfter(terminal.fake.written(), terminal.fake.streams.stdout.rows).join("\n"),
				),
				written: Effect.sync(() => terminal.fake.written()),
				handle,
			};
		});

	/**
	 * Why a screen or a program was cancelled, read from its `Exit` or `Cause`: `"escape"` or `"interrupt"` when it
	 * carries a `Cancelled`, as a typed failure or as a defect, else `None`.
	 *
	 * @remarks
	 * Pure. A screen's `result` fails with `Cancelled` in the typed channel; a prompt cancelled where the program
	 * declares no such error carries it as a defect. Either way a test asks this instead of walking `cause.reasons`:
	 *
	 * ```ts
	 * const exit = yield* Fiber.await(program)
	 * assert.deepStrictEqual(CliUiTest.cancelReason(exit), Option.some("escape"))
	 * ```
	 *
	 * @param exitOrCause - the exit of a screen's `result` or of a program, or a bare cause
	 */
	static readonly cancelReason = (
		exitOrCause: Exit.Exit<unknown, unknown> | Cause.Cause<unknown>,
	): O.Option<"escape" | "interrupt"> => {
		const cause = Exit.isExit(exitOrCause)
			? Exit.isFailure(exitOrCause)
				? exitOrCause.cause
				: undefined
			: exitOrCause;
		for (const reason of cause?.reasons ?? []) {
			const found = cancelledReason(
				reason._tag === "Fail" ? reason.error : reason._tag === "Die" ? reason.defect : undefined,
			);
			if (found !== undefined) return O.some(found);
		}
		return O.none();
	};

	/**
	 * Decode ANSI back to markup: a marker colour to its token (`[success]…[/success]`), any other foreground to
	 * `[fg:red]` or `[fg:#ff0000]` (backgrounds likewise as `[bg:…]`), bold to `[b]`, dim to `[dim]`, italic, underline,
	 * inverse and strikethrough to `[i]`, `[u]`, `[inverse]` and `[s]`. A reset closes everything open; every other
	 * escape (cursor, erase, hyperlinks) is dropped.
	 *
	 * @param ansi - text with escapes
	 */
	static readonly styled: (ansi: string) => string = styled;

	/**
	 * A Vitest snapshot serializer. It claims a string carrying escapes, a token tag opened and closed, or a colour
	 * tag (a raw or styled frame, or a `Render.ansi` string), but not a log line's lone `[info]` prefix, nor one whose
	 * only brackets are style tags like `[b]`, which unrelated data uses too. It prints the string as token markup with
	 * each line's trailing spaces trimmed, so a snapshot reads without escapes and does not churn with the palette.
	 *
	 * @remarks
	 * Register it in either of two ways. Through the Vitest config, by the module whose default export it is, which
	 * needs no code in a test file:
	 *
	 * ```ts
	 * // vitest.config.ts
	 * export default defineConfig({ test: { snapshotSerializers: ["@effected/cli/ui/testing/serializer"] } })
	 * ```
	 *
	 * Or in a test file, with `expect.addSnapshotSerializer(CliUiTest.serializer)`.
	 *
	 * Snapshots are the one place a test needs `expect`: `assert` has no snapshot form, so a suite that asserts with
	 * `assert.*` everywhere else still writes `expect(frame).toMatchInlineSnapshot(...)` for a snapshot.
	 */
	static readonly serializer: {
		readonly test: (value: unknown) => boolean;
		readonly serialize: (value: unknown) => string;
	} = {
		test: (value) => typeof value === "string" && (value.includes("\u001b") || MARKUP.test(value)),
		serialize: (value) => trimLines(styled(String(value))),
	};
}
