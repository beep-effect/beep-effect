/**
 * Account usage errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Accounts/Accounts.errors");

/**
 * Failure category for account usage operations.
 *
 * **Example** (Narrow a reason)
 *
 * ```ts
 * import { AccountsErrorReason } from "@beep/repo-cli/test/Accounts"
 *
 * console.log(AccountsErrorReason.is.login("login")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const AccountsErrorReason = LiteralKit(["io", "decode", "denied", "http", "login", "usage"]).pipe(
  $I.annoteSchema("AccountsErrorReason", { description: "Failure category for account usage operations." })
);

/**
 * Failure category for account usage operations.
 *
 * **Details**
 *
 * `login` means the stored login is missing or the provider no longer accepts
 * it; every other reason is a read, network, decode, or argument failure.
 *
 * @category errors
 * @since 0.0.0
 */
export type AccountsErrorReason = typeof AccountsErrorReason.Type;

/**
 * An account usage operation failed.
 *
 * **Example** (Construct an error)
 *
 * ```ts
 * import { AccountsError } from "@beep/repo-cli/test/Accounts"
 *
 * console.log(AccountsError.make({ reason: "usage", message: "bad --provider" })._tag) // "AccountsError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AccountsError extends S.TaggedError<AccountsError>($I`AccountsError`)(
  "AccountsError",
  { reason: AccountsErrorReason, message: S.String, cause: S.optionalKey(S.Defect({ includeStack: true })) },
  $I.annoteError<AccountsError>("AccountsError", {
    description: "An account store read or write, a provider request, or a usage decode failed.",
  })
) {
  /** Process exit code reported when this error reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = 1;
}
