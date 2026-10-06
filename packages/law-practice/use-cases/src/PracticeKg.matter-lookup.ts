/**
 * Stable matter-lookup contract over a practice knowledge-graph bundle.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { KgAttributionSource, PracticeKgEpistemicStatus } from "@beep/law-practice-domain/values";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { flow, Order, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $LawPracticeUseCasesId.create("PracticeKg.matter-lookup");

/**
 * Which identity of a matter a lookup reference matched.
 *
 * **Details**
 *
 * `docket-key` and `family-key` are the client-keyed forms (`<client>.<docket>`,
 * `<client>.<family>`); `docket` and `family` are the bare forms, which several
 * clients can share. `application` and `patent` match a USPTO number filed from
 * one of the matter's dockets, and `client` matches every matter of a client.
 *
 * **Example** (Decode a matched-on label)
 *
 * ```ts
 * import { PracticeKgMatterMatchedOn } from "@beep/law-practice-use-cases/server"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(PracticeKgMatterMatchedOn)("docket-key")) // "docket-key"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PracticeKgMatterMatchedOn = LiteralKit([
  "docket-key",
  "docket",
  "family-key",
  "family",
  "application",
  "patent",
  "client",
]).pipe(
  $I.annoteSchema("PracticeKgMatterMatchedOn", {
    description: "Identity of a matter that a lookup reference matched.",
  })
);

/**
 * Runtime type for {@link PracticeKgMatterMatchedOn}.
 *
 * **Example** (Type a matched-on label)
 *
 * ```ts
 * import type { PracticeKgMatterMatchedOn } from "@beep/law-practice-use-cases/server"
 *
 * const matchedOn: PracticeKgMatterMatchedOn = "application"
 * console.log(matchedOn) // "application"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PracticeKgMatterMatchedOn = typeof PracticeKgMatterMatchedOn.Type;

/**
 * How decisively a reference resolved.
 *
 * **Gotchas**
 *
 * Only `unique` is safe to act on without a person. `ambiguous` means several
 * matters share the reference (a bare docket number reused across clients is the
 * usual cause) and `none` means the bundle knows nothing about it; callers must
 * surface both instead of picking a matter.
 *
 * **Example** (Decode a resolution)
 *
 * ```ts
 * import { PracticeKgMatterResolution } from "@beep/law-practice-use-cases/server"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(PracticeKgMatterResolution)("ambiguous")) // "ambiguous"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PracticeKgMatterResolution = LiteralKit(["unique", "ambiguous", "none"]).pipe(
  $I.annoteSchema("PracticeKgMatterResolution", {
    description: "Whether a matter reference resolved to one matter, several, or none.",
  })
);

/**
 * Runtime type for {@link PracticeKgMatterResolution}.
 *
 * **Example** (Type a resolution)
 *
 * ```ts
 * import type { PracticeKgMatterResolution } from "@beep/law-practice-use-cases/server"
 *
 * const resolution: PracticeKgMatterResolution = "unique"
 * console.log(resolution) // "unique"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PracticeKgMatterResolution = typeof PracticeKgMatterResolution.Type;

/**
 * One reference to resolve against the bundle.
 *
 * **Details**
 *
 * `reference` is any single identifier as it appears in mail or a document: a
 * client-keyed docket (`12345.10008US01`), a bare docket (`10008US01`), a
 * family in either form, a USPTO application (`14/783,547`) or patent number
 * (`US 10,252,356 B2`), or a client number. Use
 * {@link extractPracticeKgReferences} to pull candidates out of free text.
 *
 * **Example** (Make a lookup request)
 *
 * ```ts
 * import { PracticeKgMatterLookupRequest } from "@beep/law-practice-use-cases/server"
 *
 * const request = PracticeKgMatterLookupRequest.make({ reference: "12345.10008US01" })
 * console.log(request.reference) // "12345.10008US01"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgMatterLookupRequest extends S.Class<PracticeKgMatterLookupRequest>(
  $I`PracticeKgMatterLookupRequest`
)(
  {
    reference: S.NonEmptyString.annotateKey({
      description: "One docket, family, application, patent, or client identifier to resolve.",
    }),
  },
  $I.annote("PracticeKgMatterLookupRequest", {
    description: "Single reference to resolve to practice matters.",
  })
) {}

/**
 * One country-stage docket of a matter with the USPTO numbers filed from it.
 *
 * **Example** (Make a matter docket)
 *
 * ```ts
 * import { PracticeKgMatterDocket } from "@beep/law-practice-use-cases/server"
 *
 * const docket = PracticeKgMatterDocket.make({
 *   applicationNumbers: ["14783547"],
 *   docket: "10008US01",
 *   docketKey: "12345.10008US01",
 *   documentCount: 4,
 *   epistemicStatus: "derived-from-official-records",
 *   matched: true,
 *   patentNumbers: []
 * })
 * console.log(docket.docketKey) // "12345.10008US01"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgMatterDocket extends S.Class<PracticeKgMatterDocket>($I`PracticeKgMatterDocket`)(
  {
    applicationNumbers: S.Array(S.String),
    docket: S.NonEmptyString,
    docketKey: S.NonEmptyString,
    documentCount: S.Finite,
    epistemicStatus: PracticeKgEpistemicStatus,
    matched: S.Boolean.annotateKey({
      description: "True when the lookup reference named this docket or a number filed from it.",
    }),
    patentNumbers: S.Array(S.String),
  },
  $I.annote("PracticeKgMatterDocket", {
    description: "Docket of a practice matter with its application and patent numbers.",
  })
) {}

/**
 * One practice matter: a client-keyed docket family and its dockets.
 *
 * **Gotchas**
 *
 * `client` is null and `familyKey` equals the bare `family` for the
 * unattributed remainder of a family number, whose documents carry no client
 * evidence. Such a matter, and any matter whose `epistemicStatus` is
 * `recycled-unverified`, must be confirmed by a person before anything is filed
 * or tagged under it. `clientName` comes from the attorney's docket register by
 * client number and is null when the register does not list the client or
 * lists it under more than one name.
 *
 * **Example** (Make a matter)
 *
 * ```ts
 * import { PracticeKgMatter } from "@beep/law-practice-use-cases/server"
 *
 * const matter = PracticeKgMatter.make({
 *   attributionSource: "text-reference",
 *   client: "12345",
 *   clientName: "Example Client",
 *   docketCount: 1,
 *   dockets: [],
 *   documentCount: 4,
 *   epistemicStatus: "derived-from-official-records",
 *   family: "10008",
 *   familyKey: "12345.10008",
 *   matchedOn: ["family-key"]
 * })
 * console.log(matter.familyKey) // "12345.10008"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgMatter extends S.Class<PracticeKgMatter>($I`PracticeKgMatter`)(
  {
    attributionSource: KgAttributionSource,
    client: S.NullOr(S.String),
    clientName: S.NullOr(S.String).annotateKey({
      description: "Client name from the attorney's docket register; null when it does not name the client.",
    }),
    docketCount: S.Finite,
    dockets: S.Array(PracticeKgMatterDocket),
    documentCount: S.Finite,
    epistemicStatus: PracticeKgEpistemicStatus,
    family: S.NonEmptyString,
    familyKey: S.NonEmptyString,
    matchedOn: S.Array(PracticeKgMatterMatchedOn),
  },
  $I.annote("PracticeKgMatter", {
    description: "Client-keyed docket family with its dockets, attribution, and how the reference matched it.",
  })
) {}

/**
 * Result of resolving one reference.
 *
 * **Example** (Make an empty result)
 *
 * ```ts
 * import { PracticeKgMatterLookupResult } from "@beep/law-practice-use-cases/server"
 *
 * const result = PracticeKgMatterLookupResult.make({
 *   bundleVersion: "2026-10-06-02",
 *   matters: [],
 *   reference: "99999US01",
 *   resolution: "none"
 * })
 * console.log(result.resolution) // "none"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgMatterLookupResult extends S.Class<PracticeKgMatterLookupResult>(
  $I`PracticeKgMatterLookupResult`
)(
  {
    bundleVersion: S.NonEmptyString,
    matters: S.Array(PracticeKgMatter),
    reference: S.NonEmptyString,
    resolution: PracticeKgMatterResolution,
  },
  $I.annote("PracticeKgMatterLookupResult", {
    description: "Matters a reference resolved to, with the bundle version that answered.",
  })
) {}

/**
 * Failure reading the bundle's matter tables.
 *
 * **Example** (Make a lookup error)
 *
 * ```ts
 * import { PracticeKgMatterLookupError } from "@beep/law-practice-use-cases/server"
 *
 * const error = PracticeKgMatterLookupError.make({ message: "Matter tables are unreadable." })
 * console.log(error._tag) // "PracticeKgMatterLookupError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PracticeKgMatterLookupError extends S.TaggedError<PracticeKgMatterLookupError>(
  $I`PracticeKgMatterLookupError`
)(
  "PracticeKgMatterLookupError",
  {
    cause: S.optionalKey(S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))),
    message: S.NonEmptyString,
  },
  $I.annoteError<PracticeKgMatterLookupError>("PracticeKgMatterLookupError", {
    description: "Failure while resolving a matter reference against the bundle.",
  })
) {}

/**
 * Country stages a practice docket can carry, in the order the patterns try them.
 *
 * **Details**
 *
 * One list serves every place that recognises a docket: the reference
 * extractor in this module and the bundle build's text scan. Adding a stage
 * here widens both together.
 *
 * **Example** (Check a country stage)
 *
 * ```ts
 * import { practiceKgDocketCountryCodes } from "@beep/law-practice-use-cases/server"
 * import * as A from "effect/Array"
 *
 * console.log(A.contains(practiceKgDocketCountryCodes, "BR")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const practiceKgDocketCountryCodes: ReadonlyArray<string> = [
  "US",
  "WO",
  "EP",
  "CA",
  "AU",
  "CN",
  "JP",
  "PCT",
  "BR",
  "ZA",
  "UA",
  "AR",
  "EA",
  "IN",
  "IL",
  "GB",
  "DE",
  "RU",
  "KR",
  "ID",
  "NZ",
  "MX",
];
const docketBody = `[0-9]{5,6}(?:${A.join(practiceKgDocketCountryCodes, "|")})[0-9]{0,3}(?:-[A-Z]{2}[0-9]+)?(?![0-9A-Z])`;
const docketReferencePattern = new RegExp(`(?<![0-9.A-Z])(?:[0-9]{4,6}\\.)?${docketBody}`, "giu");
const keyedDocketPattern = new RegExp(`(?<![0-9.A-Z])([0-9]{4,6})\\.(${docketBody})`, "giu");
const clientPrefixPattern = /^[0-9]{4,6}\./u;
const attorneyMatterNumberPattern = /(?<![0-9.])[0-9]{4,6}\.0[0-9]{4}(?![0-9A-Z])/giu;
const clientFolderPattern = /(?:^|\s)([0-9]{5})$/u;
const familyOfDocketPattern = /^[0-9]{5,6}/u;
const pathSeparatorPattern = /[\\/]+/u;
const applicationReferencePattern = /(?<![0-9/])[0-9]{2}\/[0-9]{3},?[0-9]{3}(?![0-9])/gu;
const patentReferencePattern = /(?<![0-9,])(?:US[ -]?)?[0-9]{1,2},[0-9]{3},[0-9]{3}(?![0-9,])/giu;

const matchesOf = (pattern: RegExp, text: string): ReadonlyArray<string> =>
  A.map(A.fromIterable(text.matchAll(pattern)), (match) => match[0]);

/**
 * Pull candidate matter references out of free text such as a mail subject,
 * body, or attachment name.
 *
 * **Details**
 *
 * Finds docket references in the practice's `<client>.<docket><country><seq>`
 * and bare `<docket><country><seq>` forms (any country stage the practice
 * files in, with an optional national-phase suffix such as `-CA1`), USPTO application numbers written
 * `NN/NNN,NNN`, and patent numbers written with comma groups. Bare digit runs
 * are deliberately ignored: a five-digit number alone is as likely a postcode
 * as a family. The result is de-duplicated, upper-cased, and sorted, and every
 * element is a valid `reference` for a lookup.
 *
 * **Example** (Extract references from a subject line)
 *
 * ```ts
 * import { extractPracticeKgReferences } from "@beep/law-practice-use-cases/server"
 *
 * console.log(extractPracticeKgReferences("RE: Office Action 12345.10008US01, App. 14/783,547"))
 * // ["12345.10008US01", "14/783,547"]
 * ```
 *
 * @param text - Free text to scan.
 * @returns Distinct candidate references in stable order.
 * @category parsers
 * @since 0.0.0
 */
export const extractPracticeKgReferences = (text: string): ReadonlyArray<string> =>
  distinctSorted([
    ...matchesOf(docketReferencePattern, text),
    ...matchesOf(applicationReferencePattern, text),
    ...matchesOf(patentReferencePattern, text),
  ]);

/**
 * Matter evidence read from a file path in the attorney's working folders.
 *
 * **Details**
 *
 * The working folders are laid out
 * `<client name> <client number>/<docket> - <client number>.<matter number>/...`.
 * `clientNumber` is the five-digit number that ends a folder name, `dockets` are
 * the docket references in the path, and `familyKeys` are the
 * `<client>.<family>` matter keys those two give together (a client-keyed
 * docket in the path supplies its own client).
 *
 * **Gotchas**
 *
 * `attorneyMatterNumbers` holds the dotted `<client>.<0NNNN>` suffix of a matter
 * folder. It is the attorney's own per-client matter sequence, not a docket
 * family: never look it up as a `familyKey`, and never build one from it.
 *
 * **Example** (Make path evidence)
 *
 * ```ts
 * import { PracticeKgPathEvidence } from "@beep/law-practice-use-cases/server"
 *
 * const evidence = PracticeKgPathEvidence.make({
 *   attorneyMatterNumbers: ["12345.00053"],
 *   clientNumber: "12345",
 *   dockets: ["10008US01"],
 *   familyKeys: ["12345.10008"]
 * })
 * console.log(evidence.familyKeys) // ["12345.10008"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgPathEvidence extends S.Class<PracticeKgPathEvidence>($I`PracticeKgPathEvidence`)(
  {
    attorneyMatterNumbers: S.Array(S.String).annotateKey({
      description: "Dotted client.matter-number folder suffixes; the attorney's own sequence, never a family key.",
    }),
    clientNumber: S.NullOr(S.String),
    dockets: S.Array(S.String),
    familyKeys: S.Array(S.String),
  },
  $I.annote("PracticeKgPathEvidence", {
    description: "Client number, dockets, matter keys, and attorney matter numbers read from a file path.",
  })
) {}

const distinctSorted: (values: ReadonlyArray<string>) => ReadonlyArray<string> = flow(
  A.map(Str.toUpperCase),
  A.dedupe,
  A.sort(Order.String)
);

const familyOfDocket = (docket: string): O.Option<string> =>
  pipe(
    O.fromNullishOr(familyOfDocketPattern.exec(docket)),
    O.map((match) => match[0])
  );

const clientOfFolder = (folder: string): O.Option<string> =>
  pipe(
    O.fromNullishOr(clientFolderPattern.exec(Str.trim(folder))),
    O.flatMap((match) => O.fromNullishOr(match[1]))
  );

const bareDocketsOf = (text: string): ReadonlyArray<string> =>
  A.map(matchesOf(docketReferencePattern, text), Str.replace(clientPrefixPattern, ""));

const keyedFamilyKeys = (path: string): ReadonlyArray<string> =>
  A.getSomes(
    A.map(A.fromIterable(path.matchAll(keyedDocketPattern)), (match) =>
      pipe(
        O.fromNullishOr(match[2]),
        O.flatMap(familyOfDocket),
        O.map((family) => `${match[1]}.${family}`)
      )
    )
  );

const clientFamilyKeys = (client: O.Option<string>, dockets: ReadonlyArray<string>): ReadonlyArray<string> =>
  O.match(client, {
    onNone: A.empty<string>,
    onSome: (number) =>
      A.getSomes(
        A.map(
          dockets,
          flow(
            familyOfDocket,
            O.map((family) => `${number}.${family}`)
          )
        )
      ),
  });

/**
 * Read matter evidence from a file path in the attorney's working folders.
 *
 * **Details**
 *
 * Accepts `/` or `\\` separators. A client-keyed docket anywhere in the path
 * decides the matter key by itself; only when the path has none is the client
 * folder's number joined to the bare dockets. The file name is ignored when a
 * folder already names a docket, because file names often cite other matters.
 *
 * **Example** (Read a matter folder path)
 *
 * ```ts
 * import { extractPracticeKgPathEvidence } from "@beep/law-practice-use-cases/server"
 *
 * const evidence = extractPracticeKgPathEvidence("Clients/Acme Corp 12345/10008US01 - 12345.00053/Filing.pdf")
 * console.log(evidence.familyKeys) // ["12345.10008"]
 * console.log(evidence.attorneyMatterNumbers) // ["12345.00053"]
 * ```
 *
 * @param path - Relative path of one file.
 * @returns Client number, dockets, matter keys, and attorney matter numbers.
 * @category parsers
 * @since 0.0.0
 */
export const extractPracticeKgPathEvidence = (path: string): PracticeKgPathEvidence => {
  const segments = Str.split(path, pathSeparatorPattern);
  const folders = A.join(A.dropRight(segments, 1), "/");
  const folderDockets = bareDocketsOf(folders);
  const dockets = A.isReadonlyArrayNonEmpty(folderDockets) ? folderDockets : bareDocketsOf(path);
  const client = A.findFirst(A.dropRight(segments, 1), clientOfFolder);
  const keyed = keyedFamilyKeys(path);
  return PracticeKgPathEvidence.make({
    attorneyMatterNumbers: distinctSorted(matchesOf(attorneyMatterNumberPattern, path)),
    clientNumber: O.getOrNull(client),
    dockets: distinctSorted(dockets),
    familyKeys: distinctSorted(A.isReadonlyArrayNonEmpty(keyed) ? keyed : clientFamilyKeys(client, dockets)),
  });
};
