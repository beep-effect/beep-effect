// Ported from std-osc8 v0.2.0 (MIT, C. Spencer Beggs), src/detect.ts. Pure: no process reads.
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { dual } from "effect/Function";
import type { Env } from "../types.ts";
import { envIsTruthy } from "./env.ts";
import { compareSemver } from "./semver.ts";
import type { KnownTerminal, Osc8Capabilities, TerminalMatch } from "./terminals.ts";
import { NO_CAPS, lookupTerminal } from "./terminals.ts";
import type { WrapperInfo } from "./wrappers.ts";
import { detectWrapper } from "./wrappers.ts";

const $I = $ScratchpadId.create("effected/env/internal/osc8/detect");

/**
 * Explains why detection produced its verdict; the discriminator on {@link Osc8Info}.
 *
 * **Example** (Validate a detection reason)
 *
 * ```ts
 * import { Osc8Reason } from "@beep/scratchpad/effected/env/internal/osc8/detect";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(Osc8Reason)("not-a-tty")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Osc8Reason = LiteralKit([
	"force-env",
	"no-hyperlink-env",
	"no-color-env",
	"not-a-tty",
	"wrapper-strips",
	"terminal-known-supported",
	"terminal-known-unsupported",
	"terminal-known-too-old",
	"terminal-unknown",
]).annotate($I.annote("Osc8Reason", { description: "Why detection produced its verdict. The discriminator on Osc8Info." }));
/**
 * Reason literal accepted by the {@link Osc8Reason} schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Osc8Reason = typeof Osc8Reason.Type;

/**
 * Carries the full diagnostic record {@link detect} produces.
 *
 * @category models
 * @since 0.0.0
 */
export interface Osc8Info {
	/**
	 * Final boolean verdict for stdout.
	 *
	 * @since 0.0.0
	 */
	readonly supported: boolean;
	/**
	 * Final boolean verdict for stderr.
	 *
	 * @since 0.0.0
	 */
	readonly supportedForStderr: boolean;
	/**
	 * Discriminated reason for the stdout verdict.
	 *
	 * @since 0.0.0
	 */
	readonly reason: Osc8Reason;
	/**
	 * Human-readable summary, useful for logging.
	 *
	 * @since 0.0.0
	 */
	readonly explanation: string;
	/**
	 * Detected terminal program, if matched against the allowlist.
	 *
	 * @since 0.0.0
	 */
	readonly terminal: KnownTerminal | null;
	/**
	 * Raw env value used to identify the terminal.
	 *
	 * @since 0.0.0
	 */
	readonly terminalRaw: string | null;
	/**
	 * Detected terminal version, if available.
	 *
	 * @since 0.0.0
	 */
	readonly terminalVersion: string | null;
	/**
	 * Multiplexer info, if inside one.
	 *
	 * @since 0.0.0
	 */
	readonly wrapper: WrapperInfo | null;
	/**
	 * Whether stdout is a TTY at detection time.
	 *
	 * @since 0.0.0
	 */
	readonly isStdoutTTY: boolean;
	/**
	 * Whether stderr is a TTY at detection time.
	 *
	 * @since 0.0.0
	 */
	readonly isStderrTTY: boolean;
	/**
	 * Which override produced the verdict, if any.
	 *
	 * @since 0.0.0
	 */
	readonly override: "force-hyperlink" | "no-hyperlink" | "no-color" | null;
	/**
	 * Sub-feature capabilities of the detected terminal.
	 *
	 * @since 0.0.0
	 */
	readonly capabilities: Osc8Capabilities;
}

/**
 * Input to the pure {@link detect} function. Snapshot of the relevant slice of
 * `process` at one moment.
 *
 * **Example** (Construct a snapshot with piped streams)
 *
 * ```ts
 * import { ProcessSnapshot } from "@beep/scratchpad/effected/env/internal/osc8/detect";
 *
 * const snapshot = ProcessSnapshot.make({ env: {}, isStdoutTTY: false, isStderrTTY: false });
 * console.log(snapshot.isStdoutTTY) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ProcessSnapshot = S.Struct({
	env: S.Record(S.String, S.UndefinedOr(S.String)).pipe($I.annoteKey("ProcessSnapshot.env", { description: "Environment variable names mapped to strings or undefined." })),
	isStdoutTTY: S.Boolean.pipe($I.annoteKey("ProcessSnapshot.isStdoutTTY", { description: "Whether stdout is a TTY at detection time." })),
	isStderrTTY: S.Boolean.pipe($I.annoteKey("ProcessSnapshot.isStderrTTY", { description: "Whether stderr is a TTY at detection time." })),
}).annotate($I.annote("ProcessSnapshot", { description: "Input to the pure detect function: a snapshot of the relevant process state." }));
/**
 * Process state accepted by the {@link ProcessSnapshot} schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProcessSnapshot = typeof ProcessSnapshot.Type;

const explanationFor = (
	reason: Osc8Reason,
	terminal: KnownTerminal | null,
	terminalVersion: string | null,
	wrapper: WrapperInfo | null,
): string => Osc8Reason.$match(reason, {
	"force-env": () => "FORCE_HYPERLINK env var is set",
	"no-hyperlink-env": () => "NO_HYPERLINK env var is set",
	"no-color-env": () => "NO_COLOR env var is set",
	"not-a-tty": () => "stdout is not a TTY",
	"wrapper-strips": () => `inside ${wrapper?.name ?? "wrapper"}; passthrough not verifiable without subprocess`,
	"terminal-known-supported": () => `detected ${terminal}${terminalVersion !== null && terminalVersion !== "" ? ` ${terminalVersion}` : ""}`,
	"terminal-known-unsupported": () => `detected ${terminal}; terminal does not support OSC8`,
	"terminal-known-too-old": () => `detected ${terminal} ${terminalVersion ?? ""}; below minimum version`,
	"terminal-unknown": () => "no identifying signal matched",
});

/** Outcome of running the precedence gate for a single stream's TTY state. */
interface Gate {
	readonly supported: boolean;
	readonly reason: Osc8Reason;
	readonly override: Osc8Info["override"];
}

/**
 * Run the 7-rule precedence ladder for a single stream's TTY state.
 * Shared by stdout and stderr so the two paths cannot drift.
 */
const evaluateGate = (
	isTTY: boolean,
	force: boolean,
	noHyperlink: boolean,
	noColor: boolean,
	wrapper: WrapperInfo | null,
	match: TerminalMatch | null,
): Gate => {
	if (force) return { supported: true, reason: "force-env", override: "force-hyperlink" };
	if (noHyperlink) return { supported: false, reason: "no-hyperlink-env", override: "no-hyperlink" };
	if (noColor) return { supported: false, reason: "no-color-env", override: "no-color" };
	if (!isTTY) return { supported: false, reason: "not-a-tty", override: null };
	if (wrapper !== null) return { supported: false, reason: "wrapper-strips", override: null };
	if (match === null) return { supported: false, reason: "terminal-unknown", override: null };
	if (!match.entry.supported) return { supported: false, reason: "terminal-known-unsupported", override: null };
	if (
		match.entry.minVersion !== null && match.entry.minVersion !== "" &&
		(match.identify.version === null || compareSemver(match.identify.version, match.entry.minVersion) < 0)
	) {
		return { supported: false, reason: "terminal-known-too-old", override: null };
	}
	return { supported: true, reason: "terminal-known-supported", override: null };
};

/**
 * Determine OSC8 support from a process snapshot. Pure: same input ⇒ same
 * output.
 *
 * **Example** (Explain a non-TTY verdict)
 *
 * ```ts
 * import { detect } from "@beep/scratchpad/effected/env/internal/osc8/detect";
 *
 * const info = detect({ env: {}, isStdoutTTY: false, isStderrTTY: false });
 * console.log(info.reason) // not-a-tty
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const detect = (snap: ProcessSnapshot): Osc8Info => {
	const { env, isStdoutTTY, isStderrTTY } = snap;
	const wrapper = detectWrapper(env);

	const force = envIsTruthy(env.FORCE_HYPERLINK, "default");
	const noHyperlink = envIsTruthy(env.NO_HYPERLINK, "default");
	const noColor = envIsTruthy(env.NO_COLOR, "no-color");

	const match: TerminalMatch | null = lookupTerminal(env);
	const terminal: KnownTerminal | null = match?.entry.name ?? null;
	const terminalRaw = match?.identify.rawIdentifier ?? null;
	const terminalVersion = match?.identify.version ?? null;

	const stdout = evaluateGate(isStdoutTTY, force, noHyperlink, noColor, wrapper, match);
	const stderr = evaluateGate(isStderrTTY, force, noHyperlink, noColor, wrapper, match);

	// Capabilities are an intrinsic property of the detected terminal — not
	// gated by stream TTY state. A piped stdout still tells us the terminal
	// has params support; the gate decides whether to USE them. Without
	// this decoupling, callers targeting stderr would see params silently
	// dropped whenever stdout happens to be piped.
	const capabilities: Osc8Capabilities = match?.entry.capabilities ?? NO_CAPS;

	return {
		supported: stdout.supported,
		supportedForStderr: stderr.supported,
		reason: stdout.reason,
		explanation: explanationFor(stdout.reason, terminal, terminalVersion, wrapper),
		terminal,
		terminalRaw,
		terminalVersion,
		wrapper,
		isStdoutTTY,
		isStderrTTY,
		override: stdout.override,
		capabilities,
	};
};

/**
 * Projects {@link Osc8Info} into the package surface: per-stream verdicts plus the identified terminal.
 *
 * **Example** (Validate per-stream verdicts without a terminal)
 *
 * ```ts
 * import { Osc8Detection } from "@beep/scratchpad/effected/env/internal/osc8/detect";
 * import * as O from "effect/Option";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(Osc8Detection)({ stdout: false, stderr: false, terminal: O.none() })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Osc8Detection = S.Struct({
	stdout: S.Boolean.pipe($I.annoteKey("Osc8Detection.stdout", { description: "Final OSC8 verdict for stdout." })),
	stderr: S.Boolean.pipe($I.annoteKey("Osc8Detection.stderr", { description: "Final OSC8 verdict for stderr." })),
	terminal: S.Option(S.Struct({
		name: S.String.pipe($I.annoteKey("Osc8Detection.terminal.name", { description: "The identified terminal program." })),
		version: S.Option(S.String).pipe($I.annoteKey("Osc8Detection.terminal.version", { description: "The terminal version, when available." })),
	}).annotate($I.annote("Osc8Detection.terminal", { description: "The identified terminal program and optional version." }))).pipe($I.annoteKey("Osc8Detection.terminal", { description: "The identified terminal, when available." })),
}).annotate($I.annote("Osc8Detection", { description: "Per-stream OSC8 verdicts plus the identified terminal." }));
/**
 * Per-stream verdicts and optional terminal represented by {@link Osc8Detection}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Osc8Detection = typeof Osc8Detection.Type;

/**
 * Project {@link detect} onto {@link Osc8Detection}: `supported` becomes
 * `stdout`, `supportedForStderr` becomes `stderr`, and the terminal name and
 * version become an `Option`.
 *
 * **Example** (Force hyperlinks for both piped streams)
 *
 * ```ts
 * import { detectOsc8 } from "@beep/scratchpad/effected/env/internal/osc8/detect";
 *
 * const detection = detectOsc8({ FORCE_HYPERLINK: "1" }, false, false);
 * console.log(detection.stdout && detection.stderr) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const detectOsc8: {
	(isStdoutTTY: boolean, isStderrTTY: boolean): (env: Env) => Osc8Detection;
	(env: Env, isStdoutTTY: boolean, isStderrTTY: boolean): Osc8Detection;
} = dual(3, (env: Env, isStdoutTTY: boolean, isStderrTTY: boolean): Osc8Detection => {
	const info = detect({ env, isStdoutTTY, isStderrTTY });
	return {
		stdout: info.supported,
		stderr: info.supportedForStderr,
		terminal: O.map(O.fromNullishOr(info.terminal), (name) => ({
			name,
			version: O.fromNullishOr(info.terminalVersion),
		})),
	};
});

/**
 * Every environment variable name the ported detectors read. A caller that
 * builds an {@link Env} from `Config` reads exactly these keys.
 *
 * **Example** (Include the hyperlink override signal)
 *
 * ```ts
 * import { terminalKeys } from "@beep/scratchpad/effected/env/internal/osc8/detect";
 * import * as A from "effect/Array";
 *
 * console.log(A.contains(terminalKeys, "FORCE_HYPERLINK")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const terminalKeys: ReadonlyArray<string> = [
	"FORCE_HYPERLINK",
	"NO_HYPERLINK",
	"NO_COLOR",
	"TMUX",
	"STY",
	"TERM",
	"TERM_PROGRAM",
	"TERM_PROGRAM_VERSION",
	"VTE_VERSION",
	"KONSOLE_VERSION",
	"WT_SESSION",
	"KITTY_WINDOW_ID",
	"TERMINAL_EMULATOR",
	"TERMINAL_NAME",
	"ConEmuPID",
	"TERMINOLOGY",
];
