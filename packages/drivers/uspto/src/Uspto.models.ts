/**
 * Schema models for USPTO Open Data Portal responses and identifiers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $UsptoId } from "@beep/identity";
import { Str } from "@beep/utils";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";

const $I = $UsptoId.create("Uspto.models");

const applicationNumberPattern = /^\d{8}$/;
const patentNumberPattern = /^(?:RE|PP|D|H|T)?\d{5,8}$/;

/**
 * Normalized eight-digit USPTO application number.
 *
 * **Example** (Log application number schema)
 *
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
  S.isPattern(
    applicationNumberPattern,
    $I.annote("UsptoApplicationNumberPatternCheck", {
      title: "USPTO Application Number",
      description: "A normalized USPTO application number is exactly eight digits.",
      message: "Expected an eight-digit USPTO application number",
    })
  )
).pipe(
  S.brand("UsptoApplicationNumber"),
  $I.annoteSchema("UsptoApplicationNumber", {
    description: "Normalized eight-digit USPTO application number (series code plus serial number).",
  })
);

/**
 * Type for {@link UsptoApplicationNumber}.
 *
 * **Example** (Decode application number)
 *
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

const normalizeApplicationNumberText = (text: string): string => Str.replaceAll(/[\s/,.-]/gu, "")(text);

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
 * **Example** (Decode free-text application number)
 *
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
    decode: SchemaGetter.transformEffect(decodeUsptoApplicationNumberFromText),
    encode: SchemaGetter.transformEffect(encodeUsptoApplicationNumberToText),
  }),
  $I.annoteSchema("UsptoApplicationNumberFromText", {
    description: "Codec that normalizes free-text USPTO application numbers into the eight-digit domain form.",
  })
);

/**
 * Type for {@link UsptoApplicationNumberFromText}.
 *
 * **Example** (Type free-text application number)
 *
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
 * **Example** (Log patent number schema)
 *
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
  S.isPattern(
    patentNumberPattern,
    $I.annote("UsptoPatentNumberPatternCheck", {
      title: "USPTO Patent Number",
      description: "A normalized USPTO patent number is five to eight digits with an optional RE/PP/D/H/T prefix.",
      message: "Expected a normalized USPTO patent number",
    })
  )
).pipe(
  S.brand("UsptoPatentNumber"),
  $I.annoteSchema("UsptoPatentNumber", {
    description: "Normalized USPTO patent number without commas or kind codes.",
  })
);

/**
 * Type for {@link UsptoPatentNumber}.
 *
 * **Example** (Decode patent number)
 *
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
 * **Example** (Decode free-text patent number)
 *
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
    decode: SchemaGetter.transformEffect(decodeUsptoPatentNumberFromText),
    encode: SchemaGetter.transformEffect(encodeUsptoPatentNumberToText),
  }),
  $I.annoteSchema("UsptoPatentNumberFromText", {
    description: "Codec that normalizes free-text USPTO patent numbers into the domain form.",
  })
);

/**
 * Type for {@link UsptoPatentNumberFromText}.
 *
 * **Example** (Type free-text patent number)
 *
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
 * **Details**
 *
 * Strips separators such as `/`, `,`, `.`, and spaces (for example
 * `16/123,456` becomes `16123456`).
 *
 * **Example** (Normalize application number text)
 *
 * ```ts
 * import { normalizeUsptoApplicationNumber } from "@beep/uspto"
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(normalizeUsptoApplicationNumber("16/123,456"))) // true
 * console.log(O.isNone(normalizeUsptoApplicationNumber("not a number"))) // true
 * ```
 *
 * @param text - Free-text application number candidate.
 * @returns The normalized eight-digit form, or none.
 * @category parsers
 * @since 0.0.0
 */
export const normalizeUsptoApplicationNumber = (text: string): O.Option<string> =>
  pipe(
    S.decodeOption(UsptoApplicationNumberFromText)(text),
    O.map((value): string => value)
  );

/**
 * Normalize free-text into a USPTO patent number candidate.
 *
 * **Details**
 *
 * Strips `US` prefixes, kind codes (for example `B2`), commas, and spaces
 * (for example `US 10,772,255 B2` becomes `10772255`).
 *
 * **Example** (Normalize patent number text)
 *
 * ```ts
 * import { normalizeUsptoPatentNumber } from "@beep/uspto"
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(normalizeUsptoPatentNumber("US 10,772,255 B2"))) // true
 * ```
 *
 * @param text - Free-text patent number candidate.
 * @returns The normalized form, or none.
 * @category parsers
 * @since 0.0.0
 */
export const normalizeUsptoPatentNumber: (text: string) => O.Option<string> = flow(
  S.decodeUnknownOption(UsptoPatentNumberFromText),
  O.map((value): string => value)
);

const UsptoMetadataText = S.Trim.check(S.isNonEmpty({ message: "String must not be empty" })).pipe(
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
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({ description })
  );

/**
 * Native publication XML located by the application's authoritative bulk-data metadata.
 *
 * **Example** (Locate a native publication)
 *
 * ```ts import.meta.vitest name="Locate a native publication"
 * import { UsptoPublishedDocumentReference } from "@beep/uspto"
 *
 * const reference = UsptoPublishedDocumentReference.make({
 *   productIdentifier: "APPXML",
 *   xmlFileName: "application.xml",
 *   fileLocationURI: "https://api.uspto.gov/application.xml",
 * })
 * reference.productIdentifier // => "APPXML"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UsptoPublishedDocumentReference extends S.Opaque<
  UsptoPublishedDocumentReference,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    productIdentifier: S.NonEmptyString,
    xmlFileName: S.NonEmptyString,
    fileLocationURI: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("UsptoPublishedDocumentReference", {
      description: "USPTO native publication XML reference from a file-wrapper metadata response.",
    })
  )
) {}

/**
 * Official application metadata resolved from the Open Data Portal.
 *
 * **Example** (Log application metadata schema)
 *
 * ```ts
 * import { UsptoApplicationMetadata } from "@beep/uspto"
 *
 * console.log(UsptoApplicationMetadata)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UsptoApplicationMetadata extends S.Opaque<UsptoApplicationMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
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
    grantDocumentMetaData: UsptoPublishedDocumentReference.pipe(S.optionalKey).annotateKey({
      description: "Native grant XML reference when supplied by the wrapper.",
    }),
    pgpubDocumentMetaData: UsptoPublishedDocumentReference.pipe(S.optionalKey).annotateKey({
      description: "Native pre-grant publication XML reference when supplied by the wrapper.",
    }),
  }).pipe(
    $I.annoteSchema("UsptoApplicationMetadata", {
      description: "Official USPTO application metadata projected from a patent file wrapper response.",
    })
  )
) {
  static readonly decodeEffect = S.decodeUnknownEffect(this);
}

/**
 * Parent and child continuity application numbers for one application.
 *
 * **Example** (Create empty continuity)
 *
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
export class UsptoContinuity extends S.Opaque<UsptoContinuity, { readonly brand: unique symbol }>()(
  S.Struct({
    childApplicationNumbers: S.Array(UsptoApplicationNumber).annotateKey({
      description: "Normalized child continuity application numbers.",
    }),
    parentApplicationNumbers: S.Array(UsptoApplicationNumber).annotateKey({
      description: "Normalized parent continuity application numbers.",
    }),
  }).pipe(
    $I.annoteSchema("UsptoContinuity", {
      description: "Parent and child continuity application numbers anchoring an application to its patent family.",
    })
  )
) {
  static readonly decodeEffect = S.decodeUnknownEffect(this);
}

/**
 * One published representation of a file-wrapper document, with its source format label.
 *
 * **Example** (Describe an XML download)
 *
 * ```ts import.meta.vitest name="Describe an XML download"
 * import { UsptoDocumentDownloadOption } from "@beep/uspto"
 *
 * const option = UsptoDocumentDownloadOption.make({
 *   downloadUrl: "https://api.uspto.gov/docs/claims.xml",
 *   mimeTypeIdentifier: "XML",
 * })
 * option.mimeTypeIdentifier // => "XML"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UsptoDocumentDownloadOption extends S.Opaque<
  UsptoDocumentDownloadOption,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    downloadUrl: S.String,
    mimeTypeIdentifier: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("UsptoDocumentDownloadOption", {
      description: "A document download URL and its optional USPTO format label.",
    })
  )
) {}

/**
 * Reference to one document in an application file wrapper.
 *
 * **Example** (Log document reference schema)
 *
 * ```ts import.meta.vitest name="Log document reference schema"
 * import { UsptoDocumentReference } from "@beep/uspto"
 *
 * console.log(UsptoDocumentReference)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UsptoDocumentReference extends S.Opaque<UsptoDocumentReference, { readonly brand: unique symbol }>()(
  S.Struct({
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
      description: "First published download URL, retained for callers that do not select a format.",
    }),
    downloadOptions: UsptoDocumentDownloadOption.pipe(S.Array, S.optionalKey).annotateKey({
      description: "All published download options in source order, including their format labels.",
    }),
    officialDate: S.optionalKey(S.String).annotateKey({
      description: "Official USPTO date string associated with the document record.",
    }),
  }).pipe(
    $I.annoteSchema("UsptoDocumentReference", {
      description: "Reference to one file-wrapper document, including its download URL when published.",
    })
  )
) {
  static readonly decodeEffect = S.decodeUnknownEffect(this);
}
