/**
 * Redacted apply-receipt schemas for Box provisioning.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BoxProvisioningId } from "@beep/identity";
import { LiteralKit, SchemaUtils, Sha256Hex } from "@beep/schema";
import { Equal, HashMap } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { BoxAdoption, BoxAdoptions, mergeBoxAdoptions } from "./BoxProvisioningIntent.ts";
import { BoxProviderId } from "./BoxProvisioningObserved.ts";
import { BoxProvisioningPlan, BoxResourceKind } from "./BoxProvisioningPlan.ts";
import { digestText } from "./internal/canonical.ts";
import type { BoxDesiredState } from "./BoxProvisioningIntent.ts";

const $I = $BoxProvisioningId.create("BoxProvisioningReceipt");

const outcomeFields = {
  actionKey: Sha256Hex,
  logicalKeyDigest: Sha256Hex,
  resourceKind: BoxResourceKind,
} satisfies S.Struct.Fields;

/**
 * Opaque identifier correlating every journal entry emitted by one apply invocation.
 *
 * **Example** (Create an apply attempt identifier)
 *
 * ```ts
 * import { BoxApplyAttemptId } from "@beep/box-provisioning/BoxProvisioningReceipt"
 *
 * console.log(BoxApplyAttemptId.make("attempt-12345678"))
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const BoxApplyAttemptId = S.String.check(
  S.isPattern(/^[A-Za-z0-9-]{8,64}$/u, {
    identifier: $I`BoxApplyAttemptIdCheck`,
    title: "Box Apply Attempt Identifier",
    description: "An opaque apply-attempt identifier containing 8 to 64 safe identifier characters.",
    message: "Box apply attempt identifiers must match ^[A-Za-z0-9-]{8,64}$",
  })
).pipe(
  S.brand("BoxApplyAttemptId"),
  $I.annoteSchema("BoxApplyAttemptId", {
    description: "Bounded opaque identifier shared by every journal entry from one apply invocation.",
  })
);

/**
 * Runtime type for {@link BoxApplyAttemptId}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxApplyAttemptId = typeof BoxApplyAttemptId.Type;

const journalFields = {
  attemptId: BoxApplyAttemptId,
  planDigest: Sha256Hex,
  sequence: S.Natural,
  actionKey: Sha256Hex,
  logicalKeyDigest: Sha256Hex,
  resourceKind: BoxResourceKind,
  providerId: S.OptionFromOptionalKey(BoxProviderId).pipe(SchemaUtils.withNoneDefault),
} satisfies S.Struct.Fields;

/**
 * Journal record written durably before a reviewed provider mutation starts.
 *
 * **Example** (Record a started mutation)
 *
 * ```ts
 * import {
 *   BoxApplyAttemptId,
 *   BoxApplyJournalStarted
 * } from "@beep/box-provisioning/BoxProvisioningReceipt"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import * as O from "effect/Option"
 *
 * const entry = BoxApplyJournalStarted.make({
 *   actionKey: Sha256Hex.make("a".repeat(64)),
 *   attemptId: BoxApplyAttemptId.make("attempt-12345678"),
 *   logicalKeyDigest: Sha256Hex.make("b".repeat(64)),
 *   planDigest: Sha256Hex.make("c".repeat(64)),
 *   providerId: O.none(),
 *   resourceKind: "folder",
 *   sequence: 0
 * })
 * console.log(entry.phase)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxApplyJournalStarted extends S.Class<BoxApplyJournalStarted>($I`BoxApplyJournalStarted`)(
  { ...journalFields, phase: S.tag("Started") },
  $I.annote("BoxApplyJournalStarted", {
    description: "Sanitized apply-journal entry persisted before one provider mutation is dispatched.",
  })
) {}

/**
 * Journal record written after a reviewed provider mutation succeeds.
 *
 * **Details**
 *
 * Applied folder-create entries retain the created folder's parent provider id
 * so an interrupted apply can reconstruct durable ownership without another
 * provider mutation.
 *
 * **Example** (Inspect the applied journal schema)
 *
 * ```ts
 * import { BoxApplyJournalApplied } from "@beep/box-provisioning/BoxProvisioningReceipt"
 *
 * console.log(BoxApplyJournalApplied.ast)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxApplyJournalApplied extends S.Class<BoxApplyJournalApplied>($I`BoxApplyJournalApplied`)(
  {
    ...journalFields,
    phase: S.tag("Applied"),
    parentProviderId: S.OptionFromOptionalKey(BoxProviderId).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("BoxApplyJournalApplied", {
    description: "Sanitized apply-journal entry persisted after one provider mutation succeeds.",
  })
) {}

/**
 * Journal record written after a reviewed provider mutation fails.
 *
 * **Example** (Inspect the failed journal schema)
 *
 * ```ts
 * import { BoxApplyJournalFailed } from "@beep/box-provisioning/BoxProvisioningReceipt"
 *
 * console.log(BoxApplyJournalFailed.ast)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxApplyJournalFailed extends S.Class<BoxApplyJournalFailed>($I`BoxApplyJournalFailed`)(
  {
    ...journalFields,
    phase: S.tag("Failed"),
    errorTag: LiteralKit(["BoxError", "BoxProvisioningInvariantError", "UnknownFailure"]),
  },
  $I.annote("BoxApplyJournalFailed", {
    description: "Sanitized apply-journal entry persisted after one provider mutation fails.",
  })
) {}

/**
 * Append-only sanitized evidence emitted around each Box mutation.
 *
 * **Example** (Inspect the journal-entry schema)
 *
 * ```ts
 * import { BoxApplyJournalEntry } from "@beep/box-provisioning/BoxProvisioningReceipt"
 *
 * console.log(BoxApplyJournalEntry.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BoxApplyJournalEntry = S.Union([
  BoxApplyJournalStarted,
  BoxApplyJournalApplied,
  BoxApplyJournalFailed,
]).pipe(
  $I.annoteSchema("BoxApplyJournalEntry", {
    description: "Started, applied, or failed sanitized evidence for one reviewed Box mutation.",
  })
);

/**
 * Runtime type for {@link BoxApplyJournalEntry}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxApplyJournalEntry = typeof BoxApplyJournalEntry.Type;

/**
 * Recovers durable folder ownership from decoded desired state and apply-journal evidence.
 *
 * **Details**
 *
 * Journal entries are partitioned by plan digest and attempt id. Only the most
 * recently started attempt for each plan contributes successful folder creates;
 * older retries cannot overwrite newer evidence. Matching uses the same
 * canonical logical-key digest as planning, and the returned entries are unique
 * and stably ordered by logical key.
 *
 * **Example** (Preserve an empty ownership set)
 *
 * ```ts
 * import {
 *   BoxAdoptions,
 *   BoxDesiredState,
 *   BoxEntitlements,
 *   BoxSourceRevision,
 *   recoverBoxAdoptions
 * } from "@beep/box-provisioning"
 * import { BoxProviderId } from "@beep/box-provisioning/BoxProvisioningObserved"
 * import * as O from "effect/Option"
 *
 * const desired = BoxDesiredState.make({
 *   adoptions: BoxAdoptions.make({ entries: [] }),
 *   collaborations: [],
 *   entitlements: BoxEntitlements.make({
 *     externalCollaboratorsRequirePaidSeats: true,
 *     metadata: "unavailable",
 *     planName: "Business",
 *     retention: "unavailable",
 *     signCustomIntegrationAnnualAllowance: O.none()
 *   }),
 *   expectedEnterpriseId: BoxProviderId.make("enterprise-id"),
 *   expectedSubjectId: BoxProviderId.make("service-account-id"),
 *   folders: [],
 *   metadata: [],
 *   retention: [],
 *   rootFolderId: BoxProviderId.make("0"),
 *   sourceRevision: BoxSourceRevision.make("intent-1"),
 *   webhooks: []
 * })
 * console.log(recoverBoxAdoptions(desired, []).entries.length)
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const recoverBoxAdoptions: {
  (journalEntries: ReadonlyArray<BoxApplyJournalEntry>): (desired: BoxDesiredState) => BoxAdoptions;
  (desired: BoxDesiredState, journalEntries: ReadonlyArray<BoxApplyJournalEntry>): BoxAdoptions;
} = dual(2, (desired: BoxDesiredState, journalEntries: ReadonlyArray<BoxApplyJournalEntry>): BoxAdoptions => {
  const latestAttemptByPlan = A.reduce(
    journalEntries,
    HashMap.empty<Sha256Hex, BoxApplyAttemptId>(),
    (attempts, entry) =>
      entry.phase === "Started" && Equal.equals(entry.sequence, 0)
        ? HashMap.set(attempts, entry.planDigest, entry.attemptId)
        : attempts
  );
  const recovered = A.getSomes(
    A.map(journalEntries, (entry) => {
      if (
        entry.phase !== "Applied" ||
        entry.resourceKind !== "folder" ||
        !O.exists(HashMap.get(latestAttemptByPlan, entry.planDigest), (attemptId) =>
          Equal.equals(attemptId, entry.attemptId)
        )
      ) {
        return O.none<BoxAdoption>();
      }
      return O.flatMap(
        O.all({ expectedParentProviderId: entry.parentProviderId, expectedProviderId: entry.providerId }),
        ({ expectedParentProviderId, expectedProviderId }) =>
          O.map(
            A.findFirst(desired.folders, (folder) =>
              Equal.equals(digestText(folder.logicalKey), entry.logicalKeyDigest)
            ),
            (folder) =>
              BoxAdoption.make({
                expectedParentProviderId,
                expectedProviderId,
                logicalKey: folder.logicalKey,
                resourceKind: "folder",
              })
          )
      );
    })
  );
  return mergeBoxAdoptions(desired.adoptions, recovered);
});

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

/**
 * Strict post-apply proof accepted by the guarded orchestration boundary.
 *
 * **Example** (Record a successful strict verdict)
 *
 * ```ts
 * import { BoxPostApplyVerdict } from "@beep/box-provisioning/BoxProvisioningReceipt"
 *
 * const verdict = BoxPostApplyVerdict.make({
 *   allOtherActionsNoop: true,
 *   entitlementBlockerCount: 2,
 *   entitlementBlockersPreserved: true
 * })
 * console.log(verdict.allOtherActionsNoop)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxPostApplyVerdict extends S.Class<BoxPostApplyVerdict>($I`BoxPostApplyVerdict`)(
  {
    entitlementBlockerCount: S.Natural,
    entitlementBlockersPreserved: S.Literal(true),
    allOtherActionsNoop: S.Literal(true),
  },
  $I.annote("BoxPostApplyVerdict", {
    description: "Proof that entitlement blockers were preserved and every other post-apply action is Noop.",
  })
) {}

/**
 * Durable ownership bindings, receipt, strict verdict, and fresh plan returned by the public write workflow.
 *
 * **Example** (Inspect the guarded apply-result schema)
 *
 * ```ts
 * import { BoxReviewedApplyResult } from "@beep/box-provisioning/BoxProvisioningReceipt"
 *
 * console.log(BoxReviewedApplyResult.ast)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxReviewedApplyResult extends S.Class<BoxReviewedApplyResult>($I`BoxReviewedApplyResult`)(
  {
    adoptions: BoxAdoptions,
    receipt: BoxApplyReceipt,
    postApplyPlan: BoxProvisioningPlan,
    verdict: BoxPostApplyVerdict,
  },
  $I.annote("BoxReviewedApplyResult", {
    description: "Guarded apply result carrying durable adoptions, receipt, and strict reconciliation verdict.",
  })
) {}
