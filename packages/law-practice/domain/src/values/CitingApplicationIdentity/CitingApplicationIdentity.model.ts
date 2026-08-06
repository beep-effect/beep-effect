/**
 * Law-owned identity for the application a patent reference is cited against.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { ApplicationNumber } from "../ApplicationNumber/index.ts";

const $I = $LawPracticeDomainId.create("values/CitingApplicationIdentity/CitingApplicationIdentity.model");
const usptoNormalizedPattern = /^\d{8}$/u;

/**
 * Normalized eight-digit USPTO application number in its law-owned form.
 *
 * **When to use**
 *
 * Use when a filing is identified the way USPTO systems identify it, rather
 * than in the separator-free WIPO ST.13 representation.
 *
 * **Details**
 *
 * The eight digits are a two-digit series code followed by a six-digit serial
 * number. This value deliberately mirrors the driver-side shape at
 * `packages/drivers/uspto/src/Uspto.models.ts` instead of importing it: a
 * domain package never imports a driver, so the law-practice slice owns its
 * own copy of the constraint.
 *
 * **Gotchas**
 *
 * Mirroring means the two schemas can drift. The mirrored constraint is the
 * pattern only; nothing here consumes USPTO retrieval semantics.
 *
 * **Example** (Accept a normalized number and reject a presented one)
 *
 * ```ts
 * import { UsptoNormalizedApplicationNumber } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(UsptoNormalizedApplicationNumber)("16138242")) // true
 * console.log(S.is(UsptoNormalizedApplicationNumber)("16/138,242")) // false
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const UsptoNormalizedApplicationNumber = S.String.check(
  S.isPattern(usptoNormalizedPattern, {
    identifier: $I`UsptoNormalizedApplicationNumberPatternCheck`,
    title: "USPTO Normalized Application Number",
    description: "A normalized USPTO application number is exactly eight digits.",
    message: "Expected an eight-digit USPTO application number.",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(/^\d{8}$/u),
  })
  .pipe(
    S.brand("UsptoNormalizedApplicationNumber"),
    $I.annoteSchema("UsptoNormalizedApplicationNumber", {
      description:
        "Normalized eight-digit USPTO application number (series code plus serial number), mirrored into law-practice.",
    })
  );

/**
 * Type-level brand produced by {@link UsptoNormalizedApplicationNumber}.
 *
 * @see {@link UsptoNormalizedApplicationNumber} for the runtime schema and validation behavior.
 * @category type-level
 * @since 0.0.0
 */
export type UsptoNormalizedApplicationNumber = typeof UsptoNormalizedApplicationNumber.Type;

/**
 * Citing application identified by its normalized eight-digit USPTO number.
 *
 * **Example** (Identify a filing the way USPTO systems do)
 *
 * ```ts
 * import { UsptoCitingApplication, UsptoNormalizedApplicationNumber } from "@beep/law-practice-domain"
 *
 * const citing = UsptoCitingApplication.make({
 *   applicationNumber: UsptoNormalizedApplicationNumber.make("16138242"),
 *   kind: "UsptoNormalized",
 * })
 * console.log(citing.kind) // "UsptoNormalized"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UsptoCitingApplication extends S.Class<UsptoCitingApplication>($I`UsptoCitingApplication`)(
  {
    applicationNumber: UsptoNormalizedApplicationNumber.annotateKey({
      description: "Normalized eight-digit USPTO application number for the citing filing.",
    }),
    kind: S.tag("UsptoNormalized").annotateKey({
      description: "Citing-application discriminator for the USPTO normalized representation.",
    }),
  },
  $I.annote("UsptoCitingApplication", {
    description: "Citing application identified by a normalized eight-digit USPTO application number.",
  })
) {}

/**
 * Citing application identified by its canonical WIPO ST.13 number.
 *
 * **Example** (Identify a filing in the ST.13 machine-readable form)
 *
 * ```ts
 * import { ApplicationNumber, WipoCitingApplication } from "@beep/law-practice-domain"
 *
 * const citing = WipoCitingApplication.make({
 *   applicationNumber: ApplicationNumber.make("102014000345678"),
 *   kind: "WipoSt13",
 * })
 * console.log(citing.kind) // "WipoSt13"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WipoCitingApplication extends S.Class<WipoCitingApplication>($I`WipoCitingApplication`)(
  {
    applicationNumber: ApplicationNumber.annotateKey({
      description: "Canonical WIPO ST.13 application number for the citing filing.",
    }),
    kind: S.tag("WipoSt13").annotateKey({
      description: "Citing-application discriminator for the WIPO ST.13 representation.",
    }),
  },
  $I.annote("WipoCitingApplication", {
    description: "Citing application identified by a canonical WIPO ST.13 patent application number.",
  })
) {}

/**
 * The application a patent reference is recorded as being cited against.
 *
 * **When to use**
 *
 * Use as the filing scope of a patent citation event and of the attorney
 * disposition that answers it.
 *
 * **Details**
 *
 * The union deliberately accepts two representations rather than normalizing
 * to one, because both appear in practice and neither is derivable from the
 * other with in-repo evidence. Recording the representation actually observed
 * keeps the event faithful to its source.
 *
 * **Gotchas**
 *
 * There is no conversion between the two members. Translating an eight-digit
 * USPTO number into ST.13 requires USPTO's series-code-to-year table, which no
 * package in this repo carries, so identifying one representation with the
 * other is never inferred. Callers that need every event for a filing query by
 * one exact representation; reconciling representations is the named
 * reference-reconciliation follow-on, not a silent equality rule here.
 *
 * This union is the only accepted citing-application identity. An
 * `OfficeAction.applicationNumber` free-text field and a `PatentAsset` fixture
 * key are both explicitly not identities for this purpose.
 *
 * **Example** (Decode either representation)
 *
 * ```ts
 * import { CitingApplicationIdentity } from "@beep/law-practice-domain"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(CitingApplicationIdentity)({
 *   applicationNumber: "16138242",
 *   kind: "UsptoNormalized",
 * })
 *
 * Effect.runPromise(program).then((citing) => console.log(citing.kind))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CitingApplicationIdentity = S.Union([UsptoCitingApplication, WipoCitingApplication]).pipe(
  $I.annoteSchema("CitingApplicationIdentity", {
    description:
      "Law-owned union of the accepted citing-application representations: normalized USPTO and canonical WIPO ST.13.",
  }),
  S.toTaggedUnion("kind"),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link CitingApplicationIdentity}.
 *
 * @see {@link CitingApplicationIdentity} for the runtime schema and representation rules.
 * @category models
 * @since 0.0.0
 */
export type CitingApplicationIdentity = typeof CitingApplicationIdentity.Type;

/**
 * Encoded boundary type for {@link CitingApplicationIdentity}.
 *
 * @see {@link CitingApplicationIdentity} for the runtime schema.
 * @category models
 * @since 0.0.0
 */
export declare namespace CitingApplicationIdentity {
  /**
   * Encoded boundary companion type for {@link CitingApplicationIdentity}.
   *
   * @see {@link CitingApplicationIdentity} for the runtime schema.
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof CitingApplicationIdentity.Encoded;
}
