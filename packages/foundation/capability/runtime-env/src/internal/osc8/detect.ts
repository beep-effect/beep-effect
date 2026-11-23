// Ported from std-osc8 v0.2.0 (MIT, C. Spencer Beggs), src/detect.ts. Pure: no process reads.
/**
 * The OSC 8 hyperlink verdict for stdout and stderr, with the reason and the identified terminal.
 *
 * **Details**
 *
 * One precedence ladder decides each stream: `FORCE_HYPERLINK`, then `NO_HYPERLINK` and `NO_COLOR`, then the TTY
 * check, then a multiplexer that strips links, then the terminal allowlist and its minimum version.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RuntimeEnvId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { constant, constFalse, constTrue, dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Env } from "../types.ts";
import { envIsTruthy } from "./env.ts";
import { compareSemver } from "./semver.ts";
import { KnownTerminal, lookupTerminal, NO_CAPS, Osc8Capabilities } from "./terminals.ts";
import { detectWrapper, WrapperInfo } from "./wrappers.ts";
import type { TerminalMatch } from "./terminals.ts";

const $I = $RuntimeEnvId.create("internal/osc8/detect");

/**
 * **Example** (Validate a detection reason)
 *
 * ```ts
 * import { Osc8Reason } from "@beep/runtime-env/internal/osc8/detect";
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
]).pipe(
  $I.annoteSchema("Osc8Reason", { description: "Why detection produced its verdict. The discriminator on Osc8Info." })
);
/**
 * @category type-level
 * @since 0.0.0
 */
export type Osc8Reason = typeof Osc8Reason.Type;

/**
 * **Example** (Validate a hyperlink override)
 *
 * ```ts
 * import { Osc8Override } from "@beep/runtime-env/internal/osc8/detect";
 * import * as S from "effect/Schema";
 * console.log(S.is(Osc8Override)("force-hyperlink")) // true
 * console.log(S.is(Osc8Override)("unknown")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Osc8Override = LiteralKit(["force-hyperlink", "no-hyperlink", "no-color"]).pipe(
  $I.annoteSchema("Osc8Override", { description: "Environment override that produced an OSC8 verdict." })
);
/**
 * @category type-level
 * @since 0.0.0
 */
export type Osc8Override = typeof Osc8Override.Type;

/**
 * Carries the full diagnostic record {@link detect} produces.
 *
 * **Example** (Validate a detected terminal snapshot)
 *
 * ```ts
 * import { detect, Osc8Info } from "@beep/runtime-env/internal/osc8/detect";
 * import * as S from "effect/Schema";
 * const info = detect({ env: {}, isStdoutTTY: false, isStderrTTY: false });
 * console.log(S.is(Osc8Info)(info)) // true
 * console.log(info.reason) // not-a-tty
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class Osc8Info extends S.Opaque<Osc8Info, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * Final boolean verdict for stdout.
     *
     * @since 0.0.0
     */
    supported: S.Boolean.pipe($I.annoteKey("Osc8Info.supported", { description: "Final boolean verdict for stdout." })),
    /**
     * Final boolean verdict for stderr.
     *
     * @since 0.0.0
     */
    supportedForStderr: S.Boolean.pipe(
      $I.annoteKey("Osc8Info.supportedForStderr", { description: "Final boolean verdict for stderr." })
    ),
    /**
     * Discriminated reason for the stdout verdict.
     *
     * @since 0.0.0
     */
    reason: Osc8Reason.pipe(
      $I.annoteKey("Osc8Info.reason", { description: "Discriminated reason for the stdout verdict." })
    ),
    /**
     * Human-readable summary, useful for logging.
     *
     * @since 0.0.0
     */
    explanation: S.String.pipe(
      $I.annoteKey("Osc8Info.explanation", { description: "Human-readable summary, useful for logging." })
    ),
    /**
     * Detected terminal program, if matched against the allowlist.
     *
     * @since 0.0.0
     */
    terminal: S.Option(KnownTerminal).pipe(
      $I.annoteKey("Osc8Info.terminal", { description: "Detected terminal program, if matched against the allowlist." })
    ),
    /**
     * Raw env value used to identify the terminal.
     *
     * @since 0.0.0
     */
    terminalRaw: S.Option(S.String).pipe(
      $I.annoteKey("Osc8Info.terminalRaw", { description: "Raw env value used to identify the terminal." })
    ),
    /**
     * Detected terminal version, if available.
     *
     * @since 0.0.0
     */
    terminalVersion: S.Option(S.String).pipe(
      $I.annoteKey("Osc8Info.terminalVersion", { description: "Detected terminal version, if available." })
    ),
    /**
     * Multiplexer info, if inside one.
     *
     * @since 0.0.0
     */
    wrapper: S.Option(WrapperInfo).pipe(
      $I.annoteKey("Osc8Info.wrapper", { description: "Multiplexer info, if inside one." })
    ),
    /**
     * Whether stdout is a TTY at detection time.
     *
     * @since 0.0.0
     */
    isStdoutTTY: S.Boolean.pipe(
      $I.annoteKey("Osc8Info.isStdoutTTY", { description: "Whether stdout is a TTY at detection time." })
    ),
    /**
     * Whether stderr is a TTY at detection time.
     *
     * @since 0.0.0
     */
    isStderrTTY: S.Boolean.pipe(
      $I.annoteKey("Osc8Info.isStderrTTY", { description: "Whether stderr is a TTY at detection time." })
    ),
    /**
     * Which override produced the verdict, if any.
     *
     * @since 0.0.0
     */
    override: S.Option(Osc8Override).pipe(
      $I.annoteKey("Osc8Info.override", { description: "Which override produced the verdict, if any." })
    ),
    /**
     * Sub-feature capabilities of the detected terminal.
     *
     * @since 0.0.0
     */
    capabilities: Osc8Capabilities.pipe(
      $I.annoteKey("Osc8Info.capabilities", { description: "Sub-feature capabilities of the detected terminal." })
    ),
  }).pipe($I.annoteSchema("Osc8Info", { description: "The full diagnostic record produced by detect." }))
) {}

/**
 * Input to the pure {@link detect} function. Snapshot of the relevant slice of
 * `process` at one moment.
 *
 * **Example** (Construct a snapshot with piped streams)
 *
 * ```ts
 * import { ProcessSnapshot } from "@beep/runtime-env/internal/osc8/detect";
 *
 * const snapshot = ProcessSnapshot.make({ env: {}, isStdoutTTY: false, isStderrTTY: false });
 * console.log(snapshot.isStdoutTTY) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ProcessSnapshot extends S.Opaque<ProcessSnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    env: Env.pipe(
      $I.annoteKey("ProcessSnapshot.env", { description: "Environment variable names mapped to strings or undefined." })
    ),
    isStdoutTTY: S.Boolean.pipe(
      $I.annoteKey("ProcessSnapshot.isStdoutTTY", { description: "Whether stdout is a TTY at detection time." })
    ),
    isStderrTTY: S.Boolean.pipe(
      $I.annoteKey("ProcessSnapshot.isStderrTTY", { description: "Whether stderr is a TTY at detection time." })
    ),
  }).pipe(
    $I.annoteSchema("ProcessSnapshot", {
      description: "Input to the pure detect function: a snapshot of the relevant process state.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ProcessSnapshot {
  /**
   * The plain, unbranded snapshot shape {@link detect} accepts, so a caller can pass an object literal.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ProcessSnapshot.Encoded;
}

/** What the precedence ladder reads, once per snapshot; only the TTY state differs between the two streams. */
type Signals = {
  readonly force: boolean;
  readonly noHyperlink: boolean;
  readonly noColor: boolean;
  readonly wrapper: O.Option<WrapperInfo>;
  readonly match: O.Option<TerminalMatch>;
};

/** Outcome of running the precedence gate for a single stream's TTY state. */
type Gate = Pick<Osc8Info, "supported" | "reason" | "override">;

/** One rung of the ladder: a verdict when it applies, `None` to defer to the next rung. */
type GateRule = (signals: Signals, isTTY: boolean) => O.Option<Gate>;

const gate = (
  applies: boolean,
  supported: boolean,
  reason: Osc8Reason,
  override: O.Option<Osc8Override>
): O.Option<Gate> => (applies ? O.some({ supported, reason, override }) : O.none());

/** Whether a matched terminal is below its entry's minimum version, or has no version to compare. */
const isTooOld = (match: TerminalMatch): boolean =>
  O.match(O.filter(match.entry.minVersion, Str.isNonEmpty), {
    onNone: constFalse,
    onSome: (minVersion) =>
      O.match(match.identify.version, {
        onNone: constTrue,
        onSome: (version) => compareSemver(version, minVersion) < 0,
      }),
  });

/** The verdict for an identified terminal: unsupported, too old, or supported. */
const terminalGate = (match: TerminalMatch): Gate => {
  if (!match.entry.supported) return { supported: false, reason: "terminal-known-unsupported", override: O.none() };
  if (isTooOld(match)) return { supported: false, reason: "terminal-known-too-old", override: O.none() };
  return { supported: true, reason: "terminal-known-supported", override: O.none() };
};

/**
 * The override and stream rungs of the 7-rule precedence ladder for a single stream's TTY state, in order; the
 * terminal allowlist decides when none applies. Shared by stdout and stderr so the two paths cannot drift.
 */
const LADDER: ReadonlyArray<GateRule> = [
  (signals) => gate(signals.force, true, "force-env", O.some("force-hyperlink")),
  (signals) => gate(signals.noHyperlink, false, "no-hyperlink-env", O.some("no-hyperlink")),
  (signals) => gate(signals.noColor, false, "no-color-env", O.some("no-color")),
  (_, isTTY) => gate(!isTTY, false, "not-a-tty", O.none()),
  (signals) => gate(O.isSome(signals.wrapper), false, "wrapper-strips", O.none()),
];

const evaluateGate = (signals: Signals, isTTY: boolean): Gate =>
  O.getOrElse(
    A.findFirst(LADDER, (rule) => rule(signals, isTTY)),
    () =>
      O.match(signals.match, {
        onNone: (): Gate => ({ supported: false, reason: "terminal-unknown", override: O.none() }),
        onSome: terminalGate,
      })
  );

const versionSuffix = (terminalVersion: O.Option<string>): string =>
  O.getOrElse(
    O.map(O.filter(terminalVersion, Str.isNonEmpty), (version) => ` ${version}`),
    constant("")
  );

// The terminal-known reasons only arise when a terminal matched, so the empty fallback is never printed.
const terminalName = (terminal: O.Option<KnownTerminal>): string => O.getOrElse(terminal, constant(""));

const explanationFor = (
  reason: Osc8Reason,
  terminal: O.Option<KnownTerminal>,
  terminalVersion: O.Option<string>,
  wrapperName: string
): string =>
  Osc8Reason.match(reason, {
    "force-env": () => "FORCE_HYPERLINK env var is set",
    "no-hyperlink-env": () => "NO_HYPERLINK env var is set",
    "no-color-env": () => "NO_COLOR env var is set",
    "not-a-tty": () => "stdout is not a TTY",
    "wrapper-strips": () => `inside ${wrapperName}; passthrough not verifiable without subprocess`,
    "terminal-known-supported": () => `detected ${terminalName(terminal)}${versionSuffix(terminalVersion)}`,
    "terminal-known-unsupported": () => `detected ${terminalName(terminal)}; terminal does not support OSC8`,
    "terminal-known-too-old": () =>
      `detected ${terminalName(terminal)} ${O.getOrElse(terminalVersion, constant(""))}; below minimum version`,
    "terminal-unknown": () => "no identifying signal matched",
  });

/**
 * Determine OSC8 support from a process snapshot. Pure: same input ⇒ same
 * output.
 *
 * **Example** (Explain a non-TTY verdict)
 *
 * ```ts
 * import { detect } from "@beep/runtime-env/internal/osc8/detect";
 *
 * const info = detect({ env: {}, isStdoutTTY: false, isStderrTTY: false });
 * console.log(info.reason) // not-a-tty
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const detect = (snap: ProcessSnapshot.Encoded): Osc8Info => {
  const { env, isStdoutTTY, isStderrTTY } = snap;
  const wrapper = detectWrapper(env);
  const match = lookupTerminal(env);
  const signals: Signals = {
    force: envIsTruthy(env.FORCE_HYPERLINK, "default"),
    noHyperlink: envIsTruthy(env.NO_HYPERLINK, "default"),
    noColor: envIsTruthy(env.NO_COLOR, "no-color"),
    wrapper,
    match,
  };

  const terminal = O.map(match, (found) => found.entry.name);
  const terminalVersion = O.flatMap(match, (found) => found.identify.version);

  const wrapperName = O.getOrElse(
    O.map(wrapper, (info) => info.name),
    () => "wrapper"
  );

  const stdout = evaluateGate(signals, isStdoutTTY);
  const stderr = evaluateGate(signals, isStderrTTY);

  return Osc8Info.make({
    supported: stdout.supported,
    supportedForStderr: stderr.supported,
    reason: stdout.reason,
    explanation: explanationFor(stdout.reason, terminal, terminalVersion, wrapperName),
    terminal,
    terminalRaw: O.map(match, (found) => found.identify.rawIdentifier),
    terminalVersion,
    wrapper,
    isStdoutTTY,
    isStderrTTY,
    override: stdout.override,
    // Capabilities are an intrinsic property of the detected terminal — not
    // gated by stream TTY state. A piped stdout still tells us the terminal
    // has params support; the gate decides whether to USE them. Without
    // this decoupling, callers targeting stderr would see params silently
    // dropped whenever stdout happens to be piped.
    capabilities: O.getOrElse(
      O.map(match, (found) => found.entry.capabilities),
      () => NO_CAPS
    ),
  });
};

/**
 * Projects {@link Osc8Info} into the package surface: per-stream verdicts plus the identified terminal.
 *
 * **Example** (Validate per-stream verdicts without a terminal)
 *
 * ```ts
 * import { Osc8Detection } from "@beep/runtime-env/internal/osc8/detect";
 * import * as O from "effect/Option";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(Osc8Detection)({ stdout: false, stderr: false, terminal: O.none() })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class Osc8Detection extends S.Opaque<Osc8Detection, { readonly brand: unique symbol }>()(
  S.Struct({
    stdout: S.Boolean.pipe($I.annoteKey("Osc8Detection.stdout", { description: "Final OSC8 verdict for stdout." })),
    stderr: S.Boolean.pipe($I.annoteKey("Osc8Detection.stderr", { description: "Final OSC8 verdict for stderr." })),
    terminal: S.Option(
      S.Struct({
        name: S.String.pipe(
          $I.annoteKey("Osc8Detection.terminal.name", { description: "The identified terminal program." })
        ),
        version: S.Option(S.String).pipe(
          $I.annoteKey("Osc8Detection.terminal.version", { description: "The terminal version, when available." })
        ),
      }).pipe(
        $I.annoteSchema("Osc8Detection.terminal", {
          description: "The identified terminal program and optional version.",
        })
      )
    ).pipe($I.annoteKey("Osc8Detection.terminal", { description: "The identified terminal, when available." })),
  }).pipe($I.annoteSchema("Osc8Detection", { description: "Per-stream OSC8 verdicts plus the identified terminal." }))
) {}

/**
 * Project {@link detect} onto {@link Osc8Detection}: `supported` becomes
 * `stdout`, `supportedForStderr` becomes `stderr`, and the terminal name and
 * version become an `Option`.
 *
 * **Example** (Force hyperlinks for both piped streams)
 *
 * ```ts
 * import { detectOsc8 } from "@beep/runtime-env/internal/osc8/detect";
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
  return Osc8Detection.make({
    stdout: info.supported,
    stderr: info.supportedForStderr,
    terminal: O.map(info.terminal, (name) => ({ name, version: info.terminalVersion })),
  });
});

/**
 * Every environment variable name the ported detectors read. A caller that
 * builds an {@link Env} from `Config` reads exactly these keys.
 *
 * **Example** (Include the hyperlink override signal)
 *
 * ```ts
 * import { terminalKeys } from "@beep/runtime-env/internal/osc8/detect";
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
