/**
 * Redacted, deterministic Box content-migration plan schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BoxProvisioningId } from "@beep/identity";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { BoxContentMigrationRuleId } from "./BoxContentMigrationMap.ts";
import { BoxProvisioningSchemaError } from "./BoxProvisioningErrors.ts";
import { BoxSourceRevision } from "./BoxProvisioningIntent.ts";
import { BoxProviderId } from "./BoxProvisioningObserved.ts";

const $I = $BoxProvisioningId.create("BoxContentMigrationPlan");

const FolderDepth = S.Natural.check(S.isGreaterThan(0));

/**
 * Box upload route selected for one planned file.
 *
 * **Example** (Check the chunked transport)
 *
 * ```ts
 * import { BoxContentUploadTransport } from "@beep/box-provisioning/BoxContentMigrationPlan"
 *
 * console.log(BoxContentUploadTransport.is.chunked("chunked"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BoxContentUploadTransport = LiteralKit(["single", "chunked"]).pipe(
  $I.annoteSchema("BoxContentUploadTransport", {
    description: "Single-request or chunked-session Box upload route for one file.",
  })
);

/**
 * Runtime type for {@link BoxContentUploadTransport}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxContentUploadTransport = typeof BoxContentUploadTransport.Type;

/**
 * Plan action proving a required destination folder already exists.
 *
 * **Example** (Record an existing folder)
 *
 * ```ts
 * import { BoxContentFolderExists } from "@beep/box-provisioning/BoxContentMigrationPlan"
 * import { BoxProviderId } from "@beep/box-provisioning/BoxProvisioningObserved"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const action = BoxContentFolderExists.make({
 *   depth: 1,
 *   pathDigest: Sha256Hex.make("a".repeat(64)),
 *   providerId: BoxProviderId.make("200")
 * })
 * console.log(action._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentFolderExists extends S.TaggedClass<BoxContentFolderExists>($I`BoxContentFolderExists`)(
  "FolderExists",
  {
    pathDigest: Sha256Hex,
    depth: FolderDepth,
    providerId: BoxProviderId,
  },
  $I.annote("BoxContentFolderExists", {
    description: "Required destination folder already present in Box, identified by path digest and provider id.",
  })
) {}

/**
 * Plan action creating one missing destination folder.
 *
 * **Example** (Plan a folder create)
 *
 * ```ts
 * import { BoxContentFolderCreate } from "@beep/box-provisioning/BoxContentMigrationPlan"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const action = BoxContentFolderCreate.make({
 *   depth: 2,
 *   parentPathDigest: Sha256Hex.make("b".repeat(64)),
 *   pathDigest: Sha256Hex.make("a".repeat(64))
 * })
 * console.log(action.depth)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentFolderCreate extends S.TaggedClass<BoxContentFolderCreate>($I`BoxContentFolderCreate`)(
  "FolderCreate",
  {
    pathDigest: Sha256Hex,
    depth: FolderDepth,
    parentPathDigest: Sha256Hex,
  },
  $I.annote("BoxContentFolderCreate", {
    description: "Missing destination folder to create beneath the folder identified by the parent path digest.",
  })
) {}

/**
 * Tagged union of content-migration folder actions.
 *
 * **Example** (Inspect the folder-action schema)
 *
 * ```ts
 * import { BoxContentFolderAction } from "@beep/box-provisioning/BoxContentMigrationPlan"
 *
 * console.log(BoxContentFolderAction.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BoxContentFolderAction = S.Union([BoxContentFolderExists, BoxContentFolderCreate]).pipe(
  $I.annoteSchema("BoxContentFolderAction", { description: "Existing or to-be-created destination folder action." })
);

/**
 * Runtime type for {@link BoxContentFolderAction}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxContentFolderAction = typeof BoxContentFolderAction.Type;

/**
 * Plan action uploading one verified source file to a name that is free in Box.
 *
 * **Example** (Plan a single-request upload)
 *
 * ```ts
 * import { BoxContentUpload } from "@beep/box-provisioning/BoxContentMigrationPlan"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const action = BoxContentUpload.make({
 *   entryDigest: Sha256Hex.make("a".repeat(64)),
 *   sizeBytes: 1024,
 *   transport: "single"
 * })
 * console.log(action.transport)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentUpload extends S.TaggedClass<BoxContentUpload>($I`BoxContentUpload`)(
  "Upload",
  {
    entryDigest: Sha256Hex,
    sizeBytes: S.Natural,
    transport: BoxContentUploadTransport,
  },
  $I.annote("BoxContentUpload", {
    description: "Verified source file to upload, with its byte size and Box upload route.",
  })
) {}

/**
 * Plan action for a file Box already holds with identical content.
 *
 * **Details**
 *
 * A Box file with the provider-equivalent name exists in the destination
 * folder and its `sha1` equals the local file's SHA-1.
 *
 * **Example** (Record an already migrated file)
 *
 * ```ts
 * import { BoxContentSkipIdentical } from "@beep/box-provisioning/BoxContentMigrationPlan"
 * import { BoxProviderId } from "@beep/box-provisioning/BoxProvisioningObserved"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const action = BoxContentSkipIdentical.make({
 *   entryDigest: Sha256Hex.make("a".repeat(64)),
 *   providerId: BoxProviderId.make("300")
 * })
 * console.log(action._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentSkipIdentical extends S.TaggedClass<BoxContentSkipIdentical>($I`BoxContentSkipIdentical`)(
  "SkipIdentical",
  {
    entryDigest: Sha256Hex,
    providerId: BoxProviderId,
  },
  $I.annote("BoxContentSkipIdentical", {
    description: "Destination already holds a same-name Box file with the local file's SHA-1.",
  })
) {}

/**
 * Plan action blocked because the destination name is taken by different content.
 *
 * **Details**
 *
 * The occupying item is a file with another SHA-1, a folder, or a web link. It
 * is never overwritten, versioned, renamed, or deleted.
 *
 * **Example** (Record a name conflict)
 *
 * ```ts
 * import { BoxContentBlockedNameConflict } from "@beep/box-provisioning/BoxContentMigrationPlan"
 * import { BoxProviderId } from "@beep/box-provisioning/BoxProvisioningObserved"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const action = BoxContentBlockedNameConflict.make({
 *   entryDigest: Sha256Hex.make("a".repeat(64)),
 *   providerId: BoxProviderId.make("301")
 * })
 * console.log(action._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentBlockedNameConflict extends S.TaggedClass<BoxContentBlockedNameConflict>(
  $I`BoxContentBlockedNameConflict`
)(
  "BlockedNameConflict",
  {
    entryDigest: Sha256Hex,
    providerId: BoxProviderId,
  },
  $I.annote("BoxContentBlockedNameConflict", {
    description: "Destination name is occupied by a Box item whose content differs from the local file.",
  })
) {}

/**
 * Plan action blocked because the local source file is absent.
 *
 * **Example** (Record a missing source)
 *
 * ```ts
 * import { BoxContentBlockedSourceMissing } from "@beep/box-provisioning/BoxContentMigrationPlan"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const action = BoxContentBlockedSourceMissing.make({ entryDigest: Sha256Hex.make("a".repeat(64)) })
 * console.log(action._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentBlockedSourceMissing extends S.TaggedClass<BoxContentBlockedSourceMissing>(
  $I`BoxContentBlockedSourceMissing`
)(
  "BlockedSourceMissing",
  { entryDigest: Sha256Hex },
  $I.annote("BoxContentBlockedSourceMissing", {
    description: "Local source file named by the map is missing or is not a regular file.",
  })
) {}

/**
 * Plan action blocked because the local source no longer matches the map.
 *
 * **Example** (Record a changed source)
 *
 * ```ts
 * import { BoxContentBlockedSourceChanged } from "@beep/box-provisioning/BoxContentMigrationPlan"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const action = BoxContentBlockedSourceChanged.make({ entryDigest: Sha256Hex.make("a".repeat(64)) })
 * console.log(action._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentBlockedSourceChanged extends S.TaggedClass<BoxContentBlockedSourceChanged>(
  $I`BoxContentBlockedSourceChanged`
)(
  "BlockedSourceChanged",
  { entryDigest: Sha256Hex },
  $I.annote("BoxContentBlockedSourceChanged", {
    description: "Local source file size or SHA-256 differs from the value recorded in the map.",
  })
) {}

/**
 * Tagged union of content-migration file actions.
 *
 * **Example** (Inspect the file-action schema)
 *
 * ```ts
 * import { BoxContentFileAction } from "@beep/box-provisioning/BoxContentMigrationPlan"
 *
 * console.log(BoxContentFileAction.ast)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BoxContentFileAction = S.Union([
  BoxContentUpload,
  BoxContentSkipIdentical,
  BoxContentBlockedNameConflict,
  BoxContentBlockedSourceMissing,
  BoxContentBlockedSourceChanged,
]).pipe(
  $I.annoteSchema("BoxContentFileAction", {
    description: "Upload, identical-skip, or blocked action for one mapped source file.",
  })
);

/**
 * Runtime type for {@link BoxContentFileAction}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoxContentFileAction = typeof BoxContentFileAction.Type;

/**
 * Upload count and byte total for one optional rule identifier.
 *
 * **Example** (Count uploads without a rule)
 *
 * ```ts
 * import { BoxContentRuleUploadCount } from "@beep/box-provisioning/BoxContentMigrationPlan"
 * import * as O from "effect/Option"
 *
 * const count = BoxContentRuleUploadCount.make({ ruleId: O.none(), uploadBytes: 2048, uploadCount: 2 })
 * console.log(count.uploadCount)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentRuleUploadCount extends S.Class<BoxContentRuleUploadCount>($I`BoxContentRuleUploadCount`)(
  {
    ruleId: S.OptionFromOptionalKey(BoxContentMigrationRuleId).pipe(S.withConstructorDefault(Effect.succeedNone)),
    uploadCount: S.Natural,
    uploadBytes: S.Natural,
  },
  $I.annote("BoxContentRuleUploadCount", {
    description: "Planned upload count and bytes for one rule token, or for files without a rule.",
  })
) {}

/**
 * Counts, byte totals, and provider-call estimates for one content-migration plan.
 *
 * **Details**
 *
 * `planProviderCalls` is the number of Box calls this dry run made.
 * `estimatedProviderCalls` is the budget a full `applyReviewedPlan` of this plan
 * needs: the fresh pre-apply plan, one call per folder create, one call per
 * single upload, `3 + ceil(size / 8 MiB)` calls per chunked upload, and the
 * post-apply plan.
 *
 * **Example** (Summarize an empty plan)
 *
 * ```ts
 * import { BoxContentMigrationPlanSummary } from "@beep/box-provisioning/BoxContentMigrationPlan"
 *
 * const summary = BoxContentMigrationPlanSummary.make({
 *   blockedNameConflictCount: 0,
 *   blockedSourceChangedCount: 0,
 *   blockedSourceMissingCount: 0,
 *   estimatedProviderCalls: 4,
 *   folderCreateCount: 0,
 *   folderExistsCount: 0,
 *   planProviderCalls: 2,
 *   skipIdenticalCount: 0,
 *   totalUploadBytes: 0,
 *   uploadCount: 0,
 *   uploadCountsByRule: []
 * })
 * console.log(summary.estimatedProviderCalls)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentMigrationPlanSummary extends S.Class<BoxContentMigrationPlanSummary>(
  $I`BoxContentMigrationPlanSummary`
)(
  {
    folderExistsCount: S.Natural,
    folderCreateCount: S.Natural,
    uploadCount: S.Natural,
    skipIdenticalCount: S.Natural,
    blockedNameConflictCount: S.Natural,
    blockedSourceMissingCount: S.Natural,
    blockedSourceChangedCount: S.Natural,
    uploadCountsByRule: S.Array(BoxContentRuleUploadCount),
    totalUploadBytes: S.Natural,
    planProviderCalls: S.Natural,
    estimatedProviderCalls: S.Natural,
  },
  $I.annote("BoxContentMigrationPlanSummary", {
    description: "Per-action counts, per-rule upload counts, upload bytes, and provider-call estimates.",
  })
) {}

/**
 * Schema-validated deterministic dry-run artifact for one Box content migration.
 *
 * **Details**
 *
 * Folder names, file names, source paths, and logins never appear: folders and
 * files are identified only by SHA-256 digests of their provider-equivalent
 * destination, plus provider ids, sizes, and counts. Folder actions are ordered
 * by depth then digest and file actions by digest. The plan has no timestamp,
 * so an unchanged tenant and unchanged sources reproduce it byte for byte.
 *
 * **Example** (Inspect the plan schema)
 *
 * ```ts
 * import { BoxContentMigrationPlan } from "@beep/box-provisioning/BoxContentMigrationPlan"
 *
 * console.log(BoxContentMigrationPlan.ast)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentMigrationPlan extends S.Class<BoxContentMigrationPlan>($I`BoxContentMigrationPlan`)(
  {
    version: S.Literal("box-content-migration-plan/v1").pipe(
      S.withConstructorDefault(Effect.succeed("box-content-migration-plan/v1"))
    ),
    sourceRevision: BoxSourceRevision,
    expectedEnterpriseId: BoxProviderId,
    subjectId: BoxProviderId,
    rootFolderId: BoxProviderId,
    mapDigest: Sha256Hex,
    planDigest: Sha256Hex,
    chunkedThresholdBytes: S.Natural,
    folderActions: S.Array(BoxContentFolderAction),
    fileActions: S.Array(BoxContentFileAction),
    summary: BoxContentMigrationPlanSummary,
  },
  $I.annote("BoxContentMigrationPlan", {
    description: "Redacted deterministic content-migration plan sealed by map and plan digests.",
  })
) {}

const encodeBoxContentMigrationPlanJson = S.encodeEffect(S.fromJsonString(BoxContentMigrationPlan));
const decodeUnknownBoxContentMigrationPlanJson = S.decodeUnknownEffect(S.fromJsonString(BoxContentMigrationPlan));

const planSchemaError = () => BoxProvisioningSchemaError.make({ stage: "migration-plan" });

/**
 * Encode a redacted content-migration plan as schema-validated JSON for review.
 *
 * **Example** (Inspect the plan encoder)
 *
 * ```ts
 * import { encodeBoxContentMigrationPlan } from "@beep/box-provisioning/BoxContentMigrationPlan"
 *
 * console.log(encodeBoxContentMigrationPlan)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeBoxContentMigrationPlan = (
  plan: BoxContentMigrationPlan
): Effect.Effect<string, BoxProvisioningSchemaError> =>
  encodeBoxContentMigrationPlanJson(plan).pipe(Effect.mapError(planSchemaError));

/**
 * Decode schema-validated reviewed content-migration plan JSON.
 *
 * **Example** (Inspect the plan decoder)
 *
 * ```ts
 * import { decodeBoxContentMigrationPlan } from "@beep/box-provisioning/BoxContentMigrationPlan"
 *
 * console.log(decodeBoxContentMigrationPlan)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeBoxContentMigrationPlan = (
  text: unknown
): Effect.Effect<BoxContentMigrationPlan, BoxProvisioningSchemaError> =>
  decodeUnknownBoxContentMigrationPlanJson(text).pipe(Effect.mapError(planSchemaError));
