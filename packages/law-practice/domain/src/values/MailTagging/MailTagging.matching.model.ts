/**
 * Mail-tagging matching model: the matter index, the message envelope the
 * tagger reads, evidence scoring, and the tagging decision.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { EmailString } from "@beep/schema/Email";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { UsptoNormalizedApplicationNumber } from "../CitingApplicationIdentity/index.ts";
import { PatentNumber } from "../PatentNumber/index.ts";
import { InternetMessageId, MailConversationId, MailMessageId, MatterDocketNumber } from "./MailTagging.ids.model.ts";
import {
  MailDomain,
  MatterClientKey,
  MatterKey,
  matterCategoryName,
  PracticeCategory,
} from "./MailTagging.taxonomy.model.ts";
import type { MailCategoryName } from "./MailTagging.taxonomy.model.ts";

const $I = $LawPracticeDomainId.create("values/MailTagging/MailTagging.matching.model");

/**
 * The identifiers and contacts that tie mail to one matter.
 *
 * **Details**
 *
 * Application numbers use the eight-digit USPTO form and patent numbers the
 * digits-only form, matching how the practice KG keys its application and
 * patent nodes. Every list defaults to empty.
 *
 * **Example** (Decode a sparse index entry)
 *
 * ```ts
 * import { MatterIndexEntry } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * const entry = S.decodeUnknownSync(MatterIndexEntry)({
 *   matterKey: "acme.10001",
 *   clientKey: "acme",
 *   applicationNumbers: ["16000001"]
 * })
 * console.log(entry.applicationNumbers.length) // 1
 * console.log(entry.contactDomains.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MatterIndexEntry extends S.Class<MatterIndexEntry>($I`MatterIndexEntry`)(
  {
    matterKey: MatterKey.annotateKey({
      description: "Matter the entry describes.",
    }),
    clientKey: MatterClientKey.annotateKey({
      description: "Client that owns the matter.",
    }),
    docketNumbers: S.Array(MatterDocketNumber)
      .pipe(S.withDecodingDefaultKey(Effect.succeed([])), S.withConstructorDefault(Effect.succeed([])))
      .annotateKey({
        description: "Docket numbers of the matter's filings.",
      }),
    applicationNumbers: S.Array(UsptoNormalizedApplicationNumber)
      .pipe(S.withDecodingDefaultKey(Effect.succeed([])), S.withConstructorDefault(Effect.succeed([])))
      .annotateKey({
        description: "Eight-digit USPTO application numbers in the matter.",
      }),
    patentNumbers: S.Array(PatentNumber)
      .pipe(S.withDecodingDefaultKey(Effect.succeed([])), S.withConstructorDefault(Effect.succeed([])))
      .annotateKey({
        description: "Digits-only patent numbers granted in the matter.",
      }),
    contactAddresses: S.Array(EmailString)
      .pipe(S.withDecodingDefaultKey(Effect.succeed([])), S.withConstructorDefault(Effect.succeed([])))
      .annotateKey({
        description: "Normalized email addresses of the matter's contacts.",
      }),
    contactDomains: S.Array(MailDomain)
      .pipe(S.withDecodingDefaultKey(Effect.succeed([])), S.withConstructorDefault(Effect.succeed([])))
      .annotateKey({
        description: "Sender domains associated with the matter's client.",
      }),
  },
  $I.annote("MatterIndexEntry", {
    description: "Identifiers and contacts that tie mail to one matter.",
  })
) {}

/**
 * Identifiers of a matter that cannot be a tag target.
 *
 * **Details**
 *
 * A matter without a client number, or one whose family number was recycled
 * and never verified, has no safe `MatterKey`. Mail that names one of its
 * identifiers is never tagged to a matter; it is left for the attorney.
 *
 * **Example** (Describe an unattributed matter)
 *
 * ```ts
 * import { UnattributedMatter } from "@beep/law-practice-domain/values"
 * import { UsptoNormalizedApplicationNumber } from "@beep/law-practice-domain"
 *
 * const matter = UnattributedMatter.make({
 *   applicationNumbers: [UsptoNormalizedApplicationNumber.make("15000001")]
 * })
 * console.log(matter.docketNumbers.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnattributedMatter extends S.Class<UnattributedMatter>($I`UnattributedMatter`)(
  {
    docketNumbers: S.Array(MatterDocketNumber)
      .pipe(S.withDecodingDefaultKey(Effect.succeed([])), S.withConstructorDefault(Effect.succeed([])))
      .annotateKey({
        description: "Docket numbers of the matter's filings.",
      }),
    applicationNumbers: S.Array(UsptoNormalizedApplicationNumber)
      .pipe(S.withDecodingDefaultKey(Effect.succeed([])), S.withConstructorDefault(Effect.succeed([])))
      .annotateKey({
        description: "Eight-digit USPTO application numbers in the matter.",
      }),
    patentNumbers: S.Array(PatentNumber)
      .pipe(S.withDecodingDefaultKey(Effect.succeed([])), S.withConstructorDefault(Effect.succeed([])))
      .annotateKey({
        description: "Digits-only patent numbers granted in the matter.",
      }),
  },
  $I.annote("UnattributedMatter", {
    description: "Identifiers of a matter that cannot be a tag target.",
  })
) {}

/**
 * Snapshot of every taggable matter, as read from the practice KG.
 *
 * **Example** (Decode an index snapshot)
 *
 * ```ts
 * import { MatterIndex } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * const index = S.decodeUnknownSync(MatterIndex)({
 *   entries: [{ matterKey: "acme.10001", clientKey: "acme" }],
 *   builtAt: "2026-07-01T00:00:00.000Z"
 * })
 * console.log(index.entries.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MatterIndex extends S.Class<MatterIndex>($I`MatterIndex`)(
  {
    entries: S.Array(MatterIndexEntry).annotateKey({
      description: "One entry per taggable matter.",
    }),
    unattributed: S.Array(UnattributedMatter)
      .pipe(S.withDecodingDefaultKey(Effect.succeed([])), S.withConstructorDefault(Effect.succeed([])))
      .annotateKey({
        description: "Identifier sets of matters that cannot be tagged; a hit needs the attorney.",
      }),
    builtAt: S.DateTimeUtcFromString.annotateKey({
      description: "UTC instant the snapshot was read.",
    }),
  },
  $I.annote("MatterIndex", {
    description: "Snapshot of every taggable matter.",
  })
) {}

/**
 * The subset of a mailbox message the tagger reads.
 *
 * **Gotchas**
 *
 * `categories` holds plain strings on purpose: categories owned by other
 * workstreams or by the attorney must round-trip untouched and in order.
 * Message bodies are never part of the envelope.
 *
 * **Example** (Decode an envelope with a foreign category)
 *
 * ```ts
 * import { MailEnvelope } from "@beep/law-practice-domain/values"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const envelope = S.decodeUnknownSync(MailEnvelope)({
 *   messageId: "msg-0001",
 *   subject: "Application 16/000,001",
 *   senderAddress: "Paralegal@Example.Test",
 *   receivedAt: "2026-07-01T12:00:00.000Z",
 *   categories: ["Docket - unverified"],
 *   hasAttachments: false
 * })
 * console.log(O.getOrNull(envelope.senderAddress)) // "paralegal@example.test"
 * console.log(envelope.categories) // ["Docket - unverified"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MailEnvelope extends S.Class<MailEnvelope>($I`MailEnvelope`)(
  {
    messageId: MailMessageId.annotateKey({
      description: "Provider message id.",
    }),
    internetMessageId: S.OptionFromNullOr(InternetMessageId)
      .pipe(S.withDecodingDefaultKey(Effect.succeed(null)), S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "RFC 5322 Message-ID, when the provider reports one.",
      }),
    conversationId: S.OptionFromNullOr(MailConversationId)
      .pipe(S.withDecodingDefaultKey(Effect.succeed(null)), S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Conversation id, when the provider reports one.",
      }),
    subject: S.String.annotateKey({
      description: "Subject line; may be empty.",
    }),
    senderAddress: S.OptionFromNullOr(EmailString)
      .pipe(S.withDecodingDefaultKey(Effect.succeed(null)), S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Normalized sender address, when the message has a usable one.",
      }),
    recipientAddresses: S.Array(EmailString)
      .pipe(S.withDecodingDefaultKey(Effect.succeed([])), S.withConstructorDefault(Effect.succeed([])))
      .annotateKey({
        description: "Normalized recipient addresses.",
      }),
    receivedAt: S.DateTimeUtcFromString.annotateKey({
      description: "UTC instant the message was received.",
    }),
    categories: S.Array(S.String)
      .pipe(S.withDecodingDefaultKey(Effect.succeed([])), S.withConstructorDefault(Effect.succeed([])))
      .annotateKey({
        description: "Current Outlook categories in mailbox order, including foreign ones.",
      }),
    hasAttachments: S.Boolean.annotateKey({
      description: "Whether the message carries attachments.",
    }),
    changeKey: S.OptionFromNullOr(S.String)
      .pipe(S.withDecodingDefaultKey(Effect.succeed(null)), S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Provider version token of the message, when reported; guards category writes.",
      }),
    bodyPreview: S.OptionFromNullOr(S.String)
      .pipe(S.withDecodingDefaultKey(Effect.succeed(null)), S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({
        description: "Short provider body preview; never persisted.",
      }),
  },
  $I.annote("MailEnvelope", {
    description: "The subset of a mailbox message the tagger reads.",
  })
) {}

/**
 * Kinds of evidence that tie a message to a matter.
 *
 * **Example** (Guard an evidence kind)
 *
 * ```ts
 * import { MatterEvidenceKind } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MatterEvidenceKind)("patent-number")) // true
 * console.log(S.is(MatterEvidenceKind)("subject-keyword")) // false
 * ```
 *
 * @see {@link matterEvidenceWeight} for the weight of each kind.
 * @category schemas
 * @since 0.0.0
 */
export const MatterEvidenceKind = LiteralKit([
  "application-number",
  "patent-number",
  "docket-number",
  "conversation-carryover",
  "contact-address",
  "contact-domain",
]).pipe(
  $I.annoteSchema("MatterEvidenceKind", {
    description: "Kinds of evidence that tie a message to a matter.",
  })
);

/**
 * Runtime type for {@link MatterEvidenceKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type MatterEvidenceKind = typeof MatterEvidenceKind.Type;

const identifierWeight = UnitInterval.make(0.95);
const docketWeight = UnitInterval.make(0.9);
const carryoverWeight = UnitInterval.make(0.85);
const contactAddressWeight = UnitInterval.make(0.6);
const contactDomainWeight = UnitInterval.make(0.35);

/**
 * Fixed weight of each evidence kind.
 *
 * **Example** (Read evidence weights)
 *
 * ```ts
 * import { matterEvidenceWeight } from "@beep/law-practice-domain/values"
 *
 * console.log(matterEvidenceWeight("application-number")) // 0.95
 * console.log(matterEvidenceWeight("contact-domain")) // 0.35
 * ```
 *
 * @param kind - Evidence kind to weigh.
 * @returns The weight in the closed unit interval.
 * @category getters
 * @since 0.0.0
 */
export const matterEvidenceWeight: (kind: MatterEvidenceKind) => UnitInterval = MatterEvidenceKind.$match({
  "application-number": () => identifierWeight,
  "patent-number": () => identifierWeight,
  "docket-number": () => docketWeight,
  "conversation-carryover": () => carryoverWeight,
  "contact-address": () => contactAddressWeight,
  "contact-domain": () => contactDomainWeight,
});

/**
 * The normalized identifier or address that produced one piece of evidence.
 *
 * **Example** (Guard an evidence token)
 *
 * ```ts
 * import { MatterEvidenceToken } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MatterEvidenceToken)("16000001")) // true
 * console.log(S.is(MatterEvidenceToken)("please see attached")) // false
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const MatterEvidenceToken = S.String.check(
  S.isMaxLength(320, {
    identifier: $I`MatterEvidenceTokenLengthCheck`,
    title: "Matter Evidence Token Length",
    description: "An identifier or address of at most 320 characters.",
    message: "Evidence token must not exceed 320 characters.",
  }),
  S.isPattern(/^\S+$/u, {
    identifier: $I`MatterEvidenceTokenPatternCheck`,
    title: "Matter Evidence Token",
    description: "A non-empty identifier or address without whitespace.",
    message: "Evidence token must be a non-empty token without whitespace.",
  })
).pipe(
  S.brand("MatterEvidenceToken"),
  $I.annoteSchema("MatterEvidenceToken", {
    description: "Normalized identifier or address that produced one piece of evidence; never free text.",
  })
);

/**
 * Type-level brand produced by {@link MatterEvidenceToken}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MatterEvidenceToken = typeof MatterEvidenceToken.Type;

/**
 * One piece of evidence tying a message to a matter.
 *
 * **Example** (Record identifier evidence)
 *
 * ```ts
 * import { MatterEvidence, MatterEvidenceToken } from "@beep/law-practice-domain/values"
 *
 * const evidence = MatterEvidence.make({
 *   kind: "application-number",
 *   matched: MatterEvidenceToken.make("16000001")
 * })
 * console.log(evidence.kind) // "application-number"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MatterEvidence extends S.Class<MatterEvidence>($I`MatterEvidence`)(
  {
    kind: MatterEvidenceKind.annotateKey({
      description: "Kind of evidence.",
    }),
    matched: MatterEvidenceToken.annotateKey({
      description: "Normalized identifier or address that hit.",
    }),
  },
  $I.annote("MatterEvidence", {
    description: "One piece of evidence tying a message to a matter.",
  })
) {}

/**
 * Combines evidence into a confidence: `1 - Π(1 - weight)` over the distinct
 * evidence kinds.
 *
 * **Details**
 *
 * Repeating a kind adds nothing: two application numbers weigh the same as
 * one. No evidence yields `0`.
 *
 * **Example** (Combine two evidence kinds)
 *
 * ```ts
 * import { MatterEvidence, MatterEvidenceToken, matterEvidenceConfidence } from "@beep/law-practice-domain/values"
 *
 * const address = MatterEvidence.make({
 *   kind: "contact-address",
 *   matched: MatterEvidenceToken.make("paralegal@example.test")
 * })
 * const domain = MatterEvidence.make({ kind: "contact-domain", matched: MatterEvidenceToken.make("example.test") })
 * console.log(matterEvidenceConfidence([address, domain]).toFixed(2)) // "0.74"
 * ```
 *
 * @param evidence - Evidence collected for one matter.
 * @returns The combined confidence in the closed unit interval.
 * @category folding
 * @since 0.0.0
 */
export const matterEvidenceConfidence = (evidence: ReadonlyArray<MatterEvidence>): UnitInterval =>
  pipe(
    A.dedupe(A.map(evidence, (item) => item.kind)),
    A.reduce(1, (miss, kind) => miss * (1 - matterEvidenceWeight(kind))),
    (miss) => UnitInterval.make(1 - miss)
  );

/**
 * A matter the evidence points at, with its combined confidence.
 *
 * **Example** (Describe a candidate)
 *
 * ```ts
 * import { MatterCandidate, MatterEvidence, MatterEvidenceToken, MatterKey } from "@beep/law-practice-domain/values"
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 *
 * const candidate = MatterCandidate.make({
 *   matterKey: MatterKey.make("acme.10001"),
 *   confidence: UnitInterval.make(0.35),
 *   evidence: [MatterEvidence.make({ kind: "contact-domain", matched: MatterEvidenceToken.make("example.test") })]
 * })
 * console.log(candidate.confidence) // 0.35
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MatterCandidate extends S.Class<MatterCandidate>($I`MatterCandidate`)(
  {
    matterKey: MatterKey.annotateKey({
      description: "Candidate matter.",
    }),
    confidence: UnitInterval.annotateKey({
      description: "Combined confidence of the candidate's evidence.",
    }),
    evidence: S.NonEmptyArray(MatterEvidence).annotateKey({
      description: "Evidence supporting the candidate; at least one item.",
    }),
  },
  $I.annote("MatterCandidate", {
    description: "A matter the evidence points at, with its combined confidence.",
  })
) {}

const defaultMaxAttachmentBytes = 50 * 1024 * 1024;

/**
 * Thresholds that turn candidates into a decision, plus the attachment size cap.
 *
 * **Example** (Decode the default policy)
 *
 * ```ts
 * import { TaggingPolicy } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * const policy = S.decodeUnknownSync(TaggingPolicy)({})
 * console.log(policy.confidenceThreshold) // 0.8
 * console.log(policy.ambiguityMargin) // 0.15
 * console.log(policy.maxAttachmentBytes) // 52428800
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export class TaggingPolicy extends S.Class<TaggingPolicy>($I`TaggingPolicy`)(
  {
    confidenceThreshold: UnitInterval.pipe(
      S.withDecodingDefaultKey(Effect.succeed(0.8)),
      S.withConstructorDefault(Effect.succeed(UnitInterval.make(0.8)))
    ).annotateKey({
      description: "Minimum confidence the best candidate needs to be matched.",
    }),
    ambiguityMargin: UnitInterval.pipe(
      S.withDecodingDefaultKey(Effect.succeed(0.15)),
      S.withConstructorDefault(Effect.succeed(UnitInterval.make(0.15)))
    ).annotateKey({
      description: "Minimum lead the best candidate needs over the runner-up.",
    }),
    maxAttachmentBytes: S.Natural.pipe(
      S.withDecodingDefaultKey(Effect.succeed(defaultMaxAttachmentBytes)),
      S.withConstructorDefault(Effect.succeed(defaultMaxAttachmentBytes))
    ).annotateKey({
      description: "Largest attachment, in bytes, the filer downloads and files; defaults to 50 MiB.",
    }),
  },
  $I.annote("TaggingPolicy", {
    description: "Thresholds that turn matter candidates into a tagging decision, plus the attachment size cap.",
  })
) {}

/**
 * Why a message was not assigned to a matter.
 *
 * **Example** (Guard an unmatched reason)
 *
 * ```ts
 * import { UnmatchedReason } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(UnmatchedReason)("ambiguous")) // true
 * console.log(S.is(UnmatchedReason)("forced")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UnmatchedReason = LiteralKit(["no-signal", "below-threshold", "ambiguous", "needs-attorney"]).pipe(
  $I.annoteSchema("UnmatchedReason", {
    description: "Why a message was not assigned to a matter.",
  })
);

/**
 * Runtime type for {@link UnmatchedReason}.
 *
 * @category models
 * @since 0.0.0
 */
export type UnmatchedReason = typeof UnmatchedReason.Type;

/**
 * Decision: the message belongs to one matter.
 *
 * **Example** (Record a matched decision)
 *
 * ```ts
 * import { MatterEvidence, MatterEvidenceToken, MatterKey, MatterMatched } from "@beep/law-practice-domain/values"
 * import { UnitInterval } from "@beep/schema/UnitInterval"
 *
 * const decision = MatterMatched.make({
 *   matterKey: MatterKey.make("acme.10001"),
 *   confidence: UnitInterval.make(0.95),
 *   evidence: [MatterEvidence.make({ kind: "patent-number", matched: MatterEvidenceToken.make("10000001") })]
 * })
 * console.log(decision._tag) // "MatterMatched"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MatterMatched extends S.TaggedClass<MatterMatched>($I`MatterMatched`)(
  "MatterMatched",
  {
    matterKey: MatterKey.annotateKey({
      description: "Matter the message belongs to.",
    }),
    confidence: UnitInterval.annotateKey({
      description: "Combined confidence of the winning candidate.",
    }),
    evidence: S.NonEmptyArray(MatterEvidence).annotateKey({
      description: "Evidence supporting the match; at least one item.",
    }),
    practiceCategories: S.Array(PracticeCategory)
      .pipe(S.withDecodingDefaultKey(Effect.succeed([])), S.withConstructorDefault(Effect.succeed([])))
      .annotateKey({
        description: "Practice categories that ride alongside the match.",
      }),
  },
  $I.annote("MatterMatched", {
    description: "Tagging decision assigning the message to one matter.",
  })
) {}

/**
 * Decision: the message is not assigned to any matter.
 *
 * **Example** (Record an ambiguous decision)
 *
 * ```ts
 * import { MatterUnmatched } from "@beep/law-practice-domain/values"
 *
 * const decision = MatterUnmatched.make({ reason: "no-signal" })
 * console.log(decision.candidates.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MatterUnmatched extends S.TaggedClass<MatterUnmatched>($I`MatterUnmatched`)(
  "MatterUnmatched",
  {
    reason: UnmatchedReason.annotateKey({
      description: "Why no matter was assigned.",
    }),
    candidates: S.Array(MatterCandidate)
      .pipe(S.withDecodingDefaultKey(Effect.succeed([])), S.withConstructorDefault(Effect.succeed([])))
      .annotateKey({
        description: "Candidates considered and rejected, best first.",
      }),
    practiceCategories: S.Array(PracticeCategory)
      .pipe(S.withDecodingDefaultKey(Effect.succeed([])), S.withConstructorDefault(Effect.succeed([])))
      .annotateKey({
        description: "Practice categories that ride alongside the outcome.",
      }),
  },
  $I.annote("MatterUnmatched", {
    description: "Tagging decision leaving the message without a matter.",
  })
) {}

/**
 * The tagger's verdict on one message: matched to a matter, or explicitly
 * unmatched.
 *
 * **Example** (Branch on a tagging decision)
 *
 * ```ts
 * import { MatterUnmatched, TaggingDecision } from "@beep/law-practice-domain/values"
 *
 * const decision = MatterUnmatched.make({ reason: "below-threshold" })
 * const label = TaggingDecision.match(decision, {
 *   MatterMatched: ({ matterKey }) => `matched ${matterKey}`,
 *   MatterUnmatched: ({ reason }) => `unmatched: ${reason}`
 * })
 * console.log(label) // "unmatched: below-threshold"
 * ```
 *
 * @see {@link decisionCategories} for the categories a decision adds.
 * @category schemas
 * @since 0.0.0
 */
export const TaggingDecision = S.Union([MatterMatched, MatterUnmatched]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("TaggingDecision", {
    description: "The tagger's verdict on one message: matched to a matter, or explicitly unmatched.",
  })
);

/**
 * Runtime type for {@link TaggingDecision}.
 *
 * @category models
 * @since 0.0.0
 */
export type TaggingDecision = typeof TaggingDecision.Type;

const reviewCategory = PracticeCategory.Enum["P: Unmatched - review"];

const signalCategories = (categories: ReadonlyArray<PracticeCategory>): ReadonlyArray<MailCategoryName> =>
  A.filter(categories, (category) => category !== reviewCategory);

const nearMissCategories = (categories: ReadonlyArray<PracticeCategory>): ReadonlyArray<MailCategoryName> =>
  A.append(signalCategories(categories), reviewCategory);

const matchedCategories = (decision: MatterMatched): ReadonlyArray<MailCategoryName> =>
  A.prepend(signalCategories(decision.practiceCategories), matterCategoryName(decision.matterKey));

const unmatchedCategories = (decision: MatterUnmatched): ReadonlyArray<MailCategoryName> =>
  UnmatchedReason.$match(decision.reason, {
    "no-signal": () => signalCategories(decision.practiceCategories),
    "below-threshold": () => nearMissCategories(decision.practiceCategories),
    ambiguous: () => nearMissCategories(decision.practiceCategories),
    "needs-attorney": () => nearMissCategories(decision.practiceCategories),
  });

/**
 * Lists the categories a decision adds to its message.
 *
 * **Details**
 *
 * - Matched: the matter category, then the practice categories.
 * - Unmatched with `below-threshold` or `ambiguous`: the practice categories,
 *   then `P: Unmatched - review`.
 * - Unmatched with `no-signal`: the practice categories only, which may be
 *   none at all.
 *
 * The review category is derived from the outcome alone; a copy carried in
 * `practiceCategories` is ignored. The result holds no duplicates.
 *
 * **Example** (List the categories of a near miss)
 *
 * ```ts
 * import { MatterUnmatched, decisionCategories } from "@beep/law-practice-domain/values"
 *
 * const decision = MatterUnmatched.make({ reason: "ambiguous", practiceCategories: ["P: Client"] })
 * console.log(decisionCategories(decision)) // ["P: Client", "P: Unmatched - review"]
 * ```
 *
 * @param decision - Tagging decision for one message.
 * @returns The owned category names to add, in order and without duplicates.
 * @category destructors
 * @since 0.0.0
 */
export const decisionCategories = (decision: TaggingDecision): ReadonlyArray<MailCategoryName> =>
  A.dedupe(
    TaggingDecision.match(decision, {
      MatterMatched: matchedCategories,
      MatterUnmatched: unmatchedCategories,
    })
  );
