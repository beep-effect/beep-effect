/**
 * Redacted apply-receipt schemas for Box provisioning.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BoxProvisioningId } from "@beep/identity";
import { LiteralKit, SchemaUtils, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";
import { BoxProviderId } from "./BoxProvisioningObserved.ts";
import { BoxResourceKind } from "./BoxProvisioningPlan.ts";

const $I = $BoxProvisioningId.create("BoxProvisioningReceipt");

const outcomeFields = {
  actionKey: Sha256Hex,
  logicalKeyDigest: Sha256Hex,
  resourceKind: BoxResourceKind,
} satisfies S.Struct.Fields;

/**
 * Successful mutation outcome for one reviewed plan action.
 *
 * **Example** (Record an applied folder action)
 *
 * ```ts
 * import { BoxActionApplied } from "@beep/box-provisioning/BoxProvisioningReceipt"
 * import { BoxProviderId } from "@beep/box-provisioning/BoxProvisioningObserved"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const outcome = BoxActionApplied.make({
 *   actionKey: Sha256Hex.make("a".repeat(64)),
 *   logicalKeyDigest: Sha256Hex.make("b".repeat(64)),
 *   providerId: BoxProviderId.make("100"),
 *   resourceKind: "folder"
 * })
 * console.log(outcome.providerId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxActionApplied extends S.TaggedClass<BoxActionApplied>($I`BoxActionApplied`)(
  "Applied",
  { ...outcomeFields, providerId: BoxProviderId },
  $I.annote("BoxActionApplied", {
    description: "Successful Box mutation outcome containing only provider and digest identifiers.",
  })
) {}

/**
 * No-op outcome for an action that already matched live state.
 *
 * **Example** (Record a skipped no-op)
 *
 * ```ts
 * import { BoxActionSkipped } from "@beep/box-provisioning/BoxProvisioningReceipt"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const outcome = BoxActionSkipped.make({
 *   actionKey: Sha256Hex.make("a".repeat(64)),
 *   logicalKeyDigest: Sha256Hex.make("b".repeat(64)),
 *   reason: "noop",
 *   resourceKind: "folder"
 * })
 * console.log(outcome.reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxActionSkipped extends S.TaggedClass<BoxActionSkipped>($I`BoxActionSkipped`)(
  "Skipped",
  { ...outcomeFields, reason: S.Literal("noop") },
  $I.annote("BoxActionSkipped", { description: "Receipt outcome for a reviewed no-op plan action." })
) {}

/**
 * Blocked outcome retained in the apply receipt without attempting mutation.
 *
 * **Example** (Record an entitlement block)
 *
 * ```ts
 * import { BoxActionBlocked } from "@beep/box-provisioning/BoxProvisioningReceipt"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const outcome = BoxActionBlocked.make({
 *   actionKey: Sha256Hex.make("a".repeat(64)),
 *   logicalKeyDigest: Sha256Hex.make("b".repeat(64)),
 *   reason: "BlockedByEntitlement",
 *   resourceKind: "metadata"
 * })
 * console.log(outcome.reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxActionBlocked extends S.TaggedClass<BoxActionBlocked>($I`BoxActionBlocked`)(
  "Blocked",
  {
    ...outcomeFields,
    reason: LiteralKit(["BlockedByEntitlement", "BlockedByAmbiguity", "BlockedByPolicy"]),
  },
  $I.annote("BoxActionBlocked", {
    description: "Receipt outcome proving a blocked action was not sent to Box.",
  })
) {}

/**
 * Tagged outcome for each action in a reviewed Box plan.
 *
 * **Example** (Inspect the outcome schema)
 *
 * ```ts
 * import { BoxApplyOutcome } from "@beep/box-provisioning/BoxProvisioningReceipt"
 *
 * console.log(BoxApplyOutcome.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BoxApplyOutcome = S.Union([BoxActionApplied, BoxActionSkipped, BoxActionBlocked]).pipe(
  $I.annoteSchema("BoxApplyOutcome", { description: "Applied, skipped, or blocked Box plan-action outcome." })
);

/**
 * Runtime type for {@link BoxApplyOutcome}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxApplyOutcome = typeof BoxApplyOutcome.Type;

/**
 * Evidence that one exact reviewed Box plan was applied or skipped action by action.
 *
 * **Example** (Create an empty receipt)
 *
 * ```ts
 * import { BoxApplyReceipt } from "@beep/box-provisioning/BoxProvisioningReceipt"
 * import { Sha256Hex } from "@beep/schema"
 * import { DateTime } from "effect"
 *
 * const receipt = BoxApplyReceipt.make({
 *   appliedAt: DateTime.makeUnsafe("2026-08-30T00:00:00.000Z"),
 *   outcomes: [],
 *   planDigest: Sha256Hex.make("a".repeat(64))
 * })
 * console.log(receipt.outcomes.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxApplyReceipt extends S.Class<BoxApplyReceipt>($I`BoxApplyReceipt`)(
  {
    version: S.Literal("box-provisioning-receipt/v1").pipe(
      SchemaUtils.withConstantDefault("box-provisioning-receipt/v1")
    ),
    planDigest: Sha256Hex,
    appliedAt: S.DateTimeUtc,
    outcomes: S.Array(BoxApplyOutcome),
  },
  $I.annote("BoxApplyReceipt", {
    description: "Redacted schema-validated evidence for one guarded Box plan application.",
  })
) {}
