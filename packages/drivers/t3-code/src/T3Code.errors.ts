/**
 * Sanitized failure classification for T3 exchanges.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $T3CodeId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $T3CodeId.create("T3Code.errors");
/**
 * Keeps uncertain submission distinct from definite local refusal.
 * **Details**
 * Remote error bodies, bearer credentials and provider messages are never retained.
 * A possibly-submitted operation must be reconciled with its client request key.
 * **Example** (Classify a lost submission receipt)
 * ```ts
 * import { T3CodeError } from "@beep/t3-code"
 * console.log(T3CodeError.make({ operation: "send", reason: "timeout", submission: "possibly-submitted" }).submission)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class T3CodeError extends S.TaggedError<T3CodeError>($I`T3CodeError`)(
  "T3CodeError",
  {
    operation: S.NonEmptyString,
    reason: S.Literals([
      "invalid-input",
      "http",
      "transport",
      "timeout",
      "body-limit",
      "protocol",
      "remote-error",
      "tool-error",
      "identity-mismatch",
    ]),
    submission: S.Literals(["not-submitted", "possibly-submitted"]),
  },
  $I.annoteError<T3CodeError>("T3CodeError", {
    description: "Sanitized T3 failure with explicit submission uncertainty.",
  })
) {}
