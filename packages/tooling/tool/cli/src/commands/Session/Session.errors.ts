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
 * @category errors
 * @since 0.0.0
 */
export const SessionLedgerErrorReason = LiteralKit(["io", "decode", "denied", "git", "usage"]).pipe(
  $I.annoteSchema("SessionLedgerErrorReason", { description: "Failure category for session ledger operations." })
);

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
