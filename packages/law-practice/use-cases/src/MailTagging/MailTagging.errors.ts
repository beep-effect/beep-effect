/**
 * Typed failures of the mail-tagging ports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("MailTagging/MailTagging.errors");

const causeField = S.OptionFromOptionalKey(
  S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))
).pipe(S.withConstructorDefault(Effect.succeedNone));

/**
 * Collaborator a mail-tagging use-case reaches through a port.
 *
 * **Example** (Guard a port name)
 *
 * ```ts
 * import { MailTaggingPort } from "@beep/law-practice-use-cases/MailTagging"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MailTaggingPort)("Mailbox")) // true
 * console.log(S.is(MailTaggingPort)("Calendar")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MailTaggingPort = LiteralKit([
  "Mailbox",
  "MatterDirectory",
  "MatterFolderDirectory",
  "DocumentStore",
  "ContentHasher",
]).pipe(
  $I.annoteSchema("MailTaggingPort", {
    description: "Collaborator a mail-tagging use-case reaches through a port.",
  })
);

/**
 * Runtime type for {@link MailTaggingPort}.
 *
 * @category models
 * @since 0.0.0
 */
export type MailTaggingPort = typeof MailTaggingPort.Type;

/**
 * A mailbox, matter-directory, folder-directory, document-store, or hashing
 * call could not be served.
 *
 * **When to use**
 *
 * Use when an adapter must report a provider failure. `reason` carries ids, counts,
 * and status text only: never a subject, a body, or a file name.
 *
 * **Example** (Report a failed category write)
 *
 * ```ts
 * import { MailTaggingPortError } from "@beep/law-practice-use-cases/MailTagging"
 *
 * const error = MailTaggingPortError.during("Mailbox", "setCategories", "HTTP 503")
 * console.log(error.port) // "Mailbox"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MailTaggingPortError extends S.TaggedError<MailTaggingPortError>($I`MailTaggingPortError`)(
  "MailTaggingPortError",
  {
    cause: causeField.annotateKey({
      description: "Optional underlying provider defect.",
    }),
    port: MailTaggingPort.annotateKey({
      description: "Port whose call failed.",
    }),
    operation: S.NonEmptyString.annotateKey({
      description: "Port method that failed.",
    }),
    reason: S.NonEmptyString.annotateKey({
      description: "Diagnostic made of ids, counts, and status text only.",
    }),
  },
  $I.annoteError<MailTaggingPortError>("MailTaggingPortError", {
    title: "Mail-tagging port unavailable",
    description: "A mail-tagging port call could not be served.",
  })
) {
  /**
   * Builds the failure of one port method.
   *
   * @param port - Port whose call failed.
   * @param operation - Port method that failed.
   * @param reason - Diagnostic made of ids, counts, and status text only.
   * @param cause - Optional underlying provider defect.
   * @returns The typed port failure.
   * @category constructors
   * @since 0.0.0
   */
  static readonly during = (
    port: MailTaggingPort,
    operation: string,
    reason: string,
    cause?: unknown
  ): MailTaggingPortError => MailTaggingPortError.make({ cause: O.fromUndefinedOr(cause), port, operation, reason });
}

/**
 * Durable state file a mail-tagging run reads and writes.
 *
 * **Example** (Guard a state store name)
 *
 * ```ts
 * import { MailTaggingStateStore } from "@beep/law-practice-use-cases/MailTagging"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MailTaggingStateStore)("tag-ledger")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MailTaggingStateStore = LiteralKit(["tag-ledger", "filing-ledger", "checkpoint"]).pipe(
  $I.annoteSchema("MailTaggingStateStore", {
    description: "Durable state a mail-tagging run reads and writes.",
  })
);

/**
 * Runtime type for {@link MailTaggingStateStore}.
 *
 * @category models
 * @since 0.0.0
 */
export type MailTaggingStateStore = typeof MailTaggingStateStore.Type;

/**
 * Why a ledger or the checkpoint could not be used.
 *
 * **Example** (Guard a state failure reason)
 *
 * ```ts
 * import { MailTaggingStateFailure } from "@beep/law-practice-use-cases/MailTagging"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MailTaggingStateFailure)("corrupt")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MailTaggingStateFailure = LiteralKit(["unavailable", "corrupt"]).pipe(
  $I.annoteSchema("MailTaggingStateFailure", {
    description: "Whether mail-tagging state could not be reached or could not be decoded.",
  })
);

/**
 * Runtime type for {@link MailTaggingStateFailure}.
 *
 * @category models
 * @since 0.0.0
 */
export type MailTaggingStateFailure = typeof MailTaggingStateFailure.Type;

/**
 * The tag ledger, the filing ledger, or the checkpoint could not be read or
 * written.
 *
 * **Details**
 *
 * A `corrupt` failure names the file and, for a ledger, the 1-based line that
 * did not decode. It never carries the line's content, and it carries no
 * cause, because a schema failure quotes the value it rejected.
 *
 * **Example** (Name a corrupt ledger line)
 *
 * ```ts
 * import { MailTaggingStateError } from "@beep/law-practice-use-cases/MailTagging"
 * import * as O from "effect/Option"
 *
 * const error = MailTaggingStateError.corrupt("tag-ledger", "tag-ledger.jsonl", O.some(3))
 * console.log(error.message) // "tag-ledger.jsonl line 3 did not decode"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MailTaggingStateError extends S.TaggedError<MailTaggingStateError>($I`MailTaggingStateError`)(
  "MailTaggingStateError",
  {
    cause: causeField.annotateKey({
      description: "Optional underlying platform defect; absent for corrupt content.",
    }),
    store: MailTaggingStateStore.annotateKey({
      description: "State the failure concerns.",
    }),
    failure: MailTaggingStateFailure.annotateKey({
      description: "Whether the state was unreachable or undecodable.",
    }),
    file: S.NonEmptyString.annotateKey({
      description: "File name of the state, without its directory.",
    }),
    line: S.OptionFromOptionalKey(S.Natural).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "1-based ledger line that did not decode, when the failure is one line.",
    }),
    message: S.NonEmptyString.annotateKey({
      description: "Diagnostic naming the file and line; never the content.",
    }),
  },
  $I.annoteError<MailTaggingStateError>("MailTaggingStateError", {
    title: "Mail-tagging state unusable",
    description: "A mail-tagging ledger or checkpoint could not be read or written.",
  })
) {
  /**
   * Builds the failure for content that did not decode.
   *
   * @param store - State the failure concerns.
   * @param file - File name of the state.
   * @param line - 1-based ledger line, or none for a whole-file document.
   * @returns The typed fail-closed state failure.
   * @category constructors
   * @since 0.0.0
   */
  static readonly corrupt = (
    store: MailTaggingStateStore,
    file: string,
    line: O.Option<number>
  ): MailTaggingStateError =>
    MailTaggingStateError.make({
      store,
      failure: "corrupt",
      file,
      line,
      message: O.match(line, {
        onNone: () => `${file} did not decode`,
        onSome: (number) => `${file} line ${number} did not decode`,
      }),
    });

  /**
   * Builds the failure for state that could not be reached.
   *
   * @param store - State the failure concerns.
   * @param file - File name of the state.
   * @param operation - What was attempted, such as `append` or `read`.
   * @param cause - Optional underlying platform defect.
   * @returns The typed state-unavailable failure.
   * @category constructors
   * @since 0.0.0
   */
  static readonly unavailable = (
    store: MailTaggingStateStore,
    file: string,
    operation: string,
    cause?: unknown
  ): MailTaggingStateError =>
    MailTaggingStateError.make({
      cause: O.fromUndefinedOr(cause),
      store,
      failure: "unavailable",
      file,
      message: `${file} ${operation} failed`,
    });
}
