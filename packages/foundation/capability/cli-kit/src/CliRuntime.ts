/**
 * The program boundary: `CliRuntime.main` runs a command with its environment, reports a failure as a document on
 * stderr through the audience's renderer, and exits with the right code.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { CommandNeutralizer } from "@beep/github-commands";
import { $CliKitId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as CliError from "effect/cli/CliError";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as MutableRef from "effect/MutableRef";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import { Cancelled } from "./Cancelled.ts";
import { CliColor } from "./CliColor.ts";
import { CliEnv } from "./CliEnv.ts";
import { CliExit } from "./CliExit.ts";
import { CliLog, envBuildLogLayer, platformLogLayer } from "./CliLog.ts";
import { CliLogger, makeCliLogger } from "./CliLogger.ts";
import { sanitize } from "./Fmt.ts";
import { AnyNumber } from "./internal/declared.ts";
import { ExitRequested } from "./internal/ExitRequested.ts";
import {
  currentTarget,
  FailureTargetCell,
  fallbackTarget,
  guardConsumerLines,
  linesOf,
  plainFailureLines,
  readSpans,
  refreshFailureTarget,
} from "./internal/failureTarget.ts";
import { routeHelpOnUsageError } from "./internal/HelpRouting.ts";
import { isExitCode } from "./internal/isExitCode.ts";
import { TrustedLine } from "./internal/logSafety.ts";
import { provideBuilt } from "./internal/provideBuilt.ts";
import { NotInteractive } from "./NotInteractive.ts";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as Stdio from "effect/Stdio";
import type * as Terminal from "effect/Terminal";
import type { CliEnvOptions, CliEnvServices } from "./CliEnv.ts";
import type { CliLogFileOptions, CliLogOptions } from "./CliLog.ts";
import type { FailureTarget } from "./internal/failureTarget.ts";

const $I = $CliKitId.create("CliRuntime");

const FailureDetailsCause = S.declare<Cause.Cause<unknown>>((value): value is Cause.Cause<unknown> =>
  Cause.isCause(value)
).pipe($I.annoteSchema("FailureDetailsCause", { description: "The cause the program failed with." }));
const FailureDetailsLines = S.declare<
  (options?: {
    readonly status?: boolean | undefined;
    readonly spans?: "app" | "all" | "off" | undefined;
  }) => ReadonlyArray<string>
>(
  (
    value
  ): value is (options?: {
    readonly status?: boolean | undefined;
    readonly spans?: "app" | "all" | "off" | undefined;
  }) => ReadonlyArray<string> => P.isFunction(value)
).pipe(
  $I.annoteSchema("FailureDetailsLines", {
    description: "Renders the default report lines with status and span overrides.",
  })
);
const ReportFailuresOptionsRender = S.declare<
  (error: unknown, details: FailureDetails.Encoded) => string | ReadonlyArray<string>
>((value): value is (error: unknown, details: FailureDetails.Encoded) => string | ReadonlyArray<string> =>
  P.isFunction(value)
).pipe(
  $I.annoteSchema("ReportFailuresOptionsRender", {
    description: "A custom renderer for a failure report: a string or lines.",
  })
);

/** A runtime invariant failure or a non-Error value wrapped for teardown. */
class CliRuntimeError extends S.TaggedError<CliRuntimeError, { readonly brand: unique symbol }>($I`CliRuntimeError`)(
  "CliRuntimeError",
  {
    message: S.String.pipe(
      $I.annoteKey("CliRuntimeError.message", {
        description: "The runtime invariant or reported failure that needs teardown handling.",
      })
    ),
    cause: S.optionalKey(S.Defect({ includeStack: true })).pipe(
      $I.annoteKey("CliRuntimeError.cause", {
        description: "The original failure when runtime markers could not be installed in place.",
      })
    ),
  },
  $I.annoteError<CliRuntimeError>("CliRuntimeError", {
    description: "A CLI runtime invariant failed or a non-Error failure was reported.",
  })
) {
  override readonly name = "Error";
}

const isShowHelp = (u: unknown): u is CliError.ShowHelp => CliError.isCliError(u) && u._tag === "ShowHelp";

/** A `UserError` `Command.runWith` already printed: it sets the mark to `false` after rendering. */
const isRenderedUserError = (u: unknown): u is CliError.UserError =>
  CliError.isCliError(u) && u._tag === "UserError" && !Runtime.getErrorReported(u);

/**
 * What `render` is told about a failure beyond the squashed error.
 *
 * **Example** (Inspect the schema)
 *
 * ```ts
 * import { FailureDetails } from "@beep/cli-kit/CliRuntime"
 *
 * console.log(typeof FailureDetails.make) // function
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class FailureDetails extends S.Opaque<FailureDetails, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The whole cause the program failed with, before squashing. */
    cause: FailureDetailsCause.pipe(
      $I.annoteKey("FailureDetails.cause", { description: "The cause field of FailureDetails." })
    ),
    /**
     * The report the kit writes for this failure when there is no `render`: for this run, in this audience, with its
     * colour, links and `displayPath`. A `render` that hands a failure back returns these lines unchanged, and the
     * output is then exactly the default report. It equals `lines()`; to drop the leading status and keep the run's
     * settings, use {@link FailureDetails.lines} with `status: false`.
     */
    defaultLines: S.Array(S.String).pipe(
      $I.annoteKey("FailureDetails.defaultLines", { description: "The defaultLines field of FailureDetails." })
    ),
    /**
     * `true` when the squashed `error` is the kit's {@link Cancelled}: the person quit a prompt or screen (Esc, Ctrl-C).
     * It is not a bug and there is nothing to report, whichever channel it arrived through.
     *
     * **Gotchas**
     *
     * A cancel from `CliPrompt.fallback` is a defect (`isDefect` is `true`) and one from `CliUi.run` is a typed failure
     * (`isDefect` is `false`), so a `render` that gives a defect the "please report this" treatment must test this flag
     * first, or Esc prints an issue-report request. `isDefect` keeps its plain meaning, the absence of a typed failure,
     * and the exit code is unchanged (`130` for the `interrupt` reason). `defaultLines` and `lines()` already draw it as
     * its one fixed line.
     */
    isCancelled: S.Boolean.pipe(
      $I.annoteKey("FailureDetails.isCancelled", { description: "The isCancelled field of FailureDetails." })
    ),
    /**
     * `true` when the cause carries no typed failure, so `error` is a defect:
     * a `die`, a thrown exception, a bug. `false` when `error` is a typed
     * failure from the error channel.
     */
    isDefect: S.Boolean.pipe(
      $I.annoteKey("FailureDetails.isDefect", { description: "The isDefect field of FailureDetails." })
    ),
    /**
     * `true` when the squashed `error` is the kit's {@link NotInteractive}: the program asked for a prompt or a screen in
     * a run that cannot show one (a pipe, an agent, a CI). It is a usage problem, not a bug, whichever channel it
     * arrived through; `isDefect` is as for {@link FailureDetails.isCancelled}.
     */
    isNotInteractive: S.Boolean.pipe(
      $I.annoteKey("FailureDetails.isNotInteractive", { description: "The isNotInteractive field of FailureDetails." })
    ),
    /**
     * The report the kit would write for this failure, rendered for this run: its audience, colour, links and
     * `displayPath`.
     *
     * **Details**
     * `lines()` is {@link FailureDetails.defaultLines}. With `status: false` the leading status glyph, or the `[FAIL]`
     * tag in plain text, is left off, so a render that puts its own prefix in front (the program's name, say) reads
     * cleanly and still gets the run's colour and paths. `CliRuntime.defaultRender` with `status: false` drops the
     * status too, but it has no run to read and renders plain with absolute paths.
     *
     * `spans` chooses the `in:` trail for these lines alone, as `CliFailureOptions.spans` does (`app`, `all` or
     * `off`); without it the run's own setting (`env.spans`, `app` by default) applies.
     *
     * **Example** (Prefix the first rendered failure line)
     *
     * ```ts
     * import type { FailureDetails } from "@beep/cli-kit/CliRuntime"
     * import * as Cause from "effect/Cause"
     *
     * const render = (_error: unknown, details: FailureDetails.Encoded) =>
     *   details.lines({ status: false }).map((line, i) => (i === 0 ? `prog: ${line}` : line))
     * const details: FailureDetails.Encoded = {
     *   cause: Cause.fail(new Error("invalid configuration")),
     *   isDefect: false,
     *   isCancelled: false,
     *   isNotInteractive: false,
     *   defaultLines: ["[FAIL] invalid configuration"],
     *   lines: () => ["invalid configuration"],
     * }
     * console.log(render(new Error("invalid configuration"), details)[0]) // prog: invalid configuration
     * ```
     *
     * @param options - `status: false` leaves off the leading status; `spans` chooses the span trail
     * @category utilities
     * @since 0.0.0
     */
    lines: FailureDetailsLines.pipe(
      $I.annoteKey("FailureDetails.lines", { description: "The lines field of FailureDetails." })
    ),
  }).pipe($I.annoteSchema("FailureDetails", { description: "Plain FailureDetails data." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import type { FailureDetails } from "@beep/cli-kit/CliRuntime"
 *
 * const accepts = (_value: FailureDetails.Encoded) => true
 * console.log(typeof accepts) // function
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FailureDetails {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof FailureDetails.Encoded;
}

/**
 * How a failure is turned into output and an exit code.
 *
 * **Example** (Validate plain options)
 *
 * ```ts
 * import { ReportFailuresOptions } from "@beep/cli-kit/CliRuntime"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ReportFailuresOptions)({ exitCode: 2 })) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ReportFailuresOptions extends S.Opaque<ReportFailuresOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * The exit code to use when the error does not carry one.
     *
     * **Gotchas**
     *
     * An error carrying `Runtime.errorExitCode` keeps its own; this is only the
     * fallback, and it defaults to `1`. Pass an integer in `0..255`, the range a
     * POSIX exit status can carry — `256` wraps to `0` and passes a failed run.
     */
    exitCode: S.optionalKey(AnyNumber).pipe(
      $I.annoteKey("ReportFailuresOptions.exitCode", { description: "The exitCode field of ReportFailuresOptions." })
    ),
    /**
     * Render the failure. Defaults to the failure's document, `CliFailure.toDoc(cause)`, rendered for the
     * audience: a failure status line, a tree for a schema failure, a defect's message with its cleaned stack, and
     * the one fixed line each for `Cancelled` and `NotInteractive`. Under `CliRuntime.main` with `env` it is painted for
     * a person and plain for an agent or a CI; elsewhere it is plain. It is still written through the logger.
     *
     * **Details**
     *
     * Return several lines to print several: a config error's own message
     * followed by the rendered issue lines, say.
     *
     * `error` is the squashed cause: the first typed failure when there is
     * one, otherwise the first defect. `details` says which it is, so a typed
     * failure can render as one line and a defect as a full report, without
     * guessing from the error's shape. A renderer that takes only `error`
     * still fits.
     *
     * What it returns is text the kit did not build, so the report applies the output policy to it: under GitHub
     * Actions a line the runner would read as a workflow command is neutralized (with no environment services at all,
     * always), and for an agent or a CI audience escape sequences are removed (GitHub Actions detects as `ci`). For a person the escapes you return are kept,
     * since the kit cannot tell your own colour from an injected sequence: a `render` must sanitise the data it
     * interpolates (an error message, a file name) itself.
     */
    render: S.optionalKey(ReportFailuresOptionsRender).pipe(
      $I.annoteKey("ReportFailuresOptions.render", { description: "The render field of ReportFailuresOptions." })
    ),
    /**
     * The exit code for a usage error: a `ShowHelp` carrying parse errors, or a
     * `CliError.UserError` `Command.runWith` already printed.
     *
     * **Details**
     *
     * Defaults to `64` (BSD `EX_USAGE`); pass an integer in `0..255`. A
     * `ShowHelp` with no errors — a bare root invocation, or `--help` — always
     * exits `0`. A `UserError` that carries its own `Runtime.errorExitCode` —
     * one marked with `CliRuntime.reported(error, 3)` — keeps that code instead.
     *
     * Keep `Command.runWith`'s default `renderErrors`: with `renderErrors: false`
     * runWith prints no parse errors and `reportFailures` never renders a
     * `ShowHelp`, so a parse error would exit with this code having printed
     * nothing on stderr.
     */
    usageExitCode: S.optionalKey(AnyNumber).pipe(
      $I.annoteKey("ReportFailuresOptions.usageExitCode", {
        description: "The usageExitCode field of ReportFailuresOptions.",
      })
    ),
  }).pipe($I.annoteSchema("ReportFailuresOptions", { description: "Plain ReportFailuresOptions data." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { ReportFailuresOptions } from "@beep/cli-kit/CliRuntime"
 * import * as S from "effect/Schema"
 *
 * const plain: ReportFailuresOptions.Encoded = { exitCode: 2 }
 * console.log(S.is(ReportFailuresOptions)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ReportFailuresOptions {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ReportFailuresOptions.Encoded;
}

/**
 * Options for `CliRuntime.main`.
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export interface MainOptions<RP, EP> extends ReportFailuresOptions.Encoded {
  /**
   * Provide the environment services, built by {@link CliEnv.layer}, inside failure reporting, where the platform
   * sits, together with `CliColor.formatterLayer` so help text follows the same colour decision.
   *
   * **Gotchas**
   *
   * The program may then require `CurrentRuntimeEnv`, `TerminalEnv`, `Audience` and `CliTheme` and read
   * `CliInteractive`. Without it `CliInteractive` keeps its non-interactive default, so forgetting this wiring
   * gives a CLI that never prompts. With `env.log`, `main` uses `CliLog.layer` as the logger set, and `env.log`
   * may carry the `file` option when the platform provides `FileSystem` and `Path`. A failure building the env
   * layer renders as one line and exits through `exitCode`.
   *
   * Not interactive, the `Terminal` the program sees is gated: its `readLine` fails as a quit, its input is
   * already ended and its `display` writes nothing. A program that reads piped data must read `Stdio.stdin`, and
   * one that writes output must use `Console` or `Stdio`, never `Terminal`.
   *
   * Stderr's colour mirrors stdout's terminal check unless `env.stderrIsTerminal` says otherwise, so with stderr
   * redirected and stdout a terminal the failure report is painted into the file. On Node, pass the real check from
   * the bin's entry, the one place it reads the host:
   * `env: { stderrIsTerminal: Effect.sync(() => process.stderr.isTTY === true) }`. Core's `Stdio` reports only
   * stdout (upstream Effect-TS/effect#8639); once core has a stderr check, this option reads it and the bin passes
   * nothing.
   */
  readonly env?: CliEnvOptions.Encoded | undefined;
  /**
   * Where the help document goes when it is printed with a usage error:
   * `"stdout"` (the default, core's behaviour) or `"stderr"`, beside the
   * errors.
   *
   * **Gotchas**
   *
   * `"stderr"` keeps stdout clean for a caller that parses it, such as a
   * hook piping JSON into `jq`: an unknown flag, a bad value or an unknown
   * subcommand then writes nothing to stdout. An explicit `--help` and a
   * bare invocation of a command group still print help on stdout: neither
   * is an error.
   *
   * Two cases keep help on stdout even under `"stderr"`. A `CliOutput`
   * Formatter or a `Console` provided inside `program` is not seen by
   * `main`, so its help is not rerouted. To change the Formatter, pass
   * `env.formatter` (for example `formatVersion`): `main` installs its own
   * Formatter inside the platform, so that is the way in, and a Formatter
   * provided inside the program is invisible to the routing. A Formatter
   * the platform provides is shadowed by `main`'s, so pass it through
   * `env.formatter` as well. And with `Command.runWith`'s `renderErrors: false`
   * no errors are printed, so nothing marks the help as a usage error's.
   */
  readonly helpOnUsageError?: "stdout" | "stderr" | undefined;
  /**
   * The logger, provided outermost. Defaults to `CliLogger.layer()`, or to `CliLog.layer(env.log)` when
   * `env.log` is given. An explicit `logger` wins over both.
   */
  readonly logger?: Layer.Layer<never> | undefined;
  /**
   * The platform layer, usually `NodeServices.layer` or an app platform built
   * on it. Passed in so this package never imports a platform.
   */
  readonly platform: Layer.Layer<RP, EP>;
}

/** The last line of defence of a failure report: the error's text, sanitised and neutralized, whatever else broke. */
const lastResort = (error: unknown): ReadonlyArray<string> => {
  const text = Result.getOrElse(
    Result.try(() => String(error)),
    () => "[unprintable failure]"
  );
  return CommandNeutralizer.lines(sanitize(text));
};

const toLines = (rendered: string | ReadonlyArray<string>): ReadonlyArray<string> =>
  P.isString(rendered) ? [rendered] : rendered;

/**
 * The error's own exit code when it carries one, otherwise the fallback.
 *
 * **Gotchas**
 *
 * `Runtime.getErrorExitCode` cannot serve alone here: it answers `1` both for
 * an error marked `1` and for an unmarked one, so an `exitCode` option would
 * silently override a deliberate `1`. Testing for the marker keeps "the error
 * chose its code" distinct from "nothing chose".
 */
const chooseExitCode: {
  (error: unknown, fallback: number | undefined): number;
  (fallback: number | undefined): (error: unknown) => number;
} = dual(2, (error: unknown, fallback: number | undefined): number =>
  P.isObjectKeyword(error) && !P.isFunction(error) && Runtime.errorExitCode in error
    ? Runtime.getErrorExitCode(error)
    : (fallback ?? 1)
);

const renderedExitCode = (error: unknown, usageCode: number): number | undefined => {
  if (isShowHelp(error)) return error.errors.length > 0 ? usageCode : 0;
  return isRenderedUserError(error) ? chooseExitCode(error, usageCode) : undefined;
};

/** Build diagnostics over the same environment instance used for the program. */
const mainLogger = <RP, EP>(options: MainOptions<RP, EP>, env: ReturnType<typeof CliEnv.layer> | undefined) => {
  const envLog = options.env?.log;
  return (
    options.logger ??
    (env === undefined || envLog === undefined
      ? CliLogger.layer()
      : // The logger needs Audience and TerminalEnv, so it is built over the env layer; the same layer is provided
        // again inside failure reporting, where a failure to build it is reported. If it cannot be built here, fall
        // back to the plain CliLogger so that report has a logger.
        ("file" in envLog ? CliLog.layer(envLog) : CliLog.layer(envLog)).pipe(
          Layer.provide(env),
          // The platform and env builds log too (an invalid audience override warns, a platform may log while it
          // builds): build them UNDER a CliLogger, never beside it, or those lines go through Effect's default
          // logger to STDOUT, before any logger exists. `provideMerge` hands the same logger set on to the env build.
          // The platform alone is built under the run's log level and format (`platformLogLayer`): provided to it
          // only, so its lowered MinimumLogLevel never reaches this CliLog's own build, which reads the ambient one.
          Layer.provide(
            Layer.provideMerge(
              options.platform.pipe(Layer.provide(platformLogLayer(envLog, options.env?.audienceEnvVar))),
              // The env build logs too (an invalid override value warns, interpolating it): once, in the build-time
              // format and neutralized, never silenced by plainLogger, and without lowering MinimumLogLevel, which this
              // CliLog's own build reads.
              envBuildLogLayer(envLog, options.env?.audienceEnvVar)
            )
          ),
          Layer.catchCause((cause) =>
            Cause.hasInterrupts(cause)
              ? // Cause.map, not Effect.mapError: mapping the error channel drops the interrupt of a mixed cause.
                cause.pipe(Cause.map(CliRuntime.reported), Effect.failCause, Layer.effectDiscard)
              : CliLogger.layer(envLog.logger)
          )
        ))
  );
};

/** Validate the public exit-code cell before the runtime hands it to a host. */
const validateRunExit = Effect.gen(function* () {
  const exit = yield* CliExit;
  const code = MutableRef.get(exit.code);
  // CliExit.set validates, but the cell is a public MutableRef a program
  // can write directly; 256 would wrap to exit 0, 1.5 would throw in
  // process.exit.
  if (!isExitCode(code)) {
    return yield* Effect.die(
      CliRuntimeError.make({ message: `CliRuntime.main: CliExit code must be an integer 0..255, received ${code}` })
    );
  }
  if (code !== 0) return yield* ExitRequested.make({ code });
});

/**
 * Report a CLI program's failures through the program's own logger.
 *
 * **Details**
 *
 * ## What it prevents
 *
 * A platform `runMain` reports an unhandled failure using Effect's **default**
 * logger. That logger sits **outside** the layers the program was provided —
 * `makeRunMain` composes its reporting `tapCause` around the already-provided
 * effect — so a program that carefully installs {@link CliLogger} still prints
 * its failures in the structured format that logger exists to replace, and
 * prints them on **stdout**, the one stream errors must not use.
 *
 * Nothing about the call site suggests this. The program looks correct, the
 * logger is installed, every success path is right, and only a failure reveals
 * it.
 *
 * ## Why a combinator, and not a `runMain`
 *
 * The fix has to happen **inside** the effect, before any `runMain` sees it. So
 * this is a combinator you apply to your program, and you still call your own
 * platform's runner. Wrapping `runMain` itself would drag a platform choice into a library that
 * has no business making one, and would make this package unusable from Bun or
 * Deno for no gain.
 *
 * ## What it does with the failure
 *
 * Renders it through the ambient logger, then **re-fails with a marked error**
 * so the runtime still sees a failure — the exit code is the runtime's to set,
 * and swallowing the failure would make a broken run exit `0`.
 *
 * The marks are core's own, and they are what make this work without a platform
 * import:
 *
 * - `Runtime.errorExitCode` — `defaultTeardown` takes the squashed error's
 *   value as the process exit code. An error that already carries one **keeps
 *   it**: that was a deliberate choice by whatever raised it, and flattening
 *   every failure to a single code would discard it.
 * - `Runtime.errorReported` — set to `false`, which suppresses the runtime's own
 *   duplicate report. **The polarity is inverted relative to the name**: the
 *   marker means "should this be reported", so the intuitive
 *   `errorReported: true` — "I have reported it, stay quiet" — produces exactly
 *   the double report it was meant to prevent.
 *
 * An **interrupt is left alone**: it is not a failure to report, and the
 * default teardown already maps an interrupt-only cause to `130`.
 *
 * A `CliError.ShowHelp` is never rendered: `Command.runWith` already printed
 * the help text (and any parse errors) before re-failing with it, so
 * rendering it again would print nothing but a stray "Help requested" line.
 * A `ShowHelp` carrying errors is remapped to `usageExitCode` (default `64`,
 * BSD `EX_USAGE`); a bare `--help` or root invocation — `errors` empty —
 * keeps exit `0`. A `CliError.UserError` whose `Runtime.errorReported` mark
 * is `false` is likewise skipped: that is how `Command.runWith` leaves one it
 * already rendered through its `CliOutput` formatter. It exits with its own
 * `Runtime.errorExitCode` when it carries one, otherwise `usageExitCode`;
 * under runWith's `renderErrors: false` the mark stays set, and it renders
 * here like any other failure. Every other
 * error renders even when it already carries the reported mark — a gate
 * failure marked with `CliRuntime.reported` still prints its line. The
 * private `ExitRequested` sentinel `CliRuntime.main`
 * raises is likewise never rendered; it only carries the exit code a
 * successful program recorded through `CliExit`.
 *
 * **Example** (Report program failures through the configured logger)
 *
 * ```ts
 * import { CliRuntime } from "@beep/cli-kit/CliRuntime"
 * import * as Effect from "effect/Effect"
 * import { CliLogger } from "@beep/cli-kit/CliLogger"
 * const program = Effect.fail(new Error("invalid configuration")).pipe(
 *   CliRuntime.reportFailures(),
 *   Effect.provide(CliLogger.layer()),
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export abstract class CliRuntime {
  /**
   * What `reportFailures` and `main` render a failure as when no `render` option is given, for a consumer's own
   * `render` to hand a failure back to.
   *
   * **Details**
   * The plain lines of `CliFailure.toDoc(details.cause)`: a failure status line, a `Tree` for a schema failure, a
   * defect's message with its cleaned `stack`, and the one fixed line each for `Cancelled` and `NotInteractive`.
   * It has no terminal to ask, so it is the plain rendering for an agent, with absolute paths; the report `main` writes
   * with no `render` option is the same document in the renderer the audience gets (painted for a person), and that
   * report is `details.defaultLines`: return those to hand a failure back with the run's colour, links and path
   * display. With `status: false` the leading status (the glyph, or `[FAIL]` in plain text) is left off, so a prefix
   * such as the program's name reads cleanly; for that AND the run's settings, use `details.lines({ status: false })`.
   * A custom `render` that only cares about its own errors delegates the rest:
   *
   * **Example** (Delegate failures outside a custom error type)
   *
   * ```ts
   * import { CliRuntime } from "@beep/cli-kit/CliRuntime"
   * import type { FailureDetails } from "@beep/cli-kit/CliRuntime"
   * import * as Cause from "effect/Cause"
   *
   * class MyError extends Error {}
   * const myLines = (error: MyError) => [error.message]
   * const render = (error: unknown, details: Pick<FailureDetails, "cause" | "isDefect">) =>
   *   error instanceof MyError ? myLines(error) : CliRuntime.defaultRender(error, details)
   * const lines = render(new MyError("invalid configuration"), {
   *   cause: Cause.fail(new MyError("invalid configuration")),
   *   isDefect: false,
   * })
   * console.log(lines[0]) // invalid configuration
   * ```
   *
   * @param error - the squashed failure
   * @param details - what `render` is told about the failure; accepted so a delegating `render` passes both
   *   arguments through unchanged (only `cause` and `isDefect` are read)
   * @param options - `status: false` leaves off the leading status glyph or `[FAIL]` tag
   * @category formatting
   * @since 0.0.0
   */
  static readonly defaultRender: {
    (
      error: unknown,
      details: Pick<FailureDetails.Encoded, "cause" | "isDefect">,
      options?: { readonly status?: boolean | undefined }
    ): string | ReadonlyArray<string>;
    (
      details: Pick<FailureDetails.Encoded, "cause" | "isDefect">,
      options?: { readonly status?: boolean | undefined }
    ): (error: unknown) => string | ReadonlyArray<string>;
  } = dual(
    // The error is `unknown`, so the dispatch reads the second argument: `details` (it always carries `isDefect`) in
    // the data-first form, the options or nothing in the data-last one.
    (args) => P.hasProperty(args[1], "isDefect"),
    (
      error: unknown,
      details: Pick<FailureDetails.Encoded, "cause" | "isDefect">,
      options?: { readonly status?: boolean | undefined }
    ): string | ReadonlyArray<string> =>
      // `details.cause` is what a report is told; a hand-built `details` with an empty cause renders the error itself.
      plainFailureLines(details.cause.reasons.length > 0 ? details.cause : Cause.fail(error), options?.status !== false)
  );

  /**
   * Catch a program's failure, render it through the ambient logger, and re-fail with the exit code and the
   * no-double-report mark.
   *
   * **Example** (Construct a failure-reporting program)
   *
   * ```ts
   * import { CliRuntime } from "@beep/cli-kit/CliRuntime"
   * import * as Effect from "effect/Effect"
   *
   * const program = Effect.fail(new Error("invalid configuration")).pipe(CliRuntime.reportFailures({ exitCode: 3 }))
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @param options - how to render the failure and which exit codes to use
   * @category error-handling
   * @since 0.0.0
   */
  static readonly reportFailures =
    (options: ReportFailuresOptions.Encoded = {}) =>
    <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, Error, R> =>
      effect.pipe(
        Effect.catchCause(
          Effect.fnUntraced(function* (cause: Cause.Cause<E>): Effect.fn.Return<A, Error> {
            // An interrupt is not a failure anyone wants rendered, and the default
            // teardown already maps an interrupt-only cause to 130.
            if (Cause.hasInterruptsOnly(cause))
              return yield* Effect.failCause(
                Cause.fromReasons<Error>(A.filter(cause.reasons, Cause.isInterruptReason))
              );

            const error = Cause.squash(cause);

            // Already marked by CliRuntime.main; there is nothing to render.
            if (S.is(ExitRequested)(error)) return yield* error;

            // Command.runWith printed help (stdout) and any parse errors (stderr)
            // BEFORE re-failing with ShowHelp. Rendering it again prints a stray
            // "Help requested" line.
            const alreadyRendered = renderedExitCode(error, options.usageExitCode ?? 64);
            if (alreadyRendered !== undefined) return yield* Effect.fail(CliRuntime.reported(error, alreadyRendered));

            const render = options.render;

            // The failure's document in the renderer the audience gets: the report itself without a `render`, and
            // `details.defaultLines` with one. If the document cannot be rendered for the audience, the plain path;
            // if that dies too, the message alone, still sanitised and neutralized: the last resort keeps the policy.
            // The target is built from the services in context when there is no cell: if that dies, the plain fallback.
            const target = yield* currentTarget.pipe(Effect.catchCause(() => Effect.succeed(fallbackTarget)));
            const reportLines: {
              (status: boolean, spans?: "app" | "all" | "off"): ReadonlyArray<string>;
              (spans?: "app" | "all" | "off"): (status: boolean) => ReadonlyArray<string>;
            } = dual(
              (args) => P.isBoolean(args[0]),
              (status: boolean, spans?: "app" | "all" | "off"): ReadonlyArray<string> =>
                Result.getOrElse(
                  Result.try(() => linesOf(cause, target, status, spans ?? target.spans)),
                  () =>
                    Result.getOrElse(
                      Result.try(() => plainFailureLines(cause, status, spans ?? target.spans)),
                      () => lastResort(error)
                    )
                )
            );
            const defaultLines = reportLines(true);
            // Cause.squash prefers a Fail over a Die, so `error` is a defect exactly when there is no Fail.
            const details: FailureDetails.Encoded = {
              cause,
              isDefect: !Cause.hasFails(cause),
              isCancelled: S.is(Cancelled)(error),
              isNotInteractive: S.is(NotInteractive)(error),
              defaultLines,
              lines: (options) =>
                options?.status === false || options?.spans !== undefined
                  ? reportLines(options?.status !== false, options?.spans)
                  : defaultLines,
            };
            // Without a `render`, written through the logger, so `--log-level` and its routing apply.
            const lines =
              render === undefined
                ? defaultLines
                : // A consumer's lines are text the kit did not build: neutralized under Actions, stripped for an agent.
                  yield* guardConsumerLines(toLines(render(error, details)));
            for (const line of lines) {
              // Rendered by the kit (or by the consumer's own `render`): not sanitised again by the logger.
              yield* Effect.logError(line).pipe(Effect.provideService(TrustedLine, true));
            }

            return yield* Effect.fail(CliRuntime.reported(error, chooseExitCode(error, options.exitCode)));
          })
        )
      );

  /**
   * Assemble a CLI program in the one order that reports every failure well.
   *
   * **Details**
   *
   * - `CliExit` is provided fresh, and a non-zero code after success becomes a
   *   marked failure the teardown honours.
   * - The platform layer is provided **inside** failure reporting, so a
   *   layer-build failure (`HOME` unset, say) renders as one line with the
   *   fallback code rather than escaping to the runtime's stack trace.
   * - The logger is provided **outermost**, so it is present whichever branch
   *   fails.
   * - With the `env` option, `CliEnv.layer` and `CliColor.formatterLayer` are
   *   provided beside the platform, inside failure reporting, so the program can
   *   read the audience, terminal, theme and `CliInteractive`.
   *
   * You still call your platform's runner.
   *
   * **Example** (Run a CLI with a custom failure exit code)
   *
   * ```ts
   * import { CliRuntime } from "@beep/cli-kit/CliRuntime"
   * import * as Effect from "effect/Effect"
   * import * as Layer from "effect/Layer"
   * import * as Command from "effect/cli/Command"
   *
   * const root = Command.make("tool", {}, () => Effect.void)
   * // Pass the constructed program to your platform's runner.
   * const program = CliRuntime.main(Command.run(root, { version: "1.0.0" }), { platform: Layer.empty, exitCode: 3 })
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @param program - the CLI program, usually `Command.run(root, { version })`
   * @param options - the platform layer, and optionally the logger, environment services, exit codes and rendering
   * @category utilities
   * @since 0.0.0
   */
  static main<A, E, R, RP, EP>(
    program: Effect.Effect<A, E, R>,
    options: MainOptions<RP, EP> & { readonly env?: undefined }
  ): Effect.Effect<void, Error, Exclude<Exclude<R, CliExit>, RP>>;
  static main<A, E, R, RP, EP>(
    program: Effect.Effect<A, E, R>,
    options: MainOptions<RP, EP> & { readonly env: CliEnvOptions.Encoded & { readonly log: CliLogFileOptions.Encoded } }
  ): Effect.Effect<
    void,
    Error,
    | Exclude<Exclude<R, CliExit | CliEnvServices>, RP>
    | Exclude<Stdio.Stdio | Terminal.Terminal | FileSystem.FileSystem | Path.Path, RP>
  >;
  static main<A, E, R, RP, EP>(
    program: Effect.Effect<A, E, R>,
    options: MainOptions<RP, EP> & {
      readonly env: CliEnvOptions.Encoded & { readonly log?: CliLogOptions.Encoded & { readonly file?: undefined } };
    }
  ): Effect.Effect<
    void,
    Error,
    Exclude<Exclude<R, CliExit | CliEnvServices>, RP> | Exclude<Stdio.Stdio | Terminal.Terminal, RP>
  >;
  // A `CliEnvOptions`-typed env may carry `log.file` even when this call site cannot see it, so it keeps
  // `FileSystem | Path` required: dropping them here would let a file sink silently disappear at runtime.
  static main<A, E, R, RP, EP>(
    program: Effect.Effect<A, E, R>,
    options: MainOptions<RP, EP> & { readonly env: CliEnvOptions.Encoded }
  ): Effect.Effect<
    void,
    Error,
    | Exclude<Exclude<R, CliExit | CliEnvServices>, RP>
    | Exclude<Stdio.Stdio | Terminal.Terminal | FileSystem.FileSystem | Path.Path, RP>
  >;
  static main<A, E, R, RP, EP>(
    program: Effect.Effect<A, E, R>,
    options: MainOptions<RP, EP>
  ): Effect.Effect<
    void,
    Error,
    Exclude<Exclude<R, CliExit>, RP> | Exclude<Stdio.Stdio | Terminal.Terminal | FileSystem.FileSystem | Path.Path, RP>
  > {
    // Bound once, so the logger and the program below share one build of it (layers memoize by reference).
    const env = options.env === undefined ? undefined : CliEnv.layer(options.env);
    const envLog = options.env?.log;
    const logger = mainLogger(options, env);
    const inside =
      env === undefined
        ? Layer.empty
        : Layer.mergeAll(
            CliColor.formatterLayer(options.env?.formatter),
            // Records how a failure is rendered, from the services this layer provides, for the report outside it.
            Layer.effectDiscard(
              Effect.gen(function* () {
                // `env.spans` beats `env.spansEnvVar`, as `log.level` beats `log.envVar`; a bad value warns once,
                // delivered as `log.envVar`'s is: through a plain `CliLogger` alone, whatever the diagnostics level,
                // never into the `CliLog` sink.
                const { spans, invalid } = yield* readSpans(options.env?.spans, options.env?.spansEnvVar);
                if (invalid !== undefined) {
                  yield* Effect.scopedWith((scope) =>
                    Effect.flatMap(
                      Layer.buildWithScope(Logger.layer([makeCliLogger(envLog?.logger)]), scope),
                      (context) => Effect.provideContext(Effect.logWarning(invalid), context)
                    )
                  );
                }
                yield* refreshFailureTarget(
                  undefined,
                  O.getSomesStruct({
                    displayPath: O.fromUndefinedOr(options.env?.displayPath),
                    stackFrames: O.fromUndefinedOr(options.env?.stackFrames),
                    spans: O.fromUndefinedOr(spans),
                    appModule: O.fromUndefinedOr(options.env?.appModule),
                  })
                );
              })
            )
          ).pipe(Layer.provideMerge(env));

    const run = Effect.gen(function* () {
      // Inside the platform provide, so the rerouting sees the platform's own Formatter.
      yield* options.helpOnUsageError === "stderr" ? routeHelpOnUsageError(program) : program;
      yield* validateRunExit;
    }).pipe(
      provideBuilt(CliExit.layer),
      provideBuilt(inside),
      provideBuilt(options.platform),
      CliRuntime.reportFailures(options),
      provideBuilt(logger)
    );
    // One cell per run, outside failure reporting, which the environment layer fills from inside it.
    return Effect.suspend(() =>
      Effect.provideService(run, FailureTargetCell, MutableRef.make<FailureTarget.Encoded | undefined>(undefined))
    );
  }

  /**
   * Mark an error as already reported, carrying an exit code.
   *
   * **Gotchas**
   *
   * Exported because a program that reports a failure itself — a validation
   * command that prints its own diagnostics, say — needs the same two marks
   * and should not have to rediscover the inverted polarity.
   *
   * Under `CliRuntime.main` or {@link CliRuntime.reportFailures}, do NOT
   * print the failure yourself before failing with it: `reportFailures`
   * renders every error except a `ShowHelp` and a `CliError.UserError` whose
   * reported mark is `false`, so it would print twice. Fail with the marked
   * error and put any multi-line rendering in the `render` option instead. The
   * mark matters for a program run WITHOUT `reportFailures`, where it keeps the
   * runtime from reporting a failure the program already printed.
   *
   * A `CliError.UserError` marked with `reported` is treated as already
   * printed and is not rendered — use a different error type if the program
   * has not printed it. `reportFailures` cannot tell a `UserError` that
   * `Command.runWith` printed from one marked here: both carry the same `false`
   * mark. It does keep the code you pass: `reported(userError, 3)` exits `3`,
   * not `usageExitCode`.
   *
   * The marks are added in place when the argument is a mutable Error whose
   * marker properties can be defined. Its instance and subtype fields are
   * preserved. If marker installation fails, a fresh marked Error retains
   * the original failure as its cause and carries the selected exit code.
   *
   * The `E extends Error` constraint is structural. An Error lookalike is
   * wrapped at runtime and its subtype fields are discarded, so the generic
   * overload returns `E | Error`. Narrow the result before reading subtype
   * fields or recovering a tagged error.
   *
   * **Example** (Preserve a reported error instance)
   *
   * ```ts
   * import { CliRuntime } from "@beep/cli-kit/CliRuntime"
   *
   * const error = new Error("invalid configuration")
   * console.log(CliRuntime.reported(error, 3) === error) // true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static reported<E extends Error>(error: E, exitCode?: number): E | Error;
  static reported(error: unknown, exitCode?: number): Error;
  static reported(error: unknown, exitCode = 1): Error {
    const marked =
      error instanceof Error
        ? error
        : CliRuntimeError.make({
            message: Result.getOrElse(
              Result.try(() => String(error)),
              () => "[unprintable failure]"
            ),
          });
    const install = (target: Error): Error => {
      // A prototype getter needs an own descriptor rather than assignment.
      for (const [key, value] of [
        [Runtime.errorReported, false],
        [Runtime.errorExitCode, exitCode],
      ] as const) {
        Object.defineProperty(target, key, { value, writable: true, configurable: true, enumerable: false });
      }
      return target;
    };
    return Result.getOrElse(
      Result.try(() => install(marked)),
      () => install(CliRuntimeError.make({ message: marked.message, cause: error }))
    );
  }
}
