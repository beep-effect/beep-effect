import { Sha256Hex } from "@beep/schema";
import { Effect, Order } from "effect";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Hex from "effect/encoding/Hex";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { BoxAdoptions, BoxDesiredState, BoxWebhookIntent } from "../BoxProvisioningIntent.ts";
import { BoxObservedState, BoxObservedWebhook } from "../BoxProvisioningObserved.ts";
import { BoxProvisioningPlan } from "../BoxProvisioningPlan.ts";
import type * as PlatformError from "effect/PlatformError";
import type * as SchemaIssue from "effect/SchemaIssue";
import type { BoxLogicalKey } from "../BoxProvisioningIntent.ts";

const decodeUnknownJson = S.decodeUnknownEffect(S.Json);

type CanonicalEntry = readonly [key: string, value: unknown];

const byKeyAscending = Order.mapInput(Order.String, ([key]: CanonicalEntry) => key);
const zeroDigest = Sha256Hex.make("0".repeat(64));
const sha256Equivalence = S.toEquivalence(Sha256Hex);
const utf8 = new TextEncoder();

const canonicalJson = (value: unknown): string => {
  if (P.isNull(value) || P.isString(value) || P.isNumber(value) || P.isBoolean(value)) {
    return JSON.stringify(value);
  }
  if (A.isArray(value)) {
    return `[${A.join(A.map(value, canonicalJson), ",")}]`;
  }
  if (P.isObject(value)) {
    const entries = A.sort(R.toEntries(value), byKeyAscending);
    return `{${A.join(
      A.map(entries, ([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`),
      ","
    )}}`;
  }
  return "null";
};

/**
 * Crypto and schema failures raised while hashing canonical Box payloads.
 *
 * @category models
 * @since 0.0.0
 */
export type BoxCanonicalDigestError = PlatformError.PlatformError | SchemaIssue.Issue;

/**
 * SHA-256 hex digest of a UTF-8 string.
 *
 * @category hashing
 * @since 0.0.0
 */
export const digestText = Effect.fnUntraced(function* (value: string) {
  const crypto = yield* Crypto.Crypto;
  const bytes = yield* crypto.digest("SHA-256", utf8.encode(value));
  return Sha256Hex.make(Hex.encode(bytes));
});

/**
 * SHA-256 hex digest of the canonical JSON encoding of an unknown value.
 *
 * @category hashing
 * @since 0.0.0
 */
export const digestEncoded = Effect.fnUntraced(function* (value: unknown) {
  const json = yield* decodeUnknownJson(value);
  return yield* digestText(canonicalJson(json));
});

type EncodedDigest = {
  <A, I>(value: A): (schema: S.Codec<A, I>) => Effect.Effect<Sha256Hex, BoxCanonicalDigestError, Crypto.Crypto>;
  <A, I>(schema: S.Codec<A, I>, value: A): Effect.Effect<Sha256Hex, BoxCanonicalDigestError, Crypto.Crypto>;
};

/**
 * SHA-256 hex digest of a schema-encoded value.
 *
 * @category hashing
 * @since 0.0.0
 */
export const encodedDigest: EncodedDigest = dual(2, <A, I>(schema: S.Codec<A, I>, value: A) =>
  Effect.flatMap(S.encodeUnknownEffect(schema)(value), digestEncoded)
);

const byLogicalKey = <Resource extends { readonly logicalKey: BoxLogicalKey }>(
  values: ReadonlyArray<Resource>
): ReadonlyArray<Resource> => A.sortWith(values, (value) => value.logicalKey, Order.String);

export const canonicalWebhookIntent = (webhook: BoxWebhookIntent): BoxWebhookIntent =>
  BoxWebhookIntent.make({
    ...webhook,
    triggers: A.sort(webhook.triggers, Order.String),
  });

export const canonicalObservedWebhook = (webhook: BoxObservedWebhook): BoxObservedWebhook =>
  BoxObservedWebhook.make({
    ...webhook,
    triggers: A.sort(webhook.triggers, Order.String),
  });

export const canonicalBoxDesiredState = (desired: BoxDesiredState): BoxDesiredState =>
  BoxDesiredState.make({
    ...desired,
    adoptions: BoxAdoptions.make({
      ...desired.adoptions,
      entries: byLogicalKey(desired.adoptions.entries),
    }),
    folders: byLogicalKey(desired.folders),
    collaborations: byLogicalKey(desired.collaborations),
    webhooks: byLogicalKey(A.map(desired.webhooks, canonicalWebhookIntent)),
    metadata: byLogicalKey(desired.metadata),
    retention: byLogicalKey(desired.retention),
  });

export const canonicalBoxObservedState = (observed: BoxObservedState): BoxObservedState =>
  BoxObservedState.make({
    ...observed,
    folders: A.sortWith(observed.folders, (folder) => folder.providerId, Order.String),
    collaborations: A.sortWith(observed.collaborations, (collaboration) => collaboration.providerId, Order.String),
    webhooks: A.sortWith(
      A.map(observed.webhooks, canonicalObservedWebhook),
      (webhook) => webhook.providerId,
      Order.String
    ),
  });

export const boxDesiredStateDigest = (desired: BoxDesiredState) =>
  encodedDigest(BoxDesiredState, canonicalBoxDesiredState(desired));

export const boxProvisioningPlanDigest = (plan: BoxProvisioningPlan) =>
  encodedDigest(
    BoxProvisioningPlan,
    BoxProvisioningPlan.make({
      ...plan,
      planDigest: zeroDigest,
    })
  );

export const sealBoxProvisioningPlan = Effect.fnUntraced(function* (plan: BoxProvisioningPlan) {
  return BoxProvisioningPlan.make({
    ...plan,
    planDigest: yield* boxProvisioningPlanDigest(plan),
  });
});

export const hasValidBoxProvisioningPlanDigest = Effect.fnUntraced(function* (plan: BoxProvisioningPlan) {
  return sha256Equivalence(plan.planDigest, yield* boxProvisioningPlanDigest(plan));
});
