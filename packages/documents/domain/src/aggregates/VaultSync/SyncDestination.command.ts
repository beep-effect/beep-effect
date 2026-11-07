import * as Domain from "@alchemy.run/domain";
import * as S from "effect/Schema";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * DestinationState vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { DestinationState } from "@beep/documents-domain/aggregates/VaultSync";
 * void DestinationState;
 * ```
 * @category vault-sync
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
]);
/** Runtime value accepted by {@link DestinationState}. @category vault-sync @since 0.0.0 */
export type DestinationState = typeof DestinationState.Type;
/**
 * DestinationRegistered vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { DestinationRegistered } from "@beep/documents-domain/aggregates/VaultSync";
 * void DestinationRegistered;
 * ```
 * @category vault-sync
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
 * @category vault-sync
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
 * @category vault-sync
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
 * @category vault-sync
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
 * @category vault-sync
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
 * @category vault-sync
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
 * @category vault-sync
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
 * @category vault-sync
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
 * @category vault-sync
 * @since 0.0.0
 */
export class ItemPathReleased extends Domain.Event("ItemPathReleased", { path: V.VaultRelPath, itemId: V.ItemId }) {
  static readonly schemaVersion = 1;
}
/**
 * RegisterDestination vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { RegisterDestination } from "@beep/documents-domain/aggregates/VaultSync";
 * void RegisterDestination;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class RegisterDestination extends Domain.Command("RegisterDestination", {
  target: V.DestinationId,
  input: { orgId: S.Int, workspaceId: S.Int, name: S.NonEmptyString },
  events: [DestinationRegistered],
  rejects: [SyncRuleViolation],
}) {}
/**
 * RenameDestination vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { RenameDestination } from "@beep/documents-domain/aggregates/VaultSync";
 * void RenameDestination;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class RenameDestination extends Domain.Command("RenameDestination", {
  target: V.DestinationId,
  input: { name: S.NonEmptyString, previousName: S.String },
  events: [DestinationRenamed],
  rejects: [SyncRuleViolation],
}) {}
/**
 * ResolveDestinationRoot vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ResolveDestinationRoot } from "@beep/documents-domain/aggregates/VaultSync";
 * void ResolveDestinationRoot;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class ResolveDestinationRoot extends Domain.Command("ResolveDestinationRoot", {
  target: V.DestinationId,
  input: { rootId: V.RemoteItemId },
  events: [RootFolderResolved],
  rejects: [SyncRuleViolation],
}) {}
/**
 * PauseDestination vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { PauseDestination } from "@beep/documents-domain/aggregates/VaultSync";
 * void PauseDestination;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class PauseDestination extends Domain.Command("PauseDestination", {
  target: V.DestinationId,
  input: {},
  events: [DestinationPaused],
  rejects: [SyncRuleViolation],
}) {}
/**
 * ResumeDestination vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ResumeDestination } from "@beep/documents-domain/aggregates/VaultSync";
 * void ResumeDestination;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class ResumeDestination extends Domain.Command("ResumeDestination", {
  target: V.DestinationId,
  input: {},
  events: [DestinationConnected],
  rejects: [SyncRuleViolation],
}) {}
/**
 * RecordDestinationPoll vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { RecordDestinationPoll } from "@beep/documents-domain/aggregates/VaultSync";
 * void RecordDestinationPoll;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class RecordDestinationPoll extends Domain.Command("RecordDestinationPoll", {
  target: V.DestinationId,
  input: { position: S.NullOr(S.String), error: S.NullOr(S.String) },
  events: [CursorAdvanced, CursorFailed],
  rejects: [SyncRuleViolation],
}) {}
/**
 * ClaimItemPath vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ClaimItemPath } from "@beep/documents-domain/aggregates/VaultSync";
 * void ClaimItemPath;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class ClaimItemPath extends Domain.Command("ClaimItemPath", {
  target: V.DestinationId,
  input: { path: V.VaultRelPath, itemId: V.ItemId },
  events: [ItemPathClaimed],
  rejects: [SyncRuleViolation],
}) {}
/**
 * ReleaseItemPath vault sync contract.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { ReleaseItemPath } from "@beep/documents-domain/aggregates/VaultSync";
 * void ReleaseItemPath;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class ReleaseItemPath extends Domain.Command("ReleaseItemPath", {
  target: V.DestinationId,
  input: { path: V.VaultRelPath, itemId: V.ItemId },
  events: [ItemPathReleased],
  rejects: [SyncRuleViolation],
}) {}
