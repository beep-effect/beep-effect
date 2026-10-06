/**
 * Stable correspondent-lookup contract over a practice knowledge-graph bundle:
 * which matters an email address writes about, and which the attorney links it to.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { HashSet, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PracticeKgMatterResolution } from "./PracticeKg.matter-lookup.ts";

const $I = $LawPracticeUseCasesId.create("PracticeKg.correspondent-lookup");

/**
 * Where a contact's link to a client or matter came from.
 *
 * **Details**
 *
 * The first four are the attorney's own evidence: his answer, his PC folder,
 * his docket sheet, and email he filed under the matter. `org-name-match`
 * (the contact's organization matches a client name) and `email-subject-ref`
 * (the contact corresponds on mail whose subject carries a full
 * `<client>.<docket>` reference) are inferred. See
 * {@link PracticeKgAttorneyLinkSource} and {@link PracticeKgInferredLinkSource}.
 *
 * **Example** (Decode a link source)
 *
 * ```ts
 * import { PracticeKgContactLinkSource } from "@beep/law-practice-use-cases/server"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(PracticeKgContactLinkSource)("attorney-answer")) // "attorney-answer"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PracticeKgContactLinkSource = LiteralKit([
  "attorney-answer",
  "attorney-pc-folder",
  "attorney-docket-sheet",
  "attorney-filed-email",
  "org-name-match",
  "email-subject-ref",
]).pipe(
  $I.annoteSchema("PracticeKgContactLinkSource", {
    description: "Origin of a contact's link to a client or matter.",
  })
);

/**
 * Runtime type for {@link PracticeKgContactLinkSource}.
 *
 * **Example** (Type a link source)
 *
 * ```ts
 * import type { PracticeKgContactLinkSource } from "@beep/law-practice-use-cases/server"
 *
 * const source: PracticeKgContactLinkSource = "org-name-match"
 * console.log(source) // "org-name-match"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PracticeKgContactLinkSource = typeof PracticeKgContactLinkSource.Type;

/**
 * Link sources that are the attorney's own evidence; only these can make a
 * correspondent lookup `unique`.
 *
 * **Example** (Check an attorney source)
 *
 * ```ts
 * import { PracticeKgAttorneyLinkSource } from "@beep/law-practice-use-cases/server"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PracticeKgAttorneyLinkSource)("attorney-pc-folder")) // true
 * console.log(S.is(PracticeKgAttorneyLinkSource)("email-subject-ref")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PracticeKgAttorneyLinkSource = LiteralKit(
  PracticeKgContactLinkSource.pick([
    "attorney-answer",
    "attorney-pc-folder",
    "attorney-docket-sheet",
    "attorney-filed-email",
  ]).literals
).pipe(
  $I.annoteSchema("PracticeKgAttorneyLinkSource", {
    description: "Contact link sources that are the attorney's own evidence.",
  })
);

/**
 * Link sources inferred by the contacts producer; they rank a candidate like
 * message counts do and never make a lookup `unique`.
 *
 * **Example** (Check an inferred source)
 *
 * ```ts
 * import { PracticeKgInferredLinkSource } from "@beep/law-practice-use-cases/server"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PracticeKgInferredLinkSource)("org-name-match")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PracticeKgInferredLinkSource = LiteralKit(
  PracticeKgContactLinkSource.pick(["org-name-match", "email-subject-ref"]).literals
).pipe(
  $I.annoteSchema("PracticeKgInferredLinkSource", {
    description: "Contact link sources inferred from organization names or mail subjects.",
  })
);

const isAttorneyLinkSource = S.is(PracticeKgAttorneyLinkSource);

/**
 * Resolution shown on one row of a correspondent lookup.
 *
 * **Details**
 *
 * Only the row a `unique` lookup decided carries `unique`. Every other row of
 * that lookup carries `candidate`, so a row read on its own, or kept when a
 * budget truncates the rest, can never look actionable. Rows of an
 * `ambiguous` or `none` lookup carry that resolution.
 *
 * **Example** (Decode a row resolution)
 *
 * ```ts
 * import { PracticeKgCorrespondentRowResolution } from "@beep/law-practice-use-cases/server"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(PracticeKgCorrespondentRowResolution)("candidate")) // "candidate"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PracticeKgCorrespondentRowResolution = LiteralKit([
  ...PracticeKgMatterResolution.literals,
  "candidate",
]).pipe(
  $I.annoteSchema("PracticeKgCorrespondentRowResolution", {
    description: "Per-row resolution of a correspondent lookup; only the decided row is unique.",
  })
);

/**
 * Runtime type for {@link PracticeKgCorrespondentRowResolution}.
 *
 * **Example** (Type a row resolution)
 *
 * ```ts
 * import type { PracticeKgCorrespondentRowResolution } from "@beep/law-practice-use-cases/server"
 *
 * const resolution: PracticeKgCorrespondentRowResolution = "candidate"
 * console.log(resolution) // "candidate"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PracticeKgCorrespondentRowResolution = typeof PracticeKgCorrespondentRowResolution.Type;

/**
 * The lookup input is not exactly one email address.
 *
 * **Details**
 *
 * The input may be a bare address or one header entry such as
 * `Pat Example <pat@example.com>`. `addressCount` is how many addresses the
 * input held: zero, or more than one. The input itself is not echoed.
 *
 * **Example** (Make an address error)
 *
 * ```ts
 * import { PracticeKgCorrespondentAddressError } from "@beep/law-practice-use-cases/server"
 *
 * const error = PracticeKgCorrespondentAddressError.make({
 *   addressCount: 2,
 *   message: "Expected one email address; the input holds 2."
 * })
 * console.log(error._tag) // "PracticeKgCorrespondentAddressError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PracticeKgCorrespondentAddressError extends S.TaggedError<PracticeKgCorrespondentAddressError>(
  $I`PracticeKgCorrespondentAddressError`
)(
  "PracticeKgCorrespondentAddressError",
  {
    addressCount: S.Finite,
    message: S.NonEmptyString,
  },
  $I.annoteError<PracticeKgCorrespondentAddressError>("PracticeKgCorrespondentAddressError", {
    description: "Correspondent lookup input that holds no email address or more than one.",
  })
) {}

/**
 * One email address to look up.
 *
 * **Example** (Make a correspondent request)
 *
 * ```ts
 * import { PracticeKgCorrespondentLookupRequest } from "@beep/law-practice-use-cases/server"
 *
 * const request = PracticeKgCorrespondentLookupRequest.make({ address: "Pat@Example.com" })
 * console.log(request.address) // "Pat@Example.com"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgCorrespondentLookupRequest extends S.Class<PracticeKgCorrespondentLookupRequest>(
  $I`PracticeKgCorrespondentLookupRequest`
)(
  {
    address: S.NonEmptyString.annotateKey({
      description:
        "One email address, bare or as one header entry (Pat Example <pat@example.com>); case and whitespace do not matter.",
    }),
  },
  $I.annote("PracticeKgCorrespondentLookupRequest", {
    description: "Single email address to resolve to the practice matters it corresponds about.",
  })
) {}

/**
 * One contact the address belongs to, from the contacts table.
 *
 * **Example** (Make a correspondent contact)
 *
 * ```ts
 * import { PracticeKgCorrespondentContact } from "@beep/law-practice-use-cases/server"
 *
 * const contact = PracticeKgCorrespondentContact.make({
 *   contactId: "c_0123456789ab",
 *   displayName: "Pat Example",
 *   organization: "Example Client",
 *   roleAddress: false
 * })
 * console.log(contact.contactId) // "c_0123456789ab"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgCorrespondentContact extends S.Class<PracticeKgCorrespondentContact>(
  $I`PracticeKgCorrespondentContact`
)(
  {
    contactId: S.NonEmptyString,
    displayName: S.String,
    organization: S.NullOr(S.String),
    roleAddress: S.Boolean.annotateKey({
      description: "True for a shared role mailbox such as docketing@ or info@; never resolves uniquely.",
    }),
  },
  $I.annote("PracticeKgCorrespondentContact", {
    description: "Contact that owns an email address, with its role-mailbox flag.",
  })
) {}

/**
 * One link from a contact to a client or matter.
 *
 * **Example** (Make a contact link)
 *
 * ```ts
 * import { PracticeKgCorrespondentLink } from "@beep/law-practice-use-cases/server"
 *
 * const link = PracticeKgCorrespondentLink.make({
 *   clientNumber: "12345",
 *   contactId: "c_0123456789ab",
 *   evidence: "folder Example Client 12345",
 *   familyKey: "12345.10008",
 *   source: "attorney-pc-folder"
 * })
 * console.log(link.source) // "attorney-pc-folder"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgCorrespondentLink extends S.Class<PracticeKgCorrespondentLink>($I`PracticeKgCorrespondentLink`)(
  {
    clientNumber: S.NonEmptyString,
    contactId: S.NonEmptyString,
    evidence: S.String.annotateKey({ description: "Short opaque note from the contacts producer." }),
    familyKey: S.NullOr(S.String),
    source: PracticeKgContactLinkSource,
  },
  $I.annote("PracticeKgCorrespondentLink", {
    description: "Contact link to a client number and, when known, one client-keyed matter.",
  })
) {}

/**
 * One matter the address appears on in filed email, with message counts.
 *
 * **Example** (Make a candidate matter)
 *
 * ```ts
 * import { PracticeKgCorrespondentCandidate } from "@beep/law-practice-use-cases/server"
 *
 * const candidate = PracticeKgCorrespondentCandidate.make({
 *   ccCount: 0,
 *   client: "12345",
 *   clientName: "Example Client",
 *   familyKey: "12345.10008",
 *   firstAt: "2026-01-02T03:04:05Z",
 *   fromCount: 2,
 *   lastAt: "2026-02-03T04:05:06Z",
 *   messageCount: 3,
 *   toCount: 1
 * })
 * console.log(candidate.messageCount) // 3
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgCorrespondentCandidate extends S.Class<PracticeKgCorrespondentCandidate>(
  $I`PracticeKgCorrespondentCandidate`
)(
  {
    ccCount: S.Finite,
    client: S.NullOr(S.String),
    clientName: S.NullOr(S.String),
    familyKey: S.NonEmptyString,
    firstAt: S.NullOr(S.String),
    fromCount: S.Finite,
    lastAt: S.NullOr(S.String),
    messageCount: S.Finite,
    toCount: S.Finite,
  },
  $I.annote("PracticeKgCorrespondentCandidate", {
    description: "Matter an address appears on in filed email, counted by message and header role.",
  })
) {}

/**
 * Evidence the resolution of a correspondent lookup is decided from.
 *
 * **Example** (Make empty evidence)
 *
 * ```ts
 * import { PracticeKgCorrespondentEvidence } from "@beep/law-practice-use-cases/server"
 *
 * const evidence = PracticeKgCorrespondentEvidence.make({
 *   candidates: [],
 *   contacts: [],
 *   links: [],
 *   matterFamilyKeys: [],
 *   practiceAddress: false
 * })
 * console.log(evidence.links.length) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgCorrespondentEvidence extends S.Class<PracticeKgCorrespondentEvidence>(
  $I`PracticeKgCorrespondentEvidence`
)(
  {
    candidates: S.Array(PracticeKgCorrespondentCandidate),
    contacts: S.Array(PracticeKgCorrespondentContact),
    links: S.Array(PracticeKgCorrespondentLink),
    matterFamilyKeys: S.Array(S.String).annotateKey({
      description: "Family keys named by the contact's links that are matters in this bundle.",
    }),
    practiceAddress: S.Boolean.annotateKey({
      description: "True when the address is on one of the practice's own domains.",
    }),
  },
  $I.annote("PracticeKgCorrespondentEvidence", {
    description: "Contacts, links, and message-count candidates found for one address.",
  })
) {}

/**
 * How a correspondent lookup resolved, and the matter when it is unique.
 *
 * **Example** (Make a decision)
 *
 * ```ts
 * import { PracticeKgCorrespondentDecision } from "@beep/law-practice-use-cases/server"
 *
 * const decision = PracticeKgCorrespondentDecision.make({ familyKey: null, resolution: "none" })
 * console.log(decision.resolution) // "none"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgCorrespondentDecision extends S.Class<PracticeKgCorrespondentDecision>(
  $I`PracticeKgCorrespondentDecision`
)(
  {
    familyKey: S.NullOr(S.String),
    resolution: PracticeKgMatterResolution,
  },
  $I.annote("PracticeKgCorrespondentDecision", {
    description: "Resolution of a correspondent lookup and its matter key when unique.",
  })
) {}

/**
 * Result of looking up one email address.
 *
 * **Example** (Make an empty result)
 *
 * ```ts
 * import { PracticeKgCorrespondentLookupResult } from "@beep/law-practice-use-cases/server"
 *
 * const result = PracticeKgCorrespondentLookupResult.make({
 *   address: "pat@example.com",
 *   bundleVersion: "2026-10-07-01",
 *   candidates: [],
 *   contacts: [],
 *   familyKey: null,
 *   links: [],
 *   matterFamilyKeys: [],
 *   practiceAddress: false,
 *   resolution: "none"
 * })
 * console.log(result.resolution) // "none"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgCorrespondentLookupResult extends S.Class<PracticeKgCorrespondentLookupResult>(
  $I`PracticeKgCorrespondentLookupResult`
)(
  {
    ...PracticeKgCorrespondentEvidence.fields,
    ...PracticeKgCorrespondentDecision.fields,
    address: S.NonEmptyString,
    bundleVersion: S.NonEmptyString,
  },
  $I.annote("PracticeKgCorrespondentLookupResult", {
    description: "Matters an email address corresponds about, the attorney's links for it, and the resolution.",
  })
) {}

const isSoleContact = (evidence: PracticeKgCorrespondentEvidence): boolean =>
  pipe(
    A.head(evidence.contacts),
    O.exists((contact) => A.length(evidence.contacts) === 1 && !contact.roleAddress)
  );

// The link's family key must be keyed to the link's own client and name a
// matter the bundle holds: the attorney's `<client>.<0NNNN>` matter numbers
// share the dotted shape (D-20) and are never matters.
const linkedMatterKey =
  (matterFamilyKeys: ReadonlyArray<string>) =>
  (link: PracticeKgCorrespondentLink): O.Option<string> =>
    pipe(
      O.fromNullishOr(link.familyKey),
      O.filter(Str.startsWith(`${link.clientNumber}.`)),
      O.filter((familyKey) => A.contains(matterFamilyKeys, familyKey))
    );

const attorneyFamilyKey = (evidence: PracticeKgCorrespondentEvidence): O.Option<string> => {
  const attorneyLinks = A.filter(evidence.links, (link) => isAttorneyLinkSource(link.source));
  const targets = HashSet.fromIterable(
    A.map(attorneyLinks, (link) => `${link.clientNumber}\u0000${link.familyKey ?? ""}`)
  );
  return pipe(
    A.head(attorneyLinks),
    O.filter(() => HashSet.size(targets) === 1),
    O.flatMap(linkedMatterKey(evidence.matterFamilyKeys))
  );
};

/**
 * Decide how a correspondent lookup resolves from the evidence found.
 *
 * **Details**
 *
 * `unique` needs the attorney's own word: the address belongs to exactly one
 * contact, that contact is not a role mailbox, the address is not the
 * practice's own, and every attorney-sourced link of the contact names the
 * same client-keyed matter: a family key that starts with the link's own
 * client number and is one of the bundle's matters (`matterFamilyKeys`). Message counts and inferred links
 * (`org-name-match`, `email-subject-ref`) never make a lookup `unique`;
 * they make it `ambiguous`, with the candidates to show a person. With no
 * candidate and no link the lookup is `none`.
 *
 * **Example** (Resolve from an attorney link)
 *
 * ```ts
 * import {
 *   PracticeKgCorrespondentContact,
 *   PracticeKgCorrespondentEvidence,
 *   PracticeKgCorrespondentLink,
 *   resolvePracticeKgCorrespondent
 * } from "@beep/law-practice-use-cases/server"
 *
 * const decision = resolvePracticeKgCorrespondent(
 *   PracticeKgCorrespondentEvidence.make({
 *     candidates: [],
 *     contacts: [
 *       PracticeKgCorrespondentContact.make({
 *         contactId: "c_0123456789ab",
 *         displayName: "Pat Example",
 *         organization: null,
 *         roleAddress: false
 *       })
 *     ],
 *     links: [
 *       PracticeKgCorrespondentLink.make({
 *         clientNumber: "12345",
 *         contactId: "c_0123456789ab",
 *         evidence: "answered",
 *         familyKey: "12345.10008",
 *         source: "attorney-answer"
 *       })
 *     ],
 *     matterFamilyKeys: ["12345.10008"],
 *     practiceAddress: false
 *   })
 * )
 * console.log(decision.resolution, decision.familyKey) // "unique" "12345.10008"
 * ```
 *
 * @param evidence - Contacts, links, and candidates found for one address.
 * @returns The resolution and, when unique, the matter key.
 * @category use-cases
 * @since 0.0.0
 */
export const resolvePracticeKgCorrespondent = (
  evidence: PracticeKgCorrespondentEvidence
): PracticeKgCorrespondentDecision =>
  pipe(
    O.liftPredicate(evidence, (candidate) => !candidate.practiceAddress && isSoleContact(candidate)),
    O.flatMap(attorneyFamilyKey),
    O.match({
      onNone: () =>
        PracticeKgCorrespondentDecision.make({
          familyKey: null,
          resolution:
            A.isReadonlyArrayNonEmpty(evidence.candidates) || A.isReadonlyArrayNonEmpty(evidence.links)
              ? "ambiguous"
              : "none",
        }),
      onSome: (familyKey) => PracticeKgCorrespondentDecision.make({ familyKey, resolution: "unique" }),
    })
  );
