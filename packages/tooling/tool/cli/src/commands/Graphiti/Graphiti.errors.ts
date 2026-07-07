/**
 * Tagged errors for the Graphiti command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { TaggedErrorClass } from "@beep/schema";
import { Err } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Runtime } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Graphiti/Graphiti.errors");

type GraphitiProxyOpsErrorOptions =
  | undefined
  | {
      readonly command?: undefined | string;
      readonly exitCode?: undefined | number;
    };

/**
 * Raised when graphiti proxy configuration cannot be loaded.
 *
 * @example
 * ```ts
 * console.log("GraphitiProxyConfigLoadError")
 * ```
 * @category models
 * @since 0.0.0
 */
export class GraphitiProxyConfigLoadError extends TaggedErrorClass<GraphitiProxyConfigLoadError>(
  $I`GraphitiProxyConfigLoadError`
)(
  "GraphitiProxyConfigLoadError",
  {
    message: S.String,
    cause: S.optionalKey(S.Defect({ includeStack: true })),
  },
  $I.annote("GraphitiProxyConfigLoadError", {
    description: "Raised when graphiti proxy config cannot be decoded from Effect Config values.",
  })
) {
  /**
   * Construct a Graphiti proxy config load error from a cause and message.
   *
   * @category constructors
   */
  static readonly new: {
    (cause: unknown, message: string): GraphitiProxyConfigLoadError;
    (message: string): (cause: unknown) => GraphitiProxyConfigLoadError;
  } = dual(
    2,
    (cause: unknown, message: string): GraphitiProxyConfigLoadError =>
      GraphitiProxyConfigLoadError.make({
        message,
        cause,
      })
  );

  static readonly mapError = Err.mapToError(this.new);
}

/**
 * Typed failure for Graphiti proxy operational helpers.
 *
 * @example
 * ```ts
 * import { GraphitiProxyOpsError } from "@beep/repo-cli/commands/Graphiti/internal/ProxyOps"
 * const error = new GraphitiProxyOpsError({ message: "failed" })
 * ```
 * @category errors
 * @since 0.0.0
 */
export class GraphitiProxyOpsError extends TaggedErrorClass<GraphitiProxyOpsError>($I`GraphitiProxyOpsError`)(
  "GraphitiProxyOpsError",
  {
    message: S.String,
    command: S.optionalKey(S.String),
    exitCode: S.optionalKey(S.Finite),
    cause: S.optionalKey(S.Defect({ includeStack: true })),
  },
  $I.annote("GraphitiProxyOpsError", {
    description: "Failure raised while managing the local Graphiti proxy.",
  })
) {
  /** Process exit code reported when this error reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = this.exitCode ?? 1;

  /**
   * Construct a Graphiti proxy operations error from a cause and options.
   *
   * @category constructors
   */
  static readonly new: {
    (cause: unknown, message: string, opts?: GraphitiProxyOpsErrorOptions): GraphitiProxyOpsError;
    (message: string, opts?: GraphitiProxyOpsErrorOptions): (cause: unknown) => GraphitiProxyOpsError;
  } = dual(
    3,
    (cause: unknown, message: string, { command, exitCode } = {}): GraphitiProxyOpsError =>
      GraphitiProxyOpsError.make({
        cause,
        message,
        ...O.getSomesStruct({
          command: O.fromUndefinedOr(command),
          exitCode: O.fromUndefinedOr(exitCode),
        }),
      })
  );

  static readonly mapError = Err.mapToError(this.new);
}
