/**
 * Schema models for USPTO Open Data Portal responses and identifiers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $UsptoId } from "@beep/identity";
import { NonEmptyTrimmedStr, SchemaUtils } from "@beep/schema";
import { Str } from "@beep/utils";
import { Effect, flow, pipe, SchemaGetter, SchemaIssue, SchemaTransformation } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $UsptoId.create("Uspto.models");

const applicationNumberPattern = /^\d{8}$/;
const patentNumberPattern = /^(?:RE|PP|D|H|T)?\d{5,8}$/;

/**
 * Normalized eight-digit USPTO application number.
 *
 * @example
 * ```ts
 * import { UsptoApplicationNumber } from "@beep/uspto"
 *
 * console.log(UsptoApplicationNumber)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UsptoApplicationNumber = S.String.check(
  S.isPattern(applicationNumberPattern, {
    identifier: $I`UsptoApplicationNumberPatternCheck`,
    title: "USPTO Application Number",
    description: "A normalized USPTO application number is exactly eight digits.",
    message: "Expected an eight-digit USPTO application number",
  })
).pipe(
  S.brand("UsptoApplicationNumber"),
  $I.annoteSchema("UsptoApplicationNumber", {
    description: "Normalized eight-digit USPTO application number (series code plus serial number).",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link UsptoApplicationNumber}.
 *
 * @example
 * ```ts
 * import { UsptoApplicationNumber } from "@beep/uspto"
 * import * as S from "effect/Schema"
 *
 * const number: UsptoApplicationNumber = S.decodeUnknownSync(UsptoApplicationNumber)("16138242")
 * console.log(number)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UsptoApplicationNumber = typeof UsptoApplicationNumber.Type;

const normalizeApplicationNumberText = (text: string): string => text.replaceAll(/[\s/,.-]/gu, "");

const decodeUsptoApplicationNumberFromText = (
  value: string
): Effect.Effect<UsptoApplicationNumber, SchemaIssue.Issue> => {
  const candidate = normalizeApplicationNumberText(value);
  return applicationNumberPattern.test(candidate)
    ? Effect.succeed(UsptoApplicationNumber.make(candidate))
    : Effect.fail(
        new SchemaIssue.InvalidValue({
          message: "Expected text containing an eight-digit USPTO application number",
        })
      );
};

const encodeUsptoApplicationNumberToText = (value: string): Effect.Effect<string> => Effect.succeed(value);

/**
 * Boundary codec for free-text USPTO application number input.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { UsptoApplicationNumberFromText } from "@beep/uspto"
 *
 * const number = S.decodeUnknownSync(UsptoApplicationNumberFromText)("16/138,242")
 * console.log(number)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UsptoApplicationNumberFromText = S.String.pipe(
  S.decodeTo(UsptoApplicationNumber, {
    decode: SchemaGetter.transformOrFail(decodeUsptoApplicationNumberFromText),
    encode: SchemaGetter.transformOrFail(encodeUsptoApplicationNumberToText),
  }),
  $I.annoteSchema("UsptoApplicationNumberFromText", {
    description: "Codec that normalizes free-text USPTO application numbers into the eight-digit domain form.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link UsptoApplicationNumberFromText}.
 *
 * @example
 * ```ts
 * import { UsptoApplicationNumberFromText } from "@beep/uspto"
 * import * as S from "effect/Schema"
 *
 * const number: UsptoApplicationNumberFromText = S.decodeUnknownSync(UsptoApplicationNumberFromText)("16/138,242")
 * console.log(number)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UsptoApplicationNumberFromText = typeof UsptoApplicationNumberFromText.Type;

/**
 * Normalized USPTO patent number with optional kind prefix.
 *
 * @example
 * ```ts
 * import { UsptoPatentNumber } from "@beep/uspto"
 *
 * console.log(UsptoPatentNumber)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UsptoPatentNumber = S.String.check(
  S.isPattern(patentNumberPattern, {
    identifier: $I`UsptoPatentNumberPatternCheck`,
    title: "USPTO Patent Number",
    description: "A normalized USPTO patent number is five to eight digits with an optional RE/PP/D/H/T prefix.",
    message: "Expected a normalized USPTO patent number",
  })
).pipe(
  S.brand("UsptoPatentNumber"),
  $I.annoteSchema("UsptoPatentNumber", {
    description: "Normalized USPTO patent number without commas or kind codes.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link UsptoPatentNumber}.
 *
 * @example
 * ```ts
 * import { UsptoPatentNumber } from "@beep/uspto"
 * import * as S from "effect/Schema"
 *
 * const number: UsptoPatentNumber = S.decodeUnknownSync(UsptoPatentNumber)("10772255")
 * console.log(number)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UsptoPatentNumber = typeof UsptoPatentNumber.Type;

const normalizePatentNumberText: (text: string) => string = flow(
  Str.toUpperCase,
  Str.replaceAll(/[\s,]/gu, ""),
  Str.replace(/^US/u, ""),
  Str.replace(/[A-Z]\d?$/u, "")
);

const decodeUsptoPatentNumberFromText = (value: string): Effect.Effect<UsptoPatentNumber, SchemaIssue.Issue> => {
  const candidate = normalizePatentNumberText(value);
  return patentNumberPattern.test(candidate)
    ? Effect.succeed(UsptoPatentNumber.make(candidate))
    : Effect.fail(
        new SchemaIssue.InvalidValue({
          message: "Expected text containing a normalized USPTO patent number",
        })
      );
};

const encodeUsptoPatentNumberToText = (value: string): Effect.Effect<string> => Effect.succeed(value);

/**
 * Boundary codec for free-text USPTO patent number input.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { UsptoPatentNumberFromText } from "@beep/uspto"
 *
 * const number = S.decodeUnknownSync(UsptoPatentNumberFromText)("US 10,772,255 B2")
 * console.log(number)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UsptoPatentNumberFromText = S.String.pipe(
  S.decodeTo(UsptoPatentNumber, {
    decode: SchemaGetter.transformOrFail(decodeUsptoPatentNumberFromText),
    encode: SchemaGetter.transformOrFail(encodeUsptoPatentNumberToText),
  }),
  $I.annoteSchema("UsptoPatentNumberFromText", {
    description: "Codec that normalizes free-text USPTO patent numbers into the domain form.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link UsptoPatentNumberFromText}.
 *
 * @example
 * ```ts
 * import { UsptoPatentNumberFromText } from "@beep/uspto"
 * import * as S from "effect/Schema"
 *
 * const number: UsptoPatentNumberFromText = S.decodeUnknownSync(UsptoPatentNumberFromText)("US 10,772,255 B2")
 * console.log(number)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UsptoPatentNumberFromText = typeof UsptoPatentNumberFromText.Type;

/**
 * Normalize free-text into a USPTO application number candidate.
 *
 * Strips separators such as `/`, `,`, `.`, and spaces (for example
 * `16/123,456` becomes `16123456`).
 *
 * @param text - Free-text application number candidate.
 * @returns The normalized eight-digit form, or none.
 * @example
 * ```ts
 * import { normalizeUsptoApplicationNumber } from "@beep/uspto"
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(normalizeUsptoApplicationNumber("16/123,456"))) // true
 * console.log(O.isNone(normalizeUsptoApplicationNumber("not a number"))) // true
 * ```
 *
 * @category parsers
 * @since 0.0.0
 */
export const normalizeUsptoApplicationNumber = (text: string): O.Option<string> =>
  pipe(
    UsptoApplicationNumberFromText.decodeOption(text),
    O.map((value): string => value)
  );

/**
 * Normalize free-text into a USPTO patent number candidate.
 *
 * Strips `US` prefixes, kind codes (for example `B2`), commas, and spaces
 * (for example `US 10,772,255 B2` becomes `10772255`).
 *
 * @param text - Free-text patent number candidate.
 * @returns The normalized form, or none.
 * @example
 * ```ts
 * import { normalizeUsptoPatentNumber } from "@beep/uspto"
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(normalizeUsptoPatentNumber("US 10,772,255 B2"))) // true
 * ```
 *
 * @category parsers
 * @since 0.0.0
 */
export const normalizeUsptoPatentNumber: (text: string) => O.Option<string> = flow(
  UsptoPatentNumberFromText.decodeOption,
  O.map((value): string => value)
);

const UsptoMetadataText = NonEmptyTrimmedStr.pipe(
  $I.annoteSchema("UsptoMetadataText", {
    description: "Trimmed non-empty text carried by USPTO metadata fields.",
  })
);

type UsptoMetadataText = typeof UsptoMetadataText.Type;

const UsptoMetadataTextInput = S.Union([S.String, S.Option(UsptoMetadataText)]);
const decodeUsptoMetadataTextOption = S.decodeUnknownOption(UsptoMetadataText);

const decodeOptionalUsptoMetadataText = (
  value: O.Option<string | O.Option<UsptoMetadataText>>
): O.Option<O.Option<string>> =>
  O.some(
    pipe(
      value,
      O.flatMap((input) => (O.isOption(input) ? input : decodeUsptoMetadataTextOption(input)))
    )
  );

const optionalUsptoMetadataText = (description: string) =>
  S.optionalKey(UsptoMetadataTextInput).pipe(
    S.decodeTo(
      S.Option(UsptoMetadataText),
      SchemaTransformation.transformOptional<O.Option<string>, string | O.Option<UsptoMetadataText>>({
        decode: decodeOptionalUsptoMetadataText,
        encode: (value) => O.flatten(value),
      })
    ),
    SchemaUtils.withNoneDefault,
    S.annotateKey({ description })
  );

/**
 * Official application metadata resolved from the Open Data Portal.
 *
 * @example
 * ```ts
 * import { UsptoApplicationMetadata } from "@beep/uspto"
 *
 * console.log(UsptoApplicationMetadata)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UsptoApplicationMetadata extends S.Class<UsptoApplicationMetadata>($I`UsptoApplicationMetadata`)(
  {
    applicationNumberText: UsptoMetadataText.annotateKey({
      description: "USPTO application number associated with the metadata row.",
    }),
    applicationStatusDescriptionText: optionalUsptoMetadataText(
      "Human-readable USPTO status for the application when provided."
    ),
    applicationTypeLabelName: optionalUsptoMetadataText("USPTO application type label when provided."),
    docketNumber: optionalUsptoMetadataText("Attorney docket number when published in the wrapper metadata."),
    earliestPublicationNumber: optionalUsptoMetadataText(
      "Earliest publication number associated with the application."
    ),
    filingDate: optionalUsptoMetadataText("Application filing date string when published by USPTO."),
    firstApplicantName: optionalUsptoMetadataText("First listed applicant name when present in the metadata row."),
    firstInventorName: optionalUsptoMetadataText("First listed inventor name when present in the metadata row."),
    grantDate: optionalUsptoMetadataText("Patent grant date string when the application has issued."),
    inventionTitle: optionalUsptoMetadataText("Published invention title when included in the wrapper metadata."),
    patentNumber: optionalUsptoMetadataText("Issued patent number associated with the application when present."),
  },
  $I.annote("UsptoApplicationMetadata", {
    description: "Official USPTO application metadata projected from a patent file wrapper response.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(this);
}

/**
 * Parent and child continuity application numbers for one application.
 *
 * @example
 * ```ts
 * import { UsptoContinuity } from "@beep/uspto"
 *
 * const continuity = UsptoContinuity.make({ childApplicationNumbers: [], parentApplicationNumbers: [] })
 * console.log(continuity)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UsptoContinuity extends S.Class<UsptoContinuity>($I`UsptoContinuity`)(
  {
    childApplicationNumbers: S.Array(UsptoApplicationNumber).annotateKey({
      description: "Normalized child continuity application numbers.",
    }),
    parentApplicationNumbers: S.Array(UsptoApplicationNumber).annotateKey({
      description: "Normalized parent continuity application numbers.",
    }),
  },
  $I.annote("UsptoContinuity", {
    description: "Parent and child continuity application numbers anchoring an application to its patent family.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(this);
}

/**
 * Reference to one document in an application file wrapper.
 *
 * @example
 * ```ts
 * import { UsptoDocumentReference } from "@beep/uspto"
 *
 * console.log(UsptoDocumentReference)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UsptoDocumentReference extends S.Class<UsptoDocumentReference>($I`UsptoDocumentReference`)(
  {
    documentCode: S.optionalKey(S.String).annotateKey({
      description: "USPTO document code when supplied for the file-wrapper record.",
    }),
    documentCodeDescriptionText: S.optionalKey(S.String).annotateKey({
      description: "Human-readable document code description when supplied.",
    }),
    documentIdentifier: S.NonEmptyString.annotateKey({
      description: "USPTO file-wrapper document identifier.",
    }),
    downloadUrl: S.optionalKey(S.String).annotateKey({
      description: "Published document download URL when the document can be fetched.",
    }),
    officialDate: S.optionalKey(S.String).annotateKey({
      description: "Official USPTO date string associated with the document record.",
    }),
  },
  $I.annote("UsptoDocumentReference", {
    description: "Reference to one file-wrapper document, including its download URL when published.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(this);
}
