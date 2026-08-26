/**
 * Schemas for normalized file-diff summaries.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { NonNegativeInt } from "./Int.ts";
import * as SchemaUtils from "./SchemaUtils/index.ts";

const $I = $SchemaId.create("FileDiff.schema");

class InfoBase extends S.Class<InfoBase>($I`InfoBase`)(
  {
    file: SchemaUtils.optional(S.String),
    patch: SchemaUtils.optional(S.String),
    additions: NonNegativeInt,
    deletions: NonNegativeInt,
  },
  $I.annote("InfoBase", {
    description: "Common file-diff fields shared by every status-specific diff summary.",
  })
) {}

/**
 * File-diff summary for a newly added file.
 *
 * **Example** (Decode added file-diff)
 *
 * ```ts import.meta.vitest name="Decode added file-diff"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { FileDiff } from "@beep/schema"
 *
 * const added = Effect.runSync(
 *   S.decodeUnknownEffect(FileDiff.Added)({
 *     status: "added",
 *     file: "src/new-file.ts",
 *     additions: 12,
 *     deletions: 0
 *   })
 * )
 *
 * added.status // => "added"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Added extends InfoBase.extend<Added>($I`Added`)(
  {
    status: S.tag("added"),
  },
  $I.annote("Added", {
    description: "File-diff summary for a newly added file.",
  })
) {}

/**
 * File-diff summary for a removed file.
 *
 * **Example** (Decode deleted file-diff)
 *
 * ```ts import.meta.vitest name="Decode deleted file-diff"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { FileDiff } from "@beep/schema"
 *
 * const deleted = Effect.runSync(
 *   S.decodeUnknownEffect(FileDiff.Deleted)({
 *     status: "deleted",
 *     file: "src/old-file.ts",
 *     additions: 0,
 *     deletions: 8
 *   })
 * )
 *
 * deleted.deletions // => 8
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Deleted extends InfoBase.extend<Deleted>($I`Deleted`)(
  {
    status: S.tag("deleted"),
  },
  $I.annote("Deleted", {
    description: "File-diff summary for a removed file.",
  })
) {}

/**
 * File-diff summary for an existing file with changed content.
 *
 * **Example** (Decode modified file-diff)
 *
 * ```ts import.meta.vitest name="Decode modified file-diff"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { FileDiff } from "@beep/schema"
 *
 * const modified = Effect.runSync(
 *   S.decodeUnknownEffect(FileDiff.Modified)({
 *     status: "modified",
 *     file: "src/existing-file.ts",
 *     patch: "@@ -1 +1 @@",
 *     additions: 3,
 *     deletions: 1
 *   })
 * )
 *
 * modified.patch // => "@@ -1 +1 @@"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Modified extends InfoBase.extend<Modified>($I`Modified`)(
  {
    status: S.tag("modified"),
  },
  $I.annote("Modified", {
    description: "File-diff summary for an existing file with changed content.",
  })
) {}

/**
 * Tagged union of all supported file-diff summary variants.
 *
 * **Example** (Decode file-diff union)
 *
 * ```ts import.meta.vitest name="Decode file-diff union"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { FileDiff } from "@beep/schema"
 *
 * const info = Effect.runSync(
 *   S.decodeUnknownEffect(FileDiff.Info)({
 *     status: "modified",
 *     file: "src/schema.ts",
 *     additions: 2,
 *     deletions: 1
 *   })
 * )
 *
 * info.status // => "modified"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Info = S.Union([Added, Deleted, Modified]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("Info", {
    description: "Tagged union of file-diff summaries keyed by status.",
  })
);

/**
 * Type for parsed file-diff information.
 *
 * **Example** (Access Info status type)
 *
 * ```ts
 * import type { FileDiff } from "@beep/schema"
 *
 * const status: FileDiff.Info["status"] = "modified"
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Info = typeof Info.Type;

/**
 * Encoded companion types for {@link Info}.
 *
 * **Example** (Use Encoded Info type)
 *
 * ```ts
 * import type { FileDiff } from "@beep/schema"
 *
 * type EncodedInfo = FileDiff.Info.Encoded
 * const describe = (info: EncodedInfo): string => `${info.status}: ${info.file}`
 * console.log(describe.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace Info {
  /**
   * Encoded wire shape accepted and emitted by {@link Info}.
   *
   * **Example** (Assign encoded Info value)
   *
   * ```ts
   * import type { FileDiff } from "@beep/schema"
   *
   * const encoded: FileDiff.Info.Encoded = {
   *   status: "deleted",
   *   file: "src/old-file.ts",
   *   additions: 0,
   *   deletions: 4
   * }
   *
   * console.log(encoded.status)
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof Info.Encoded;
}
