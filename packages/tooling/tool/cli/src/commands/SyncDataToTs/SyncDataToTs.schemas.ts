/**
 * Data types and tagged errors for sync-data-to-ts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { RunMode } from "../../internal/cli/RunMode.ts";
import type { Crypto, Effect } from "effect";
import type { HttpClient } from "effect/unstable/http";
import type { RunMode as RunModeValue } from "../../internal/cli/RunMode.ts";
import type { SyncDataToTsError } from "./SyncDataToTs.errors.ts";

/**
 * Public sync-data-to-ts error exports.
 *
 * @category errors
 * @since 0.0.0
 */
export { SyncDataToTsDriftError, SyncDataToTsError } from "./SyncDataToTs.errors.ts";

const $I = $RepoCliId.create("commands/SyncDataToTs/SyncDataToTs.schemas");

const SyncDataSourceFormatKit = LiteralKit(["json", "csv", "xml", "bytes", "text"]);

/**
 * Supported source formats for sync-data-to-ts helpers.
 *
 * @example
 * ```ts
 * import type { SyncDataSourceFormat } from "@beep/repo-cli/commands/SyncDataToTs/SyncDataToTs.schemas"
 *
 * const example: SyncDataSourceFormat | undefined = undefined
 * console.log(example === undefined) // true
 * ```
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
 * @example
 * ```ts
 * import type { SyncDataSourceFormat } from "@beep/repo-cli/commands/SyncDataToTs/SyncDataToTs.schemas"
 *
 * const example: SyncDataSourceFormat | undefined = undefined
 * console.log(example === undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export type SyncDataSourceFormat = typeof SyncDataSourceFormat.Type;

/**
 * Command execution mode for sync-data-to-ts.
 *
 * @example
 * ```ts
 * import type { SyncDataRunMode } from "@beep/repo-cli/commands/SyncDataToTs/SyncDataToTs.schemas"
 *
 * const example: SyncDataRunMode | undefined = undefined
 * console.log(example === undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const SyncDataRunMode = RunMode;

/**
 * Command execution mode for sync-data-to-ts.
 *
 * @example
 * ```ts
 * import type { SyncDataRunMode } from "@beep/repo-cli/commands/SyncDataToTs/SyncDataToTs.schemas"
 *
 * const example: SyncDataRunMode | undefined = undefined
 * console.log(example === undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export type SyncDataRunMode = RunModeValue;

const SyncDataTargetAccessKit = LiteralKit(["public", "authenticated"]);

/**
 * Access class for a checked-in sync target.
 *
 * @example
 * ```ts
 * import type { SyncDataTargetAccess } from "@beep/repo-cli/commands/SyncDataToTs/SyncDataToTs.schemas"
 *
 * const example: SyncDataTargetAccess | undefined = undefined
 * console.log(example === undefined) // true
 * ```
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
 * @example
 * ```ts
 * import type { SyncDataTargetAccess } from "@beep/repo-cli/commands/SyncDataToTs/SyncDataToTs.schemas"
 *
 * const example: SyncDataTargetAccess | undefined = undefined
 * console.log(example === undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export type SyncDataTargetAccess = typeof SyncDataTargetAccess.Type;

/**
 * Schema-backed metadata shared by every checked-in sync target.
 *
 * @example
 * ```ts
 * import { SyncDataTargetMetadata } from "@beep/repo-cli/commands/SyncDataToTs/SyncDataToTs.schemas"
 *
 * const metadata = SyncDataTargetMetadata.make({
 *   access: "public",
 *   description: "Official example dataset.",
 *   id: "example",
 *   sourceUrls: ["https://example.com/data.json"]
 * })
 * console.log(metadata.id) // "example"
 * ```
 * @category models
 * @since 0.0.0
 */
export class SyncDataTargetMetadata extends S.Class<SyncDataTargetMetadata>($I`SyncDataTargetMetadata`)(
  {
    access: SyncDataTargetAccess.annotateKey({
      description: "Whether the target can be fetched publicly or requires authenticated source access.",
    }),
    description: S.String.annotateKey({
      description: "Human-readable description shown in command discovery and diagnostics.",
    }),
    id: S.String.annotateKey({
      description: "Stable target identifier accepted by the command line.",
    }),
    sourceUrls: S.Array(S.String).annotateKey({
      description: "Upstream source URLs recorded in command reports.",
    }),
  },
  $I.annote("SyncDataTargetMetadata", {
    description: "Schema-backed metadata shared by every checked-in sync-data-to-ts target.",
  })
) {}

/**
 * Stable source metadata recorded in generated sidecars and PR reports.
 *
 * @example
 * ```ts
 * import { SyncDataSourceMetadata } from "@beep/repo-cli/commands/SyncDataToTs/SyncDataToTs.schemas"
 *
 * console.log(typeof SyncDataSourceMetadata !== "undefined") // true
 * ```
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
 * @example
 * ```ts
 * import { SyncDataOutputFile } from "@beep/repo-cli/commands/SyncDataToTs/SyncDataToTs.schemas"
 *
 * console.log(typeof SyncDataOutputFile !== "undefined") // true
 * ```
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
 * @example
 * ```ts
 * import { SyncDataTargetProjection } from "@beep/repo-cli/commands/SyncDataToTs/SyncDataToTs.schemas"
 *
 * console.log(typeof SyncDataTargetProjection !== "undefined") // true
 * ```
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
 * @example
 * ```ts
 * import type { SyncDataTargetServices } from "@beep/repo-cli/commands/SyncDataToTs/SyncDataToTs.schemas"
 *
 * const example: SyncDataTargetServices | undefined = undefined
 * console.log(example === undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export type SyncDataTargetServices = HttpClient.HttpClient | Crypto.Crypto;

/**
 * Checked-in sync target definition.
 *
 * @example
 * ```ts
 * import type { SyncDataTarget } from "@beep/repo-cli/commands/SyncDataToTs/SyncDataToTs.schemas"
 *
 * const example: SyncDataTarget | undefined = undefined
 * console.log(example === undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export interface SyncDataTarget extends SyncDataTargetMetadata {
  readonly acquire: Effect.Effect<SyncDataTargetProjection, SyncDataToTsError, SyncDataTargetServices>;
}

/**
 * Per-file command result after diffing or writing.
 *
 * @example
 * ```ts
 * import { SyncDataFileResult } from "@beep/repo-cli/commands/SyncDataToTs/SyncDataToTs.schemas"
 *
 * console.log(typeof SyncDataFileResult !== "undefined") // true
 * ```
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

const SyncDataJsonPatchOperation = LiteralKit(["add", "remove", "replace"])
  .toTaggedUnion("op")({
    add: {
      description: S.optionalKey(S.String),
      path: S.String,
      value: S.Json,
    },
    remove: {
      description: S.optionalKey(S.String),
      path: S.String,
    },
    replace: {
      description: S.optionalKey(S.String),
      path: S.String,
      value: S.Json,
    },
  })
  .pipe(
    $I.annoteSchema("SyncDataJsonPatchOperation", {
      description: "Add, remove, or replace operation emitted while diffing a sync target's canonical JSON.",
    })
  );

const SyncDataJsonPatch = S.Array(SyncDataJsonPatchOperation).pipe(
  $I.annoteSchema("SyncDataJsonPatch", {
    description: "Ordered JSON Patch operations emitted for a sync target's canonical document.",
  })
);

/**
 * Per-target command result after diffing or writing.
 *
 * @example
 * ```ts
 * import { SyncDataTargetResult } from "@beep/repo-cli/commands/SyncDataToTs/SyncDataToTs.schemas"
 *
 * const result = SyncDataTargetResult.make({
 *   canonicalPatch: [],
 *   canonicalPath: "src/generated/example.data.json",
 *   changed: false,
 *   changedFiles: [],
 *   fileResults: [],
 *   outputPaths: [],
 *   recordCount: 0,
 *   sources: [],
 *   sourceUrls: [],
 *   summary: "0 records",
 *   targetId: "example"
 * })
 * console.log(result.changed) // false
 * ```
 * @category models
 * @since 0.0.0
 */
export class SyncDataTargetResult extends S.Class<SyncDataTargetResult>($I`SyncDataTargetResult`)(
  {
    canonicalPatch: SyncDataJsonPatch,
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
    description: "Per-target command result after diffing or writing generated data.",
  })
) {}
