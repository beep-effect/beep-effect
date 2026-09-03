import { createHash } from "node:crypto";
import { Sha256Hex } from "@beep/schema";
import { Order } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { BoxAdoptions, BoxDesiredState, BoxWebhookIntent } from "../BoxProvisioningIntent.ts";
import { BoxObservedState, BoxObservedWebhook } from "../BoxProvisioningObserved.ts";
import { BoxProvisioningPlan } from "../BoxProvisioningPlan.ts";
import type { BoxLogicalKey } from "../BoxProvisioningIntent.ts";

type CanonicalEntry = readonly [key: string, value: unknown];

const byKeyAscending = Order.mapInput(Order.String, ([key]: CanonicalEntry) => key);
const zeroDigest = Sha256Hex.make("0".repeat(64));
const sha256Equivalence = S.toEquivalence(Sha256Hex);

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

export const digestEncoded = (value: unknown): Sha256Hex => {
  const json = S.decodeUnknownSync(S.Json)(value);
  return Sha256Hex.make(createHash("sha256").update(canonicalJson(json), "utf8").digest("hex"));
};

export const digestText = (value: string): Sha256Hex =>
  Sha256Hex.make(createHash("sha256").update(value, "utf8").digest("hex"));

type EncodedDigest = {
  <A, I>(value: A): (schema: S.Codec<A, I>) => Sha256Hex;
  <A, I>(schema: S.Codec<A, I>, value: A): Sha256Hex;
};

export const encodedDigest: EncodedDigest = dual(
  2,
  <A, I>(schema: S.Codec<A, I>, value: A): Sha256Hex => digestEncoded(S.encodeSync(schema)(value))
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

export const boxDesiredStateDigest = (desired: BoxDesiredState): Sha256Hex =>
  encodedDigest(BoxDesiredState, canonicalBoxDesiredState(desired));

export const boxProvisioningPlanDigest = (plan: BoxProvisioningPlan): Sha256Hex =>
  encodedDigest(
    BoxProvisioningPlan,
    BoxProvisioningPlan.make({
      ...plan,
      planDigest: zeroDigest,
    })
  );

export const sealBoxProvisioningPlan = (plan: BoxProvisioningPlan): BoxProvisioningPlan =>
  BoxProvisioningPlan.make({
    ...plan,
    planDigest: boxProvisioningPlanDigest(plan),
  });

export const hasValidBoxProvisioningPlanDigest = (plan: BoxProvisioningPlan): boolean =>
  sha256Equivalence(plan.planDigest, boxProvisioningPlanDigest(plan));
