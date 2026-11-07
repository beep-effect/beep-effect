/**
 * Restricted genesis commands initialize existing aggregate streams without live policies.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as S from "effect/Schema";
import * as R from "./LegacySync.schema.ts";
import { ConflictRecord } from "./SyncConflict.events.ts";
import { DestinationState } from "./SyncDestination.events.ts";
import { ItemRecord } from "./SyncItem.events.ts";
import { OperationRecord } from "./SyncOperation.events.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";
/**
 * Stores the complete historical item snapshot as an immutable v1 fact.
 *
 * **Example** (Inspect migration contract)
 * ```ts
 * import { ItemGenesisImported } from "@beep/documents-domain/aggregates/VaultSync";
 * void ItemGenesisImported;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ItemGenesisImported extends Domain.Event("ItemGenesisImported", {
  importId: S.NonEmptyString,
  row: R.LegacyItemRow,
  record: ItemRecord,
}) {
  static readonly schemaVersion = 1;
}
/**
 * Initializes item state through the normal transactional aggregate store.
 *
 * **Example** (Inspect migration contract)
 * ```ts
 * import { ImportItemGenesis } from "@beep/documents-domain/aggregates/VaultSync";
 * void ImportItemGenesis;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ImportItemGenesis extends Domain.Command("ImportItemGenesis", {
  target: V.ItemId,
  input: { importId: S.NonEmptyString, row: R.LegacyItemRow, record: ItemRecord },
  events: [ItemGenesisImported],
  rejects: [SyncRuleViolation],
}) {}
/**
 * Stores the complete historical operation snapshot as an immutable v1 fact.
 *
 * **Example** (Inspect migration contract)
 * ```ts
 * import { OperationGenesisImported } from "@beep/documents-domain/aggregates/VaultSync";
 * void OperationGenesisImported;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class OperationGenesisImported extends Domain.Event("OperationGenesisImported", {
  importId: S.NonEmptyString,
  row: R.LegacyOperationRow,
  record: OperationRecord,
}) {
  static readonly schemaVersion = 1;
}
/**
 * Initializes operation state through the normal transactional aggregate store.
 *
 * **Example** (Inspect migration contract)
 * ```ts
 * import { ImportOperationGenesis } from "@beep/documents-domain/aggregates/VaultSync";
 * void ImportOperationGenesis;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ImportOperationGenesis extends Domain.Command("ImportOperationGenesis", {
  target: V.OperationId,
  input: { importId: S.NonEmptyString, row: R.LegacyOperationRow, record: OperationRecord },
  events: [OperationGenesisImported],
  rejects: [SyncRuleViolation],
}) {}
/**
 * Stores the complete historical conflict snapshot as an immutable v1 fact.
 *
 * **Example** (Inspect migration contract)
 * ```ts
 * import { ConflictGenesisImported } from "@beep/documents-domain/aggregates/VaultSync";
 * void ConflictGenesisImported;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ConflictGenesisImported extends Domain.Event("ConflictGenesisImported", {
  importId: S.NonEmptyString,
  row: R.LegacyConflictRow,
  record: ConflictRecord,
}) {
  static readonly schemaVersion = 1;
}
/**
 * Initializes conflict state through the normal transactional aggregate store.
 *
 * **Example** (Inspect migration contract)
 * ```ts
 * import { ImportConflictGenesis } from "@beep/documents-domain/aggregates/VaultSync";
 * void ImportConflictGenesis;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ImportConflictGenesis extends Domain.Command("ImportConflictGenesis", {
  target: V.ConflictId,
  input: { importId: S.NonEmptyString, row: R.LegacyConflictRow, record: ConflictRecord },
  events: [ConflictGenesisImported],
  rejects: [SyncRuleViolation],
}) {}
/**
 * Stores the complete historical destination snapshot as an immutable v1 fact.
 *
 * **Example** (Inspect migration contract)
 * ```ts
 * import { DestinationGenesisImported } from "@beep/documents-domain/aggregates/VaultSync";
 * void DestinationGenesisImported;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class DestinationGenesisImported extends Domain.Event("DestinationGenesisImported", {
  importId: S.NonEmptyString,
  record: DestinationState,
}) {
  static readonly schemaVersion = 1;
}
/**
 * Initializes destination state through the normal transactional aggregate store.
 *
 * **Example** (Inspect migration contract)
 * ```ts
 * import { ImportDestinationGenesis } from "@beep/documents-domain/aggregates/VaultSync";
 * void ImportDestinationGenesis;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ImportDestinationGenesis extends Domain.Command("ImportDestinationGenesis", {
  target: V.DestinationId,
  input: { importId: S.NonEmptyString, record: DestinationState },
  events: [DestinationGenesisImported],
  rejects: [SyncRuleViolation],
}) {}
/**
 * Stores the complete historical cursor snapshot as an immutable v1 fact.
 *
 * **Example** (Inspect migration contract)
 * ```ts
 * import { CursorGenesisImported } from "@beep/documents-domain/aggregates/VaultSync";
 * void CursorGenesisImported;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class CursorGenesisImported extends Domain.Event("CursorGenesisImported", {
  importId: S.NonEmptyString,
  row: R.LegacyCursorRow,
  selected: S.Boolean,
  paused: S.Boolean,
}) {
  static readonly schemaVersion = 1;
}
/**
 * Initializes cursor state through the normal transactional aggregate store.
 *
 * **Example** (Inspect migration contract)
 * ```ts
 * import { ImportCursorGenesis } from "@beep/documents-domain/aggregates/VaultSync";
 * void ImportCursorGenesis;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class ImportCursorGenesis extends Domain.Command("ImportCursorGenesis", {
  target: V.DestinationId,
  input: { importId: S.NonEmptyString, row: R.LegacyCursorRow, selected: S.Boolean, paused: S.Boolean },
  events: [CursorGenesisImported],
  rejects: [SyncRuleViolation],
}) {}
/**
 * Carries importer-resolved audit provenance independently of the interactive actor.
 *
 * **Example** (Inspect provenance encoding)
 * ```ts
 * import { GenesisProvenance } from "@beep/documents-domain/aggregates/VaultSync";
 * console.log(GenesisProvenance.key);
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class GenesisProvenance extends Domain.RequestContext<GenesisProvenance>()(
  "Documents/GenesisProvenance",
  S.Struct({ principal: S.String, source: S.String })
) {}
