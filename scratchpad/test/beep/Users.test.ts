import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { toWire } from "../../beep/Port.ts";
import {
  AvailableLanguage,
  AvailableLanguagesResponse,
  ChatQuotaUnit,
  ChatUsageQuota,
  LOCATION_CONTEXT_DISCLOSED_PROVIDERS,
  LOCATION_CONTEXT_PURPOSE,
  LocationContextConsent,
  LocationContextConsentResponse,
  LocationContextConsentStatus,
  LocationContextConsentUpdate,
  PhoneCallQuota,
  PlanLimits,
  PlanType,
  PricingOption,
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
  TranscriptionAllowanceSnapshot,
  TrialMetadata,
  UserSubscriptionResponse,
  WebhookType,
  isLocationContextConsentActive,
  rejectReleasedWirePlan,
  webhookUrlFromSetting,
} from "../../beep/Users.ts";

const decode = <A extends S.Top>(schema: A, input: unknown): A["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const fails = (schema: S.Top, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const consentAt = (status: "granted" | "revoked", revoked = false) =>
  LocationContextConsent.make({
    status,
    purpose: LOCATION_CONTEXT_PURPOSE,
    disclosedProviders: LOCATION_CONTEXT_DISCLOSED_PROVIDERS,
    grantedAt: DateTime.makeUnsafe("2020-01-01T00:00:00Z"),
    expiresAt: DateTime.makeUnsafe("2020-02-01T00:00:00Z"),
    revokedAt: revoked ? O.some(DateTime.makeUnsafe("2020-01-15T00:00:00Z")) : O.none(),
  });

describe("Users", () => {
  it("maps pro and rejects unreleased subscription plans", () => {
    assert.strictEqual(decode(PlanType, "pro"), "architect");
    assert.strictEqual(decode(PlanType, "plus"), "plus");
    const released = {
      status: "active",
      features: [],
      cancel_at_period_end: false,
      limits: {},
      deprecated: false,
    };
    assert.strictEqual(decode(toWire(Subscription), { ...released, plan: "pro" }).plan, "architect");
    assert.strictEqual(Subscription.make({}).plan, "basic");
    assert.strictEqual(Subscription.make({}).status, "active");
    assert.strictEqual(fails(toWire(Subscription), { ...released, plan: "plus" }), true);
    assert.strictEqual(fails(toWire(Subscription), { ...released, plan: "unlimited_v2" }), true);
    assert.strictEqual(Effect.runSync(rejectReleasedWirePlan("pro")), "architect");
    assert.strictEqual(Effect.runSyncExit(rejectReleasedWirePlan("plus"))._tag, "Failure");
    assert.strictEqual(Effect.runSync(rejectReleasedWirePlan("basic")), "basic");
  });

  it("decodes missing and null plan limits and quota options", () => {
    const missing = decode(toWire(PlanLimits), {});
    assert.strictEqual(O.isNone(missing.transcriptionSeconds), true);
    assert.strictEqual(O.isNone(missing.chatCostUsdPerMonth), true);
    const nulled = decode(toWire(PlanLimits), {
      transcription_seconds: null,
      words_transcribed: null,
      insights_gained: null,
      chat_questions_per_month: null,
      chat_cost_usd_per_month: null,
    });
    assert.strictEqual(O.isNone(nulled.wordsTranscribed), true);
    const present = decode(toWire(PlanLimits), { chat_questions_per_month: 500, chat_cost_usd_per_month: 1.5 });
    assert.strictEqual(O.getOrElse(present.chatQuestionsPerMonth, () => 0), 500);
    const quota = ChatUsageQuota.make({ plan: "Free", planType: "basic", unit: "questions", used: 2 });
    assert.strictEqual(quota.allowed, true);
    assert.strictEqual(quota.isOveragePlan, false);
    assert.strictEqual(O.isNone(quota.limit), true);
    const phone = decode(toWire(PhoneCallQuota), {
      has_access: true,
      is_paid: false,
      monthly_limit: null,
      monthly_used: 0,
      remaining: null,
      allowed_countries: [],
    });
    assert.strictEqual(PhoneCallQuota.make({ hasAccess: true, isPaid: false }).monthlyUsed, 0);
    assert.strictEqual(O.isNone(phone.monthlyLimit), true);
    assert.strictEqual(decode(TranscriptionAllowanceSnapshot, { mode: "custom-mode", reason: "" }).mode, "custom-mode");
  });

  it("covers webhook and consent branches", () => {
    assert.strictEqual(webhookUrlFromSetting("audio_bytes", O.some("https://x,5")), "https://x");
    assert.strictEqual(webhookUrlFromSetting("audio_bytes", O.some(" ,5")), "");
    assert.strictEqual(webhookUrlFromSetting("day_summary", O.some(" https://y ")), "https://y");
    assert.strictEqual(webhookUrlFromSetting("day_summary", O.none()), "");
    assert.strictEqual(webhookUrlFromSetting("day_summary", O.some("")), "");
    assert.strictEqual(decode(WebhookType, "memory_created"), "memory_created");
    assert.strictEqual(decode(WebhookType, "button_event"), "button_event");
    const now = DateTime.makeUnsafe("2020-01-15T00:00:00Z");
    const active = consentAt("granted");
    assert.strictEqual(Effect.runSync(isLocationContextConsentActive(active, now)), true);
    assert.strictEqual(Effect.runSync(isLocationContextConsentActive(active, "naive")), false);
    assert.strictEqual(Effect.runSync(isLocationContextConsentActive(consentAt("revoked"), now)), false);
    assert.strictEqual(Effect.runSync(isLocationContextConsentActive(consentAt("granted", true), now)), false);
    const expired = LocationContextConsent.make({
      status: "granted",
      purpose: LOCATION_CONTEXT_PURPOSE,
      disclosedProviders: LOCATION_CONTEXT_DISCLOSED_PROVIDERS,
      grantedAt: DateTime.makeUnsafe("2019-01-01T00:00:00Z"),
      expiresAt: DateTime.makeUnsafe("2019-02-01T00:00:00Z"),
    });
    assert.strictEqual(Effect.runSync(isLocationContextConsentActive(expired, now)), false);
    const wrong = LocationContextConsent.make({
      status: "granted",
      purpose: "other",
      disclosedProviders: LOCATION_CONTEXT_DISCLOSED_PROVIDERS,
      grantedAt: DateTime.makeUnsafe("2020-01-01T00:00:00Z"),
      expiresAt: DateTime.makeUnsafe("2020-02-01T00:00:00Z"),
    });
    assert.strictEqual(Effect.runSync(isLocationContextConsentActive(wrong, now)), false);
    const response = LocationContextConsentResponse.make({ enabled: true });
    assert.strictEqual(response.purpose, LOCATION_CONTEXT_PURPOSE);
    assert.strictEqual(O.isNone(response.expiresAt), true);
    assert.strictEqual(LocationContextConsentUpdate.make({ enabled: true }).disclosureAccepted, false);
  });

  it("derives an arbitrary for every exported model", () => {
    for (const schema of [
      PlanType,
      WebhookType,
      LocationContextConsentStatus,
      LocationContextConsent,
      LocationContextConsentUpdate,
      LocationContextConsentResponse,
      SubscriptionStatus,
      PlanLimits,
      ChatQuotaUnit,
      ChatUsageQuota,
      Subscription,
      PricingOption,
      SubscriptionPlan,
      TrialMetadata,
      PhoneCallQuota,
      TranscriptionAllowanceSnapshot,
      UserSubscriptionResponse,
      AvailableLanguage,
      AvailableLanguagesResponse,
    ]) {
      assert.strictEqual(Arbitrary.isArbitrary(Arbitrary.schema(schema)), true);
    }
  });
});
