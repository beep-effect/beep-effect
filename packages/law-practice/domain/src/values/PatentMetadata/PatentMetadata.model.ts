/**
 * Patent metadata value objects and pure parsing helpers.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit, PosInt, SchemaUtils } from "@beep/schema";
import { flow, Match, Number as N, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ApplicationNumber } from "../ApplicationNumber/index.js";
import { KindCode } from "../KindCode/index.js";
import { OfficeCode } from "../OfficeCode/index.js";
import { PatentNumber } from "../PatentNumber/index.js";

const $I = $LawPracticeDomainId.create("values/PatentMetadata/PatentMetadata");

const PATENT_NUM_RE = /\b([A-Z]{2})\s*((?:RE|PP|D|H)?\d[\d,]{2,})\s*([A-Z]\d?)?\b/iu;
const ISOISH_DATE_RE = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/u;
const CLASSIFICATION_SYMBOL_RE = /\b([A-HY]\d{2}[A-Z]\s?\d{1,4}\/\d{2,})\b/gu;
const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gu;

const decodeApplicationNumberOption = S.decodeUnknownOption(ApplicationNumber);
const decodeKindCodeOption = S.decodeUnknownOption(KindCode);
const decodeOfficeCodeOption = S.decodeUnknownOption(OfficeCode);
const decodePatentNumberOption = S.decodeUnknownOption(PatentNumber);
const decodePosIntOption = S.decodeUnknownOption(PosInt);
const decodeUrlOption = S.decodeUnknownOption(S.URLFromString);
const DEFAULT_OFFICE_CODE: OfficeCode = "US";

const stripCommas = Str.replace(/,/gu, "");
const normalizeWhitespace = flow(Str.replace(/\s+/gu, " "), Str.trim);
const toUpperTrimmed = flow(Str.trim, Str.toUpperCase);
const toNonEmptyTextOption = flow(Str.trim, O.liftPredicate(Str.isNonEmpty));

const firstSome: <T>(options: ReadonlyArray<O.Option<T>>) => O.Option<T> = flow(A.findFirst(O.isSome), O.flatten);

const firstCapture = (pattern: RegExp, input: string): O.Option<string> =>
  pipe(Str.match(pattern)(input), O.flatMap(A.get(1)), O.map(Str.trim), O.filter(Str.isNonEmpty));

const allCaptures = (pattern: RegExp, input: string): ReadonlyArray<string> =>
  pipe(
    Str.matchAll(pattern)(input),
    A.fromIterable,
    A.map((match) => pipe(A.get(match, 1), O.map(Str.trim), O.filter(Str.isNonEmpty))),
    A.getSomes
  );

const optionFromNonEmptyArray = <T>(values: ReadonlyArray<T>): O.Option<ReadonlyArray<T>> =>
  A.isReadonlyArrayNonEmpty(values) ? O.some(values) : O.none();

const toOfficeCodeOption = flow(toUpperTrimmed, decodeOfficeCodeOption);
const toKindCodeOption = flow(toUpperTrimmed, decodeKindCodeOption);
const toPatentNumberOption = flow(stripCommas, Str.replace(/\s+/gu, ""), decodePatentNumberOption);
const toApplicationNumberOption = flow(Str.replace(/[,\s/.]/gu, ""), decodeApplicationNumberOption);
const toPosIntOption = flow(N.parse, O.flatMap(decodePosIntOption));

const toHttpUrlOption = (value: string): O.Option<URL> =>
  pipe(
    decodeUrlOption(value),
    O.filter((url) => url.protocol === "http:" || url.protocol === "https:")
  );

const normalizeDateText = (raw: string): O.Option<string> =>
  pipe(
    toNonEmptyTextOption(raw),
    O.map((trimmed) =>
      pipe(
        Str.match(ISOISH_DATE_RE)(trimmed),
        O.flatMap((match) => O.all([A.get(match, 1), A.get(match, 2), A.get(match, 3)])),
        O.map(
          ([year, month, day]) => `${year}-${pipe(month, Str.padStart(2, "0"))}-${pipe(day, Str.padStart(2, "0"))}`
        ),
        O.getOrElse(() => trimmed)
      )
    )
  );

/**
 * Figure metadata extracted from patent content or API image URL maps.
 *
 * @category models
 * @since 0.0.0
 */
export class PatentFigure extends S.Class<PatentFigure>($I`PatentFigure`)(
  {
    label: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("PatentFigure.label", {
        description: "Human-readable figure label such as FIG. 1 or the source filename.",
      })
    ),
    url: S.URLFromString.pipe(
      $I.annoteKey("PatentFigure.url", {
        description: "Resolvable absolute HTTP(S) image URL.",
      })
    ),
    alt: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("PatentFigure.alt", {
        description: "Short alternate text for accessibility.",
      })
    ),
  },
  $I.annote("PatentFigure", {
    description: "Patent figure image reference with display and accessibility metadata.",
  })
) {}

/**
 * Patent assignee metadata.
 *
 * @category models
 * @since 0.0.0
 */
export class PatentAssignee extends S.Class<PatentAssignee>($I`PatentAssignee`)(
  {
    name: S.NonEmptyString.pipe(
      $I.annoteKey("PatentAssignee.name", {
        description: "Assignee name as printed in the patent record.",
      })
    ),
    location: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("PatentAssignee.location", {
        description: "Optional assignee location.",
      })
    ),
  },
  $I.annote("PatentAssignee", {
    description: "Entity assigned ownership rights in the patent record.",
  })
) {}

/**
 * Schema-first patent reference parsed from a raw document identifier.
 *
 * @category models
 * @since 0.0.0
 */
export class PatentReference extends S.Class<PatentReference>($I`PatentReference`)(
  {
    country: OfficeCode.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("PatentReference.country", {
        description: "WIPO ST.3 office code parsed from the reference.",
      })
    ),
    number: PatentNumber.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("PatentReference.number", {
        description: "WIPO ST.6 patent publication number with punctuation removed.",
      })
    ),
    kindCode: KindCode.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("PatentReference.kindCode", {
        description: "WIPO ST.16 kind code parsed from the reference.",
      })
    ),
  },
  $I.annote("PatentReference", {
    description: "Parsed patent document reference components.",
  })
) {
  static readonly empty = (): PatentReference => PatentReference.make({});
}

/**
 * Jurisdiction-aware patent metadata.
 *
 * @category models
 * @since 0.0.0
 */
export class PatentMetadata extends S.Class<PatentMetadata>($I`PatentMetadata`)(
  {
    patentNumber: PatentNumber.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("PatentMetadata.patentNumber", {
        description: "WIPO ST.6 patent publication number.",
      })
    ),
    country: OfficeCode.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("PatentMetadata.country", {
        description: "WIPO ST.3 office code.",
      })
    ),
    kindCode: KindCode.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("PatentMetadata.kindCode", {
        description: "WIPO ST.16 patent document kind code.",
      })
    ),
    publicationDate: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("PatentMetadata.publicationDate", {
        description: "Publication date text normalized to ISO YYYY-MM-DD where possible.",
      })
    ),
    applicationNumber: ApplicationNumber.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("PatentMetadata.applicationNumber", {
        description: "WIPO ST.13 patent application number when present.",
      })
    ),
    filingDate: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("PatentMetadata.filingDate", {
        description: "Filing date text normalized to ISO YYYY-MM-DD where possible.",
      })
    ),
    priorityDate: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("PatentMetadata.priorityDate", {
        description: "Priority date text normalized to ISO YYYY-MM-DD where possible.",
      })
    ),
    assignees: PatentAssignee.pipe(
      S.Array,
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("PatentMetadata.assignees", {
        description: "Assignees extracted from the patent record.",
      })
    ),
    claimsCount: PosInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("PatentMetadata.claimsCount", {
        description: "Positive count of patent claims.",
      })
    ),
    inventors: S.NonEmptyString.pipe(
      S.Array,
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("PatentMetadata.inventors", {
        description: "Inventor names extracted from the patent record.",
      })
    ),
    ipc: S.NonEmptyString.pipe(
      S.Array,
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("PatentMetadata.ipc", {
        description: "International Patent Classification symbols.",
      })
    ),
    cpc: S.NonEmptyString.pipe(
      S.Array,
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      $I.annoteKey("PatentMetadata.cpc", {
        description: "Cooperative Patent Classification symbols.",
      })
    ),
  },
  $I.annote("PatentMetadata", {
    description: "Jurisdiction-aware patent metadata for US, EPO, WIPO, and other ST.3 offices.",
  })
) {}

/**
 * Supported office presentation metadata keys.
 *
 * @category value-objects
 * @since 0.0.0
 */
export const PatentOfficeCode = LiteralKit(["US", "EP", "WO"]).pipe(
  $I.annoteSchema("PatentOfficeCode", {
    description: "Patent offices with bundled presentation metadata.",
  })
);

/**
 * Type-level literal union produced by {@link PatentOfficeCode}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PatentOfficeCode = typeof PatentOfficeCode.Type;

const toPatentOfficeCodeOption = flow(toUpperTrimmed, S.decodeUnknownOption(PatentOfficeCode));

/**
 * Patent document status derived from WIPO ST.16 kind codes.
 *
 * @category value-objects
 * @since 0.0.0
 */
export const PatentStatus = LiteralKit([
  "application",
  "granted",
  "reexam",
  "reissue",
  "design",
  "plant",
  "international",
  "unknown",
]).pipe(
  $I.annoteSchema("PatentStatus", {
    description: "Patent document status derived from the office and ST.16 kind code.",
  })
);

/**
 * Type-level literal union produced by {@link PatentStatus}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PatentStatus = typeof PatentStatus.Type;

/**
 * Office presentation metadata for patent UI surfaces.
 *
 * @category models
 * @since 0.0.0
 */
export class PatentOffice extends S.Class<PatentOffice>($I`PatentOffice`)(
  {
    code: PatentOfficeCode.pipe(
      $I.annoteKey("PatentOffice.code", {
        description: "Office presentation metadata key.",
      })
    ),
    label: S.NonEmptyString.pipe(
      $I.annoteKey("PatentOffice.label", {
        description: "Short office label.",
      })
    ),
    name: S.NonEmptyString.pipe(
      $I.annoteKey("PatentOffice.name", {
        description: "Official office name.",
      })
    ),
    logo: S.NonEmptyString.pipe(
      $I.annoteKey("PatentOffice.logo", {
        description: "Bundled logo asset path.",
      })
    ),
    flag: S.NonEmptyString.pipe(
      $I.annoteKey("PatentOffice.flag", {
        description: "Office flag or symbol.",
      })
    ),
  },
  $I.annote("PatentOffice", {
    description: "WIPO ST.16 office logo and flag metadata for jurisdiction-aware UI.",
  })
) {}

/**
 * Office logo and flag metadata used for display.
 *
 * @category constants
 * @since 0.0.0
 */
export const PATENT_OFFICES = {
  US: PatentOffice.make({
    code: "US",
    label: "USPTO",
    name: "United States Patent and Trademark Office",
    logo: "/assets/banner/uspto.png",
    flag: "🇺🇸",
  }),
  EP: PatentOffice.make({
    code: "EP",
    label: "EPO",
    name: "European Patent Office",
    logo: "/assets/banner/epo.jpg",
    flag: "🇪🇺",
  }),
  WO: PatentOffice.make({
    code: "WO",
    label: "WIPO",
    name: "World Intellectual Property Organization",
    logo: "/assets/banner/wipo.svg",
    flag: "🌐",
  }),
};

/**
 * Metadata accepted by {@link getPatentDisplay}.
 *
 * @category models
 * @since 0.0.0
 */
export class PatentDisplayMetadata extends S.Class<PatentDisplayMetadata>($I`PatentDisplayMetadata`)(
  {
    patent_number: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    patentNumber: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    country: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    kind_code: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    kindCode: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PatentDisplayMetadata", {
    description: "Snake-case or camelCase patent metadata fields accepted by display helpers.",
  })
) {}

/**
 * Companion namespace for {@link PatentDisplayMetadata}.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace PatentDisplayMetadata {
  /**
   * Encoded input accepted by {@link getPatentDisplay}.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof PatentDisplayMetadata.Encoded;
}

/**
 * Jurisdiction-aware display identity for a patent document.
 *
 * @category models
 * @since 0.0.0
 */
export class PatentDisplay extends S.Class<PatentDisplay>($I`PatentDisplay`)(
  {
    country: OfficeCode,
    number: PatentNumber.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    kindCode: KindCode.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    formatted: S.NonEmptyString,
    office: PatentOffice,
    status: PatentStatus,
    statusLabel: S.NonEmptyString,
  },
  $I.annote("PatentDisplay", {
    description: "Display-ready patent identifier, office metadata, and derived document status.",
  })
) {}

/**
 * Extracted IPC and CPC classification symbols.
 *
 * @category models
 * @since 0.0.0
 */
export class PatentClassifications extends S.Class<PatentClassifications>($I`PatentClassifications`)(
  {
    ipc: S.NonEmptyString.pipe(S.Array, SchemaUtils.withEmptyArrayDefaults<string>()),
    cpc: S.NonEmptyString.pipe(S.Array, SchemaUtils.withEmptyArrayDefaults<string>()),
  },
  $I.annote("PatentClassifications", {
    description: "IPC and CPC classification symbols extracted from patent content.",
  })
) {}

/**
 * Patent section names supported by {@link parsePatentSections}.
 *
 * @category value-objects
 * @since 0.0.0
 */
export const PatentSectionKind = LiteralKit(["abstract", "claims", "description", "citations", "drawings", "all"]).pipe(
  $I.annoteSchema("PatentSectionKind", {
    description: "Patent content section selector.",
  })
);

/**
 * Type-level literal union produced by {@link PatentSectionKind}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PatentSectionKind = typeof PatentSectionKind.Type;

/**
 * Parsed patent content sections.
 *
 * @category models
 * @since 0.0.0
 */
export class PatentSections extends S.Class<PatentSections>($I`PatentSections`)(
  {
    abstract: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    claims: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    description: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    citations: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    drawings: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PatentSections", {
    description: "Optional patent content sections extracted from markdown-like patent text.",
  })
) {}

/**
 * Resolve office presentation metadata from a country code.
 *
 * @category utilities
 * @since 0.0.0
 */
export const getOffice = (country?: string): PatentOffice =>
  pipe(
    O.fromNullishOr(country),
    O.flatMap(toPatentOfficeCodeOption),
    O.flatMap((code) => R.get(PATENT_OFFICES, code)),
    O.getOrElse(() => PATENT_OFFICES.US)
  );

/**
 * Parse a raw patent reference into office, publication number, and kind code.
 *
 * @category utilities
 * @since 0.0.0
 */
export const parsePatentReference = (raw: string): PatentReference =>
  pipe(
    Str.match(PATENT_NUM_RE)(raw),
    O.map((match) =>
      PatentReference.make({
        country: pipe(A.get(match, 1), O.map(toUpperTrimmed), O.flatMap(decodeOfficeCodeOption)),
        number: pipe(A.get(match, 2), O.map(stripCommas), O.flatMap(decodePatentNumberOption)),
        kindCode: pipe(A.get(match, 3), O.map(toUpperTrimmed), O.flatMap(decodeKindCodeOption)),
      })
    ),
    O.getOrElse(PatentReference.empty)
  );

const STATUS_BY_KIND_LETTER: Readonly<Record<string, PatentStatus>> = {
  A: PatentStatus.Enum.application,
  B: PatentStatus.Enum.granted,
  C: PatentStatus.Enum.reexam,
  E: PatentStatus.Enum.reissue,
  S: PatentStatus.Enum.design,
  P: PatentStatus.Enum.plant,
};

const statusFromKindLetter = (letter: string): PatentStatus =>
  pipe(
    R.get(STATUS_BY_KIND_LETTER, letter),
    O.getOrElse(() => PatentStatus.Enum.unknown)
  );

/**
 * Derive a patent document status from office and kind code.
 *
 * @category utilities
 * @since 0.0.0
 */
export const getStatusFromKindCode = (country?: string, kindCode: O.Option<string> = O.none()): PatentStatus =>
  pipe(
    O.fromNullishOr(country),
    O.flatMap(toOfficeCodeOption),
    O.filter((code) => code === "WO"),
    O.match({
      onSome: () => PatentStatus.Enum.international,
      onNone: () =>
        pipe(
          kindCode,
          O.map(toUpperTrimmed),
          O.filter(Str.isNonEmpty),
          O.map(flow(Str.takeLeft(1), statusFromKindLetter)),
          O.getOrElse(() => PatentStatus.Enum.unknown)
        ),
    })
  );

const kindCodeExplanationTable = (country: O.Option<string>): Readonly<Record<string, string>> => ({
  A1: pipe(
    country,
    O.filter((code) => code === "EP"),
    O.match({
      onSome: () => "European application published with the search report.",
      onNone: () => "Pre-grant application publication.",
    })
  ),
  A2: pipe(
    country,
    O.filter((code) => code === "EP"),
    O.match({
      onSome: () => "European application published without the search report.",
      onNone: () => "Application publication (republication).",
    })
  ),
  A3: "Separately published search report.",
  A9: "Corrected application publication.",
  B1: pipe(
    country,
    O.filter((code) => code === "EP"),
    O.match({
      onSome: () => "Granted European patent specification.",
      onNone: () => "Granted patent (no prior application publication).",
    })
  ),
  B2: pipe(
    country,
    O.filter((code) => code === "EP"),
    O.match({
      onSome: () => "Amended European specification after opposition/limitation.",
      onNone: () => "Granted patent (application was previously published).",
    })
  ),
  B3: "European specification after limitation procedure.",
  C1: "Reexamination certificate.",
  E: "Reissued patent.",
  S: "Design patent.",
  P2: "Granted plant patent.",
  P3: "Granted plant patent (previously published).",
});

/**
 * Explain a WIPO ST.16 kind code in plain language.
 *
 * @category utilities
 * @since 0.0.0
 */
export const getKindCodeExplanation = (country?: string, kindCode?: string): string | undefined =>
  pipe(
    O.fromNullishOr(kindCode),
    O.map(toUpperTrimmed),
    O.filter(Str.isNonEmpty),
    O.map((code) => {
      const office = pipe(O.fromNullishOr(country), O.map(toUpperTrimmed), O.filter(Str.isNonEmpty));

      return pipe(
        office,
        O.filter((officeCode) => officeCode === "WO"),
        O.match({
          onSome: () =>
            "WIPO/PCT international application (not a granted patent - grant happens later in national phase).",
          onNone: () =>
            pipe(
              R.get(kindCodeExplanationTable(office), code),
              O.getOrElse(() => `Kind code ${code}.`)
            ),
        })
      );
    }),
    O.getOrUndefined
  );

/**
 * Human label for a kind-code-derived status.
 *
 * @category utilities
 * @since 0.0.0
 */
export const getStatusLabel = Match.type<PatentStatus>().pipe(
  Match.when("application", () => "Application"),
  Match.when("granted", () => "Granted"),
  Match.when("reexam", () => "Reexamination"),
  Match.when("reissue", () => "Reissue"),
  Match.when("design", () => "Design"),
  Match.when("plant", () => "Plant"),
  Match.when("international", () => "International application"),
  Match.when("unknown", () => "Patent"),
  Match.exhaustive
);

const groupDigits = (number: string): string =>
  pipe(
    Str.match(/^([A-Z]*)(\d+)$/iu)(number),
    O.flatMap((match) => O.all([A.get(match, 1), A.get(match, 2)])),
    O.map(([prefix, digits]) => `${prefix}${pipe(digits, Str.replace(/\B(?=(\d{3})+(?!\d))/gu, ","))}`),
    O.getOrElse(() => number)
  );

const metadataField = <A>(
  metadata: PatentDisplayMetadata.Encoded | null | undefined,
  field: (metadata: PatentDisplayMetadata.Encoded) => A | null | undefined
): O.Option<A> =>
  pipe(
    O.fromNullishOr(metadata),
    O.flatMap((value) => O.fromNullishOr(field(value)))
  );

const makePatentDisplayInput = (metadata: PatentDisplayMetadata.Encoded | null | undefined): PatentDisplayMetadata =>
  PatentDisplayMetadata.make({
    patent_number: metadataField(metadata, ({ patent_number }) => patent_number),
    patentNumber: metadataField(metadata, ({ patentNumber }) => patentNumber),
    country: metadataField(metadata, ({ country }) => country),
    kind_code: metadataField(metadata, ({ kind_code }) => kind_code),
    kindCode: metadataField(metadata, ({ kindCode }) => kindCode),
  });

const patentDisplayRawNumber = (input: PatentDisplayMetadata): string =>
  pipe(
    firstSome([input.patentNumber, input.patent_number]),
    O.getOrElse(() => "")
  );

const patentDisplayContentReference = (content: string | undefined): PatentReference =>
  pipe(O.fromNullishOr(content), O.map(parsePatentReference), O.getOrElse(PatentReference.empty));

const patentDisplayCountry = (
  input: PatentDisplayMetadata,
  fromNumber: PatentReference,
  fromContent: PatentReference
): OfficeCode =>
  pipe(
    firstSome([pipe(input.country, O.flatMap(toOfficeCodeOption)), fromNumber.country, fromContent.country]),
    O.getOrElse(() => DEFAULT_OFFICE_CODE)
  );

const patentDisplayKindCode = (
  input: PatentDisplayMetadata,
  fromNumber: PatentReference,
  fromContent: PatentReference
): O.Option<KindCode> =>
  firstSome([
    pipe(input.kind_code, O.flatMap(toKindCodeOption)),
    pipe(input.kindCode, O.flatMap(toKindCodeOption)),
    fromNumber.kindCode,
    fromContent.kindCode,
  ]);

const patentDisplayNumber = (
  rawNumber: string,
  fromNumber: PatentReference,
  fromContent: PatentReference
): O.Option<PatentNumber> => firstSome([fromNumber.number, toPatentNumberOption(rawNumber), fromContent.number]);

const patentDisplayFormatted = (
  country: OfficeCode,
  number: O.Option<PatentNumber>,
  kindCode: O.Option<KindCode>
): string => {
  const display = pipe(
    number,
    O.map((value) => `${country} ${groupDigits(value)}`),
    O.getOrElse(() => country)
  );

  return pipe(
    kindCode,
    O.map((value) => `${display} ${value}`),
    O.getOrElse(() => display)
  );
};

/**
 * Build a jurisdiction-aware display identity from API metadata and content.
 *
 * @category utilities
 * @since 0.0.0
 */
export const getPatentDisplay = (metadata?: PatentDisplayMetadata.Encoded | null, content?: string): PatentDisplay => {
  const input = makePatentDisplayInput(metadata);
  const rawNumber = patentDisplayRawNumber(input);
  const fromNumber = parsePatentReference(rawNumber);
  const fromContent = patentDisplayContentReference(content);
  const country = patentDisplayCountry(input, fromNumber, fromContent);
  const kindCode = patentDisplayKindCode(input, fromNumber, fromContent);
  const number = patentDisplayNumber(rawNumber, fromNumber, fromContent);
  const formatted = patentDisplayFormatted(country, number, kindCode);
  const status = getStatusFromKindCode(country, kindCode);

  return PatentDisplay.make({
    country,
    number,
    kindCode,
    formatted,
    office: getOffice(country),
    status,
    statusLabel: getStatusLabel(status),
  });
};

/**
 * Extract a patent abstract from markdown-like patent content.
 *
 * @category utilities
 * @since 0.0.0
 */
export const extractPatentAbstract = (content: string): string => {
  const abstract = firstSome(
    A.map(
      [
        /##\s*Abstract\s*\n+([\s\S]*?)(?=\n##|$)/iu,
        /Abstract:\s*\n+([\s\S]*?)(?=\n##|$)/iu,
        /ABSTRACT\s*\n+([\s\S]*?)(?=\n##|DESCRIPTION|CLAIMS|BACKGROUND|$)/iu,
      ],
      (pattern) =>
        pipe(
          firstCapture(pattern, content),
          O.filter((text) => text.length > 50)
        )
    )
  );
  const fallback = firstCapture(/(?:##\s*[\w\s-]+\n+)+([\s\S]{100,1000}?)(?=\n##\s*Description|$)/iu, content);

  return pipe(
    abstract,
    O.orElse(() => fallback),
    O.orElse(() =>
      pipe(
        content,
        Str.takeLeft(400),
        Str.trim,
        O.liftPredicate(Str.isNonEmpty),
        O.map((value) => `${value}...`)
      )
    ),
    O.getOrElse(() => "")
  );
};

const parseAssigneeLine = (line: string): O.Option<PatentAssignee> => {
  const cleanLine = pipe(line, Str.replace(/^-\s*\*\*/u, ""), Str.replace(/\*\*/u, ""), Str.trim);
  const name = pipe(cleanLine, Str.replace(/\([^)]+\)/u, ""), Str.trim);

  return pipe(
    toNonEmptyTextOption(name),
    O.map((assigneeName) =>
      PatentAssignee.make({
        name: assigneeName,
        location: firstCapture(/\(([^)]+)\)/u, cleanLine),
      })
    )
  );
};

const parseAssignees = (content: string): ReadonlyArray<PatentAssignee> =>
  pipe(
    firstCapture(/###\s*Assignees\s*\n([\s\S]*?)(?=\n#{1,3}|$)/iu, content),
    O.map(flow(Str.split("\n"), A.map(Str.trim), A.filter(Str.startsWith("-")), A.map(parseAssigneeLine), A.getSomes)),
    O.getOrElse(A.empty<PatentAssignee>)
  );

/**
 * Extract structured metadata from patent content.
 *
 * @category utilities
 * @since 0.0.0
 */
export const parsePatentMetadata = (content: string): PatentMetadata => {
  const labelledReference = firstCapture(
    /\*\*Patent Number:?\*\*\s*([A-Z]{2}\s*(?:RE|PP|D|H)?[\d,]+\s*[A-Z]?\d?)/iu,
    content
  );
  const reference = parsePatentReference(
    pipe(
      labelledReference,
      O.getOrElse(() => content)
    )
  );
  const claimsFromLabel = pipe(
    firstCapture(/\*{0,2}Number of Claims:?\*{0,2}\s*(\d+)/iu, content),
    O.flatMap(toPosIntOption)
  );
  const claimsFromSection = pipe(
    firstCapture(/##\s*Claims?\s*\n+([\s\S]*?)(?=\n##|$)/iu, content),
    O.map((claims) => A.length(A.fromIterable(Str.matchAll(/^\s*\d+\.\s/gmu)(claims)))),
    O.flatMap(decodePosIntOption)
  );
  const assignees = parseAssignees(content);
  const classifications = extractClassifications(content);

  return PatentMetadata.make({
    patentNumber: reference.number,
    country: reference.country,
    kindCode: reference.kindCode,
    publicationDate: pipe(
      firstCapture(/\*{0,2}(?:Publication Date|Date of publication|Published):?\*{0,2}\s*([\d./-]+)/iu, content),
      O.flatMap(normalizeDateText)
    ),
    applicationNumber: pipe(
      firstCapture(/\*{0,2}(?:Application Number|Application No\.?|Filing No\.?):?\*{0,2}\s*([\d,/.]+)/iu, content),
      O.flatMap(toApplicationNumberOption)
    ),
    filingDate: pipe(
      firstCapture(/\*{0,2}(?:Filing Date|Date of filing):?\*{0,2}\s*([\d./-]+)/iu, content),
      O.flatMap(normalizeDateText)
    ),
    priorityDate: pipe(
      firstCapture(/\*{0,2}(?:Priority Date|Earliest Priority):?\*{0,2}\s*([\d./-]+)/iu, content),
      O.flatMap(normalizeDateText)
    ),
    assignees: optionFromNonEmptyArray(assignees),
    claimsCount: firstSome([claimsFromLabel, claimsFromSection]),
    inventors: O.none(),
    ipc: optionFromNonEmptyArray(classifications.ipc),
    cpc: optionFromNonEmptyArray(classifications.cpc),
  });
};

const normalizeClassification = flow(normalizeWhitespace, Str.toUpperCase);

const pickClassifications = (labelRe: RegExp, content: string): ReadonlyArray<string> =>
  pipe(
    firstCapture(labelRe, content),
    O.map((block) => pipe(allCaptures(CLASSIFICATION_SYMBOL_RE, block), A.map(normalizeClassification), A.dedupe)),
    O.getOrElse(A.empty<string>)
  );

/**
 * Extract IPC and CPC classification symbols from content.
 *
 * @category utilities
 * @since 0.0.0
 */
export const extractClassifications = (content: string): PatentClassifications =>
  PatentClassifications.make({
    ipc: pickClassifications(
      /(?:IPC|International Patent Classification)[:\s)]*([\s\S]{0,400}?)(?=\n##|\n\n|CPC|$)/iu,
      content
    ),
    cpc: pickClassifications(
      /(?:CPC|Cooperative Patent Classification)[:\s)]*([\s\S]{0,400}?)(?=\n##|\n\n|IPC|$)/iu,
      content
    ),
  });

const labelFromName = (name: string): O.Option<string> =>
  pipe(
    firstCapture(/img[-_]?(\d+)/iu, name),
    O.flatMap(N.parse),
    O.map((value) => `FIG. ${value}`)
  );

const figureFromUrl = (url: string, label: O.Option<string>, alt: O.Option<string>): O.Option<PatentFigure> =>
  pipe(
    toHttpUrlOption(url),
    O.map((parsedUrl) =>
      PatentFigure.make({
        url: parsedUrl,
        label,
        alt,
      })
    )
  );

/**
 * Extract patent figures from API image URL maps and markdown images.
 *
 * @category utilities
 * @since 0.0.0
 */
export const extractPatentFigures = (
  content?: string,
  imageUrls?: Readonly<Record<string, string>> | null
): ReadonlyArray<PatentFigure> => {
  const apiFigures = pipe(
    O.fromNullishOr(imageUrls),
    O.map((urls) =>
      pipe(
        R.toEntries(urls),
        A.map(([name, url]) => figureFromUrl(url, labelFromName(name), O.some(name))),
        A.getSomes
      )
    ),
    O.getOrElse(A.empty<PatentFigure>)
  );
  const markdownFigures = pipe(
    O.fromNullishOr(content),
    O.map((body) =>
      pipe(
        Str.matchAll(MARKDOWN_IMAGE_RE)(body),
        A.fromIterable,
        A.map((match) =>
          pipe(
            O.all([A.get(match, 1), A.get(match, 2)]),
            O.flatMap(([alt, url]) => {
              const label = toNonEmptyTextOption(alt);

              return figureFromUrl(url, label, label);
            })
          )
        ),
        A.getSomes
      )
    ),
    O.getOrElse(A.empty<PatentFigure>)
  );

  return pipe(
    A.appendAll(apiFigures, markdownFigures),
    A.dedupeWith((left, right) => left.url.href === right.url.href)
  );
};

const clampSection = (text: string, maxChars: number): string =>
  text.length <= maxChars
    ? text
    : `${pipe(text, Str.takeLeft(maxChars), Str.trimEnd)}\n\n...[truncated to save context; request a specific section or full-text analysis]`;

const wantsSection = (
  requestedSections: O.Option<ReadonlyArray<PatentSectionKind>>,
  section: PatentSectionKind
): boolean =>
  pipe(
    requestedSections,
    O.match({
      onNone: () => true,
      onSome: (sections) => A.contains(sections, "all") || A.contains(sections, section),
    })
  );

const sectionCapture = (pattern: RegExp, content: string, maxChars: number): O.Option<string> =>
  pipe(
    firstCapture(pattern, content),
    O.map((section) => clampSection(section, maxChars)),
    O.flatMap(toNonEmptyTextOption)
  );

/**
 * Parse selected patent content sections.
 *
 * @category utilities
 * @since 0.0.0
 */
export const parsePatentSections = (
  content: string,
  requestedSections?: ReadonlyArray<PatentSectionKind>,
  maxCharsPerSection = 8000
): PatentSections => {
  const requested = pipe(O.fromNullishOr(requestedSections), O.filter(A.isReadonlyArrayNonEmpty));
  const section = (kind: PatentSectionKind, value: O.Option<string>): O.Option<string> =>
    wantsSection(requested, kind) ? value : O.none();

  return PatentSections.make({
    abstract: section(
      "abstract",
      pipe(
        extractPatentAbstract(content),
        (abstract) => clampSection(abstract, maxCharsPerSection),
        toNonEmptyTextOption
      )
    ),
    claims: section("claims", sectionCapture(/##\s*Claims?\s*\n+([\s\S]*?)(?=\n##|$)/iu, content, maxCharsPerSection)),
    description: section(
      "description",
      firstSome([
        sectionCapture(/##\s*Description\s*\n+([\s\S]*?)(?=\n##\s*Claims|$)/iu, content, maxCharsPerSection),
        sectionCapture(/##\s*Detailed Description\s*\n+([\s\S]*?)(?=\n##|$)/iu, content, maxCharsPerSection),
      ])
    ),
    drawings: section(
      "drawings",
      sectionCapture(
        /##\s*(?:Description of Drawings|Brief Description of (?:the )?Drawings)\s*\n+([\s\S]*?)(?=\n##|$)/iu,
        content,
        maxCharsPerSection
      )
    ),
    citations: section(
      "citations",
      sectionCapture(/##\s*(?:Citations?|References Cited).*?\n+([\s\S]*?)(?=\n##|$)/iu, content, maxCharsPerSection)
    ),
  });
};

const formatReference = (reference: PatentReference): O.Option<string> =>
  pipe(
    O.all({ country: reference.country, number: reference.number }),
    O.map(({ country, number }) =>
      pipe(
        reference.kindCode,
        O.map((kindCode) => `${country} ${number} ${kindCode}`),
        O.getOrElse(() => `${country} ${number}`)
      )
    )
  );

/**
 * Extract a canonical patent number from content and optional title fallback.
 *
 * @category utilities
 * @since 0.0.0
 */
export const extractPatentNumber = (content: string, fallbackTitle?: string): string =>
  pipe(
    A.getSomes([
      firstCapture(/\*\*Patent Number:?\*\*\s*([A-Z]{2}\s*(?:RE|PP|D|H)?[\d,]+\s*[A-Z]?\d?)/iu, content),
      O.some(content),
      O.fromNullishOr(fallbackTitle),
    ]),
    A.map(parsePatentReference),
    A.map(formatReference),
    A.getSomes,
    A.head,
    O.getOrElse(() => "Unknown")
  );
