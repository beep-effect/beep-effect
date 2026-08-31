/**
 * Versioned, provider-neutral Box provisioning intent schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BoxProvisioningId } from "@beep/identity";
import { HttpsUrl, LiteralKit, SchemaUtils } from "@beep/schema";
import { MutableHashSet } from "effect";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $BoxProvisioningId.create("BoxProvisioningIntent");

/**
 * Stable opaque key used to relate desired Box resources without provider ids.
 *
 * **Example** (Create a logical key)
 *
 * ```ts
 * import { BoxLogicalKey } from "@beep/box-provisioning/BoxProvisioningIntent"
 *
 * const key = BoxLogicalKey.make("folder.client-root")
 * console.log(key)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const BoxLogicalKey = S.NonEmptyString.pipe(
  S.brand("BoxLogicalKey"),
  $I.annoteSchema("BoxLogicalKey", {
    description: "Opaque stable key joining desired Box resources without exposing provider ids.",
  })
);

/**
 * Runtime type for {@link BoxLogicalKey}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type BoxLogicalKey = typeof BoxLogicalKey.Type;

/**
 * Box plan feature availability asserted by the operator's commercial posture.
 *
 * **Example** (Check an unavailable entitlement)
 *
 * ```ts
 * import { BoxEntitlementAvailability } from "@beep/box-provisioning/BoxProvisioningIntent"
 *
 * console.log(BoxEntitlementAvailability.is.unavailable("unavailable"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BoxEntitlementAvailability = LiteralKit(["available", "unavailable"]).pipe(
  $I.annoteSchema("BoxEntitlementAvailability", {
    description: "Whether the current Box subscription admits a resource family.",
  })
);

/**
 * Runtime type for {@link BoxEntitlementAvailability}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxEntitlementAvailability = typeof BoxEntitlementAvailability.Type;

/**
 * Commercial facts that gate plan actions before any provider mutation.
 *
 * **Example** (Describe a Business posture)
 *
 * ```ts
 * import { BoxEntitlements } from "@beep/box-provisioning/BoxProvisioningIntent"
 * import * as O from "effect/Option"
 *
 * const entitlements = BoxEntitlements.make({
 *   externalCollaboratorsRequirePaidSeats: true,
 *   metadata: "unavailable",
 *   planName: "Business",
 *   retention: "unavailable",
 *   signCustomIntegrationAnnualAllowance: O.some(100)
 * })
 * console.log(entitlements.planName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxEntitlements extends S.Class<BoxEntitlements>($I`BoxEntitlements`)(
  {
    planName: S.NonEmptyString,
    metadata: BoxEntitlementAvailability,
    retention: BoxEntitlementAvailability,
    externalCollaboratorsRequirePaidSeats: S.Boolean,
    signCustomIntegrationAnnualAllowance: S.OptionFromOptionalKey(S.Natural).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("BoxEntitlements", {
    description: "Operator-asserted Box subscription capabilities used by the planner's entitlement gate.",
  })
) {}

/**
 * One desired folder in the anchored Box folder graph.
 *
 * **Details**
 *
 * An absent `parentKey` places the folder directly under the desired state's
 * `rootFolderId`. Folder names remain confined to the secure intent document;
 * plan artifacts carry only their digests.
 *
 * **Example** (Create an anchored folder intent)
 *
 * ```ts
 * import { BoxFolderIntent, BoxLogicalKey } from "@beep/box-provisioning/BoxProvisioningIntent"
 * import * as O from "effect/Option"
 *
 * const folder = BoxFolderIntent.make({
 *   logicalKey: BoxLogicalKey.make("folder.workspace"),
 *   name: "Workspace",
 *   parentKey: O.none()
 * })
 * console.log(folder.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxFolderIntent extends S.Class<BoxFolderIntent>($I`BoxFolderIntent`)(
  {
    logicalKey: BoxLogicalKey,
    parentKey: S.OptionFromOptionalKey(BoxLogicalKey).pipe(SchemaUtils.withNoneDefault),
    name: S.NonEmptyString,
  },
  $I.annote("BoxFolderIntent", {
    description: "Desired Box folder identified by an opaque logical key and optional desired parent key.",
  })
) {}

/**
 * One desired collaboration grant attached to a desired folder.
 *
 * **Gotchas**
 *
 * `principal` is secure-runner input and may contain a login or provider id.
 * It is hashed before planning and never copied into a plan or receipt.
 *
 * **Example** (Create a folder collaboration intent)
 *
 * ```ts
 * import { BoxCollaborationIntent, BoxLogicalKey } from "@beep/box-provisioning/BoxProvisioningIntent"
 *
 * const collaboration = BoxCollaborationIntent.make({
 *   folderKey: BoxLogicalKey.make("folder.workspace"),
 *   billingImpact: "external",
 *   logicalKey: BoxLogicalKey.make("collaboration.attorney"),
 *   principal: "attorney@example.test",
 *   principalType: "user",
 *   role: "editor"
 * })
 * console.log(collaboration.role)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxCollaborationIntent extends S.Class<BoxCollaborationIntent>($I`BoxCollaborationIntent`)(
  {
    logicalKey: BoxLogicalKey,
    folderKey: BoxLogicalKey,
    billingImpact: LiteralKit(["internal", "external"]),
    principalType: LiteralKit(["user", "group"]),
    principal: S.NonEmptyString,
    role: S.NonEmptyString,
  },
  $I.annote("BoxCollaborationIntent", {
    description: "Desired Box collaboration keyed independently from its confidential principal value.",
  })
) {}

/**
 * One desired Box V2 webhook attached to a desired folder.
 *
 * **Gotchas**
 *
 * The callback address remains secure-runner input. Plan artifacts compare and
 * carry only a digest of it; webhook signing keys are not part of this model.
 *
 * **Example** (Create a webhook intent)
 *
 * ```ts
 * import { BoxLogicalKey, BoxWebhookIntent } from "@beep/box-provisioning/BoxProvisioningIntent"
 * import { HttpsUrl } from "@beep/schema"
 *
 * const webhook = BoxWebhookIntent.make({
 *   address: HttpsUrl.make("https://example.test/box/events"),
 *   folderKey: BoxLogicalKey.make("folder.workspace"),
 *   logicalKey: BoxLogicalKey.make("webhook.workspace"),
 *   triggers: ["FILE.UPLOADED"]
 * })
 * console.log(webhook.triggers)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxWebhookIntent extends S.Class<BoxWebhookIntent>($I`BoxWebhookIntent`)(
  {
    logicalKey: BoxLogicalKey,
    folderKey: BoxLogicalKey,
    address: HttpsUrl,
    triggers: S.NonEmptyArray(S.NonEmptyString).check(S.isUnique()),
  },
  $I.annote("BoxWebhookIntent", {
    description: "Desired Box V2 webhook target, callback, and unique trigger set.",
  })
) {}

/**
 * Desired metadata capability attached to a desired folder.
 *
 * **Example** (Declare metadata intent)
 *
 * ```ts
 * import { BoxLogicalKey, BoxMetadataIntent } from "@beep/box-provisioning/BoxProvisioningIntent"
 *
 * const metadata = BoxMetadataIntent.make({
 *   folderKey: BoxLogicalKey.make("folder.workspace"),
 *   logicalKey: BoxLogicalKey.make("metadata.workspace"),
 *   templateKey: "workspace_properties"
 * })
 * console.log(metadata.templateKey)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxMetadataIntent extends S.Class<BoxMetadataIntent>($I`BoxMetadataIntent`)(
  {
    logicalKey: BoxLogicalKey,
    folderKey: BoxLogicalKey,
    templateKey: S.NonEmptyString,
  },
  $I.annote("BoxMetadataIntent", {
    description: "Metadata capability intent that becomes entitlement-blocked on unsupported plans.",
  })
) {}

/**
 * Desired retention capability attached to a desired folder.
 *
 * **Example** (Declare retention intent)
 *
 * ```ts
 * import { BoxLogicalKey, BoxRetentionIntent } from "@beep/box-provisioning/BoxProvisioningIntent"
 *
 * const retention = BoxRetentionIntent.make({
 *   folderKey: BoxLogicalKey.make("folder.workspace"),
 *   logicalKey: BoxLogicalKey.make("retention.workspace"),
 *   policyKey: "records-policy"
 * })
 * console.log(retention.policyKey)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxRetentionIntent extends S.Class<BoxRetentionIntent>($I`BoxRetentionIntent`)(
  {
    logicalKey: BoxLogicalKey,
    folderKey: BoxLogicalKey,
    policyKey: S.NonEmptyString,
  },
  $I.annote("BoxRetentionIntent", {
    description: "Retention capability intent that becomes entitlement-blocked on unsupported plans.",
  })
) {}

const allLogicalKeys = (state: {
  readonly collaborations: ReadonlyArray<BoxCollaborationIntent>;
  readonly folders: ReadonlyArray<BoxFolderIntent>;
  readonly metadata: ReadonlyArray<BoxMetadataIntent>;
  readonly retention: ReadonlyArray<BoxRetentionIntent>;
  readonly webhooks: ReadonlyArray<BoxWebhookIntent>;
}): ReadonlyArray<BoxLogicalKey> =>
  A.flatMap(
    [state.folders, state.collaborations, state.webhooks, state.metadata, state.retention] as const,
    A.map((resource) => resource.logicalKey)
  );

const desiredStateCoherence = S.makeFilter<{
  readonly collaborations: ReadonlyArray<BoxCollaborationIntent>;
  readonly folders: ReadonlyArray<BoxFolderIntent>;
  readonly metadata: ReadonlyArray<BoxMetadataIntent>;
  readonly retention: ReadonlyArray<BoxRetentionIntent>;
  readonly webhooks: ReadonlyArray<BoxWebhookIntent>;
}>(
  (state) => {
    const issues: Array<{ readonly path: ReadonlyArray<string | number>; readonly issue: string }> = [];
    const keys = MutableHashSet.empty<BoxLogicalKey>();
    const folderKeys = MutableHashSet.fromIterable(A.map(state.folders, (folder) => folder.logicalKey));

    A.forEach(allLogicalKeys(state), (key, index) => {
      if (MutableHashSet.has(keys, key)) {
        issues.push({ path: ["logicalKeys", index], issue: `Duplicate logical key "${key}".` });
      }
      MutableHashSet.add(keys, key);
    });

    A.forEach(state.folders, (folder, index) => {
      if (O.exists(folder.parentKey, (parentKey) => !MutableHashSet.has(folderKeys, parentKey))) {
        issues.push({
          path: ["folders", index, "parentKey"],
          issue: "Folder parentKey does not name a desired folder.",
        });
      }

      const visited = MutableHashSet.empty<BoxLogicalKey>();
      let cursor = folder.parentKey;
      while (O.isSome(cursor)) {
        const parentKey = cursor.value;
        if (MutableHashSet.has(visited, parentKey) || parentKey === folder.logicalKey) {
          issues.push({ path: ["folders", index, "parentKey"], issue: "Folder parent graph contains a cycle." });
          break;
        }
        MutableHashSet.add(visited, parentKey);
        cursor = pipe(
          A.findFirst(state.folders, (candidate) => candidate.logicalKey === parentKey),
          O.flatMap((candidate) => candidate.parentKey)
        );
      }
    });

    const referencedFolderKeys = A.flatMap(
      [state.collaborations, state.webhooks, state.metadata, state.retention] as const,
      A.map((resource) => resource.folderKey)
    );
    A.forEach(referencedFolderKeys, (folderKey, index) => {
      if (!MutableHashSet.has(folderKeys, folderKey)) {
        issues.push({ path: ["folderReferences", index], issue: "Resource folderKey does not name a desired folder." });
      }
    });

    return issues;
  },
  {
    identifier: $I`DesiredStateCoherence`,
    title: "Coherent Box desired state",
    description: "Logical keys are unique, folder references resolve, and the folder graph is acyclic.",
  }
);

const BoxDesiredStateFields = S.Struct({
  version: S.Literal("box-provisioning/v1").pipe(SchemaUtils.withConstantDefault("box-provisioning/v1")),
  sourceRevision: S.NonEmptyString,
  expectedEnterpriseId: S.NonEmptyString,
  rootFolderId: S.NonEmptyString,
  entitlements: BoxEntitlements,
  folders: S.Array(BoxFolderIntent).pipe(SchemaUtils.withEmptyArrayDefaults<BoxFolderIntent>()),
  collaborations: S.Array(BoxCollaborationIntent).pipe(SchemaUtils.withEmptyArrayDefaults<BoxCollaborationIntent>()),
  webhooks: S.Array(BoxWebhookIntent).pipe(SchemaUtils.withEmptyArrayDefaults<BoxWebhookIntent>()),
  metadata: S.Array(BoxMetadataIntent).pipe(SchemaUtils.withEmptyArrayDefaults<BoxMetadataIntent>()),
  retention: S.Array(BoxRetentionIntent).pipe(SchemaUtils.withEmptyArrayDefaults<BoxRetentionIntent>()),
}).check(desiredStateCoherence);

/**
 * Versioned Box desired-state document decoded before any provider read.
 *
 * **Details**
 *
 * Decoding rejects unknown versions, duplicate logical keys, missing folder
 * references, and folder cycles. Names, principals, and callback addresses are
 * secure-runner input and are never copied into public plan artifacts.
 *
 * **Example** (Create an empty anchored desired state)
 *
 * ```ts
 * import { BoxDesiredState, BoxEntitlements } from "@beep/box-provisioning/BoxProvisioningIntent"
 * import * as O from "effect/Option"
 *
 * const desired = BoxDesiredState.make({
 *   collaborations: [],
 *   entitlements: BoxEntitlements.make({
 *     externalCollaboratorsRequirePaidSeats: true,
 *     metadata: "unavailable",
 *     planName: "Business",
 *     retention: "unavailable",
 *     signCustomIntegrationAnnualAllowance: O.none()
 *   }),
 *   expectedEnterpriseId: "enterprise-id",
 *   folders: [],
 *   metadata: [],
 *   retention: [],
 *   rootFolderId: "0",
 *   sourceRevision: "intent-1",
 *   webhooks: []
 * })
 * console.log(desired.version)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BoxDesiredState = BoxDesiredStateFields.pipe(
  $I.annoteSchema("BoxDesiredState", {
    description: "Validated versioned intent for one anchored Box tenant reconciliation.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link BoxDesiredState}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxDesiredState = typeof BoxDesiredState.Type;
