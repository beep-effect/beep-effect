/**
 * Shared JSON codecs for the rule harnesses.
 *
 * Both the Biome (`harness.ts`) and oxlint (`oxlint-harness.ts`) harnesses write a JSON config
 * file and decode a JSON report through `effect/Schema` rather than `JSON.parse`/`JSON.stringify`.
 * The config encoder is identical across harnesses, and the report decoder differs only by the
 * report schema — both live here so neither harness re-implements the codec boilerplate.
 */
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

/** Encode an arbitrary config object to a JSON string (for the throwaway lint config file). */
// unary by contract: `options` stays reachable through `S.encodeUnknownSync(...)`;
// a dual is undecidable here because `input` is `unknown`.
export const encodeConfig: (input: unknown) => string = UnknownFromJsonString.encodeUnknownSync;

/**
 * Reports malformed subprocess JSON without converting it into an empty lint report.
 *
 * **Example** (Inspect the failed output)
 *
 * ```ts
 * import { JsonReportError } from "./codec.ts"
 * const error = JsonReportError.make({ stdout: "invalid", cause: "invalid JSON" })
 * console.log(error.stdout) // invalid
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class JsonReportError extends S.TaggedError<JsonReportError>()("JsonReportError", {
  stdout: S.String,
  cause: S.Defect({ includeStack: true }),
}) {}

/**
 * Decode subprocess stdout with the supplied report schema, retaining failed output
 * and its decoding cause in the error channel.
 *
 * **Example** (Decode a report)
 *
 * ```ts
 * import { jsonReportParser } from "./codec.ts"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * const report = jsonReportParser(S.Struct({ count: S.Number }))("{\"count\":2}")
 * const count = Effect.map(report, (value) => value.count)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const jsonReportParser: {
  <Report extends S.Top>(
    report: Report
  ): (stdout: string) => Effect.Effect<Report["Type"], JsonReportError, Report["DecodingServices"]>;
  <Report extends S.Top>(
    stdout: string,
    report: Report
  ): Effect.Effect<Report["Type"], JsonReportError, Report["DecodingServices"]>;
} = dual(2, <Report extends S.Top>(stdout: string, report: Report) =>
  S.decodeEffect(S.fromJsonString(report))(stdout).pipe(
    Effect.mapError((cause) => JsonReportError.make({ stdout, cause }))
  )
);

/**
 * Retains the diagnostics of an abnormal native linter termination.
 *
 * **Example** (Inspect a failed invocation)
 *
 * ```ts
 * import { LinterProcessError } from "./codec.ts"
 * import * as O from "effect/Option"
 * const error = LinterProcessError.make({
 *   exitCode: 2, stdout: "", stderr: "invalid configuration", signal: O.none(),
 *   timedOut: false, outputTruncated: false
 * })
 * console.log(error.stderr) // invalid configuration
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LinterProcessError extends S.TaggedError<LinterProcessError>()("LinterProcessError", {
  exitCode: S.Int,
  stdout: S.String,
  stderr: S.String,
  signal: S.Option(S.String),
  timedOut: S.Boolean,
  outputTruncated: S.Boolean,
}) {}

const isLintExit = S.is(S.Literals([0, 1]));

/**
 * Accept normal lint outcomes (zero or one) and preserve abnormal process diagnostics.
 * Signals, timeouts, and truncated output always fail, even with an accepted exit code.
 *
 * **Example** (Validate a native result)
 *
 * ```ts
 * import { validateLinterProcess } from "./codec.ts"
 * const result = Bun.spawnSync(["bunx", "oxlint", "--version"])
 * const checked = validateLinterProcess(result)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateLinterProcess = (result: Bun.SyncSubprocess<"pipe", "pipe">) => {
  const signal = O.fromNullishOr(result.signalCode);
  return isLintExit(result.exitCode) &&
    O.isNone(signal) &&
    result.exitedDueToTimeout !== true &&
    result.exitedDueToMaxBuffer !== true
    ? Effect.succeed(result)
    : Effect.fail(
        LinterProcessError.make({
          exitCode: result.exitCode,
          stdout: result.stdout.toString(),
          stderr: result.stderr.toString(),
          signal,
          timedOut: result.exitedDueToTimeout === true,
          outputTruncated: result.exitedDueToMaxBuffer === true,
        })
      );
};
