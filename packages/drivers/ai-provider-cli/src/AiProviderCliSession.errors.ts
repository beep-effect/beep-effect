/**
 * Managed native runtime failures.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $AiProviderCliId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $AiProviderCliId.create("AiProviderCliSession.errors");
/**
 * Redacted managed runtime failure with an explicit recovery class.
 * **Example** (Represent blocked access)
 * ```ts
 * import { ManagedSessionError } from "@beep/ai-provider-cli"
 * console.log(ManagedSessionError.make({ reason: "access-blocked", operation: "prompt", message: "Existing subscription access denied" }).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class ManagedSessionError extends S.TaggedError<ManagedSessionError>($I`ManagedSessionError`)(
  "ManagedSessionError",
  {
    reason: S.Literals([
      "invalid-profile",
      "policy-mismatch",
      "transport",
      "access-blocked",
      "unsupported",
      "closed",
      "timeout",
      "provider-failure",
    ]),
    operation: S.NonEmptyString,
    message: S.NonEmptyString,
  },
  $I.annoteError<ManagedSessionError>("ManagedSessionError", {
    description: "Redacted failure; unsupported and access-denied routes never report successful delivery.",
  })
) {}
