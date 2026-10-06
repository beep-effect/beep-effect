/**
 * The pure matter tagger: deterministic evidence scoring that turns one
 * message envelope into a tagging decision.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import {
  MailRuleIntent,
  MatterCandidate,
  MatterEvidence,
  MatterEvidenceToken,
  MatterMatched,
  MatterUnmatched,
  matterEvidenceConfidence,
  PracticeCategory,
  UnmatchedReason,
} from "@beep/law-practice-domain/values/MailTagging";
import { LiteralKit } from "@beep/schema";
import { flow, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { extractPracticeKgReferences } from "../PracticeKg.matter-lookup.ts";
import type {
  MailEnvelope,
  MailTaxonomy,
  MatterEvidenceKind,
  MatterIndexEntry,
  MatterKey,
  TaggingDecision,
  TaggingPolicy,
  UnattributedMatter,
} from "@beep/law-practice-domain/values/MailTagging";
import type { MatterTaggerContext } from "./MailTagging.values.ts";

const $I = $LawPracticeUseCasesId.create("MailTagging/MailTagging.tagger");

const FreeMailDomain = LiteralKit([
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]).pipe(
  $I.annoteSchema("FreeMailDomain", {
    description: "Consumer mail domains that say nothing about which client a sender belongs to.",
  })
);

const isFreeMailDomain = S.is(FreeMailDomain);
const decodeEvidenceToken = S.decodeUnknownOption(MatterEvidenceToken);

// `16/123,456`, `16/123456`, and `16123456` all read as the application 16123456.
const applicationNumberPattern = /(?<!\d)(\d{2})\/?(\d{3}),?(\d{3})(?!\d)/gu;
// `US 10,123,456 B2` and `10123456` both read as the patent 10123456. The
// lookbehind keeps the serial half of `16/123,456` from reading as a patent.
const patentNumberPattern = /(?<![\d/])(\d{1,2}),?(\d{3}),?(\d{3})(?!\d)/gu;
const wordSeparatorPattern = /[\s,;:()[\]<>"'!?]+/u;
const trailingDotsPattern = /\.+$/u;
// The digits a docket reference opens with: `<client>.<family>` or a bare `<family>`.
const referenceFamilyPattern = /^(?:\d+\.)?\d+/u;
const nonDigitPattern = /\D/gu;

type SenderSignals = {
  readonly senderAddresses: HashSet.HashSet<string>;
  readonly senderDomains: HashSet.HashSet<string>;
};

type MatterIdentifiers = Pick<UnattributedMatter, "docketNumbers" | "applicationNumbers" | "patentNumbers">;

type MailSignals = SenderSignals & {
  readonly applicationNumbers: HashSet.HashSet<string>;
  readonly patentNumbers: HashSet.HashSet<string>;
  readonly words: HashSet.HashSet<string>;
  readonly referencedFamilies: HashSet.HashSet<string>;
  readonly addresses: HashSet.HashSet<string>;
  readonly conversationId: O.Option<string>;
  readonly carriedMatter: O.Option<MatterKey>;
};

const digitGroups = (match: RegExpMatchArray): string => A.join(A.drop(match, 1), "");

const numbersIn = (pattern: RegExp): ((text: string) => HashSet.HashSet<string>) =>
  flow(Str.matchAll(pattern), A.fromIterable, A.map(digitGroups), HashSet.fromIterable);

const wordsIn: (text: string) => HashSet.HashSet<string> = flow(
  Str.toLowerCase,
  Str.split(wordSeparatorPattern),
  A.map(Str.replace(trailingDotsPattern, "")),
  HashSet.fromIterable
);

const isApplicationReference: (reference: string) => boolean = Str.includes("/");

const isPatentReference = (reference: string): boolean =>
  !isApplicationReference(reference) && pipe(reference, Str.includes(","));

const isDocketReference = (reference: string): boolean =>
  !isApplicationReference(reference) && !isPatentReference(reference);

const referencedNumbers = (
  references: ReadonlyArray<string>,
  isKind: (reference: string) => boolean
): HashSet.HashSet<string> =>
  HashSet.fromIterable(A.map(A.filter(references, isKind), Str.replaceAll(nonDigitPattern, "")));

const referencedDockets = (references: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.map(A.filter(references, isDocketReference), Str.toLowerCase);

const familyOfReference = (docket: string): O.Option<string> =>
  O.flatMap(Str.match(referenceFamilyPattern)(docket), A.head);

const domainOf = (address: string): O.Option<string> => A.last(Str.split(address, "@"));

const readableText = (envelope: MailEnvelope): string =>
  `${envelope.subject} ${O.getOrElse(envelope.bodyPreview, () => "")}`;

const senderSignals = (envelope: MailEnvelope): SenderSignals => {
  const senders = O.toArray(envelope.senderAddress);
  return {
    senderAddresses: HashSet.fromIterable(senders),
    senderDomains: HashSet.fromIterable(A.getSomes(A.map(senders, domainOf))),
  };
};

const mailSignals = (context: MatterTaggerContext, envelope: MailEnvelope): MailSignals => {
  const text = readableText(envelope);
  const references = extractPracticeKgReferences(text);
  const dockets = referencedDockets(references);
  return {
    ...senderSignals(envelope),
    applicationNumbers: HashSet.union(
      numbersIn(applicationNumberPattern)(text),
      referencedNumbers(references, isApplicationReference)
    ),
    patentNumbers: HashSet.union(
      numbersIn(patentNumberPattern)(text),
      referencedNumbers(references, isPatentReference)
    ),
    words: HashSet.union(wordsIn(text), HashSet.fromIterable(dockets)),
    referencedFamilies: HashSet.fromIterable(A.getSomes(A.map(dockets, familyOfReference))),
    addresses: HashSet.fromIterable(A.appendAll(O.toArray(envelope.senderAddress), envelope.recipientAddresses)),
    conversationId: envelope.conversationId,
    carriedMatter: O.flatMap(envelope.conversationId, (id) => HashMap.get(context.conversationMatters, id)),
  };
};

const evidenceOf =
  (kind: MatterEvidenceKind) =>
  (token: string): O.Option<MatterEvidence> =>
    O.map(decodeEvidenceToken(token), (matched) => MatterEvidence.make({ kind, matched }));

const hits = (
  kind: MatterEvidenceKind,
  tokens: ReadonlyArray<string>,
  isHit: (token: string) => boolean
): ReadonlyArray<MatterEvidence> => A.getSomes(A.map(A.filter(A.dedupe(tokens), isHit), evidenceOf(kind)));

const within =
  (present: HashSet.HashSet<string>) =>
  (token: string): boolean =>
    HashSet.has(present, token);

const carriedConversation = (signals: MailSignals, entry: MatterIndexEntry): ReadonlyArray<string> =>
  pipe(
    signals.carriedMatter,
    O.filter((matterKey) => matterKey === entry.matterKey),
    O.flatMap(() => signals.conversationId),
    O.toArray
  );

// A family key counts only against the family of an extracted docket reference, never a loose word.
const identifierEvidence = (
  signals: MailSignals,
  matter: MatterIdentifiers,
  familyKeys: ReadonlyArray<string>
): ReadonlyArray<MatterEvidence> =>
  A.flatten([
    hits("application-number", matter.applicationNumbers, within(signals.applicationNumbers)),
    hits("patent-number", matter.patentNumbers, within(signals.patentNumbers)),
    hits("docket-number", matter.docketNumbers, flow(Str.toLowerCase, within(signals.words))),
    hits("docket-number", familyKeys, flow(Str.toLowerCase, within(signals.referencedFamilies))),
  ]);

// The strongest identifier hit on a matter that cannot be tagged; 0 when none.
const unattributedStrength = (context: MatterTaggerContext, signals: MailSignals): number =>
  A.reduce(context.index.unattributed, 0, (strongest, matter) =>
    N.max(strongest, matterEvidenceConfidence(identifierEvidence(signals, matter, matter.familyKeys)))
  );

const entryEvidence = (signals: MailSignals, entry: MatterIndexEntry): ReadonlyArray<MatterEvidence> =>
  A.flatten([
    identifierEvidence(signals, entry, [entry.matterKey]),
    hits("conversation-carryover", carriedConversation(signals, entry), () => true),
    hits("contact-address", entry.contactAddresses, within(signals.addresses)),
    hits(
      "contact-domain",
      entry.contactDomains,
      (domain) => HashSet.has(signals.senderDomains, domain) && !isFreeMailDomain(domain)
    ),
  ]);

const candidateOf =
  (signals: MailSignals) =>
  (entry: MatterIndexEntry): O.Option<MatterCandidate> =>
    A.match(entryEvidence(signals, entry), {
      onEmpty: O.none,
      onNonEmpty: (evidence) =>
        O.some(
          MatterCandidate.make({
            matterKey: entry.matterKey,
            confidence: matterEvidenceConfidence(evidence),
            evidence,
          })
        ),
    });

const bestFirst: Order.Order<MatterCandidate> = Order.combine(
  Order.flip(Order.mapInput(Order.Number, (candidate: MatterCandidate) => candidate.confidence)),
  Order.mapInput(Order.String, (candidate: MatterCandidate) => candidate.matterKey)
);

const rankedCandidates = (context: MatterTaggerContext, signals: MailSignals): ReadonlyArray<MatterCandidate> =>
  A.sort(A.getSomes(A.map(context.index.entries, candidateOf(signals))), bestFirst);

const ruleApplies = (signals: SenderSignals): ((rule: MailRuleIntent) => boolean) =>
  MailRuleIntent.match({
    SenderDomainRule: (rule) => HashSet.has(signals.senderDomains, rule.domain),
    SenderAddressRule: (rule) => HashSet.has(signals.senderAddresses, rule.address),
  });

const isKnownContact = (context: MatterTaggerContext, signals: MailSignals): boolean =>
  A.some(context.index.entries, (entry) => A.some(entry.contactAddresses, within(signals.senderAddresses)));

const clientCategories = (context: MatterTaggerContext, signals: MailSignals): ReadonlyArray<PracticeCategory> =>
  isKnownContact(context, signals) ? [PracticeCategory.Enum["P: Client"]] : [];

const ruleCategories = (taxonomy: MailTaxonomy, signals: SenderSignals): ReadonlyArray<PracticeCategory> =>
  A.map(A.filter(taxonomy.ruleIntents, ruleApplies(signals)), (rule) => rule.category);

const practiceCategoriesOf = (context: MatterTaggerContext, signals: MailSignals): ReadonlyArray<PracticeCategory> =>
  A.dedupe(A.appendAll(ruleCategories(context.taxonomy, signals), clientCategories(context, signals)));

// A hit on an unattributed matter turns every unmatched outcome into `needs-attorney`.
const escalated =
  (rival: number) =>
  (reason: UnmatchedReason): UnmatchedReason =>
    rival > 0 ? UnmatchedReason.Enum["needs-attorney"] : reason;

const runnerUpConfidence = (candidates: ReadonlyArray<MatterCandidate>): number =>
  pipe(
    A.get(candidates, 1),
    O.map((candidate) => candidate.confidence),
    O.getOrElse(() => 0)
  );

const rejection = (policy: TaggingPolicy, best: number, runnerUp: number): O.Option<UnmatchedReason> =>
  best < policy.confidenceThreshold
    ? O.some(UnmatchedReason.Enum["below-threshold"])
    : O.liftPredicate(UnmatchedReason.Enum.ambiguous, () => best - runnerUp < policy.ambiguityMargin);

const verdict = (
  policy: TaggingPolicy,
  candidates: A.NonEmptyReadonlyArray<MatterCandidate>,
  rival: number,
  practiceCategories: ReadonlyArray<PracticeCategory>
): TaggingDecision => {
  const best = A.headNonEmpty(candidates);
  const runnerUp = N.max(runnerUpConfidence(candidates), rival);
  return O.match(O.map(rejection(policy, best.confidence, runnerUp), escalated(rival)), {
    onNone: () =>
      MatterMatched.make({
        matterKey: best.matterKey,
        confidence: best.confidence,
        evidence: best.evidence,
        practiceCategories,
      }),
    onSome: (reason) => MatterUnmatched.make({ reason, candidates, practiceCategories }),
  });
};

/**
 * Ranks the matters one message's evidence points at, best first.
 *
 * **Details**
 *
 * Evidence comes from the subject and body preview (application, patent, and
 * docket numbers), from the conversation the message belongs to, and from the
 * sender and recipients (contact addresses, and the sender's domain unless it
 * is a consumer mail domain). A matter appears once, with the confidence of
 * its distinct evidence kinds. Equal confidence falls back to matter-key order
 * so the ranking is deterministic.
 *
 * Identifiers are read twice. The practice-KG reference grammar
 * (`extractPracticeKgReferences`) finds the attorney's docket references,
 * including `<client>.<family><country><sequence>` and national-stage
 * suffixes, wherever they sit in the text; the tagger's own patterns and
 * word match stay as the fallback. A docket reference whose leading
 * `<client>.<family>` equals a matter key is `docket-number` evidence even
 * when the index does not list that docket, so a new country stage of a known
 * matter still matches. A bare family never matches a taggable matter that
 * way: bare families are reused across clients.
 *
 * **Example** (Rank a matter named by its application number)
 *
 * ```ts
 * import { UsptoNormalizedApplicationNumber } from "@beep/law-practice-domain"
 * import {
 *   MailEnvelope,
 *   MailMessageId,
 *   MatterClientKey,
 *   MatterIndex,
 *   MatterIndexEntry,
 *   MatterKey,
 *   defaultMailTaxonomy
 * } from "@beep/law-practice-domain/values/MailTagging"
 * import { MatterTaggerContext, matterCandidates } from "@beep/law-practice-use-cases/MailTagging"
 * import * as DateTime from "effect/DateTime"
 *
 * const matterKey = MatterKey.make("acme.10001")
 * const context = MatterTaggerContext.make({
 *   index: MatterIndex.make({
 *     entries: [
 *       MatterIndexEntry.make({
 *         matterKey,
 *         clientKey: MatterClientKey.make("acme"),
 *         applicationNumbers: [UsptoNormalizedApplicationNumber.make("16123456")]
 *       })
 *     ],
 *     builtAt: DateTime.makeUnsafe("2026-07-01T00:00:00.000Z")
 *   }),
 *   taxonomy: defaultMailTaxonomy([matterKey])
 * })
 * const envelope = MailEnvelope.make({
 *   messageId: MailMessageId.make("msg-0001"),
 *   subject: "Re: application 16/123,456",
 *   receivedAt: DateTime.makeUnsafe("2026-07-02T09:00:00.000Z"),
 *   hasAttachments: false
 * })
 *
 * console.log(matterCandidates(context, envelope).map((candidate) => candidate.matterKey)) // ["acme.10001"]
 * ```
 *
 * @param context - Matter index, taxonomy, policy, and conversation carryover map.
 * @param envelope - Message to score.
 * @returns One candidate per matter with evidence, best first.
 * @category use-cases
 * @since 0.0.0
 */
export const matterCandidates: {
  (context: MatterTaggerContext, envelope: MailEnvelope): ReadonlyArray<MatterCandidate>;
  (envelope: MailEnvelope): (context: MatterTaggerContext) => ReadonlyArray<MatterCandidate>;
} = dual(
  2,
  (context: MatterTaggerContext, envelope: MailEnvelope): ReadonlyArray<MatterCandidate> =>
    rankedCandidates(context, mailSignals(context, envelope))
);

/**
 * Decides which matter one message belongs to, or says explicitly that it
 * belongs to none.
 *
 * **Details**
 *
 * No candidate is `no-signal`. A best candidate under the policy's confidence
 * threshold is `below-threshold`. A best candidate that leads the runner-up by
 * less than the ambiguity margin is `ambiguous`. Only a candidate that clears
 * both is matched, so the tagger never forces a matter.
 *
 * An identifier hit on one of the index's unattributed matters competes as a
 * runner-up of its own confidence, so an equally strong hit defeats the margin.
 * Whenever such a hit exists and no matter is matched, the reason is
 * `needs-attorney` instead of the other three.
 *
 * Practice categories ride alongside either outcome: every taxonomy rule
 * intent the sender satisfies, plus `P: Client` when the sender is a known
 * contact address.
 *
 * **Example** (Leave unrelated mail unmatched)
 *
 * ```ts
 * import {
 *   MailEnvelope,
 *   MailMessageId,
 *   MatterIndex,
 *   defaultMailTaxonomy
 * } from "@beep/law-practice-domain/values/MailTagging"
 * import { MatterTaggerContext, decideMatterTagging } from "@beep/law-practice-use-cases/MailTagging"
 * import * as DateTime from "effect/DateTime"
 *
 * const context = MatterTaggerContext.make({
 *   index: MatterIndex.make({ entries: [], builtAt: DateTime.makeUnsafe("2026-07-01T00:00:00.000Z") }),
 *   taxonomy: defaultMailTaxonomy([])
 * })
 * const decision = decideMatterTagging(
 *   context,
 *   MailEnvelope.make({
 *     messageId: MailMessageId.make("msg-0001"),
 *     subject: "Lunch on Friday?",
 *     receivedAt: DateTime.makeUnsafe("2026-07-02T09:00:00.000Z"),
 *     hasAttachments: false
 *   })
 * )
 *
 * console.log(decision._tag) // "MatterUnmatched"
 * ```
 *
 * @param context - Matter index, taxonomy, policy, and conversation carryover map.
 * @param envelope - Message to decide.
 * @returns The matched matter, or an explicit unmatched outcome with its reason.
 * @category use-cases
 * @since 0.0.0
 */
export const decideMatterTagging: {
  (context: MatterTaggerContext, envelope: MailEnvelope): TaggingDecision;
  (envelope: MailEnvelope): (context: MatterTaggerContext) => TaggingDecision;
} = dual(2, (context: MatterTaggerContext, envelope: MailEnvelope): TaggingDecision => {
  const signals = mailSignals(context, envelope);
  const practiceCategories = practiceCategoriesOf(context, signals);
  const rival = unattributedStrength(context, signals);
  return A.match(rankedCandidates(context, signals), {
    onEmpty: () =>
      MatterUnmatched.make({ reason: escalated(rival)(UnmatchedReason.Enum["no-signal"]), practiceCategories }),
    onNonEmpty: (candidates) => verdict(context.policy, candidates, rival, practiceCategories),
  });
});

/**
 * Lists the practice categories the taxonomy's rule intents assign to one
 * message's sender.
 *
 * **Details**
 *
 * A sender-domain rule applies when the sender's domain equals the rule's
 * domain, a sender-address rule when the address does. The attachment filer
 * reads this to recognize USPTO mail the same way the tagger does.
 *
 * **Example** (Recognize a USPTO sender)
 *
 * ```ts
 * import { MailEnvelope, MailMessageId, defaultMailTaxonomy } from "@beep/law-practice-domain/values/MailTagging"
 * import { senderRuleCategories } from "@beep/law-practice-use-cases/MailTagging"
 * import { EmailString } from "@beep/schema/Email"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const envelope = MailEnvelope.make({
 *   messageId: MailMessageId.make("msg-0001"),
 *   subject: "Notice",
 *   senderAddress: O.some(EmailString.make("notices@uspto.gov")),
 *   receivedAt: DateTime.makeUnsafe("2026-07-02T09:00:00.000Z"),
 *   hasAttachments: true
 * })
 *
 * console.log(senderRuleCategories(defaultMailTaxonomy([]), envelope)) // ["P: USPTO"]
 * ```
 *
 * @param taxonomy - Taxonomy whose rule intents are evaluated.
 * @param envelope - Message whose sender is tested.
 * @returns The categories of every rule intent the sender satisfies, in rule order.
 * @category use-cases
 * @since 0.0.0
 */
export const senderRuleCategories: {
  (taxonomy: MailTaxonomy, envelope: MailEnvelope): ReadonlyArray<PracticeCategory>;
  (envelope: MailEnvelope): (taxonomy: MailTaxonomy) => ReadonlyArray<PracticeCategory>;
} = dual(
  2,
  (taxonomy: MailTaxonomy, envelope: MailEnvelope): ReadonlyArray<PracticeCategory> =>
    ruleCategories(taxonomy, senderSignals(envelope))
);
