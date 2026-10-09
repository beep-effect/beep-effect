// Ported from std-osc8 v0.2.0 (MIT, C. Spencer Beggs), src/detect.ts. Pure: no process reads.
import * as O from "effect/Option";
import * as Match from "effect/Match";
import { dual } from "effect/Function";
import type { Env } from "../types.ts";
import { envIsTruthy } from "./env.ts";
import { compareSemver } from "./semver.ts";
import type { KnownTerminal, Osc8Capabilities, TerminalMatch } from "./terminals.ts";
import { NO_CAPS, lookupTerminal } from "./terminals.ts";
import type { WrapperInfo } from "./wrappers.ts";
import { detectWrapper } from "./wrappers.ts";

/** Why detection produced its verdict. The discriminator on {@link Osc8Info}. */
export type Osc8Reason =
	| "force-env"
	| "no-hyperlink-env"
	| "no-color-env"
	| "not-a-tty"
	| "wrapper-strips"
	| "terminal-known-supported"
	| "terminal-known-unsupported"
	| "terminal-known-too-old"
	| "terminal-unknown";

/** The full diagnostic record {@link detect} produces. */
export interface Osc8Info {
	/** Final boolean verdict for stdout. */
	readonly supported: boolean;
	/** Final boolean verdict for stderr. */
	readonly supportedForStderr: boolean;
	/** Discriminated reason for the stdout verdict. */
	readonly reason: Osc8Reason;
	/** Human-readable summary, useful for logging. */
	readonly explanation: string;
	/** Detected terminal program, if matched against the allowlist. */
	readonly terminal: KnownTerminal | null;
	/** Raw env value used to identify the terminal. */
	readonly terminalRaw: string | null;
	/** Detected terminal version, if available. */
	readonly terminalVersion: string | null;
	/** Multiplexer info, if inside one. */
	readonly wrapper: WrapperInfo | null;
	/** Whether stdout is a TTY at detection time. */
	readonly isStdoutTTY: boolean;
	/** Whether stderr is a TTY at detection time. */
	readonly isStderrTTY: boolean;
	/** Which override produced the verdict, if any. */
	readonly override: "force-hyperlink" | "no-hyperlink" | "no-color" | null;
	/** Sub-feature capabilities of the detected terminal. */
	readonly capabilities: Osc8Capabilities;
}

/**
 * Input to the pure {@link detect} function. Snapshot of the relevant slice of
 * `process` at one moment.
 */
export interface ProcessSnapshot {
	readonly env: Env;
	readonly isStdoutTTY: boolean;
	readonly isStderrTTY: boolean;
}

const explanationFor = (
	reason: Osc8Reason,
	terminal: KnownTerminal | null,
	terminalVersion: string | null,
	wrapper: WrapperInfo | null,
): string => Match.value(reason).pipe(
	Match.when("force-env", () => "FORCE_HYPERLINK env var is set"),
	Match.when("no-hyperlink-env", () => "NO_HYPERLINK env var is set"),
	Match.when("no-color-env", () => "NO_COLOR env var is set"),
	Match.when("not-a-tty", () => "stdout is not a TTY"),
	Match.when("wrapper-strips", () => `inside ${wrapper?.name ?? "wrapper"}; passthrough not verifiable without subprocess`),
	Match.when("terminal-known-supported", () => `detected ${terminal}${terminalVersion !== null && terminalVersion !== "" ? ` ${terminalVersion}` : ""}`),
	Match.when("terminal-known-unsupported", () => `detected ${terminal}; terminal does not support OSC8`),
	Match.when("terminal-known-too-old", () => `detected ${terminal} ${terminalVersion ?? ""}; below minimum version`),
	Match.when("terminal-unknown", () => "no identifying signal matched"),
	Match.exhaustive,
);

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
 */
export const detect = (snap: ProcessSnapshot): Osc8Info => {
	const { env, isStdoutTTY, isStderrTTY } = snap;
	const wrapper = detectWrapper(env);

	const force = envIsTruthy(env.FORCE_HYPERLINK);
	const noHyperlink = envIsTruthy(env.NO_HYPERLINK);
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

/** The projection of {@link Osc8Info} the package surfaces: per-stream verdicts plus the identified terminal. */
export interface Osc8Detection {
	readonly stdout: boolean;
	readonly stderr: boolean;
	readonly terminal: O.Option<{ readonly name: string; readonly version: O.Option<string> }>;
}

/**
 * Project {@link detect} onto {@link Osc8Detection}: `supported` becomes
 * `stdout`, `supportedForStderr` becomes `stderr`, and the terminal name and
 * version become an `Option`.
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
