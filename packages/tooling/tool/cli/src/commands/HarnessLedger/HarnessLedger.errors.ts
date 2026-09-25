/**
 * Tagged errors for the harness ledger command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Defect } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/HarnessLedger/HarnessLedger.errors");

/**
 * Failure raised when harness ledger command input is malformed.
 *
 * **Example** (Reject a malformed edit reference)
 *
 * ```ts
 * import { HarnessLedgerInputError } from "@beep/repo-cli/commands/HarnessLedger"
 *
 * const error = HarnessLedgerInputError.new('--edit "tree:abc" is not commit:<sha>, diff:<sha256>, or pending.')
 * console.log(error._tag) // "HarnessLedgerInputError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HarnessLedgerInputError extends S.TaggedError<HarnessLedgerInputError>($I`HarnessLedgerInputError`)(
  "HarnessLedgerInputError",
  {
    message: S.String,
  },
  $I.annoteError<HarnessLedgerInputError>("HarnessLedgerInputError", {
    description: "Harness ledger command input failed validation before any row was written.",
  })
) {
  /**
   * Construct an input error.
   *
   * @param message - Diagnostic describing the rejected input.
   * @returns A typed input error.
   * @category constructors
   * @since 0.0.0
   */
  static readonly new = (message: string): HarnessLedgerInputError => HarnessLedgerInputError.make({ message });
}

/**
 * Failure raised when a disposition references a row that is missing or is
 * no longer the latest row of its chain.
 *
 * **Example** (Refuse a superseded reference)
 *
 * ```ts
 * import { HarnessLedgerChainError } from "@beep/repo-cli/commands/HarnessLedger"
 *
 * const error = HarnessLedgerChainError.new("hl-20260925-0a1b2c3d", "superseded by hl-20260926-11111111")
 * console.log(error.rowId) // "hl-20260925-0a1b2c3d"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HarnessLedgerChainError extends S.TaggedError<HarnessLedgerChainError>($I`HarnessLedgerChainError`)(
  "HarnessLedgerChainError",
  {
    rowId: S.String,
    message: S.String,
  },
  $I.annoteError<HarnessLedgerChainError>("HarnessLedgerChainError", {
    description: "A referenced ledger row does not exist or is not the latest row of its chain.",
  })
) {
  /**
   * Construct a chain error.
   *
   * @param rowId - Row id the caller referenced.
   * @param message - Diagnostic describing why the reference was refused.
   * @returns A typed chain error.
   * @category constructors
   * @since 0.0.0
   */
  static readonly new = (rowId: string, message: string): HarnessLedgerChainError =>
    HarnessLedgerChainError.make({ rowId, message });
}

/**
 * Failure raised while reading, decoding, fingerprinting, or appending ledger
 * and hook-pulse files.
 *
 * **Example** (Wrap an append failure)
 *
 * ```ts
 * import { HarnessLedgerIoError } from "@beep/repo-cli/commands/HarnessLedger"
 *
 * const error = HarnessLedgerIoError.new("Failed to append harness-ledger/rows/2026-09.jsonl.", new Error("EACCES"))
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HarnessLedgerIoError extends S.TaggedError<HarnessLedgerIoError>($I`HarnessLedgerIoError`)(
  "HarnessLedgerIoError",
  {
    cause: Defect({ includeStack: true }),
    message: S.String,
  },
  $I.annoteError<HarnessLedgerIoError>("HarnessLedgerIoError", {
    description: "Reading, decoding, fingerprinting, or appending ledger or hook-pulse files failed.",
  })
) {
  /**
   * Construct an IO error.
   *
   * @param message - Diagnostic naming the failed operation.
   * @param cause - Underlying failure.
   * @returns A typed IO error.
   * @category constructors
   * @since 0.0.0
   */
  static readonly new = (message: string, cause: unknown): HarnessLedgerIoError =>
    HarnessLedgerIoError.make({ cause, message });

  /**
   * Curried constructor for `Effect.mapError`.
   *
   * @param message - Diagnostic naming the failed operation.
   * @returns A function wrapping a cause into a typed IO error.
   * @category constructors
   * @since 0.0.0
   */
  static readonly wrap =
    (message: string) =>
    (cause: unknown): HarnessLedgerIoError =>
      HarnessLedgerIoError.new(message, cause);
}

/**
 * Failure raised when another writer holds the ledger write fence.
 *
 * **Details**
 *
 * Every ledger append runs under an exclusive `harness-ledger/.write.lock`
 * created with the `wx` open flag. A second writer fails closed with this
 * error instead of forking a chain; it never removes a lock it did not create.
 *
 * **Example** (Report a held write fence)
 *
 * ```ts
 * import { HarnessLedgerBusyError } from "@beep/repo-cli/commands/HarnessLedger"
 *
 * const error = HarnessLedgerBusyError.new("/repo/harness-ledger/.write.lock")
 * console.log(error._tag) // "HarnessLedgerBusyError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HarnessLedgerBusyError extends S.TaggedError<HarnessLedgerBusyError>($I`HarnessLedgerBusyError`)(
  "HarnessLedgerBusyError",
  {
    lockFile: S.String,
    message: S.String,
  },
  $I.annoteError<HarnessLedgerBusyError>("HarnessLedgerBusyError", {
    description: "Another writer holds the harness ledger write fence; nothing was appended.",
  })
) {
  /**
   * Construct a busy error for a held lock file.
   *
   * @param lockFile - Absolute path of the held write fence.
   * @returns A typed busy error naming the lock file.
   * @category constructors
   * @since 0.0.0
   */
  static readonly new = (lockFile: string): HarnessLedgerBusyError =>
    HarnessLedgerBusyError.make({
      lockFile,
      message: `Harness ledger write fence ${lockFile} is held by another writer; retry after it exits, or remove the lock once no writer is running.`,
    });
}

/**
 * Union of every harness ledger command failure.
 *
 * @category errors
 * @since 0.0.0
 */
export type HarnessLedgerCommandError =
  | HarnessLedgerBusyError
  | HarnessLedgerChainError
  | HarnessLedgerInputError
  | HarnessLedgerIoError;
