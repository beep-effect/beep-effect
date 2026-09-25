/**
 * Trend category labels and the topic vocabularies that sit beside them.
 *
 * **Details**
 *
 * `topics` is an unconstrained string list. The option lists and `validItems`
 * are data, not a schema check, and the same topic can appear under more than
 * one category. Category does not change the other fields, so this is not a
 * tagged union.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import { Model, pg } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/Trend");

/**
 * Category a trend row can name.
 *
 * **Example** (Decode an AI product category)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TrendEnum } from "./Trend.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(TrendEnum)("ai_product"))
 * console.log(decoded) // "ai_product"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TrendEnum = LiteralKit([
  "ceo",
  "company",
  "software_product",
  "hardware_product",
  "ai_product",
]).pipe(
  $I.annoteSchema("TrendEnum", {
    description: "Trend category: ceo, company, software_product, hardware_product, or ai_product.",
  }),
);

/**
 * Decoded trend category.
 *
 * @see {@link TrendEnum} for the runtime literal.
 * @category type-level
 * @since 0.0.0
 */
export type TrendEnum = typeof TrendEnum.Type;

/**
 * Encoded trend category.
 *
 * @see {@link TrendEnum} for the runtime literal.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TrendEnum {
  export type Encoded = S.Codec.Encoded<typeof TrendEnum>;
}

/**
 * Whether a trend is a best or worst list.
 *
 * **Example** (Decode a worst trend)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TrendType } from "./Trend.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(TrendType)("worst"))
 * console.log(decoded) // "worst"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TrendType = LiteralKit(["best", "worst"]).pipe(
  $I.annoteSchema("TrendType", {
    description: "Trend direction: best or worst.",
  }),
);

/**
 * Decoded trend direction.
 *
 * @see {@link TrendType} for the runtime literal.
 * @category type-level
 * @since 0.0.0
 */
export type TrendType = typeof TrendType.Type;

/**
 * Encoded trend direction.
 *
 * @see {@link TrendType} for the runtime literal.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TrendType {
  export type Encoded = S.Codec.Encoded<typeof TrendType>;
}

/**
 * Names offered for the `ceo` category. Not enforced on {@link Trend.topics}.
 *
 * **Example** (Read the first CEO option)
 *
 * ```ts
 * import { ceoOptions } from "./Trend.ts"
 *
 * console.log(ceoOptions[0]) // "Elon Musk"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ceoOptions: ReadonlyArray<string> = [
  "Elon Musk",
  "Sundar Pichai",
  "Satya Nadella",
  "Jensen Huang",
  "Andy Jassy",
  "Ryan Breslow",
  "Henrique Dubugras",
  "Alexandr Wang",
  "Tim Cook",
  "Marc Benioff",
  "Dylan Field",
  "Parag Agrawal",
  "Brian Chesky",
  "Patrick Collison",
  "Andrew Wilson",
  "Lisa Su",
  "Austin Russell",
  "Sam Altman",
  "Darius Adamczyk",
  "Shantanu Narayen",
  "Bob Chapek",
  "Mark Zuckerberg",
  "David Zaslav",
  "Mary Barra",
  "Howard Schultz",
  "Raj Subramaniam",
  "Arvind Krishna",
  "Adam Neumann",
  "Vlad Tenev",
  "Dara Khosrowshahi",
  "Fran Horowitz",
  "Yuanqing Yang",
  "Frank Slootman",
  "William McDermott",
  "Anthony Wood",
  "Roland Busch",
  "Christian Klein",
  "Kazuhiro Tsuga",
  "Stéphane Bancel",
];

/**
 * Names offered for the `company` category.
 *
 * **Example** (Read a company option)
 *
 * ```ts
 * import { companyOptions } from "./Trend.ts"
 *
 * console.log(companyOptions[0]) // "Microsoft"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const companyOptions: ReadonlyArray<string> = [
  "Microsoft",
  "Nvidia",
  "Amazon",
  "Apple",
  "Tesla",
  "Salesforce",
  "Shopify",
  "Google/Alphabet",
  "SpaceX",
  "OpenAI",
  "Brex",
  "Stripe",
  "Adobe",
  "Zoom",
  "Figma",
  "Databricks",
  "GitHub",
  "Luminar",
  "Airbnb",
  "Square",
  "Meta",
  "Warner Bros. Discovery",
  "Disney",
  "X (formerly Twitter)",
  "BP",
  "Robinhood",
  "Peloton",
  "Boeing",
  "WeWork",
  "FedEx",
  "AT&T",
  "IBM",
  "Frontier Airlines",
  "Uber",
  "Juul",
  "TikTok",
  "Snapchat",
  "Nestlé",
  "Facebook",
  "GameStop",
];

/**
 * Names offered for the `software_product` category.
 *
 * **Example** (Read a software option)
 *
 * ```ts
 * import { softwareProductOptions } from "./Trend.ts"
 *
 * console.log(softwareProductOptions[0]) // "Microsoft Copilot"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const softwareProductOptions: ReadonlyArray<string> = [
  "Microsoft Copilot",
  "OpenAI GPT-4",
  "Slack",
  "Google Workspace",
  "Zoom",
  "Salesforce CRM",
  "Adobe Photoshop",
  "Figma",
  "Datadog",
  "ServiceNow",
  "HubSpot",
  "Notion",
  "Tableau",
  "Monday.com",
  "GitHub Copilot",
  "Asana",
  "Trello",
  "Snowflake",
  "Atlassian Jira",
  "ZoomInfo",
  "Meta Horizon Worlds",
  "Robinhood",
  "Oracle",
  "Evernote",
  "Google Stadia",
  "Facebook Workplace",
  "SAP S/4HANA",
  "IBM Watson",
  "Quibi",
  "Kaspersky",
  "Palantir",
  "Clubhouse",
  "Slack Threads",
  "TikTok’s Creator Tools",
  "Samsung Bixby",
  "Salesforce Marketing Cloud",
  "Microsoft Teams",
  "Intel AI Suite",
  "Uber Driver App",
];

/**
 * Names offered for the `hardware_product` category.
 *
 * **Example** (Read a hardware option)
 *
 * ```ts
 * import { hardwareProductOptions } from "./Trend.ts"
 *
 * console.log(hardwareProductOptions[0]) // "Tesla Cybertruck"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const hardwareProductOptions: ReadonlyArray<string> = [
  "Tesla Cybertruck",
  "iPhone 16",
  "MacBook Pro",
  "Nvidia RTX 5090",
  "SpaceX Starship",
  "Amazon Echo",
  "Sony PlayStation 6",
  "Microsoft Surface Pro 10",
  "Dyson V16",
  "Luminar LiDAR",
  "DJI Mavic 3",
  "Apple Vision Pro",
  "Google Pixel 9",
  "Framework Laptop",
  "Oculus Quest 4",
  "Logitech G Pro X",
  "Samsung Galaxy Fold 4",
  "Fitbit Charge 6",
  "Apple Watch 9",
  "Lumix S5 II",
];

/**
 * Names offered for the `ai_product` category.
 *
 * **Example** (Read an AI option)
 *
 * ```ts
 * import { aiProductOptions } from "./Trend.ts"
 *
 * console.log(aiProductOptions[0]) // "OpenAI GPT-5"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const aiProductOptions: ReadonlyArray<string> = [
  "OpenAI GPT-5",
  "Google DeepMind",
  "Nvidia Omniverse",
  "Microsoft Copilot",
  "Tesla FSD",
  "Amazon Alexa",
  "Salesforce Einstein",
  "Palantir Foundry",
  "Scale AI",
  "Grammarly AI",
  "MidJourney",
  "Hugging Face",
  "Runway Gen-2",
  "Anthropic Claude 2",
  "Cohere",
  "Databricks AI",
  "Hugging Face Transformers",
  "Notion AI",
  "Synthesia",
  "Jasper AI",
  "Meta AI",
  "IBM Watson",
  "Clearview AI",
  "Facebook AI",
  "Google Duplex",
  "Samsung Bixby",
  "Twitter AI moderation",
  "Microsoft Tay",
  "Replika",
  "Clear AI",
  "TikTok AI",
  "Robinhood AI Trading",
  "Meta Horizon AI",
  "Ring AI",
  "Uber AI",
  "Watson Health",
  "ChatGPT clones",
  "Tinder AI",
  "Zoom AI transcription",
  "Salesforce AI",
];

/**
 * Flat set of every topic vocabulary entry.
 *
 * **Details**
 *
 * Duplicates across categories collapse. Membership is not a check on
 * {@link Trend}.
 *
 * **Example** (Find a shared topic)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { validItems } from "./Trend.ts"
 *
 * console.log(HashSet.has(validItems, "Zoom")) // true
 * console.log(HashSet.has(validItems, "not-a-topic")) // false
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const validItems: HashSet.HashSet<string> = HashSet.fromIterable([
  ...ceoOptions,
  ...companyOptions,
  ...softwareProductOptions,
  ...hardwareProductOptions,
  ...aiProductOptions,
]);

/**
 * One identified trend.
 *
 * **Details**
 *
 * `category` and `type` are uniform literals. `topics` accepts any strings,
 * including names that are absent from {@link validItems}.
 *
 * **Example** (Decode a CEO trend)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { toWire } from "./Port.ts"
 * import { Trend } from "./Trend.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(toWire(Trend))({
 *     category: "ceo",
 *     type: "best",
 *     topics: ["Ada Lovelace"],
 *   }),
 * )
 * console.log(decoded.category) // "ceo"
 * console.log(decoded.topics[0]) // "Ada Lovelace"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Trend extends Model<Trend>("Trend")(
  {
    category: TrendEnum.pipe(pg.text(), pg.columnName("category")),
    type: TrendType.pipe(pg.text(), pg.columnName("type")),
    topics: S.Array(S.String).pipe(pg.jsonb(), pg.columnName("topics")),
  },
  $I.annote("Trend", {
    description: "A trend category, a best or worst direction, and unconstrained topic strings.",
  }),
) {}

/**
 * Encoded trend row.
 *
 * @see {@link Trend} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Trend {
  export type Encoded = S.Codec.Encoded<typeof Trend>;
}
