/**
 * Generic domain error for operations that fail for non-file-specific reasons.
 *
 * Use this for JSON parse failures, glob failures, and other operational
 * errors where a more specific error type is not warranted.
 *
 * @category error-handling
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $RepoUtilsId.create("errors/DomainError");

const DomainErrorFields = {
  message: S.String,
  cause: S.optionalKey(S.Defect({ includeStack: true })),
} satisfies S.Struct.Fields;
const sameDomainErrorFields = S.toEquivalence(
  S.TaggedStruct("DomainError", {
    message: DomainErrorFields.message,
    // cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
  })
);
const sameDomainError = (self: DomainError, that: DomainError): boolean => sameDomainErrorFields(self, that);

/**
 * A generic domain-level error with an optional underlying cause.
 *
 * **Example** (Construct domain error)
 *
 * ```ts
 * import { DomainError } from "@beep/repo-utils/errors/DomainError"
 * const error = DomainError.make({
 *   message: "Operation failed"
 * })
 * console.log(error.message)
 * ```
 *
 * @category error-handling
 * @since 0.0.0
 */
export class DomainError extends S.TaggedError<DomainError>($I`DomainError`)(
  "DomainError",
  DomainErrorFields,
  $I.annoteClass<S.declare<DomainError>, readonly [S.TaggedStruct<"DomainError", typeof DomainErrorFields>]>(
    "DomainError",
    {
      title: "Domain Error",
      description:
        "A generic domain-level error with an optional underlying cause for JSON parse failures, glob failures, and other operational errors.",
      toEquivalence: () => sameDomainError,
    }
  )
) {
  static readonly newCause: {
    (cause: unknown, message: string): DomainError;
    (message: string): (cause: unknown) => DomainError;
  } = dual(2, (cause: unknown, message: string) =>
    DomainError.make({
      message,
      cause,
    })
  );

  static readonly newMessage = (message: string) => DomainError.make({ message });

  static readonly newCauseMessage: {
    (cause: unknown, message: string): DomainError;
    (message: string): (cause: unknown) => DomainError;
  } = dual(2, (cause: unknown, message: string) => {
    const getMessage = (cause: unknown): string => (P.isError(cause) ? `${message}: ${cause.message}` : message);
    return DomainError.make({
      message: getMessage(cause),
      cause,
    });
  });
}
