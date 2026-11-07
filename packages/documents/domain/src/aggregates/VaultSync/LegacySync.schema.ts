/**
 * Lossless historical SQL row contracts used exclusively by offline genesis.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DocumentsDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $DocumentsDomainId.create("aggregates/VaultSync/LegacySync.schema");
/**
 * Preserves every item SQL column without normalizing historical values.
 *
 * **Example** (Inspect migration contract)
 * ```ts
 * import { LegacyItemRow } from "@beep/documents-domain/aggregates/VaultSync";
 * void LegacyItemRow;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class LegacyItemRow extends S.Opaque<LegacyItemRow, { readonly brand: unique symbol }>()(
  S.Struct({
    deleted_at: S.NullOr(S.Int),
    deleted_by_principal: S.NullOr(S.Unknown),
    created_at: S.Int,
    created_by_principal: S.Unknown,
    org_id: S.Int,
    row_version: S.Int,
    schema_version: S.String,
    source: S.String,
    updated_at: S.Int,
    updated_by_principal: S.Unknown,
    content_digest: S.NullOr(S.String),
    content_size_bytes: S.NullOr(S.Int),
    item_kind: S.String,
    last_error: S.NullOr(S.String),
    last_pushed_digest: S.NullOr(S.String),
    last_pushed_generation: S.NullOr(S.Int),
    local_generation: S.Int,
    local_rel_path: S.String,
    provider: S.String,
    remote_id: S.NullOr(S.String),
    remote_name: S.NullOr(S.String),
    remote_parent_id: S.NullOr(S.String),
    sync_state: S.String,
    workspace_id: S.Int,
    entity_type: S.String,
    id: S.Int,
    public_id: S.String,
  }).pipe(
    $I.annoteSchema("LegacyItemRow", {
      description: "Complete historical item row, including compatibility audit and identity.",
    })
  )
) {}
/**
 * Preserves every operation SQL column without normalizing historical values.
 *
 * **Example** (Inspect migration contract)
 * ```ts
 * import { LegacyOperationRow } from "@beep/documents-domain/aggregates/VaultSync";
 * void LegacyOperationRow;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class LegacyOperationRow extends S.Opaque<LegacyOperationRow, { readonly brand: unique symbol }>()(
  S.Struct({
    deleted_at: S.NullOr(S.Int),
    deleted_by_principal: S.NullOr(S.Unknown),
    created_at: S.Int,
    created_by_principal: S.Unknown,
    org_id: S.Int,
    row_version: S.Int,
    schema_version: S.String,
    source: S.String,
    updated_at: S.Int,
    updated_by_principal: S.Unknown,
    attempt_count: S.Int,
    idempotency_key: S.String,
    input_content_digest: S.NullOr(S.String),
    input_generation: S.Int,
    last_error: S.NullOr(S.String),
    operation_type: S.String,
    provider: S.String,
    status: S.String,
    sync_item_id: S.Int,
    target_name: S.String,
    target_parent_rel_path: S.NullOr(S.String),
    target_rel_path: S.String,
    workspace_id: S.Int,
    entity_type: S.String,
    id: S.Int,
    public_id: S.String,
  }).pipe(
    $I.annoteSchema("LegacyOperationRow", {
      description: "Complete historical operation row, including compatibility audit and identity.",
    })
  )
) {}
/**
 * Preserves every conflict SQL column without normalizing historical values.
 *
 * **Example** (Inspect migration contract)
 * ```ts
 * import { LegacyConflictRow } from "@beep/documents-domain/aggregates/VaultSync";
 * void LegacyConflictRow;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class LegacyConflictRow extends S.Opaque<LegacyConflictRow, { readonly brand: unique symbol }>()(
  S.Struct({
    deleted_at: S.NullOr(S.Int),
    deleted_by_principal: S.NullOr(S.Unknown),
    created_at: S.Int,
    created_by_principal: S.Unknown,
    org_id: S.Int,
    row_version: S.Int,
    schema_version: S.String,
    source: S.String,
    updated_at: S.Int,
    updated_by_principal: S.Unknown,
    conflict_kind: S.String,
    local_rel_path: S.NullOr(S.String),
    provider: S.String,
    remote_event_id: S.NullOr(S.String),
    remote_id: S.NullOr(S.String),
    remote_payload: S.Unknown,
    resolution_status: S.String,
    sync_item_id: S.NullOr(S.Int),
    workspace_id: S.Int,
    entity_type: S.String,
    id: S.Int,
    public_id: S.String,
  }).pipe(
    $I.annoteSchema("LegacyConflictRow", {
      description: "Complete historical conflict row, including compatibility audit and identity.",
    })
  )
) {}
/**
 * Preserves every cursor SQL column without normalizing historical values.
 *
 * **Example** (Inspect migration contract)
 * ```ts
 * import { LegacyCursorRow } from "@beep/documents-domain/aggregates/VaultSync";
 * void LegacyCursorRow;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class LegacyCursorRow extends S.Opaque<LegacyCursorRow, { readonly brand: unique symbol }>()(
  S.Struct({
    deleted_at: S.NullOr(S.Int),
    deleted_by_principal: S.NullOr(S.Unknown),
    created_at: S.Int,
    created_by_principal: S.Unknown,
    org_id: S.Int,
    row_version: S.Int,
    schema_version: S.String,
    source: S.String,
    updated_at: S.Int,
    updated_by_principal: S.Unknown,
    last_error: S.NullOr(S.String),
    last_event_id: S.NullOr(S.String),
    provider: S.String,
    status: S.String,
    stream_position: S.String,
    workspace_id: S.Int,
    entity_type: S.String,
    id: S.Int,
    public_id: S.String,
  }).pipe(
    $I.annoteSchema("LegacyCursorRow", {
      description: "Complete historical cursor row, including compatibility audit and identity.",
    })
  )
) {}
