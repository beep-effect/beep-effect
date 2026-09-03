/**
 * Normalized live Box inventory schemas consumed by the pure planner.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BoxProvisioningId } from "@beep/identity";
import { HttpsUrl, LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $BoxProvisioningId.create("BoxProvisioningObserved");

/**
 * Opaque Box provider identifier returned by the live SDK.
 *
 * **Example** (Create a provider id)
 *
 * ```ts
 * import { BoxProviderId } from "@beep/box-provisioning/BoxProvisioningObserved"
 *
 * console.log(BoxProviderId.make("12345"))
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const BoxProviderId = S.String.check(
  S.isPattern(/^[A-Za-z0-9._-]{1,128}$/u, {
    identifier: $I`BoxProviderIdCheck`,
    title: "Box Provider Identifier",
    description: "An opaque provider identifier containing at most 128 safe identifier characters.",
    message: "Box provider identifiers must match ^[A-Za-z0-9._-]{1,128}$",
  })
).pipe(S.brand("BoxProviderId"), $I.annoteSchema("BoxProviderId", { description: "Opaque Box resource identifier." }));

/**
 * Runtime type for {@link BoxProviderId}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxProviderId = typeof BoxProviderId.Type;

/**
 * Bounded opaque provider revision used for reviewed identity preconditions.
 *
 * **Example** (Create a provider revision)
 *
 * ```ts
 * import { BoxProviderRevision } from "@beep/box-provisioning/BoxProvisioningObserved"
 *
 * console.log(BoxProviderRevision.make("etag-1"))
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const BoxProviderRevision = S.String.check(
  S.isPattern(/^[A-Za-z0-9._-]{1,128}$/u, {
    identifier: $I`BoxProviderRevisionCheck`,
    title: "Box Provider Revision",
    description: "An opaque provider revision containing at most 128 safe identifier characters.",
    message: "Box provider revisions must match ^[A-Za-z0-9._-]{1,128}$",
  })
).pipe(
  S.brand("BoxProviderRevision"),
  $I.annoteSchema("BoxProviderRevision", {
    description: "Bounded opaque Box revision safe for redacted plan preconditions.",
  })
);

/**
 * Runtime type for {@link BoxProviderRevision}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxProviderRevision = typeof BoxProviderRevision.Type;

/**
 * Resource families probed by a Box inventory run.
 *
 * **Example** (Check the metadata discovery kind)
 *
 * ```ts
 * import { BoxDiscoveryKind } from "@beep/box-provisioning/BoxProvisioningObserved"
 *
 * console.log(BoxDiscoveryKind.is.metadata("metadata"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BoxDiscoveryKind = LiteralKit(["metadata", "retention", "signRequests", "signTemplates"]).pipe(
  $I.annoteSchema("BoxDiscoveryKind", {
    description: "Box capability family whose read surface was inventoried.",
  })
);

/**
 * Runtime type for {@link BoxDiscoveryKind}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxDiscoveryKind = typeof BoxDiscoveryKind.Type;

/**
 * Successful read-only discovery of one Box capability family.
 *
 * **Example** (Record available metadata discovery)
 *
 * ```ts
 * import { BoxDiscoveryAvailable } from "@beep/box-provisioning/BoxProvisioningObserved"
 *
 * const discovery = BoxDiscoveryAvailable.make({ count: 0, kind: "metadata" })
 * console.log(discovery.count)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxDiscoveryAvailable extends S.TaggedClass<BoxDiscoveryAvailable>($I`BoxDiscoveryAvailable`)(
  "Available",
  {
    kind: BoxDiscoveryKind,
    count: S.Natural,
  },
  $I.annote("BoxDiscoveryAvailable", {
    description: "Successful read-only inventory result for a Box capability family.",
  })
) {}

/**
 * Entitlement-denied read of one Box capability family.
 *
 * **Example** (Record blocked retention discovery)
 *
 * ```ts
 * import { BoxDiscoveryBlocked } from "@beep/box-provisioning/BoxProvisioningObserved"
 *
 * const discovery = BoxDiscoveryBlocked.make({ kind: "retention", status: 403 })
 * console.log(discovery.status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxDiscoveryBlocked extends S.TaggedClass<BoxDiscoveryBlocked>($I`BoxDiscoveryBlocked`)(
  "BlockedByEntitlement",
  {
    kind: BoxDiscoveryKind,
    status: S.Int.check(S.isBetween({ minimum: 400, maximum: 499 })),
  },
  $I.annote("BoxDiscoveryBlocked", {
    description: "Read-only inventory result denied by the current Box entitlement posture.",
  })
) {}

/**
 * Permission-denied read of one Box capability family.
 *
 * **Example** (Record a missing-scope discovery)
 *
 * ```ts
 * import { BoxDiscoveryPermissionBlocked } from "@beep/box-provisioning/BoxProvisioningObserved"
 * import * as O from "effect/Option"
 *
 * const discovery = BoxDiscoveryPermissionBlocked.make({
 *   code: O.some("insufficient_scope"),
 *   kind: "metadata",
 *   status: 403
 * })
 * console.log(discovery.code)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxDiscoveryPermissionBlocked extends S.TaggedClass<BoxDiscoveryPermissionBlocked>(
  $I`BoxDiscoveryPermissionBlocked`
)(
  "BlockedByPermission",
  {
    kind: BoxDiscoveryKind,
    status: S.Int.check(S.isBetween({ minimum: 400, maximum: 499 })),
    code: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("BoxDiscoveryPermissionBlocked", {
    description: "Read-only inventory result denied by Box permissions or application scopes.",
  })
) {}

/**
 * Result of reading one entitlement-sensitive Box family.
 *
 * **Example** (Inspect the discovery schema)
 *
 * ```ts
 * import { BoxDiscovery } from "@beep/box-provisioning/BoxProvisioningObserved"
 *
 * console.log(BoxDiscovery.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BoxDiscovery = S.Union([BoxDiscoveryAvailable, BoxDiscoveryBlocked, BoxDiscoveryPermissionBlocked]).pipe(
  $I.annoteSchema("BoxDiscovery", {
    description: "Available, entitlement-blocked, or permission-blocked Box capability discovery.",
  })
);

/**
 * Runtime type for {@link BoxDiscovery}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxDiscovery = typeof BoxDiscovery.Type;

/**
 * Normalized Box folder observed beneath the inventory anchor.
 *
 * **Example** (Record an observed folder)
 *
 * ```ts
 * import { BoxObservedFolder, BoxProviderId } from "@beep/box-provisioning/BoxProvisioningObserved"
 * import * as O from "effect/Option"
 *
 * const folder = BoxObservedFolder.make({
 *   etag: O.none(),
 *   name: "Workspace",
 *   parentProviderId: O.some(BoxProviderId.make("0")),
 *   providerId: BoxProviderId.make("100")
 * })
 * console.log(folder.providerId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxObservedFolder extends S.Class<BoxObservedFolder>($I`BoxObservedFolder`)(
  {
    providerId: BoxProviderId,
    parentProviderId: S.OptionFromOptionalKey(BoxProviderId).pipe(SchemaUtils.withNoneDefault),
    name: S.NonEmptyString,
    etag: S.OptionFromOptionalKey(BoxProviderRevision).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("BoxObservedFolder", {
    description: "Normalized folder identity, parent, exact name, and optional etag from Box.",
  })
) {}

/**
 * Normalized collaboration observed on a Box folder.
 *
 * **Gotchas**
 *
 * The principal remains secure-runner state and must never be serialized into
 * a public plan or receipt.
 *
 * **Example** (Record an observed collaboration)
 *
 * ```ts
 * import { BoxObservedCollaboration, BoxProviderId } from "@beep/box-provisioning/BoxProvisioningObserved"
 *
 * const collaboration = BoxObservedCollaboration.make({
 *   folderProviderId: BoxProviderId.make("100"),
 *   principal: "attorney@example.test",
 *   principalType: "user",
 *   providerId: BoxProviderId.make("200"),
 *   role: "editor"
 * })
 * console.log(collaboration.role)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxObservedCollaboration extends S.Class<BoxObservedCollaboration>($I`BoxObservedCollaboration`)(
  {
    providerId: BoxProviderId,
    folderProviderId: BoxProviderId,
    principalType: LiteralKit(["user", "group"]),
    principal: S.NonEmptyString,
    principalProviderId: S.OptionFromOptionalKey(BoxProviderId).pipe(SchemaUtils.withNoneDefault),
    role: S.NonEmptyString,
  },
  $I.annote("BoxObservedCollaboration", {
    description: "Normalized Box collaboration keyed by item, principal, and role.",
  })
) {}

/**
 * Normalized Box V2 webhook observed by the inventory service.
 *
 * **Gotchas**
 *
 * The callback address remains secure-runner state and is hashed before plan
 * serialization. Webhook signing keys are never represented here.
 *
 * **Example** (Record an observed webhook)
 *
 * ```ts
 * import { BoxObservedWebhook, BoxProviderId } from "@beep/box-provisioning/BoxProvisioningObserved"
 * import { HttpsUrl } from "@beep/schema"
 *
 * const webhook = BoxObservedWebhook.make({
 *   address: HttpsUrl.make("https://example.test/box/events"),
 *   providerId: BoxProviderId.make("300"),
 *   targetProviderId: BoxProviderId.make("100"),
 *   triggers: ["FILE.UPLOADED"]
 * })
 * console.log(webhook.triggers)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxObservedWebhook extends S.Class<BoxObservedWebhook>($I`BoxObservedWebhook`)(
  {
    providerId: BoxProviderId,
    targetProviderId: BoxProviderId,
    address: HttpsUrl,
    triggers: S.Array(S.NonEmptyString).check(S.isUnique()),
  },
  $I.annote("BoxObservedWebhook", {
    description: "Normalized Box V2 webhook identity, target, callback, and trigger set.",
  })
) {}

/**
 * Secure-runner snapshot of the Box resources needed for deterministic planning.
 *
 * **Example** (Create an empty observed state)
 *
 * ```ts
 * import {
 *   BoxDiscoveryAvailable,
 *   BoxObservedState,
 *   BoxProviderId
 * } from "@beep/box-provisioning/BoxProvisioningObserved"
 *
 * const observed = BoxObservedState.make({
 *   collaborations: [],
 *   enterpriseId: BoxProviderId.make("enterprise-id"),
 *   folders: [],
 *   metadata: BoxDiscoveryAvailable.make({ count: 0, kind: "metadata" }),
 *   retention: BoxDiscoveryAvailable.make({ count: 0, kind: "retention" }),
 *   rootFolderId: BoxProviderId.make("0"),
 *   signRequests: BoxDiscoveryAvailable.make({ count: 0, kind: "signRequests" }),
 *   signTemplates: BoxDiscoveryAvailable.make({ count: 0, kind: "signTemplates" }),
 *   subjectId: BoxProviderId.make("service-account-id"),
 *   webhooks: []
 * })
 * console.log(observed.folders.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxObservedState extends S.Class<BoxObservedState>($I`BoxObservedState`)(
  {
    enterpriseId: BoxProviderId,
    subjectId: BoxProviderId,
    rootFolderId: BoxProviderId,
    folders: S.Array(BoxObservedFolder),
    collaborations: S.Array(BoxObservedCollaboration),
    webhooks: S.Array(BoxObservedWebhook),
    metadata: BoxDiscovery,
    retention: BoxDiscovery,
    signRequests: BoxDiscovery,
    signTemplates: BoxDiscovery,
  },
  $I.annote("BoxObservedState", {
    description: "Normalized confidential Box inventory used only inside the secure runner.",
  })
) {}
