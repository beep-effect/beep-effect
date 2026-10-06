/**
 * Mail-tagging taxonomy: matter keys, Outlook category names, master-category
 * intents, and inbox-rule intents.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { EmailString } from "@beep/schema/Email";
import { Effect, flow, pipe } from "effect";
import * as A from "effect/Array";
import { constant } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $LawPracticeDomainId.create("values/MailTagging/MailTagging.taxonomy.model");

const matterClientKeyPattern = /^[^\s.]+$/u;
const matterKeyPattern = /^[^\s.]+\.[^\s.]+$/u;
const mailDomainPattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/u;
const matterCategoryPrefix = "M: ";

/**
 * Client segment of a {@link MatterKey}: one non-empty token without whitespace
 * or dots.
 *
 * **Example** (Guard a client key)
 *
 * ```ts
 * import { MatterClientKey } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MatterClientKey)("acme")) // true
 * console.log(S.is(MatterClientKey)("acme.10001")) // false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const MatterClientKey = S.String.check(
  S.isPattern(matterClientKeyPattern, {
    identifier: $I`MatterClientKeyPatternCheck`,
    title: "Matter Client Key",
    description: "A single non-empty token without whitespace or dots.",
    message: "Client key must be one non-empty token without whitespace or dots.",
  })
).pipe(
  S.brand("MatterClientKey"),
  $I.annoteSchema("MatterClientKey", {
    description: "Client segment of a practice-KG matter key.",
  })
);

/**
 * Type-level brand produced by {@link MatterClientKey}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MatterClientKey = typeof MatterClientKey.Type;

/**
 * Practice-KG docket-family natural key in its client-keyed form,
 * `<client>.<family>`.
 *
 * **Details**
 *
 * Exactly two non-empty dot-separated segments and no whitespace. A bare family
 * (no client segment) is not a taggable matter and is rejected.
 *
 * **Example** (Accept a client-keyed family and reject a bare one)
 *
 * ```ts
 * import { MatterKey } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MatterKey)("acme.10001")) // true
 * console.log(S.is(MatterKey)("10001")) // false
 * console.log(S.is(MatterKey)("acme. 10001")) // false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const MatterKey = S.String.check(
  S.isPattern(matterKeyPattern, {
    identifier: $I`MatterKeyPatternCheck`,
    title: "Matter Key",
    description: "Two non-empty dot-separated segments without whitespace: <client>.<family>.",
    message: "Matter key must be <client>.<family> with no whitespace.",
  })
).pipe(
  S.brand("MatterKey"),
  $I.annoteSchema("MatterKey", {
    description: "Client-keyed practice-KG docket-family natural key, <client>.<family>.",
  })
);

/**
 * Type-level brand produced by {@link MatterKey}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MatterKey = typeof MatterKey.Type;

/**
 * Outlook category name for one matter: `M: <MatterKey>`.
 *
 * **Example** (Guard a matter category name)
 *
 * ```ts
 * import { MatterCategoryName } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MatterCategoryName)("M: acme.10001")) // true
 * console.log(S.is(MatterCategoryName)("M: 10001")) // false
 * console.log(S.is(MatterCategoryName)("Docket - unverified")) // false
 * ```
 *
 * @see {@link matterCategoryName} for the total constructor from a matter key.
 * @category value-objects
 * @since 0.0.0
 */
export const MatterCategoryName = S.TemplateLiteral([matterCategoryPrefix, MatterKey]).pipe(
  S.brand("MatterCategoryName"),
  $I.annoteSchema("MatterCategoryName", {
    description: "Outlook category name for one matter: the M: prefix followed by the matter key.",
  })
);

/**
 * Type-level brand produced by {@link MatterCategoryName}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MatterCategoryName = typeof MatterCategoryName.Type;

const decodeMatterCategoryParts = S.decodeUnknownOption(S.TemplateLiteralParser([matterCategoryPrefix, MatterKey]));

/**
 * Builds the Outlook category name of a matter.
 *
 * **Example** (Name a matter category)
 *
 * ```ts
 * import { MatterKey, matterCategoryName } from "@beep/law-practice-domain/values"
 *
 * console.log(matterCategoryName(MatterKey.make("acme.10001"))) // "M: acme.10001"
 * ```
 *
 * @param key - Matter key to name.
 * @returns The `M: <key>` category name.
 * @see {@link matterKeyFromCategoryName} for the inverse.
 * @category constructors
 * @since 0.0.0
 */
export const matterCategoryName = (key: MatterKey): MatterCategoryName =>
  MatterCategoryName.make(`${matterCategoryPrefix}${key}`);

/**
 * Recovers the matter key from an arbitrary Outlook category string.
 *
 * **Example** (Recover a matter key)
 *
 * ```ts
 * import { matterKeyFromCategoryName } from "@beep/law-practice-domain/values"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(matterKeyFromCategoryName("M: acme.10001"))) // "acme.10001"
 * console.log(O.isNone(matterKeyFromCategoryName("P: USPTO"))) // true
 * ```
 *
 * @param name - Any Outlook category display name.
 * @returns The matter key when the string is a matter category name, otherwise none.
 * @see {@link matterCategoryName} for the inverse.
 * @category destructors
 * @since 0.0.0
 */
export const matterKeyFromCategoryName: (name: string) => O.Option<MatterKey> = flow(
  decodeMatterCategoryParts,
  O.map(([, key]) => key)
);

/**
 * Closed set of practice-level Outlook categories.
 *
 * **Example** (Guard practice categories)
 *
 * ```ts
 * import { PracticeCategory } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PracticeCategory)("P: USPTO")) // true
 * console.log(S.is(PracticeCategory)("P: Newsletter")) // false
 * console.log(PracticeCategory.Enum["P: Unmatched - review"]) // "P: Unmatched - review"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PracticeCategory = LiteralKit([
  "P: USPTO",
  "P: Client",
  "P: Opposing counsel",
  "P: Billing",
  "P: Admin",
  "P: Unmatched - review",
]).pipe(
  $I.annoteSchema("PracticeCategory", {
    description: "Closed set of practice-level Outlook categories owned by mail tagging.",
  })
);

/**
 * Runtime type for {@link PracticeCategory}.
 *
 * @category models
 * @since 0.0.0
 */
export type PracticeCategory = typeof PracticeCategory.Type;

/**
 * Any Outlook category name owned by mail tagging: a matter category or a
 * practice category.
 *
 * **Example** (Decode an owned category name)
 *
 * ```ts
 * import { MailCategoryName } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * const name = S.decodeUnknownSync(MailCategoryName)("M: acme.10001")
 * console.log(name) // "M: acme.10001"
 * ```
 *
 * @see {@link isMailCategoryName} for the ownership guard.
 * @category schemas
 * @since 0.0.0
 */
export const MailCategoryName = S.Union([MatterCategoryName, PracticeCategory]).pipe(
  $I.annoteSchema("MailCategoryName", {
    description: "Outlook category name owned by mail tagging: a matter category or a practice category.",
  })
);

/**
 * Runtime type for {@link MailCategoryName}.
 *
 * @category models
 * @since 0.0.0
 */
export type MailCategoryName = typeof MailCategoryName.Type;

/**
 * Says whether an arbitrary Outlook category string is owned by mail tagging.
 *
 * **Gotchas**
 *
 * Everything this guard rejects is foreign: another workstream's `Docket - *`
 * categories and the attorney's own categories. Foreign categories are never
 * added, removed, or reordered.
 *
 * **Example** (Separate owned categories from foreign ones)
 *
 * ```ts
 * import { isMailCategoryName } from "@beep/law-practice-domain/values"
 *
 * console.log(isMailCategoryName("M: acme.10001")) // true
 * console.log(isMailCategoryName("P: Billing")) // true
 * console.log(isMailCategoryName("Docket - unverified")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isMailCategoryName = S.is(MailCategoryName);

/**
 * Outlook master-category color presets, `preset0` through `preset24`.
 *
 * **Example** (Guard a color preset)
 *
 * ```ts
 * import { OutlookCategoryPreset } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(OutlookCategoryPreset)("preset24")) // true
 * console.log(S.is(OutlookCategoryPreset)("preset25")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OutlookCategoryPreset = LiteralKit([
  "preset0",
  "preset1",
  "preset2",
  "preset3",
  "preset4",
  "preset5",
  "preset6",
  "preset7",
  "preset8",
  "preset9",
  "preset10",
  "preset11",
  "preset12",
  "preset13",
  "preset14",
  "preset15",
  "preset16",
  "preset17",
  "preset18",
  "preset19",
  "preset20",
  "preset21",
  "preset22",
  "preset23",
  "preset24",
]).pipe(
  $I.annoteSchema("OutlookCategoryPreset", {
    description: "Outlook master-category color preset, preset0 through preset24.",
  })
);

/**
 * Runtime type for {@link OutlookCategoryPreset}.
 *
 * @category models
 * @since 0.0.0
 */
export type OutlookCategoryPreset = typeof OutlookCategoryPreset.Type;

/**
 * One master category the applier must ensure exists: display name plus color.
 *
 * **Example** (Describe a master category)
 *
 * ```ts
 * import { MasterCategoryIntent } from "@beep/law-practice-domain/values"
 *
 * const intent = MasterCategoryIntent.make({ displayName: "P: USPTO", color: "preset7" })
 * console.log(intent.color) // "preset7"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MasterCategoryIntent extends S.Class<MasterCategoryIntent>($I`MasterCategoryIntent`)(
  {
    displayName: MailCategoryName.annotateKey({
      description: "Category display name as it appears in Outlook.",
    }),
    color: OutlookCategoryPreset.annotateKey({
      description: "Outlook color preset for the category.",
    }),
  },
  $I.annote("MasterCategoryIntent", {
    description: "A master category the applier ensures exists: display name plus color preset.",
  })
) {}

const fnvOffsetBasis = 2166136261;
const fnvPrime = 16777619;

// `Str.split(text, "")` yields one-unit strings, so the fallback is never taken.
const codeUnit = (character: string): number => O.getOrElse(Str.charCodeAt(character, 0), constant(0));

const fnv1a32 = (text: string): number =>
  A.reduce(
    Str.split(text, ""),
    fnvOffsetBasis,
    (hash, character) => Math.imul(hash ^ codeUnit(character), fnvPrime) >>> 0
  );

/**
 * Derives a matter's color preset from its key.
 *
 * **Details**
 *
 * The preset is a 32-bit FNV-1a hash of the key's UTF-16 code units, modulo 25.
 * It depends on nothing but the key, so every run and every machine assigns the
 * same color to the same matter.
 *
 * **Example** (Derive a stable matter color)
 *
 * ```ts
 * import { MatterKey, matterCategoryPreset } from "@beep/law-practice-domain/values"
 *
 * const key = MatterKey.make("acme.10001")
 * console.log(matterCategoryPreset(key) === matterCategoryPreset(key)) // true
 * ```
 *
 * @param key - Matter key to color.
 * @returns The preset assigned to that key.
 * @category constructors
 * @since 0.0.0
 */
export const matterCategoryPreset = (key: MatterKey): OutlookCategoryPreset =>
  pipe(
    A.get(OutlookCategoryPreset.literals, fnv1a32(key) % A.length(OutlookCategoryPreset.literals)),
    // The index is a remainder of the literal count, so the fallback is never taken.
    O.getOrElse(constant(OutlookCategoryPreset.Enum.preset0))
  );

/**
 * Fixed color preset of each practice category.
 *
 * **Example** (Look up a practice category color)
 *
 * ```ts
 * import { practiceCategoryPreset } from "@beep/law-practice-domain/values"
 *
 * console.log(practiceCategoryPreset("P: USPTO")) // "preset7"
 * console.log(practiceCategoryPreset("P: Unmatched - review")) // "preset1"
 * ```
 *
 * @param category - Practice category to color.
 * @returns The preset fixed for that category.
 * @category constructors
 * @since 0.0.0
 */
export const practiceCategoryPreset: (category: PracticeCategory) => OutlookCategoryPreset = PracticeCategory.$match({
  "P: USPTO": () => OutlookCategoryPreset.Enum.preset7,
  "P: Client": () => OutlookCategoryPreset.Enum.preset4,
  "P: Opposing counsel": () => OutlookCategoryPreset.Enum.preset8,
  "P: Billing": () => OutlookCategoryPreset.Enum.preset3,
  "P: Admin": () => OutlookCategoryPreset.Enum.preset12,
  "P: Unmatched - review": () => OutlookCategoryPreset.Enum.preset1,
});

/**
 * Lowercase DNS domain of a mail sender, such as `example.test`.
 *
 * **Example** (Guard a sender domain)
 *
 * ```ts
 * import { MailDomain } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MailDomain)("example.test")) // true
 * console.log(S.is(MailDomain)("Example.Test")) // false
 * console.log(S.is(MailDomain)("counsel@example.test")) // false
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const MailDomain = S.String.check(
  S.isMaxLength(253, {
    identifier: $I`MailDomainLengthCheck`,
    title: "Mail Domain Length",
    description: "A DNS domain of at most 253 characters.",
    message: "Mail domain must not exceed 253 characters.",
  }),
  S.isPattern(mailDomainPattern, {
    identifier: $I`MailDomainPatternCheck`,
    title: "Mail Domain",
    description: "A lowercase DNS domain with at least two labels.",
    message: "Mail domain must be a lowercase DNS domain such as example.test.",
  })
).pipe(
  S.brand("MailDomain"),
  $I.annoteSchema("MailDomain", {
    description: "Lowercase DNS domain of a mail sender.",
  })
);

/**
 * Type-level brand produced by {@link MailDomain}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MailDomain = typeof MailDomain.Type;

/**
 * Inbox-rule intent: mail from a sender domain is assigned one practice
 * category.
 *
 * **Example** (Describe a sender-domain rule)
 *
 * ```ts
 * import { MailDomain, SenderDomainRule } from "@beep/law-practice-domain/values"
 *
 * const rule = SenderDomainRule.make({ domain: MailDomain.make("example.test"), category: "P: Client" })
 * console.log(rule._tag) // "SenderDomainRule"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SenderDomainRule extends S.TaggedClass<SenderDomainRule>($I`SenderDomainRule`)(
  "SenderDomainRule",
  {
    domain: MailDomain.annotateKey({
      description: "Sender domain the rule matches.",
    }),
    category: PracticeCategory.annotateKey({
      description: "Practice category the rule assigns.",
    }),
  },
  $I.annote("SenderDomainRule", {
    description: "Inbox-rule intent assigning one practice category to mail from a sender domain.",
  })
) {}

/**
 * Inbox-rule intent: mail from one sender address is assigned one practice
 * category.
 *
 * **Example** (Describe a sender-address rule)
 *
 * ```ts
 * import { SenderAddressRule } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * const rule = S.decodeUnknownSync(SenderAddressRule)({
 *   _tag: "SenderAddressRule",
 *   address: "billing@example.test",
 *   category: "P: Billing"
 * })
 * console.log(rule.category) // "P: Billing"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SenderAddressRule extends S.TaggedClass<SenderAddressRule>($I`SenderAddressRule`)(
  "SenderAddressRule",
  {
    address: EmailString.annotateKey({
      description: "Normalized sender address the rule matches.",
    }),
    category: PracticeCategory.annotateKey({
      description: "Practice category the rule assigns.",
    }),
  },
  $I.annote("SenderAddressRule", {
    description: "Inbox-rule intent assigning one practice category to mail from one sender address.",
  })
) {}

/**
 * An Outlook-native inbox rule expressed as data.
 *
 * **Gotchas**
 *
 * The only action is assigning a practice category. There is no move, delete,
 * or flag variant, and none may be added: category tagging is the one
 * reversible mailbox mutation.
 *
 * **Example** (Branch on a rule intent)
 *
 * ```ts
 * import { MailDomain, MailRuleIntent, SenderDomainRule } from "@beep/law-practice-domain/values"
 *
 * const rule = SenderDomainRule.make({ domain: MailDomain.make("example.test"), category: "P: Client" })
 * const condition = MailRuleIntent.match(rule, {
 *   SenderDomainRule: ({ domain }) => `from domain ${domain}`,
 *   SenderAddressRule: ({ address }) => `from ${address}`
 * })
 * console.log(condition) // "from domain example.test"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MailRuleIntent = S.Union([SenderDomainRule, SenderAddressRule]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("MailRuleIntent", {
    description: "Outlook-native inbox rule as data: a sender condition that assigns one practice category.",
  })
);

/**
 * Runtime type for {@link MailRuleIntent}.
 *
 * @category models
 * @since 0.0.0
 */
export type MailRuleIntent = typeof MailRuleIntent.Type;

/**
 * The mail-tagging taxonomy: practice categories, taggable matters, and
 * inbox-rule intents.
 *
 * **Example** (Decode a taxonomy with defaults)
 *
 * ```ts
 * import { MailTaxonomy } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * const taxonomy = S.decodeUnknownSync(MailTaxonomy)({ matterKeys: ["acme.10001"] })
 * console.log(taxonomy.practiceCategories.length) // 6
 * console.log(taxonomy.ruleIntents.length) // 0
 * ```
 *
 * @see {@link masterCategories} for the derived master-category list.
 * @category models
 * @since 0.0.0
 */
export class MailTaxonomy extends S.Class<MailTaxonomy>($I`MailTaxonomy`)(
  {
    practiceCategories: S.Array(PracticeCategory)
      .pipe(
        S.withDecodingDefaultKey(Effect.succeed(PracticeCategory.literals)),
        S.withConstructorDefault(Effect.succeed(PracticeCategory.literals))
      )
      .annotateKey({
        description: "Practice categories in use; defaults to the whole closed set.",
      }),
    matterKeys: S.Array(MatterKey)
      .pipe(S.withDecodingDefaultKey(Effect.succeed([])), S.withConstructorDefault(Effect.succeed([])))
      .annotateKey({
        description: "Taggable matters; each owns one matter category.",
      }),
    ruleIntents: S.Array(MailRuleIntent)
      .pipe(S.withDecodingDefaultKey(Effect.succeed([])), S.withConstructorDefault(Effect.succeed([])))
      .annotateKey({
        description: "Inbox-rule intents rendered for the attorney.",
      }),
  },
  $I.annote("MailTaxonomy", {
    description: "Mail-tagging taxonomy: practice categories, taggable matters, and inbox-rule intents.",
  })
) {}

const practiceCategoryIntent = (category: PracticeCategory): MasterCategoryIntent =>
  MasterCategoryIntent.make({ displayName: category, color: practiceCategoryPreset(category) });

const matterCategoryIntent = (key: MatterKey): MasterCategoryIntent =>
  MasterCategoryIntent.make({ displayName: matterCategoryName(key), color: matterCategoryPreset(key) });

/**
 * Derives the de-duplicated master-category list of a taxonomy.
 *
 * **Details**
 *
 * Practice categories come first, then matter categories, each in first-seen
 * order. This is the single list the applier ensures in the mailbox.
 *
 * **Example** (Derive master categories)
 *
 * ```ts
 * import { MailTaxonomy, MatterKey, masterCategories } from "@beep/law-practice-domain/values"
 *
 * const key = MatterKey.make("acme.10001")
 * const taxonomy = MailTaxonomy.make({ practiceCategories: ["P: USPTO"], matterKeys: [key, key] })
 * console.log(masterCategories(taxonomy).map((intent) => intent.displayName))
 * // ["P: USPTO", "M: acme.10001"]
 * ```
 *
 * @param taxonomy - Taxonomy to derive from.
 * @returns One intent per distinct practice category and per distinct matter.
 * @category constructors
 * @since 0.0.0
 */
export const masterCategories = (taxonomy: MailTaxonomy): ReadonlyArray<MasterCategoryIntent> =>
  A.appendAll(
    A.map(A.dedupe(taxonomy.practiceCategories), practiceCategoryIntent),
    A.map(A.dedupe(taxonomy.matterKeys), matterCategoryIntent)
  );

/**
 * Builds the default taxonomy for a set of matters.
 *
 * **Details**
 *
 * Carries every practice category and one rule intent: mail from the
 * `uspto.gov` sender domain is assigned `P: USPTO`.
 *
 * **Example** (Build the default taxonomy)
 *
 * ```ts
 * import { MatterKey, defaultMailTaxonomy } from "@beep/law-practice-domain/values"
 *
 * const taxonomy = defaultMailTaxonomy([MatterKey.make("acme.10001")])
 * console.log(taxonomy.ruleIntents.length) // 1
 * console.log(taxonomy.practiceCategories.length) // 6
 * ```
 *
 * @param matterKeys - Taggable matters.
 * @returns The taxonomy with all practice categories and the default USPTO rule.
 * @category constructors
 * @since 0.0.0
 */
export const defaultMailTaxonomy = (matterKeys: ReadonlyArray<MatterKey>): MailTaxonomy =>
  MailTaxonomy.make({
    matterKeys,
    ruleIntents: [
      SenderDomainRule.make({
        domain: MailDomain.make("uspto.gov"),
        category: PracticeCategory.Enum["P: USPTO"],
      }),
    ],
  });
