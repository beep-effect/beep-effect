/**
 * The typed failure the docket intake commands end with, and its exit code.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocketIntakeId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import type { DocketIntakeError } from "@beep/law-practice-use-cases/DocketIntake";

const $I = $DocketIntakeId.create("Errors");

// Why a command ended without doing its work: `refused` is a write the operator did not confirm
// with `--yes`, `throttled` is Graph refusing with a rate limit, and `failed` is everything else.
const DocketIntakeFailureKind = LiteralKit(["failed", "refused", "throttled"]).pipe(
  $I.annoteSchema("DocketIntakeFailureKind", {
    description: "Why a docket intake command ended without doing its work.",
  })
);

/**
 * Why a docket intake command ended without doing its work: `refused`,
 * `throttled` or `failed`.
 *
 * **Example** (Type a failure kind)
 *
 * ```ts
 * import type { DocketIntakeFailureKind } from "../../src/Errors.ts"
 *
 * const kind: DocketIntakeFailureKind = "throttled"
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocketIntakeFailureKind = typeof DocketIntakeFailureKind.Type;

/**
 * Process exit code of a failure kind: 1 for `failed`, 2 for `refused` and 3
 * for `throttled`.
 *
 * **Example** (Read the exit code of a refusal)
 *
 * ```ts
 * import { docketIntakeExitCode } from "../../src/Errors.ts"
 *
 * console.log(docketIntakeExitCode("refused")) // 2
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const docketIntakeExitCode: (kind: DocketIntakeFailureKind) => number = DocketIntakeFailureKind.$match({
  failed: () => 1,
  refused: () => 2,
  throttled: () => 3,
});

/**
 * Failure of one docket intake command. Its message is made of ids, stage
 * names and technical labels only, so it is safe to log.
 *
 * **Example** (Refuse an unconfirmed undo)
 *
 * ```ts
 * import { DocketIntakeCommandError } from "../../src/Errors.ts"
 *
 * console.log(DocketIntakeCommandError.refused("undo writes; pass --yes").kind) // "refused"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DocketIntakeCommandError extends S.TaggedError<DocketIntakeCommandError>($I`DocketIntakeCommandError`)(
  "DocketIntakeCommandError",
  {
    kind: DocketIntakeFailureKind.annotateKey({ description: "Whether the command was refused, throttled or failed." }),
    message: S.NonEmptyString.annotateKey({ description: "Diagnostic made of ids, stages and labels only." }),
  },
  $I.annote("DocketIntakeCommandError", { description: "A docket intake command was refused, throttled or failed." })
) {
  /**
   * The exit code the process ends with for this failure.
   *
   * @category getters
   * @since 0.0.0
   */
  override get [Runtime.errorExitCode](): number {
    return docketIntakeExitCode(this.kind);
  }

  /**
   * The refusal of a write the operator did not confirm.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly refused = (message: string): DocketIntakeCommandError =>
    DocketIntakeCommandError.make({ kind: "refused", message });

  /**
   * A failure that is not a pipeline error, such as an unknown run id.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly failed = (message: string): DocketIntakeCommandError =>
    DocketIntakeCommandError.make({ kind: "failed", message });

  /**
   * A pipeline or adapter failure; `throttled` when Graph refused with a rate limit.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromIntake = (error: DocketIntakeError): DocketIntakeCommandError =>
    DocketIntakeCommandError.make({
      kind: error.cause === "throttled" ? "throttled" : "failed",
      message: `stage ${error.stage}: ${error.cause}`,
    });
}
