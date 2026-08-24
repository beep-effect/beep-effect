import { $RepoCliId } from "@beep/identity/packages";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/cli/RegistrationGeometry/errors");

const RegistrationGeometryErrorFields = {
  message: S.NonEmptyString,
  cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true })),
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameRegistrationGeometryErrorFields = S.toEquivalence(
  S.TaggedStruct("RegistrationGeometryError", {
    message: RegistrationGeometryErrorFields.message,
  })
);
const sameRegistrationGeometryError = (self: RegistrationGeometryError, that: RegistrationGeometryError): boolean =>
  sameRegistrationGeometryErrorFields(self, that);

export class RegistrationGeometryError extends S.TaggedError<RegistrationGeometryError>()(
  "RegistrationGeometryError",
  RegistrationGeometryErrorFields,
  $I.annoteClass<
    S.declare<RegistrationGeometryError>,
    readonly [S.TaggedStruct<"RegistrationGeometryError", typeof RegistrationGeometryErrorFields>]
  >("RegistrationGeometryError", {
    description: "Typed failure to resolve, plan, inspect, or apply registration geometry.",
    toEquivalence: () => sameRegistrationGeometryError,
  })
) {
  static readonly newMessage = (message: string) => RegistrationGeometryError.make({ message, cause: O.none() });
  static readonly newCause = (message: string) => (cause: unknown) =>
    RegistrationGeometryError.make({ message, cause: O.some(cause) });
}
