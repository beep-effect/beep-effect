/**
 * Data types and tagged errors for sync-data-to-ts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";
import type { Crypto } from "effect";
import type { HttpClient } from "effect/unstable/http";
import type { SyncDataToTsError } from "../SyncDataToTs.errors.js";

/**
 * Public sync-data-to-ts error exports.
 *
 * @category errors
 * @since 0.0.0
 */
export { SyncDataToTsDriftError, SyncDataToTsError } from "../SyncDataToTs.errors.js";

const $I = $RepoCliId.create("commands/SyncDataToTs/internal/Models");

const SyncDataSourceFormatKit = LiteralKit(["json", "csv", "xml", "bytes", "text"]);

/**
 * Supported source formats for sync-data-to-ts helpers.
 *
 * @category models
 * @since 0.0.0
 */
export const SyncDataSourceFormat = SyncDataSourceFormatKit.pipe(
  $I.annoteSchema("SyncDataSourceFormat", {
    description: "Supported source formats for sync-data-to-ts helpers.",
  })
);

/**
 * Supported source formats for sync-data-to-ts helpers.
 *
 * @category models
 * @since 0.0.0
 */
export type SyncDataSourceFormat = typeof SyncDataSourceFormat.Type;

const SyncDataRunModeKit = LiteralKit(["write", "check", "dry-run"]);

/**
 * Command execution mode for sync-data-to-ts.
 *
 * @category models
 * @since 0.0.0
 */
export const SyncDataRunMode = SyncDataRunModeKit.pipe(
  $I.annoteSchema("SyncDataRunMode", {
    description: "Command execution mode for sync-data-to-ts.",
  })
);

/**
 * Command execution mode for sync-data-to-ts.
 *
 * @category models
 * @since 0.0.0
 */
export type SyncDataRunMode = typeof SyncDataRunMode.Type;

const SyncDataTargetAccessKit = LiteralKit(["public", "authenticated"]);

/**
 * Access class for a checked-in sync target.
 *
 * @category models
 * @since 0.0.0
 */
export const SyncDataTargetAccess = SyncDataTargetAccessKit.pipe(
  $I.annoteSchema("SyncDataTargetAccess", {
    description: "Whether a sync target can be fetched publicly or requires configured authenticated source access.",
  })
);

/**
 * Access class for a checked-in sync target.
 *
 * @category models
 * @since 0.0.0
 */
export type SyncDataTargetAccess = typeof SyncDataTargetAccess.Type;

/**
 * Stable source metadata recorded in generated sidecars and PR reports.
 *
 * @category models
 * @since 0.0.0
 */
export class SyncDataSourceMetadata extends S.Class<SyncDataSourceMetadata>($I`SyncDataSourceMetadata`)(
  {
    id: S.String,
    url: S.String,
    sha256: S.String,
    version: S.optionalKey(S.String),
    published: S.optionalKey(S.String),
  },
  $I.annote("SyncDataSourceMetadata", {
    description: "Stable metadata for one upstream source used by a sync target.",
  })
) {}

/**
 * A generated file emitted by a sync target.
 *
 * @category models
 * @since 0.0.0
 */
export class SyncDataOutputFile extends S.Class<SyncDataOutputFile>($I`SyncDataOutputFile`)(
  {
    path: S.String,
    content: S.String,
  },
  $I.annote("SyncDataOutputFile", {
    description: "Generated file content with its repo-relative output path.",
  })
) {}

/**
 * Rendered target projection ready to compare or write to disk.
 *
 * @category models
 * @since 0.0.0
 */
export class SyncDataTargetProjection extends S.Class<SyncDataTargetProjection>($I`SyncDataTargetProjection`)(
  {
    files: S.Array(SyncDataOutputFile),
    canonicalPath: S.String,
    canonical: S.Json,
    recordCount: S.Finite,
    summary: S.String,
    sources: S.Array(SyncDataSourceMetadata),
  },
  $I.annote("SyncDataTargetProjection", {
    description: "Rendered target projection ready to compare or write to disk.",
  })
) {}

/**
 * Effect requirements shared by checked-in sync targets.
 *
 * @category models
 * @since 0.0.0
 */
export type SyncDataTargetServices = HttpClient.HttpClient | Crypto.Crypto;

/**
 * Opaque schema for the `acquire` Effect computation carried by a checked-in
 * sync target. Validated structurally via `Effect.isEffect`; the computation
 * itself is not schema-decodable data.
 *
 * @category models
 * @since 0.0.0
 */
const SyncDataTargetAcquire = S.declare(
  (input): input is Effect.Effect<SyncDataTargetProjection, SyncDataToTsError, SyncDataTargetServices> =>
    Effect.isEffect(input)
).pipe(
  $I.annoteSchema("SyncDataTargetAcquire", {
    description: "Opaque Effect computation that acquires a sync target's rendered projection.",
  })
);

/**
 * Checked-in sync target definition.
 *
 * @category models
 * @since 0.0.0
 */
export class SyncDataTarget extends S.Class<SyncDataTarget>($I`SyncDataTarget`)(
  {
    access: SyncDataTargetAccess,
    acquire: SyncDataTargetAcquire,
    description: S.String,
    id: S.String,
    sourceUrls: S.Array(S.String),
  },
  $I.annote("SyncDataTarget", {
    description: "Checked-in sync target definition.",
  })
) {}

/**
 * Per-file command result after diffing or writing.
 *
 * @category models
 * @since 0.0.0
 */
export class SyncDataFileResult extends S.Class<SyncDataFileResult>($I`SyncDataFileResult`)(
  {
    path: S.String,
    changed: S.Boolean,
  },
  $I.annote("SyncDataFileResult", {
    description: "Per-file sync result after diffing or writing.",
  })
) {}

/**
 * A single RFC 6902-subset JSON Patch `add` operation, as produced by
 * `effect`'s `JsonPatch.get`.
 *
 * @category models
 * @since 0.0.0
 */
export class JsonPatchAddOperation extends S.Class<JsonPatchAddOperation>($I`JsonPatchAddOperation`)(
  {
    op: S.Literal("add"),
    path: S.String,
    value: S.Json,
    description: S.optionalKey(S.String),
  },
  $I.annote("JsonPatchAddOperation", {
    description: "JSON Patch add operation.",
  })
) {}

/**
 * A single RFC 6902-subset JSON Patch `remove` operation, as produced by
 * `effect`'s `JsonPatch.get`.
 *
 * @category models
 * @since 0.0.0
 */
export class JsonPatchRemoveOperation extends S.Class<JsonPatchRemoveOperation>($I`JsonPatchRemoveOperation`)(
  {
    op: S.Literal("remove"),
    path: S.String,
    description: S.optionalKey(S.String),
  },
  $I.annote("JsonPatchRemoveOperation", {
    description: "JSON Patch remove operation.",
  })
) {}

/**
 * A single RFC 6902-subset JSON Patch `replace` operation, as produced by
 * `effect`'s `JsonPatch.get`.
 *
 * @category models
 * @since 0.0.0
 */
export class JsonPatchReplaceOperation extends S.Class<JsonPatchReplaceOperation>($I`JsonPatchReplaceOperation`)(
  {
    op: S.Literal("replace"),
    path: S.String,
    value: S.Json,
    description: S.optionalKey(S.String),
  },
  $I.annote("JsonPatchReplaceOperation", {
    description: "JSON Patch replace operation.",
  })
) {}

/**
 * Canonical JSON Patch document describing structural drift between a sync
 * target's previous and current canonical JSON.
 *
 * @category models
 * @since 0.0.0
 */
export const CanonicalJsonPatch = S.Array(
  S.Union([JsonPatchAddOperation, JsonPatchRemoveOperation, JsonPatchReplaceOperation])
).pipe(
  $I.annoteSchema("CanonicalJsonPatch", {
    description: "Canonical JSON Patch document describing structural drift for a sync target.",
  })
);

/**
 * Canonical JSON Patch document describing structural drift between a sync
 * target's previous and current canonical JSON.
 *
 * @category models
 * @since 0.0.0
 */
export type CanonicalJsonPatch = typeof CanonicalJsonPatch.Type;

/**
 * Per-target command result after diffing or writing.
 *
 * @category models
 * @since 0.0.0
 */
export class SyncDataTargetResult extends S.Class<SyncDataTargetResult>($I`SyncDataTargetResult`)(
  {
    canonicalPatch: CanonicalJsonPatch,
    canonicalPath: S.String,
    changed: S.Boolean,
    changedFiles: S.Array(S.String),
    fileResults: S.Array(SyncDataFileResult),
    outputPaths: S.Array(S.String),
    recordCount: S.Finite,
    sources: S.Array(SyncDataSourceMetadata),
    sourceUrls: S.Array(S.String),
    summary: S.String,
    targetId: S.String,
  },
  $I.annote("SyncDataTargetResult", {
    description: "Per-target command result after diffing or writing.",
  })
) {}
