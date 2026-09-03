/**
 * Redacted, deterministic Box provisioning plan schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BoxProvisioningId } from "@beep/identity";
import { LiteralKit, SchemaUtils, Sha256Hex } from "@beep/schema";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { BoxPlanName, BoxSourceRevision } from "./BoxProvisioningIntent.ts";
import { BoxProviderId, BoxProviderRevision } from "./BoxProvisioningObserved.ts";

const $I = $BoxProvisioningId.create("BoxProvisioningPlan");

/**
 * Box resource families represented in a provisioning plan.
 *
 * **Example** (Check a folder resource kind)
 *
 * ```ts
 * import { BoxResourceKind } from "@beep/box-provisioning/BoxProvisioningPlan"
 *
 * console.log(BoxResourceKind.is.folder("folder"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BoxResourceKind = LiteralKit(["folder", "collaboration", "webhook", "metadata", "retention"]).pipe(
  $I.annoteSchema("BoxResourceKind", {
    description: "Box resource family planned by the desired-state reconciler.",
  })
);

/**
 * Runtime type for {@link BoxResourceKind}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxResourceKind = typeof BoxResourceKind.Type;

/**
 * Fresh-state expectation rechecked immediately before mutation.
 *
 * **Example** (Create an absence precondition)
 *
 * ```ts
 * import { BoxActionPrecondition } from "@beep/box-provisioning/BoxProvisioningPlan"
 * import * as O from "effect/Option"
 *
 * const precondition = BoxActionPrecondition.make({
 *   etag: O.none(),
 *   providerId: O.none(),
 *   state: "absent"
 * })
 * console.log(precondition.state)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxActionPrecondition extends S.Class<BoxActionPrecondition>($I`BoxActionPrecondition`)(
  {
    state: LiteralKit(["absent", "present", "unchanged"]),
    providerId: S.OptionFromOptionalKey(BoxProviderId).pipe(SchemaUtils.withNoneDefault),
    etag: S.OptionFromOptionalKey(BoxProviderRevision).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("BoxActionPrecondition", {
    description: "Redacted resource presence and identity expected when an action is applied.",
  })
) {}

/**
 * Plan blocker raised when the current subscription does not admit a resource.
 *
 * **Example** (Block metadata by entitlement)
 *
 * ```ts
 * import { BoxBlockedByEntitlement } from "@beep/box-provisioning/BoxProvisioningPlan"
 *
 * const reason = BoxBlockedByEntitlement.make({ entitlement: "metadata", planName: "Business" })
 * console.log(reason.entitlement)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxBlockedByEntitlement extends S.TaggedClass<BoxBlockedByEntitlement>($I`BoxBlockedByEntitlement`)(
  "BlockedByEntitlement",
  {
    entitlement: LiteralKit(["metadata", "retention"]),
    planName: BoxPlanName,
  },
  $I.annote("BoxBlockedByEntitlement", {
    description: "Plan blocker identifying a Box subscription feature unavailable to the tenant.",
  })
) {}

/**
 * Plan blocker raised when live resources cannot be matched unambiguously.
 *
 * **Example** (Block duplicate folders)
 *
 * ```ts
 * import { BoxBlockedByAmbiguity } from "@beep/box-provisioning/BoxProvisioningPlan"
 *
 * const reason = BoxBlockedByAmbiguity.make({ candidateCount: 2, matchKind: "provider-equivalent-name-sibling" })
 * console.log(reason.candidateCount)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxBlockedByAmbiguity extends S.TaggedClass<BoxBlockedByAmbiguity>($I`BoxBlockedByAmbiguity`)(
  "BlockedByAmbiguity",
  {
    matchKind: LiteralKit(["provider-equivalent-name-sibling", "folder-principal", "target-callback"]),
    candidateCount: S.Natural.check(S.isGreaterThan(1)),
  },
  $I.annote("BoxBlockedByAmbiguity", {
    description: "Plan blocker for a live match with more than one candidate.",
  })
) {}

/**
 * Plan blocker for a mutation intentionally unsupported by reconciler v1.
 *
 * **Example** (Block deletion)
 *
 * ```ts
 * import { BoxBlockedByPolicy } from "@beep/box-provisioning/BoxProvisioningPlan"
 *
 * const reason = BoxBlockedByPolicy.make({ policy: "foreign-name-collision" })
 * console.log(reason.policy)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxBlockedByPolicy extends S.TaggedClass<BoxBlockedByPolicy>($I`BoxBlockedByPolicy`)(
  "BlockedByPolicy",
  {
    policy: LiteralKit([
      "foreign-name-collision",
      "blocked-folder-dependency",
      "metadata-mutation-out-of-scope-v1",
      "retention-mutation-out-of-scope-v1",
      "metadata-entitlement-assertion-conflicts-with-live-discovery",
      "retention-entitlement-assertion-conflicts-with-live-discovery",
      "metadata-discovery-permission-denied",
      "retention-discovery-permission-denied",
    ]),
  },
  $I.annote("BoxBlockedByPolicy", {
    description: "Plan blocker identifying a reconciler safety policy that forbids a mutation.",
  })
) {}

/**
 * Reasons a Box plan action cannot be applied.
 *
 * **Example** (Inspect the blocker schema)
 *
 * ```ts
 * import { BoxBlockReason } from "@beep/box-provisioning/BoxProvisioningPlan"
 *
 * console.log(BoxBlockReason.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BoxBlockReason = S.Union([BoxBlockedByEntitlement, BoxBlockedByAmbiguity, BoxBlockedByPolicy]).pipe(
  $I.annoteSchema("BoxBlockReason", {
    description: "Entitlement, ambiguity, or safety-policy reason preventing a Box action.",
  })
);

/**
 * Runtime type for {@link BoxBlockReason}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxBlockReason = typeof BoxBlockReason.Type;

const commonActionFields = {
  actionKey: Sha256Hex,
  logicalKeyDigest: Sha256Hex,
  resourceKind: BoxResourceKind,
  dependencies: S.Array(Sha256Hex),
  destructive: S.Boolean,
  beforeDigest: S.OptionFromOptionalKey(Sha256Hex).pipe(SchemaUtils.withNoneDefault),
  afterDigest: S.OptionFromOptionalKey(Sha256Hex).pipe(SchemaUtils.withNoneDefault),
  precondition: BoxActionPrecondition,
} satisfies S.Struct.Fields;

const actionExampleFields = {
  actionKey: Sha256Hex.make("a".repeat(64)),
  afterDigest: O.some(Sha256Hex.make("b".repeat(64))),
  beforeDigest: O.none<Sha256Hex>(),
  dependencies: [],
  destructive: false,
  logicalKeyDigest: Sha256Hex.make("c".repeat(64)),
  precondition: BoxActionPrecondition.make({ etag: O.none(), providerId: O.none(), state: "absent" }),
  resourceKind: "folder" as const,
};

/**
 * Plan action proving a desired Box resource already matches live state.
 *
 * **Example** (Create a no-op action)
 *
 * ```ts
 * import { BoxNoopAction, makeExampleActionFields } from "@beep/box-provisioning/BoxProvisioningPlan"
 *
 * const action = BoxNoopAction.make(makeExampleActionFields())
 * console.log(action.destructive)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxNoopAction extends S.TaggedClass<BoxNoopAction>($I`BoxNoopAction`)(
  "Noop",
  commonActionFields,
  $I.annote("BoxNoopAction", { description: "No-op plan action for a desired resource already in sync." })
) {}

/**
 * Plan action creating one missing Box resource.
 *
 * **Example** (Create a create action)
 *
 * ```ts
 * import { BoxCreateAction, makeExampleActionFields } from "@beep/box-provisioning/BoxProvisioningPlan"
 *
 * const action = BoxCreateAction.make(makeExampleActionFields())
 * console.log(action.resourceKind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxCreateAction extends S.TaggedClass<BoxCreateAction>($I`BoxCreateAction`)(
  "Create",
  commonActionFields,
  $I.annote("BoxCreateAction", { description: "Create plan action for one missing desired Box resource." })
) {}

/**
 * Plan action updating an owned Box resource in place.
 *
 * **Example** (Create an update action)
 *
 * ```ts
 * import { BoxUpdateAction, makeExampleActionFields } from "@beep/box-provisioning/BoxProvisioningPlan"
 *
 * const action = BoxUpdateAction.make(makeExampleActionFields())
 * console.log(action.precondition.state)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxUpdateAction extends S.TaggedClass<BoxUpdateAction>($I`BoxUpdateAction`)(
  "Update",
  commonActionFields,
  $I.annote("BoxUpdateAction", { description: "In-place update plan action for an owned Box resource." })
) {}

/**
 * Plan action replacing a Box resource after explicit destructive approval.
 *
 * **Example** (Create a replace action)
 *
 * ```ts
 * import { BoxReplaceAction, makeExampleActionFields } from "@beep/box-provisioning/BoxProvisioningPlan"
 *
 * const action = BoxReplaceAction.make({ ...makeExampleActionFields(), destructive: true })
 * console.log(action.destructive)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxReplaceAction extends S.TaggedClass<BoxReplaceAction>($I`BoxReplaceAction`)(
  "Replace",
  commonActionFields,
  $I.annote("BoxReplaceAction", { description: "Explicitly destructive replacement plan action." })
) {}

/**
 * Plan action deleting an owned Box resource after explicit approval.
 *
 * **Example** (Create a delete action)
 *
 * ```ts
 * import { BoxDeleteAction, makeExampleActionFields } from "@beep/box-provisioning/BoxProvisioningPlan"
 *
 * const action = BoxDeleteAction.make({ ...makeExampleActionFields(), destructive: true })
 * console.log(action.destructive)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxDeleteAction extends S.TaggedClass<BoxDeleteAction>($I`BoxDeleteAction`)(
  "Delete",
  commonActionFields,
  $I.annote("BoxDeleteAction", { description: "Explicitly destructive delete plan action." })
) {}

/**
 * Plan action retained as visible evidence that a desired resource is blocked.
 *
 * **Example** (Create an entitlement-blocked action)
 *
 * ```ts
 * import {
 *   BoxBlockedAction,
 *   BoxBlockedByEntitlement,
 *   makeExampleActionFields
 * } from "@beep/box-provisioning/BoxProvisioningPlan"
 *
 * const action = BoxBlockedAction.make({
 *   ...makeExampleActionFields(),
 *   reason: BoxBlockedByEntitlement.make({ entitlement: "metadata", planName: "Business" })
 * })
 * console.log(action.reason._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxBlockedAction extends S.TaggedClass<BoxBlockedAction>($I`BoxBlockedAction`)(
  "Blocked",
  { ...commonActionFields, reason: BoxBlockReason },
  $I.annote("BoxBlockedAction", { description: "Visible blocked plan action with a typed technical reason." })
) {}

/**
 * Tagged union of every Box plan action class.
 *
 * **Example** (Inspect the action schema)
 *
 * ```ts
 * import { BoxPlanAction } from "@beep/box-provisioning/BoxProvisioningPlan"
 *
 * console.log(BoxPlanAction.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BoxPlanAction = S.Union([
  BoxNoopAction,
  BoxCreateAction,
  BoxUpdateAction,
  BoxReplaceAction,
  BoxDeleteAction,
  BoxBlockedAction,
]).pipe($I.annoteSchema("BoxPlanAction", { description: "Tagged Box provisioning plan action." }));

/**
 * Runtime type for {@link BoxPlanAction}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxPlanAction = typeof BoxPlanAction.Type;

/**
 * Redacted record of a live Box resource outside the desired-state graph.
 *
 * **Example** (Record a foreign folder)
 *
 * ```ts
 * import { BoxForeignResource } from "@beep/box-provisioning/BoxProvisioningPlan"
 * import { BoxProviderId } from "@beep/box-provisioning/BoxProvisioningObserved"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const foreign = BoxForeignResource.make({
 *   identityDigest: Sha256Hex.make("d".repeat(64)),
 *   providerId: BoxProviderId.make("999"),
 *   resourceKind: "folder"
 * })
 * console.log(foreign.resourceKind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxForeignResource extends S.Class<BoxForeignResource>($I`BoxForeignResource`)(
  {
    resourceKind: BoxResourceKind,
    providerId: BoxProviderId,
    identityDigest: Sha256Hex,
  },
  $I.annote("BoxForeignResource", {
    description: "Foreign live resource represented without its confidential name or callback.",
  })
) {}

/**
 * Schema-validated deterministic dry-run artifact for one Box inventory snapshot.
 *
 * **Details**
 *
 * Logical keys, folder names, principals, and webhook addresses are represented
 * only by SHA-256 digests. A byte-identical desired and observed state produces
 * a byte-identical plan. External-collaborator counts are declarations made by
 * the intent author; inventory does not independently verify that billing
 * classification. The create count is the declared-external subset whose
 * reviewed action is `Create`.
 *
 * **Example** (Inspect the plan schema)
 *
 * ```ts
 * import { BoxProvisioningPlan } from "@beep/box-provisioning/BoxProvisioningPlan"
 *
 * console.log(BoxProvisioningPlan.ast)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxProvisioningPlan extends S.Class<BoxProvisioningPlan>($I`BoxProvisioningPlan`)(
  {
    version: S.Literal("box-provisioning-plan/v1").pipe(SchemaUtils.withConstantDefault("box-provisioning-plan/v1")),
    sourceRevision: BoxSourceRevision,
    expectedEnterpriseId: BoxProviderId,
    subjectId: BoxProviderId,
    rootFolderId: BoxProviderId,
    desiredStateDigest: Sha256Hex,
    liveStateDigest: Sha256Hex,
    planDigest: Sha256Hex,
    actions: S.Array(BoxPlanAction),
    foreignResources: S.Array(BoxForeignResource),
    blockerCount: S.Natural,
    destructiveCount: S.Natural,
    declaredExternalCollaboratorCount: S.Natural,
    declaredExternalCollaboratorCreateCount: S.Natural,
  },
  $I.annote("BoxProvisioningPlan", {
    description: "Redacted deterministic dry-run plan sealed by desired, live-state, and plan digests.",
  })
) {}

/**
 * Produce non-sensitive fixture fields shared by plan-action examples.
 *
 * **Example** (Read example action fields)
 *
 * ```ts
 * import { makeExampleActionFields } from "@beep/box-provisioning/BoxProvisioningPlan"
 *
 * console.log(makeExampleActionFields().resourceKind)
 * ```
 *
 * @returns Fresh fixture fields suitable for constructing any action class in documentation.
 * @category fixtures
 * @since 0.0.0
 */
export const makeExampleActionFields = (): typeof actionExampleFields => actionExampleFields;
