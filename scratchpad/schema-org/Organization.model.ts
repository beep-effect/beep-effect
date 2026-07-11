/**
 * Schema.org `Organization` model.
 *
 * @see https://schema.org/Organization
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LocalDateFromString } from "@beep/schema/LocalDate";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  optionalValues,
  SchemaOrgNode,
  SchemaOrgUrlReference,
  TextOrNode,
  Thing,
  UrlOrNode,
} from "./Thing.model.js";

const $I = $ScratchpadId.create("schema-org/Organization.model");

const GLOBAL_LOCATION_NUMBER_PATTERN = /^[0-9]{13}$/u;
const GLOBAL_LOCATION_NUMBER_WEIGHTS = [1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3];
const ISO_6523_CODE_PATTERN = /^[0-9]{4}:[^.\s:-]{1,35}(?::[^:]{1,35})?$/u;

const decimalDigitAt = (value: string, index: number): O.Option<number> =>
  O.map(Str.charCodeAt(value, index), (code) => code - 48);

const hasValidGlobalLocationNumberCheckDigit = (value: string): boolean => {
  const payloadSum = A.reduce(GLOBAL_LOCATION_NUMBER_WEIGHTS, 0, (sum, weight, index) =>
    O.getOrElse(decimalDigitAt(value, index), () => 0) * weight + sum
  );
  const expectedCheckDigit = (10 - (payloadSum % 10)) % 10;

  return O.exists(decimalDigitAt(value, 12), (digit) => digit === expectedCheckDigit);
};

const GlobalLocationNumberChecks = S.makeFilterGroup(
  [
    S.isPattern(GLOBAL_LOCATION_NUMBER_PATTERN, {
      identifier: $I`GlobalLocationNumberDigitsCheck`,
      title: "Global Location Number Digits",
      description: "A Schema.org globalLocationNumber value containing exactly thirteen decimal digits.",
      message: "Expected a 13-digit Global Location Number",
    }),
    S.makeFilter(hasValidGlobalLocationNumberCheckDigit, {
      identifier: $I`GlobalLocationNumberCheckDigitCheck`,
      title: "Global Location Number Check Digit",
      description: "The thirteenth GLN digit must satisfy the GS1 modulo-10 check-digit algorithm.",
      message: "Expected a Global Location Number with a valid GS1 check digit",
    }),
  ],
  {
    identifier: $I`GlobalLocationNumberChecks`,
    title: "Global Location Number",
    description: "GS1 lexical and check-digit validation for Schema.org globalLocationNumber values.",
  }
);

const GlobalLocationNumber = S.String.check(GlobalLocationNumberChecks).annotate(
  $I.annote("GlobalLocationNumber", {
    description: "The 13-digit Global Location Number used to identify a party or physical location.",
    documentation: "https://schema.org/globalLocationNumber",
  })
);

const Iso6523Code = S.String.check(
  S.isPattern(ISO_6523_CODE_PATTERN, {
    identifier: $I`Iso6523CodeCheck`,
    title: "ISO 6523 Organization Identifier",
    description:
      "A four-digit ICD, a nonempty organization identifier of at most 35 characters with formatting removed, and an optional nonempty organization-part identifier of at most 35 characters, separated by colons.",
    message: "Expected an ISO 6523 code in ICD:OID or ICD:OID:OPI form",
  })
).annotate(
  $I.annote("Iso6523Code", {
    description: "An ISO 6523 organization identifier serialized as ICD:OID or ICD:OID:OPI.",
    documentation: "https://schema.org/iso6523Code",
  })
);

const OrganizationNonRecursiveFields = S.Struct({
  acceptedPaymentMethod: optionalValues(TextOrNode),
  actionableFeedbackPolicy: optionalValues(UrlOrNode),
  address: optionalValues(TextOrNode),
  agentInteractionStatistic: optionalValues(SchemaOrgNode),
  aggregateRating: optionalValues(SchemaOrgNode),
  alumni: optionalValues(SchemaOrgNode),
  areaServed: optionalValues(TextOrNode),
  award: optionalValues(S.String),
  brand: optionalValues(SchemaOrgNode),
  companyRegistration: optionalValues(SchemaOrgNode),
  contactPoint: optionalValues(SchemaOrgNode),
  correctionsPolicy: optionalValues(UrlOrNode),
  dissolutionDate: optionalValues(LocalDateFromString),
  diversityPolicy: optionalValues(UrlOrNode),
  diversityStaffingReport: optionalValues(UrlOrNode),
  duns: optionalValues(S.String),
  email: optionalValues(S.String),
  employee: optionalValues(SchemaOrgNode),
  ethicsPolicy: optionalValues(UrlOrNode),
  event: optionalValues(SchemaOrgNode),
  faxNumber: optionalValues(S.String),
  founder: optionalValues(SchemaOrgNode),
  foundingDate: optionalValues(LocalDateFromString),
  foundingLocation: optionalValues(SchemaOrgNode),
  funder: optionalValues(SchemaOrgNode),
  funding: optionalValues(SchemaOrgNode),
  globalLocationNumber: optionalValues(GlobalLocationNumber),
  hasCertification: optionalValues(SchemaOrgNode),
  hasCredential: optionalValues(SchemaOrgNode),
  hasGS1DigitalLink: optionalValues(SchemaOrgUrlReference),
  hasMemberProgram: optionalValues(SchemaOrgNode),
  hasMerchantReturnPolicy: optionalValues(SchemaOrgNode),
  hasOfferCatalog: optionalValues(SchemaOrgNode),
  hasPOS: optionalValues(SchemaOrgNode),
  hasShippingService: optionalValues(SchemaOrgNode),
  interactionStatistic: optionalValues(SchemaOrgNode),
  isicV4: optionalValues(S.String),
  iso6523Code: optionalValues(Iso6523Code),
  keywords: optionalValues(TextOrNode),
  knowsAbout: optionalValues(TextOrNode),
  knowsLanguage: optionalValues(TextOrNode),
  legalAddress: optionalValues(SchemaOrgNode),
  legalName: optionalValues(S.String),
  legalRepresentative: optionalValues(SchemaOrgNode),
  leiCode: optionalValues(S.String),
  location: optionalValues(TextOrNode),
  logo: optionalValues(UrlOrNode),
  makesOffer: optionalValues(SchemaOrgNode),
  member: optionalValues(SchemaOrgNode),
  memberOf: optionalValues(SchemaOrgNode),
  naics: optionalValues(S.String),
  nonprofitStatus: optionalValues(UrlOrNode),
  numberOfEmployees: optionalValues(SchemaOrgNode),
  ownershipFundingInfo: optionalValues(TextOrNode),
  owns: optionalValues(SchemaOrgNode),
  publishingPrinciples: optionalValues(UrlOrNode),
  review: optionalValues(SchemaOrgNode),
  seeks: optionalValues(SchemaOrgNode),
  skills: optionalValues(TextOrNode),
  slogan: optionalValues(S.String),
  sponsor: optionalValues(SchemaOrgNode),
  taxID: optionalValues(S.String),
  telephone: optionalValues(S.String),
  unnamedSourcesPolicy: optionalValues(UrlOrNode),
  vatID: optionalValues(S.String),
});

type OrganizationType = Thing &
  typeof OrganizationNonRecursiveFields.Type & {
    readonly department: O.Option<ReadonlyArray<OrganizationType>>;
    readonly parentOrganization: O.Option<ReadonlyArray<OrganizationType>>;
    readonly subOrganization: O.Option<ReadonlyArray<OrganizationType>>;
  };

type OrganizationEncoded = typeof Thing.Encoded &
  typeof OrganizationNonRecursiveFields.Encoded & {
    readonly department?: OrganizationEncoded | ReadonlyArray<OrganizationEncoded>;
    readonly parentOrganization?: OrganizationEncoded | ReadonlyArray<OrganizationEncoded>;
    readonly subOrganization?: OrganizationEncoded | ReadonlyArray<OrganizationEncoded>;
  };

const OrganizationReference = S.suspend(
  (): S.Codec<OrganizationType, OrganizationEncoded> => Organization
).pipe(
  $I.annoteSchema("OrganizationReference", {
    description: "A recursively nested Schema.org Organization value.",
  })
);

const OrganizationFields = S.Struct({
  ...OrganizationNonRecursiveFields.fields,
  department: optionalValues(OrganizationReference),
  parentOrganization: optionalValues(OrganizationReference),
  subOrganization: optionalValues(OrganizationReference),
});

/**
 * An organization such as a school, NGO, corporation, or club.
 *
 * Organization inherits all thirteen `Thing` properties. Its own properties
 * remain optional and multi-valued; Schema.org defines no required fields,
 * maximum cardinalities, reciprocal-property requirements, or local
 * cross-field invariants for this type. Field schemas enforce the lexical
 * constraints documented for dates, URL-only values, GLNs, and ISO 6523 codes.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { Organization } from "./Organization.model.js"
 *
 * const organization = Organization.make({
 *   name: O.some(["Example Foundation"]),
 *   globalLocationNumber: O.some(["9506000140445"]),
 * })
 *
 * console.log(O.isSome(organization.legalName)) // false
 * ```
 *
 * @see https://schema.org/Organization
 * @since 0.0.0
 */
export class Organization extends Thing.extend<Organization>($I`Organization`)(
  OrganizationFields,
  $I.annote("Organization", {
    description: "An organization such as a school, NGO, corporation, club, etc.",
    documentation: "https://schema.org/Organization",
  })
) {}

/** Companion decoded and encoded types for {@link Organization}. */
export declare namespace Organization {
  /** Decoded recursive Organization value. */
  export type Type = OrganizationType;

  /** Encoded recursive Organization value. */
  export type Encoded = OrganizationEncoded;
}
