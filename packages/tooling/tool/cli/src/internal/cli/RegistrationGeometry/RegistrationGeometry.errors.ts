import { $RepoCliId } from "@beep/identity/packages";
import { Defect } from "@beep/schema";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/cli/RegistrationGeometry/errors");

export class RegistrationGeometryError extends S.TaggedError<RegistrationGeometryError>()(
  "RegistrationGeometryError",
  {
    message: S.NonEmptyString,
    cause: S.OptionFromOptionalKey(Defect({ includeStack: true })),
  },
  $I.annoteError<RegistrationGeometryError>("RegistrationGeometryError", {
    description: "Typed failure to resolve, plan, inspect, or apply registration geometry.",
  })
) {
  static readonly newMessage = (message: string) => RegistrationGeometryError.make({ message, cause: O.none() });
  static readonly newCause = (message: string) => (cause: unknown) =>
    RegistrationGeometryError.make({ message, cause: O.some(cause) });
}
