/**
 * Session ledger errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import type * as PlatformError from "effect/PlatformError";

const $I = $RepoCliId.create("commands/Session/Session.errors");

/**
 * Failure category for the session ledger.
 *
 * **Example** (Narrow a reason)
 *
 * ```ts
 * import { SessionLedgerErrorReason } from "@beep/repo-cli/test/Session"
 *
 * console.log(SessionLedgerErrorReason.is.usage("usage")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const SessionLedgerErrorReason = LiteralKit(["io", "decode", "denied", "git", "usage"]).pipe(
  $I.annoteSchema("SessionLedgerErrorReason", { description: "Failure category for session ledger operations." })
);

/**
 * Failure category for session ledger operations.
 *
 * **Example** (Annotate a reason)
 *
 * ```ts
 * import type { SessionLedgerErrorReason } from "@beep/repo-cli/test/Session"
 *
 * const reason: SessionLedgerErrorReason = "io"
 * console.log(reason) // "io"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type SessionLedgerErrorReason = typeof SessionLedgerErrorReason.Type;

/**
 * A session ledger operation failed.
 *
 * **Example** (Construct an error)
 *
 * ```ts
 * import { SessionLedgerError } from "@beep/repo-cli/test/Session"
 *
 * console.log(SessionLedgerError.make({ reason: "usage", message: "bad --state" })._tag) // "SessionLedgerError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SessionLedgerError extends S.TaggedError<SessionLedgerError>($I`SessionLedgerError`)(
  "SessionLedgerError",
  { reason: SessionLedgerErrorReason, message: S.String, cause: S.optionalKey(S.Defect({ includeStack: true })) },
  $I.annoteError<SessionLedgerError>("SessionLedgerError", {
    description: "A session ledger read, write, or git probe failed.",
  })
) {
  /** Process exit code reported when this error reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = 1;
}

/**
 * Map a filesystem failure on a session state file to the session error,
 * keeping a permission denial apart from every other I/O failure.
 *
 * **Example** (Describe the mapper)
 *
 * ```ts
 * import { sessionStatePlatformError } from "@beep/repo-cli/test/Session"
 *
 * console.log(typeof sessionStatePlatformError) // "function"
 * ```
 *
 * @param cause - The platform error raised by the filesystem.
 * @returns A `denied` error for a permission failure, `io` otherwise.
 * @category errors
 * @since 0.0.0
 */
export const sessionStatePlatformError = (cause: PlatformError.PlatformError): SessionLedgerError =>
  SessionLedgerError.make({
    reason: cause.reason._tag === "PermissionDenied" ? "denied" : "io",
    message: cause.message,
    cause,
  });

/**
 * A usage error: the operator passed a flag value the session commands cannot act on.
 *
 * **Example** (Make a usage error)
 *
 * ```ts
 * import { sessionUsageError } from "@beep/repo-cli/test/Session"
 *
 * console.log(sessionUsageError("--next must say what comes next.").reason) // "usage"
 * ```
 *
 * @param message - What was wrong with the invocation.
 * @returns The typed usage error.
 * @category errors
 * @since 0.0.0
 */
export const sessionUsageError = (message: string): SessionLedgerError =>
  SessionLedgerError.make({ reason: "usage", message });

/**
 * The session commands' CLI error boundary: a typed session failure becomes
 * one `[session] ...` line and a non-zero exit.
 *
 * **Example** (Describe the boundary)
 *
 * ```ts
 * import { reportSessionFailure } from "@beep/repo-cli/test/Session"
 *
 * console.log(typeof reportSessionFailure) // "function"
 * ```
 *
 * @param effect - A command body that may fail with a session error.
 * @returns The same effect with the session error reported as a CLI exit.
 * @category errors
 * @since 0.0.0
 */
export const reportSessionFailure = <A, R>(effect: Effect.Effect<A, SessionLedgerError, R>) =>
  effect.pipe(Effect.catchTag("SessionLedgerError", (error) => failWithReportedExit(`[session] ${error.message}`)));
