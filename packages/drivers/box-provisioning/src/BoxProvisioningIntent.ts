/**
 * Versioned, provider-neutral Box provisioning intent schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BoxProvisioningId } from "@beep/identity";
import { HttpsUrl, LiteralKit, SchemaUtils } from "@beep/schema";
import { HashMap, MutableHashSet, Order } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { BoxProviderId } from "./BoxProvisioningObserved.ts";

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
 * Resource families eligible for explicit adoption in desired-state version 1.
 *
 * **Example** (Check folder adoption support)
 *
 * ```ts
 * import { BoxAdoptionResourceKind } from "@beep/box-provisioning/BoxProvisioningIntent"
 *
 * console.log(BoxAdoptionResourceKind.is.folder("folder"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BoxAdoptionResourceKind = LiteralKit(["folder"]).pipe(
  $I.annoteSchema("BoxAdoptionResourceKind", {
    description: "Box resource family that desired-state version 1 may explicitly adopt.",
  })
);

/**
 * Runtime type for {@link BoxAdoptionResourceKind}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxAdoptionResourceKind = typeof BoxAdoptionResourceKind.Type;

const BoxFolderNameChecks = S.makeFilterGroup(
  [
    S.isLengthBetween(1, 255, {
      identifier: $I`BoxFolderNameLengthCheck`,
      title: "Box Folder Name Length",
      description: "A Box folder name containing between 1 and 255 characters.",
      message: "Box folder names must contain between 1 and 255 characters",
    }),
    S.isPattern(/^[^\u0000-\u001f\u007f/\\]*$/u, {
      identifier: $I`BoxFolderNameCharacterCheck`,
      title: "Box Folder Name Characters",
      description: "A Box folder name without slash, backslash, or non-printable ASCII characters.",
      message: "Box folder names must not contain slash, backslash, or non-printable ASCII characters",
    }),
    S.makeFilter((value: string) => !Eq.equals(value, ".") && !Eq.equals(value, ".."), {
      identifier: $I`BoxFolderNameDotSegmentCheck`,
      title: "Box Folder Name Dot Segment",
      description: "A Box folder name other than the reserved dot and dot-dot segments.",
      message: "Box folder names must not be . or ..",
    }),
    S.makeFilter((value: string) => Eq.equals(Str.trimEnd(value), value), {
      identifier: $I`BoxFolderNameTrailingWhitespaceCheck`,
      title: "Box Folder Name Trailing Whitespace",
      description: "A Box folder name without trailing whitespace.",
      message: "Box folder names must not end with whitespace",
    }),
  ],
  {
    identifier: $I`BoxFolderNameChecks`,
    title: "Box Folder Name",
    description: "Provider-compatible checks for a Box folder name.",
  }
);

/**
 * Provider-compatible Box folder name accepted by desired state.
 *
 * **Details**
 *
 * Box documents a 1–255 character range and rejects trailing spaces, slash,
 * backslash, non-printable ASCII, `.` and `..`.
 *
 * **Example** (Create a valid Box folder name)
 *
 * ```ts
 * import { BoxFolderName } from "@beep/box-provisioning/BoxProvisioningIntent"
 *
 * console.log(BoxFolderName.make("Workspace"))
 * ```
 *
 * @see {@link https://developer.box.com/reference/post-folders} for the create-folder name contract.
 * @see {@link https://developer.box.com/guides/folders/single/create} for the trailing-space restriction.
 * @category value-objects
 * @since 0.0.0
 */
export const BoxFolderName = S.String.check(BoxFolderNameChecks).pipe(
  $I.annoteSchema("BoxFolderName", {
    description: "Desired folder name accepted by Box's documented create-folder contract.",
  })
);

/**
 * Runtime type for {@link BoxFolderName}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxFolderName = typeof BoxFolderName.Type;

/**
 * Compares folder names using Box's provider-equivalent sibling-name rules.
 *
 * **Details**
 *
 * Box sibling uniqueness is case-insensitive. Trailing whitespace is trimmed
 * for defensive comparison with anomalous observed state even though new
 * desired names containing it are rejected by {@link BoxFolderName}.
 *
 * **Example** (Compare provider-equivalent names)
 *
 * ```ts
 * import { boxFolderNamesEquivalent } from "@beep/box-provisioning/BoxProvisioningIntent"
 *
 * console.log(boxFolderNamesEquivalent("Workspace", "workspace "))
 * ```
 *
 * @see {@link https://developer.box.com/reference/post-folders} for case-insensitive sibling uniqueness.
 * @see {@link https://developer.box.com/guides/folders/single/create} for the trailing-space restriction.
 * @category normalization
 * @since 0.0.0
 */
export const boxFolderNamesEquivalent: {
  (right: string): (left: string) => boolean;
  (left: string, right: string): boolean;
} = dual(2, (left: string, right: string): boolean =>
  Eq.equals(pipe(left, Str.trimEnd, Str.toLowerCase), pipe(right, Str.trimEnd, Str.toLowerCase))
);

/**
 * Explicit authorization to bind one observed Box folder to one desired key.
 *
 * **Details**
 *
 * Both provider identifiers must match live inventory. A natural-key match
 * alone never grants ownership.
 *
 * **Example** (Authorize one existing folder)
 *
 * ```ts
 * import { BoxAdoption, BoxLogicalKey } from "@beep/box-provisioning/BoxProvisioningIntent"
 * import { BoxProviderId } from "@beep/box-provisioning/BoxProvisioningObserved"
 *
 * const adoption = BoxAdoption.make({
 *   expectedParentProviderId: BoxProviderId.make("0"),
 *   expectedProviderId: BoxProviderId.make("100"),
 *   logicalKey: BoxLogicalKey.make("folder.workspace"),
 *   resourceKind: "folder"
 * })
 * console.log(adoption.resourceKind)
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export class BoxAdoption extends S.Class<BoxAdoption>($I`BoxAdoption`)(
  {
    resourceKind: BoxAdoptionResourceKind,
    logicalKey: BoxLogicalKey,
    expectedProviderId: BoxProviderId,
    expectedParentProviderId: BoxProviderId,
  },
  $I.annote("BoxAdoption", {
    description: "Explicit desired-to-provider identity binding required before adopting an existing Box folder.",
  })
) {}

/**
 * Versioned ownership bindings for adopted or reconciler-created Box folders.
 *
 * **Example** (Declare an empty adoption allowlist)
 *
 * ```ts
 * import { BoxAdoptions } from "@beep/box-provisioning/BoxProvisioningIntent"
 *
 * const adoptions = BoxAdoptions.make({ entries: [] })
 * console.log(adoptions.version)
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export class BoxAdoptions extends S.Class<BoxAdoptions>($I`BoxAdoptions`)(
  {
    version: S.Literal("box-provisioning-adoptions/v1").pipe(
      SchemaUtils.withConstantDefault("box-provisioning-adoptions/v1")
    ),
    entries: S.Array(BoxAdoption).pipe(SchemaUtils.withEmptyArrayDefaults<BoxAdoption>()),
  },
  $I.annote("BoxAdoptions", {
    description: "Versioned folder ownership bindings for pre-existing and reconciler-created Box resources.",
  })
) {}

/**
 * Merges durable Box folder ownership bindings with deterministic replacement and ordering.
 *
 * **Details**
 *
 * At most one binding is retained per logical key. Entries from `additions`
 * replace stale prior bindings for the same key, and the result is ordered by
 * logical key so equivalent evidence produces byte-identical desired state.
 *
 * **Example** (Merge an empty ownership set)
 *
 * ```ts
 * import { BoxAdoptions, mergeBoxAdoptions } from "@beep/box-provisioning/BoxProvisioningIntent"
 *
 * const merged = mergeBoxAdoptions(BoxAdoptions.make({ entries: [] }), [])
 * console.log(merged.entries.length)
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const mergeBoxAdoptions: {
  (additions: ReadonlyArray<BoxAdoption>): (existing: BoxAdoptions) => BoxAdoptions;
  (existing: BoxAdoptions, additions: ReadonlyArray<BoxAdoption>): BoxAdoptions;
} = dual(2, (existing: BoxAdoptions, additions: ReadonlyArray<BoxAdoption>): BoxAdoptions => {
  const byLogicalKey = A.reduce(
    A.appendAll(existing.entries, additions),
    HashMap.empty<BoxLogicalKey, BoxAdoption>(),
    (entries, adoption) => HashMap.set(entries, adoption.logicalKey, adoption)
  );
  return BoxAdoptions.make({
    entries: A.sortWith(HashMap.values(byLogicalKey), (adoption) => adoption.logicalKey, Order.String),
  });
});

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
 * Closed Box commercial plans supported by desired-state version 1.
 *
 * **Example** (Check the Business plan)
 *
 * ```ts
 * import { BoxPlanName } from "@beep/box-provisioning/BoxProvisioningIntent"
 *
 * console.log(BoxPlanName.is.Business("Business"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BoxPlanName = LiteralKit(["Business", "BusinessPlus", "Enterprise", "EnterprisePlus"]).pipe(
  $I.annoteSchema("BoxPlanName", {
    description: "Closed Box commercial plan name accepted by desired-state version 1.",
  })
);

/**
 * Runtime type for {@link BoxPlanName}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxPlanName = typeof BoxPlanName.Type;

/**
 * Bounded opaque identifier for the source revision behind desired state.
 *
 * **Example** (Create a source revision)
 *
 * ```ts
 * import { BoxSourceRevision } from "@beep/box-provisioning/BoxProvisioningIntent"
 *
 * console.log(BoxSourceRevision.make("intent-1"))
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const BoxSourceRevision = S.String.check(
  S.isPattern(/^[A-Za-z0-9._-]{1,64}$/u, {
    identifier: $I`BoxSourceRevisionCheck`,
    title: "Box Source Revision",
    description: "An opaque revision identifier containing 1 to 64 safe identifier characters.",
    message: "Box source revisions must match ^[A-Za-z0-9._-]{1,64}$",
  })
).pipe(
  S.brand("BoxSourceRevision"),
  $I.annoteSchema("BoxSourceRevision", {
    description: "Bounded opaque source revision safe for redacted plan artifacts.",
  })
);

/**
 * Runtime type for {@link BoxSourceRevision}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxSourceRevision = typeof BoxSourceRevision.Type;

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
    planName: BoxPlanName,
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
    name: BoxFolderName,
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

const recordDuplicateNaturalKeys = <Resource>(
  issues: Array<{ readonly path: ReadonlyArray<string | number>; readonly issue: string }>,
  family: "folders" | "collaborations" | "webhooks",
  resources: ReadonlyArray<Resource>,
  sameNaturalKey: (left: Resource, right: Resource) => boolean
): void =>
  A.forEach(resources, (resource, index) => {
    if (A.some(A.take(resources, index), (candidate) => sameNaturalKey(candidate, resource))) {
      issues.push({
        path: [family, index],
        issue: `Duplicate ${family} provider natural key.`,
      });
    }
  });

const desiredStateCoherence = S.makeFilter<{
  readonly adoptions: BoxAdoptions;
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

    A.forEach(state.adoptions.entries, (adoption, index) => {
      if (!MutableHashSet.has(folderKeys, adoption.logicalKey)) {
        issues.push({
          path: ["adoptions", "entries", index, "logicalKey"],
          issue: "Adoption logicalKey does not name a desired folder.",
        });
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

    recordDuplicateNaturalKeys(
      issues,
      "folders",
      state.folders,
      (left, right) => Eq.equals(left.parentKey, right.parentKey) && boxFolderNamesEquivalent(left.name, right.name)
    );
    recordDuplicateNaturalKeys(
      issues,
      "collaborations",
      state.collaborations,
      (left, right) =>
        left.folderKey === right.folderKey &&
        left.principalType === right.principalType &&
        left.principal === right.principal
    );
    recordDuplicateNaturalKeys(
      issues,
      "webhooks",
      state.webhooks,
      (left, right) => left.folderKey === right.folderKey && left.address === right.address
    );

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
  adoptions: SchemaUtils.withKeyDefaults(BoxAdoptions, BoxAdoptions.make({ entries: [] })),
  sourceRevision: BoxSourceRevision,
  expectedEnterpriseId: BoxProviderId,
  expectedSubjectId: BoxProviderId,
  rootFolderId: BoxProviderId,
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
 * import {
 *   BoxAdoptions,
 *   BoxDesiredState,
 *   BoxEntitlements,
 *   BoxSourceRevision
 * } from "@beep/box-provisioning/BoxProvisioningIntent"
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
 * console.log(desired.version)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BoxDesiredState = BoxDesiredStateFields.pipe(
  $I.annoteSchema("BoxDesiredState", {
    description: "Validated versioned intent for one anchored Box tenant reconciliation.",
  })
);

/**
 * Runtime type for {@link BoxDesiredState}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxDesiredState = typeof BoxDesiredState.Type;
