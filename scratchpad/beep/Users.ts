/**
 * Account subscription, quota, webhook, and location-consent models.
 *
 * **Details**
 *
 * `PlanType` accepts the six catalog ids plus the legacy alias `pro`, which
 * decodes as `architect`. The subscription field still rejects `plus` and
 * `unlimited_v2`. `WebhookType.memory_created` is the string `memory_created`;
 * the Python source writes a one-tuple and the str enum unpacks it.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Str from "effect/String";
import { Model, bool, optionalText, optionalTimestamp, pg, text, timestamp } from "./Kit.ts";
import {
  boolDefault,
  finiteDefault,
  intDefault,
  jsonColumn,
  jsonList,
  optionalJsonColumn,
  optionalNull,
  textDefault,
} from "./Port.ts";

const $I = $ScratchpadId.create("beep/Users");

const planMembers = LiteralKit(["basic", "unlimited", "architect", "operator", "plus", "unlimited_v2"]);
const planWire = LiteralKit(["basic", "unlimited", "architect", "operator", "plus", "unlimited_v2", "pro"]);
const releasedMembers = LiteralKit(["basic", "unlimited", "architect", "operator"]);
const releasedWire = LiteralKit(["basic", "unlimited", "architect", "operator", "pro"]);

const aliasPro = <A extends S.Top>(target: A) =>
  S.decodeTo(target, {
    decode: SchemaGetter.transform((value: string) => (value === "pro" ? "architect" : value)),
    encode: SchemaGetter.passthrough(),
  });

/**
 * Plans the released subscription wire may name.
 *
 * **Example** (Read the first legacy id)
 *
 * ```ts
 * import { LEGACY_WIRE_PLAN_TYPES } from "./Users.ts"
 *
 * console.log(LEGACY_WIRE_PLAN_TYPES[0]) // "basic"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LEGACY_WIRE_PLAN_TYPES: ReadonlyArray<string> = ["basic", "unlimited", "architect", "operator"];

/**
 * Catalog ids that must not appear on the released subscription wire.
 *
 * **Example** (Read a fallback id)
 *
 * ```ts
 * import { WIRE_FALLBACK_PLAN_TYPES } from "./Users.ts"
 *
 * console.log(WIRE_FALLBACK_PLAN_TYPES[0]) // "plus"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const WIRE_FALLBACK_PLAN_TYPES: ReadonlyArray<string> = ["plus", "unlimited_v2"];

/**
 * Purpose stored for chat city context.
 *
 * **Example** (Read the purpose)
 *
 * ```ts
 * import { LOCATION_CONTEXT_PURPOSE } from "./Users.ts"
 *
 * console.log(LOCATION_CONTEXT_PURPOSE) // "chat_city_context"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LOCATION_CONTEXT_PURPOSE = "chat_city_context";

/**
 * Providers disclosed with chat city context.
 *
 * **Example** (Read the map provider)
 *
 * ```ts
 * import { LOCATION_CONTEXT_DISCLOSED_PROVIDERS } from "./Users.ts"
 *
 * console.log(LOCATION_CONTEXT_DISCLOSED_PROVIDERS[0]) // "Google Maps"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LOCATION_CONTEXT_DISCLOSED_PROVIDERS: readonly [string, string] = [
  "Google Maps",
  "the configured AI chat provider",
];

/**
 * Catalog plan id, including the legacy `pro` alias.
 *
 * **Details**
 *
 * `pro` decodes as `architect`. `plus` and `unlimited_v2` remain members.
 * {@link Subscription} uses a narrower schema.
 *
 * **Example** (Map pro to architect)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { PlanType } from "./Users.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(PlanType)("pro"))
 * console.log(decoded) // "architect"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PlanType = planWire.pipe(
  aliasPro(planMembers),
  $I.annoteSchema("PlanType", { description: "Catalog plan id. The legacy alias pro decodes as architect." }),
);

/**
 * Decoded catalog plan id.
 *
 * @see {@link PlanType} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type PlanType = typeof PlanType.Type;

/**
 * Encoded catalog plan id.
 *
 * @see {@link PlanType} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PlanType {
  export type Encoded = S.Codec.Encoded<typeof PlanType>;
}

/**
 * A user or subscription wire value was rejected.
 *
 * **Example** (Read the message)
 *
 * ```ts
 * import { UsersError } from "./Users.ts"
 *
 * const error = UsersError.make({ message: "rejected" })
 * console.log(error.message) // "rejected"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UsersError extends S.TaggedError<UsersError>()(
  "UsersError",
  { message: S.String },
  $I.annoteError("UsersError", { description: "A user or subscription wire value was rejected." }),
) {}

/**
 * Encoded users error.
 *
 * @see {@link UsersError} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UsersError {
  export type Encoded = S.Codec.Encoded<typeof UsersError>;
}

/**
 * Reject fallback plans and map `pro` to `architect`.
 *
 * **Details**
 *
 * This is the subscription before-validator. The field schema already refuses
 * `plus` and `unlimited_v2`. The function keeps that branch testable.
 *
 * **Example** (Reject plus)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { rejectReleasedWirePlan } from "./Users.ts"
 *
 * console.log(Effect.runSyncExit(rejectReleasedWirePlan("plus"))._tag) // "Failure"
 * console.log(Effect.runSync(rejectReleasedWirePlan("pro"))) // "architect"
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const rejectReleasedWirePlan = Effect.fn("Subscription.rejectReleasedWirePlan")(function* (plan: string) {
  if (plan === "plus" || plan === "unlimited_v2") {
    return yield* UsersError.make({ message: "plan ID requires a versioned app-client subscription contract" });
  }
  return plan === "pro" ? "architect" : plan;
});

/**
 * Developer webhook kinds.
 *
 * **Gotchas**
 *
 * `memory_created` is a frozen conversation webhook string, not a memory-layer
 * event. The Python assignment is a one-tuple that the str enum unpacks.
 *
 * **Example** (Decode memory created)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { WebhookType } from "./Users.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(WebhookType)("memory_created"))
 * console.log(decoded) // "memory_created"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const WebhookType = LiteralKit([
  "audio_bytes",
  "audio_bytes_websocket",
  "realtime_transcript",
  "memory_created",
  "day_summary",
  "button_event",
]).pipe($I.annoteSchema("WebhookType", { description: "Developer webhook kind." }));

/**
 * Decoded webhook type.
 *
 * @see {@link WebhookType} for the runtime literal.
 * @category type-level
 * @since 0.0.0
 */
export type WebhookType = typeof WebhookType.Type;

/**
 * Encoded webhook type.
 *
 * @see {@link WebhookType} for the runtime literal.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace WebhookType {
  export type Encoded = S.Codec.Encoded<typeof WebhookType>;
}

/**
 * URL a stored webhook setting points at.
 *
 * **Details**
 *
 * Missing and empty values return `""`. `audio_bytes` keeps only the text
 * before the first comma. Every other type returns the trimmed value.
 *
 * **Example** (Split an audio bytes URL)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { webhookUrlFromSetting } from "./Users.ts"
 *
 * console.log(webhookUrlFromSetting("audio_bytes", O.some("https://x,5"))) // "https://x"
 * console.log(webhookUrlFromSetting("day_summary", O.none())) // ""
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const webhookUrlFromSetting = (wtype: string, value: O.Option<string>): string =>
  O.match(value, {
    onNone: () => "",
    onSome: (raw) => {
      if (Str.isEmpty(raw)) return "";
      const selected = wtype === "audio_bytes" ? (A.head(Str.split(raw, ",")) ?? O.none()) : O.some(raw);
      return Str.trim(O.getOrElse(selected, () => ""));
    },
  });

/**
 * Consent state for location context.
 *
 * **Example** (Decode granted)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { LocationContextConsentStatus } from "./Users.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(LocationContextConsentStatus)("granted"))
 * console.log(decoded) // "granted"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LocationContextConsentStatus = LiteralKit(["granted", "revoked"]).pipe(
  $I.annoteSchema("LocationContextConsentStatus", { description: "Location context consent: granted or revoked." }),
);

/**
 * Decoded consent status.
 *
 * @see {@link LocationContextConsentStatus} for the runtime literal.
 * @category type-level
 * @since 0.0.0
 */
export type LocationContextConsentStatus = typeof LocationContextConsentStatus.Type;

/**
 * Encoded consent status.
 *
 * @see {@link LocationContextConsentStatus} for the runtime literal.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LocationContextConsentStatus {
  export type Encoded = S.Codec.Encoded<typeof LocationContextConsentStatus>;
}

/**
 * Clock passed to {@link isLocationContextConsentActive}.
 *
 * `"naive"` stands for a datetime whose tzinfo is missing. Python returns false.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ConsentClock = "naive" | DateTime.Utc | undefined;

/**
 * Whether city-context consent is active.
 *
 * **Details**
 *
 * Active means granted, not revoked, the chat-city purpose, the disclosed
 * provider pair, `grantedAt <= now`, and `expiresAt > now`. A naive clock,
 * or a stored instant that cannot be placed in UTC, returns false. An omitted
 * clock reads the current UTC instant.
 *
 * **Example** (Reject a naive clock)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import { LocationContextConsent, isLocationContextConsentActive } from "./Users.ts"
 *
 * const consent = LocationContextConsent.make({
 *   status: "granted",
 *   grantedAt: DateTime.makeUnsafe("2020-01-01T00:00:00Z"),
 *   expiresAt: DateTime.makeUnsafe("2020-02-01T00:00:00Z"),
 * })
 * console.log(Effect.runSync(isLocationContextConsentActive(consent, "naive"))) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isLocationContextConsentActive = Effect.fn("LocationContextConsent.isActive")(function* (
  consent: LocationContextConsent,
  now?: ConsentClock,
) {
  if (now === "naive") return false;
  const current = now ?? (yield* Effect.sync(DateTime.nowUnsafe));
  const providers = consent.disclosedProviders;
  return (
    consent.status === "granted" &&
    O.isNone(consent.revokedAt) &&
    consent.purpose === LOCATION_CONTEXT_PURPOSE &&
    providers[0] === LOCATION_CONTEXT_DISCLOSED_PROVIDERS[0] &&
    providers[1] === LOCATION_CONTEXT_DISCLOSED_PROVIDERS[1] &&
    DateTime.toEpochMillis(consent.grantedAt) <= DateTime.toEpochMillis(current) &&
    DateTime.toEpochMillis(consent.expiresAt) > DateTime.toEpochMillis(current)
  );
});

/**
 * Server-owned authorization for city-only context in interactive chat.
 *
 * **Example** (Construct the disclosed providers)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { LocationContextConsent } from "./Users.ts"
 *
 * const consent = LocationContextConsent.make({
 *   status: "granted",
 *   grantedAt: DateTime.makeUnsafe("2020-01-01T00:00:00Z"),
 *   expiresAt: DateTime.makeUnsafe("2020-02-01T00:00:00Z"),
 * })
 * console.log(consent.purpose) // "chat_city_context"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LocationContextConsent extends Model<LocationContextConsent>("LocationContextConsent")(
  {
    status: LocationContextConsentStatus.pipe(pg.text(), pg.columnName("status")),
    purpose: text("purpose"),
    disclosedProviders: S.Tuple([S.String, S.String]).pipe(pg.jsonb(), pg.columnName("disclosed_providers")),
    grantedAt: timestamp("granted_at"),
    expiresAt: timestamp("expires_at"),
    revokedAt: optionalTimestamp("revoked_at"),
  },
  $I.annote("LocationContextConsent", {
    description: "Chat city context consent. Active only inside the granted window.",
  }),
) {}

/**
 * Encoded location consent.
 *
 * @see {@link LocationContextConsent} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LocationContextConsent {
  export type Encoded = S.Codec.Encoded<typeof LocationContextConsent>;
}

/**
 * Request to enable or revoke city context.
 *
 * **Details**
 *
 * `disclosureAccepted` constructs false. Enabling still requires the caller to
 * accept the Google Maps and chat-provider disclosure. This model does not
 * enforce that pairing.
 *
 * **Example** (Construct a disabled update)
 *
 * ```ts
 * import { LocationContextConsentUpdate } from "./Users.ts"
 *
 * const update = LocationContextConsentUpdate.make({ enabled: false })
 * console.log(update.disclosureAccepted) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LocationContextConsentUpdate extends Model<LocationContextConsentUpdate>("LocationContextConsentUpdate")(
  {
    enabled: bool("enabled"),
    disclosureAccepted: boolDefault("disclosure_accepted", false),
  },
  $I.annote("LocationContextConsentUpdate", {
    description: "Enable or revoke city context. Disclosure constructs false.",
  }),
) {}

/**
 * Encoded consent update.
 *
 * @see {@link LocationContextConsentUpdate} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LocationContextConsentUpdate {
  export type Encoded = S.Codec.Encoded<typeof LocationContextConsentUpdate>;
}

/**
 * Consent state returned to the client.
 *
 * **Example** (Construct the default purpose)
 *
 * ```ts
 * import { LocationContextConsentResponse } from "./Users.ts"
 *
 * const response = LocationContextConsentResponse.make({ enabled: true })
 * console.log(response.purpose) // "chat_city_context"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LocationContextConsentResponse extends Model<LocationContextConsentResponse>(
  "LocationContextConsentResponse",
)(
  {
    enabled: bool("enabled"),
    purpose: textDefault("purpose", LOCATION_CONTEXT_PURPOSE),
    disclosedProviders: S.Tuple([S.String, S.String]).pipe(
      S.withConstructorDefault(Effect.succeed(LOCATION_CONTEXT_DISCLOSED_PROVIDERS)),
      pg.jsonb(),
      pg.columnName("disclosed_providers"),
    ),
    expiresAt: optionalTimestamp("expires_at"),
  },
  $I.annote("LocationContextConsentResponse", {
    description: "Client view of city-context consent.",
  }),
) {}

/**
 * Encoded consent response.
 *
 * @see {@link LocationContextConsentResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LocationContextConsentResponse {
  export type Encoded = S.Codec.Encoded<typeof LocationContextConsentResponse>;
}

/**
 * Subscription lifecycle state.
 *
 * **Example** (Decode inactive)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { SubscriptionStatus } from "./Users.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(SubscriptionStatus)("inactive"))
 * console.log(decoded) // "inactive"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SubscriptionStatus = LiteralKit(["active", "inactive"]).pipe(
  $I.annoteSchema("SubscriptionStatus", { description: "Subscription state: active or inactive." }),
);

/**
 * Decoded subscription status.
 *
 * @see {@link SubscriptionStatus} for the runtime literal.
 * @category type-level
 * @since 0.0.0
 */
export type SubscriptionStatus = typeof SubscriptionStatus.Type;

/**
 * Encoded subscription status.
 *
 * @see {@link SubscriptionStatus} for the runtime literal.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SubscriptionStatus {
  export type Encoded = S.Codec.Encoded<typeof SubscriptionStatus>;
}

const optionalInt = (column: string) => optionalNull(S.Int).pipe(pg.integer(), pg.columnName(column));

/**
 * Optional numeric limits for a plan.
 *
 * **Details**
 *
 * Free and unlimited cap chat by question count. Architect caps by
 * `chatCostUsdPerMonth`. Exactly one chat cap is set per plan. This model
 * does not enforce that pairing.
 *
 * **Example** (Leave every limit empty)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { PlanLimits } from "./Users.ts"
 *
 * const limits = PlanLimits.make({})
 * console.log(O.isNone(limits.transcriptionSeconds)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PlanLimits extends Model<PlanLimits>("PlanLimits")(
  {
    transcriptionSeconds: optionalInt("transcription_seconds"),
    wordsTranscribed: optionalInt("words_transcribed"),
    insightsGained: optionalInt("insights_gained"),
    chatQuestionsPerMonth: optionalInt("chat_questions_per_month"),
    chatCostUsdPerMonth: optionalNull(S.Finite).pipe(pg.doublePrecision(), pg.columnName("chat_cost_usd_per_month")),
  },
  $I.annote("PlanLimits", { description: "Optional numeric plan limits." }),
) {}

/**
 * Encoded plan limits.
 *
 * @see {@link PlanLimits} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PlanLimits {
  export type Encoded = S.Codec.Encoded<typeof PlanLimits>;
}

/**
 * Unit of a chat usage quota.
 *
 * **Example** (Decode questions)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ChatQuotaUnit } from "./Users.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ChatQuotaUnit)("questions"))
 * console.log(decoded) // "questions"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ChatQuotaUnit = LiteralKit(["questions", "cost_usd"]).pipe(
  $I.annoteSchema("ChatQuotaUnit", { description: "Chat quota unit: questions or cost_usd." }),
);

/**
 * Decoded chat quota unit.
 *
 * @see {@link ChatQuotaUnit} for the runtime literal.
 * @category type-level
 * @since 0.0.0
 */
export type ChatQuotaUnit = typeof ChatQuotaUnit.Type;

/**
 * Encoded chat quota unit.
 *
 * @see {@link ChatQuotaUnit} for the runtime literal.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ChatQuotaUnit {
  export type Encoded = S.Codec.Encoded<typeof ChatQuotaUnit>;
}

/**
 * Chat usage against the current plan.
 *
 * **Details**
 *
 * `plan` is the display name. `planType` is an open string, not {@link PlanType}.
 * A missing `limit` means unlimited.
 *
 * **Gotchas**
 *
 * `isOveragePlan` means usage past `limit` accrues a charge instead of blocking.
 * Clients must not gate sends on `allowed` alone.
 *
 * **Example** (Construct the zero percent)
 *
 * ```ts
 * import { ChatUsageQuota } from "./Users.ts"
 *
 * const quota = ChatUsageQuota.make({ plan: "Free", planType: "basic", unit: "questions", used: 0 })
 * console.log(quota.percent) // 0
 * console.log(quota.allowed) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ChatUsageQuota extends Model<ChatUsageQuota>("ChatUsageQuota")(
  {
    plan: text("plan"),
    planType: text("plan_type"),
    unit: ChatQuotaUnit.pipe(pg.text(), pg.columnName("unit")),
    used: S.Finite.pipe(pg.doublePrecision(), pg.columnName("used")),
    limit: optionalNull(S.Finite).pipe(pg.doublePrecision(), pg.columnName("limit")),
    percent: finiteDefault("percent", 0),
    allowed: boolDefault("allowed", true),
    resetAt: optionalInt("reset_at"),
    isOveragePlan: boolDefault("is_overage_plan", false),
  },
  $I.annote("ChatUsageQuota", { description: "Chat usage. allowed is not a send gate for overage plans." }),
) {}

/**
 * Encoded chat quota.
 *
 * @see {@link ChatUsageQuota} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ChatUsageQuota {
  export type Encoded = S.Codec.Encoded<typeof ChatUsageQuota>;
}

const ReleasedPlan = releasedWire.pipe(aliasPro(releasedMembers), S.withConstructorDefault(Effect.succeed("basic")));

/**
 * Subscription status shown to released clients.
 *
 * **Details**
 *
 * `plan` constructs as `basic` and refuses `plus` and `unlimited_v2`. `pro`
 * decodes as `architect`. A missing `currentPeriodStart` means the desktop
 * grandfather check treats the subscription as pre-cutoff.
 *
 * **Example** (Construct the basic plan)
 *
 * ```ts
 * import { Subscription } from "./Users.ts"
 *
 * const subscription = Subscription.make({})
 * console.log(subscription.plan) // "basic"
 * console.log(subscription.status) // "active"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Subscription extends Model<Subscription>("Subscription")(
  {
    plan: ReleasedPlan.pipe(pg.text(), pg.columnName("plan")),
    status: SubscriptionStatus.pipe(S.withConstructorDefault(Effect.succeed("active")), pg.text(), pg.columnName("status")),
    currentPeriodEnd: optionalInt("current_period_end"),
    currentPeriodStart: optionalInt("current_period_start"),
    stripeSubscriptionId: optionalText("stripe_subscription_id"),
    currentPriceId: optionalText("current_price_id"),
    features: jsonList(S.String, "features"),
    cancelAtPeriodEnd: boolDefault("cancel_at_period_end", false),
    limits: PlanLimits.pipe(S.withConstructorDefault(Effect.sync(() => PlanLimits.make({}))), pg.jsonb(), pg.columnName("limits")),
    deprecated: boolDefault("deprecated", false),
    deprecationMessage: optionalText("deprecation_message"),
  },
  $I.annote("Subscription", { description: "Released subscription projection. plan defaults to basic." }),
) {}

/**
 * Encoded subscription.
 *
 * @see {@link Subscription} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Subscription {
  export type Encoded = S.Codec.Encoded<typeof Subscription>;
}

/**
 * One price shown for a plan.
 *
 * **Example** (Decode a monthly price)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { toWire } from "./Port.ts"
 * import { PricingOption } from "./Users.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(toWire(PricingOption))({ id: "monthly", title: "Monthly", price_string: "$10" }),
 * )
 * console.log(decoded.priceString) // "$10"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PricingOption extends Model<PricingOption>("PricingOption")(
  {
    id: text("id"),
    title: text("title"),
    description: optionalText("description"),
    priceString: text("price_string"),
  },
  $I.annote("PricingOption", { description: "A plan price id, title, and display string." }),
) {}

/**
 * Encoded pricing option.
 *
 * @see {@link PricingOption} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PricingOption {
  export type Encoded = S.Codec.Encoded<typeof PricingOption>;
}

/**
 * A plan card rendered by the client.
 *
 * **Example** (Construct an empty card)
 *
 * ```ts
 * import { SubscriptionPlan } from "./Users.ts"
 *
 * const plan = SubscriptionPlan.make({ id: "operator", title: "Operator" })
 * console.log(plan.legacy) // false
 * console.log(plan.features.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SubscriptionPlan extends Model<SubscriptionPlan>("SubscriptionPlan")(
  {
    id: text("id"),
    title: text("title"),
    subtitle: optionalText("subtitle"),
    description: optionalText("description"),
    eyebrow: optionalText("eyebrow"),
    features: jsonList(S.String, "features"),
    prices: jsonList(PricingOption, "prices"),
    legacy: boolDefault("legacy", false),
  },
  $I.annote("SubscriptionPlan", { description: "A client plan card and its prices." }),
) {}

/**
 * Encoded subscription plan.
 *
 * @see {@link SubscriptionPlan} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SubscriptionPlan {
  export type Encoded = S.Codec.Encoded<typeof SubscriptionPlan>;
}

/**
 * Trial countdown shown to desktop clients.
 *
 * **Example** (Construct an unexpired trial)
 *
 * ```ts
 * import { TrialMetadata } from "./Users.ts"
 *
 * const trial = TrialMetadata.make({})
 * console.log(trial.trialExpired) // false
 * console.log(trial.planAfterTrial) // "Free"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TrialMetadata extends Model<TrialMetadata>("TrialMetadata")(
  {
    trialStartedAt: optionalInt("trial_started_at"),
    trialEndsAt: optionalInt("trial_ends_at"),
    trialRemainingSeconds: intDefault("trial_remaining_seconds", 0),
    trialExpired: boolDefault("trial_expired", false),
    trialDurationSeconds: intDefault("trial_duration_seconds", 0),
    trialFeatures: jsonList(S.String, "trial_features"),
    planAfterTrial: textDefault("plan_after_trial", "Free"),
  },
  $I.annote("TrialMetadata", { description: "Desktop trial countdown. plan_after_trial constructs as Free." }),
) {}

/**
 * Encoded trial metadata.
 *
 * @see {@link TrialMetadata} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TrialMetadata {
  export type Encoded = S.Codec.Encoded<typeof TrialMetadata>;
}

/**
 * Phone-call access and remaining quota.
 *
 * **Details**
 *
 * A missing monthly limit means unlimited. Zero means disabled. A missing
 * `remaining` also means unlimited.
 *
 * **Example** (Require access)
 *
 * ```ts
 * import { PhoneCallQuota } from "./Users.ts"
 *
 * const quota = PhoneCallQuota.make({ hasAccess: true, isPaid: false })
 * console.log(quota.monthlyUsed) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PhoneCallQuota extends Model<PhoneCallQuota>("PhoneCallQuota")(
  {
    hasAccess: bool("has_access"),
    isPaid: bool("is_paid"),
    monthlyLimit: optionalInt("monthly_limit"),
    monthlyUsed: intDefault("monthly_used", 0),
    remaining: optionalInt("remaining"),
    maxDurationSeconds: optionalInt("max_duration_seconds"),
    allowedCountries: jsonList(S.String, "allowed_countries"),
    resetAt: optionalInt("reset_at"),
  },
  $I.annote("PhoneCallQuota", { description: "Phone call access. A missing limit means unlimited." }),
) {}

/**
 * Encoded phone quota.
 *
 * @see {@link PhoneCallQuota} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PhoneCallQuota {
  export type Encoded = S.Codec.Encoded<typeof PhoneCallQuota>;
}

/**
 * Which speech-to-text mode the client should open.
 *
 * **Details**
 *
 * `mode` stays an open string. Writers use `managed`, `on_device`, and
 * `blocked`. A missing `remainingSeconds` means unlimited.
 *
 * **Example** (Decode a blocked allowance)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { toWire } from "./Port.ts"
 * import { TranscriptionAllowanceSnapshot } from "./Users.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(toWire(TranscriptionAllowanceSnapshot))({ mode: "blocked" }))
 * console.log(decoded.mode) // "blocked"
 * console.log(O.isNone(decoded.remainingSeconds)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TranscriptionAllowanceSnapshot extends Model<TranscriptionAllowanceSnapshot>(
  "TranscriptionAllowanceSnapshot",
)(
  {
    mode: text("mode"),
    remainingSeconds: optionalInt("remaining_seconds"),
    reason: textDefault("reason", ""),
  },
  $I.annote("TranscriptionAllowanceSnapshot", {
    description: "STT mode for the client. mode is an open string.",
  }),
) {}

/**
 * Encoded transcription allowance.
 *
 * @see {@link TranscriptionAllowanceSnapshot} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TranscriptionAllowanceSnapshot {
  export type Encoded = S.Codec.Encoded<typeof TranscriptionAllowanceSnapshot>;
}

/**
 * Subscription payload returned to the client.
 *
 * **Example** (Show the subscription UI by default)
 *
 * ```ts
 * import { Subscription, UserSubscriptionResponse } from "./Users.ts"
 *
 * const response = UserSubscriptionResponse.make({
 *   subscription: Subscription.make({}),
 *   transcriptionSecondsUsed: 0,
 *   transcriptionSecondsLimit: 1,
 *   wordsTranscribedUsed: 0,
 *   wordsTranscribedLimit: 1,
 *   insightsGainedUsed: 0,
 *   insightsGainedLimit: 1,
 * })
 * console.log(response.showSubscriptionUi) // true
 * console.log(response.chatQuotaAllowed) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UserSubscriptionResponse extends Model<UserSubscriptionResponse>("UserSubscriptionResponse")(
  {
    subscription: jsonColumn(Subscription, "subscription"),
    transcriptionSecondsUsed: S.Int.pipe(pg.integer(), pg.columnName("transcription_seconds_used")),
    transcriptionSecondsLimit: S.Int.pipe(pg.integer(), pg.columnName("transcription_seconds_limit")),
    wordsTranscribedUsed: S.Int.pipe(pg.integer(), pg.columnName("words_transcribed_used")),
    wordsTranscribedLimit: S.Int.pipe(pg.integer(), pg.columnName("words_transcribed_limit")),
    insightsGainedUsed: S.Int.pipe(pg.integer(), pg.columnName("insights_gained_used")),
    insightsGainedLimit: S.Int.pipe(pg.integer(), pg.columnName("insights_gained_limit")),
    availablePlans: jsonList(SubscriptionPlan, "available_plans"),
    showSubscriptionUi: boolDefault("show_subscription_ui", true),
    chatQuotaUsed: finiteDefault("chat_quota_used", 0),
    chatQuotaUnit: optionalNull(ChatQuotaUnit).pipe(pg.text(), pg.columnName("chat_quota_unit")),
    chatQuotaPercent: finiteDefault("chat_quota_percent", 0),
    chatQuotaAllowed: boolDefault("chat_quota_allowed", true),
    chatQuotaResetAt: optionalInt("chat_quota_reset_at"),
    phoneCallQuota: optionalJsonColumn(PhoneCallQuota, "phone_call_quota"),
    desktopGrandfatherUntil: optionalInt("desktop_grandfather_until"),
    transcriptionAllowance: optionalJsonColumn(TranscriptionAllowanceSnapshot, "transcription_allowance"),
  },
  $I.annote("UserSubscriptionResponse", {
    description: "Client subscription payload. Nested plans keep camelCase keys.",
  }),
) {}

/**
 * Encoded subscription response.
 *
 * @see {@link UserSubscriptionResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UserSubscriptionResponse {
  export type Encoded = S.Codec.Encoded<typeof UserSubscriptionResponse>;
}

/**
 * A language the client can select.
 *
 * **Example** (Decode English)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AvailableLanguage } from "./Users.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(AvailableLanguage)({ code: "en", name: "English" }))
 * console.log(decoded.code) // "en"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AvailableLanguage extends Model<AvailableLanguage>("AvailableLanguage")(
  {
    code: text("code"),
    name: text("name"),
  },
  $I.annote("AvailableLanguage", { description: "A selectable language code and name." }),
) {}

/**
 * Encoded language.
 *
 * @see {@link AvailableLanguage} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AvailableLanguage {
  export type Encoded = S.Codec.Encoded<typeof AvailableLanguage>;
}

/**
 * Languages the client can select.
 *
 * **Example** (Decode one language)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AvailableLanguagesResponse } from "./Users.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(AvailableLanguagesResponse)({ languages: [{ code: "en", name: "English" }] }))
 * console.log(decoded.languages.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AvailableLanguagesResponse extends Model<AvailableLanguagesResponse>("AvailableLanguagesResponse")(
  {
    languages: S.Array(AvailableLanguage).pipe(pg.jsonb(), pg.columnName("languages")),
  },
  $I.annote("AvailableLanguagesResponse", { description: "Selectable languages." }),
) {}

/**
 * Encoded language list.
 *
 * @see {@link AvailableLanguagesResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AvailableLanguagesResponse {
  export type Encoded = S.Codec.Encoded<typeof AvailableLanguagesResponse>;
}
