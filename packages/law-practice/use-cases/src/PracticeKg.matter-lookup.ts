/**
 * Stable matter-lookup contract over a practice knowledge-graph bundle.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { KgAttributionSource, PracticeKgEpistemicStatus } from "@beep/law-practice-domain/values";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Order, pipe } from "effect";
import * as A from "effect/Array";
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
 * or tagged under it.
 *
 * **Example** (Make a matter)
 *
 * ```ts
 * import { PracticeKgMatter } from "@beep/law-practice-use-cases/server"
 *
 * const matter = PracticeKgMatter.make({
 *   attributionSource: "text-reference",
 *   client: "12345",
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
 *   bundleVersion: "2026-10-06-01",
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

const docketReferencePattern =
  /(?<![0-9.])(?:[0-9]{4,6}\.)?[0-9]{5,6}(?:US|WO|EP|CA|AU|CN|JP|PCT)[0-9]{0,3}(?:-US[0-9]+)?(?![0-9])/giu;
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
 * and bare `<docket><country><seq>` forms, USPTO application numbers written
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
  pipe(
    [
      ...matchesOf(docketReferencePattern, text),
      ...matchesOf(applicationReferencePattern, text),
      ...matchesOf(patentReferencePattern, text),
    ],
    A.map(Str.toUpperCase),
    A.dedupe,
    A.sort(Order.String)
  );
