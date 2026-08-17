/**
 * SyncConflict concept-local value schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocumentsDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $DocumentsDomainId.create("entities/SyncConflict/SyncConflict.values");

/**
 * Kind of remote drift detected against the one-way mirror.
 *
 * **Example** (Check remoteEdit kind)
 *
 * ```ts
 * import { SyncConflictKind } from "@beep/documents-domain/entities/SyncConflict"
 *
 * console.log(SyncConflictKind.is.remoteEdit(SyncConflictKind.Enum.remoteEdit))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const SyncConflictKind = LiteralKit([
  "remoteCreate",
  "remoteEdit",
  "remoteMove",
  "remoteRename",
  "remoteDelete",
  "remoteUnknown",
]).pipe(
  $I.annoteSchema("SyncConflictKind", {
    description: "Kind of remote drift detected against the one-way mirror.",
  })
);

/**
 * Runtime type for {@link SyncConflictKind}.
 *
 * @category value-objects
 * @since 0.0.0
 */
export type SyncConflictKind = typeof SyncConflictKind.Type;

/**
 * Review status for a surfaced remote-drift record.
 *
 * **Example** (Check open resolution)
 *
 * ```ts
 * import { SyncConflictResolution } from "@beep/documents-domain/entities/SyncConflict"
 *
 * console.log(SyncConflictResolution.is.open(SyncConflictResolution.Enum.open))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const SyncConflictResolution = LiteralKit(["open", "reviewed"]).pipe(
  $I.annoteSchema("SyncConflictResolution", {
    description: "Review status for a surfaced remote-drift record.",
  })
);

/**
 * Runtime type for {@link SyncConflictResolution}.
 *
 * @category value-objects
 * @since 0.0.0
 */
export type SyncConflictResolution = typeof SyncConflictResolution.Type;
