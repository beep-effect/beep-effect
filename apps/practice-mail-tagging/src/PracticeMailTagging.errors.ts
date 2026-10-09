/**
 * The one typed failure the mail-tagging commands end with, and its exit code.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeMailTaggingId } from "@beep/identity/packages";
import { MailTaggingPortFailure } from "@beep/law-practice-use-cases/MailTagging";
import { M365ErrorReason } from "@beep/m365";
import { LiteralKit } from "@beep/schema";
import * as Match from "effect/Match";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import type { BoxError } from "@beep/box";
import type { MailTaggingPortError, MailTaggingStateError } from "@beep/law-practice-use-cases/MailTagging";
import type { M365Error } from "@beep/m365";
import type * as Config from "effect/Config";

const $I = $PracticeMailTaggingId.create("PracticeMailTagging.errors");

/**
 * Why a mail-tagging command ended without doing its work.
 *
 * **Details**
 *
 * `refused` is a write the operator did not confirm. `throttled` is a
 * provider rate limit or quota refusal, which ends a `watch` process.
 * `failed` is every other failure.
 *
 * **Example** (Guard a failure kind)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PracticeMailTaggingFailureKind } from "@/PracticeMailTagging.errors"
 *
 * console.log(S.is(PracticeMailTaggingFailureKind)("throttled")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PracticeMailTaggingFailureKind = LiteralKit(["failed", "refused", "throttled"]).pipe(
  $I.annoteSchema("PracticeMailTaggingFailureKind", {
    description: "Why a mail-tagging command ended without doing its work.",
  })
);

/**
 * Type-level union produced by {@link PracticeMailTaggingFailureKind}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PracticeMailTaggingFailureKind = typeof PracticeMailTaggingFailureKind.Type;

/**
 * Every failure one pass can end with before it is summarized.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MailTaggingPassFailure = MailTaggingPortError | MailTaggingStateError | M365Error | BoxError;

const throttledWhen = (throttled: boolean): PracticeMailTaggingFailureKind => (throttled ? "throttled" : "failed");

/**
 * Failure of one mail-tagging command.
 *
 * **Details**
 *
 * `message` is made of ids, counts, file paths of private state, and status
 * text. It never carries a subject, a sender, a file name, or a matter key,
 * and the provider's own cause is left out, so this error is safe to log.
 *
 * **Example** (Refuse an unconfirmed write)
 *
 * ```ts
 * import { PracticeMailTaggingError, practiceMailTaggingExitCode } from "@/PracticeMailTagging.errors"
 *
 * const error = PracticeMailTaggingError.refused("apply needs --yes")
 * console.log(practiceMailTaggingExitCode(error.kind)) // 2
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PracticeMailTaggingError extends S.TaggedError<PracticeMailTaggingError>($I`PracticeMailTaggingError`)(
  "PracticeMailTaggingError",
  {
    kind: PracticeMailTaggingFailureKind.annotateKey({
      description: "Whether the command was refused, throttled, or failed.",
    }),
    source: S.NonEmptyString.annotateKey({
      description: "Tag of the failure this error summarizes.",
    }),
    message: S.NonEmptyString.annotateKey({
      description: "Diagnostic made of ids, counts, state paths, and status text only.",
    }),
  },
  $I.annoteError<PracticeMailTaggingError>("PracticeMailTaggingError", {
    title: "Mail-tagging command failed",
    description: "A mail-tagging command was refused, throttled, or failed.",
  })
) {
  /**
   * Exit code the platform runner ends the process with for this failure.
   *
   * @returns 1 for `failed`, 2 for `refused`, 3 for `throttled`.
   * @category getters
   * @since 0.0.0
   */
  override get [Runtime.errorExitCode](): number {
    return practiceMailTaggingExitCode(this.kind);
  }

  /**
   * Builds the refusal of a write the operator did not confirm.
   *
   * @param message - What the operator must pass to confirm.
   * @returns The typed refusal.
   * @category constructors
   * @since 0.0.0
   */
  static readonly refused = (message: string): PracticeMailTaggingError =>
    PracticeMailTaggingError.make({ kind: "refused", source: "Confirmation", message });

  /**
   * Summarizes a failed pass without its provider cause.
   *
   * @param error - Port, state, or driver failure of the pass.
   * @returns The typed failure; `throttled` for a provider rate limit.
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromPass: (error: MailTaggingPassFailure) => PracticeMailTaggingError =
    Match.type<MailTaggingPassFailure>().pipe(
      Match.tag("MailTaggingPortError", (error) =>
        PracticeMailTaggingError.make({
          kind: throttledWhen(MailTaggingPortFailure.is.throttled(error.failure)),
          source: error._tag,
          message: `${error.port}.${error.operation}: ${error.reason}`,
        })
      ),
      Match.tag("MailTaggingStateError", (error) =>
        PracticeMailTaggingError.make({
          kind: "failed",
          source: error._tag,
          message: `${error.store} ${error.failure} at ${error.file}: ${error.message}`,
        })
      ),
      Match.tag("M365Error", (error) =>
        PracticeMailTaggingError.make({
          kind: throttledWhen(M365ErrorReason.is.throttled(error.reason)),
          source: error._tag,
          message: `Microsoft 365 driver: ${error.reason}`,
        })
      ),
      Match.tag("BoxError", (error) =>
        PracticeMailTaggingError.make({ kind: "failed", source: error._tag, message: `Box driver: ${error.reason}` })
      ),
      Match.exhaustive
    );

  /**
   * Summarizes a settings read that failed.
   *
   * @param error - Failure of an `effect/Config` read.
   * @returns The typed failure naming the missing or invalid setting.
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromConfig = (error: Config.ConfigError): PracticeMailTaggingError =>
    PracticeMailTaggingError.make({ kind: "failed", source: "ConfigError", message: error.message });
}

/**
 * Process exit code of a failure kind.
 *
 * **Details**
 *
 * `failed` exits 1, `refused` exits 2, and `throttled` exits 3. The sample
 * unit lists 2 and 3 as codes systemd must not restart on.
 *
 * **Example** (Read the exit code of a throttled run)
 *
 * ```ts
 * import { practiceMailTaggingExitCode } from "@/PracticeMailTagging.errors"
 *
 * console.log(practiceMailTaggingExitCode("throttled")) // 3
 * ```
 *
 * @param kind - Why the command ended.
 * @returns The exit code the process ends with.
 * @category getters
 * @since 0.0.0
 */
export const practiceMailTaggingExitCode: (kind: PracticeMailTaggingFailureKind) => number =
  PracticeMailTaggingFailureKind.$match({
    failed: () => 1,
    refused: () => 2,
    throttled: () => 3,
  });
