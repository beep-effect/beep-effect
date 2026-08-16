import { $RepoCliId } from "@beep/identity/packages";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/cli/RegistrationGeometry/errors");

export class RegistrationGeometryError extends S.TaggedError<RegistrationGeometryError>()(
  "RegistrationGeometryError",
  {
    message: S.NonEmptyString,
    cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true })),
  },
  $I.annote("RegistrationGeometryError", {
    description: "Typed failure to resolve, plan, inspect, or apply registration geometry.",
  })
) {
  static readonly newMessage = (message: string) => RegistrationGeometryError.make({ message, cause: O.none() });
  static readonly newCause = (message: string) => (cause: unknown) =>
    RegistrationGeometryError.make({ message, cause: O.some(cause) });
}
