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
import { OfficeCode } from "../OfficeCode/index.ts";

const $I = $LawPracticeDomainId.create("values/CitingApplicationIdentity/CitingApplicationIdentity.model");
const usptoNormalizedPattern = /^\d{8}$/u;

/**
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
  S.isPattern(
    usptoNormalizedPattern,
    $I.annote("UsptoNormalizedApplicationNumberPatternCheck", {
      title: "USPTO Normalized Application Number",
      description: "A normalized USPTO application number is exactly eight digits.",
      message: "Expected an eight-digit USPTO application number.",
    })
  )
).pipe(
  S.brand("UsptoNormalizedApplicationNumber"),
  $I.annoteSchema("UsptoNormalizedApplicationNumber", {
    description:
      "Normalized eight-digit USPTO application number (series code plus serial number), mirrored into law-practice.",
  })
);

/**
 * @see {@link UsptoNormalizedApplicationNumber} for the runtime schema and validation behavior.
 * @category type-level
 * @since 0.0.0
 */
export type UsptoNormalizedApplicationNumber = typeof UsptoNormalizedApplicationNumber.Type;

// Every ST.3 office except `US` and `XX`.
const WipoSt13OfficeCodeBase = OfficeCode.omit(["US", "XX"]);

/**
 * **Details**
 *
 * The current WIPO office-practice table records that the United States uses
 * its eight-digit series-code/serial-number system with no ST.13 type or year
 * designation. A `US`-prefixed ST.13 identity would therefore be invented.
 * The ST.3 placeholder `XX` is also excluded because an unknown office cannot
 * globally scope an otherwise office-local application number.
 *
 * **Example** (Accept an ST.13 office and reject the USPTO code)
 *
 * ```ts
 * import { WipoSt13OfficeCode } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(WipoSt13OfficeCode)("EP")) // true
 * console.log(S.is(WipoSt13OfficeCode)("US")) // false
 * console.log(S.is(WipoSt13OfficeCode)("XX")) // false
 * ```
 *
 * @see {@link https://www.wipo.int/documents/d/standards/docs-en-07-02-06.pdf} for current U.S. application-number practice.
 * @category value-objects
 * @since 0.0.0
 */
export const WipoSt13OfficeCode = WipoSt13OfficeCodeBase.pipe(
  $I.annoteSchema("WipoSt13OfficeCode", {
    description: "Known non-U.S. WIPO ST.3 office code recorded with an observed ST.13 citing application.",
  }),
  SchemaUtils.withLiteralKitStatics(WipoSt13OfficeCodeBase)
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type WipoSt13OfficeCode = typeof WipoSt13OfficeCode.Type;

/**
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
export class UsptoCitingApplication extends S.Opaque<UsptoCitingApplication, { readonly brand: unique symbol }>()(
  S.Struct({
    applicationNumber: UsptoNormalizedApplicationNumber.annotateKey({
      description: "Normalized eight-digit USPTO application number for the citing filing.",
    }),
    kind: S.tag("UsptoNormalized").annotateKey({
      description: "Citing-application discriminator for the USPTO normalized representation.",
    }),
  }).pipe(
    $I.annoteSchema("UsptoCitingApplication", {
      description: "Citing application identified by a normalized eight-digit USPTO application number.",
    })
  )
) {}

/**
 * **Example** (Identify a filing in the ST.13 machine-readable form)
 *
 * ```ts
 * import { ApplicationNumber, WipoCitingApplication, WipoSt13OfficeCode } from "@beep/law-practice-domain"
 *
 * const citing = WipoCitingApplication.make({
 *   applicationNumber: ApplicationNumber.make("102014000345678"),
 *   officeCode: WipoSt13OfficeCode.make("EP"),
 * })
 * console.log(citing.kind) // "WipoSt13"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WipoCitingApplication extends S.Opaque<WipoCitingApplication, { readonly brand: unique symbol }>()(
  S.Struct({
    applicationNumber: ApplicationNumber.annotateKey({
      description: "Canonical WIPO ST.13 application number for the citing filing.",
    }),
    officeCode: WipoSt13OfficeCode.annotateKey({
      description: "ST.3 office code that makes the otherwise office-local ST.13 application number globally scoped.",
    }),
    kind: S.tag("WipoSt13").annotateKey({
      description: "Citing-application discriminator for the WIPO ST.13 representation.",
    }),
  }).pipe(
    $I.annoteSchema("WipoCitingApplication", {
      description: "Citing application identified by a canonical WIPO ST.13 patent application number.",
    })
  )
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
 * The union accepts two office-specific identity systems rather than
 * normalizing one into the other. USPTO's eight-digit series/serial number has
 * no ST.13 year designation; ST.13 requires an office code plus its type, year,
 * and serial fields. Recording the representation actually observed keeps the
 * event faithful to its source without fabricating a conversion.
 *
 * **Gotchas**
 *
 * There is no conversion between the two members. USPTO series codes span
 * multiple filing years, so the eight digits cannot supply ST.13's filing-year
 * field. The WIPO member therefore requires its known ST.3 office code and
 * rejects `US` and the unknown-office placeholder `XX`; callers query by the
 * exact office-owned identity instead of inventing cross-representation
 * equality.
 *
 * This union is the only accepted citing-application identity. An
 * `OfficeAction.applicationNumber` free-text field and a `PatentAsset` fixture
 * key are both explicitly not identities for this purpose.
 *
 * **Example** (Decode either representation)
 *
 * ```ts
 * import { CitingApplicationIdentity } from "@beep/law-practice-domain"
 * import * as Effect from "effect/Effect";
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
  })
);

/**
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
