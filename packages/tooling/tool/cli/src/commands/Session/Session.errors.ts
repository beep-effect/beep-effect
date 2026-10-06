/**
 * Session ledger errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Runtime } from "effect";
import * as S from "effect/Schema";

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
