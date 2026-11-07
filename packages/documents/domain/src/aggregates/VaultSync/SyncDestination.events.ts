/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
// fallow-ignore-file unused-class-member -- the @beep/alchemy-postgres driver reads the static `schemaVersion` reflectively to version stored events (D12). Owner: @beep/documents-domain. Exit: delete when alchemy ships a kernel event-version slot and the driver stops reading the static.
import * as Domain from "@alchemy.run/domain";
import { $DocumentsDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as V from "./Values.ts";

const $I = $DocumentsDomainId.create("aggregates/VaultSync/SyncDestination.command");
/**
 * DestinationState vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { DestinationState } from "@beep/documents-domain/aggregates/VaultSync";
 * void DestinationState;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const DestinationState = S.Union([
  S.TaggedStruct("Unregistered", {}),
  S.TaggedStruct("Registered", {
    orgId: S.Int,
    workspaceId: S.Int,
    name: S.NonEmptyString,
    provider: S.tag("box"),
    rootId: S.NullOr(V.RemoteItemId),
    cursor: S.NullOr(S.String),
    cursorError: S.NullOr(S.String),
    paused: S.Boolean,
    paths: S.HashMap(V.VaultRelPath, V.ItemId),
  }),
]).pipe($I.annoteSchema("DestinationState", { description: "DestinationState persisted vault sync value." }));
/**
 * Runtime value accepted by {@link DestinationState}.
 *
 * @category aggregates
 * @since 0.0.0
 */
export type DestinationState = typeof DestinationState.Type;
/**
 * DestinationRegistered vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { DestinationRegistered } from "@beep/documents-domain/aggregates/VaultSync";
 * void DestinationRegistered;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class DestinationRegistered extends Domain.Event("DestinationRegistered", {
  orgId: S.Int,
  workspaceId: S.Int,
  name: S.NonEmptyString,
}) {
  static readonly schemaVersion = 1;
}
/**
 * DestinationRenamed vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { DestinationRenamed } from "@beep/documents-domain/aggregates/VaultSync";
 * void DestinationRenamed;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class DestinationRenamed extends Domain.Event("DestinationRenamed", {
  name: S.NonEmptyString,
  previousName: S.String,
}) {
  static readonly schemaVersion = 1;
}
/**
 * RootFolderResolved vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { RootFolderResolved } from "@beep/documents-domain/aggregates/VaultSync";
 * void RootFolderResolved;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class RootFolderResolved extends Domain.Event("RootFolderResolved", { rootId: V.RemoteItemId }) {
  static readonly schemaVersion = 1;
}
/**
 * DestinationPaused vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { DestinationPaused } from "@beep/documents-domain/aggregates/VaultSync";
 * void DestinationPaused;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class DestinationPaused extends Domain.Event("DestinationPaused", {}) {
  static readonly schemaVersion = 1;
}
/**
 * DestinationConnected vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { DestinationConnected } from "@beep/documents-domain/aggregates/VaultSync";
 * void DestinationConnected;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class DestinationConnected extends Domain.Event("DestinationConnected", {}) {
  static readonly schemaVersion = 1;
}
/**
 * CursorAdvanced vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { CursorAdvanced } from "@beep/documents-domain/aggregates/VaultSync";
 * void CursorAdvanced;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class CursorAdvanced extends Domain.Event("CursorAdvanced", { position: S.String }) {
  static readonly schemaVersion = 1;
}
/**
 * CursorFailed vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { CursorFailed } from "@beep/documents-domain/aggregates/VaultSync";
 * void CursorFailed;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class CursorFailed extends Domain.Event("CursorFailed", { reason: S.String }) {
  static readonly schemaVersion = 1;
}
/**
 * ItemPathClaimed vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ItemPathClaimed } from "@beep/documents-domain/aggregates/VaultSync";
 * void ItemPathClaimed;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ItemPathClaimed extends Domain.Event("ItemPathClaimed", { path: V.VaultRelPath, itemId: V.ItemId }) {
  static readonly schemaVersion = 1;
}
/**
 * ItemPathReleased vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ItemPathReleased } from "@beep/documents-domain/aggregates/VaultSync";
 * void ItemPathReleased;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ItemPathReleased extends Domain.Event("ItemPathReleased", { path: V.VaultRelPath, itemId: V.ItemId }) {
  static readonly schemaVersion = 1;
}
